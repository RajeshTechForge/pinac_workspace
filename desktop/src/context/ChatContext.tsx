import {
  createContext,
  useContext,
  useEffect,
  useReducer,
  type ReactNode,
} from "react";
import type { ChatState, ChatAction } from "../types";
import { readAppConfig } from "../services/config";
import { loadLlmSettings } from "../services/llmSettings";

const STORAGE_KEY_SIDEBAR_WIDTH = "pinac-sidebar-width";

function createInitialState(): ChatState {
  const savedWidth =
    typeof window !== "undefined"
      ? Number(localStorage.getItem(STORAGE_KEY_SIDEBAR_WIDTH))
      : 280;

  return {
    conversations: [],
    activeConversationId: null,
    streamingMessageId: null,
    streamingText: "",
    isStreaming: false,
    sidebarSearch: "",
    sidebarWidth: savedWidth >= 180 && savedWidth <= 400 ? savedWidth : 280,
    sidebarMode: "full",
    commandPaletteOpen: false,
    settingsOpen: false,
    activeSettingsTab: "profile",
    providers: [],
    settings: {
      theme: "dark",
      fontSize: 14,
      defaultModel: "",
      displayName: "User",
      email: "",
      apiKeySaved: false,
      temperature: 0.7,
      maxTokens: 2048,
      topP: 0.95,
      timeout: 30,
      provider: "",
    },
  };
}

function chatReducer(state: ChatState, action: ChatAction): ChatState {
  switch (action.type) {
    case "SET_ACTIVE_CONVERSATION":
      return { ...state, activeConversationId: action.payload };

    case "ADD_CONVERSATION":
      return {
        ...state,
        conversations: [action.payload, ...state.conversations],
        activeConversationId: action.payload.id,
      };

    case "DELETE_CONVERSATION": {
      const filtered = state.conversations.filter(
        (c) => c.id !== action.payload,
      );
      return {
        ...state,
        conversations: filtered,
        activeConversationId:
          state.activeConversationId === action.payload
            ? (filtered[0]?.id ?? null)
            : state.activeConversationId,
      };
    }

    case "PIN_CONVERSATION":
      return {
        ...state,
        conversations: state.conversations.map((c) =>
          c.id === action.payload ? { ...c, pinned: !c.pinned } : c,
        ),
      };

    case "RENAME_CONVERSATION":
      return {
        ...state,
        conversations: state.conversations.map((c) =>
          c.id === action.payload.id
            ? { ...c, title: action.payload.title }
            : c,
        ),
      };

    case "ADD_MESSAGE":
      return {
        ...state,
        conversations: state.conversations.map((c) =>
          c.id === action.payload.conversationId
            ? {
                ...c,
                messages: [...c.messages, action.payload],
                updatedAt: Date.now(),
              }
            : c,
        ),
      };

    case "APPEND_STREAM_TEXT":
      return { ...state, streamingText: state.streamingText + action.payload };

    case "SET_STREAMING":
      return {
        ...state,
        isStreaming: action.payload.messageId !== null,
        streamingMessageId: action.payload.messageId,
        streamingText: action.payload.text,
      };

    case "FINISH_STREAMING": {
      const messageId = state.streamingMessageId;
      if (!messageId) return state;
      return {
        ...state,
        isStreaming: false,
        streamingMessageId: null,
        streamingText: "",
        conversations: state.conversations.map((c) =>
          c.messages.some((m) => m.id === messageId)
            ? {
                ...c,
                messages: c.messages.map((m) =>
                  m.id === messageId
                    ? {
                        ...m,
                        content: state.streamingText,
                        tokenCount: Math.round(
                          state.streamingText.split(" ").length * 1.3,
                        ),
                      }
                    : m,
                ),
              }
            : c,
        ),
      };
    }

    case "SET_SIDEBAR_SEARCH":
      return { ...state, sidebarSearch: action.payload };

    case "SET_SIDEBAR_WIDTH":
      return { ...state, sidebarWidth: action.payload };

    case "SET_SIDEBAR_MODE":
      return { ...state, sidebarMode: action.payload };

    case "TOGGLE_COMMAND_PALETTE":
      return { ...state, commandPaletteOpen: !state.commandPaletteOpen };

    case "UPDATE_SETTINGS":
      return { ...state, settings: { ...state.settings, ...action.payload } };

    case "TOGGLE_SETTINGS":
      return { ...state, settingsOpen: !state.settingsOpen };

    case "SET_SETTINGS_TAB":
      return { ...state, activeSettingsTab: action.payload };

    case "SET_PROVIDERS": {
      let { provider, defaultModel } = state.settings;
      if (!provider) {
        provider = action.payload.defaultProvider;
        const found = action.payload.providers.find(
          (p) => p.value === provider,
        );
        if (found) {
          defaultModel = found.defaultModel;
        }
      }
      return {
        ...state,
        providers: action.payload.providers,
        settings: { ...state.settings, provider, defaultModel },
      };
    }

    case "CLEAR_CONVERSATION": {
      const conv = state.conversations.find((c) => c.id === action.payload);
      if (!conv) return state;
      return {
        ...state,
        conversations: state.conversations.map((c) =>
          c.id === action.payload ? { ...c, messages: [] } : c,
        ),
      };
    }

    default:
      return state;
  }
}

interface ChatContextValue {
  state: ChatState;
  dispatch: React.Dispatch<ChatAction>;
}

const ChatContext = createContext<ChatContextValue | null>(null);

export function ChatProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(chatReducer, null, createInitialState);

  useEffect(() => {
    const stored = loadLlmSettings();
    if (stored !== null) {
      dispatch({ type: "UPDATE_SETTINGS", payload: stored });
    }
  }, []);

  useEffect(() => {
    async function loadConfig() {
      try {
        const config = await readAppConfig();
        dispatch({
          type: "SET_PROVIDERS",
          payload: {
            providers: config.llm.providers,
            defaultProvider: config.llm.defaultProvider,
          },
        });
      } catch (err) {
        console.error("Failed to load app config:", err);
      }
    }
    loadConfig();
  }, []);

  return (
    <ChatContext.Provider value={{ state, dispatch }}>
      {children}
    </ChatContext.Provider>
  );
}

export function useChatContext(): ChatContextValue {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error("useChatContext must be used inside ChatProvider");
  return ctx;
}
