import { validateVisualTreeStructure } from "./visual-builder-renderer.js";

const NAME_LIMIT = 120;

export class VisualSectionLibraryError extends Error {
    constructor(message, status = 400) {
        super(message);
        this.status = status;
    }
}

export async function listVisualSections(env) {
    const result = await env.DB.prepare(`
        SELECT section.id, section.name, section.status, section.created_at,
            section.updated_at, section.published_at, section.tree_id,
            node.id AS source_node_id, node.block_type,
            (SELECT count(*) FROM visual_reusable_instances instance
                WHERE instance.section_id = section.id) AS impact_count
        FROM visual_reusable_sections section
        INNER JOIN visual_nodes root
            ON root.tree_id = section.tree_id AND root.parent_id IS NULL
        INNER JOIN visual_nodes node
            ON node.tree_id = section.tree_id AND node.parent_id = root.id
        ORDER BY section.name COLLATE NOCASE, section.id
    `).all();
    return { sections: (result.results || []).map(sectionRecord) };
}

export async function createVisualSection(env, rawInput) {
    const input = normalizeSourceInput(rawInput);
    const source = await readPageNode(env, input.pageId, input.nodeId);
    if (!source || !source.parent_id) {
        throw new VisualSectionLibraryError("Seleziona un blocco interno della pagina.", 404);
    }
    const suffix = crypto.randomUUID();
    const sectionId = `visual-section-${suffix}`;
    const treeId = `visual-library-${suffix}`;
    const wrapperId = `visual-library-root-${suffix}`;
    const now = Date.now();
    const snapshot = await readSubtree(env, source.tree_id, source.id);
    const cloned = cloneSubtree(snapshot, treeId, wrapperId, 1);
    const statements = [
        env.DB.prepare(`
            INSERT INTO visual_trees (
                id, schema_version, contract_version, status,
                created_at, updated_at, published_at
            ) VALUES (?, 1, 2, 'draft', ?, ?, NULL)
        `).bind(treeId, now, now),
        env.DB.prepare(`
            INSERT INTO visual_nodes (
                id, tree_id, parent_id, position, block_type, label,
                created_at, updated_at
            ) VALUES (?, ?, NULL, 1, 'page-root', ?, ?, ?)
        `).bind(wrapperId, treeId, input.name, now, now),
        env.DB.prepare(`
            INSERT INTO visual_reusable_sections (
                id, name, tree_id, status, created_at, updated_at, published_at
            ) VALUES (?, ?, ?, 'draft', ?, ?, NULL)
        `).bind(sectionId, input.name, treeId, now, now)
    ];
    pushClone(statements, env, cloned, now);
    statements.push(revisionStatement(env, treeId, {
        action: "create_reusable_section",
        sectionId,
        source: { pageId: input.pageId, nodeId: input.nodeId },
        nodes: cloned.nodes
    }, "draft", now));
    await env.DB.batch(statements);
    return { created: true, section: await readSection(env, sectionId) };
}

export async function updateVisualSection(env, sectionId, rawInput) {
    const input = normalizeSourceInput(rawInput, true);
    const section = await readSectionRow(env, sectionId);
    if (!section) throw new VisualSectionLibraryError("Sezione riutilizzabile non trovata.", 404);
    if (input.expectedUpdatedAt !== Number(section.updated_at)) {
        throw new VisualSectionLibraryError("La sezione è stata modificata altrove.", 409);
    }
    const source = await readPageNode(env, input.pageId, input.nodeId);
    if (!source || !source.parent_id) {
        throw new VisualSectionLibraryError("Seleziona un blocco interno della pagina.", 404);
    }
    const existing = await readSubtree(env, section.tree_id, section.source_node_id);
    const incoming = await readSubtree(env, source.tree_id, source.id);
    const now = Math.max(Date.now(), Number(section.updated_at) + 1);
    const cloned = cloneSubtree(incoming, section.tree_id, section.wrapper_id, 1);
    const statements = [];
    pushDeleteSubtree(statements, env, existing);
    pushClone(statements, env, cloned, now);
    statements.push(env.DB.prepare(`
        UPDATE visual_reusable_sections
        SET name = ?, status = 'draft', updated_at = ? WHERE id = ?
    `).bind(input.name, now, sectionId));
    statements.push(env.DB.prepare(`
        UPDATE visual_trees SET status = 'draft', updated_at = ? WHERE id = ?
    `).bind(now, section.tree_id));
    statements.push(revisionStatement(env, section.tree_id, {
        action: "update_reusable_section",
        sectionId,
        source: { pageId: input.pageId, nodeId: input.nodeId },
        nodes: cloned.nodes
    }, "draft", now));
    await env.DB.batch(statements);
    return { section: await readSection(env, sectionId) };
}

