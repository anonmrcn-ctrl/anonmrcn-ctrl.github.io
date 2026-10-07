export const CMS_STORAGE_STATEMENTS = Object.freeze([
    `CREATE TABLE IF NOT EXISTS site_pages (
        id TEXT PRIMARY KEY CHECK (length(id) BETWEEN 1 AND 160),
        slug TEXT NOT NULL UNIQUE CHECK (length(slug) BETWEEN 1 AND 160),
        title TEXT NOT NULL CHECK (length(title) BETWEEN 1 AND 200),
        description TEXT NOT NULL DEFAULT '' CHECK (length(description) <= 500),
        status TEXT NOT NULL DEFAULT 'draft'
            CHECK (status IN ('draft', 'published', 'archived')),
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        published_at INTEGER
    )`,
    `CREATE INDEX IF NOT EXISTS idx_site_pages_public
        ON site_pages(status, slug)`,
    `CREATE TABLE IF NOT EXISTS page_blocks (
        id TEXT PRIMARY KEY CHECK (length(id) BETWEEN 1 AND 160),
        page_id TEXT NOT NULL,
        position INTEGER NOT NULL DEFAULT 1
            CHECK (position BETWEEN 1 AND 9999),
        block_type TEXT NOT NULL
            CHECK (block_type IN (
                'heading',
                'paragraph',
                'rich_text',
                'image',
                'link_group',
                'callout',
                'embed'
            )),
        content_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(content_json)),
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        UNIQUE (page_id, position),
        FOREIGN KEY (page_id) REFERENCES site_pages(id) ON DELETE CASCADE
    )`,
    `CREATE INDEX IF NOT EXISTS idx_page_blocks_page
        ON page_blocks(page_id, position, id)`,
    `CREATE TABLE IF NOT EXISTS poem_works (
        id TEXT PRIMARY KEY CHECK (length(id) BETWEEN 1 AND 160),
        slug TEXT NOT NULL UNIQUE CHECK (length(slug) BETWEEN 1 AND 160),
        title TEXT NOT NULL CHECK (length(title) BETWEEN 1 AND 200),
        subtitle TEXT NOT NULL DEFAULT '' CHECK (length(subtitle) <= 300),
        status TEXT NOT NULL DEFAULT 'draft'
            CHECK (status IN ('draft', 'published', 'archived')),
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        published_at INTEGER
    )`,
    `CREATE TABLE IF NOT EXISTS poem_sections (
        id TEXT PRIMARY KEY CHECK (length(id) BETWEEN 1 AND 160),
        poem_id TEXT NOT NULL,
        position INTEGER NOT NULL CHECK (position BETWEEN 1 AND 9999),
        title TEXT NOT NULL DEFAULT '' CHECK (length(title) <= 200),
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        UNIQUE (poem_id, position),
        FOREIGN KEY (poem_id) REFERENCES poem_works(id) ON DELETE CASCADE
    )`,
    `CREATE TABLE IF NOT EXISTS poem_lines (
        id TEXT PRIMARY KEY CHECK (length(id) BETWEEN 1 AND 160),
        section_id TEXT NOT NULL,
        position INTEGER NOT NULL CHECK (position BETWEEN 1 AND 9999),
        text TEXT NOT NULL CHECK (length(text) BETWEEN 1 AND 2000),
        indent_level INTEGER NOT NULL DEFAULT 0
            CHECK (indent_level BETWEEN 0 AND 12),
        metadata_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(metadata_json)),
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        UNIQUE (section_id, position),
        FOREIGN KEY (section_id) REFERENCES poem_sections(id) ON DELETE CASCADE
    )`,
    `CREATE INDEX IF NOT EXISTS idx_poem_sections_work
        ON poem_sections(poem_id, position, id)`,
    `CREATE INDEX IF NOT EXISTS idx_poem_lines_section
        ON poem_lines(section_id, position, id)`,
    `CREATE TABLE IF NOT EXISTS navigation_items (
        id TEXT PRIMARY KEY CHECK (length(id) BETWEEN 1 AND 160),
        menu_key TEXT NOT NULL DEFAULT 'main'
            CHECK (length(menu_key) BETWEEN 1 AND 80),
        parent_id TEXT,
        position INTEGER NOT NULL CHECK (position BETWEEN 1 AND 9999),
        label TEXT NOT NULL CHECK (length(label) BETWEEN 1 AND 160),
        href TEXT NOT NULL CHECK (length(href) BETWEEN 1 AND 2048),
        visibility TEXT NOT NULL DEFAULT 'public'
            CHECK (visibility IN ('public', 'authenticated', 'admin')),
        status TEXT NOT NULL DEFAULT 'draft'
            CHECK (status IN ('draft', 'published', 'archived')),
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        published_at INTEGER,
        FOREIGN KEY (parent_id) REFERENCES navigation_items(id)
            ON DELETE RESTRICT
    )`,
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_navigation_items_position
        ON navigation_items(menu_key, ifnull(parent_id, ''), position)`,
    `CREATE INDEX IF NOT EXISTS idx_navigation_items_menu
        ON navigation_items(menu_key, status, position, id)`,
    `CREATE TABLE IF NOT EXISTS onboarding_steps (
        id TEXT PRIMARY KEY CHECK (length(id) BETWEEN 1 AND 160),
        tour_key TEXT NOT NULL DEFAULT 'welcome'
            CHECK (length(tour_key) BETWEEN 1 AND 80),
        position INTEGER NOT NULL CHECK (position BETWEEN 1 AND 9999),
        title TEXT NOT NULL CHECK (length(title) BETWEEN 1 AND 200),
        body TEXT NOT NULL DEFAULT '' CHECK (length(body) <= 5000),
        action_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(action_json)),
        status TEXT NOT NULL DEFAULT 'draft'
            CHECK (status IN ('draft', 'published', 'archived')),
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        published_at INTEGER,
        UNIQUE (tour_key, position)
    )`,
    `CREATE INDEX IF NOT EXISTS idx_onboarding_steps_tour
        ON onboarding_steps(tour_key, status, position, id)`,
    `CREATE TABLE IF NOT EXISTS site_settings (
        setting_key TEXT PRIMARY KEY
            CHECK (length(setting_key) BETWEEN 1 AND 160),
        value_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(value_json)),
        visibility TEXT NOT NULL DEFAULT 'public'
            CHECK (visibility IN ('public', 'private')),
        status TEXT NOT NULL DEFAULT 'draft'
            CHECK (status IN ('draft', 'published', 'archived')),
        updated_at INTEGER NOT NULL,
        published_at INTEGER
    )`,
    `CREATE INDEX IF NOT EXISTS idx_site_settings_public
        ON site_settings(visibility, status, setting_key)`,
    `CREATE TABLE IF NOT EXISTS sources (
        id TEXT PRIMARY KEY CHECK (length(id) BETWEEN 1 AND 160),
        source_type TEXT NOT NULL DEFAULT 'web'
            CHECK (source_type IN (
                'book',
                'article',
                'archive',
                'web',
                'map',
                'oral',
                'other'
            )),
        title TEXT NOT NULL CHECK (length(title) BETWEEN 1 AND 500),
        author TEXT NOT NULL DEFAULT '' CHECK (length(author) <= 300),
        publication_date TEXT NOT NULL DEFAULT ''
            CHECK (length(publication_date) <= 100),
        url TEXT NOT NULL DEFAULT '' CHECK (length(url) <= 2048),
        note TEXT NOT NULL DEFAULT '' CHECK (length(note) <= 2000),
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
    )`,
    `CREATE INDEX IF NOT EXISTS idx_sources_title
        ON sources(title COLLATE NOCASE, id)`,
    `CREATE TABLE IF NOT EXISTS content_source_links (
        content_type TEXT NOT NULL CHECK (length(content_type) BETWEEN 1 AND 80),
        content_id TEXT NOT NULL CHECK (length(content_id) BETWEEN 1 AND 160),
        source_id TEXT NOT NULL,
        position INTEGER NOT NULL DEFAULT 1
            CHECK (position BETWEEN 1 AND 9999),
        context TEXT NOT NULL DEFAULT '' CHECK (length(context) <= 1000),
        PRIMARY KEY (content_type, content_id, source_id),
        UNIQUE (content_type, content_id, position),
        FOREIGN KEY (source_id) REFERENCES sources(id) ON DELETE RESTRICT
    )`,
    `CREATE INDEX IF NOT EXISTS idx_content_source_links_source
        ON content_source_links(source_id, content_type, content_id)`,
    `CREATE TABLE IF NOT EXISTS map_layers (
        id TEXT PRIMARY KEY CHECK (length(id) BETWEEN 1 AND 160),
        slug TEXT NOT NULL UNIQUE CHECK (length(slug) BETWEEN 1 AND 160),
        title TEXT NOT NULL CHECK (length(title) BETWEEN 1 AND 200),
        description TEXT NOT NULL DEFAULT '' CHECK (length(description) <= 3000),
        layer_type TEXT NOT NULL
            CHECK (layer_type IN ('points', 'lines', 'polygons', 'mixed', 'raster')),
        position INTEGER NOT NULL DEFAULT 1
            CHECK (position BETWEEN 1 AND 9999),
        style_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(style_json)),
        status TEXT NOT NULL DEFAULT 'draft'
            CHECK (status IN ('draft', 'published', 'archived')),
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        published_at INTEGER
    )`,
    `CREATE INDEX IF NOT EXISTS idx_map_layers_public
        ON map_layers(status, position, id)`,
    `CREATE TABLE IF NOT EXISTS map_features (
        id TEXT PRIMARY KEY CHECK (length(id) BETWEEN 1 AND 160),
        layer_id TEXT NOT NULL,
        position INTEGER NOT NULL DEFAULT 1
            CHECK (position BETWEEN 1 AND 999999),
        title TEXT NOT NULL DEFAULT '' CHECK (length(title) <= 200),
        description TEXT NOT NULL DEFAULT '' CHECK (length(description) <= 5000),
        geometry_json TEXT NOT NULL CHECK (json_valid(geometry_json)),
        properties_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(properties_json)),
        status TEXT NOT NULL DEFAULT 'draft'
            CHECK (status IN ('draft', 'published', 'archived')),
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        published_at INTEGER,
        UNIQUE (layer_id, position),
        FOREIGN KEY (layer_id) REFERENCES map_layers(id) ON DELETE CASCADE
    )`,
    `CREATE INDEX IF NOT EXISTS idx_map_features_layer
        ON map_features(layer_id, status, position, id)`,
    `CREATE TABLE IF NOT EXISTS legal_documents (
        id TEXT PRIMARY KEY CHECK (length(id) BETWEEN 1 AND 160),
        slug TEXT NOT NULL UNIQUE CHECK (length(slug) BETWEEN 1 AND 160),
        title TEXT NOT NULL CHECK (length(title) BETWEEN 1 AND 200),
        current_version INTEGER NOT NULL DEFAULT 0
            CHECK (current_version >= 0),
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS legal_document_versions (
        id TEXT PRIMARY KEY CHECK (length(id) BETWEEN 1 AND 160),
        document_id TEXT NOT NULL,
        version_number INTEGER NOT NULL CHECK (version_number >= 1),
        effective_date TEXT NOT NULL CHECK (length(effective_date) BETWEEN 10 AND 32),
        body_html TEXT NOT NULL,
        checksum TEXT NOT NULL CHECK (length(checksum) BETWEEN 32 AND 128),
        status TEXT NOT NULL DEFAULT 'draft'
            CHECK (status IN ('draft', 'published')),
        created_at INTEGER NOT NULL,
        published_at INTEGER,
        UNIQUE (document_id, version_number),
        FOREIGN KEY (document_id) REFERENCES legal_documents(id)
            ON DELETE RESTRICT
    )`,
    `CREATE INDEX IF NOT EXISTS idx_legal_document_versions_document
        ON legal_document_versions(document_id, version_number DESC)`,
    `CREATE TRIGGER IF NOT EXISTS legal_versions_published_immutable_update
        BEFORE UPDATE ON legal_document_versions
        FOR EACH ROW WHEN OLD.status = 'published'
        BEGIN
            SELECT RAISE(ABORT, 'published legal versions are immutable');
        END`,
    `CREATE TRIGGER IF NOT EXISTS legal_versions_published_immutable_delete
        BEFORE DELETE ON legal_document_versions
        FOR EACH ROW WHEN OLD.status = 'published'
        BEGIN
            SELECT RAISE(ABORT, 'published legal versions are immutable');
        END`,
    `CREATE TABLE IF NOT EXISTS content_revisions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        entity_type TEXT NOT NULL CHECK (length(entity_type) BETWEEN 1 AND 80),
        entity_id TEXT NOT NULL CHECK (length(entity_id) BETWEEN 1 AND 160),
        revision_number INTEGER NOT NULL CHECK (revision_number >= 1),
        snapshot_json TEXT NOT NULL CHECK (json_valid(snapshot_json)),
        publication_state TEXT NOT NULL
            CHECK (publication_state IN ('draft', 'published', 'archived')),
        created_at INTEGER NOT NULL,
        UNIQUE (entity_type, entity_id, revision_number)
    )`,
    `CREATE INDEX IF NOT EXISTS idx_content_revisions_entity
        ON content_revisions(entity_type, entity_id, revision_number DESC)`,
    `CREATE TRIGGER IF NOT EXISTS content_revisions_immutable_update
        BEFORE UPDATE ON content_revisions
        BEGIN
            SELECT RAISE(ABORT, 'content revisions are immutable');
        END`,
    `CREATE TRIGGER IF NOT EXISTS content_revisions_immutable_delete
        BEFORE DELETE ON content_revisions
        BEGIN
            SELECT RAISE(ABORT, 'content revisions are immutable');
        END`,
    `CREATE TABLE IF NOT EXISTS permalinks (
        id TEXT PRIMARY KEY CHECK (length(id) BETWEEN 1 AND 160),
        path TEXT NOT NULL UNIQUE
            CHECK (length(path) BETWEEN 1 AND 2048 AND substr(path, 1, 1) = '/'),
        target_type TEXT NOT NULL CHECK (length(target_type) BETWEEN 1 AND 80),
        target_id TEXT NOT NULL CHECK (length(target_id) BETWEEN 1 AND 160),
        state TEXT NOT NULL DEFAULT 'active'
            CHECK (state IN ('active', 'redirect', 'gone')),
        redirect_path TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        CHECK (
            (state = 'redirect' AND redirect_path IS NOT NULL) OR
            (state <> 'redirect' AND redirect_path IS NULL)
        )
    )`,
    `CREATE INDEX IF NOT EXISTS idx_permalinks_target
        ON permalinks(target_type, target_id, state)`,
    `CREATE TRIGGER IF NOT EXISTS permalinks_path_immutable
        BEFORE UPDATE OF path ON permalinks
        FOR EACH ROW WHEN OLD.path <> NEW.path
        BEGIN
            SELECT RAISE(ABORT, 'permalink paths are immutable');
        END`
]);
