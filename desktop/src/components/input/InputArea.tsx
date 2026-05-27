import { useState, useCallback } from "react";
import PromptInput from "./PromptInput";
import InputToolbar from "./InputToolbar";
import { useChatContext } from "../../context/ChatContext";
import { useChat } from "../../hooks/useChat";
import type { ConversationMeta } from "../../types";

export default function InputArea() {
  const { state, dispatch } = useChatContext();
  const { sendMessage, cancelStreaming, isStreaming } = useChat();
  const [text, setText] = useState("");

  const handleSend = useCallback(() => {
    const trimmed = text.trim();
    if (!trimmed || isStreaming) return;

    let convId = state.activeConversationId;
    const activeMeta = state.conversations.find((c) => c.id === convId);

    // If no conversation is active, or the active one already has messages
    // (determined by whether it exists in the DB — new in-session conversations
    // also show in the sidebar immediately via APPEND_CONVERSATION_META), create
    // a new conversation placeholder. The real title is derived and persisted
    // by useChat after the first exchange completes.
    if (!convId || !activeMeta) {
      convId = `conv-${Date.now()}`;
      const newMeta: ConversationMeta = {
        id: convId,
        title: "New conversation",
        model: state.settings.defaultModel,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        pinned: false,
      };
      dispatch({ type: "APPEND_CONVERSATION_META", payload: newMeta });
    }

    sendMessage(trimmed, convId);
    setText("");
  }, [
    text,
    isStreaming,
    state.activeConversationId,
    state.conversations,
    state.settings.defaultModel,
    sendMessage,
    dispatch,
  ]);

  return (
    <div className="border-t border-border bg-surface-1">
      <div className="max-w-3xl mx-auto px-4 py-3">
        <div className="bg-surface-2 border border-border rounded-sm px-3 pt-1 pb-2 focus-within:ring-1 focus-within:ring-accent/50 transition-all duration-100">
          <PromptInput
            value={text}
            onChange={setText}
            onSend={handleSend}
            disabled={isStreaming}
          />
          <InputToolbar
            text={text}
            onSend={handleSend}
            onCancel={cancelStreaming}
            isStreaming={isStreaming}
          />
        </div>
      </div>
    </div>
  );
}
