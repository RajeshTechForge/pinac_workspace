import { useCallback } from "react";
import { useChatContext } from "../context/ChatContext";
import type { Message } from "../types";

/**
 * Provides chat interaction primitives — sending messages and cancelling an
 * in-progress stream.
 *
 * Actual LLM invocation is wired in a subsequent session; this hook manages
 * conversation state and exposes a clean API for the input layer.
 */
export function useChat() {
  const { state, dispatch } = useChatContext();

  /**
   * Appends a user message to the given conversation.
   *
   * @param content - Trimmed message text from the input field.
   * @param convIdOverride - Conversation to append to; falls back to the
   *   currently active conversation when omitted.
   */
  const sendMessage = useCallback(
    (content: string, convIdOverride?: string): void => {
      const convId = convIdOverride ?? state.activeConversationId;
      if (!convId) return;

      const userMsg: Message = {
        id: `msg-${Date.now()}-user`,
        conversationId: convId,
        role: "user",
        content,
        timestamp: Date.now(),
      };

      dispatch({ type: "ADD_MESSAGE", payload: userMsg });
    },
    [state.activeConversationId, dispatch],
  );

  /**
   * Finalises an in-progress streaming response, committing whatever text
   * has accumulated so far into the assistant message.
   */
  const cancelStreaming = useCallback((): void => {
    if (state.streamingMessageId) {
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
