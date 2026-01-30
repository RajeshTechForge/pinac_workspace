import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";
import { ProviderSettings } from "@/types";
import {
  MODEL_PROVIDERS,
  DEFAULT_PROVIDER_ID,
  DEFAULT_MODEL_ID,
  getDefaultSettings,
  updateProviderModels,
  ModelConfig,
} from "@/config/models";

interface ModelSettingsContextValue {
  selectedProviderId: string;
  selectedModelId: string;

  providerSettings: ProviderSettings;

  ollamaModels: ModelConfig[];
  isLoadingOllamaModels: boolean;
  ollamaError: string | null;

  setSelectedProvider: (providerId: string) => void;
  setSelectedModel: (modelId: string) => void;
  updateProviderSetting: (providerId: string, key: string, value: any) => void;
  getProviderSetting: (providerId: string, key: string) => any;
  refreshOllamaModels: () => Promise<void>;

  getCurrentProviderName: () => string;
  getCurrentModelName: () => string;
  getCurrentSettings: () => Record<string, any>;
  getAvailableModels: (providerId: string) => ModelConfig[];
}

const ModelSettingsContext = createContext<ModelSettingsContextValue | null>(
  null,
);

const STORAGE_KEYS = {
  SELECTED_PROVIDER: "selected-provider-id",
  SELECTED_MODEL: "selected-model-id",
  PROVIDER_SETTINGS_PREFIX: "provider-settings-",
} as const;

interface ModelSettingsProviderProps {
  children: React.ReactNode;
}

