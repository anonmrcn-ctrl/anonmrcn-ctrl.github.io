CREATE TABLE IF NOT EXISTS cms_documents (
    id TEXT PRIMARY KEY CHECK (length(id) = 36),
    title TEXT NOT NULL CHECK (length(title) BETWEEN 1 AND 200),
    description TEXT NOT NULL CHECK (length(description) BETWEEN 1 AND 2000),
    accessibility_status TEXT NOT NULL DEFAULT 'unchecked'
        CHECK (accessibility_status IN ('unchecked', 'reviewed')),
    accessibility_note TEXT NOT NULL DEFAULT ''
        CHECK (length(accessibility_note) <= 2000),
    media_type TEXT NOT NULL CHECK (length(media_type) BETWEEN 1 AND 120),
    media_name TEXT NOT NULL CHECK (length(media_name) BETWEEN 1 AND 500),
    byte_size INTEGER NOT NULL CHECK (byte_size > 0),
    checksum TEXT NOT NULL CHECK (length(checksum) = 64),
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_cms_documents_updated
    ON cms_documents(updated_at DESC, id);
