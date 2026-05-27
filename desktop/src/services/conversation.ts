import { invoke } from "@tauri-apps/api/core";
import type { ConversationMeta, Message } from "../types";

// ---------------------------------------------------------------------------
// Wire types — match the Rust `ConversationRow` / `MessageRow` serde shape.
// ---------------------------------------------------------------------------

type ConversationRow = {
  id: string;
  title: string;
  model: string;
  pinned: boolean;
  createdAt: number;
  updatedAt: number;
};

type MessageRow = {
  id: string;
  conversationId: string;
  role: "user" | "assistant";
  content: string;
  model?: string;
  tokenCount?: number;
  timestamp: number;
};

type SavePairPayload = {
  conversation: ConversationRow;
  userMessage: MessageRow;
  assistantMessage: MessageRow;
};

// ---------------------------------------------------------------------------
// Mapping helpers
// ---------------------------------------------------------------------------

function rowToMeta(row: ConversationRow): ConversationMeta {
  return {
    id: row.id,
    title: row.title,
    model: row.model,
    pinned: row.pinned,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function rowToMessage(row: MessageRow): Message {
  return {
    id: row.id,
    conversationId: row.conversationId,
    role: row.role,
    content: row.content,
    model: row.model,
    tokenCount: row.tokenCount,
    timestamp: row.timestamp,
  };
}

// ---------------------------------------------------------------------------
// Service functions
// ---------------------------------------------------------------------------

// Derives a conversation title from the first user message.
export function deriveTitle(firstUserMessage: string, maxChars = 60): string {
  const trimmed = firstUserMessage.trim();
  if (trimmed.length <= maxChars) return trimmed;

  const candidate = trimmed.slice(0, maxChars);
  const lastSpace = candidate.lastIndexOf(" ");
  return lastSpace > 0 ? candidate.slice(0, lastSpace) : candidate;
}

// Loads all conversation metadata rows from SQLite in order
export async function listConversations(): Promise<ConversationMeta[]> {
  const rows = await invoke<ConversationRow[]>("db_list_conversations");
  return rows.map(rowToMeta);
}


export async function getMessages(convId: string): Promise<Message[]> {
  const rows = await invoke<MessageRow[]>("db_get_messages", { convId });
  return rows.map(rowToMessage);
}

export async function savePair(
  meta: ConversationMeta,
  userMsg: Message,
  assistantMsg: Message,
): Promise<void> {
  const payload: SavePairPayload = {
    conversation: {
      id: meta.id,
      title: meta.title,
      model: meta.model,
      pinned: meta.pinned,
      createdAt: meta.createdAt,
      updatedAt: meta.updatedAt,
    },
    userMessage: {
      id: userMsg.id,
      conversationId: userMsg.conversationId,
      role: userMsg.role,
      content: userMsg.content,
      model: userMsg.model,
      tokenCount: userMsg.tokenCount,
      timestamp: userMsg.timestamp,
    },
    assistantMessage: {
      id: assistantMsg.id,
      conversationId: assistantMsg.conversationId,
      role: assistantMsg.role,
      content: assistantMsg.content,
      model: assistantMsg.model,
      tokenCount: assistantMsg.tokenCount,
      timestamp: assistantMsg.timestamp,
    },
  };
  await invoke<void>("db_save_pair", { payload });
}

export async function deleteConversation(convId: string): Promise<void> {
  await invoke<void>("db_delete_conversation", { convId });
}

export async function togglePin(convId: string): Promise<void> {
  await invoke<void>("db_toggle_pin", { convId });
}

export async function renameConversation(
  convId: string,
  title: string,
): Promise<void> {
  await invoke<void>("db_rename_conversation", { convId, title });
}

export async function clearMessages(convId: string): Promise<void> {
  await invoke<void>("db_clear_messages", { convId });
}