export const ModelSettingsProvider: React.FC<ModelSettingsProviderProps> = ({
  children,
}) => {
  const [selectedProviderId, setSelectedProviderIdState] = useState<string>(
    () => {
      const stored = localStorage.getItem(STORAGE_KEYS.SELECTED_PROVIDER);
      return stored && MODEL_PROVIDERS[stored] ? stored : DEFAULT_PROVIDER_ID;
    },
  );

  const [selectedModelId, setSelectedModelIdState] = useState<string>(() => {
    const stored = localStorage.getItem(STORAGE_KEYS.SELECTED_MODEL);
    // Will be validated after models are loaded
    return stored || DEFAULT_MODEL_ID;
  });

  const [providerSettings, setProviderSettings] = useState<ProviderSettings>(
    () => {
      const settings: ProviderSettings = {};

      Object.keys(MODEL_PROVIDERS).forEach((providerId) => {
        const storageKey = `${STORAGE_KEYS.PROVIDER_SETTINGS_PREFIX}${providerId}`;
        const stored = localStorage.getItem(storageKey);

        if (stored) {
          try {
            settings[providerId] = JSON.parse(stored);
          } catch {
            settings[providerId] = getDefaultSettings(providerId);
          }
        } else {
          settings[providerId] = getDefaultSettings(providerId);
        }
      });

      return settings;
    },
  );

  // Dynamic Ollama models state
  const [ollamaModels, setOllamaModels] = useState<ModelConfig[]>([]);
  const [isLoadingOllamaModels, setIsLoadingOllamaModels] = useState(false);
  const [ollamaError, setOllamaError] = useState<string | null>(null);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.SELECTED_PROVIDER, selectedProviderId);
  }, [selectedProviderId]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.SELECTED_MODEL, selectedModelId);
  }, [selectedModelId]);

  useEffect(() => {
    Object.entries(providerSettings).forEach(([providerId, settings]) => {
      const storageKey = `${STORAGE_KEYS.PROVIDER_SETTINGS_PREFIX}${providerId}`;
      localStorage.setItem(storageKey, JSON.stringify(settings));
    });
  }, [providerSettings]);

  //        OLLAMA MODELS FETCHING
  // ----------------------------------------

  const fetchOllamaModels = useCallback(async (): Promise<void> => {
    setIsLoadingOllamaModels(true);
    setOllamaError(null);

    try {
      const models: OllamaModel[] =
        await window.ipcRenderer.invoke("get-ollama-models");

      if (!models || models.length === 0) {
        setOllamaError(
          "No Ollama models found. Please download models using: ollama pull <model>",
        );
        setOllamaModels([]);
        updateProviderModels("ollama", []);
        setIsLoadingOllamaModels(false);
        return;
      }

      // Convert Ollama models to ModelConfig format
      const modelConfigs: ModelConfig[] = models.map((model) => ({
        id: model.name,
        name: model.name,
        displayName: model.name,
      }));

      setOllamaModels(modelConfigs);

      updateProviderModels("ollama", modelConfigs);

      if (selectedProviderId === "ollama") {
        const modelExists = modelConfigs.find((m) => m.id === selectedModelId);
        if (!modelExists && modelConfigs.length > 0) {
          // Selected model doesn't exist, select the first available model
          setSelectedModelIdState(modelConfigs[0].id);
        }
      }
    } catch (error: any) {
      console.error("Failed to fetch Ollama models:", error);
      setOllamaError("Failed to connect to Ollama. Is Ollama running?");
      setOllamaModels([]);
      updateProviderModels("ollama", []);
    } finally {
      setIsLoadingOllamaModels(false);
    }
  }, [selectedProviderId, selectedModelId]);

  const refreshOllamaModels = useCallback(async (): Promise<void> => {
    await fetchOllamaModels();
  }, [fetchOllamaModels]);

  // Fetch Ollama models on mount
  useEffect(() => {
    fetchOllamaModels();
  }, [fetchOllamaModels]);

  //          ACTIONS
  // -----------------------------

  const setSelectedProvider = useCallback(
    (providerId: string) => {
      if (!MODEL_PROVIDERS[providerId]) {
        console.warn(`Provider ${providerId} not found in configuration`);
        return;
      }
      setSelectedProviderIdState(providerId);

      // For dynamic providers like Ollama, use the fetched models
      if (providerId === "ollama") {
        const firstModel = ollamaModels[0];
        if (firstModel) {
          setSelectedModelIdState(firstModel.id);
        } else {
          setSelectedModelIdState("");
        }
      } else {
        // For static providers, use models from config
        const firstModel = MODEL_PROVIDERS[providerId].models[0];
        if (firstModel) {
          setSelectedModelIdState(firstModel.id);
        } else {
          setSelectedModelIdState("");
        }
      }
    },
    [ollamaModels],
  );

  const setSelectedModel = useCallback((modelId: string) => {
    setSelectedModelIdState(modelId);
  }, []);

  const updateProviderSetting = useCallback(
    (providerId: string, key: string, value: any) => {
      setProviderSettings((prev) => ({
        ...prev,
        [providerId]: {
          ...prev[providerId],
          [key]: value,
        },
      }));
    },
    [],
  );

  const getProviderSetting = useCallback(
    (providerId: string, key: string): any => {
      return providerSettings[providerId]?.[key];
    },
    [providerSettings],
  );

  const getCurrentProviderName = useCallback((): string => {
    return MODEL_PROVIDERS[selectedProviderId]?.displayName || "Unknown";
  }, [selectedProviderId]);

  const getCurrentModelName = useCallback((): string => {
    // For dynamic providers like Ollama, use the dynamic models
    if (selectedProviderId === "ollama") {
      if (isLoadingOllamaModels) return "Loading...";
      if (ollamaError) return "Error loading models";
      if (ollamaModels.length === 0) return "No models found";

      const model = ollamaModels.find((m) => m.id === selectedModelId);
      return model?.displayName || "Select a model";
    }

    // For static providers, use config
    const provider = MODEL_PROVIDERS[selectedProviderId];
    if (!provider) return "Unknown";

    const model = provider.models.find((m) => m.id === selectedModelId);
    return model?.displayName || "Select a model";
  }, [
    selectedProviderId,
    selectedModelId,
    ollamaModels,
    isLoadingOllamaModels,
    ollamaError,
  ]);

  const getCurrentSettings = useCallback((): Record<string, any> => {
    return providerSettings[selectedProviderId] || {};
  }, [selectedProviderId, providerSettings]);

  const getAvailableModels = useCallback(
    (providerId: string): ModelConfig[] => {
      if (providerId === "ollama") {
        return ollamaModels;
      }
      return MODEL_PROVIDERS[providerId]?.models || [];
    },
    [ollamaModels],
  );

  const value: ModelSettingsContextValue = {
    selectedProviderId,
    selectedModelId,
    providerSettings,
    ollamaModels,
    isLoadingOllamaModels,
    ollamaError,
    setSelectedProvider,
    setSelectedModel,
    updateProviderSetting,
    getProviderSetting,
    refreshOllamaModels,
    getCurrentProviderName,
    getCurrentModelName,
    getCurrentSettings,
    getAvailableModels,
  };

  return (
    <ModelSettingsContext.Provider value={value}>
      {children}
    </ModelSettingsContext.Provider>
  );
};

//    CUSTOM HOOK
// ---------------------

export const useModelSettings = (): ModelSettingsContextValue => {
  const context = useContext(ModelSettingsContext);

  if (!context) {
    throw new Error(
      "useModelSettings must be used within ModelSettingsProvider",
    );
  }

  return context;
};
