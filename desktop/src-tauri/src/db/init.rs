use rusqlite::Connection;
use tauri::Manager;

/// Opens (or creates) `pinac.db` in the app data directory and runs all
/// schema migrations. Returns a ready-to-use `Connection`.
pub fn init_db(app: &tauri::AppHandle) -> Result<Connection, String> {
    let data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to resolve app data dir: {e}"))?;

    // Ensure the directory exists before opening the database file.
    std::fs::create_dir_all(&data_dir)
        .map_err(|e| format!("Failed to create app data dir: {e}"))?;

    let db_path = data_dir.join("pinac.db");
    let conn = Connection::open(&db_path)
        .map_err(|e| format!("Failed to open database at {}: {e}", db_path.display()))?;

    // Enable WAL mode for better concurrent read performance and crash safety.
    conn.execute_batch("PRAGMA journal_mode=WAL;")
        .map_err(|e| format!("Failed to set WAL mode: {e}"))?;

    // Enforce foreign-key constraints — SQLite disables them by default.
    conn.execute_batch("PRAGMA foreign_keys=ON;")
        .map_err(|e| format!("Failed to enable foreign keys: {e}"))?;

    run_migrations(&conn)?;

    Ok(conn)
}

/// Applies all DDL migrations idempotently.
///
/// New migrations must be appended here. Existing statements must never be
/// altered — add a new statement instead to preserve forward compatibility.
fn run_migrations(conn: &Connection) -> Result<(), String> {
    conn.execute_batch(
        "
        CREATE TABLE IF NOT EXISTS conversations (
            id         TEXT PRIMARY KEY,
            title      TEXT NOT NULL,
            model      TEXT NOT NULL,
            pinned     INTEGER NOT NULL DEFAULT 0,
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL
        );

        CREATE TABLE IF NOT EXISTS messages (
            id              TEXT PRIMARY KEY,
            conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
            role            TEXT NOT NULL CHECK(role IN ('user', 'assistant')),
            content         TEXT NOT NULL,
            model           TEXT,
            token_count     INTEGER,
            timestamp       INTEGER NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_messages_conv
            ON messages(conversation_id);

        CREATE INDEX IF NOT EXISTS idx_conversations_updated
            ON conversations(updated_at DESC);
        ",
    )
    .map_err(|e| format!("Schema migration failed: {e}"))?;

    // Migration 1: add thinking_content column for storing LLM reasoning text.
    let has_thinking: bool = conn
        .prepare(
            "SELECT COUNT(*) FROM pragma_table_info('messages') WHERE name = 'thinking_content'",
        )
        .and_then(|mut s| s.query_row([], |r| r.get::<_, i64>(0)))
        .map(|c| c > 0)
        .unwrap_or(false);

    if !has_thinking {
        conn.execute_batch(
            "ALTER TABLE messages ADD COLUMN thinking_content TEXT NOT NULL DEFAULT '';",
        )
        .map_err(|e| format!("Migration 1 (add thinking_content) failed: {e}"))?;
    }

    Ok(())
}
