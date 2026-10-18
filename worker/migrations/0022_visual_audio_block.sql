-- Estende il vincolo dei tipi visuali preservando nodi e tabelle dipendenti.
-- SQLite non consente di modificare un CHECK: ricreiamo quindi il gruppo
-- collegato in un'unica transazione D1, senza rinominare la tabella sorgente.
PRAGMA defer_foreign_keys = ON;

CREATE TABLE visual_nodes_audio_upgrade (
    id TEXT PRIMARY KEY CHECK (length(id) BETWEEN 3 AND 96),
    tree_id TEXT NOT NULL,
    parent_id TEXT,
    position INTEGER NOT NULL CHECK (position BETWEEN 1 AND 9999),
    block_type TEXT NOT NULL CHECK (block_type IN (
        'page-root', 'section', 'container', 'stack', 'row', 'columns', 'grid',
        'separator', 'spacer', 'heading', 'rich-text', 'list', 'quote', 'image',
        'gallery', 'audio', 'button', 'link-list', 'menu', 'table-of-contents', 'breadcrumb',
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
    FOREIGN KEY (tree_id, parent_id) REFERENCES visual_nodes_audio_upgrade(tree_id, id)
        ON DELETE NO ACTION DEFERRABLE INITIALLY DEFERRED
);

CREATE TABLE visual_node_properties_audio_upgrade (
    node_id TEXT NOT NULL,
    domain TEXT NOT NULL CHECK (domain IN ('content', 'presentation', 'behavior', 'technical')),
    property_set TEXT NOT NULL CHECK (property_set IN (
        'content.copy', 'content.media', 'presentation.box',
        'presentation.layout', 'presentation.typography',
        'presentation.responsive', 'behavior.link', 'behavior.collection',
        'behavior.form', 'technical.binding', 'technical.security'
    )),
    property_name TEXT NOT NULL CHECK (length(property_name) BETWEEN 1 AND 96),
    breakpoint TEXT NOT NULL DEFAULT 'all' CHECK (breakpoint IN ('all', 'phone', 'tablet', 'desktop')),
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
    FOREIGN KEY (node_id) REFERENCES visual_nodes_audio_upgrade(id) ON DELETE RESTRICT,
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

CREATE TABLE visual_reusable_instances_audio_upgrade (
    id TEXT PRIMARY KEY CHECK (length(id) BETWEEN 3 AND 96),
    section_id TEXT NOT NULL,
    page_id TEXT NOT NULL,
    node_id TEXT NOT NULL UNIQUE,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY (section_id) REFERENCES visual_reusable_sections(id) ON DELETE RESTRICT,
    FOREIGN KEY (page_id) REFERENCES site_pages(id) ON DELETE RESTRICT,
    FOREIGN KEY (node_id) REFERENCES visual_nodes_audio_upgrade(id) ON DELETE RESTRICT
);

INSERT INTO visual_nodes_audio_upgrade (
    id, tree_id, parent_id, position, block_type, label, created_at, updated_at
)
SELECT id, tree_id, parent_id, position, block_type, label, created_at, updated_at
FROM visual_nodes;

INSERT INTO visual_node_properties_audio_upgrade (
    node_id, domain, property_set, property_name, breakpoint, item_position,
    value_kind, text_value, number_value, boolean_value, asset_id,
    page_reference_id, collection_key, created_at, updated_at
)
SELECT node_id, domain, property_set, property_name, breakpoint, item_position,
    value_kind, text_value, number_value, boolean_value, asset_id,
    page_reference_id, collection_key, created_at, updated_at
FROM visual_node_properties;

INSERT INTO visual_reusable_instances_audio_upgrade (
    id, section_id, page_id, node_id, created_at, updated_at
)
SELECT id, section_id, page_id, node_id, created_at, updated_at
FROM visual_reusable_instances;

DROP TABLE visual_node_properties;
DROP TABLE visual_reusable_instances;
DROP TABLE visual_nodes;

ALTER TABLE visual_nodes_audio_upgrade RENAME TO visual_nodes;
ALTER TABLE visual_node_properties_audio_upgrade RENAME TO visual_node_properties;
ALTER TABLE visual_reusable_instances_audio_upgrade RENAME TO visual_reusable_instances;

CREATE UNIQUE INDEX idx_visual_nodes_position
    ON visual_nodes(tree_id, ifnull(parent_id, ''), position);
CREATE UNIQUE INDEX idx_visual_nodes_single_root
    ON visual_nodes(tree_id) WHERE parent_id IS NULL;
CREATE INDEX idx_visual_nodes_parent
    ON visual_nodes(tree_id, parent_id, position, id);
CREATE INDEX idx_visual_node_properties_lookup
    ON visual_node_properties(node_id, domain, property_set, breakpoint, item_position);
CREATE INDEX idx_visual_reusable_instances_section
    ON visual_reusable_instances(section_id, page_id, node_id);
