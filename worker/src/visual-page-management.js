const PAGE_ID_PREFIX = "visual-page-";
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;
const STATUSES = new Set(["draft", "published", "archived"]);

export class VisualPageManagementError extends Error {
    constructor(message, status = 400, details = null) {
        super(message);
        this.status = status;
        this.details = details;
    }
}

export async function createVisualPage(env, rawInput) {
    const input = normalizeCreate(rawInput);
    await assertSlugAvailable(env, input.slug);
    const source = input.sourcePageId
        ? await readPageWithTree(env, input.sourcePageId)
        : null;
    if (input.sourcePageId && !source) {
        throw new VisualPageManagementError("Il modello scelto non esiste.", 404);
    }

    const suffix = crypto.randomUUID();
    const pageId = `${PAGE_ID_PREFIX}${suffix}`;
    const treeId = `visual-tree-${suffix}`;
    const rootId = `visual-root-${suffix}`;
    const now = Date.now();
    const statements = [
        env.DB.prepare(`
            INSERT INTO site_pages (
                id, slug, title, description, status,
                created_at, updated_at, published_at
            ) VALUES (?, ?, ?, ?, 'draft', ?, ?, NULL)
        `).bind(pageId, input.slug, input.title, input.description, now, now),
        env.DB.prepare(`
            INSERT INTO visual_trees (
                id, schema_version, contract_version, status,
                created_at, updated_at, published_at
            ) VALUES (?, 1, 2, 'draft', ?, ?, NULL)
        `).bind(treeId, now, now),
        env.DB.prepare(`
            INSERT INTO visual_page_trees (
                page_id, tree_id, theme_id, created_at, updated_at
            ) VALUES (
                ?, ?, (SELECT id FROM visual_themes WHERE id = 'theme-default'), ?, ?
            )
        `).bind(pageId, treeId, now, now),
        env.DB.prepare(`
            INSERT INTO permalinks (
                id, path, target_type, target_id, state, redirect_path,
                created_at, updated_at
            ) VALUES (?, ?, 'site_page', ?, 'active', NULL, ?, ?)
        `).bind(`permalink-${crypto.randomUUID()}`, canonicalPath(input.slug), pageId, now, now)
    ];

    let nodes;
    if (source) {
        nodes = await cloneSource(env, source, treeId, rootId, input, now, statements);
    } else {
        nodes = [{
            id: rootId, tree_id: treeId, parent_id: null, position: 1,
            block_type: "page-root", label: input.title
        }];
        statements.push(env.DB.prepare(`
            INSERT INTO visual_nodes (
                id, tree_id, parent_id, position, block_type, label,
                created_at, updated_at
            ) VALUES (?, ?, NULL, 1, 'page-root', ?, ?, ?)
        `).bind(rootId, treeId, input.title, now, now));
        statements.push(copyProperty(env, rootId, "title", input.title, now));
        if (input.description) {
            statements.push(copyProperty(env, rootId, "text", input.description, now));
        }
    }

    if (input.includeInNavigation) {
        const position = await nextNavigationPosition(env);
        statements.push(env.DB.prepare(`
            INSERT INTO navigation_items (
                id, menu_key, parent_id, position, label, href,
                visibility, status, created_at, updated_at, published_at
            ) VALUES (?, 'main', NULL, ?, ?, ?, 'public', 'draft', ?, ?, NULL)
        `).bind(
            `nav-${crypto.randomUUID()}`,
            position,
            input.navigationLabel || input.title,
            `./${input.slug}.html`,
            now,
            now
        ));
    }

    statements.push(env.DB.prepare(`
        INSERT INTO content_revisions (
            entity_type, entity_id, revision_number, snapshot_json,
            publication_state, created_at
        ) VALUES ('site_page', ?, 1, ?, 'draft', ?)
    `).bind(pageId, JSON.stringify(pageSnapshot({
        id: pageId, slug: input.slug, title: input.title,
        description: input.description, status: "draft"
    })), now));
    statements.push(env.DB.prepare(`
        INSERT INTO content_revisions (
            entity_type, entity_id, revision_number, snapshot_json,
            publication_state, created_at
        ) VALUES ('visual_tree', ?, 1, ?, 'draft', ?)
    `).bind(treeId, JSON.stringify({ pageId, treeId, nodes, sourcePageId: source?.page_id || null }), now));

    await env.DB.batch(statements);
    return {
        created: true,
        page: await lifecycleRecord(env, pageId)
    };
}

