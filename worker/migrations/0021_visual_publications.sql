-- Snapshot pubblicato separato dall'albero visuale modificabile.
-- Le versioni storiche restano append-only in content_revisions.

CREATE TABLE IF NOT EXISTS visual_tree_publications (
    tree_id TEXT PRIMARY KEY,
    page_id TEXT NOT NULL UNIQUE,
    revision_number INTEGER NOT NULL CHECK (revision_number >= 0),
    snapshot_json TEXT NOT NULL CHECK (json_valid(snapshot_json)),
    checksum TEXT NOT NULL CHECK (length(checksum) = 64),
    published_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY (tree_id) REFERENCES visual_trees(id) ON DELETE RESTRICT,
    FOREIGN KEY (page_id) REFERENCES site_pages(id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_visual_tree_publications_page
    ON visual_tree_publications(page_id, updated_at DESC);
