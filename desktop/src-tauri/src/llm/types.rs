use thiserror::Error;

// ---------------------------------------------------------------------------
// Request types
// ---------------------------------------------------------------------------

/// A single turn in the conversation history.
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct ChatMessage {
    pub role: String,
    pub content: String,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct ChatRequest {
    pub provider: String,
    pub api_key: String,
    pub model: String,
    pub messages: Vec<ChatMessage>,
    pub stream: bool,
    pub max_tokens: u32,
    pub temperature: f64,
    pub top_p: f64,
    pub stop_sequences: Vec<String>,
    pub timeout: f64,
}

// ---------------------------------------------------------------------------
// Non-streaming response types
// ---------------------------------------------------------------------------

/// Token consumption breakdown for a completed request.
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct TokenUsage {
    pub prompt_tokens: u32,
    pub completion_tokens: u32,
    pub total_tokens: u32,
}

/// Complete response returned by the API
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct ChatResponse {
    pub content: String,
    pub finish_reason: String,
    pub usage: TokenUsage,
    pub model: String,
    pub provider: String,
    pub latency_ms: f64,
    pub cached: bool,
    pub created_at: String,
}

// ---------------------------------------------------------------------------
// Streaming response types
// ---------------------------------------------------------------------------

/// A single SSE event chunk emitted during a streaming response.
/// Stop signal: `is_final` is `true
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct StreamChunk {
    pub delta: String,
    pub is_final: bool,
    pub finish_reason: String,
    pub usage: TokenUsage,
    pub model: String,
    pub provider: Option<String>,
    pub latency_ms: f64,
}

// ---------------------------------------------------------------------------
// Error type
// ---------------------------------------------------------------------------

#[derive(Debug, Error)]
pub enum LlmError {
    #[error("HTTP request failed: {0}")]
    Http(#[from] reqwest::Error),

    #[error("API error {status}: {body}")]
    ApiError { status: u16, body: String },

    #[error("Failed to deserialize stream chunk: {0}")]
    Deserialization(String),

    #[error("SSE stream closed before a final chunk was received")]
    StreamEnded,
}

impl From<LlmError> for String {
    fn from(err: LlmError) -> String {
        err.to_string()
    }
}
