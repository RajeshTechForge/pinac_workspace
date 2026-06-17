import { useChatContext } from "../../context/ChatContext";
import { useChat } from "../../hooks/useChat";
import MessageList from "./MessageList";
import EmptyState from "./EmptyState";
import type { ConversationMeta } from "../../types";

export default function ChatArea() {
  const { state, dispatch } = useChatContext();
  const { sendMessage } = useChat();

  function handleSuggestion(text: string) {
    let convId = state.activeConversationId;

    if (!convId) {
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

    sendMessage(text, convId);
  }

  if (state.activeMessages.length === 0 && !state.messagesLoading) {
    return <EmptyState onSelectSuggestion={handleSuggestion} />;
  }

  return (
    <MessageList
      messages={state.activeMessages}
      isStreaming={state.isStreaming}
      streamingMessageId={state.streamingMessageId}
      streamingText={state.streamingText}
      streamingThinkingText={state.streamingThinkingText}
    />
  );
}
