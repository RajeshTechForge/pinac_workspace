export type MessageRole = "user" | "assistant";

export type Message = {
  id: string;
  conversationId: string;
  role: MessageRole;
  content: string;
  model?: string;
  tokenCount?: number;
  timestamp: number;
};

export type ConversationMeta = {
  id: string;
  title: string;
  model: string;
  createdAt: number;
  updatedAt: number;
  pinned: boolean;
};

export type Conversation = ConversationMeta;

export type ConversationGroup = "today" | "yesterday" | "this-week" | "older";

export type ChatState = {
  conversations: ConversationMeta[];
  activeMessages: Message[];
  messagesLoading: boolean;
  activeConversationId: string | null;
  streamingMessageId: string | null;
  streamingText: string;
  isStreaming: boolean;
  sidebarSearch: string;
  sidebarWidth: number;
  sidebarMode: "full" | "icon" | "hidden";
  commandPaletteOpen: boolean;
  settingsOpen: boolean;
  activeSettingsTab: "profile" | "llm";
  settings: AppSettings;
  providers: LlmProvider[];
};

export type ThinkingConfig = {
  mode: string;
  efforts: string[];
  defaultEffort: string;
};

export type LlmModel = {
  id: string;
  name: string;
  thinking?: ThinkingConfig;
};

export type LlmProvider = {
  value: string;
  label: string;
  apiKeyName: string;
  defaultModel: string;
  models: LlmModel[];
};

export type AppConfig = {
  llm: {
    defaultProvider: string;
    providers: LlmProvider[];
  };
};

export type AppSettings = {
  theme: "dark";
  fontSize: number;
  defaultModel: string;
  displayName: string;
  email: string;
  apiKeySaved: boolean;
  temperature: number;
  maxTokens: number;
  topP: number;
  timeout: number;
  provider: string;
  thinkingEnabled: boolean;
  thinkingEffort: string;
};

export type PaletteCommand = {
  id: string;
  label: string;
  shortcut?: string;
  icon?: string;
  category: "action" | "settings";
  action: () => void;
};

export type ChatAction =
  | { type: "SET_ACTIVE_CONVERSATION"; payload: string }
  | { type: "APPEND_CONVERSATION_META"; payload: ConversationMeta }
  | { type: "LOAD_CONVERSATIONS"; payload: ConversationMeta[] }
  | { type: "LOAD_MESSAGES"; payload: Message[] }
  | { type: "SET_MESSAGES_LOADING"; payload: boolean }
  | {
      type: "PATCH_CONVERSATION_META";
      payload: Partial<ConversationMeta> & { id: string };
    }
  | { type: "DELETE_CONVERSATION"; payload: string }
  | { type: "ADD_MESSAGE"; payload: Message }
  | { type: "APPEND_STREAM_TEXT"; payload: string }
  | {
      type: "SET_STREAMING";
      payload: { messageId: string | null; text: string };
    }
  | { type: "FINISH_STREAMING"; payload?: string }
  | { type: "SET_SIDEBAR_SEARCH"; payload: string }
  | { type: "SET_SIDEBAR_WIDTH"; payload: number }
  | { type: "SET_SIDEBAR_MODE"; payload: ChatState["sidebarMode"] }
  | { type: "TOGGLE_COMMAND_PALETTE" }
  | { type: "UPDATE_SETTINGS"; payload: Partial<AppSettings> }
  | { type: "TOGGLE_SETTINGS" }
  | { type: "SET_SETTINGS_TAB"; payload: "profile" | "llm" }
  | { type: "CLEAR_CONVERSATION"; payload: string }
  | {
      type: "SET_PROVIDERS";
      payload: { providers: LlmProvider[]; defaultProvider: string };
    };
