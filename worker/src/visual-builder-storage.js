export const VISUAL_BLOCK_TYPES = Object.freeze([
    "page-root", "section", "container", "stack", "row", "columns", "grid",
    "separator", "spacer", "heading", "rich-text", "list", "quote", "image",
    "gallery", "button", "link-list", "menu", "table-of-contents", "breadcrumb",
    "global-header", "global-footer", "global-notice", "project-poem", "project-path",
    "project-map", "project-voices", "project-places", "project-sources",
    "project-memories", "project-archive", "personal-notebook", "personal-space",
    "special-access", "legal-document", "approved-form", "data-collection",
    "data-filter", "admin-workspace", "admin-tool-panel"
]);

export const VISUAL_PROPERTY_SETS = Object.freeze([
    "content.copy", "content.media", "presentation.box", "presentation.layout",
    "presentation.typography", "presentation.responsive", "behavior.link",
    "behavior.collection", "behavior.form", "technical.binding", "technical.security"
]);

const LEGACY_BLOCK_TYPES = Object.freeze({
    heading: "heading",
    paragraph: "rich-text",
    rich_text: "rich-text",
    image: "image",
    link_group: "link-list",
    callout: "quote",
    embed: "data-collection"
});

const sqlList = (values) => values.map((value) => `'${value}'`).join(", ");

export const VISUAL_BUILDER_STORAGE_STATEMENTS = Object.freeze([
    `CREATE TABLE IF NOT EXISTS visual_themes (
        id TEXT PRIMARY KEY CHECK (length(id) BETWEEN 3 AND 96),
        name TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 120),
        status TEXT NOT NULL DEFAULT 'draft'
            CHECK (status IN ('draft', 'published', 'archived')),
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        published_at INTEGER
    )`,
    `CREATE INDEX IF NOT EXISTS idx_visual_themes_status
        ON visual_themes(status, name COLLATE NOCASE, id)`,
    `CREATE TABLE IF NOT EXISTS visual_theme_tokens (
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
    )`,
    `CREATE TABLE IF NOT EXISTS visual_trees (
        id TEXT PRIMARY KEY CHECK (length(id) BETWEEN 3 AND 96),
        schema_version INTEGER NOT NULL DEFAULT 1 CHECK (schema_version >= 1),
        contract_version INTEGER NOT NULL DEFAULT 1 CHECK (contract_version >= 1),
        status TEXT NOT NULL DEFAULT 'draft'
            CHECK (status IN ('draft', 'published', 'archived')),
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        published_at INTEGER
    )`,
    `CREATE INDEX IF NOT EXISTS idx_visual_trees_status
        ON visual_trees(status, updated_at DESC, id)`,
    `CREATE TABLE IF NOT EXISTS visual_page_trees (
        page_id TEXT PRIMARY KEY,
        tree_id TEXT NOT NULL UNIQUE,
        theme_id TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        FOREIGN KEY (page_id) REFERENCES site_pages(id) ON DELETE RESTRICT,
        FOREIGN KEY (tree_id) REFERENCES visual_trees(id) ON DELETE RESTRICT,
        FOREIGN KEY (theme_id) REFERENCES visual_themes(id) ON DELETE RESTRICT
    )`,
    `CREATE TABLE IF NOT EXISTS visual_nodes (
        id TEXT PRIMARY KEY CHECK (length(id) BETWEEN 3 AND 96),
        tree_id TEXT NOT NULL,
        parent_id TEXT,
        position INTEGER NOT NULL CHECK (position BETWEEN 1 AND 9999),
        block_type TEXT NOT NULL CHECK (block_type IN (${sqlList(VISUAL_BLOCK_TYPES)})),
        label TEXT NOT NULL DEFAULT '' CHECK (length(label) <= 160),
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        UNIQUE (tree_id, id),
        FOREIGN KEY (tree_id) REFERENCES visual_trees(id) ON DELETE RESTRICT,
        FOREIGN KEY (tree_id, parent_id) REFERENCES visual_nodes(tree_id, id)
            ON DELETE NO ACTION DEFERRABLE INITIALLY DEFERRED
    )`,
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_visual_nodes_position
        ON visual_nodes(tree_id, ifnull(parent_id, ''), position)`,
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_visual_nodes_single_root
        ON visual_nodes(tree_id) WHERE parent_id IS NULL`,
    `CREATE INDEX IF NOT EXISTS idx_visual_nodes_parent
        ON visual_nodes(tree_id, parent_id, position, id)`,
    `CREATE TABLE IF NOT EXISTS visual_node_properties (
        node_id TEXT NOT NULL,
        domain TEXT NOT NULL
            CHECK (domain IN ('content', 'presentation', 'behavior', 'technical')),
        property_set TEXT NOT NULL CHECK (property_set IN (${sqlList(VISUAL_PROPERTY_SETS)})),
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
    )`,
    `CREATE INDEX IF NOT EXISTS idx_visual_node_properties_lookup
        ON visual_node_properties(node_id, domain, property_set, breakpoint, item_position)`,
    `CREATE TABLE IF NOT EXISTS visual_reusable_sections (
        id TEXT PRIMARY KEY CHECK (length(id) BETWEEN 3 AND 96),
        name TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 120),
        tree_id TEXT NOT NULL UNIQUE,
        status TEXT NOT NULL DEFAULT 'draft'
            CHECK (status IN ('draft', 'published', 'archived')),
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        published_at INTEGER,
        FOREIGN KEY (tree_id) REFERENCES visual_trees(id) ON DELETE RESTRICT
    )`,
    `CREATE INDEX IF NOT EXISTS idx_visual_reusable_sections_status
        ON visual_reusable_sections(status, name COLLATE NOCASE, id)`
]);

