PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS wiki_entry_images (
    id TEXT PRIMARY KEY,
    entry_id INTEGER NOT NULL,
    media_type TEXT NOT NULL
        CHECK (media_type IN ('image/jpeg', 'image/png', 'image/webp')),
    media_name TEXT NOT NULL DEFAULT '',
    media_data TEXT NOT NULL,
    alt_text TEXT NOT NULL
        CHECK (length(alt_text) BETWEEN 1 AND 300),
    caption TEXT NOT NULL DEFAULT ''
        CHECK (length(caption) <= 500),
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY (entry_id)
        REFERENCES wiki_entries(id)
        ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_wiki_images_entry
    ON wiki_entry_images(entry_id, created_at, id);

PRAGMA optimize;
