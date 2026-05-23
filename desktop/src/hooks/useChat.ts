import { useCallback, useRef } from "react";
import { useChatContext } from "../context/ChatContext";
import type { Message } from "../types";
import { streamLlmResponse } from "../services/llm";

export function useChat() {
  const { state, dispatch } = useChatContext();

  const unlistenRef = useRef<(() => void) | null>(null);

  const sendMessage = useCallback(
    (content: string, convIdOverride?: string): void => {
      const convId = convIdOverride ?? state.activeConversationId;
      if (!convId) return;

      const currentProvider = state.providers.find(
        (p) => p.value === state.settings.provider,
      );
      const model = state.settings.defaultModel;
      if (!currentProvider || !model) return;

      const conv = state.conversations.find((c) => c.id === convId);
      const history = [
        ...(conv?.messages ?? []).map((m) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
        })),
        { role: "user" as const, content },
      ];

      // ── 1. Append user message ───────────────────────────────────────────
      const userMsg: Message = {
        id: `msg-${Date.now()}-user`,
        conversationId: convId,
        role: "user",
        content,
        timestamp: Date.now(),
      };
      dispatch({ type: "ADD_MESSAGE", payload: userMsg });

      // ── 2. Append assistant placeholder and open streaming window ─────────
      const assistantMsgId = `msg-${Date.now() + 1}-assistant`;
      const assistantMsg: Message = {
        id: assistantMsgId,
        conversationId: convId,
        role: "assistant",
        content: "",
        model,
        timestamp: Date.now() + 1,
      };
      dispatch({ type: "ADD_MESSAGE", payload: assistantMsg });
      dispatch({
        type: "SET_STREAMING",
        payload: { messageId: assistantMsgId, text: "" },
      });

      // ── 3. Start streaming ────────────────────────────────────────────────
      let streamBuffer = "";
      let rafId: number | null = null;

      void streamLlmResponse(
        {
          keyName: currentProvider.apiKeyName,
          provider: currentProvider.value,
          model,
          messages: history,
          maxTokens: state.settings.maxTokens,
          temperature: state.settings.temperature,
          topP: state.settings.topP,
          timeout: state.settings.timeout,
        },
        // ── onChunk ──────────────────────────────────────────────────────
        (delta, isFinal) => {
          streamBuffer += delta;

          if (rafId === null) {
            rafId = requestAnimationFrame(() => {
              if (streamBuffer.length > 0) {
                dispatch({ type: "APPEND_STREAM_TEXT", payload: streamBuffer });
                streamBuffer = "";
              }
              rafId = null;
            });
          }

          if (isFinal) {
            if (rafId !== null) {
              cancelAnimationFrame(rafId);
              rafId = null;
            }
            if (streamBuffer.length > 0) {
              dispatch({ type: "APPEND_STREAM_TEXT", payload: streamBuffer });
              streamBuffer = "";
            }
            dispatch({ type: "FINISH_STREAMING", payload: undefined });
            unlistenRef.current?.();
            unlistenRef.current = null;
          }
        },
        // ── onError ──────────────────────────────────────────────────────
        (errMsg) => {
          if (rafId !== null) {
            cancelAnimationFrame(rafId);
            rafId = null;
          }
          dispatch({
            type: "APPEND_STREAM_TEXT",
            payload: streamBuffer + `\n\n*Error: ${errMsg}*`,
          });
          dispatch({ type: "FINISH_STREAMING", payload: undefined });
          unlistenRef.current?.();
          unlistenRef.current = null;
        },
      ).then((unlisten) => {
        unlistenRef.current = unlisten;
      });
    },
    [
      state.activeConversationId,
      state.conversations,
      state.settings,
      state.providers,
      dispatch,
    ],
  );

  /** NOTE:
   * Stops receiving streaming chunks and commits whatever text has accumulated
   * so far into the assistant message.
   *
   * The underlying Tauri command continues running until the server closes the
   * HTTP stream — cancellation is UI-only for now.
   */
  const cancelStreaming = useCallback((): void => {
    if (state.streamingMessageId) {
      unlistenRef.current?.();
      unlistenRef.current = null;
      dispatch({ type: "FINISH_STREAMING", payload: undefined });
    }
  }, [state.streamingMessageId, dispatch]);

  return {
    sendMessage,
    cancelStreaming,
    isStreaming: state.isStreaming,
    streamingText: state.streamingText,
  };
}