export async function initializeVisualBuilderContent(env) {
    const initialized = await env.DB.prepare(`
        SELECT name FROM content_initializations
        WHERE name = 'visual_builder_v1' LIMIT 1
    `).first();
    if (initialized) return;

    const [pageResult, blockResult] = await Promise.all([
        env.DB.prepare(`
            SELECT id, title, description, status, created_at, updated_at, published_at
            FROM site_pages ORDER BY id
        `).all(),
        env.DB.prepare(`
            SELECT id, page_id, position, block_type, content_json, created_at, updated_at
            FROM page_blocks ORDER BY page_id, position, id
        `).all()
    ]);
    const pages = pageResult.results || [];
    const blocksByPage = new Map();
    for (const block of blockResult.results || []) {
        if (!LEGACY_BLOCK_TYPES[block.block_type]) {
            throw new Error(`Tipo di blocco precedente non mappato: ${block.block_type}`);
        }
        const blocks = blocksByPage.get(block.page_id) || [];
        blocks.push(block);
        blocksByPage.set(block.page_id, blocks);
    }

    const now = Date.now();
    const statements = [env.DB.prepare(`
        INSERT OR IGNORE INTO visual_themes (
            id, name, status, created_at, updated_at, published_at
        ) VALUES ('theme-default', 'Tema originale', 'published', ?, ?, ?)
    `).bind(now, now, now)];

    for (const page of pages) {
        const treeId = `visual-tree-${page.id}`;
        const rootId = `visual-root-${page.id}`;
        statements.push(env.DB.prepare(`
            INSERT OR IGNORE INTO visual_trees (
                id, schema_version, contract_version, status,
                created_at, updated_at, published_at
            ) VALUES (?, 1, 1, ?, ?, ?, ?)
        `).bind(
            treeId,
            page.status,
            page.created_at,
            page.updated_at,
            page.published_at
        ));
        statements.push(env.DB.prepare(`
            INSERT OR IGNORE INTO visual_page_trees (
                page_id, tree_id, theme_id, created_at, updated_at
            ) VALUES (?, ?, 'theme-default', ?, ?)
        `).bind(page.id, treeId, page.created_at, page.updated_at));
        statements.push(env.DB.prepare(`
            INSERT OR IGNORE INTO visual_nodes (
                id, tree_id, parent_id, position, block_type, label,
                created_at, updated_at
            ) VALUES (?, ?, NULL, 1, 'page-root', ?, ?, ?)
        `).bind(rootId, treeId, page.title, page.created_at, page.updated_at));
        statements.push(textProperty(env, rootId, "title", page.title, page.created_at, page.updated_at));
        statements.push(textProperty(env, rootId, "text", page.description, page.created_at, page.updated_at));

        for (const block of blocksByPage.get(page.id) || []) {
            statements.push(env.DB.prepare(`
                INSERT OR IGNORE INTO visual_nodes (
                    id, tree_id, parent_id, position, block_type, label,
                    created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, '', ?, ?)
            `).bind(
                block.id,
                treeId,
                rootId,
                block.position,
                LEGACY_BLOCK_TYPES[block.block_type],
                block.created_at,
                block.updated_at
            ));
            for (const property of legacyProperties(block.content_json)) {
                statements.push(env.DB.prepare(`
                    INSERT OR IGNORE INTO visual_node_properties (
                        node_id, domain, property_set, property_name,
                        breakpoint, item_position, value_kind, text_value,
                        created_at, updated_at
                    ) VALUES (?, ?, ?, ?, 'all', ?, 'text', ?, ?, ?)
                `).bind(
                    block.id,
                    property.domain,
                    property.propertySet,
                    property.name,
                    property.position,
                    property.value,
                    block.created_at,
                    block.updated_at
                ));
            }
        }
    }
    statements.push(env.DB.prepare(`
        INSERT OR IGNORE INTO content_initializations (name, applied_at)
        VALUES ('visual_builder_v1', ?)
    `).bind(now));
    await env.DB.batch(statements);
}

