import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { Search } from "lucide-react";
import CommandItem from "./CommandItem";
import { useChatContext } from "../../context/ChatContext";
import type { PaletteCommand, ConversationMeta } from "../../types";
import { clearMessages } from "../../services/conversation";

export default function CommandPalette() {
  const { state, dispatch } = useChatContext();
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  const actionCommands: PaletteCommand[] = useMemo(
    () => [
      {
        id: "new-chat",
        label: "New conversation",
        shortcut: "\u2318N",
        icon: "new-chat",
        category: "action",
        action: () => {
          const newMeta: ConversationMeta = {
            id: `conv-${Date.now()}`,
            title: "New conversation",
            model: state.settings.defaultModel,
            createdAt: Date.now(),
            updatedAt: Date.now(),
            pinned: false,
          };
          dispatch({ type: "APPEND_CONVERSATION_META", payload: newMeta });
          dispatch({ type: "TOGGLE_COMMAND_PALETTE" });
        },
      },
      {
        id: "clear",
        label: "Clear current conversation",
        icon: "clear",
        category: "action",
        action: () => {
          const convId = state.activeConversationId;
          if (convId) {
            dispatch({ type: "CLEAR_CONVERSATION", payload: convId });
            // Clear message rows from SQLite so they don't reload on next session.
            void clearMessages(convId).catch((err: unknown) => {
              console.error(`Failed to clear messages for conversation ${convId}:`, err);
            });
          }
          dispatch({ type: "TOGGLE_COMMAND_PALETTE" });
        },
      },
      {
        id: "export",
        label: "Export conversation",
        icon: "export",
        category: "action",
        action: () => {
          dispatch({ type: "TOGGLE_COMMAND_PALETTE" });
        },
      },
      {
        id: "settings",
        label: "Settings",
        shortcut: "\u2318,",
        icon: "settings",
        category: "settings",
        action: () => {
          dispatch({ type: "TOGGLE_COMMAND_PALETTE" });
        },
      },
    ],
    [state.activeConversationId, state.settings.defaultModel, dispatch],
  );

  const conversationCommands: PaletteCommand[] = useMemo(
    () =>
      state.conversations.slice(0, 5).map((c: ConversationMeta) => ({
        id: `conv-${c.id}`,
        label: c.title,
        category: "settings" as const,
        action: () => {
          dispatch({ type: "SET_ACTIVE_CONVERSATION", payload: c.id });
          dispatch({ type: "TOGGLE_COMMAND_PALETTE" });
        },
      })),
    [state.conversations, dispatch],
  );

  const allCommands = useMemo(
    () => [...actionCommands, ...conversationCommands],
    [actionCommands, conversationCommands],
  );

  const filtered = useMemo(() => {
    if (!query.trim()) return allCommands;
    const lower = query.toLowerCase();
    return allCommands.filter((cmd) => cmd.label.toLowerCase().includes(lower));
  }, [query, allCommands]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) => Math.min(prev + 1, filtered.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prev) => Math.max(prev - 1, 0));
      } else if (e.key === "Enter" && filtered[selectedIndex]) {
        e.preventDefault();
        filtered[selectedIndex].action();
      } else if (e.key === "Escape") {
        dispatch({ type: "TOGGLE_COMMAND_PALETTE" });
      }
    },
    [filtered, selectedIndex, dispatch],
  );

  const closePalette = useCallback(() => {
    dispatch({ type: "TOGGLE_COMMAND_PALETTE" });
  }, [dispatch]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]"
      onClick={closePalette}
    >
      <div className="absolute inset-0 bg-black/60" />
      <div
        className="relative w-145 max-w-[90vw] bg-surface-1 border border-border rounded-sm shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 px-3 border-b border-border">
          <Search size={14} className="text-text-muted shrink-0" />
          <input
            ref={inputRef}
            aria-label="Command search"
            placeholder="Search commands..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            className="flex-1 bg-transparent text-[14px] font-mono text-text-primary placeholder:text-text-muted py-2.5 focus:outline-none"
          />
          <button
            aria-label="Close"
            onClick={closePalette}
            className="text-[11px] font-mono text-text-muted bg-surface-3 px-1.5 py-0.5 rounded-sm hover:text-text-secondary transition-colors duration-100"
          >
            Esc
          </button>
        </div>
        <div className="max-h-80 overflow-y-auto scrollbar-thin py-1">
          {filtered.length === 0 ? (
            <div className="px-3 py-6 text-center text-[13px] font-ui text-text-muted">
              No results
            </div>
          ) : (
            filtered.map((cmd, idx) => (
              <CommandItem
                key={cmd.id}
                command={cmd}
                isSelected={idx === selectedIndex}
                onSelect={cmd.action}
                onHover={() => setSelectedIndex(idx)}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}
