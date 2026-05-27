use std::fs;
use std::sync::Mutex;
use tauri::Manager;

mod db;
mod llm;
mod secure_storage;

/// A single LLM provider entry as stored in `config.toml`.
#[derive(serde::Deserialize, serde::Serialize)]
struct LlmModel {
    id: String,
    name: String,
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
// Tauri application entry point
// ---------------------------------------------------------------------------

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            // Initialize the SQLite database and register its connection
            let conn = db::init::init_db(app.handle())
                .map_err(|e| format!("Database initialization failed: {e}"))?;
            app.manage(Mutex::new(conn));
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            read_config,
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
