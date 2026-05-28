import {
  getConversations,
  setConversations,
  getMessages,
  setMessages,
  deleteMessages,
  addApiKey,
  hasApiKey,
  getAppConfig,
  emit,
  STREAM_RESPONSES,
  type ConversationRow,
  type MessageRow,
} from "./store";

type InvokeArgs = Record<string, unknown>;

// ---------------------------------------------------------------------------
// Command handlers
// ---------------------------------------------------------------------------

const COMMANDS: Record<
  string,
  (args: InvokeArgs) => unknown | Promise<unknown>
> = {
  save_api_key(args: InvokeArgs): void {
    addApiKey(args["keyName"] as string);
  },

  api_key_exists(args: InvokeArgs): boolean {
    return hasApiKey(args["keyName"] as string);
  },

  db_list_conversations(): ConversationRow[] {
    return getConversations();
  },

  db_get_messages(args: InvokeArgs): MessageRow[] {
    return getMessages(args["convId"] as string);
  },

  db_save_pair(args: InvokeArgs): void {
    const payload = args["payload"] as {
      conversation: ConversationRow;
      userMessage: MessageRow;
      assistantMessage: MessageRow;
    };

    const existing = getConversations();
    const idx = existing.findIndex((c) => c.id === payload.conversation.id);

    if (idx >= 0) {
      const updated = [...existing];
      updated[idx] = {
        ...updated[idx],
        title: payload.conversation.title,
        model: payload.conversation.model,
        pinned: payload.conversation.pinned,
        updatedAt: payload.conversation.updatedAt,
      };
      setConversations(updated);
    } else {
      setConversations([payload.conversation, ...existing]);
    }

    const convMessages = getMessages(payload.conversation.id);
    setMessages(payload.conversation.id, [
      ...convMessages,
      payload.userMessage,
      payload.assistantMessage,
    ]);
  },

  db_delete_conversation(args: InvokeArgs): void {
    const convId = args["convId"] as string;
    setConversations(getConversations().filter((c) => c.id !== convId));
    deleteMessages(convId);
  },

  db_toggle_pin(args: InvokeArgs): void {
    const convId = args["convId"] as string;
    setConversations(
      getConversations().map((c) =>
        c.id === convId ? { ...c, pinned: !c.pinned } : c,
      ),
    );
  },

  db_rename_conversation(args: InvokeArgs): void {
    const convId = args["convId"] as string;
    const title = args["title"] as string;
    setConversations(
      getConversations().map((c) =>
        c.id === convId ? { ...c, title, updatedAt: Date.now() } : c,
      ),
    );
  },

  db_clear_messages(args: InvokeArgs): void {
    const convId = args["convId"] as string;
    deleteMessages(convId);
  },

  read_config(): unknown {
    return getAppConfig();
  },

  llm_chat_stream(args: InvokeArgs): Promise<void> {
    const messagesArg = args["messages"] as Array<{
      role: string;
      content: string;
    }>;
    const userMessages = messagesArg.filter((m) => m.role === "user");
    const lastUserMessage =
      userMessages.length > 0
        ? userMessages[userMessages.length - 1]!.content
        : "";

    const triggerWords = [
      "hello",
      "hi",
      "hey",
      "help",
      "what",
      "how",
      "why",
      "code",
      "debug",
      "write",
      "explain",
      "review",
      "refactor",
    ];
    const matched = triggerWords.some((w) =>
      lastUserMessage.toLowerCase().includes(w),
    );
    const chunks = matched
      ? STREAM_RESPONSES
      : [
          `I received your message: "${lastUserMessage.slice(0, 80)}". `,
          "Let me work on that for you. ",
          "Here's what I've come up with...\n\n",
          "This is a simulated response from the mock layer. ",
          "In production, this would come from the actual LLM provider. ",
          "Feel free to continue the conversation to test the UI flow.",
        ];

    let index = 0;

    function sendNext(): void {
      if (index >= chunks.length) {
        emit("llm-stream-chunk", { delta: "", is_final: true });
        return;
      }

      const delta = chunks[index]!;
      index++;
      emit("llm-stream-chunk", { delta, is_final: false });

      const delay = delta.length > 30 ? 40 : 20;
      setTimeout(sendNext, delay);
    }

    setTimeout(sendNext, 100);

    return Promise.resolve();
  },
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function invoke<T>(cmd: string, args?: InvokeArgs): Promise<T> {
  const handler = COMMANDS[cmd];

  if (!handler) {
    throw new Error(
      `[mock invoke] Unknown command "${cmd}". No mock handler registered.`,
    );
  }

  try {
    const result = await Promise.resolve(handler(args ?? {}));
    return result as T;
  } catch (err: unknown) {
    throw new Error(
      `[mock invoke] Command "${cmd}" failed: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}
