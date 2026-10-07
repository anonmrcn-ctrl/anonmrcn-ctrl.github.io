CREATE TABLE IF NOT EXISTS map_entry_images (
    entry_id INTEGER PRIMARY KEY,
    media_type TEXT NOT NULL
        CHECK (media_type IN ('image/jpeg', 'image/png', 'image/webp')),
    media_name TEXT NOT NULL DEFAULT '',
    media_data TEXT NOT NULL,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY (entry_id)
        REFERENCES map_entries(id)
        ON DELETE CASCADE
);