export async function duplicateVisualSection(env, sectionId, rawInput) {
    const section = await readSectionRow(env, sectionId);
    if (!section) throw new VisualSectionLibraryError("Sezione riutilizzabile non trovata.", 404);
    const name = normalizeName(rawInput?.name || `${section.name} (copia)`);
    const snapshot = await readSubtree(env, section.tree_id, section.source_node_id);
    const suffix = crypto.randomUUID();
    const newSectionId = `visual-section-${suffix}`;
    const treeId = `visual-library-${suffix}`;
    const wrapperId = `visual-library-root-${suffix}`;
    const now = Date.now();
    const cloned = cloneSubtree(snapshot, treeId, wrapperId, 1);
    const statements = [
        env.DB.prepare(`
            INSERT INTO visual_trees (
                id, schema_version, contract_version, status,
                created_at, updated_at, published_at
            ) VALUES (?, 1, 2, 'draft', ?, ?, NULL)
        `).bind(treeId, now, now),
        env.DB.prepare(`
            INSERT INTO visual_nodes (
                id, tree_id, parent_id, position, block_type, label,
                created_at, updated_at
            ) VALUES (?, ?, NULL, 1, 'page-root', ?, ?, ?)
        `).bind(wrapperId, treeId, name, now, now),
        env.DB.prepare(`
            INSERT INTO visual_reusable_sections (
                id, name, tree_id, status, created_at, updated_at, published_at
            ) VALUES (?, ?, ?, 'draft', ?, ?, NULL)
        `).bind(newSectionId, name, treeId, now, now)
    ];
    pushClone(statements, env, cloned, now);
    statements.push(revisionStatement(env, treeId, {
        action: "duplicate_reusable_section",
        sectionId: newSectionId,
        copiedFrom: sectionId,
        nodes: cloned.nodes
    }, "draft", now));
    await env.DB.batch(statements);
    return { created: true, section: await readSection(env, newSectionId) };
}

