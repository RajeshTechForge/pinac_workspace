import { Plus, PanelLeftClose } from "lucide-react";
import { useChatContext } from "../../context/ChatContext";
import Tooltip from "../ui/Tooltip";
import type { ConversationMeta } from "../../types";

type SidebarHeaderProps = {
  compact: boolean;
};

export default function SidebarHeader({ compact }: SidebarHeaderProps) {
  const { state, dispatch } = useChatContext();

  function newChat() {
    const newMeta: ConversationMeta = {
      id: `conv-${Date.now()}`,
      title: "New conversation",
      model: state.settings.defaultModel,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      pinned: false,
    };
    dispatch({ type: "APPEND_CONVERSATION_META", payload: newMeta });
  }

  function toggleSidebar() {
    dispatch({ type: "SET_SIDEBAR_MODE", payload: "hidden" });
  }

  if (compact) {
    return (
      <div className="flex flex-col items-center py-3 gap-3 border-b border-border">
        <Tooltip label="Close sidebar">
          <button
            aria-label="Close sidebar"
            onClick={toggleSidebar}
            className="p-1.5 text-text-secondary hover:text-text-primary hover:bg-surface-3 rounded-sm transition-colors duration-100"
          >
            <PanelLeftClose size={16} />
          </button>
        </Tooltip>
        <Tooltip label="New chat" shortcut="⌘N">
          <button
            aria-label="New conversation"
            onClick={newChat}
            className="p-1.5 text-text-secondary hover:text-text-primary hover:bg-surface-3 rounded-sm transition-colors duration-100"
          >
            <Plus size={16} />
          </button>
        </Tooltip>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between px-3 py-2.5 border-b border-border">
      <div className="flex items-center gap-2">
        <Tooltip label="Close sidebar">
          <button
            aria-label="Close sidebar"
            onClick={toggleSidebar}
            className="p-1 text-text-secondary hover:text-text-primary hover:bg-surface-3 rounded-sm transition-colors duration-100"
          >
            <PanelLeftClose size={14} />
          </button>
        </Tooltip>
        <span className="text-xs font-mono font-medium tracking-widest uppercase text-text-secondary select-none">
          Chats
        </span>
      </div>
      <Tooltip label="New conversation" shortcut="⌘N">
        <button
          aria-label="New conversation"
          onClick={newChat}
          className="p-1 text-text-secondary hover:text-text-primary hover:bg-surface-3 rounded-sm transition-colors duration-100"
        >
          <Plus size={14} />
        </button>
      </Tooltip>
    </div>
  );
}
