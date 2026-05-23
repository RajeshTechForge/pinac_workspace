import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

export type LlmMessage = {
  role: "user" | "assistant";
  content: string;
};

export type LlmStreamPayload = {
  keyName: string;
  provider: string;
  model: string;
  messages: LlmMessage[];
  maxTokens: number;
  temperature: number;
  timeout: number;
};

type StreamChunk = {
  delta: string;
  is_final: boolean;
};

// ---------------------------------------------------------------------------
// Service function
// ---------------------------------------------------------------------------

// Starts a streaming LLM call via the Tauri backend.
export async function streamLlmResponse(
  payload: LlmStreamPayload,
  onChunk: (delta: string, isFinal: boolean) => void,
  onError: (message: string) => void,
): Promise<() => void> {
  const unlisten = await listen<StreamChunk>("llm-stream-chunk", (event) => {
    onChunk(event.payload.delta, event.payload.is_final);
  });

  invoke<void>("llm_chat_stream", {
    keyName: payload.keyName,
    provider: payload.provider,
    model: payload.model,
    messages: payload.messages,
    maxTokens: payload.maxTokens,
    temperature: payload.temperature,
    timeout: payload.timeout,
  }).catch((err: unknown) => {
    onError(
      typeof err === "string"
        ? err
        : "LLM request failed. Check your API key and ensure the server is running.",
    );
  });

  return unlisten;
}
