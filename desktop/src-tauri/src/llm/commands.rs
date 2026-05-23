use tauri::{AppHandle, Emitter};

use crate::{
    llm::{
        client::LlmClient,
        types::{ChatResponse, StreamChunk},
    },
    secure_storage,
};

/// Event name broadcast to all windows for each SSE streaming chunk.
const STREAM_CHUNK_EVENT: &str = "llm-stream-chunk";

/// Sends non-streaming chat request to LLM API and returns complete response.
#[tauri::command]
pub async fn llm_chat() -> Result<ChatResponse, String> {
    let client = LlmClient::new();
    client.chat_blocking().await.map_err(String::from)
}

/// Sends a streaming chat request to the LLM API.
#[tauri::command]
pub async fn llm_chat_stream(app: AppHandle) -> Result<(), String> {
    let client = LlmClient::new();

    client
        .chat_streaming(|chunk: StreamChunk| {
            // Ignore emit errors — the window may have been closed between
            // the command being issued and the stream completing.
            let _ = app.emit(STREAM_CHUNK_EVENT, &chunk);
        })
        .await
        .map_err(String::from)
}

/// Encrypts `plaintext_key` with AES-128-GCM and stores the result in the
/// app's private data directory.
#[tauri::command]
pub fn save_api_key(app: AppHandle, plaintext_key: String) -> Result<(), String> {
    secure_storage::encrypt_and_store(&app, &plaintext_key).map_err(String::from)
}

/// Returns `true` when an encrypted API key file is present on disk.
#[tauri::command]
pub fn api_key_exists(app: AppHandle) -> Result<bool, String> {
    secure_storage::api_key_file_exists(&app).map_err(String::from)
}
