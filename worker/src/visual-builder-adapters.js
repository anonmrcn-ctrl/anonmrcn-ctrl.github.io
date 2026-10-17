export const VISUAL_SPECIALIZED_BLOCK_SEEDS = Object.freeze([
    { pageId: "page-progetto", id: "visual-progetto-map", type: "project-map", adapter: "map-layers", label: "Mappa del progetto" },
    { pageId: "page-progetto", id: "visual-progetto-path", type: "project-path", adapter: "narrative-steps", label: "Percorso poetico" },
    { pageId: "page-progetto", id: "visual-progetto-sources", type: "project-sources", adapter: "sources", label: "Fonti" },
    { pageId: "page-memorie", id: "visual-memorie-map", type: "project-map", adapter: "map-layers", label: "Mappa delle Memorie" },
    { pageId: "page-memorie", id: "visual-memorie-list", type: "project-memories", adapter: "memories", label: "Memorie pubblicate" },
    { pageId: "page-memorie", id: "visual-memorie-form", type: "approved-form", adapter: "memory-form", label: "Invia una Memoria" },
    { pageId: "page-archivio", id: "visual-archivio-list", type: "project-archive", adapter: "public-messages", label: "Messaggi pubblici" },
    { pageId: "page-spazio-pubblico", id: "visual-spazio-voci", type: "project-voices", adapter: "wiki-entries", label: "Voci" },
    { pageId: "page-spazio-pubblico", id: "visual-spazio-luoghi", type: "project-places", adapter: "map-entries", label: "Luoghi" },
    { pageId: "page-taccuino", id: "visual-taccuino-personale", type: "personal-notebook", adapter: "local-notebook", label: "Taccuino personale" },
    { pageId: "page-spazio-personale", id: "visual-spazio-personale", type: "personal-space", adapter: "personal-space", label: "Spazio personale" },
    { pageId: "page-accesso", id: "visual-accesso", type: "special-access", adapter: "location-access", label: "Accesso" }
]);

