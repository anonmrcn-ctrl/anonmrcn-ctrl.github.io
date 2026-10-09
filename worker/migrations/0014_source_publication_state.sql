ALTER TABLE sources ADD COLUMN status TEXT NOT NULL DEFAULT 'published'
    CHECK (status IN ('draft', 'published', 'archived'));

ALTER TABLE sources ADD COLUMN published_at INTEGER;

UPDATE sources
SET published_at = created_at
WHERE status = 'published' AND published_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_sources_public
    ON sources(status, title COLLATE NOCASE, id);
