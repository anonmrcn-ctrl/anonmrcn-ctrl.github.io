import {
    VISUAL_BLOCK_REGISTRY,
    validateVisualTreeStructure
} from "./visual-builder-renderer.js";
import {
    editableValues,
    inspectorRows,
    normalizeInspectorValues,
    VISUAL_INSPECTOR_SCHEMAS,
    VISUAL_INSPECTOR_VERSION
} from "./visual-builder-inspector.js";
import { validateBehaviorRelationships } from "./visual-builder-behaviors.js";

const MAX_CANVAS_NODES = 400;
const ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;
const NEW_KEY_PATTERN = /^new-[a-z0-9]+(?:-[a-z0-9]+)*$/u;

const TYPE_LABELS = Object.freeze({
    section: "Sezione",
    container: "Contenitore",
    stack: "Pila verticale",
    row: "Riga",
    columns: "Colonne",
    grid: "Griglia",
    separator: "Separatore",
    spacer: "Spazio",
    heading: "Titolo",
    "rich-text": "Testo",
    list: "Elenco",
    quote: "Citazione",
    image: "Immagine",
    gallery: "Galleria",
    button: "Pulsante",
    "link-list": "Elenco di collegamenti",
    menu: "Menu",
    "table-of-contents": "Indice",
    breadcrumb: "Percorso di navigazione",
    "global-header": "Intestazione globale",
    "global-footer": "Piè di pagina globale",
    "global-notice": "Avviso globale",
    "project-poem": "Poesia",
    "project-path": "Percorso poetico",
    "project-map": "Mappa",
    "project-voices": "Voci",
    "project-places": "Luoghi",
    "project-sources": "Fonti",
    "project-memories": "Memorie",
    "project-archive": "Archivio",
    "personal-notebook": "Taccuino personale",
    "personal-space": "Spazio personale",
    "special-access": "Accesso protetto",
    "legal-document": "Documento legale",
    "approved-form": "Modulo autorizzato",
    "data-collection": "Raccolta dati",
    "data-filter": "Filtro"
});

export const VISUAL_CANVAS_PALETTE = Object.freeze(
    Object.entries(VISUAL_BLOCK_REGISTRY)
        .filter(([type]) => type !== "page-root" && !type.startsWith("admin-"))
        .map(([type, definition]) => Object.freeze({
            type,
            label: TYPE_LABELS[type] || type,
            category: definition.category
        }))
);

export class VisualCanvasError extends Error {
    constructor(message, status = 400) {
        super(message);
        this.status = status;
    }
}

export async function readVisualBuilderPages(env) {
    const result = await env.DB.prepare(`
        SELECT page.id AS page_id, page.slug, page.title, page.description,
            page.published_at, tree.id AS tree_id, tree.status, tree.updated_at
        FROM site_pages page
        INNER JOIN visual_page_trees mapping ON mapping.page_id = page.id
        INNER JOIN visual_trees tree ON tree.id = mapping.tree_id
        ORDER BY page.title COLLATE NOCASE, page.id
    `).all();
    const pages = [];
    for (const row of result.results || []) {
        pages.push(await readVisualBuilderPage(env, row.page_id, row));
    }
    return {
        pages,
        palette: VISUAL_CANVAS_PALETTE,
        inspectorVersion: VISUAL_INSPECTOR_VERSION,
        inspectorSchemas: VISUAL_INSPECTOR_SCHEMAS
    };
}

