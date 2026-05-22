import { createContext, useContext, useEffect, useReducer, type ReactNode } from "react";
import type { ChatState, ChatAction, Conversation } from "../types";
import { readAppConfig } from "../services/config";

const STORAGE_KEY_SIDEBAR_WIDTH = "pinac-sidebar-width";

function createInitialState(): ChatState {
  const now = Date.now();
  const day = 86_400_000;

  const demoConvs: Conversation[] = [
    {
      id: "conv-1",
      title: "Refactoring the auth module",
      messages: [
        {
          id: "m1",
          conversationId: "conv-1",
          role: "user",
          content: "Can you help me refactor the authentication module? We use JWT tokens with refresh flow.",
          timestamp: now - day * 2 + 1000,
        },
        {
          id: "m2",
          conversationId: "conv-1",
          role: "assistant",
          content:
            "I'd be glad to help. Let me outline a clean approach:\n\n1. Split concerns into separate files — token storage, API client, auth context, and hooks\n2. Use an interceptor pattern to automatically refresh expired tokens\n3. Store the refresh token in an httpOnly cookie, access token in memory\n\nHere's a basic structure:\n\n```typescript\n// auth/token-manager.ts\nlet accessToken: string | null = null;\nlet refreshPromise: Promise<string> | null = null;\n\nexport function setToken(token: string) {\n  accessToken = token;\n}\n\nexport async function getValidToken(): Promise<string> {\n  if (accessToken && !isExpired(accessToken)) return accessToken;\n  if (!refreshPromise) {\n    refreshPromise = refreshAccessToken().then((t) => {\n      accessToken = t;\n      refreshPromise = null;\n      return t;\n    });\n  }\n  return refreshPromise;\n}\n```\n\nThe key insight is deduplicating concurrent refresh calls — if multiple requests fail at once, only one refresh happens and all wait on the same promise.",
          model: "claude-sonnet-4-5",
          tokenCount: 312,
          timestamp: now - day * 2 + 5000,
        },
        {
          id: "m3",
          conversationId: "conv-1",
          role: "user",
          content: "What about error handling when the refresh itself fails?",
          timestamp: now - day * 2 + 8000,
        },
        {
          id: "m4",
          conversationId: "conv-1",
          role: "assistant",
          content:
            "Great question. When refresh fails, you need to:\n\n1. Clear all stored tokens\n2. Redirect to login\n3. Optionally store the current route so you can redirect back after re-auth\n\nI like to use a custom `AuthError` class and let the interceptor catch 401s specifically:\n\n```typescript\nclass AuthError extends Error {\n  constructor(public reason: \"expired\" | \"invalid\" | \"refresh_failed\") {\n    super(`Authentication error: ${reason}`);\n  }\n}\n\nasync function handleRefreshFailure() {\n  clearTokens();\n  window.dispatchEvent(new CustomEvent(\"auth:logout\"));\n  throw new AuthError(\"refresh_failed\");\n}\n```\n\nThe event-based approach keeps your auth logic decoupled from the router — any part of the app can listen for `auth:logout` and react appropriately.",
          model: "claude-sonnet-4-5",
          tokenCount: 278,
          timestamp: now - day * 2 + 12000,
        },
      ],
      model: "claude-sonnet-4-5",
      createdAt: now - day * 2,
      updatedAt: now - day * 2 + 12000,
      pinned: true,
    },
    {
      id: "conv-2",
      title: "Optimizing Postgres queries",
      messages: [
        {
          id: "m5",
          conversationId: "conv-2",
          role: "user",
          content: "Our analytics dashboard query takes 12 seconds. Any ideas?",
          timestamp: now - day * 5 + 2000,
        },
        {
          id: "m6",
          conversationId: "conv-2",
          role: "assistant",
          content:
            "12 seconds is a lot. Let's diagnose:\n\n1. **Run `EXPLAIN ANALYZE`** — look for sequential scans on large tables\n2. **Check missing indexes** — columns used in WHERE, JOIN, and ORDER BY are prime candidates\n3. **Look at the JOIN order** — Postgres's planner is good but sometimes you need to restructure the query\n\nMost common culprit: filtering on `date_trunc('month', created_at)` which is not sargable. Instead use a range:\n\n```sql\n-- Slow (no index can be used)\nWHERE date_trunc('month', created_at) = '2025-01-01'::timestamp\n\n-- Fast (uses index on created_at)\nWHERE created_at >= '2025-01-01'::timestamp\n  AND created_at <  '2025-02-01'::timestamp\n```\n\nCan you share the query and table sizes?",
          model: "claude-opus-4",
          tokenCount: 342,
          timestamp: now - day * 5 + 6000,
        },
        {
          id: "m7",
          conversationId: "conv-2",
          role: "user",
          content: "We have about 5M rows. The query joins 4 tables. I'll check the date_trunc pattern, I think we're doing that in two places.",
          timestamp: now - day * 5 + 10000,
        },
        {
          id: "m8",
          conversationId: "conv-2",
          role: "assistant",
          content:
            "5M rows with 4 joins — definitely worth tuning.\n\nAlso consider **partial indexes** for frequently-queried subsets. If 80% of dashboard queries filter by `status = 'active'`, create:\n\n```sql\nCREATE INDEX idx_orders_active_created\nON orders (created_at)\nWHERE status = 'active';\n```\n\nThis index will be much smaller and faster to scan.\n\nAnd if you're computing aggregates (COUNT, SUM) over large time windows, a **materialized view** refreshed periodically might be the right call. The dashboard shows \"near real-time\" data, users won't notice a 5-minute lag.",
          model: "claude-opus-4",
          tokenCount: 298,
          timestamp: now - day * 5 + 15000,
        },
      ],
      model: "claude-opus-4",
      createdAt: now - day * 5,
      updatedAt: now - day * 5 + 15000,
      pinned: false,
    },
    {
      id: "conv-3",
      title: "React Server Components deep dive",
      messages: [
        {
          id: "m9",
          conversationId: "conv-3",
          role: "user",
          content: "I'm trying to understand when to use RSCs vs client components. Can you break it down?",
          timestamp: now - day * 12 + 3000,
        },
        {
          id: "m10",
          conversationId: "conv-3",
          role: "assistant",
          content:
            "Here's a mental model I use:\n\n**Server Components** — for anything that doesn't need interactivity:\n- Data fetching (direct DB/API calls)\n- Rendering static content\n- Components that depend on backend logic (auth checks, permissions)\n\n**Client Components** — for anything with interactivity:\n- useState, useEffect, event handlers\n- Browser-only APIs\n- Context providers\n\n```tsx\n// This is a Server Component (no 'use client' directive)\nexport default async function Page() {\n  const posts = await db.posts.findMany();\n  return (\n    <ul>\n      {posts.map((post) => (\n        <PostCard key={post.id} post={post} />\n      ))}\n    </ul>\n  );\n}\n```\n\nThe trick is to push client boundaries as deep as possible. A page can be a server component that renders a few small client component islands.",
          model: "claude-sonnet-4-5",
          tokenCount: 284,
          timestamp: now - day * 12 + 7000,
        },
        {
          id: "m11",
          conversationId: "conv-3",
          role: "user",
          content: "What about error boundaries in RSC? I heard they don't support error boundaries.",
          timestamp: now - day * 12 + 11000,
        },
        {
          id: "m12",
          conversationId: "conv-3",
          role: "assistant",
          content:
            "That's partly true. Server Components can't use class-based error boundaries directly. Instead, React 19 introduced **error boundaries at the Suspense boundary level**.\n\nWrap your RSC in a client component `<Boundary>` that catches errors:\n\n```tsx\n'use client';\n\nimport { ErrorBoundary } from 'react-error-boundary';\n\nexport function AsyncBoundary({ children }: { children: React.ReactNode }) {\n  return (\n    <ErrorBoundary\n      fallback={({ error }) => (\n        <div>Something went wrong: {error.message}</div>\n      )}\n    >\n      <Suspense fallback={<Loading />}>\n        {children}\n      </Suspense>\n    </ErrorBoundary>\n  );\n}\n```\n\nAlso, RSC errors during rendering are caught by the framework — Next.js shows an error page by default. For fine-grained control, you can use `error.js` files (Next) or wrap at the route segment level.",
          model: "claude-sonnet-4-5",
          tokenCount: 312,
          timestamp: now - day * 12 + 16000,
        },
      ],
      model: "claude-sonnet-4-5",
      createdAt: now - day * 12,
      updatedAt: now - day * 12 + 16000,
      pinned: false,
    },
  ];

  const savedWidth = typeof window !== "undefined" ? Number(localStorage.getItem(STORAGE_KEY_SIDEBAR_WIDTH)) : 280;

  return {
    conversations: demoConvs,
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
      defaultModel: "claude-sonnet-4-5",
      displayName: "User",
      email: "user@example.com",
      apiKey: "",
      temperature: 0.7,
      maxTokens: 2048,
      provider: "anthropic",
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
      const filtered = state.conversations.filter((c) => c.id !== action.payload);
      return {
        ...state,
        conversations: filtered,
        activeConversationId:
          state.activeConversationId === action.payload
            ? filtered[0]?.id ?? null
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
          c.id === action.payload.id ? { ...c, title: action.payload.title } : c,
        ),
      };

    case "ADD_MESSAGE":
      return {
        ...state,
        conversations: state.conversations.map((c) =>
          c.id === action.payload.conversationId
            ? { ...c, messages: [...c.messages, action.payload], updatedAt: Date.now() }
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
                  m.id === messageId ? { ...m, content: state.streamingText, tokenCount: Math.round(state.streamingText.split(" ").length * 1.3) } : m,
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

    case "SET_PROVIDERS":
      return { ...state, providers: action.payload };

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
    async function loadConfig() {
      try {
        const config = await readAppConfig();
        dispatch({ type: "SET_PROVIDERS", payload: config.llm.providers });
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
