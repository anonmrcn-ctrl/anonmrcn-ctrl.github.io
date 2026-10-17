CREATE TABLE IF NOT EXISTS visual_themes (
    id TEXT PRIMARY KEY CHECK (length(id) BETWEEN 3 AND 96),
    name TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 120),
    status TEXT NOT NULL DEFAULT 'draft'
        CHECK (status IN ('draft', 'published', 'archived')),
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    published_at INTEGER
);

CREATE INDEX IF NOT EXISTS idx_visual_themes_status
    ON visual_themes(status, name COLLATE NOCASE, id);

CREATE TABLE IF NOT EXISTS visual_theme_tokens (
    theme_id TEXT NOT NULL,
    token_group TEXT NOT NULL
        CHECK (token_group IN (
            'palette', 'typography', 'scale', 'spacing', 'surface',
            'border', 'shadow', 'motion'
        )),
    token_name TEXT NOT NULL CHECK (length(token_name) BETWEEN 1 AND 96),
    breakpoint TEXT NOT NULL DEFAULT 'all'
        CHECK (breakpoint IN ('all', 'phone', 'tablet', 'desktop')),
    value_kind TEXT NOT NULL
        CHECK (value_kind IN ('text', 'color', 'font', 'number', 'length', 'boolean')),
    text_value TEXT,
    number_value REAL,
    boolean_value INTEGER CHECK (boolean_value IS NULL OR boolean_value IN (0, 1)),
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    PRIMARY KEY (theme_id, token_group, token_name, breakpoint),
    FOREIGN KEY (theme_id) REFERENCES visual_themes(id) ON DELETE RESTRICT,
    CHECK (
        (value_kind IN ('text', 'color', 'font', 'length')
            AND text_value IS NOT NULL
            AND number_value IS NULL AND boolean_value IS NULL) OR
        (value_kind = 'number' AND text_value IS NULL
            AND number_value IS NOT NULL AND boolean_value IS NULL) OR
        (value_kind = 'boolean' AND text_value IS NULL
            AND number_value IS NULL AND boolean_value IS NOT NULL)
    )
);

CREATE TABLE IF NOT EXISTS visual_trees (
    id TEXT PRIMARY KEY CHECK (length(id) BETWEEN 3 AND 96),
    schema_version INTEGER NOT NULL DEFAULT 1 CHECK (schema_version >= 1),
    contract_version INTEGER NOT NULL DEFAULT 1 CHECK (contract_version >= 1),
    status TEXT NOT NULL DEFAULT 'draft'
        CHECK (status IN ('draft', 'published', 'archived')),
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    published_at INTEGER
);

CREATE INDEX IF NOT EXISTS idx_visual_trees_status
    ON visual_trees(status, updated_at DESC, id);

