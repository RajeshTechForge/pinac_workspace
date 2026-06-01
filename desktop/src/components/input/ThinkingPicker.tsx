import { useEffect, useRef, useState } from "react";
import { Brain, ChevronDown } from "lucide-react";
import { useChatContext } from "../../context/ChatContext";
import { saveLlmSettings } from "../../services/llmSettings";

export default function ThinkingPicker() {
  const { state, dispatch } = useChatContext();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const currentProvider = state.providers.find(
    (p) => p.value === state.settings.provider,
  );
  const currentModel = currentProvider?.models.find(
    (m) => m.id === state.settings.defaultModel,
  );
  const thinkingConfig = currentModel?.thinking;

  const enabled = state.settings.thinkingEnabled;
  const effort = state.settings.thinkingEffort;

  useEffect(() => {
    function handleClickOutside(e: MouseEvent): void {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function handleSelect(newEffort: string | null): void {
    const newEnabled = newEffort !== null;
    dispatch({
      type: "UPDATE_SETTINGS",
      payload: {
        thinkingEnabled: newEnabled,
        thinkingEffort: newEnabled ? newEffort : "",
      },
    });

    saveLlmSettings({
      provider: state.settings.provider,
      defaultModel: state.settings.defaultModel,
      temperature: state.settings.temperature,
      maxTokens: state.settings.maxTokens,
      topP: state.settings.topP,
      timeout: state.settings.timeout,
      thinkingEnabled: newEnabled,
      thinkingEffort: newEnabled ? newEffort : "",
    });

    setOpen(false);
  }

  if (!thinkingConfig) return null;

  return (
    <div ref={ref} className="relative">
      <button
        aria-label="Toggle thinking"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((prev) => !prev)}
        className="flex items-center gap-1.5 text-[11px] font-mono text-text-muted hover:text-text-secondary transition-colors duration-100 px-1.5 py-1 rounded-sm hover:bg-surface-3"
      >
        <Brain size={10} />
        <span>{enabled ? `Think: ${effort}` : "Think: Off"}</span>
        <ChevronDown size={10} />
      </button>

      {open && (
        <div
          role="listbox"
          aria-label="Thinking options"
          className="absolute bottom-full left-0 mb-1 min-w-36 bg-surface-2 border border-border rounded-sm shadow-lg z-20"
        >
          <button
            role="option"
            aria-selected={!enabled}
            onClick={() => handleSelect(null)}
            className={`block w-full text-left px-3 py-1.5 text-[12px] font-mono transition-colors duration-100 ${
              !enabled
                ? "text-accent bg-accent/10"
                : "text-text-secondary hover:bg-surface-3 hover:text-text-primary"
            }`}
          >
            Off
          </button>

          <div className="border-t border-border mx-2" />

          {thinkingConfig.efforts.map((eff) => (
            <button
              key={eff}
              role="option"
              aria-selected={enabled && effort === eff}
              onClick={() => handleSelect(eff)}
              className={`block w-full text-left px-3 py-1.5 text-[12px] font-mono capitalize transition-colors duration-100 ${
                enabled && effort === eff
                  ? "text-accent bg-accent/10"
                  : "text-text-secondary hover:bg-surface-3 hover:text-text-primary"
              }`}
            >
              {eff}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
