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
import { listConversations, getMessages } from "../services/conversation";

const STORAGE_KEY_SIDEBAR_WIDTH = "pinac-sidebar-width";

function createInitialState(): ChatState {
  const savedWidth =
    typeof window !== "undefined"
      ? Number(localStorage.getItem(STORAGE_KEY_SIDEBAR_WIDTH))
      : 280;

  return {
    conversations: [],
    activeMessages: [],
    messagesLoading: false,
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
      return {
        ...state,
        activeConversationId: action.payload,
        activeMessages: [],
        messagesLoading: true,
      };

    case "LOAD_CONVERSATIONS":
      return { ...state, conversations: action.payload };

    case "LOAD_MESSAGES":
      return {
        ...state,
        activeMessages: action.payload,
        messagesLoading: false,
      };

    case "SET_MESSAGES_LOADING":
      return { ...state, messagesLoading: action.payload };

    case "APPEND_CONVERSATION_META":
      return {
        ...state,
        conversations: [action.payload, ...state.conversations],
        activeConversationId: action.payload.id,
        activeMessages: [],
        messagesLoading: false,
      };

    case "PATCH_CONVERSATION_META":
      return {
        ...state,
        conversations: state.conversations.map((c) =>
          c.id === action.payload.id ? { ...c, ...action.payload } : c,
        ),
      };

    case "DELETE_CONVERSATION": {
      const filtered = state.conversations.filter(
        (c) => c.id !== action.payload,
      );
      const nextActiveId =
        state.activeConversationId === action.payload
          ? (filtered[0]?.id ?? null)
          : state.activeConversationId;
      return {
        ...state,
        conversations: filtered,
        activeConversationId: nextActiveId,
        activeMessages:
          state.activeConversationId === action.payload
            ? []
            : state.activeMessages,
      };
    }

    case "ADD_MESSAGE":
      return {
        ...state,
        activeMessages: [...state.activeMessages, action.payload],
        conversations: state.conversations.map((c) =>
          c.id === action.payload.conversationId
            ? { ...c, updatedAt: Date.now() }
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
      const finalText = state.streamingText;
      return {
        ...state,
        isStreaming: false,
        streamingMessageId: null,
        streamingText: "",
        activeMessages: state.activeMessages.map((m) =>
          m.id === messageId
            ? {
                ...m,
                content: finalText,
                tokenCount: Math.round(finalText.split(" ").length * 1.3),
              }
            : m,
        ),
      };
    }

    case "CLEAR_CONVERSATION":
      return {
        ...state,
        // Only clear messages if the cleared conversation is currently active.
        activeMessages:
          state.activeConversationId === action.payload
            ? []
            : state.activeMessages,
      };

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

  // Restore persisted LLM settings from localStorage on mount.
  useEffect(() => {
    const stored = loadLlmSettings();
    if (stored !== null) {
      dispatch({ type: "UPDATE_SETTINGS", payload: stored });
    }
  }, []);

  // Load available LLM providers from the bundled config file on mount.
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

  // Populate the sidebar list from SQLite on mount
  useEffect(() => {
    async function loadSidebar() {
      try {
        const conversations = await listConversations();
        dispatch({ type: "LOAD_CONVERSATIONS", payload: conversations });
      } catch (err) {
        console.error("Failed to load conversations from DB:", err);
      }
    }
    loadSidebar();
  }, []);

  useEffect(() => {
    const id = state.activeConversationId;
    if (!id || !state.messagesLoading) return;

    let cancelled = false;

    async function loadMessages() {
      try {
        const messages = await getMessages(id!);
        if (!cancelled) {
          dispatch({ type: "LOAD_MESSAGES", payload: messages });
        }
      } catch (err) {
        console.error(`Failed to load messages for conversation ${id}:`, err);
        if (!cancelled) {
          dispatch({ type: "SET_MESSAGES_LOADING", payload: false });
        }
      }
    }

    loadMessages();
    return () => {
      cancelled = true;
    };
  }, [state.activeConversationId, state.messagesLoading]);

  // Persist sidebar width to localStorage whenever it changes.
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_SIDEBAR_WIDTH, String(state.sidebarWidth));
  }, [state.sidebarWidth]);

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