export async function updateVisualPageLifecycle(env, pageId, rawInput) {
    const current = await readPageWithTree(env, pageId);
    if (!current) throw new VisualPageManagementError("Pagina visuale non trovata.", 404);
    const input = normalizeUpdate(rawInput);
    if (input.expectedUpdatedAt !== Number(current.updated_at)) {
        throw new VisualPageManagementError(
            "La pagina è stata modificata altrove. Ricaricala prima di salvare.",
            409
        );
    }
    if (input.slug !== current.slug) await assertSlugAvailable(env, input.slug, pageId);
    const oldPath = canonicalPath(current.slug);
    const newPath = canonicalPath(input.slug);
    const now = Math.max(Date.now(), Number(current.updated_at) + 1);
    const statements = [env.DB.prepare(`
        UPDATE site_pages SET
            slug = ?, title = ?, description = ?, status = ?, updated_at = ?,
            published_at = CASE
                WHEN ? = 'published' THEN COALESCE(published_at, ?)
                ELSE published_at
            END
        WHERE id = ?
    `).bind(
        input.slug, input.title, input.description, input.status, now,
        input.status, now, pageId
    ), env.DB.prepare(`
        UPDATE visual_trees SET
            status = ?, updated_at = ?,
            published_at = CASE
                WHEN ? = 'published' THEN COALESCE(published_at, ?)
                ELSE published_at
            END
        WHERE id = ?
    `).bind(input.status, now, input.status, now, current.tree_id), env.DB.prepare(`
        UPDATE visual_page_trees SET updated_at = ? WHERE page_id = ?
    `).bind(now, pageId), env.DB.prepare(`
        UPDATE visual_nodes SET label = ?, updated_at = ?
        WHERE tree_id = ? AND parent_id IS NULL
    `).bind(input.title, now, current.tree_id)];

    const root = await env.DB.prepare(`
        SELECT id FROM visual_nodes
        WHERE tree_id = ? AND parent_id IS NULL LIMIT 1
    `).bind(current.tree_id).first();
    for (const name of ["title", "text"]) {
        statements.push(env.DB.prepare(`
            DELETE FROM visual_node_properties
            WHERE node_id = ? AND property_set = 'content.copy'
                AND property_name = ? AND breakpoint = 'all'
        `).bind(root.id, name));
    }
    statements.push(copyProperty(env, root.id, "title", input.title, now));
    if (input.description) statements.push(copyProperty(env, root.id, "text", input.description, now));

    if (oldPath !== newPath) {
        statements.push(env.DB.prepare(`
            UPDATE permalinks
            SET state = 'redirect', redirect_path = ?, updated_at = ?
            WHERE path = ? AND target_type = 'site_page' AND target_id = ?
        `).bind(newPath, now, oldPath, pageId));
        statements.push(env.DB.prepare(`
            INSERT INTO permalinks (
                id, path, target_type, target_id, state, redirect_path,
                created_at, updated_at
            ) VALUES (?, ?, 'site_page', ?, 'active', NULL, ?, ?)
        `).bind(`permalink-${crypto.randomUUID()}`, newPath, pageId, now, now));
    }

    const navigation = await navigationForSlug(env, current.slug);
    if (input.includeInNavigation) {
        const navigationStatus = input.status === "published" ? "published" : "draft";
        if (navigation.length) {
            for (const item of navigation) statements.push(env.DB.prepare(`
                UPDATE navigation_items SET label = ?, href = ?, status = ?,
                    updated_at = ?, published_at = CASE
                        WHEN ? = 'published' THEN COALESCE(published_at, ?)
                        ELSE published_at
                    END
                WHERE id = ?
            `).bind(
                input.navigationLabel || input.title,
                `./${input.slug}.html`,
                navigationStatus,
                now,
                navigationStatus,
                now,
                item.id
            ));
        } else {
            const position = await nextNavigationPosition(env);
            statements.push(env.DB.prepare(`
                INSERT INTO navigation_items (
                    id, menu_key, parent_id, position, label, href,
                    visibility, status, created_at, updated_at, published_at
                ) VALUES (?, 'main', NULL, ?, ?, ?, 'public', ?, ?, ?, ?)
            `).bind(
                `nav-${crypto.randomUUID()}`,
                position,
                input.navigationLabel || input.title,
                `./${input.slug}.html`,
                navigationStatus,
                now,
                now,
                navigationStatus === "published" ? now : null
            ));
        }
    } else {
        for (const item of navigation) statements.push(env.DB.prepare(`
            UPDATE navigation_items
            SET status = 'archived', updated_at = ? WHERE id = ?
        `).bind(now, item.id));
    }

    statements.push(revisionStatement(env, "site_page", pageId, pageSnapshot({
        id: pageId,
        slug: input.slug,
        title: input.title,
        description: input.description,
        status: input.status,
        previousSlug: current.slug
    }), input.status, now));
    statements.push(revisionStatement(env, "visual_tree", current.tree_id, {
        pageId,
        treeId: current.tree_id,
        lifecycle: { slug: input.slug, title: input.title, status: input.status }
    }, input.status, now));
    await env.DB.batch(statements);
    return { page: await lifecycleRecord(env, pageId), unchanged: false };
}

