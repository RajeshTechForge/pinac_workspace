import { X } from "lucide-react";
import { useChatContext } from "../../context/ChatContext";
import ProfileTab from "./ProfileTab";
import LLMTab from "./LLMTab";

export default function SettingsPanel() {
  const { state, dispatch } = useChatContext();

  const tabs: { id: "profile" | "llm"; label: string }[] = [
    { id: "profile", label: "Profile" },
    { id: "llm", label: "LLM Settings" },
  ];

  return (
    <div className="h-full flex flex-col bg-surface-0">
      <div
        className={`flex items-center justify-between py-3 border-b border-border shrink-0 ${
          state.sidebarMode === "hidden" ? "pl-12 pr-5" : "px-5"
        }`}
      >
        <h2 className="text-sm font-medium text-text-primary tracking-tight">
          Settings
        </h2>
        <button
          onClick={() => dispatch({ type: "TOGGLE_SETTINGS" })}
          className="p-1 text-text-muted hover:text-text-primary hover:bg-surface-3 rounded-sm transition-colors duration-100"
          aria-label="Close settings"
        >
          <X size={14} />
        </button>
      </div>

      <div className="flex gap-1 px-5 pt-3 pb-2 border-b border-border shrink-0">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() =>
              dispatch({ type: "SET_SETTINGS_TAB", payload: tab.id })
            }
            className={`px-3 py-1.5 text-xs font-ui rounded-sm transition-colors duration-100 ${
              state.activeSettingsTab === tab.id
                ? "bg-surface-3 text-text-primary"
                : "text-text-muted hover:text-text-secondary hover:bg-surface-2"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin px-5 py-4">
        {state.activeSettingsTab === "profile" ? <ProfileTab /> : <LLMTab />}
      </div>
    </div>
  );
}
