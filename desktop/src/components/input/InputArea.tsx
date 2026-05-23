import { useState, useCallback } from "react";
import PromptInput from "./PromptInput";
import InputToolbar from "./InputToolbar";
import { useChatContext } from "../../context/ChatContext";
import { useChat } from "../../hooks/useChat";

export default function InputArea() {
  const { state, dispatch } = useChatContext();
  const { sendMessage, cancelStreaming, isStreaming } = useChat();
  const [text, setText] = useState("");

  const handleSend = useCallback(() => {
    const trimmed = text.trim();
    if (!trimmed || isStreaming) return;

    let convId = state.activeConversationId;
    const activeConv = state.conversations.find((c) => c.id === convId);

    if (!convId || !activeConv || activeConv.messages.length === 0) {
      if (convId && activeConv) {
        dispatch({
          type: "RENAME_CONVERSATION",
          payload: { id: convId, title: trimmed.slice(0, 50) },
        });
      } else {
        convId = `conv-${Date.now()}`;
        dispatch({
          type: "ADD_CONVERSATION",
          payload: {
            id: convId,
            title: trimmed.slice(0, 50),
            messages: [],
            model: state.settings.defaultModel,
            createdAt: Date.now(),
            updatedAt: Date.now(),
            pinned: false,
          },
        });
      }
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
