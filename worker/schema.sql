PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS locations (
    id INTEGER PRIMARY KEY,
    address TEXT NOT NULL UNIQUE,
    lat REAL NOT NULL,
    lon REAL NOT NULL,
    password_lookup TEXT NOT NULL UNIQUE,
    password_salt TEXT NOT NULL,
    password_hash TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS poems (
    location_id INTEGER PRIMARY KEY,
    html TEXT NOT NULL,
    FOREIGN KEY (location_id)
        REFERENCES locations(id)
        ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS sessions (
    session_hash TEXT PRIMARY KEY,
    location_id INTEGER NOT NULL,
    created_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL,
    FOREIGN KEY (location_id)
        REFERENCES locations(id)
        ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sender_location_id INTEGER NOT NULL,
    recipient_location_id INTEGER NOT NULL,
    text TEXT NOT NULL,
    reveal_sender INTEGER NOT NULL DEFAULT 0
        CHECK (reveal_sender IN (0, 1)),
    delivery_type TEXT NOT NULL
        CHECK (delivery_type IN ('online', 'physical')),
    status TEXT NOT NULL
        CHECK (
            status IN (
                'pending',
                'pending_delivery',
                'approved',
                'read',
                'delivered',
                'rejected'
            )
        ),
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY (sender_location_id)
        REFERENCES locations(id),
    FOREIGN KEY (recipient_location_id)
        REFERENCES locations(id),
    CHECK (sender_location_id <> recipient_location_id),
    CHECK (length(text) BETWEEN 1 AND 1500)
);

CREATE INDEX IF NOT EXISTS idx_sessions_expiry
    ON sessions(expires_at);

CREATE INDEX IF NOT EXISTS idx_messages_recipient
    ON messages(recipient_location_id, delivery_type, status, created_at);

CREATE INDEX IF NOT EXISTS idx_messages_sender_rate
    ON messages(sender_location_id, created_at);

CREATE INDEX IF NOT EXISTS idx_messages_admin
    ON messages(status, created_at);