CREATE TABLE IF NOT EXISTS visual_page_trees (
    page_id TEXT PRIMARY KEY,
    tree_id TEXT NOT NULL UNIQUE,
    theme_id TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY (page_id) REFERENCES site_pages(id) ON DELETE RESTRICT,
    FOREIGN KEY (tree_id) REFERENCES visual_trees(id) ON DELETE RESTRICT,
    FOREIGN KEY (theme_id) REFERENCES visual_themes(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS visual_nodes (
    id TEXT PRIMARY KEY CHECK (length(id) BETWEEN 3 AND 96),
    tree_id TEXT NOT NULL,
    parent_id TEXT,
    position INTEGER NOT NULL CHECK (position BETWEEN 1 AND 9999),
    block_type TEXT NOT NULL CHECK (block_type IN (
        'page-root', 'section', 'container', 'stack', 'row', 'columns', 'grid',
        'separator', 'spacer', 'heading', 'rich-text', 'list', 'quote', 'image',
        'gallery', 'button', 'link-list', 'menu', 'table-of-contents', 'breadcrumb',
        'global-header', 'global-footer', 'global-notice', 'project-poem',
        'project-path', 'project-map', 'project-voices', 'project-places',
        'project-sources', 'project-memories', 'project-archive', 'personal-notebook',
        'personal-space', 'special-access', 'legal-document', 'approved-form',
        'data-collection', 'data-filter', 'admin-workspace', 'admin-tool-panel'
    )),
    label TEXT NOT NULL DEFAULT '' CHECK (length(label) <= 160),
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    UNIQUE (tree_id, id),
    FOREIGN KEY (tree_id) REFERENCES visual_trees(id) ON DELETE RESTRICT,
    FOREIGN KEY (tree_id, parent_id) REFERENCES visual_nodes(tree_id, id)
        ON DELETE NO ACTION DEFERRABLE INITIALLY DEFERRED
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_visual_nodes_position
    ON visual_nodes(tree_id, ifnull(parent_id, ''), position);

CREATE UNIQUE INDEX IF NOT EXISTS idx_visual_nodes_single_root
    ON visual_nodes(tree_id) WHERE parent_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_visual_nodes_parent
    ON visual_nodes(tree_id, parent_id, position, id);

CREATE TABLE IF NOT EXISTS visual_node_properties (
    node_id TEXT NOT NULL,
    domain TEXT NOT NULL
        CHECK (domain IN ('content', 'presentation', 'behavior', 'technical')),
    property_set TEXT NOT NULL CHECK (property_set IN (
        'content.copy', 'content.media', 'presentation.box',
        'presentation.layout', 'presentation.typography',
        'presentation.responsive', 'behavior.link', 'behavior.collection',
        'behavior.form', 'technical.binding', 'technical.security'
    )),
    property_name TEXT NOT NULL CHECK (length(property_name) BETWEEN 1 AND 96),
    breakpoint TEXT NOT NULL DEFAULT 'all'
        CHECK (breakpoint IN ('all', 'phone', 'tablet', 'desktop')),
    item_position INTEGER NOT NULL DEFAULT 0 CHECK (item_position BETWEEN 0 AND 9999),
    value_kind TEXT NOT NULL CHECK (value_kind IN (
        'text', 'integer', 'number', 'boolean', 'color', 'length',
        'url', 'asset', 'page', 'collection'
    )),
    text_value TEXT,
    number_value REAL,
    boolean_value INTEGER CHECK (boolean_value IS NULL OR boolean_value IN (0, 1)),
    asset_id TEXT,
    page_reference_id TEXT,
    collection_key TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    PRIMARY KEY (node_id, property_set, property_name, breakpoint, item_position),
    FOREIGN KEY (node_id) REFERENCES visual_nodes(id) ON DELETE RESTRICT,
    FOREIGN KEY (asset_id) REFERENCES media_assets(id) ON DELETE RESTRICT,
    FOREIGN KEY (page_reference_id) REFERENCES site_pages(id) ON DELETE RESTRICT,
    CHECK (substr(property_set, 1, length(domain) + 1) = domain || '.'),
    CHECK (breakpoint = 'all' OR property_set = 'presentation.responsive'),
    CHECK (
        (value_kind IN ('text', 'color', 'length', 'url')
            AND text_value IS NOT NULL AND number_value IS NULL
            AND boolean_value IS NULL AND asset_id IS NULL
            AND page_reference_id IS NULL AND collection_key IS NULL) OR
        (value_kind = 'integer' AND text_value IS NULL
            AND number_value IS NOT NULL
            AND number_value = CAST(number_value AS INTEGER)
            AND boolean_value IS NULL AND asset_id IS NULL
            AND page_reference_id IS NULL AND collection_key IS NULL) OR
        (value_kind = 'number' AND text_value IS NULL
            AND number_value IS NOT NULL AND boolean_value IS NULL
            AND asset_id IS NULL AND page_reference_id IS NULL
            AND collection_key IS NULL) OR
        (value_kind = 'boolean' AND text_value IS NULL
            AND number_value IS NULL AND boolean_value IS NOT NULL
            AND asset_id IS NULL AND page_reference_id IS NULL
            AND collection_key IS NULL) OR
        (value_kind = 'asset' AND text_value IS NULL
            AND number_value IS NULL AND boolean_value IS NULL
            AND asset_id IS NOT NULL AND page_reference_id IS NULL
            AND collection_key IS NULL) OR
        (value_kind = 'page' AND text_value IS NULL
            AND number_value IS NULL AND boolean_value IS NULL
            AND asset_id IS NULL AND page_reference_id IS NOT NULL
            AND collection_key IS NULL) OR
        (value_kind = 'collection' AND text_value IS NULL
            AND number_value IS NULL AND boolean_value IS NULL
            AND asset_id IS NULL AND page_reference_id IS NULL
            AND collection_key IS NOT NULL)
    )
);

CREATE INDEX IF NOT EXISTS idx_visual_node_properties_lookup
    ON visual_node_properties(node_id, domain, property_set, breakpoint, item_position);

CREATE TABLE IF NOT EXISTS visual_reusable_sections (
    id TEXT PRIMARY KEY CHECK (length(id) BETWEEN 3 AND 96),
    name TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 120),
    tree_id TEXT NOT NULL UNIQUE,
    status TEXT NOT NULL DEFAULT 'draft'
        CHECK (status IN ('draft', 'published', 'archived')),
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    published_at INTEGER,
    FOREIGN KEY (tree_id) REFERENCES visual_trees(id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_visual_reusable_sections_status
    ON visual_reusable_sections(status, name COLLATE NOCASE, id);