export async function insertVisualSection(env, sectionId, rawInput) {
    const section = await readSectionRow(env, sectionId);
    if (!section) throw new VisualSectionLibraryError("Sezione riutilizzabile non trovata.", 404);
    const pageId = String(rawInput?.pageId || "");
    const parentNodeId = String(rawInput?.parentNodeId || "");
    const expectedUpdatedAt = Number(rawInput?.expectedUpdatedAt);
    const linked = rawInput?.mode !== "copy";
    const page = await readPage(env, pageId);
    if (!page) throw new VisualSectionLibraryError("Pagina visuale non trovata.", 404);
    if (expectedUpdatedAt !== Number(page.updated_at)) {
        throw new VisualSectionLibraryError("La pagina è stata modificata altrove.", 409);
    }
    if (page.status === "published" && section.status !== "published") {
        throw new VisualSectionLibraryError(
            "Pubblica prima la sezione oppure inseriscila in una pagina in bozza.", 409
        );
    }
    const parent = await env.DB.prepare(`
        SELECT id FROM visual_nodes WHERE id = ? AND tree_id = ? LIMIT 1
    `).bind(parentNodeId, page.tree_id).first();
    if (!parent) throw new VisualSectionLibraryError("Blocco di destinazione non trovato.", 404);
    const current = await readTree(env, page.tree_id);
    const source = await readSubtree(env, section.tree_id, section.source_node_id);
    const positionRow = await env.DB.prepare(`
        SELECT COALESCE(MAX(position), 0) + 1 AS position
        FROM visual_nodes WHERE tree_id = ? AND parent_id = ?
    `).bind(page.tree_id, parentNodeId).first();
    const cloned = cloneSubtree(
        source,
        page.tree_id,
        parentNodeId,
        Number(positionRow?.position || 1)
    );
    validateVisualTreeStructure([...current.nodes, ...cloned.nodes]);
    const now = Math.max(Date.now(), Number(page.updated_at) + 1);
    const statements = [];
    pushClone(statements, env, cloned, now);
    if (linked) statements.push(env.DB.prepare(`
        INSERT INTO visual_reusable_instances (
            id, section_id, page_id, node_id, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?)
    `).bind(
        `visual-instance-${crypto.randomUUID()}`,
        sectionId,
        pageId,
        cloned.nodes.find((node) => node.parent_id === parentNodeId)?.id,
        now,
        now
    ));
    pushPageTouch(statements, env, page, now);
    statements.push(revisionStatement(env, page.tree_id, {
        action: linked ? "insert_linked_section" : "insert_section_copy",
        sectionId,
        pageId,
        nodes: cloned.nodes
    }, page.status, now));
    await env.DB.batch(statements);
    return {
        pageId,
        linked,
        nodeId: cloned.nodes.find((node) => node.parent_id === parentNodeId)?.id,
        updatedAt: now
    };
}

export async function unlinkVisualSection(env, pageId, nodeId, rawInput) {
    const expectedUpdatedAt = Number(rawInput?.expectedUpdatedAt);
    const page = await readPage(env, pageId);
    if (!page) throw new VisualSectionLibraryError("Pagina visuale non trovata.", 404);
    if (expectedUpdatedAt !== Number(page.updated_at)) {
        throw new VisualSectionLibraryError("La pagina è stata modificata altrove.", 409);
    }
    const instance = await env.DB.prepare(`
        SELECT id, section_id FROM visual_reusable_instances
        WHERE page_id = ? AND node_id = ? LIMIT 1
    `).bind(pageId, nodeId).first();
    if (!instance) throw new VisualSectionLibraryError("Il blocco non è collegato alla libreria.", 404);
    const now = Math.max(Date.now(), Number(page.updated_at) + 1);
    const statements = [env.DB.prepare(`
        DELETE FROM visual_reusable_instances WHERE id = ?
    `).bind(instance.id)];
    pushPageTouch(statements, env, page, now);
    statements.push(revisionStatement(env, page.tree_id, {
        action: "unlink_reusable_section",
        sectionId: instance.section_id,
        pageId,
        nodeId
    }, page.status, now));
    await env.DB.batch(statements);
    return { unlinked: true, pageId, nodeId, updatedAt: now };
}

export async function visualSectionImpact(env, sectionId) {
    const section = await readSection(env, sectionId);
    if (!section) throw new VisualSectionLibraryError("Sezione riutilizzabile non trovata.", 404);
    const result = await env.DB.prepare(`
        SELECT instance.page_id, instance.node_id, page.title, page.slug,
            page.status
        FROM visual_reusable_instances instance
        INNER JOIN site_pages page ON page.id = instance.page_id
        WHERE instance.section_id = ?
        ORDER BY page.title COLLATE NOCASE, instance.node_id
    `).bind(sectionId).all();
    return { section, pages: result.results || [], impactCount: (result.results || []).length };
}

