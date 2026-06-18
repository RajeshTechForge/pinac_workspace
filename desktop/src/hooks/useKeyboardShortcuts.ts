import { useEffect } from "react";
import { useChatContext } from "../context/ChatContext";

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
        dispatch({ type: "NEW_CHAT" });
        return;
      }

      if (isMeta && e.key === ",") {
        e.preventDefault();
        dispatch({ type: "TOGGLE_SETTINGS" });
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
  }, [state.commandPaletteOpen, state.settingsOpen, state.sidebarMode, dispatch]);
}
