import { Pin, PinOff, Trash2 } from "lucide-react";
import { useChatContext } from "../../context/ChatContext";
import { deleteConversation, togglePin } from "../../services/conversation";
import type { ConversationMeta } from "../../types";

type ConversationItemProps = {
  conversation: ConversationMeta;
  isActive: boolean;
};

function formatRelativeTime(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  return `${Math.floor(days / 7)}w`;
}

export default function ConversationItem({
  conversation,
  isActive,
}: ConversationItemProps) {
  const { dispatch } = useChatContext();

  function select() {
    dispatch({ type: "SET_ACTIVE_CONVERSATION", payload: conversation.id });
  }

  function pin(e: React.MouseEvent) {
    e.stopPropagation();
    dispatch({
      type: "PATCH_CONVERSATION_META",
      payload: { id: conversation.id, pinned: !conversation.pinned },
    });
    void togglePin(conversation.id).catch((err: unknown) => {
      console.error(
        `Failed to toggle pin for conversation ${conversation.id}:`,
        err,
      );
    });
  }

  function remove(e: React.MouseEvent) {
    e.stopPropagation();
    dispatch({ type: "DELETE_CONVERSATION", payload: conversation.id });
    void deleteConversation(conversation.id).catch((err: unknown) => {
      console.error(`Failed to delete conversation ${conversation.id}:`, err);
    });
  }

  const activeClass = isActive
    ? "bg-surface-3 border-l-[2px] border-accent"
    : "border-l-[2px] border-transparent hover:bg-surface-3/60";

  return (
    <div
      onClick={select}
      className={`group flex items-center gap-2 px-3 py-1.75 cursor-pointer transition-colors duration-100 ${activeClass}`}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-[13px] font-ui text-text-primary truncate leading-tight">
            {conversation.title}
          </span>
          {conversation.pinned && (
            <Pin size={10} className="text-text-muted shrink-0" />
          )}
        </div>
        <div className="text-[11px] font-mono text-text-muted mt-px">
          {formatRelativeTime(conversation.updatedAt)}
        </div>
      </div>
      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity duration-100">
        <button
          aria-label={conversation.pinned ? "Unpin" : "Pin"}
          onClick={pin}
          className="p-0.5 text-text-muted hover:text-text-secondary rounded-sm transition-colors duration-100"
        >
          {conversation.pinned ? <PinOff size={12} /> : <Pin size={12} />}
        </button>
        <button
          aria-label="Delete conversation"
          onClick={remove}
          className="p-0.5 text-text-muted hover:text-red-400 rounded-sm transition-colors duration-100"
        >
          <Trash2 size={12} />
        </button>
      </div>
    </div>
  );
}