export async function initializeVisualSpecializedBlocks(env) {
    const initialized = await env.DB.prepare(`
        SELECT name FROM content_initializations
        WHERE name = 'visual_specialized_blocks_v1' LIMIT 1
    `).first();
    if (initialized) return;

    const pageResult = await env.DB.prepare(`
        SELECT mapping.page_id, mapping.tree_id, root.id AS root_id
        FROM visual_page_trees mapping
        INNER JOIN visual_nodes root ON root.tree_id = mapping.tree_id
            AND root.parent_id IS NULL
    `).all();
    const pages = new Map((pageResult.results || []).map((row) => [row.page_id, row]));
    const now = Date.now();
    const statements = [];
    const nextPosition = new Map();

    for (const seed of VISUAL_SPECIALIZED_BLOCK_SEEDS) {
        const page = pages.get(seed.pageId);
        if (!page) throw new Error(`Pagina mancante per l'adattatore ${seed.id}`);
        if (!nextPosition.has(seed.pageId)) {
            const result = await env.DB.prepare(`
                SELECT coalesce(max(position), 0) AS position
                FROM visual_nodes
                WHERE tree_id = ? AND parent_id = ?
            `).bind(page.tree_id, page.root_id).first();
            nextPosition.set(seed.pageId, Number(result?.position || 0));
        }
        const position = nextPosition.get(seed.pageId) + 1;
        nextPosition.set(seed.pageId, position);
        statements.push(env.DB.prepare(`
            INSERT OR IGNORE INTO visual_nodes (
                id, tree_id, parent_id, position, block_type, label,
                created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
            seed.id,
            page.tree_id,
            page.root_id,
            position,
            seed.type,
            seed.label,
            now,
            now
        ));
        statements.push(env.DB.prepare(`
            INSERT OR IGNORE INTO visual_node_properties (
                node_id, domain, property_set, property_name, breakpoint,
                item_position, value_kind, text_value, created_at, updated_at
            ) VALUES (?, 'technical', 'technical.binding', 'adapter', 'all',
                0, 'text', ?, ?, ?)
        `).bind(seed.id, seed.adapter, now, now));
    }
    statements.push(env.DB.prepare(`
        INSERT OR IGNORE INTO content_initializations (name, applied_at)
        VALUES ('visual_specialized_blocks_v1', ?)
    `).bind(now));
    await env.DB.batch(statements);
}

export async function loadVisualAdapterPayloads(env, nodes) {
    const nodeTypes = new Set((nodes || []).map((node) => node.block_type));
    const hasMessageArchive = !nodeTypes.has("project-archive") || Boolean(
        await env.DB.prepare(`
            SELECT name FROM sqlite_master
            WHERE type = 'table' AND name = 'messages'
            LIMIT 1
        `).first()
    );
    const loaders = [];
    const payloadByType = new Map();
    const load = (type, query) => {
        if (!nodeTypes.has(type)) return;
        loaders.push(env.DB.prepare(query).all().then((result) => {
            payloadByType.set(type, result.results || []);
        }));
    };

    load("project-poem", `
        SELECT work.title AS work_title, section.id AS section_id,
            section.title AS section_title, section.position AS section_position,
            line.id AS line_id, line.position AS line_position,
            line.text, line.indent_level
        FROM poem_works work
        INNER JOIN poem_sections section ON section.poem_id = work.id
        INNER JOIN poem_lines line ON line.section_id = section.id
        WHERE work.status = 'published'
        ORDER BY section.position, line.position, line.id
    `);
    load("project-path", `
        SELECT stable_key, position, verse, label, title, title_url, explanation
        FROM narrative_steps WHERE status = 'published'
        ORDER BY position, id
    `);
    load("project-map", `
        SELECT layer.id, layer.slug, layer.title, layer.description,
            count(feature.id) AS feature_count
        FROM map_layers layer
        LEFT JOIN map_features feature ON feature.layer_id = layer.id
            AND feature.status = 'published'
        WHERE layer.status = 'published'
        GROUP BY layer.id, layer.slug, layer.title, layer.description
        ORDER BY layer.position, layer.id
    `);
    load("project-voices", `
        SELECT id, slug, title, summary
        FROM wiki_entries WHERE status = 'published'
        ORDER BY title COLLATE NOCASE, id
    `);
    load("project-places", `
        SELECT id, name, category, description
        FROM map_entries ORDER BY name COLLATE NOCASE, id
    `);
    load("project-sources", `
        SELECT id, title, author, publication_date, url, note
        FROM sources WHERE status = 'published'
        ORDER BY title COLLATE NOCASE, id
    `);
    load("project-memories", `
        SELECT id, title, author_name, text, published_at
        FROM memories
        WHERE status = 'approved' AND consent = 1
        ORDER BY published_at DESC, id DESC
        LIMIT 100
    `);
    if (hasMessageArchive) {
        load("project-archive", `
            SELECT id, text, published_at
            FROM messages
            WHERE is_public = 1
                AND sender_public_consent = 1
                AND recipient_public_consent = 1
            ORDER BY published_at DESC, id DESC
            LIMIT 100
        `);
    }
    await Promise.all(loaders);

    const payloads = new Map();
    for (const node of nodes || []) {
        if (payloadByType.has(node.block_type)) {
            payloads.set(node.id, payloadByType.get(node.block_type));
        } else if (node.block_type === "approved-form") {
            payloads.set(node.id, { kind: "approved-form", form: "memory" });
        } else if (node.block_type === "personal-notebook") {
            payloads.set(node.id, { kind: "local-notebook" });
        } else if (node.block_type === "personal-space") {
            payloads.set(node.id, { kind: "personal-space" });
        } else if (node.block_type === "special-access") {
            payloads.set(node.id, { kind: "location-access" });
        }
    }
    return payloads;
}