export async function publishVisualSection(env, sectionId, rawInput) {
    const section = await readSectionRow(env, sectionId);
    if (!section) throw new VisualSectionLibraryError("Sezione riutilizzabile non trovata.", 404);
    const expectedUpdatedAt = Number(rawInput?.expectedUpdatedAt);
    if (expectedUpdatedAt !== Number(section.updated_at)) {
        throw new VisualSectionLibraryError("La sezione è stata modificata altrove.", 409);
    }
    const impact = await visualSectionImpact(env, sectionId);
    const source = await readSubtree(env, section.tree_id, section.source_node_id);
    const now = Math.max(Date.now(), Number(section.updated_at) + 1);
    const statements = [
        env.DB.prepare(`
            UPDATE visual_reusable_sections
            SET status = 'published', updated_at = ?,
                published_at = COALESCE(published_at, ?)
            WHERE id = ?
        `).bind(now, now, sectionId),
        env.DB.prepare(`
            UPDATE visual_trees SET status = 'published', updated_at = ?,
                published_at = COALESCE(published_at, ?)
            WHERE id = ?
        `).bind(now, now, section.tree_id),
        revisionStatement(env, section.tree_id, {
            action: "publish_reusable_section",
            sectionId,
            impact: impact.pages
        }, "published", now)
    ];
    for (const reference of impact.pages) {
        const page = await readPage(env, reference.page_id);
        const current = await readTree(env, page.tree_id);
        const root = current.nodes.find((node) => node.id === reference.node_id);
        if (!root) throw new VisualSectionLibraryError("Un collegamento alla libreria è incompleto.", 409);
        const oldSubtree = subtreeFromRows(current, root.id);
        const cloned = cloneSubtree(source, page.tree_id, root.parent_id, root.position, root.id);
        const proposed = current.nodes
            .filter((node) => !oldSubtree.ids.has(node.id))
            .concat(cloned.nodes);
        validateVisualTreeStructure(proposed);
        pushReplaceInstance(statements, env, oldSubtree, cloned, now);
        statements.push(env.DB.prepare(`
            UPDATE visual_reusable_instances SET updated_at = ?
            WHERE section_id = ? AND page_id = ? AND node_id = ?
        `).bind(now, sectionId, page.id, reference.node_id));
        pushPageTouch(statements, env, page, now);
        statements.push(revisionStatement(env, page.tree_id, {
            action: "synchronize_reusable_section",
            sectionId,
            pageId: page.id,
            nodeId: root.id
        }, page.status, now));
    }
    await env.DB.batch(statements);
    return { published: true, synchronized: impact.impactCount, section: await readSection(env, sectionId) };
}

async function readSection(env, sectionId) {
    const row = await readSectionRow(env, sectionId);
    return row ? sectionRecord(row) : null;
}

async function readSectionRow(env, sectionId) {
    return env.DB.prepare(`
        SELECT section.id, section.name, section.status, section.created_at,
            section.updated_at, section.published_at, section.tree_id,
            root.id AS wrapper_id, node.id AS source_node_id,
            node.block_type,
            (SELECT count(*) FROM visual_reusable_instances instance
                WHERE instance.section_id = section.id) AS impact_count
        FROM visual_reusable_sections section
        INNER JOIN visual_nodes root
            ON root.tree_id = section.tree_id AND root.parent_id IS NULL
        INNER JOIN visual_nodes node
            ON node.tree_id = section.tree_id AND node.parent_id = root.id
        WHERE section.id = ? LIMIT 1
    `).bind(sectionId).first();
}

function sectionRecord(row) {
    return {
        id: row.id,
        name: row.name,
        status: row.status,
        treeId: row.tree_id,
        sourceNodeId: row.source_node_id,
        blockType: row.block_type,
        kind: String(row.block_type).startsWith("global-") ? "global" : "section",
        impactCount: Number(row.impact_count || 0),
        createdAt: Number(row.created_at),
        updatedAt: Number(row.updated_at),
        publishedAt: row.published_at === null ? null : Number(row.published_at)
    };
}