export async function updateVisualBuilderProperties(env, pageId, nodeId, rawInput) {
    const page = await readPageRow(env, pageId);
    if (!page) throw new VisualCanvasError("Pagina visuale non trovata.", 404);
    const expectedUpdatedAt = Number(rawInput?.expectedUpdatedAt);
    if (!Number.isSafeInteger(expectedUpdatedAt) || expectedUpdatedAt < 1) {
        throw new VisualCanvasError("Versione della struttura non valida.");
    }
    if (expectedUpdatedAt !== Number(page.updated_at)) {
        throw new VisualCanvasError(
            "La pagina è stata modificata altrove. Ricaricala prima di salvare.",
            409
        );
    }
    const node = await env.DB.prepare(`
        SELECT id, block_type FROM visual_nodes
        WHERE id = ? AND tree_id = ? LIMIT 1
    `).bind(nodeId, page.tree_id).first();
    if (!node) throw new VisualCanvasError("Blocco visuale non trovato.", 404);
    let normalized;
    try {
        normalized = normalizeInspectorValues(node.block_type, rawInput?.values);
    } catch (error) {
        throw new VisualCanvasError(error.message || "Proprietà visuali non valide.");
    }

    const [nodeResult, propertyResult] = await Promise.all([
        env.DB.prepare(`
            SELECT id, parent_id, position, block_type, label
            FROM visual_nodes WHERE tree_id = ?
            ORDER BY ifnull(parent_id, ''), position, id
        `).bind(page.tree_id).all(),
        env.DB.prepare(`
            SELECT property.* FROM visual_node_properties property
            INNER JOIN visual_nodes node ON node.id = property.node_id
            WHERE node.tree_id = ?
            ORDER BY property.node_id, property.property_set,
                property.property_name, property.breakpoint, property.item_position
        `).bind(page.tree_id).all()
    ]);
    try {
        validateBehaviorRelationships(
            node.block_type,
            node.id,
            normalized.values,
            nodeResult.results || [],
            propertyResult.results || []
        );
    } catch (error) {
        throw new VisualCanvasError(error.message || "Collegamento visuale non valido.");
    }
    const now = Math.max(Date.now(), Number(page.updated_at) + 1);
    const baselineSnapshot = JSON.stringify({
        pageId,
        treeId: page.tree_id,
        nodes: (nodeResult.results || []).map(apiNode),
        properties: propertyResult.results || []
    });
    const statements = [env.DB.prepare(`
        INSERT INTO content_revisions (
            entity_type, entity_id, revision_number, snapshot_json,
            publication_state, created_at
        )
        SELECT 'visual_tree', ?, 1, ?, ?, ?
        WHERE NOT EXISTS (
            SELECT 1 FROM content_revisions
            WHERE entity_type = 'visual_tree' AND entity_id = ?
        )
    `).bind(
        page.tree_id,
        baselineSnapshot,
        page.status,
        Number(page.updated_at),
        page.tree_id
    )];
    for (const descriptor of normalized.schema) {
        statements.push(env.DB.prepare(`
            DELETE FROM visual_node_properties
            WHERE node_id = ? AND property_set = ?
                AND property_name = ? AND breakpoint = ?
        `).bind(
            node.id,
            descriptor.propertySet,
            descriptor.propertyName,
            descriptor.breakpoint
        ));
    }
    for (const row of inspectorRows(normalized, now)) {
        statements.push(env.DB.prepare(`
            INSERT INTO visual_node_properties (
                node_id, domain, property_set, property_name, breakpoint,
                item_position, value_kind, text_value, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
            node.id,
            row.domain,
            row.propertySet,
            row.propertyName,
            row.breakpoint,
            row.itemPosition,
            row.valueKind,
            row.textValue,
            row.createdAt,
            row.updatedAt
        ));
    }
    statements.push(env.DB.prepare(`
        UPDATE visual_nodes SET updated_at = ? WHERE id = ?
    `).bind(now, node.id));
    statements.push(env.DB.prepare(`
        UPDATE visual_trees
        SET contract_version = 2, status = 'draft', updated_at = ?
        WHERE id = ?
    `).bind(now, page.tree_id));
    statements.push(env.DB.prepare(`
        UPDATE visual_page_trees SET updated_at = ? WHERE page_id = ?
    `).bind(now, pageId));
    await env.DB.batch(statements);

    const saved = await readVisualBuilderPage(env, pageId);
    const savedProperties = await env.DB.prepare(`
        SELECT property.* FROM visual_node_properties property
        INNER JOIN visual_nodes visual_node ON visual_node.id = property.node_id
        WHERE visual_node.tree_id = ?
        ORDER BY property.node_id, property.property_set,
            property.property_name, property.breakpoint, property.item_position
    `).bind(page.tree_id).all();
    await appendVisualRevision(env, page, saved, savedProperties.results || [], now);
    return { page: saved, unchanged: false };
}

export async function buildVisualBuilderPreview(env, pageId, rawInput) {
    const page = await readPageRow(env, pageId);
    if (!page) throw new VisualCanvasError("Pagina visuale non trovata.", 404);
    const input = normalizeInput(rawInput);
    if (input.expectedUpdatedAt !== Number(page.updated_at)) {
        throw new VisualCanvasError(
            "La pagina è stata modificata altrove. Ricaricala prima di aggiornare l'anteprima.",
            409
        );
    }
    const previewPage = normalizePreviewPage(rawInput?.page, page);
    const [nodeResult, propertyResult] = await Promise.all([
        env.DB.prepare(`
            SELECT id, tree_id, parent_id, position, block_type, label
            FROM visual_nodes WHERE tree_id = ?
            ORDER BY ifnull(parent_id, ''), position, id
        `).bind(page.tree_id).all(),
        env.DB.prepare(`
            SELECT property.node_id, property.domain, property.property_set,
                property.property_name, property.breakpoint,
                property.item_position, property.value_kind,
                property.text_value, property.number_value,
                property.boolean_value, property.asset_id,
                property.page_reference_id, property.collection_key
            FROM visual_node_properties property
            INNER JOIN visual_nodes node ON node.id = property.node_id
            WHERE node.tree_id = ?
            ORDER BY property.node_id, property.property_set,
                property.property_name, property.breakpoint,
                property.item_position
        `).bind(page.tree_id).all()
    ]);
    const currentNodes = nodeResult.results || [];
    const currentById = new Map(currentNodes.map((node) => [node.id, node]));
    const currentRoot = currentNodes.find((node) => !node.parent_id);
    const rawByKey = new Map(rawInput.nodes.map((node) => [String(node?.key || ""), node]));
    const desiredNodes = input.nodes.map((node) => ({
        id: node.key,
        tree_id: page.tree_id,
        parent_id: node.parentKey,
        position: node.position,
        block_type: node.type,
        label: node.label,
        copyOf: node.copyOf
    }));
    const desiredRoot = desiredNodes.find((node) => !node.parent_id);
    if (
        !currentRoot || !desiredRoot || desiredRoot.id !== currentRoot.id ||
        desiredRoot.block_type !== "page-root" || desiredRoot.position !== 1
    ) {
        throw new VisualCanvasError("La radice della pagina non può essere spostata o sostituita.");
    }
    for (const node of desiredNodes) {
        const current = currentById.get(node.id);
        if (!current && !NEW_KEY_PATTERN.test(node.id)) {
            throw new VisualCanvasError("L'anteprima contiene un blocco sconosciuto.");
        }
        if (current && current.block_type !== node.block_type) {
            throw new VisualCanvasError("Il tipo di un blocco esistente non può essere alterato.");
        }
        if (!current && node.block_type === "page-root") {
            throw new VisualCanvasError("Non è possibile aggiungere una seconda radice.");
        }
        if (!current && node.copyOf) {
            const source = currentById.get(node.copyOf);
            if (!source || source.block_type !== node.block_type || !source.parent_id) {
                throw new VisualCanvasError("Il blocco da duplicare non è valido.");
            }
        }
    }
    try {
        validateVisualTreeStructure(desiredNodes);
    } catch (error) {
        throw new VisualCanvasError(error.message || "Struttura dei blocchi non valida.");
    }

    const baseProperties = propertyResult.results || [];
    const propertiesByNode = new Map();
    for (const property of baseProperties) {
        const rows = propertiesByNode.get(property.node_id) || [];
        rows.push(property);
        propertiesByNode.set(property.node_id, rows);
    }
    const properties = [];
    const normalizedByNode = new Map();
    const now = Date.now();
    for (const node of desiredNodes) {
        const rawNode = rawByKey.get(node.id) || {};
        let normalized;
        try {
            normalized = normalizeInspectorValues(node.block_type, rawNode.values || {});
        } catch (error) {
            throw new VisualCanvasError(
                `${node.label}: ${error.message || "Proprietà visuali non valide."}`
            );
        }
        normalizedByNode.set(node.id, normalized.values);
        const replaced = new Set(normalized.schema.map((descriptor) =>
            `${descriptor.propertySet}/${descriptor.propertyName}/${descriptor.breakpoint}`
        ));
        const sourceId = currentById.has(node.id) ? node.id : node.copyOf;
        for (const property of propertiesByNode.get(sourceId) || []) {
            const key = `${property.property_set}/${property.property_name}/${property.breakpoint || "all"}`;
            if (!replaced.has(key)) properties.push({ ...property, node_id: node.id });
        }
        for (const row of inspectorRows(normalized, now)) {
            properties.push({
                node_id: node.id,
                domain: row.domain,
                property_set: row.propertySet,
                property_name: row.propertyName,
                breakpoint: row.breakpoint,
                item_position: row.itemPosition,
                value_kind: row.valueKind,
                text_value: row.textValue,
                number_value: null,
                boolean_value: null,
                asset_id: null,
                page_reference_id: null,
                collection_key: null
            });
        }
    }
    for (const node of desiredNodes) {
        try {
            validateBehaviorRelationships(
                node.block_type,
                node.id,
                normalizedByNode.get(node.id),
                desiredNodes,
                properties
            );
        } catch (error) {
            throw new VisualCanvasError(error.message || "Collegamento visuale non valido.");
        }
    }
    return {
        version: 1,
        page: {
            id: page.page_id,
            slug: page.slug,
            title: previewPage.title,
            description: previewPage.description,
            status: page.status,
            updatedAt: Number(page.updated_at),
            publishedAt: page.published_at === null ? null : Number(page.published_at)
        },
        tree: {
            id: page.tree_id,
            contractVersion: Number(page.contract_version || 2),
            updatedAt: Number(page.updated_at)
        },
        nodes: desiredNodes.map(({ copyOf, ...node }) => node),
        properties
    };
}

export async function updateVisualBuilderTree(env, pageId, rawInput) {
    const page = await readPageRow(env, pageId);
    if (!page) throw new VisualCanvasError("Pagina visuale non trovata.", 404);
    const input = normalizeInput(rawInput);
    if (input.expectedUpdatedAt !== Number(page.updated_at)) {
        throw new VisualCanvasError(
            "La struttura è stata modificata altrove. Ricaricala prima di salvare.",
            409
        );
    }

    const currentResult = await env.DB.prepare(`
        SELECT id, tree_id, parent_id, position, block_type, label,
            created_at, updated_at
        FROM visual_nodes WHERE tree_id = ?
        ORDER BY ifnull(parent_id, ''), position, id
    `).bind(page.tree_id).all();
    const currentNodes = currentResult.results || [];
    const currentById = new Map(currentNodes.map((node) => [node.id, node]));
    const root = currentNodes.find((node) => !node.parent_id);
    if (!root) throw new VisualCanvasError("La pagina non ha una radice valida.", 409);

    const actualIdByKey = new Map();
    for (const node of input.nodes) {
        if (currentById.has(node.key)) {
            actualIdByKey.set(node.key, node.key);
        } else if (NEW_KEY_PATTERN.test(node.key)) {
            actualIdByKey.set(node.key, `visual-${crypto.randomUUID()}`);
        } else {
            throw new VisualCanvasError("La struttura contiene un blocco sconosciuto.");
        }
    }
    const desiredNodes = input.nodes.map((node) => ({
        ...node,
        id: actualIdByKey.get(node.key),
        parent_id: node.parentKey ? actualIdByKey.get(node.parentKey) : null,
        block_type: node.type
    }));
    const desiredById = new Map(desiredNodes.map((node) => [node.id, node]));
    const desiredRoot = desiredNodes.find((node) => !node.parent_id);
    if (
        !desiredRoot || desiredRoot.id !== root.id ||
        desiredRoot.block_type !== "page-root" || desiredRoot.position !== 1
    ) {
        throw new VisualCanvasError("La radice della pagina non può essere spostata o sostituita.");
    }

    for (const node of desiredNodes) {
        const current = currentById.get(node.id);
        if (current && current.block_type !== node.block_type) {
            throw new VisualCanvasError("Il tipo di un blocco esistente non può essere alterato.");
        }
        if (!current && node.block_type === "page-root") {
            throw new VisualCanvasError("Non è possibile aggiungere una seconda radice.");
        }
        if (!current && node.copyOf) {
            const source = currentById.get(node.copyOf);
            if (!source || source.block_type !== node.block_type || !source.parent_id) {
                throw new VisualCanvasError("Il blocco da duplicare non è valido.");
            }
        }
    }
    try {
        validateVisualTreeStructure(desiredNodes);
    } catch (error) {
        throw new VisualCanvasError(error.message || "Struttura dei blocchi non valida.");
    }

    const unchanged = desiredNodes.length === currentNodes.length &&
        desiredNodes.every((node) => {
            const current = currentById.get(node.id);
            return current && current.parent_id === node.parent_id &&
                Number(current.position) === node.position &&
                current.block_type === node.block_type &&
                String(current.label || "") === node.label;
        });
    if (unchanged) {
        return {
            page: await readVisualBuilderPage(env, pageId, page),
            unchanged: true,
            keyMap: Object.fromEntries(actualIdByKey)
        };
    }

    const propertyResult = await env.DB.prepare(`
        SELECT node_id, domain, property_set, property_name, breakpoint,
            item_position, value_kind, text_value, number_value, boolean_value,
            asset_id, page_reference_id, collection_key, created_at
        FROM visual_node_properties
        WHERE node_id IN (SELECT id FROM visual_nodes WHERE tree_id = ?)
        ORDER BY node_id, property_set, property_name, breakpoint, item_position
    `).bind(page.tree_id).all();
    const propertiesByNode = new Map();
    for (const property of propertyResult.results || []) {
        const properties = propertiesByNode.get(property.node_id) || [];
        properties.push(property);
        propertiesByNode.set(property.node_id, properties);
    }

    const removed = currentNodes
        .filter((node) => !desiredById.has(node.id))
        .sort((left, right) => currentDepth(currentById, right.id) - currentDepth(currentById, left.id));
    const now = Math.max(Date.now(), Number(page.updated_at) + 1);
    const baselineSnapshot = JSON.stringify({
        pageId,
        treeId: page.tree_id,
        nodes: currentNodes.map((node) => ({
            key: node.id,
            parentKey: node.parent_id || null,
            position: Number(node.position),
            type: node.block_type,
            label: String(node.label || TYPE_LABELS[node.block_type] || node.block_type),
            root: !node.parent_id
        })),
        properties: propertyResult.results || []
    });
    const statements = [env.DB.prepare(`
        INSERT INTO content_revisions (
            entity_type, entity_id, revision_number, snapshot_json,
            publication_state, created_at
        )
        SELECT 'visual_tree', ?, 1, ?, ?, ?
        WHERE NOT EXISTS (
            SELECT 1 FROM content_revisions
            WHERE entity_type = 'visual_tree' AND entity_id = ?
        )
    `).bind(
        page.tree_id,
        baselineSnapshot,
        page.status,
        Number(page.updated_at),
        page.tree_id
    ), env.DB.prepare(`
        UPDATE visual_nodes SET position = position + 5000
        WHERE tree_id = ?
    `).bind(page.tree_id)];
    for (const node of removed) {
        statements.push(env.DB.prepare(`
            DELETE FROM visual_reusable_instances WHERE node_id = ?
        `).bind(node.id));
        statements.push(env.DB.prepare(`
            DELETE FROM visual_node_properties WHERE node_id = ?
        `).bind(node.id));
        statements.push(env.DB.prepare(`
            DELETE FROM visual_nodes WHERE id = ? AND tree_id = ?
        `).bind(node.id, page.tree_id));
    }
    for (const node of desiredNodes.filter((candidate) => currentById.has(candidate.id))) {
        statements.push(env.DB.prepare(`
            UPDATE visual_nodes
            SET parent_id = ?, position = ?, label = ?, updated_at = ?
            WHERE id = ? AND tree_id = ?
        `).bind(
            node.parent_id,
            node.position,
            node.label,
            now,
            node.id,
            page.tree_id
        ));
    }
    for (const node of sortByDepth(desiredNodes).filter((candidate) => !currentById.has(candidate.id))) {
        statements.push(env.DB.prepare(`
            INSERT INTO visual_nodes (
                id, tree_id, parent_id, position, block_type, label,
                created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
            node.id,
            page.tree_id,
            node.parent_id,
            node.position,
            node.block_type,
            node.label,
            now,
            now
        ));
        for (const property of propertiesByNode.get(node.copyOf) || []) {
            statements.push(env.DB.prepare(`
                INSERT INTO visual_node_properties (
                    node_id, domain, property_set, property_name, breakpoint,
                    item_position, value_kind, text_value, number_value,
                    boolean_value, asset_id, page_reference_id, collection_key,
                    created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).bind(
                node.id,
                property.domain,
                property.property_set,
                property.property_name,
                property.breakpoint,
                Number(property.item_position),
                property.value_kind,
                property.text_value,
                property.number_value,
                property.boolean_value,
                property.asset_id,
                property.page_reference_id,
                property.collection_key,
                now,
                now
            ));
        }
    }
    statements.push(env.DB.prepare(`
        UPDATE visual_trees
        SET contract_version = 2, status = 'draft', updated_at = ?
        WHERE id = ?
    `).bind(now, page.tree_id));
    statements.push(env.DB.prepare(`
        UPDATE visual_page_trees SET updated_at = ? WHERE page_id = ?
    `).bind(now, pageId));
    await env.DB.batch(statements);

    const saved = await readVisualBuilderPage(env, pageId);
    const savedProperties = await env.DB.prepare(`
        SELECT property.*
        FROM visual_node_properties property
        INNER JOIN visual_nodes node ON node.id = property.node_id
        WHERE node.tree_id = ?
        ORDER BY property.node_id, property.property_set,
            property.property_name, property.breakpoint, property.item_position
    `).bind(page.tree_id).all();
    await appendVisualRevision(env, page, saved, savedProperties.results || [], now);
    return {
        page: saved,
        unchanged: false,
        keyMap: Object.fromEntries(actualIdByKey)
    };
}

async function readVisualBuilderPage(env, pageId, knownPage = null) {
    const page = knownPage || await readPageRow(env, pageId);
    if (!page) return null;
    const [result, propertyResult, navigation] = await Promise.all([
        env.DB.prepare(`
            SELECT id, parent_id, position, block_type, label
            FROM visual_nodes WHERE tree_id = ?
            ORDER BY ifnull(parent_id, ''), position, id
        `).bind(page.tree_id).all(),
        env.DB.prepare(`
            SELECT property.node_id, property.property_set,
                property.property_name, property.breakpoint,
                property.item_position, property.value_kind,
                property.text_value, property.number_value,
                property.boolean_value
            FROM visual_node_properties property
            INNER JOIN visual_nodes node ON node.id = property.node_id
            WHERE node.tree_id = ? AND property.domain <> 'technical'
            ORDER BY property.node_id, property.property_set,
                property.property_name, property.breakpoint, property.item_position
        `).bind(page.tree_id).all(),
        env.DB.prepare(`
            SELECT id FROM navigation_items
            WHERE href IN (?, ?, ?) AND status <> 'archived'
            LIMIT 1
        `).bind(
            `./${page.slug}.html`, `/${page.slug}.html`, `${page.slug}.html`
        ).first()
    ]);
    const propertiesByNode = new Map();
    for (const property of propertyResult.results || []) {
        const properties = propertiesByNode.get(property.node_id) || [];
        properties.push(property);
        propertiesByNode.set(property.node_id, properties);
    }
    return {
        id: page.page_id,
        slug: page.slug,
        title: page.title,
        description: page.description,
        canonicalPath: `/${page.slug}.html`,
        builderManaged: page.page_id.startsWith("visual-page-"),
        inNavigation: Boolean(navigation),
        treeId: page.tree_id,
        status: page.status,
        updatedAt: Number(page.updated_at),
        publishedAt: page.published_at === null ? null : Number(page.published_at),
        nodes: (result.results || []).map((node) => ({
            ...apiNode(node),
            values: editableValues(node.block_type, propertiesByNode.get(node.id) || [])
        }))
    };
}

async function appendVisualRevision(env, page, saved, properties, now) {
    await env.DB.prepare(`
        INSERT INTO content_revisions (
            entity_type, entity_id, revision_number, snapshot_json,
            publication_state, created_at
        )
        SELECT 'visual_tree', ?, COALESCE(MAX(revision_number), 0) + 1,
            ?, ?, ?
        FROM content_revisions
        WHERE entity_type = 'visual_tree' AND entity_id = ?
    `).bind(
        page.tree_id,
        JSON.stringify({
            pageId: page.page_id,
            treeId: page.tree_id,
            nodes: saved.nodes,
            properties
        }),
        page.status,
        now,
        page.tree_id
    ).run();
}

function apiNode(node) {
    return {
        key: node.id,
        parentKey: node.parent_id || null,
        position: Number(node.position),
        type: node.block_type,
        label: String(node.label || TYPE_LABELS[node.block_type] || node.block_type),
        root: !node.parent_id
    };
}

async function readPageRow(env, pageId) {
    return await env.DB.prepare(`
        SELECT page.id AS page_id, page.slug, page.title, page.description,
            page.published_at, tree.id AS tree_id, tree.status,
            tree.contract_version, tree.updated_at
        FROM site_pages page
        INNER JOIN visual_page_trees mapping ON mapping.page_id = page.id
        INNER JOIN visual_trees tree ON tree.id = mapping.tree_id
        WHERE page.id = ? LIMIT 1
    `).bind(pageId).first();
}

function normalizePreviewPage(value, page) {
    const title = String(value?.title ?? page.title ?? "").trim();
    const description = String(value?.description ?? page.description ?? "").trim();
    if (!title || title.length > 200) {
        throw new VisualCanvasError("Il titolo dell'anteprima deve contenere da 1 a 200 caratteri.");
    }
    if (description.length > 500) {
        throw new VisualCanvasError("La descrizione dell'anteprima non può superare 500 caratteri.");
    }
    return { title, description };
}

function normalizeInput(rawInput) {
    if (!rawInput || typeof rawInput !== "object" || Array.isArray(rawInput)) {
        throw new VisualCanvasError("Struttura non valida.");
    }
    const expectedUpdatedAt = Number(rawInput.expectedUpdatedAt);
    if (!Number.isSafeInteger(expectedUpdatedAt) || expectedUpdatedAt < 1) {
        throw new VisualCanvasError("Versione della struttura non valida.");
    }
    if (!Array.isArray(rawInput.nodes) || !rawInput.nodes.length ||
        rawInput.nodes.length > MAX_CANVAS_NODES) {
        throw new VisualCanvasError(`La pagina deve contenere da 1 a ${MAX_CANVAS_NODES} blocchi.`);
    }
    const keys = new Set();
    const nodes = rawInput.nodes.map((rawNode) => {
        const key = String(rawNode?.key || "").trim();
        const parentKey = rawNode?.parentKey === null
            ? null
            : String(rawNode?.parentKey || "").trim();
        const type = String(rawNode?.type || "").trim();
        const label = String(rawNode?.label || TYPE_LABELS[type] || type).trim().slice(0, 160);
        const position = Number(rawNode?.position);
        const copyOf = rawNode?.copyOf ? String(rawNode.copyOf).trim() : null;
        if ((!ID_PATTERN.test(key) && !NEW_KEY_PATTERN.test(key)) || keys.has(key)) {
            throw new VisualCanvasError("Identificatore temporaneo non valido o duplicato.");
        }
        if (parentKey !== null && !ID_PATTERN.test(parentKey) && !NEW_KEY_PATTERN.test(parentKey)) {
            throw new VisualCanvasError("Genitore del blocco non valido.");
        }
        if (!VISUAL_BLOCK_REGISTRY[type]) {
            throw new VisualCanvasError("Tipo di blocco non disponibile.");
        }
        if (!Number.isInteger(position) || position < 1 || position > MAX_CANVAS_NODES) {
            throw new VisualCanvasError("Posizione del blocco non valida.");
        }
        if (!label || /[\u0000-\u001f\u007f]/u.test(label)) {
            throw new VisualCanvasError("Etichetta del blocco non valida.");
        }
        if (copyOf && !ID_PATTERN.test(copyOf)) {
            throw new VisualCanvasError("Origine della duplicazione non valida.");
        }
        keys.add(key);
        return { key, parentKey, position, type, label, copyOf };
    });
    for (const node of nodes) {
        if (node.parentKey && !keys.has(node.parentKey)) {
            throw new VisualCanvasError("La struttura contiene un genitore mancante.");
        }
    }
    for (const parentKey of new Set(nodes.map((node) => node.parentKey))) {
        const positions = nodes
            .filter((node) => node.parentKey === parentKey)
            .map((node) => node.position)
            .sort((left, right) => left - right);
        if (positions.some((position, index) => position !== index + 1)) {
            throw new VisualCanvasError("Le posizioni dei blocchi devono essere consecutive.");
        }
    }
    return { expectedUpdatedAt, nodes };
}

function currentDepth(nodesById, id) {
    let depth = 0;
    let current = nodesById.get(id);
    const visited = new Set();
    while (current?.parent_id) {
        if (visited.has(current.id)) break;
        visited.add(current.id);
        depth += 1;
        current = nodesById.get(current.parent_id);
    }
    return depth;
}

function sortByDepth(nodes) {
    const byId = new Map(nodes.map((node) => [node.id, node]));
    return [...nodes].sort((left, right) =>
        currentDepth(byId, left.id) - currentDepth(byId, right.id)
    );
}
