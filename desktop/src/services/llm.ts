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
  thinkingEnabled: boolean;
  thinkingMode: string;
  thinkingEffort: string;
};

type StreamChunk = {
  delta: string;
  is_thinking: boolean;
  is_final: boolean;
  usage?: {
    completion_tokens: number;
  };
};

type StreamErrorPayload = {
  code: string;
  message: string;
};

// ---------------------------------------------------------------------------
// Service function
// ---------------------------------------------------------------------------

export async function streamLlmResponse(
  payload: LlmStreamPayload,
  onChunk: (delta: string, isThinking: boolean, isFinal: boolean, completionTokens?: number) => void,
  onError: (message: string) => void,
): Promise<() => void> {
  const unlistenChunk = await listen<StreamChunk>(
    "llm-stream-chunk",
    (event) => {
      onChunk(
        event.payload.delta,
        event.payload.is_thinking,
        event.payload.is_final,
        event.payload.is_final ? event.payload.usage?.completion_tokens : undefined,
      );
    },
  );

  const unlistenError = await listen<StreamErrorPayload>(
    "llm-stream-error",
    (event) => {
      onError(event.payload.message);
    },
  );

  invoke<void>("llm_chat_stream", {
    keyName: payload.keyName,
    provider: payload.provider,
    model: payload.model,
    messages: payload.messages,
    maxTokens: payload.maxTokens,
    temperature: payload.temperature,
    thinkingEnabled: payload.thinkingEnabled,
    thinkingMode: payload.thinkingMode,
    thinkingEffort: payload.thinkingEffort,
  }).catch((err: unknown) => {
    onError(
      typeof err === "string"
        ? err
        : "LLM request failed. Check your API key and ensure the server is running.",
    );
  });

  return () => {
    unlistenChunk();
    unlistenError();
  };
}
