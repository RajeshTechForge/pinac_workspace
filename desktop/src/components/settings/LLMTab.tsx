import { useEffect, useState } from "react";
import { CheckCircle } from "lucide-react";
import { useChatContext } from "../../context/ChatContext";
import Select from "../ui/Select";
import { saveApiKey, apiKeyExists } from "../../services/apiKey";
import { saveLlmSettings, loadLlmSettings } from "../../services/llmSettings";

function clamp(n: number, min: number, max: number): number {
  return Math.min(Math.max(n, min), max);
}

export default function LLMTab() {
  const { state, dispatch } = useChatContext();

  const [provider, setProvider] = useState(state.settings.provider);
  const [temperature, setTemperature] = useState(state.settings.temperature);
  const [maxTokens, setMaxTokens] = useState(state.settings.maxTokens);
  const [topP, setTopP] = useState(state.settings.topP);
  const [timeout, setTimeout] = useState(state.settings.timeout);

  const [apiKeyInput, setApiKeyInput] = useState("");
  const [keyIsSaved, setKeyIsSaved] = useState(false);

  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const providerOptions = state.providers.map((p) => ({
    value: p.value,
    label: p.label,
  }));

  /** Returns the `apiKeyName` for a given provider value, or `null` when not found. */
  function apiKeyNameFor(providerValue: string): string | null {
    return (
      state.providers.find((p) => p.value === providerValue)?.apiKeyName ?? null
    );
  }

  useEffect(() => {
    const stored = loadLlmSettings();
    if (stored !== null) {
      setProvider(stored.provider);
      setTemperature(stored.temperature);
      setMaxTokens(stored.maxTokens);
      setTopP(stored.topP);
      setTimeout(stored.timeout);
    }
  }, []);

  // Re-check key existence
  useEffect(() => {
    const keyName = apiKeyNameFor(provider);
    if (!keyName) {
      setKeyIsSaved(false);
      return;
    }
    setApiKeyInput("");
    apiKeyExists(keyName)
      .then((exists) => setKeyIsSaved(exists))
      .catch(() => setKeyIsSaved(false));
  }, [provider, state.providers]);

  function handleProviderChange(newProvider: string): void {
    setProvider(newProvider);
  }

  async function handleSave(): Promise<void> {
    setIsSaving(true);
    setSaveError(null);

    try {
      // Persist the API key first — drop the plaintext from state immediately.
      if (apiKeyInput.trim().length > 0) {
        const keyName = apiKeyNameFor(provider);
        if (!keyName)
          throw new Error(
            `No apiKeyName configured for provider "${provider}".`,
          );
        await saveApiKey(keyName, apiKeyInput);
        setApiKeyInput("");
        setKeyIsSaved(true);
      }

      const modelToSave =
        provider !== state.settings.provider
          ? (state.providers.find((p) => p.value === provider)?.defaultModel ??
            state.settings.defaultModel)
          : state.settings.defaultModel;

      const providerChanged = provider !== state.settings.provider;
      const newModel = state.providers
        .find((p) => p.value === provider)
        ?.models.find((m) => m.id === modelToSave);
      const newThinkingConfig = newModel?.thinking;
      const newThinkingEffort =
        providerChanged || state.settings.thinkingEffort === ""
          ? (newThinkingConfig?.defaultEffort ?? "")
          : state.settings.thinkingEffort;
      const newThinkingEnabled =
        providerChanged
          ? false
          : state.settings.thinkingEnabled && newThinkingConfig !== undefined;

      saveLlmSettings({
        provider,
        defaultModel: modelToSave,
        temperature,
        maxTokens,
        topP,
        timeout,
        thinkingEnabled: newThinkingEnabled,
        thinkingEffort: newThinkingEffort,
      });

      dispatch({
        type: "UPDATE_SETTINGS",
        payload: {
          provider,
          defaultModel: modelToSave,
          temperature,
          maxTokens,
          topP,
          timeout,
          apiKeySaved: keyIsSaved || apiKeyInput.trim().length > 0,
          thinkingEnabled: newThinkingEnabled,
          thinkingEffort: newThinkingEffort,
        },
      });
    } catch (err) {
      setSaveError(typeof err === "string" ? err : "Failed to save settings.");
    } finally {
      setIsSaving(false);
    }
  }

  const hasChanges =
    provider !== state.settings.provider ||
    temperature !== state.settings.temperature ||
    maxTokens !== state.settings.maxTokens ||
    topP !== state.settings.topP ||
    timeout !== state.settings.timeout ||
    apiKeyInput.trim().length > 0;

  if (state.providers.length === 0) {
    return (
      <div className="max-w-md py-8 text-center text-sm text-text-muted font-ui">
        Loading providers...
      </div>
    );
  }

  // Derive the key name for the currently selected provider for display use.
  const currentKeyName = apiKeyNameFor(provider);

  return (
    <div className="max-w-md space-y-5">
      {/* Provider */}
      <div>
        <label className="block text-xs font-ui text-text-secondary mb-1.5">
          Provider
        </label>
        <Select
          value={provider}
          options={providerOptions}
          onChange={handleProviderChange}
        />
      </div>

      {/* API Key — write-only after the first save, scoped per-provider */}
      <div>
        <label className="block text-xs font-ui text-text-secondary mb-1.5">
          API Key
          {currentKeyName !== null && (
            <span className="ml-1.5 text-[10px] font-mono text-text-muted">
              ({currentKeyName})
            </span>
          )}
        </label>
        <div className="relative">
          <input
            id="llm-api-key"
            type="password"
            value={apiKeyInput}
            onChange={(e) => setApiKeyInput(e.target.value)}
            className="w-full bg-surface-2 border border-border rounded-sm px-3 py-1.5 pr-9 text-sm text-text-primary placeholder-text-muted outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/30 transition-colors duration-100 font-mono"
            placeholder={
              keyIsSaved
                ? "Enter new key to replace saved key"
                : "Enter API key…"
            }
            autoComplete="off"
          />
          {keyIsSaved && apiKeyInput.length === 0 && (
            <span className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1 text-[10px] font-ui text-emerald-400 pointer-events-none">
              <CheckCircle size={11} />
              Saved
            </span>
          )}
        </div>
        <p className="mt-1 text-[10px] font-ui text-text-muted">
          Stored encrypted on-device.
        </p>
      </div>

      {/* Temperature */}
      <div>
        <label className="block text-xs font-ui text-text-secondary mb-1.5">
          Temperature: {temperature.toFixed(1)}
        </label>
        <input
          type="range"
          min="0"
          max="2"
          step="0.1"
          value={temperature}
          onChange={(e) => setTemperature(Number(e.target.value))}
          className="w-full accent-accent h-1.5 cursor-pointer"
        />
        <div className="flex justify-between text-[10px] font-ui text-text-muted mt-0.5">
          <span>Precise (0)</span>
          <span>Creative (2)</span>
        </div>
      </div>

      {/* Max Tokens */}
      <div>
        <label className="block text-xs font-ui text-text-secondary mb-1.5">
          Max Tokens
        </label>
        <input
          type="number"
          min="256"
          max="8192"
          step="256"
          value={maxTokens}
          onChange={(e) =>
            setMaxTokens(clamp(Number(e.target.value), 256, 8192))
          }
          className="w-full bg-surface-2 border border-border rounded-sm px-3 py-1.5 text-sm text-text-primary font-ui placeholder-text-muted outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/30 transition-colors duration-100"
        />
      </div>

      {/* Top P */}
      <div>
        <label className="block text-xs font-ui text-text-secondary mb-1.5">
          Top P: {topP.toFixed(2)}
        </label>
        <input
          type="range"
          min="0"
          max="1"
          step="0.05"
          value={topP}
          onChange={(e) => setTopP(Number(e.target.value))}
          className="w-full accent-accent h-1.5 cursor-pointer"
        />
        <div className="flex justify-between text-[10px] font-ui text-text-muted mt-0.5">
          <span>Focused (0.0)</span>
          <span>Diverse (1.0)</span>
        </div>
      </div>

      {/* Timeout */}
      <div>
        <label className="block text-xs font-ui text-text-secondary mb-1.5">
          Request Timeout (seconds)
        </label>
        <input
          type="number"
          min="5"
          max="120"
          step="5"
          value={timeout}
          onChange={(e) => setTimeout(clamp(Number(e.target.value), 5, 120))}
          className="w-full bg-surface-2 border border-border rounded-sm px-3 py-1.5 text-sm text-text-primary font-ui placeholder-text-muted outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/30 transition-colors duration-100"
        />
      </div>

      {/* Error feedback */}
      {saveError !== null && (
        <p className="text-xs font-ui text-red-400">{saveError}</p>
      )}

      {/* Save button */}
      <button
        onClick={() => void handleSave()}
        disabled={!hasChanges || isSaving}
        className="px-4 py-1.5 text-xs font-ui font-medium bg-accent text-white rounded-sm hover:bg-accent-dim transition-colors duration-100 disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {isSaving ? "Saving…" : "Save"}
      </button>
    </div>
  );
}
