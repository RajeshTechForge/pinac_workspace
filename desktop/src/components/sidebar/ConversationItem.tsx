import { useEffect, useRef, useState } from "react";
import { Pencil, Pin, PinOff, Trash2 } from "lucide-react";
import type {
  ChangeEvent,
  FocusEvent,
  KeyboardEvent,
  MouseEvent,
} from "react";
import { useChatContext } from "../../context/ChatContext";
import {
  deleteConversation,
  renameConversation,
  togglePin,
} from "../../services/conversation";
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

/**
 * Renders a sidebar row with quick actions and inline rename support to keep
 * edits close to the conversation list.
 */
export default function ConversationItem({
  conversation,
  isActive,
}: ConversationItemProps) {
  const { dispatch } = useChatContext();
  const [isRenaming, setIsRenaming] = useState<boolean>(false);
  const [draftTitle, setDraftTitle] = useState<string>(conversation.title);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Keep the rename input focused when it is shown.
  useEffect(() => {
    if (!isRenaming) return;
    inputRef.current?.focus();
    inputRef.current?.select();
  }, [isRenaming]);

  /**
   * Activates the conversation when the row is clicked.
   */
  function select(): void {
    dispatch({ type: "SET_ACTIVE_CONVERSATION", payload: conversation.id });
  }

  /**
   * Toggles pin state and syncs the change to storage.
   */
  function pin(e: MouseEvent<HTMLButtonElement>): void {
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

  /**
   * Deletes the conversation and removes it from the sidebar.
   */
  function remove(e: MouseEvent<HTMLButtonElement>): void {
    e.stopPropagation();
    dispatch({ type: "DELETE_CONVERSATION", payload: conversation.id });
    void deleteConversation(conversation.id).catch((err: unknown) => {
      console.error(`Failed to delete conversation ${conversation.id}:`, err);
    });
  }

  /**
   * Enters rename mode with the current title prefilled.
   */
  function beginRename(e: MouseEvent<HTMLButtonElement>): void {
    e.stopPropagation();
    setDraftTitle(conversation.title);
    setIsRenaming(true);
  }

  /**
   * Exits rename mode without persisting changes.
   */
  function cancelRename(): void {
    setDraftTitle(conversation.title);
    setIsRenaming(false);
  }

  /**
   * Persists a valid title change to state and the database.
   */
  function commitRename(): void {
    const trimmed = draftTitle.trim();
    if (!trimmed) {
      cancelRename();
      return;
    }
    if (trimmed === conversation.title) {
      setIsRenaming(false);
      return;
    }

    dispatch({
      type: "PATCH_CONVERSATION_META",
      payload: { id: conversation.id, title: trimmed, updatedAt: Date.now() },
    });
    setIsRenaming(false);
    void renameConversation(conversation.id, trimmed).catch((err: unknown) => {
      console.error(`Failed to rename conversation ${conversation.id}:`, err);
    });
  }

  /**
   * Keeps rename draft state in sync with the input value.
   */
  function handleRenameChange(e: ChangeEvent<HTMLInputElement>): void {
    setDraftTitle(e.target.value);
  }

  /**
   * Commits rename on blur to avoid a dangling edit state.
   */
  function handleRenameBlur(_: FocusEvent<HTMLInputElement>): void {
    commitRename();
  }

  /**
   * Provides keyboard shortcuts for committing or canceling edits.
   */
  function handleRenameKeyDown(
    e: KeyboardEvent<HTMLInputElement>,
  ): void {
    if (e.key === "Enter") {
      e.preventDefault();
      commitRename();
      return;
    }
    if (e.key === "Escape") {
      e.preventDefault();
      cancelRename();
    }
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
          {isRenaming ? (
            <input
              ref={inputRef}
              aria-label="Rename conversation"
              value={draftTitle}
              onChange={handleRenameChange}
              onBlur={handleRenameBlur}
              onKeyDown={handleRenameKeyDown}
              onClick={(e: MouseEvent<HTMLInputElement>) => e.stopPropagation()}
              className="w-full bg-surface-2 border border-border text-text-primary text-[13px] font-ui px-1.5 py-0.5 rounded-xs focus:outline-none focus:ring-1 focus:ring-accent/50"
            />
          ) : (
            <span className="text-[13px] font-ui text-text-primary truncate leading-tight">
              {conversation.title}
            </span>
          )}
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
          aria-label="Rename conversation"
          onClick={beginRename}
          className="p-0.5 text-text-muted hover:text-text-secondary rounded-sm transition-colors duration-100"
        >
          <Pencil size={12} />
        </button>
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
