CREATE TABLE IF NOT EXISTS narrative_steps (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    stable_key TEXT NOT NULL UNIQUE
        CHECK (length(stable_key) BETWEEN 1 AND 160),
    position INTEGER NOT NULL DEFAULT 1
        CHECK (position BETWEEN 1 AND 9999),
    verse TEXT NOT NULL
        CHECK (length(verse) BETWEEN 1 AND 240),
    label TEXT NOT NULL
        CHECK (length(label) BETWEEN 1 AND 160),
    title TEXT NOT NULL
        CHECK (length(title) BETWEEN 1 AND 160),
    title_url TEXT NOT NULL DEFAULT ''
        CHECK (length(title_url) <= 2048),
    lat REAL NOT NULL CHECK (lat BETWEEN -90 AND 90),
    lon REAL NOT NULL CHECK (lon BETWEEN -180 AND 180),
    zoom INTEGER NOT NULL DEFAULT 16 CHECK (zoom BETWEEN 10 AND 19),
    explanation TEXT NOT NULL
        CHECK (length(explanation) BETWEEN 1 AND 5000),
    sources_json TEXT NOT NULL DEFAULT '[]',
    status TEXT NOT NULL DEFAULT 'draft'
        CHECK (status IN ('draft', 'published')),
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    published_at INTEGER
);

CREATE INDEX IF NOT EXISTS idx_narrative_steps_public
    ON narrative_steps(status, position, id);

CREATE TABLE IF NOT EXISTS content_initializations (
    name TEXT PRIMARY KEY,
    applied_at INTEGER NOT NULL
);
