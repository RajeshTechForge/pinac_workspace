use tauri::{AppHandle, Emitter};

use crate::{
    llm::{
        client::LlmClient,
        types::{ChatMessage, ChatRequest, ChatResponse, StreamChunk},
    },
    secure_storage,
};

/// Tauri event name broadcast to all windows for each SSE streaming chunk.
const STREAM_CHUNK_EVENT: &str = "llm-stream-chunk";

// ---------------------------------------------------------------------------
// Shared request builder
// ---------------------------------------------------------------------------

/// Decrypts the API key identified by `key_name` from secure storage and
/// assembles a fully-populated `ChatRequest`.
#[allow(clippy::too_many_arguments)]
fn build_request(
    app: &AppHandle,
    key_name: &str,
    provider: String,
    model: String,
    messages: Vec<ChatMessage>,
    max_tokens: u32,
    temperature: f64,
    top_p: f64,
    timeout: f64,
    stream: bool,
) -> Result<ChatRequest, String> {
    let api_key = secure_storage::load_and_decrypt(app, key_name).map_err(String::from)?;
    Ok(ChatRequest {
        provider,
        api_key,
        model,
        messages,
        stream,
        max_tokens,
        temperature,
        top_p,
        stop_sequences: vec![],
        timeout,
    })
}

// ---------------------------------------------------------------------------
// Tauri commands
// ---------------------------------------------------------------------------

/// Sends non-streaming request to LLM API and returns complete response.
#[allow(clippy::too_many_arguments)]
#[tauri::command]
pub async fn llm_chat(
    app: AppHandle,
    key_name: String,
    provider: String,
    model: String,
    messages: Vec<ChatMessage>,
    max_tokens: u32,
    temperature: f64,
    top_p: f64,
    timeout: f64,
) -> Result<ChatResponse, String> {
    let req = build_request(
        &app, &key_name, provider, model, messages, max_tokens, temperature, top_p, timeout, false,
    )?;
    let client = LlmClient::new();
    client.chat_blocking(req).await.map_err(String::from)
}

/// Sends a streaming chat request to the LLM API.
#[allow(clippy::too_many_arguments)]
#[tauri::command]
pub async fn llm_chat_stream(
    app: AppHandle,
    key_name: String,
    provider: String,
    model: String,
    messages: Vec<ChatMessage>,
    max_tokens: u32,
    temperature: f64,
    top_p: f64,
    timeout: f64,
) -> Result<(), String> {
    let req = build_request(
        &app, &key_name, provider, model, messages, max_tokens, temperature, top_p, timeout, true,
    )?;
    let client = LlmClient::new();
    client
        .chat_streaming(req, |chunk: StreamChunk| {
            let _ = app.emit(STREAM_CHUNK_EVENT, &chunk);
        })
        .await
        .map_err(String::from)
}

/// Encrypts `plaintext_key` with AES-128-GCM and stores the result in
/// `<app_data_dir>/<key_name>.enc`.
#[tauri::command]
pub fn save_api_key(
    app: AppHandle,
    key_name: String,
    plaintext_key: String,
) -> Result<(), String> {
    secure_storage::encrypt_and_store(&app, &key_name, &plaintext_key).map_err(String::from)
}

/// Returns `true` when `<app_data_dir>/<key_name>.enc` is present on disk.
#[tauri::command]
pub fn api_key_exists(app: AppHandle, key_name: String) -> Result<bool, String> {
    secure_storage::api_key_file_exists(&app, &key_name).map_err(String::from)
}
