use crate::db::{
    conversation as db,
    types::{ConversationRow, MessageRow, SavePairPayload},
};
use rusqlite::Connection;
use std::sync::Mutex;
use tauri::State;

/// Returns all conversation metadata rows (no messages) for sidebar
#[tauri::command]
pub fn db_list_conversations(
    conn: State<'_, Mutex<Connection>>,
) -> Result<Vec<ConversationRow>, String> {
    let guard = conn.lock().map_err(|e| format!("DB lock poisoned: {e}"))?;
    db::list_conversations(&guard)
}

/// Returns all messages for `conv_id` ordered by timestamp ascending.
#[tauri::command]
pub fn db_get_messages(
    conv_id: String,
    conn: State<'_, Mutex<Connection>>,
) -> Result<Vec<MessageRow>, String> {
    let guard = conn.lock().map_err(|e| format!("DB lock poisoned: {e}"))?;
    db::get_messages(&guard, &conv_id)
}

/// Persists a complete user→assistant exchange atomically.
#[tauri::command]
pub fn db_save_pair(
    payload: SavePairPayload,
    conn: State<'_, Mutex<Connection>>,
) -> Result<(), String> {
    let guard = conn.lock().map_err(|e| format!("DB lock poisoned: {e}"))?;
    db::save_pair(
        &guard,
        &payload.conversation,
        &payload.user_message,
        &payload.assistant_message,
    )
}

/// Permanently deletes a conversation and all its messages.
#[tauri::command]
pub fn db_delete_conversation(
    conv_id: String,
    conn: State<'_, Mutex<Connection>>,
) -> Result<(), String> {
    let guard = conn.lock().map_err(|e| format!("DB lock poisoned: {e}"))?;
    db::delete_conversation(&guard, &conv_id)
}

/// Flips the pinned flag for a conversation.
#[tauri::command]
pub fn db_toggle_pin(conv_id: String, conn: State<'_, Mutex<Connection>>) -> Result<(), String> {
    let guard = conn.lock().map_err(|e| format!("DB lock poisoned: {e}"))?;
    db::toggle_pin(&guard, &conv_id)
}

/// Renames a conversation.
#[tauri::command]
pub fn db_rename_conversation(
    conv_id: String,
    title: String,
    conn: State<'_, Mutex<Connection>>,
) -> Result<(), String> {
    let guard = conn.lock().map_err(|e| format!("DB lock poisoned: {e}"))?;
    db::rename_conversation(&guard, &conv_id, &title)
}

/// Deletes all messages for a conversation while keeping the conversation row.
#[tauri::command]
pub fn db_clear_messages(
    conv_id: String,
    conn: State<'_, Mutex<Connection>>,
) -> Result<(), String> {
    let guard = conn.lock().map_err(|e| format!("DB lock poisoned: {e}"))?;
    db::clear_messages(&guard, &conv_id)
}
