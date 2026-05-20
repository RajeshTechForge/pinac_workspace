import { useEffect, useCallback, useState } from "react";
import Sidebar from "./Sidebar";
import ResizeHandle from "./ResizeHandle";
import TitleBar from "./TitleBar";
import ChatArea from "../chat/ChatArea";
import InputArea from "../input/InputArea";
import SettingsPanel from "../settings/SettingsPanel";
import CommandPalette from "../command/CommandPalette";
import { useChatContext } from "../../context/ChatContext";
import { useResizablePanel } from "../../hooks/useResizablePanel";
import { useKeyboardShortcuts } from "../../hooks/useKeyboardShortcuts";

export default function AppShell() {
  const { state, dispatch } = useChatContext();
  const { handleMouseDown, sidebarWidth } = useResizablePanel();
  const [windowWidth, setWindowWidth] = useState(
    typeof window !== "undefined" ? window.innerWidth : 1400,
  );

  useKeyboardShortcuts();

  useEffect(() => {
    function onResize() {
      setWindowWidth(window.innerWidth);
    }
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    let mode: "full" | "icon" | "hidden";
    if (windowWidth <= 900) {
      mode = "hidden";
    } else if (windowWidth <= 1100) {
      mode = "icon";
    } else {
      mode = "full";
    }
    dispatch({ type: "SET_SIDEBAR_MODE", payload: mode });
  }, [windowWidth, dispatch]);

  const toggleSidebar = useCallback(() => {
    dispatch({
      type: "SET_SIDEBAR_MODE",
      payload: state.sidebarMode === "hidden" ? "full" : "hidden",
    });
  }, [state.sidebarMode, dispatch]);

  const gridFirstCol = state.sidebarMode === "icon" ? 48 : state.sidebarMode === "hidden" ? 0 : state.sidebarWidth;

  return (
    <div className="h-dvh w-full flex flex-col overflow-hidden">
      <TitleBar />
      <div className="flex-1 min-h-0 grid" style={{ gridTemplateColumns: `${gridFirstCol}px 4px 1fr`, gridTemplateRows: 'minmax(0, 1fr)' }}>
        {state.sidebarMode === "hidden" && (
          <button
            aria-label="Toggle sidebar"
            onClick={toggleSidebar}
            className="fixed top-11 left-2 z-40 p-1.5 bg-surface-2 border border-border rounded-sm text-text-secondary hover:text-text-primary transition-colors duration-100"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <line x1="3" y1="3" x2="13" y2="3" />
              <line x1="3" y1="8" x2="13" y2="8" />
              <line x1="3" y1="13" x2="13" y2="13" />
            </svg>
          </button>
        )}
        {state.sidebarMode !== "hidden" && (
          <Sidebar width={sidebarWidth} mode={state.sidebarMode} />
        )}
        <div style={{ gridColumn: state.sidebarMode === "hidden" ? "1 / -1" : "3" }} className="flex flex-col h-full min-w-0">
          {state.settingsOpen ? (
            <div className="flex-1 flex flex-col min-h-0">
              <SettingsPanel />
            </div>
          ) : (
            <>
              <div className="flex-1 flex flex-col min-h-0">
                <ChatArea />
              </div>
              <InputArea />
            </>
          )}
        </div>
        {state.sidebarMode === "full" && (
          <div style={{ gridColumn: "2" }}>
            <ResizeHandle onMouseDown={handleMouseDown} />
          </div>
        )}
        {state.commandPaletteOpen && <CommandPalette />}
      </div>
    </div>
  );
}
