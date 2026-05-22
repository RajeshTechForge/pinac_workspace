use std::fs;
use tauri::Manager;

#[derive(serde::Deserialize, serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct LlmProvider {
    value: String,
    label: String,
    default_model: String,
}

#[derive(serde::Deserialize, serde::Serialize)]
struct LlmConfig {
    providers: Vec<LlmProvider>,
}

#[derive(serde::Deserialize, serde::Serialize)]
struct AppConfig {
    llm: LlmConfig,
}

#[tauri::command]
fn read_config(app: tauri::AppHandle) -> Result<AppConfig, String> {
    let resource_dir = app.path().resource_dir().map_err(|e| e.to_string())?;
    let config_path = resource_dir.join("config.toml");
    let content = fs::read_to_string(&config_path)
        .map_err(|e| format!("Failed to read config: {}", e))?;
    let config: AppConfig =
        toml::from_str(&content).map_err(|e| format!("Failed to parse config: {}", e))?;
    Ok(config)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![greet, read_config])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}
