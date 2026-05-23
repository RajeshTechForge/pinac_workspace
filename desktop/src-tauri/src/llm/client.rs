use futures_util::StreamExt;
use reqwest::Client;

use crate::llm::types::{ChatRequest, ChatResponse, LlmError, StreamChunk};

const API_ENDPOINT: &str = "http://127.0.0.1:8000/api/llm/chat";

// ---------------------------------------------------------------------------
// SSE parser helper
// ---------------------------------------------------------------------------

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
pub struct LlmClient {
    http: Client,
}

impl LlmClient {
    pub fn new() -> Self {
        Self {
            http: Client::new(),
        }
    }

    pub async fn chat_blocking(&self, req: ChatRequest) -> Result<ChatResponse, LlmError> {
        let response = self.http.post(API_ENDPOINT).json(&req).send().await?;

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
    pub async fn chat_streaming(
        &self,
        req: ChatRequest,
        event_cb: impl Fn(StreamChunk),
    ) -> Result<(), LlmError> {
        let response = self.http.post(API_ENDPOINT).json(&req).send().await?;

        let status = response.status();
        if !status.is_success() {
            let body = response.text().await.unwrap_or_default();
            return Err(LlmError::ApiError {
                status: status.as_u16(),
                body,
            });
        }

        let mut byte_stream = response.bytes_stream();
        let mut buffer = String::new();

        while let Some(chunk_result) = byte_stream.next().await {
            let bytes = chunk_result?;
            buffer.push_str(&String::from_utf8_lossy(&bytes));

            loop {
                let data_prefix = "data: ";
                let Some(prefix_pos) = buffer.find(data_prefix) else {
                    break;
                };
                let after_prefix = prefix_pos + data_prefix.len();

                let leading_ws = buffer[after_prefix..]
                    .chars()
                    .take_while(|c| c.is_whitespace() && *c != '{')
                    .count();
                let json_start = after_prefix + leading_ws;

                if !buffer[json_start..].starts_with('{') {
                    buffer.drain(..after_prefix);
                    continue;
                }

                let Some(json_len) = find_json_object_end(&buffer[json_start..]) else {
                    break;
                };

                let json_str = &buffer[json_start..json_start + json_len];

                let chunk: StreamChunk = serde_json::from_str(json_str)
                    .map_err(|e| LlmError::Deserialization(e.to_string()))?;

                let is_final = chunk.is_final;
                event_cb(chunk);
                
                buffer.drain(..json_start + json_len);

                if is_final {
                    return Ok(());
                }
            }
        }

        // Stream closed
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