function textProperty(env, nodeId, name, value, createdAt, updatedAt) {
    return env.DB.prepare(`
        INSERT OR IGNORE INTO visual_node_properties (
            node_id, domain, property_set, property_name,
            breakpoint, item_position, value_kind, text_value,
            created_at, updated_at
        ) VALUES (?, 'content', 'content.copy', ?, 'all', 0, 'text', ?, ?, ?)
    `).bind(nodeId, name, String(value || ""), createdAt, updatedAt);
}

function legacyProperties(serialized) {
    let content;
    try {
        content = JSON.parse(serialized);
    } catch (_) {
        throw new Error("Contenuto precedente non valido durante l'importazione visuale");
    }
    if (!content || typeof content !== "object" || Array.isArray(content)) {
        throw new Error("Contenuto precedente non strutturato durante l'importazione visuale");
    }
    const properties = [];
    for (const [name, rawValue] of Object.entries(content)) {
        if (["text", "title", "caption", "eyebrow"].includes(name)) {
            properties.push({
                domain: "content",
                propertySet: name === "caption" ? "content.media" : "content.copy",
                name,
                position: 0,
                value: String(rawValue ?? "")
            });
            continue;
        }
        if (name === "items" && Array.isArray(rawValue)) {
            rawValue.forEach((value, index) => properties.push({
                domain: "content",
                propertySet: "content.copy",
                name,
                position: index + 1,
                value: String(value ?? "")
            }));
            continue;
        }
        if (["alt", "credit", "focalPoint", "assetId"].includes(name)) {
            properties.push({
                domain: "content",
                propertySet: "content.media",
                name,
                position: 0,
                value: String(rawValue ?? "")
            });
            continue;
        }
        if (["href", "fragment"].includes(name)) {
            properties.push({
                domain: "behavior",
                propertySet: "behavior.link",
                name,
                position: 0,
                value: String(rawValue ?? "")
            });
            continue;
        }
        throw new Error(`Proprietà precedente non mappata: ${name}`);
    }
    return properties;
}
