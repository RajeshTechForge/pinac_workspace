/// HTTP client and SSE stream parser for the LLM API endpoint.
pub mod client;

/// Tauri command handlers (`llm_chat`, `llm_chat_stream`).
pub mod commands;

/// Shared request/response types and the `LlmError` enum.
pub mod types;
