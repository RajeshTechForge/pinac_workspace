import { useChatContext } from "../../context/ChatContext";
import { useChat } from "../../hooks/useChat";
import MessageList from "./MessageList";
import EmptyState from "./EmptyState";

export default function ChatArea() {
  const { state, dispatch } = useChatContext();
  const { sendMessage } = useChat();

  const activeConv = state.conversations.find(
    (c) => c.id === state.activeConversationId,
  );

  function handleSuggestion(text: string) {
    let convId = state.activeConversationId;

    if (!activeConv || activeConv.messages.length > 0) {
      convId = `conv-${Date.now()}`;
      dispatch({
        type: "ADD_CONVERSATION",
        payload: {
          id: convId,
          title: text.slice(0, 50),
          messages: [],
          model: state.settings.defaultModel,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          pinned: false,
        },
      });
    } else if (convId) {
      dispatch({
        type: "RENAME_CONVERSATION",
        payload: { id: convId, title: text.slice(0, 50) }
      });
    }

    sendMessage(text, convId ?? undefined);
  }

  if (!activeConv || activeConv.messages.length === 0) {
    return <EmptyState onSelectSuggestion={handleSuggestion} />;
  }

  return (
    <MessageList
      messages={activeConv.messages}
      isStreaming={state.isStreaming}
      streamingMessageId={state.streamingMessageId}
      streamingText={state.streamingText}
    />
  );
}