export async function readVisualPageDependencies(env, pageId) {
    const page = await readPageWithTree(env, pageId);
    if (!page) throw new VisualPageManagementError("Pagina visuale non trovata.", 404);
    const [permalinks, navigation, pageReferences, sourceLinks, reusable] = await Promise.all([
        env.DB.prepare(`
            SELECT id, path, state, redirect_path FROM permalinks
            WHERE target_type = 'site_page' AND target_id = ? ORDER BY path
        `).bind(pageId).all(),
        navigationForSlug(env, page.slug),
        env.DB.prepare(`
            SELECT property.node_id, node.tree_id
            FROM visual_node_properties property
            INNER JOIN visual_nodes node ON node.id = property.node_id
            WHERE property.page_reference_id = ? AND node.tree_id <> ?
        `).bind(pageId, page.tree_id).all(),
        env.DB.prepare(`
            SELECT content_type, content_id, source_id
            FROM content_source_links
            WHERE content_type = 'site_page' AND content_id = ?
        `).bind(pageId).all(),
        env.DB.prepare(`
            SELECT section.id, instance.node_id
            FROM visual_reusable_instances instance
            INNER JOIN visual_reusable_sections section
                ON section.id = instance.section_id
            WHERE instance.page_id = ?
            UNION ALL
            SELECT id, NULL AS node_id
            FROM visual_reusable_sections WHERE tree_id = ?
        `).bind(pageId, page.tree_id).all()
    ]);
    const result = {
        pageId,
        slug: page.slug,
        status: page.status,
        builderManaged: page.id.startsWith(PAGE_ID_PREFIX),
        permalinks: permalinks.results || [],
        navigation: navigation.map((item) => ({ id: item.id, href: item.href })),
        pageReferences: pageReferences.results || [],
        sourceLinks: sourceLinks.results || [],
        reusableSections: reusable.results || []
    };
    result.hardDeleteBlocked = !result.builderManaged || page.status !== "archived" ||
        result.pageReferences.length > 0 || result.sourceLinks.length > 0 ||
        result.reusableSections.length > 0;
    return result;
}

export async function deleteVisualPage(env, pageId, rawInput) {
    const dependencies = await readVisualPageDependencies(env, pageId);
    if (!dependencies.builderManaged) {
        throw new VisualPageManagementError(
            "Le pagine storiche possono essere archiviate ma non eliminate dal builder.",
            409,
            dependencies
        );
    }
    if (dependencies.status !== "archived") {
        throw new VisualPageManagementError(
            "Archivia la pagina prima della cancellazione definitiva.", 409, dependencies
        );
    }
    if (String(rawInput?.confirmation || "") !== `ELIMINA ${dependencies.slug}`) {
        throw new VisualPageManagementError("La conferma di cancellazione non coincide.");
    }
    const redirectPath = String(rawInput?.redirectPath || "").trim();
    const replacement = await env.DB.prepare(`
        SELECT path FROM permalinks
        WHERE path = ? AND state = 'active'
            AND NOT (target_type = 'site_page' AND target_id = ?)
        LIMIT 1
    `).bind(redirectPath, pageId).first();
    if (!replacement) {
        throw new VisualPageManagementError(
            "Scegli come destinazione un permalink attivo di un’altra pagina.",
            409,
            dependencies
        );
    }
    if (dependencies.pageReferences.length || dependencies.sourceLinks.length ||
        dependencies.reusableSections.length) {
        throw new VisualPageManagementError(
            "La pagina ha dati collegati: riassegnali prima di eliminarla.",
            409,
            dependencies
        );
    }
    const page = await readPageWithTree(env, pageId);
    const now = Date.now();
    await env.DB.batch([
        env.DB.prepare(`
            UPDATE permalinks SET state = 'redirect', redirect_path = ?, updated_at = ?
            WHERE target_type = 'site_page' AND target_id = ?
        `).bind(redirectPath, now, pageId),
        env.DB.prepare(`
            UPDATE navigation_items SET href = ?, status = 'archived', updated_at = ?
            WHERE href IN (?, ?, ?)
        `).bind(
            redirectPath, now,
            `./${page.slug}.html`, `/${page.slug}.html`, `${page.slug}.html`
        ),
        env.DB.prepare(`
            DELETE FROM visual_node_properties
            WHERE node_id IN (SELECT id FROM visual_nodes WHERE tree_id = ?)
        `).bind(page.tree_id),
        env.DB.prepare(`DELETE FROM visual_nodes WHERE tree_id = ?`).bind(page.tree_id),
        env.DB.prepare(`DELETE FROM visual_page_trees WHERE page_id = ?`).bind(pageId),
        env.DB.prepare(`DELETE FROM visual_trees WHERE id = ?`).bind(page.tree_id),
        env.DB.prepare(`DELETE FROM page_blocks WHERE page_id = ?`).bind(pageId),
        env.DB.prepare(`DELETE FROM site_pages WHERE id = ?`).bind(pageId)
    ]);
    return { deleted: true, pageId, redirectPath, preservedPermalinks: dependencies.permalinks.length };
}

