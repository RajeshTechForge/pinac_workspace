use crate::db::types::{ConversationRow, MessageRow};
use rusqlite::{Connection, params};

// ---------------------------------------------------------------------------
// Conversations
// ---------------------------------------------------------------------------

pub fn list_conversations(conn: &Connection) -> Result<Vec<ConversationRow>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT id, title, model, pinned, created_at, updated_at
             FROM conversations
             ORDER BY pinned DESC, updated_at DESC",
        )
        .map_err(|e| format!("Failed to prepare list_conversations: {e}"))?;

    let rows = stmt
        .query_map([], |row| {
            Ok(ConversationRow {
                id: row.get(0)?,
                title: row.get(1)?,
                model: row.get(2)?,
                pinned: row.get::<_, i32>(3)? != 0, // SQLite stores booleans as integers
                created_at: row.get(4)?,
                updated_at: row.get(5)?,
            })
        })
        .map_err(|e| format!("Failed to execute list_conversations: {e}"))?;

    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|e| format!("Failed to collect conversation rows: {e}"))
}

pub fn get_messages(conn: &Connection, conv_id: &str) -> Result<Vec<MessageRow>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT id, conversation_id, role, content, thinking_content, model, token_count, timestamp
             FROM messages
             WHERE conversation_id = ?1
             ORDER BY timestamp ASC",
        )
        .map_err(|e| format!("Failed to prepare get_messages: {e}"))?;

    let rows = stmt
        .query_map(params![conv_id], |row| {
            Ok(MessageRow {
                id: row.get(0)?,
                conversation_id: row.get(1)?,
                role: row.get(2)?,
                content: row.get(3)?,
                thinking_content: row.get(4)?,
                model: row.get(5)?,
                token_count: row.get(6)?,
                timestamp: row.get(7)?,
            })
        })
        .map_err(|e| format!("Failed to execute get_messages: {e}"))?;

    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|e| format!("Failed to collect message rows: {e}"))
}

pub fn save_pair(
    conn: &Connection,
    conversation: &ConversationRow,
    user_msg: &MessageRow,
    assistant_msg: &MessageRow,
) -> Result<(), String> {
    conn.execute(
        "INSERT INTO conversations (id, title, model, pinned, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)
         ON CONFLICT(id) DO UPDATE SET
             title      = excluded.title,
             model      = excluded.model,
             updated_at = excluded.updated_at",
        params![
            conversation.id,
            conversation.title,
            conversation.model,
            conversation.pinned as i32,
            conversation.created_at,
            conversation.updated_at,
        ],
    )
    .map_err(|e| format!("Failed to upsert conversation: {e}"))?;

    insert_message(conn, user_msg)?;
    insert_message(conn, assistant_msg)?;

    Ok(())
}

/// Inserts a single message row, ignoring duplicates (idempotent).
fn insert_message(conn: &Connection, msg: &MessageRow) -> Result<(), String> {
    conn.execute(
        "INSERT OR IGNORE INTO messages
             (id, conversation_id, role, content, thinking_content, model, token_count, timestamp)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
        params![
            msg.id,
            msg.conversation_id,
            msg.role,
            msg.content,
            msg.thinking_content,
            msg.model,
            msg.token_count,
            msg.timestamp,
        ],
    )
    .map_err(|e| format!("Failed to insert message '{}': {e}", msg.id))?;

    Ok(())
}

// ---------------------------------------------------------------------------
// Mutation helpers
// ---------------------------------------------------------------------------

pub fn delete_conversation(conn: &Connection, conv_id: &str) -> Result<(), String> {
    conn.execute("DELETE FROM conversations WHERE id = ?1", params![conv_id])
        .map_err(|e| format!("Failed to delete conversation '{conv_id}': {e}"))?;
    Ok(())
}

pub fn toggle_pin(conn: &Connection, conv_id: &str) -> Result<(), String> {
    conn.execute(
        "UPDATE conversations SET pinned = NOT pinned WHERE id = ?1",
        params![conv_id],
    )
    .map_err(|e| format!("Failed to toggle pin for '{conv_id}': {e}"))?;
    Ok(())
}

pub fn rename_conversation(conn: &Connection, conv_id: &str, title: &str) -> Result<(), String> {
    conn.execute(
        "UPDATE conversations SET title = ?1 WHERE id = ?2",
        params![title, conv_id],
    )
    .map_err(|e| format!("Failed to rename conversation '{conv_id}': {e}"))?;
    Ok(())
}

pub fn clear_messages(conn: &Connection, conv_id: &str) -> Result<(), String> {
    conn.execute(
        "DELETE FROM messages WHERE conversation_id = ?1",
        params![conv_id],
    )
    .map_err(|e| format!("Failed to clear messages for '{conv_id}': {e}"))?;
    Ok(())
}
