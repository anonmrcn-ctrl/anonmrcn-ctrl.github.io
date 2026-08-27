CREATE TABLE IF NOT EXISTS memories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL
        CHECK (length(title) BETWEEN 3 AND 100),
    author_name TEXT NOT NULL DEFAULT ''
        CHECK (length(author_name) <= 80),
    text TEXT NOT NULL
        CHECK (length(text) BETWEEN 1 AND 3000),
    lat REAL NOT NULL
        CHECK (lat BETWEEN -90 AND 90),
    lon REAL NOT NULL
        CHECK (lon BETWEEN -180 AND 180),
    media_type TEXT NOT NULL DEFAULT '',
    media_name TEXT NOT NULL DEFAULT '',
    media_data TEXT,
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'approved', 'rejected')),
    consent INTEGER NOT NULL
        CHECK (consent = 1),
    withdrawal_hash TEXT NOT NULL UNIQUE,
    sender_hash TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    published_at INTEGER
);

CREATE INDEX IF NOT EXISTS idx_memories_public
    ON memories(status, published_at, id);

CREATE INDEX IF NOT EXISTS idx_memories_sender_rate
    ON memories(sender_hash, created_at);
