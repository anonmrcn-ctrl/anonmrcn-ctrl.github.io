PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS locations (
    id INTEGER PRIMARY KEY,
    address TEXT NOT NULL UNIQUE,
    username TEXT NOT NULL DEFAULT '',
    street_name TEXT NOT NULL DEFAULT '',
    street_order INTEGER NOT NULL DEFAULT 0
        CHECK (street_order >= 0),
    lat REAL NOT NULL,
    lon REAL NOT NULL,
    is_visible INTEGER NOT NULL DEFAULT 0
        CHECK (is_visible IN (0, 1)),
    welcome_seen_at INTEGER,
    privacy_safe INTEGER NOT NULL DEFAULT 0
        CHECK (privacy_safe IN (0, 1)),
    location_consent_at INTEGER,
    password_lookup TEXT NOT NULL UNIQUE,
    password_salt TEXT NOT NULL,
    password_hash TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_locations_street_order
ON locations(street_name, street_order)
WHERE street_name <> '' AND street_order > 0;

CREATE TRIGGER IF NOT EXISTS locations_private_by_default
AFTER INSERT ON locations
FOR EACH ROW
WHEN NEW.is_visible <> 0
BEGIN
    UPDATE locations
    SET is_visible = 0
    WHERE id = NEW.id;
END;

CREATE TABLE IF NOT EXISTS poems (
    location_id INTEGER PRIMARY KEY,
    html TEXT NOT NULL,
    FOREIGN KEY (location_id)
        REFERENCES locations(id)
        ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS sessions (
    session_hash TEXT PRIMARY KEY,
    location_id INTEGER NOT NULL,
    created_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL,
    FOREIGN KEY (location_id)
        REFERENCES locations(id)
        ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sender_location_id INTEGER NOT NULL,
    recipient_location_id INTEGER NOT NULL,
    text TEXT NOT NULL,
    reveal_sender INTEGER NOT NULL DEFAULT 0
        CHECK (reveal_sender IN (0, 1)),
    delivery_type TEXT NOT NULL
        CHECK (delivery_type IN ('online', 'physical')),
    status TEXT NOT NULL
        CHECK (
            status IN (
                'pending',
                'pending_delivery',
                'approved',
                'read',
                'delivered',
                'rejected'
            )
        ),
    sender_public_consent INTEGER NOT NULL DEFAULT 0
        CHECK (sender_public_consent IN (0, 1)),
    recipient_public_consent INTEGER NOT NULL DEFAULT 0
        CHECK (recipient_public_consent IN (0, 1)),
    is_public INTEGER NOT NULL DEFAULT 0
        CHECK (is_public IN (0, 1)),
    published_at INTEGER,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY (sender_location_id)
        REFERENCES locations(id),
    FOREIGN KEY (recipient_location_id)
        REFERENCES locations(id),
    CHECK (sender_location_id <> recipient_location_id),
    CHECK (length(text) BETWEEN 1 AND 1500)
);

CREATE INDEX IF NOT EXISTS idx_sessions_expiry
    ON sessions(expires_at);

CREATE TABLE IF NOT EXISTS mayor_sessions (
    session_hash TEXT PRIMARY KEY,
    created_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_mayor_sessions_expiry
    ON mayor_sessions(expires_at);

CREATE TABLE IF NOT EXISTS mayor_message (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    title TEXT NOT NULL DEFAULT 'Messaggio per il sindaco',
    body TEXT NOT NULL DEFAULT '',
    updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_messages_recipient
    ON messages(recipient_location_id, delivery_type, status, created_at);

CREATE INDEX IF NOT EXISTS idx_messages_sender_rate
    ON messages(sender_location_id, created_at);

CREATE INDEX IF NOT EXISTS idx_messages_admin
    ON messages(status, created_at);

CREATE INDEX IF NOT EXISTS idx_messages_public_archive
    ON messages(is_public, published_at, id);

CREATE TABLE IF NOT EXISTS contact_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL DEFAULT '',
    email TEXT NOT NULL DEFAULT '',
    text TEXT NOT NULL
        CHECK (length(text) BETWEEN 1 AND 1500),
    status TEXT NOT NULL DEFAULT 'unread'
        CHECK (status IN ('unread', 'read')),
    sender_hash TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_contact_messages_sender_rate
    ON contact_messages(sender_hash, created_at);

CREATE INDEX IF NOT EXISTS idx_contact_messages_admin
    ON contact_messages(status, created_at);

CREATE TABLE IF NOT EXISTS memories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL
        CHECK (length(title) BETWEEN 3 AND 100),
    author_name TEXT NOT NULL DEFAULT ''
        CHECK (length(author_name) <= 80),
    text TEXT NOT NULL
        CHECK (length(text) BETWEEN 1 AND 3000),
    lat REAL NOT NULL
        CHECK (lat BETWEEN -90 AND 90),
    lon REAL NOT NULL
        CHECK (lon BETWEEN -180 AND 180),
    media_type TEXT NOT NULL DEFAULT '',
    media_name TEXT NOT NULL DEFAULT '',
    media_data TEXT,
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'approved', 'rejected')),
    consent INTEGER NOT NULL
        CHECK (consent = 1),
    withdrawal_hash TEXT NOT NULL UNIQUE,
    sender_hash TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    published_at INTEGER
);

CREATE INDEX IF NOT EXISTS idx_memories_public
    ON memories(status, published_at, id);

CREATE INDEX IF NOT EXISTS idx_memories_sender_rate
    ON memories(sender_hash, created_at);

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

CREATE TABLE IF NOT EXISTS push_keys (
    id TEXT PRIMARY KEY,
    public_key TEXT NOT NULL,
    encrypted_private_key TEXT NOT NULL,
    created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS push_subscriptions (
    id TEXT PRIMARY KEY,
    audience TEXT NOT NULL
        CHECK (audience IN ('admin', 'location')),
    location_id INTEGER,
    endpoint TEXT NOT NULL,
    p256dh TEXT NOT NULL,
    auth TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    CHECK (
        (audience = 'admin' AND location_id IS NULL) OR
        (audience = 'location' AND location_id IS NOT NULL)
    ),
    FOREIGN KEY (location_id)
        REFERENCES locations(id)
        ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_audience
    ON push_subscriptions(audience, location_id);

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

-- Fondazione comune dei contenuti amministrabili.
-- Mantenere questa sezione allineata a migrations/0013–0014 e src/cms-schema.js.

CREATE TABLE IF NOT EXISTS site_pages (
        id TEXT PRIMARY KEY CHECK (length(id) BETWEEN 1 AND 160),
        slug TEXT NOT NULL UNIQUE CHECK (length(slug) BETWEEN 1 AND 160),
        title TEXT NOT NULL CHECK (length(title) BETWEEN 1 AND 200),
        description TEXT NOT NULL DEFAULT '' CHECK (length(description) <= 500),
        status TEXT NOT NULL DEFAULT 'draft'
            CHECK (status IN ('draft', 'published', 'archived')),
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        published_at INTEGER
    );

CREATE INDEX IF NOT EXISTS idx_site_pages_public
        ON site_pages(status, slug);

CREATE TABLE IF NOT EXISTS page_blocks (
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
    );

CREATE INDEX IF NOT EXISTS idx_page_blocks_page
        ON page_blocks(page_id, position, id);

CREATE TABLE IF NOT EXISTS poem_works (
        id TEXT PRIMARY KEY CHECK (length(id) BETWEEN 1 AND 160),
        slug TEXT NOT NULL UNIQUE CHECK (length(slug) BETWEEN 1 AND 160),
        title TEXT NOT NULL CHECK (length(title) BETWEEN 1 AND 200),
        subtitle TEXT NOT NULL DEFAULT '' CHECK (length(subtitle) <= 300),
        status TEXT NOT NULL DEFAULT 'draft'
            CHECK (status IN ('draft', 'published', 'archived')),
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        published_at INTEGER
    );

CREATE TABLE IF NOT EXISTS poem_sections (
        id TEXT PRIMARY KEY CHECK (length(id) BETWEEN 1 AND 160),
        poem_id TEXT NOT NULL,
        position INTEGER NOT NULL CHECK (position BETWEEN 1 AND 9999),
        title TEXT NOT NULL DEFAULT '' CHECK (length(title) <= 200),
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        UNIQUE (poem_id, position),
        FOREIGN KEY (poem_id) REFERENCES poem_works(id) ON DELETE CASCADE
    );

CREATE TABLE IF NOT EXISTS poem_lines (
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
    );

CREATE INDEX IF NOT EXISTS idx_poem_sections_work
        ON poem_sections(poem_id, position, id);

CREATE INDEX IF NOT EXISTS idx_poem_lines_section
        ON poem_lines(section_id, position, id);

CREATE TABLE IF NOT EXISTS navigation_items (
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
    );

CREATE UNIQUE INDEX IF NOT EXISTS idx_navigation_items_position
    ON navigation_items(menu_key, ifnull(parent_id, ''), position);

CREATE INDEX IF NOT EXISTS idx_navigation_items_menu
        ON navigation_items(menu_key, status, position, id);

CREATE TABLE IF NOT EXISTS onboarding_steps (
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
    );

CREATE INDEX IF NOT EXISTS idx_onboarding_steps_tour
        ON onboarding_steps(tour_key, status, position, id);

CREATE TABLE IF NOT EXISTS site_settings (
        setting_key TEXT PRIMARY KEY
            CHECK (length(setting_key) BETWEEN 1 AND 160),
    value_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(value_json)),
        visibility TEXT NOT NULL DEFAULT 'public'
            CHECK (visibility IN ('public', 'private')),
        status TEXT NOT NULL DEFAULT 'draft'
            CHECK (status IN ('draft', 'published', 'archived')),
        updated_at INTEGER NOT NULL,
        published_at INTEGER
    );

CREATE INDEX IF NOT EXISTS idx_site_settings_public
        ON site_settings(visibility, status, setting_key);

CREATE TABLE IF NOT EXISTS sources (
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
        status TEXT NOT NULL DEFAULT 'published'
            CHECK (status IN ('draft', 'published', 'archived')),
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        published_at INTEGER
    );

CREATE INDEX IF NOT EXISTS idx_sources_title
        ON sources(title COLLATE NOCASE, id);

CREATE INDEX IF NOT EXISTS idx_sources_public
        ON sources(status, title COLLATE NOCASE, id);

CREATE TABLE IF NOT EXISTS content_source_links (
        content_type TEXT NOT NULL CHECK (length(content_type) BETWEEN 1 AND 80),
        content_id TEXT NOT NULL CHECK (length(content_id) BETWEEN 1 AND 160),
        source_id TEXT NOT NULL,
        position INTEGER NOT NULL DEFAULT 1
            CHECK (position BETWEEN 1 AND 9999),
        context TEXT NOT NULL DEFAULT '' CHECK (length(context) <= 1000),
        PRIMARY KEY (content_type, content_id, source_id),
        UNIQUE (content_type, content_id, position),
        FOREIGN KEY (source_id) REFERENCES sources(id) ON DELETE RESTRICT
    );

CREATE INDEX IF NOT EXISTS idx_content_source_links_source
        ON content_source_links(source_id, content_type, content_id);

CREATE TABLE IF NOT EXISTS map_layers (
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
    );

CREATE INDEX IF NOT EXISTS idx_map_layers_public
        ON map_layers(status, position, id);

CREATE TABLE IF NOT EXISTS map_features (
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
    );

CREATE INDEX IF NOT EXISTS idx_map_features_layer
        ON map_features(layer_id, status, position, id);

CREATE TABLE IF NOT EXISTS legal_documents (
        id TEXT PRIMARY KEY CHECK (length(id) BETWEEN 1 AND 160),
        slug TEXT NOT NULL UNIQUE CHECK (length(slug) BETWEEN 1 AND 160),
        title TEXT NOT NULL CHECK (length(title) BETWEEN 1 AND 200),
        current_version INTEGER NOT NULL DEFAULT 0
            CHECK (current_version >= 0),
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
    );

CREATE TABLE IF NOT EXISTS legal_document_versions (
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
    );

CREATE INDEX IF NOT EXISTS idx_legal_document_versions_document
        ON legal_document_versions(document_id, version_number DESC);

CREATE TRIGGER IF NOT EXISTS legal_versions_published_immutable_update
        BEFORE UPDATE ON legal_document_versions
    FOR EACH ROW WHEN OLD.status = 'published'
        BEGIN
            SELECT RAISE(ABORT, 'published legal versions are immutable');
        END;

CREATE TRIGGER IF NOT EXISTS legal_versions_published_immutable_delete
        BEFORE DELETE ON legal_document_versions
    FOR EACH ROW WHEN OLD.status = 'published'
        BEGIN
            SELECT RAISE(ABORT, 'published legal versions are immutable');
        END;

CREATE TABLE IF NOT EXISTS content_revisions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        entity_type TEXT NOT NULL CHECK (length(entity_type) BETWEEN 1 AND 80),
        entity_id TEXT NOT NULL CHECK (length(entity_id) BETWEEN 1 AND 160),
        revision_number INTEGER NOT NULL CHECK (revision_number >= 1),
    snapshot_json TEXT NOT NULL CHECK (json_valid(snapshot_json)),
        publication_state TEXT NOT NULL
            CHECK (publication_state IN ('draft', 'published', 'archived')),
        created_at INTEGER NOT NULL,
        UNIQUE (entity_type, entity_id, revision_number)
    );

CREATE INDEX IF NOT EXISTS idx_content_revisions_entity
        ON content_revisions(entity_type, entity_id, revision_number DESC);

CREATE TRIGGER IF NOT EXISTS content_revisions_immutable_update
        BEFORE UPDATE ON content_revisions
        BEGIN
            SELECT RAISE(ABORT, 'content revisions are immutable');
        END;

CREATE TRIGGER IF NOT EXISTS content_revisions_immutable_delete
        BEFORE DELETE ON content_revisions
        BEGIN
            SELECT RAISE(ABORT, 'content revisions are immutable');
        END;

CREATE TABLE IF NOT EXISTS permalinks (
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
    );

CREATE INDEX IF NOT EXISTS idx_permalinks_target
        ON permalinks(target_type, target_id, state);

CREATE TRIGGER IF NOT EXISTS permalinks_path_immutable
        BEFORE UPDATE OF path ON permalinks
        FOR EACH ROW WHEN OLD.path <> NEW.path
        BEGIN
            SELECT RAISE(ABORT, 'permalink paths are immutable');
        END;

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
