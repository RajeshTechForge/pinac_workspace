import { useCallback, useRef } from "react";
import { useChatContext } from "../context/ChatContext";
import type { ConversationMeta, Message } from "../types";
import { streamLlmResponse } from "../services/llm";
import { savePair, deriveTitle } from "../services/conversation";

export function useChat() {
  const { state, dispatch } = useChatContext();

  const unlistenRef = useRef<(() => void) | null>(null);

  // Stores everything needed to persist a pair after streaming completes.
  // Using a ref instead of closure variables means `persistPair` never reads
  // stale React state — all values are captured explicitly at send time.
  const pendingPairRef = useRef<{
    userMsg: Message;
    assistantMsgId: string;
    /** Snapshot of conversation metadata taken at send time, not at persist time.
     *  For new in-session conversations that haven't been written to the DB yet,
     *  the conv may not appear in `state.conversations` (React batches the dispatch
     *  and hasn't re-rendered before sendMessage runs), so we reconstruct it here. */
    convMeta: ConversationMeta;
    isFirstPair: boolean;
  } | null>(null);

  const sendMessage = useCallback(
    (content: string, convIdOverride?: string): void => {
      const convId = convIdOverride ?? state.activeConversationId;
      if (!convId) return;

      const currentProvider = state.providers.find(
        (p) => p.value === state.settings.provider,
      );
      const model = state.settings.defaultModel;
      if (!currentProvider || !model) return;

      const currentModel = currentProvider.models.find((m) => m.id === model);
      const thinkingMode = currentModel?.thinking?.mode ?? "";

      const history = [
        ...state.activeMessages.map((m) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
        })),
        { role: "user" as const, content },
      ];

      const isFirstPair = state.activeMessages.length === 0;

      // ── 1. Append user message ───────────────────────────────────────────
      const now = Date.now();
      const userMsg: Message = {
        id: `msg-${now}-user`,
        conversationId: convId,
        role: "user",
        content,
        timestamp: now,
      };
      dispatch({ type: "ADD_MESSAGE", payload: userMsg });

      // ── 2. Append assistant placeholder and open streaming window ────────
      const assistantMsgId = `msg-${now + 1}-assistant`;
      const assistantMsg: Message = {
        id: assistantMsgId,
        conversationId: convId,
        role: "assistant",
        content: "",
        model,
        timestamp: now + 1,
      };
      dispatch({ type: "ADD_MESSAGE", payload: assistantMsg });
      dispatch({
        type: "SET_STREAMING",
        payload: { messageId: assistantMsgId, text: "" },
      });

      // Capture conversation metadata now, before any async work.
      // `state.conversations` may not yet include a conv dispatched in the same
      // synchronous call stack (e.g., APPEND_CONVERSATION_META in InputArea),
      // so fall back to reconstructing the minimal required fields from known data.
      const existingMeta = state.conversations.find((c) => c.id === convId);
      const convMeta: ConversationMeta = existingMeta ?? {
        id: convId,
        title: "New conversation",
        model,
        createdAt: now,
        updatedAt: now,
        pinned: false,
      };

      pendingPairRef.current = { userMsg, assistantMsgId, convMeta, isFirstPair };

      // ── 3. Start streaming ────────────────────────────────────────────────
      // `totalContent` / `totalThinkingContent` accumulate every delta for the
      // entire stream. `streamBuffer` holds only the undispatched RAF-batched
      // portion. All are local to this sendMessage invocation — never stale.
      let streamBuffer = "";
      let totalContent = "";
      let thinkingBuffer = "";
      let totalThinkingContent = "";
      let rafId: number | null = null;

      void streamLlmResponse(
        {
          keyName: currentProvider.apiKeyName,
          provider: currentProvider.value,
          model,
          messages: history,
          maxTokens: state.settings.maxTokens,
          temperature: state.settings.temperature,
          thinkingEnabled: state.settings.thinkingEnabled,
          thinkingMode,
          thinkingEffort: state.settings.thinkingEffort,
        },
        // ── onChunk ──────────────────────────────────────────────────────
        (delta, isThinking, isFinal, completionTokens) => {
          if (isThinking) {
            thinkingBuffer += delta;
            totalThinkingContent += delta;
            dispatch({
              type: "APPEND_STREAM_THINKING_TEXT",
              payload: delta,
            });
          } else {
            streamBuffer += delta;
            totalContent += delta;

            if (rafId === null) {
              rafId = requestAnimationFrame(() => {
                if (streamBuffer.length > 0) {
                  dispatch({
                    type: "APPEND_STREAM_TEXT",
                    payload: streamBuffer,
                  });
                  streamBuffer = "";
                }
                rafId = null;
              });
            }
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
            dispatch({
              type: "FINISH_STREAMING",
              payload: { completionTokens },
            });
            unlistenRef.current?.();
            unlistenRef.current = null;

            // ── 4. Persist pair after streaming is complete ───────────────
            // `totalContent` / `totalThinkingContent` hold the complete texts
            // — they are local variables and never stale.
            // Fire-and-forget: the DB write must never gate any UI update.
            persistPair(totalContent, totalThinkingContent);
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
          // Do not persist error responses — they are not valid exchanges.
          pendingPairRef.current = null;
        },
      ).then((unlisten) => {
        unlistenRef.current = unlisten;
      });

      // ── Persist helper ────────────────────────────────────────────────────
      // Reads only from `pendingPairRef` and the argument closures below.
      // Never reads `state.*` — all required context was captured at send time.
      function persistPair(
        finalContent: string,
        finalThinkingContent: string,
      ): void {
        const pending = pendingPairRef.current;
        if (!pending) return;
        pendingPairRef.current = null;

        const title = pending.isFirstPair
          ? deriveTitle(pending.userMsg.content)
          : pending.convMeta.title;

        const finalisedAssistantMsg: Message = {
          id: pending.assistantMsgId,
          conversationId: pending.convMeta.id,
          role: "assistant",
          content: finalContent,
          thinkingContent: finalThinkingContent || undefined,
          model,
          timestamp: pending.userMsg.timestamp + 1,
        };

        const updatedMeta: ConversationMeta = {
          ...pending.convMeta,
          title,
          updatedAt: Date.now(),
        };

        // Patch the sidebar title optimistically if this was the first exchange.
        if (pending.isFirstPair) {
          dispatch({
            type: "PATCH_CONVERSATION_META",
            payload: { id: pending.convMeta.id, title },
          });
        }

        void savePair(updatedMeta, pending.userMsg, finalisedAssistantMsg).catch(
          (err: unknown) => {
            console.error("Failed to persist conversation pair:", err);
          },
        );
      }
    },
    [
      state.activeConversationId,
      state.activeMessages,
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
      // Discard the pending pair — a cancelled stream is not a valid exchange.
      pendingPairRef.current = null;
    }
  }, [state.streamingMessageId, dispatch]);

  return {
    sendMessage,
    cancelStreaming,
    isStreaming: state.isStreaming,
    streamingText: state.streamingText,
  };
}
