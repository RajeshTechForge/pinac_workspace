import { useEffect } from "react";
import { useChatContext } from "../context/ChatContext";
import type { ConversationMeta } from "../types";

export function useKeyboardShortcuts() {
  const { state, dispatch } = useChatContext();

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const isMeta = e.metaKey || e.ctrlKey;

      if (isMeta && e.key === "k") {
        e.preventDefault();
        dispatch({ type: "TOGGLE_COMMAND_PALETTE" });
        return;
      }

      if (e.key === "Escape") {
        if (state.settingsOpen) {
          e.preventDefault();
          dispatch({ type: "TOGGLE_SETTINGS" });
          return;
        }
        if (state.commandPaletteOpen) {
          e.preventDefault();
          dispatch({ type: "TOGGLE_COMMAND_PALETTE" });
          return;
        }
      }

      if (isMeta && e.key === "n") {
        e.preventDefault();
        const newMeta: ConversationMeta = {
          id: `conv-${Date.now()}`,
          title: "New conversation",
          model: state.settings.defaultModel,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          pinned: false,
        };
        dispatch({ type: "APPEND_CONVERSATION_META", payload: newMeta });
        return;
      }

      if (isMeta && e.key === "f") {
        if (state.sidebarMode !== "hidden") {
          e.preventDefault();
          const input = document.querySelector<HTMLInputElement>('[data-sidebar-search]');
          input?.focus();
        }
        return;
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [state.commandPaletteOpen, state.settingsOpen, state.sidebarMode, state.settings.defaultModel, dispatch]);
}
