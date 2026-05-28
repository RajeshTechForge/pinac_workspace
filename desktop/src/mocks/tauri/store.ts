import type { AppConfig, LlmProvider } from "../../types";

export type ConversationRow = {
  id: string;
  title: string;
  model: string;
  pinned: boolean;
  createdAt: number;
  updatedAt: number;
};

export type MessageRow = {
  id: string;
  conversationId: string;
  role: "user" | "assistant";
  content: string;
  model?: string;
  tokenCount?: number;
  timestamp: number;
};

// ---------------------------------------------------------------------------
// Event listener registry
// ---------------------------------------------------------------------------

type ListenerEntry = {
  event: string;
  handler: (payload: unknown) => void;
};

let listenerIdCounter = 0;
const listeners = new Map<number, ListenerEntry>();

export function addListener(
  event: string,
  handler: (payload: unknown) => void,
): () => void {
  const id = ++listenerIdCounter;
  listeners.set(id, { event, handler });
  return () => {
    listeners.delete(id);
  };
}

export function emit(event: string, payload: unknown): void {
  for (const entry of listeners.values()) {
    if (entry.event === event) {
      entry.handler(payload);
    }
  }
}

// ---------------------------------------------------------------------------
// Data store
// ---------------------------------------------------------------------------

function now(): number {
  return Date.now();
}

function ms(hours: number): number {
  return hours * 3600000;
}

function id(prefix: string): string {
  return `${prefix}-${crypto.randomUUID().slice(0, 8)}`;
}

const SEED_CONVERSATIONS: ConversationRow[] = [
  {
    id: "conv-1",
    title: "Welcome to Pinac Workspace",
    model: "gpt-4o",
    pinned: true,
    createdAt: now() - ms(168),
    updatedAt: now() - ms(24),
  },
  {
    id: "conv-2",
    title: "Code review assistance",
    model: "claude-sonnet-4-20250514",
    pinned: false,
    createdAt: now() - ms(72),
    updatedAt: now() - ms(48),
  },
  {
    id: "conv-3",
    title: "Debugging the API integration",
    model: "gpt-4o",
    pinned: false,
    createdAt: now() - ms(1),
    updatedAt: now() - ms(1),
  },
];

const SEED_MESSAGES: Record<string, MessageRow[]> = {
  "conv-1": [
    {
      id: "msg-1",
      conversationId: "conv-1",
      role: "user",
      content: "Hello! What can you help me with?",
      timestamp: now() - ms(168),
    },
    {
      id: "msg-2",
      conversationId: "conv-1",
      role: "assistant",
      content:
        "Hi! I'm Pinac Workspace, your AI assistant. I can help with coding, debugging, writing, research, and more. How can I assist you today?",
      model: "gpt-4o",
      timestamp: now() - ms(168) + 1000,
      tokenCount: 42,
    },
  ],
  "conv-2": [
    {
      id: "msg-3",
      conversationId: "conv-2",
      role: "user",
      content: "Can you review this React component?",
      timestamp: now() - ms(72),
    },
    {
      id: "msg-4",
      conversationId: "conv-2",
      role: "assistant",
      content:
        "Sure! Please share the component code and I'll review it for patterns, performance, and best practices.",
      model: "claude-sonnet-4-20250514",
      timestamp: now() - ms(72) + 2000,
      tokenCount: 28,
    },
  ],
  "conv-3": [
    {
      id: "msg-5",
      conversationId: "conv-3",
      role: "user",
      content: "I'm getting a 401 error from the API",
      timestamp: now() - ms(1),
    },
    {
      id: "msg-6",
      conversationId: "conv-3",
      role: "assistant",
      content:
        "A 401 error means unauthorized. Let's check: 1) Is your API key valid? 2) Has it expired? 3) Are you sending it in the correct header? Try regenerating your key and ensure it's set in the Authorization header as `Bearer <key>`.",
      model: "gpt-4o",
      timestamp: now() - ms(1) + 1500,
      tokenCount: 55,
    },
  ],
};

const SEED_API_KEYS: string[] = ["openai_api_key", "anthropic_api_key"];

const SEED_PROVIDERS: LlmProvider[] = [
  {
    value: "openai",
    label: "OpenAI",
    apiKeyName: "openai_api_key",
    defaultModel: "gpt-5.4",
    models: [
      { id: "gpt-5.4", name: "GPT-5.4" },
      { id: "gpt-5.4-mini", name: "GPT-5.4 Mini" },
      { id: "gpt-5", name: "GPT-5" },
    ],
  },
  {
    value: "anthropic",
    label: "Anthropic",
    apiKeyName: "anthropic_api_key",
    defaultModel: "claude-sonnet-4-6",
    models: [
      { id: "claude-sonnet-4-6", name: "Claude Sonnet 4.6" },
      { id: "claude-haiku-4-5", name: "Claude Haiku 4.5" },
    ],
  },
  {
    value: "gemini",
    label: "Gemini",
    apiKeyName: "gemini_api_key",
    defaultModel: "gemini-3.5-flash",
    models: [
      { id: "gemini-3.5-flash", name: "Gemini 3.5 Flash" },
      { id: "gemini-3.1-pro", name: "Gemini 3.1 Pro" },
    ],
  },
];

export const STREAM_RESPONSES = [
  "I'll help you with that! ",
  "Let me think through this step by step. ",
  "First, we need to understand the core problem you're trying to solve. ",
  "Based on the information provided, here's my analysis:\n\n",
  "1. **Identify the requirements** — what does success look like?\n",
  "2. **Evaluate the options** — compare trade-offs carefully.\n",
  "3. **Choose the best approach** — prioritize simplicity and maintainability.\n\n",
  "Would you like me to elaborate on any of these points?",
];

let conversations: ConversationRow[] = [...SEED_CONVERSATIONS];
let messages: Record<string, MessageRow[]> = {};
for (const [convId, msgs] of Object.entries(SEED_MESSAGES)) {
  messages[convId] = [...msgs];
}
let apiKeys: Set<string> = new Set(SEED_API_KEYS);

// ---------------------------------------------------------------------------
// Public store API
// ---------------------------------------------------------------------------

export function getConversations(): ConversationRow[] {
  return conversations;
}

export function setConversations(list: ConversationRow[]): void {
  conversations = list;
}

export function getMessages(convId: string): MessageRow[] {
  return messages[convId] ?? [];
}

export function setMessages(convId: string, msgs: MessageRow[]): void {
  messages[convId] = msgs;
}

export function deleteMessages(convId: string): void {
  delete messages[convId];
}

export function getApiKeys(): string[] {
  return Array.from(apiKeys);
}

export function addApiKey(keyName: string): void {
  apiKeys.add(keyName);
}

export function hasApiKey(keyName: string): boolean {
  return apiKeys.has(keyName);
}

export function getAppConfig(): AppConfig {
  return {
    llm: {
      defaultProvider: "openai",
      providers: SEED_PROVIDERS,
    },
  };
}

// ---------------------------------------------------------------------------
// ID generation
// ---------------------------------------------------------------------------

export function newConversationId(): string {
  return id("conv");
}

export function newMessageId(): string {
  return id("msg");
}
