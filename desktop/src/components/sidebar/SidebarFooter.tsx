import { Settings } from "lucide-react";
import { useChatContext } from "../../context/ChatContext";

export default function SidebarFooter() {
  const { state, dispatch } = useChatContext();

  return (
    <div className="mt-auto border-t border-border px-3 py-2 flex items-center gap-2">
      <div className="w-5 h-5 rounded-sm bg-surface-3 flex items-center justify-center text-[10px] font-mono text-text-muted">
        {state.settings.displayName.charAt(0).toUpperCase()}
      </div>
      <span className="text-xs font-ui text-text-secondary truncate flex-1">{state.settings.displayName}</span>
      <button
        onClick={() => dispatch({ type: "TOGGLE_SETTINGS" })}
        aria-label="Settings"
        className="p-1 text-text-muted hover:text-text-secondary hover:bg-surface-3 rounded-sm transition-colors duration-100"
      >
        <Settings size={13} />
      </button>
    </div>
  );
}