async function readPage(env, pageId) {
    return env.DB.prepare(`
        SELECT page.id, page.status, tree.id AS tree_id,
            max(page.updated_at, tree.updated_at) AS updated_at
        FROM site_pages page
        INNER JOIN visual_page_trees mapping ON mapping.page_id = page.id
        INNER JOIN visual_trees tree ON tree.id = mapping.tree_id
        WHERE page.id = ? LIMIT 1
    `).bind(pageId).first();
}

async function readPageNode(env, pageId, nodeId) {
    return env.DB.prepare(`
        SELECT node.*, tree.id AS page_tree_id
        FROM visual_nodes node
        INNER JOIN visual_page_trees mapping ON mapping.tree_id = node.tree_id
        INNER JOIN visual_trees tree ON tree.id = mapping.tree_id
        WHERE mapping.page_id = ? AND node.id = ? LIMIT 1
    `).bind(pageId, nodeId).first();
}

async function readTree(env, treeId) {
    const [nodes, properties] = await Promise.all([
        env.DB.prepare(`
            SELECT id, tree_id, parent_id, position, block_type, label
            FROM visual_nodes WHERE tree_id = ?
            ORDER BY ifnull(parent_id, ''), position, id
        `).bind(treeId).all(),
        env.DB.prepare(`
            SELECT property.* FROM visual_node_properties property
            INNER JOIN visual_nodes node ON node.id = property.node_id
            WHERE node.tree_id = ?
        `).bind(treeId).all()
    ]);
    return { nodes: nodes.results || [], properties: properties.results || [] };
}

async function readSubtree(env, treeId, rootId) {
    const tree = await readTree(env, treeId);
    return subtreeFromRows(tree, rootId);
}

function subtreeFromRows(tree, rootId) {
    const ids = new Set([rootId]);
    let changed = true;
    while (changed) {
        changed = false;
        for (const node of tree.nodes) {
            if (node.parent_id && ids.has(node.parent_id) && !ids.has(node.id)) {
                ids.add(node.id);
                changed = true;
            }
        }
    }
    const nodes = tree.nodes.filter((node) => ids.has(node.id));
    if (!nodes.some((node) => node.id === rootId)) {
        throw new VisualSectionLibraryError("Blocco sorgente non trovato.", 404);
    }
    return {
        ids,
        rootId,
        nodes,
        properties: tree.properties.filter((property) => ids.has(property.node_id))
    };
}

function cloneSubtree(snapshot, treeId, parentId, position, preservedRootId = "") {
    const ids = new Map(snapshot.nodes.map((node) => [
        node.id,
        node.id === snapshot.rootId && preservedRootId
            ? preservedRootId
            : `visual-${crypto.randomUUID()}`
    ]));
    const nodes = snapshot.nodes.map((node) => ({
        id: ids.get(node.id),
        tree_id: treeId,
        parent_id: node.id === snapshot.rootId ? parentId : ids.get(node.parent_id),
        position: node.id === snapshot.rootId ? position : Number(node.position),
        block_type: node.block_type,
        label: node.label
    }));
    const properties = snapshot.properties.map((property) => ({
        ...property,
        node_id: ids.get(property.node_id)
    }));
    return { nodes: sortByDepth(nodes), properties };
}