async function cloneSource(env, source, treeId, rootId, input, now, statements) {
    const [nodeResult, propertyResult] = await Promise.all([
        env.DB.prepare(`
            SELECT id, parent_id, position, block_type, label
            FROM visual_nodes WHERE tree_id = ?
            ORDER BY ifnull(parent_id, ''), position, id
        `).bind(source.tree_id).all(),
        env.DB.prepare(`
            SELECT property.* FROM visual_node_properties property
            INNER JOIN visual_nodes node ON node.id = property.node_id
            WHERE node.tree_id = ?
        `).bind(source.tree_id).all()
    ]);
    const sourceNodes = nodeResult.results || [];
    const sourceRoot = sourceNodes.find((node) => !node.parent_id);
    const ids = new Map(sourceNodes.map((node) => [
        node.id,
        node.id === sourceRoot.id ? rootId : `visual-${crypto.randomUUID()}`
    ]));
    const nodes = sourceNodes.map((node) => ({
        id: ids.get(node.id),
        tree_id: treeId,
        parent_id: node.parent_id ? ids.get(node.parent_id) : null,
        position: Number(node.position),
        block_type: node.block_type,
        label: node.id === sourceRoot.id ? input.title : node.label
    }));
    for (const node of nodes) statements.push(env.DB.prepare(`
        INSERT INTO visual_nodes (
            id, tree_id, parent_id, position, block_type, label,
            created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
        node.id, node.tree_id, node.parent_id, node.position,
        node.block_type, node.label, now, now
    ));
    for (const property of propertyResult.results || []) {
        if (property.node_id === sourceRoot.id &&
            property.property_set === "content.copy" &&
            ["title", "text"].includes(property.property_name)) continue;
        statements.push(env.DB.prepare(`
            INSERT INTO visual_node_properties (
                node_id, domain, property_set, property_name, breakpoint,
                item_position, value_kind, text_value, number_value,
                boolean_value, asset_id, page_reference_id, collection_key,
                created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
            ids.get(property.node_id), property.domain, property.property_set,
            property.property_name, property.breakpoint, property.item_position,
            property.value_kind, property.text_value, property.number_value,
            property.boolean_value, property.asset_id, property.page_reference_id,
            property.collection_key, now, now
        ));
    }
    statements.push(copyProperty(env, rootId, "title", input.title, now));
    if (input.description) statements.push(copyProperty(env, rootId, "text", input.description, now));
    return nodes;
}

function copyProperty(env, nodeId, name, value, now) {
    return env.DB.prepare(`
        INSERT INTO visual_node_properties (
            node_id, domain, property_set, property_name, breakpoint,
            item_position, value_kind, text_value, created_at, updated_at
        ) VALUES (?, 'content', 'content.copy', ?, 'all', 0, 'text', ?, ?, ?)
    `).bind(nodeId, name, value, now, now);
}

function revisionStatement(env, type, id, snapshot, status, now) {
    return env.DB.prepare(`
        INSERT INTO content_revisions (
            entity_type, entity_id, revision_number, snapshot_json,
            publication_state, created_at
        ) SELECT ?, ?, COALESCE(MAX(revision_number), 0) + 1, ?, ?, ?
        FROM content_revisions WHERE entity_type = ? AND entity_id = ?
    `).bind(type, id, JSON.stringify(snapshot), status, now, type, id);
}

