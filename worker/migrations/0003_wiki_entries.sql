PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS wiki_entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    slug TEXT NOT NULL UNIQUE
        CHECK (length(slug) BETWEEN 1 AND 160),
    title TEXT NOT NULL
        CHECK (length(title) BETWEEN 2 AND 160),
    summary TEXT NOT NULL DEFAULT ''
        CHECK (length(summary) <= 500),
    body TEXT NOT NULL DEFAULT ''
        CHECK (length(body) <= 50000),
    status TEXT NOT NULL DEFAULT 'draft'
        CHECK (status IN ('draft', 'published')),
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    published_at INTEGER
);

CREATE INDEX IF NOT EXISTS idx_wiki_entries_public
    ON wiki_entries(status, title, id);

CREATE TABLE IF NOT EXISTS wiki_entry_revisions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    entry_id INTEGER NOT NULL,
    revision_number INTEGER NOT NULL,
    slug TEXT NOT NULL,
    title TEXT NOT NULL,
    summary TEXT NOT NULL DEFAULT '',
    body TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL
        CHECK (status IN ('draft', 'published')),
    created_at INTEGER NOT NULL,
    UNIQUE (entry_id, revision_number),
    FOREIGN KEY (entry_id)
        REFERENCES wiki_entries(id)
        ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_wiki_revisions_entry
    ON wiki_entry_revisions(entry_id, revision_number DESC);