function pushClone(statements, env, clone, now) {
    for (const node of clone.nodes) statements.push(env.DB.prepare(`
        INSERT INTO visual_nodes (
            id, tree_id, parent_id, position, block_type, label,
            created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
        node.id, node.tree_id, node.parent_id, node.position,
        node.block_type, node.label, now, now
    ));
    for (const property of clone.properties) statements.push(env.DB.prepare(`
        INSERT INTO visual_node_properties (
            node_id, domain, property_set, property_name, breakpoint,
            item_position, value_kind, text_value, number_value,
            boolean_value, asset_id, page_reference_id, collection_key,
            created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
        property.node_id, property.domain, property.property_set,
        property.property_name, property.breakpoint, property.item_position,
        property.value_kind, property.text_value, property.number_value,
        property.boolean_value, property.asset_id, property.page_reference_id,
        property.collection_key, now, now
    ));
}

function pushDeleteSubtree(statements, env, snapshot) {
    for (const node of [...snapshot.nodes].reverse()) {
        statements.push(env.DB.prepare(`
            DELETE FROM visual_node_properties WHERE node_id = ?
        `).bind(node.id));
    }
    for (const node of [...snapshot.nodes].reverse()) {
        statements.push(env.DB.prepare(`DELETE FROM visual_nodes WHERE id = ?`).bind(node.id));
    }
}

function pushReplaceInstance(statements, env, current, clone, now) {
    const root = clone.nodes.find((node) => node.id === current.rootId);
    for (const node of [...current.nodes].reverse()) {
        if (node.id === current.rootId) continue;
        statements.push(env.DB.prepare(`
            DELETE FROM visual_reusable_instances WHERE node_id = ?
        `).bind(node.id));
    }
    for (const node of [...current.nodes].reverse()) {
        statements.push(env.DB.prepare(`
            DELETE FROM visual_node_properties WHERE node_id = ?
        `).bind(node.id));
    }
    for (const node of [...current.nodes].reverse()) {
        if (node.id === current.rootId) continue;
        statements.push(env.DB.prepare(`DELETE FROM visual_nodes WHERE id = ?`).bind(node.id));
    }
    statements.push(env.DB.prepare(`
        UPDATE visual_nodes SET block_type = ?, label = ?, updated_at = ?
        WHERE id = ?
    `).bind(root.block_type, root.label, now, root.id));
    pushClone(statements, env, {
        nodes: clone.nodes.filter((node) => node.id !== root.id),
        properties: clone.properties
    }, now);
}

function pushPageTouch(statements, env, page, now) {
    statements.push(env.DB.prepare(`
        UPDATE visual_trees SET updated_at = ? WHERE id = ?
    `).bind(now, page.tree_id));
    statements.push(env.DB.prepare(`
        UPDATE visual_page_trees SET updated_at = ? WHERE page_id = ?
    `).bind(now, page.id));
}

function revisionStatement(env, treeId, snapshot, status, now) {
    return env.DB.prepare(`
        INSERT INTO content_revisions (
            entity_type, entity_id, revision_number, snapshot_json,
            publication_state, created_at
        ) SELECT 'visual_tree', ?, COALESCE(MAX(revision_number), 0) + 1,
            ?, ?, ? FROM content_revisions
        WHERE entity_type = 'visual_tree' AND entity_id = ?
    `).bind(treeId, JSON.stringify(snapshot), status, now, treeId);
}

function normalizeSourceInput(value, updating = false) {
    const expectedUpdatedAt = Number(value?.expectedUpdatedAt);
    if (updating && (!Number.isSafeInteger(expectedUpdatedAt) || expectedUpdatedAt < 1)) {
        throw new VisualSectionLibraryError("Versione della sezione non valida.");
    }
    return {
        name: normalizeName(value?.name),
        pageId: String(value?.pageId || "").trim(),
        nodeId: String(value?.nodeId || "").trim(),
        expectedUpdatedAt
    };
}

function normalizeName(value) {
    const name = String(value || "").trim();
    if (!name || name.length > NAME_LIMIT) {
        throw new VisualSectionLibraryError(`Il nome deve contenere da 1 a ${NAME_LIMIT} caratteri.`);
    }
    return name;
}

function sortByDepth(nodes) {
    const byId = new Map(nodes.map((node) => [node.id, node]));
    const depth = (node) => {
        let value = 0;
        let current = node;
        while (current?.parent_id && byId.has(current.parent_id)) {
            value += 1;
            current = byId.get(current.parent_id);
        }
        return value;
    };
    return [...nodes].sort((left, right) => depth(left) - depth(right));
}
