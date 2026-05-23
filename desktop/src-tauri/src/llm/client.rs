use futures_util::StreamExt;
use reqwest::Client;

use crate::llm::types::{ChatMessage, ChatRequest, ChatResponse, LlmError, StreamChunk};

const API_ENDPOINT: &str = "http://127.0.0.1:8000/api/llm/chat";

// ---------------------------------------------------------------------------
// Demo request factory
// ---------------------------------------------------------------------------

/// Builds the hardcoded demo `ChatRequest` used while the frontend is not
/// yet wired up.
///
/// The `stream` flag is the only variant; all other fields are fixed at the
/// values specified in the initial design.
fn demo_request(stream: bool) -> ChatRequest {
    ChatRequest {
        provider: "gemini".to_string(),
        api_key: "{{GEMINI_API_KEY}}".to_string(),
        model: "gemini-3.1-flash-lite".to_string(),
        messages: vec![ChatMessage {
            role: "user".to_string(),
            content: "who are you ?".to_string(),
        }],
        stream,
        max_tokens: 1024,
        temperature: 0.5,
        top_p: 0.95,
        stop_sequences: vec!["\n".to_string(), "END".to_string()],
        timeout: 30.0,
    }
}

// ---------------------------------------------------------------------------
// SSE parser helper
// ---------------------------------------------------------------------------

/// Scans `s` from the beginning and returns the exclusive byte offset of the
/// first top-level JSON object's closing `}`, or `None` when the object is
/// incomplete.
///
/// Correctly handles `{` / `}` that appear inside JSON string literals and
/// `\"` escape sequences within those strings.
fn find_json_object_end(s: &str) -> Option<usize> {
    let mut depth: i32 = 0;
    let mut in_string = false;
    let mut escape_next = false;

    for (i, c) in s.char_indices() {
        if escape_next {
            escape_next = false;
            continue;
        }
        if in_string {
            match c {
                '\\' => escape_next = true,
                '"' => in_string = false,
                _ => {}
            }
        } else {
            match c {
                '"' => in_string = true,
                '{' => depth += 1,
                '}' => {
                    depth -= 1;
                    if depth == 0 {
                        // +1 to include the closing brace itself.
                        return Some(i + 1);
                    }
                }
                _ => {}
            }
        }
    }
    None
}

// ---------------------------------------------------------------------------
// LlmClient
// ---------------------------------------------------------------------------

/// Async HTTP client for communicating with the LLM API endpoint.
///
/// Holds a `reqwest::Client` so that the underlying TCP connection pool is
/// reused across sequential requests within the same Tauri command invocation.
pub struct LlmClient {
    http: Client,
}

impl LlmClient {
    /// Creates a new `LlmClient` with a default `reqwest::Client`.
    pub fn new() -> Self {
        Self {
            http: Client::new(),
        }
    }

    /// Sends a non-streaming chat request and returns the complete response.
    ///
    /// Uses the hardcoded demo payload (`stream: false`). Returns an
    /// `LlmError` on network failure, non-2xx status, or deserialization
    /// failure.
    pub async fn chat_blocking(&self) -> Result<ChatResponse, LlmError> {
        let request = demo_request(false);

        let response = self.http.post(API_ENDPOINT).json(&request).send().await?;

        let status = response.status();
        if !status.is_success() {
            let body = response.text().await.unwrap_or_default();
            return Err(LlmError::ApiError {
                status: status.as_u16(),
                body,
            });
        }

        response
            .json::<ChatResponse>()
            .await
            .map_err(|e| LlmError::Deserialization(e.to_string()))
    }

    /// Sends a streaming chat request and calls `event_cb` for each parsed
    /// SSE chunk.
    ///
    /// The API emits events in the format `data: {…}data: {…}` with no blank
    /// line separator between events. This method maintains an internal
    /// byte buffer and uses brace-depth tracking to locate complete JSON
    /// objects before attempting deserialization. The callback is invoked
    /// once per successfully parsed chunk. Returns `Ok(())` after the chunk
    /// whose `is_final` field is `true` has been delivered. Returns
    /// `LlmError::StreamEnded` if the byte stream closes before that final
    /// chunk arrives.
    pub async fn chat_streaming(&self, event_cb: impl Fn(StreamChunk)) -> Result<(), LlmError> {
        let request = demo_request(true);

        let response = self.http.post(API_ENDPOINT).json(&request).send().await?;

        let status = response.status();
        if !status.is_success() {
            let body = response.text().await.unwrap_or_default();
            return Err(LlmError::ApiError {
                status: status.as_u16(),
                body,
            });
        }

        let mut byte_stream = response.bytes_stream();
        // Accumulates raw bytes until complete JSON objects can be extracted.
        let mut buffer = String::new();

        while let Some(chunk_result) = byte_stream.next().await {
            let bytes = chunk_result?;
            buffer.push_str(&String::from_utf8_lossy(&bytes));

            // Drain all complete SSE events present in the buffer before
            // waiting for the next network chunk.
            loop {
                let data_prefix = "data: ";
                let Some(prefix_pos) = buffer.find(data_prefix) else {
                    // No event prefix in buffer yet — wait for more bytes.
                    break;
                };

                // Advance past the prefix to reach the raw JSON.
                let after_prefix = prefix_pos + data_prefix.len();

                // Skip any whitespace between the prefix and the JSON object.
                let leading_ws = buffer[after_prefix..]
                    .chars()
                    .take_while(|c| c.is_whitespace() && *c != '{')
                    .count();
                let json_start = after_prefix + leading_ws;

                if !buffer[json_start..].starts_with('{') {
                    // Malformed event — discard up to and including the prefix
                    // and try again.
                    buffer.drain(..after_prefix);
                    continue;
                }

                let Some(json_len) = find_json_object_end(&buffer[json_start..]) else {
                    // JSON object is incomplete — wait for more bytes.
                    break;
                };

                let json_str = &buffer[json_start..json_start + json_len];

                let chunk: StreamChunk = serde_json::from_str(json_str)
                    .map_err(|e| LlmError::Deserialization(e.to_string()))?;

                let is_final = chunk.is_final;
                event_cb(chunk);

                // Remove the processed event from the front of the buffer.
                buffer.drain(..json_start + json_len);

                if is_final {
                    return Ok(());
                }
            }
        }

        // Stream closed. Attempt to flush any remaining event in the buffer
        // (handles the edge case where the final chunk arrives in the last
        // network packet with no trailing data).
        let data_prefix = "data: ";
        if let Some(prefix_pos) = buffer.find(data_prefix) {
            let after_prefix = prefix_pos + data_prefix.len();
            let json_str = buffer[after_prefix..].trim();
            if let Ok(chunk) = serde_json::from_str::<StreamChunk>(json_str) {
                let is_final = chunk.is_final;
                event_cb(chunk);
                if is_final {
                    return Ok(());
                }
            }
        }

        Err(LlmError::StreamEnded)
    }
}
