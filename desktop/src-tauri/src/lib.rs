use std::fs;
use std::sync::Mutex;
use tauri::Emitter;
use tauri::Manager;
#[cfg(desktop)]
use tauri_plugin_deep_link::DeepLinkExt;

mod db;
mod llm;
mod secure_storage;

/// Per-model thinking/reasoning configuration from config.toml.
/// `mode` is one of "adaptive", "enabled", "effort", or "level".
#[derive(serde::Deserialize, serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct ThinkingConfig {
    mode: String,
    efforts: Vec<String>,
    default_effort: String,
}

/// A single LLM provider entry as stored in `config.toml`.
#[derive(serde::Deserialize, serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct LlmModel {
    id: String,
    name: String,
    thinking: Option<ThinkingConfig>,
}

#[derive(serde::Deserialize, serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct LlmProvider {
    value: String,
    label: String,
    api_key_name: String,
    default_model: String,
    models: Vec<LlmModel>,
}

#[derive(serde::Deserialize, serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct LlmConfig {
    default_provider: String,
    providers: Vec<LlmProvider>,
}

#[derive(serde::Deserialize, serde::Serialize)]
struct AppConfig {
    llm: LlmConfig,
}

/// Reads and parses `config.toml` from the application's resource directory.
#[tauri::command]
fn read_config(app: tauri::AppHandle) -> Result<AppConfig, String> {
    let resource_dir = app.path().resource_dir().map_err(|e| e.to_string())?;
    let config_path = resource_dir.join("config.toml");
    let content =
        fs::read_to_string(&config_path).map_err(|e| format!("Failed to read config: {}", e))?;
    let config: AppConfig =
        toml::from_str(&content).map_err(|e| format!("Failed to parse config: {}", e))?;
    Ok(config)
}

// ---------------------------------------------------------------------------
// Auth token storage commands
// ---------------------------------------------------------------------------
// These thin wrappers expose the existing AES-128-GCM secure_storage layer to
// the TypeScript frontend via Tauri IPC.  The key "auth_tokens" stores a JSON
// blob of { accessToken, refreshToken, expiresAt, userId }.
//
// SECURITY NOTE: The code_verifier is intentionally NOT stored here — it lives
// only in the TypeScript module-level Map for the lifetime of the auth flow and
// is cleared immediately after the token exchange succeeds or fails.

/// Encrypts `json_payload` and stores it under the fixed key "auth_tokens".
#[tauri::command]
fn auth_save_tokens(app: tauri::AppHandle, json_payload: String) -> Result<(), String> {
    secure_storage::encrypt_and_store(&app, "auth_tokens", &json_payload).map_err(|e| e.to_string())
}

/// Decrypts and returns the stored auth token JSON, or `None` if not found.
#[tauri::command]
fn auth_get_tokens(app: tauri::AppHandle) -> Result<Option<String>, String> {
    match secure_storage::load_and_decrypt(&app, "auth_tokens") {
        Ok(payload) => Ok(Some(payload)),
        Err(secure_storage::SecureStorageError::Io(ref e))
            if e.kind() == std::io::ErrorKind::NotFound =>
        {
            Ok(None)
        }
        Err(e) => Err(e.to_string()),
    }
}

/// Removes the stored auth tokens (used on logout).
#[tauri::command]
fn auth_clear_tokens(app: tauri::AppHandle) -> Result<(), String> {
    use std::path::PathBuf;
    let dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let path: PathBuf = dir.join("auth_tokens.enc");
    if path.exists() {
        fs::remove_file(&path).map_err(|e| e.to_string())?;
    }
    Ok(())
}

// ---------------------------------------------------------------------------
// Tauri application entry point
// ---------------------------------------------------------------------------

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let mut builder = tauri::Builder::default();

    // ── Single-instance + deep-link (desktop only) ───────────────────────────
    // Must be registered FIRST so the plugin intercepts OS-level "second instance"
    // launches before any other plugin or setup code runs.
    //
    // When the OS opens a `pinac://auth/callback?...` URI while the app is already
    // running (Windows / Linux), the OS spawns a new process with the URI as a CLI
    // argument. The single-instance plugin's callback runs in the PRIMARY process,
    // where the in-memory PKCE state (code_verifier, state) lives.
    //
    // The callback re-emits the URL as a "deep-link://new-url" event on the main
    // window so the TypeScript handler in deepLinkHandler.ts can process it
    // identically regardless of whether it arrived via onOpenUrl (macOS) or via
    // single-instance forwarding (Windows/Linux).
    //
    // COLD-START LIMITATION: If the app is NOT running when the deep link fires,
    // the OS launches a fresh process. The plugin forwards the URL to the new
    // process's own single-instance callback, but there is no in-memory
    // code_verifier to validate against — the flow will fail with NO_PENDING_FLOW.
    // The user must initiate startLogin() from within the running app first.
    // This is correct behaviour per RFC 8252 §8.
    #[cfg(desktop)]
    {
        builder = builder
            .plugin(tauri_plugin_single_instance::init(|app, argv, _cwd| {
                // argv[1] is the deep-link URI when launched by the OS.
                // Forward it to the running instance's frontend event bus.
                if let Some(url) = argv.get(1) {
                    let url = url.clone();
                    if url.starts_with("pinac://") {
                        // Emit to main window; deepLinkHandler.ts listens for this event.
                        app.emit("deep-link://new-url", url).unwrap_or_else(|e| {
                            eprintln!("[auth] Failed to emit deep-link event: {e}");
                        });
                    }
                }
                // Bring the existing window to the foreground.
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.set_focus();
                }
            }))
            .plugin(tauri_plugin_deep_link::init());
    }

    builder
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            // Initialize the SQLite database and register its connection
            let conn = db::init::init_db(app.handle())
                .map_err(|e| format!("Database initialization failed: {e}"))?;
            app.manage(Mutex::new(conn));

            // Register the pinac:// scheme with the OS at runtime.
            // On macOS the scheme is also declared in Info.plist (via tauri.conf.json),
            // but this runtime call is required for the plugin to emit onOpenUrl events.
            // On Windows/Linux, scheme registration at runtime is a no-op (handled by
            // the installer / manual reg commands during dev); this call is safe to make.
            #[cfg(desktop)]
            {
                app.deep_link().register("pinac").unwrap_or_else(|e| {
                    // Non-fatal: dev builds on Linux/Windows where the scheme
                    // is not OS-registered will fail here, which is expected.
                    eprintln!("[auth] deep_link register warning: {e}");
                });
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            read_config,
            auth_save_tokens,
            auth_get_tokens,
            auth_clear_tokens,
            llm::commands::llm_chat,
            llm::commands::llm_chat_stream,
            llm::commands::save_api_key,
            llm::commands::api_key_exists,
            db::commands::db_list_conversations,
            db::commands::db_get_messages,
            db::commands::db_save_pair,
            db::commands::db_delete_conversation,
            db::commands::db_toggle_pin,
            db::commands::db_rename_conversation,
            db::commands::db_clear_messages,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
