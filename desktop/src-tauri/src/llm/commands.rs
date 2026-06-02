use tauri::{AppHandle, Emitter};

use crate::{
    llm::{
        client::LlmClient,
        types::{ChatMessage, ChatRequest, ChatResponse, StreamChunk, StreamError},
    },
    secure_storage,
};

/// Tauri event name broadcast
const STREAM_CHUNK_EVENT: &str = "llm-stream-chunk";
const STREAM_ERROR_EVENT: &str = "llm-stream-error";

// ---------------------------------------------------------------------------
// Thinking helpers
// ---------------------------------------------------------------------------

/// Default request timeout
const DEFAULT_TIMEOUT: f64 = 60.0;
const DEFAULT_THINKING_TIMEOUT: f64 = 180.0;

/// Hardcoded max_tokens used when thinking is active. User-configured max_tokens
/// only applies to non-thinking requests.
const THINKING_MAX_TOKENS: u32 = 16000;

/// Maps an effort label to a fixed budget token count for
///  Anthropic "enabled"(legacy budget) mode.
fn budget_for_effort(effort: &str) -> u32 {
    match effort {
        "low" => 2048,
        "medium" => 8192,
        "high" => 16384,
        _ => 8192,
    }
}

/// Builds the `provider_options` JSON value based on the provider
fn build_provider_options(provider: &str, mode: &str, effort: &str) -> serde_json::Value {
    match provider {
        "anthropic" => match mode {
            "adaptive" => serde_json::json!({
                "provider": "anthropic",
                "thinking_type": "adaptive",
                "effort": effort,
            }),
            "enabled" => serde_json::json!({
                "provider": "anthropic",
                "thinking_type": "enabled",
                "budget_tokens": budget_for_effort(effort),
            }),
            _ => serde_json::json!({
                "provider": "anthropic",
                "thinking_type": mode,
                "effort": effort,
            }),
        },
        "openai" => serde_json::json!({
            "provider": "openai",
            "effort": effort,
        }),
        "gemini" => serde_json::json!({
            "provider": "gemini",
            "level": effort,
        }),
        _ => serde_json::json!({
            "provider": provider,
            "effort": effort,
        }),
    }
}

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
    stream: bool,
    thinking_enabled: bool,
    thinking_mode: String,
    thinking_effort: String,
) -> Result<ChatRequest, String> {
    let api_key = secure_storage::load_and_decrypt(app, key_name).map_err(String::from)?;

    // When thinking is active, override max_tokens with the hardcoded constant;
    let effective_max_tokens = if thinking_enabled {
        THINKING_MAX_TOKENS
    } else {
        max_tokens
    };
    let timeout = if thinking_enabled {
        DEFAULT_THINKING_TIMEOUT
    } else {
        DEFAULT_TIMEOUT
    };
    let mut thinking: Option<serde_json::Value> = None;
    let mut temp: Option<f64> = Some(temperature);

    if thinking_enabled {
        let provider_opts = build_provider_options(&provider, &thinking_mode, &thinking_effort);
        thinking = Some(serde_json::json!({
            "enabled": true,
            "provider_options": provider_opts,
        }));
        // Anthropic requires temperature to be omitted when thinking is active.
        if provider == "anthropic" {
            temp = None;
        }
    }

    Ok(ChatRequest {
        provider,
        api_key,
        model,
        messages,
        stream,
        max_tokens: effective_max_tokens,
        temperature: temp,
        stop_sequences: vec![],
        timeout: timeout,
        thinking,
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
    thinking_enabled: bool,
    thinking_mode: String,
    thinking_effort: String,
) -> Result<ChatResponse, String> {
    let req = build_request(
        &app,
        &key_name,
        provider,
        model,
        messages,
        max_tokens,
        temperature,
        false,
        thinking_enabled,
        thinking_mode,
        thinking_effort,
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
    thinking_enabled: bool,
    thinking_mode: String,
    thinking_effort: String,
) -> Result<(), String> {
    let req = build_request(
        &app,
        &key_name,
        provider,
        model,
        messages,
        max_tokens,
        temperature,
        true,
        thinking_enabled,
        thinking_mode,
        thinking_effort,
    )?;
    let client = LlmClient::new();
    client
        .chat_streaming(
            req,
            |result: Result<StreamChunk, StreamError>| match result {
                Ok(chunk) => {
                    let _ = app.emit(STREAM_CHUNK_EVENT, &chunk);
                }
                Err(err) => {
                    let _ = app.emit(STREAM_ERROR_EVENT, &err);
                }
            },
        )
        .await
        .map_err(String::from)
}

/// Encrypts `plaintext_key` with AES-128-GCM and stores the result in
/// `<app_data_dir>/<key_name>.enc`.
#[tauri::command]
pub fn save_api_key(app: AppHandle, key_name: String, plaintext_key: String) -> Result<(), String> {
    secure_storage::encrypt_and_store(&app, &key_name, &plaintext_key).map_err(String::from)
}

/// Returns `true` when `<app_data_dir>/<key_name>.enc` is present on disk.
#[tauri::command]
pub fn api_key_exists(app: AppHandle, key_name: String) -> Result<bool, String> {
    secure_storage::api_key_file_exists(&app, &key_name).map_err(String::from)
}
