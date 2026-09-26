CREATE TABLE IF NOT EXISTS mayor_sessions (
    session_hash TEXT PRIMARY KEY,
    created_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_mayor_sessions_expiry
    ON mayor_sessions(expires_at);

CREATE TABLE IF NOT EXISTS mayor_message (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    title TEXT NOT NULL DEFAULT 'Messaggio per il sindaco',
    body TEXT NOT NULL DEFAULT '',
    updated_at INTEGER NOT NULL
);
