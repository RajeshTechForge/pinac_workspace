import { useState } from "react";
import { useChatContext } from "../../context/ChatContext";
import Select from "../ui/Select";

export default function LLMTab() {
  const { state, dispatch } = useChatContext();
  const [provider, setProvider] = useState(state.settings.provider);
  const [defaultModel, setDefaultModel] = useState(state.settings.defaultModel);
  const [apiKey, setApiKey] = useState(state.settings.apiKey);
  const [temperature, setTemperature] = useState(state.settings.temperature);
  const [maxTokens, setMaxTokens] = useState(state.settings.maxTokens);

  const options = state.providers.map((p) => ({
    value: p.value,
    label: p.label,
  }));

  function handleProviderChange(newProvider: string) {
    setProvider(newProvider);
    const found = state.providers.find((p) => p.value === newProvider);
    if (found) {
      setDefaultModel(found.defaultModel);
    }
  }

  function handleSave() {
    dispatch({
      type: "UPDATE_SETTINGS",
      payload: { provider, defaultModel, apiKey, temperature, maxTokens },
    });
  }

  const hasChanges =
    provider !== state.settings.provider ||
    defaultModel !== state.settings.defaultModel ||
    apiKey !== state.settings.apiKey ||
    temperature !== state.settings.temperature ||
    maxTokens !== state.settings.maxTokens;

  if (state.providers.length === 0) {
    return (
      <div className="max-w-md py-8 text-center text-sm text-text-muted font-ui">
        Loading providers...
      </div>
    );
  }

  return (
    <div className="max-w-md space-y-5">
      <div>
        <label className="block text-xs font-ui text-text-secondary mb-1.5">
          Provider
        </label>
        <Select
          value={provider}
          options={options}
          onChange={handleProviderChange}
        />
      </div>

      <div>
        <label className="block text-xs font-ui text-text-secondary mb-1.5">
          Default Model
        </label>
        <input
          type="text"
          value={defaultModel}
          onChange={(e) => setDefaultModel(e.target.value)}
          className="w-full bg-surface-2 border border-border rounded-sm px-3 py-1.5 text-sm text-text-primary font-ui placeholder-text-muted outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/30 transition-colors duration-100"
          placeholder="claude-sonnet-4-5"
        />
      </div>

      <div>
        <label className="block text-xs font-ui text-text-secondary mb-1.5">
          API Key
        </label>
        <input
          type="password"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          className="w-full bg-surface-2 border border-border rounded-sm px-3 py-1.5 text-sm text-text-primary placeholder-text-muted outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/30 transition-colors duration-100 font-mono"
          placeholder="sk-..."
        />
      </div>

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
          onChange={(e) => setMaxTokens(Number(e.target.value))}
          className="w-full bg-surface-2 border border-border rounded-sm px-3 py-1.5 text-sm text-text-primary font-ui placeholder-text-muted outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/30 transition-colors duration-100"
        />
      </div>

      <button
        onClick={handleSave}
        disabled={!hasChanges}
        className="px-4 py-1.5 text-xs font-ui font-medium bg-accent text-white rounded-sm hover:bg-accent-dim transition-colors duration-100 disabled:opacity-40 disabled:cursor-not-allowed"
      >
        Save
      </button>
    </div>
  );
}
