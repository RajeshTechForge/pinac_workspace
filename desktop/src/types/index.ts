export type MessageRole = "user" | "assistant";

export interface Message {
  id: string;
  conversationId: string;
  role: MessageRole;
  content: string;
  model?: string;
  tokenCount?: number;
  timestamp: number;
}

export interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  model: string;
  createdAt: number;
  updatedAt: number;
  pinned: boolean;
}

export type ConversationGroup = "today" | "yesterday" | "this-week" | "older";

export interface ChatState {
  conversations: Conversation[];
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
}

export type LlmModel = {
  id: string;
  name: string;
};

export interface LlmProvider {
  value: string;
  label: string;
  apiKeyName: string;
  defaultModel: string;
  models: LlmModel[];
}

export interface AppConfig {
  llm: {
    defaultProvider: string;
    providers: LlmProvider[];
  };
}

export interface AppSettings {
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
}

export interface PaletteCommand {
  id: string;
  label: string;
  shortcut?: string;
  icon?: string;
  category: "action" | "settings";
  action: () => void;
}

export type ChatAction =
  | { type: "SET_ACTIVE_CONVERSATION"; payload: string }
  | { type: "ADD_CONVERSATION"; payload: Conversation }
  | { type: "DELETE_CONVERSATION"; payload: string }
  | { type: "PIN_CONVERSATION"; payload: string }
  | { type: "RENAME_CONVERSATION"; payload: { id: string; title: string } }
  | { type: "ADD_MESSAGE"; payload: Message }
  | { type: "APPEND_STREAM_TEXT"; payload: string }
  | { type: "SET_STREAMING"; payload: { messageId: string | null; text: string } }
  | { type: "FINISH_STREAMING"; payload?: string }
  | { type: "SET_SIDEBAR_SEARCH"; payload: string }
  | { type: "SET_SIDEBAR_WIDTH"; payload: number }
  | { type: "SET_SIDEBAR_MODE"; payload: ChatState["sidebarMode"] }
  | { type: "TOGGLE_COMMAND_PALETTE" }
  | { type: "UPDATE_SETTINGS"; payload: Partial<AppSettings> }
  | { type: "TOGGLE_SETTINGS" }
  | { type: "SET_SETTINGS_TAB"; payload: "profile" | "llm" }
  | { type: "CLEAR_CONVERSATION"; payload: string }
  | { type: "SET_PROVIDERS"; payload: { providers: LlmProvider[]; defaultProvider: string } };
