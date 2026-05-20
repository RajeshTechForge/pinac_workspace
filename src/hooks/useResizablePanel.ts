import { useRef, useCallback, useEffect } from "react";
import { useChatContext } from "../context/ChatContext";

const STORAGE_KEY = "pinac-sidebar-width";
const MIN_WIDTH = 180;
const MAX_WIDTH = 400;

export function useResizablePanel() {
  const { state, dispatch } = useChatContext();
  const dragRef = useRef<{ startX: number; startWidth: number } | null>(null);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      dragRef.current = {
        startX: e.clientX,
        startWidth: state.sidebarWidth,
      };
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    },
    [state.sidebarWidth],
  );

  useEffect(() => {
    function onMouseMove(e: MouseEvent) {
      if (!dragRef.current) return;
      const delta = e.clientX - dragRef.current.startX;
      const newWidth = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, dragRef.current.startWidth + delta));
      dispatch({ type: "SET_SIDEBAR_WIDTH", payload: newWidth });
    }

    function onMouseUp() {
      if (dragRef.current) {
        localStorage.setItem(STORAGE_KEY, String(state.sidebarWidth));
        dragRef.current = null;
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      }
    }

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
    return () => {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    };
  }, [state.sidebarWidth, dispatch]);

  return { handleMouseDown, sidebarWidth: state.sidebarWidth };
}
