ALTER TABLE messages
    ADD COLUMN sender_public_consent INTEGER NOT NULL DEFAULT 0
    CHECK (sender_public_consent IN (0, 1));

ALTER TABLE messages
    ADD COLUMN recipient_public_consent INTEGER NOT NULL DEFAULT 0
    CHECK (recipient_public_consent IN (0, 1));

ALTER TABLE messages
    ADD COLUMN is_public INTEGER NOT NULL DEFAULT 0
    CHECK (is_public IN (0, 1));

ALTER TABLE messages
    ADD COLUMN published_at INTEGER;

CREATE INDEX IF NOT EXISTS idx_messages_public_archive
    ON messages(is_public, published_at, id);
