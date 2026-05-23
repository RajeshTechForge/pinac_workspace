export type LlmSettingsPayload = {
  provider: string;
  defaultModel: string;
  temperature: number;
  maxTokens: number;
  topK: number;
  timeout: number;
};

const STORAGE_KEY = "pinac-llm-settings";

export function saveLlmSettings(settings: LlmSettingsPayload): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

export function loadLlmSettings(): LlmSettingsPayload | null {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw === null) return null;

  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return null;

    const obj = parsed as Record<string, unknown>;

    // Validate every expected field before trusting the stored value.
    if (
      typeof obj["provider"] !== "string" ||
      typeof obj["defaultModel"] !== "string" ||
      typeof obj["temperature"] !== "number" ||
      typeof obj["maxTokens"] !== "number" ||
      typeof obj["topK"] !== "number" ||
      typeof obj["timeout"] !== "number"
    ) {
      return null;
    }

    return {
      provider: obj["provider"],
      defaultModel: obj["defaultModel"],
      temperature: obj["temperature"],
      maxTokens: obj["maxTokens"],
      topK: obj["topK"],
      timeout: obj["timeout"],
    };
  } catch {
    return null;
  }
}