async function assertSlugAvailable(env, slug, excludedPageId = "") {
    const path = canonicalPath(slug);
    const [page, permalink] = await Promise.all([
        env.DB.prepare(`
            SELECT id FROM site_pages WHERE slug = ? AND id <> ? LIMIT 1
        `).bind(slug, excludedPageId).first(),
        env.DB.prepare(`
            SELECT target_id FROM permalinks
            WHERE path = ? AND NOT (target_type = 'site_page' AND target_id = ?)
            LIMIT 1
        `).bind(path, excludedPageId).first()
    ]);
    if (page || permalink) {
        throw new VisualPageManagementError("Slug o URL già utilizzato.", 409);
    }
}

async function readPageWithTree(env, pageId) {
    return env.DB.prepare(`
        SELECT page.id, page.id AS page_id, page.slug, page.title,
            page.description, page.status, page.created_at,
            max(page.updated_at, tree.updated_at) AS updated_at,
            page.published_at, mapping.tree_id
        FROM site_pages page
        INNER JOIN visual_page_trees mapping ON mapping.page_id = page.id
        INNER JOIN visual_trees tree ON tree.id = mapping.tree_id
        WHERE page.id = ? LIMIT 1
    `).bind(pageId).first();
}

async function lifecycleRecord(env, pageId) {
    const row = await readPageWithTree(env, pageId);
    return {
        id: row.id,
        slug: row.slug,
        title: row.title,
        description: row.description,
        status: row.status,
        canonicalPath: canonicalPath(row.slug),
        builderManaged: row.id.startsWith(PAGE_ID_PREFIX),
        createdAt: Number(row.created_at),
        updatedAt: Number(row.updated_at),
        publishedAt: row.published_at === null ? null : Number(row.published_at)
    };
}

async function navigationForSlug(env, slug) {
    const result = await env.DB.prepare(`
        SELECT id, href, label, status FROM navigation_items
        WHERE href IN (?, ?, ?) ORDER BY id
    `).bind(`./${slug}.html`, `/${slug}.html`, `${slug}.html`).all();
    return result.results || [];
}

async function nextNavigationPosition(env) {
    const row = await env.DB.prepare(`
        SELECT COALESCE(MAX(position), 0) + 1 AS position
        FROM navigation_items WHERE menu_key = 'main' AND parent_id IS NULL
    `).first();
    return Number(row?.position || 1);
}

function normalizeCreate(value) {
    const common = normalizeCommon(value);
    return {
        ...common,
        sourcePageId: String(value?.sourcePageId || "").trim() || null,
        includeInNavigation: value?.includeInNavigation === true,
        navigationLabel: normalizeNavigationLabel(value?.navigationLabel)
    };
}

function normalizeUpdate(value) {
    const common = normalizeCommon(value);
    const status = String(value?.status || "");
    const expectedUpdatedAt = Number(value?.expectedUpdatedAt);
    if (!STATUSES.has(status)) throw new VisualPageManagementError("Stato editoriale non valido.");
    if (!Number.isSafeInteger(expectedUpdatedAt) || expectedUpdatedAt < 1) {
        throw new VisualPageManagementError("Versione della pagina non valida.");
    }
    return {
        ...common,
        status,
        expectedUpdatedAt,
        includeInNavigation: value?.includeInNavigation === true,
        navigationLabel: normalizeNavigationLabel(value?.navigationLabel)
    };
}

function normalizeCommon(value) {
    const title = String(value?.title || "").trim();
    const description = String(value?.description || "").trim();
    const slug = String(value?.slug || "").trim().toLowerCase();
    if (!title || title.length > 200) {
        throw new VisualPageManagementError("Il titolo deve contenere da 1 a 200 caratteri.");
    }
    if (description.length > 500) {
        throw new VisualPageManagementError("La descrizione non può superare 500 caratteri.");
    }
    if (!SLUG_PATTERN.test(slug) || slug.length > 160 || ["admin", "api"].includes(slug)) {
        throw new VisualPageManagementError("Lo slug può contenere solo lettere minuscole, numeri e trattini.");
    }
    return { title, description, slug };
}

function normalizeNavigationLabel(value) {
    const label = String(value || "").trim();
    if (label.length > 160) throw new VisualPageManagementError("Etichetta di menu troppo lunga.");
    return label;
}

function canonicalPath(slug) {
    return `/${slug}.html`;
}

function pageSnapshot(page) {
    return {
        id: page.id,
        slug: page.slug,
        title: page.title,
        description: page.description,
        status: page.status,
        canonicalPath: canonicalPath(page.slug)
    };
}
