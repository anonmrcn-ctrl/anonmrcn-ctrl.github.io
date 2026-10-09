CREATE TABLE IF NOT EXISTS media_assets (
    id TEXT PRIMARY KEY CHECK (length(id) BETWEEN 1 AND 160),
    owner_type TEXT NOT NULL
        CHECK (owner_type IN ('memory', 'wiki_image', 'map_entry', 'document')),
    owner_id TEXT NOT NULL CHECK (length(owner_id) BETWEEN 1 AND 160),
    variant_key TEXT NOT NULL DEFAULT 'original'
        CHECK (length(variant_key) BETWEEN 1 AND 80),
    object_key TEXT NOT NULL UNIQUE
        CHECK (length(object_key) BETWEEN 1 AND 1024),
    media_type TEXT NOT NULL CHECK (length(media_type) BETWEEN 1 AND 120),
    media_name TEXT NOT NULL DEFAULT '' CHECK (length(media_name) <= 500),
    byte_size INTEGER NOT NULL CHECK (byte_size >= 0),
    checksum TEXT NOT NULL CHECK (length(checksum) = 64),
    width INTEGER CHECK (width IS NULL OR width > 0),
    height INTEGER CHECK (height IS NULL OR height > 0),
    alt_text TEXT NOT NULL DEFAULT '' CHECK (length(alt_text) <= 500),
    caption TEXT NOT NULL DEFAULT '' CHECK (length(caption) <= 1000),
    state TEXT NOT NULL DEFAULT 'current'
        CHECK (state IN ('current', 'retained')),
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_media_assets_owner
    ON media_assets(owner_type, owner_id, variant_key, state, updated_at);

CREATE UNIQUE INDEX IF NOT EXISTS idx_media_assets_current
    ON media_assets(owner_type, owner_id, variant_key)
    WHERE state = 'current';
