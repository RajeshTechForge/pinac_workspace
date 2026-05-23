import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { useChatContext } from "../../context/ChatContext";
import { saveLlmSettings } from "../../services/llmSettings";

/**
 * Inline model selector rendered in the input toolbar.
 *
 * Derives the list of available models from the currently selected provider
 * in global context (`state.settings.provider → state.providers[].models`).
 * Selecting a model immediately persists the choice to both context and
 * `localStorage` so the selection survives page reloads without an explicit
 * Save action.
 *
 * Renders nothing when the provider list has not yet loaded from the backend.
 */
export default function ModelPicker() {
  const { state, dispatch } = useChatContext();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Resolve the model list for the currently selected provider.
  const currentProvider = state.providers.find(
    (p) => p.value === state.settings.provider,
  );
  const models = currentProvider?.models ?? [];
  const selectedId = state.settings.defaultModel;
  const current = models.find((m) => m.id === selectedId) ?? models[0];

  // Close the dropdown when the user clicks outside it.
  useEffect(() => {
    function handleClickOutside(e: MouseEvent): void {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function handleSelect(modelId: string): void {
    // Persist to context so every component immediately sees the new model.
    dispatch({ type: "UPDATE_SETTINGS", payload: { defaultModel: modelId } });

    // Persist to localStorage so the selection survives reloads. The full
    // settings object is written to keep the stored value consistent.
    saveLlmSettings({
      provider: state.settings.provider,
      defaultModel: modelId,
      temperature: state.settings.temperature,
      maxTokens: state.settings.maxTokens,
      topK: state.settings.topK,
      timeout: state.settings.timeout,
    });

    setOpen(false);
  }

  // Nothing to show until providers are loaded from the backend.
  if (models.length === 0) return null;

  return (
    <div ref={ref} className="relative">
      <button
        id="model-picker-trigger"
        aria-label="Select model"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((prev) => !prev)}
        className="flex items-center gap-1.5 text-[11px] font-mono text-text-muted hover:text-text-secondary transition-colors duration-100 px-1.5 py-1 rounded-sm hover:bg-surface-3"
      >
        <span>{current?.name ?? selectedId}</span>
        <ChevronDown size={10} />
      </button>

      {open && (
        <div
          role="listbox"
          aria-label="Available models"
          className="absolute bottom-full left-0 mb-1 min-w-44 bg-surface-2 border border-border rounded-sm shadow-lg z-20"
        >
          {models.map((m) => (
            <button
              key={m.id}
              role="option"
              aria-selected={m.id === selectedId}
              onClick={() => handleSelect(m.id)}
              className={`block w-full text-left px-3 py-1.5 text-[12px] font-mono transition-colors duration-100 ${
                m.id === selectedId
                  ? "text-accent bg-accent/10"
                  : "text-text-secondary hover:bg-surface-3 hover:text-text-primary"
              }`}
            >
              {m.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
