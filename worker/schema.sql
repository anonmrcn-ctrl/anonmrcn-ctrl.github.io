PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS locations (
    id INTEGER PRIMARY KEY,
    address TEXT NOT NULL UNIQUE,
    username TEXT NOT NULL DEFAULT '',
    lat REAL NOT NULL,
    lon REAL NOT NULL,
    is_visible INTEGER NOT NULL DEFAULT 1
        CHECK (is_visible IN (0, 1)),
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
    sender_public_consent INTEGER NOT NULL DEFAULT 0
        CHECK (sender_public_consent IN (0, 1)),
    recipient_public_consent INTEGER NOT NULL DEFAULT 0
        CHECK (recipient_public_consent IN (0, 1)),
    is_public INTEGER NOT NULL DEFAULT 0
        CHECK (is_public IN (0, 1)),
    published_at INTEGER,
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

CREATE INDEX IF NOT EXISTS idx_messages_public_archive
    ON messages(is_public, published_at, id);

CREATE TABLE IF NOT EXISTS contact_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL DEFAULT '',
    email TEXT NOT NULL DEFAULT '',
    text TEXT NOT NULL
        CHECK (length(text) BETWEEN 1 AND 1500),
    status TEXT NOT NULL DEFAULT 'unread'
        CHECK (status IN ('unread', 'read')),
    sender_hash TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_contact_messages_sender_rate
    ON contact_messages(sender_hash, created_at);

CREATE INDEX IF NOT EXISTS idx_contact_messages_admin
    ON contact_messages(status, created_at);

CREATE TABLE IF NOT EXISTS push_keys (
    id TEXT PRIMARY KEY,
    public_key TEXT NOT NULL,
    encrypted_private_key TEXT NOT NULL,
    created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS push_subscriptions (
    id TEXT PRIMARY KEY,
    audience TEXT NOT NULL
        CHECK (audience IN ('admin', 'location')),
    location_id INTEGER,
    endpoint TEXT NOT NULL,
    p256dh TEXT NOT NULL,
    auth TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    CHECK (
        (audience = 'admin' AND location_id IS NULL) OR
        (audience = 'location' AND location_id IS NOT NULL)
    ),
    FOREIGN KEY (location_id)
        REFERENCES locations(id)
        ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_audience
    ON push_subscriptions(audience, location_id);
