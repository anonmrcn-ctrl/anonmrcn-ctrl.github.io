CREATE TABLE IF NOT EXISTS map_entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL
        CHECK (length(name) BETWEEN 2 AND 160),
    category TEXT NOT NULL DEFAULT 'luogo'
        CHECK (category IN (
            'luogo',
            'edificio',
            'monumento',
            'infrastruttura',
            'paesaggio',
            'corso_d_acqua',
            'cava',
            'percorso'
        )),
    description TEXT NOT NULL DEFAULT ''
        CHECK (length(description) <= 3000),
    lat REAL NOT NULL
        CHECK (lat BETWEEN -90 AND 90),
    lon REAL NOT NULL
        CHECK (lon BETWEEN -180 AND 180),
    source_url TEXT NOT NULL DEFAULT ''
        CHECK (length(source_url) <= 2048),
    source_label TEXT NOT NULL DEFAULT ''
        CHECK (length(source_label) <= 160),
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_map_entries_name
    ON map_entries(name COLLATE NOCASE, id);
