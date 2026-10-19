import { validateBehaviorRelationships, safeHref } from "./visual-builder-behaviors.js";
import { editableValues } from "./visual-builder-inspector.js";
import {
    renderVisualPage,
    validateVisualTreeStructure
} from "./visual-builder-renderer.js";

const SNAPSHOT_VERSION = 1;
const MAX_PUBLISHED_BYTES = 512 * 1024;
const MAX_REVISIONS = 80;

export class VisualPublicationError extends Error {
    constructor(message, status = 400, details = null) {
        super(message);
        this.status = status;
        this.details = details;
    }
}

export async function initializeVisualPublications(env) {
    const result = await env.DB.prepare(`
        SELECT page.id AS page_id, tree.id AS tree_id
        FROM site_pages page
        INNER JOIN visual_page_trees mapping ON mapping.page_id = page.id
        INNER JOIN visual_trees tree ON tree.id = mapping.tree_id
        LEFT JOIN visual_tree_publications publication ON publication.tree_id = tree.id
        WHERE page.status = 'published' AND tree.status = 'published'
            AND publication.tree_id IS NULL
        ORDER BY page.id
    `).all();
    for (const row of result.results || []) {
        const snapshot = await captureVisualSnapshot(env, row.page_id);
        const snapshotJson = JSON.stringify(snapshot);
        const revision = await latestRevisionNumber(env, row.tree_id);
        const now = Number(snapshot.page.publishedAt || snapshot.page.updatedAt || Date.now());
        await env.DB.prepare(`
            INSERT OR IGNORE INTO visual_tree_publications (
                tree_id, page_id, revision_number, snapshot_json,
                checksum, published_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
        `).bind(
            row.tree_id,
            row.page_id,
            revision,
            snapshotJson,
            await checksum(snapshotJson),
            now,
            now
        ).run();
    }
}

export async function captureVisualSnapshot(env, pageId) {
    const page = await readPage(env, pageId);
    if (!page) throw new VisualPublicationError("Pagina visuale non trovata.", 404);
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
    return {
        version: SNAPSHOT_VERSION,
        page: {
            id: page.page_id,
            slug: page.slug,
            title: page.title,
            description: page.description,
            status: page.page_status,
            updatedAt: Number(page.page_updated_at),
            publishedAt: page.page_published_at === null
                ? null
                : Number(page.page_published_at)
        },
        tree: {
            id: page.tree_id,
            contractVersion: Number(page.contract_version),
            updatedAt: Number(page.tree_updated_at)
        },
        nodes: resultRows(nodeResult),
        properties: resultRows(propertyResult)
    };
}

export async function readVisualPublicationState(env, pageId) {
    const draft = await captureVisualSnapshot(env, pageId);
    const publication = await env.DB.prepare(`
        SELECT revision_number, snapshot_json, checksum, published_at, updated_at
        FROM visual_tree_publications WHERE tree_id = ? LIMIT 1
    `).bind(draft.tree.id).first();
    const published = parseSnapshot(publication?.snapshot_json);
    const audit = await auditVisualSnapshot(env, draft);
    const revisions = await readRevisions(env, draft.tree.id);
    return {
        pageId,
        treeId: draft.tree.id,
        draftUpdatedAt: draft.tree.updatedAt,
        publishedAt: publication ? Number(publication.published_at) : null,
        publishedRevision: publication ? Number(publication.revision_number) : null,
        publishedChecksum: publication?.checksum || null,
        audit,
        canPublish: audit.errors.length === 0,
        comparison: compareSnapshots(draft, published),
        revisions
    };
}

export async function publishVisualPage(env, pageId, rawInput) {
    const draft = await captureVisualSnapshot(env, pageId);
    assertExpectedVersion(rawInput, draft.tree.updatedAt);
    const audit = await auditVisualSnapshot(env, draft);
    if (audit.errors.length) {
        throw new VisualPublicationError(
            "La pubblicazione è bloccata dai controlli di qualità.",
            409,
            { audit }
        );
    }
    const now = Math.max(Date.now(), draft.tree.updatedAt + 1);
    const publicationSnapshot = {
        ...draft,
        page: {
            ...draft.page,
            status: "published",
            publishedAt: draft.page.publishedAt || now
        },
        tree: { ...draft.tree, updatedAt: now }
    };
    const snapshotJson = JSON.stringify(publicationSnapshot);
    const digest = await checksum(snapshotJson);
    const revision = (await latestRevisionNumber(env, draft.tree.id)) + 1;
    await env.DB.batch([
        env.DB.prepare(`
            INSERT INTO content_revisions (
                entity_type, entity_id, revision_number, snapshot_json,
                publication_state, created_at
            ) VALUES ('visual_tree', ?, ?, ?, 'published', ?)
        `).bind(draft.tree.id, revision, snapshotJson, now),
        env.DB.prepare(`
            INSERT INTO visual_tree_publications (
                tree_id, page_id, revision_number, snapshot_json,
                checksum, published_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(tree_id) DO UPDATE SET
                page_id = excluded.page_id,
                revision_number = excluded.revision_number,
                snapshot_json = excluded.snapshot_json,
                checksum = excluded.checksum,
                published_at = excluded.published_at,
                updated_at = excluded.updated_at
        `).bind(
            draft.tree.id,
            pageId,
            revision,
            snapshotJson,
            digest,
            publicationSnapshot.page.publishedAt,
            now
        ),
        env.DB.prepare(`
            UPDATE site_pages SET status = 'published', updated_at = ?,
                published_at = COALESCE(published_at, ?)
            WHERE id = ?
        `).bind(now, now, pageId),
        env.DB.prepare(`
            UPDATE visual_trees SET status = 'published', updated_at = ?,
                published_at = COALESCE(published_at, ?)
            WHERE id = ?
        `).bind(now, now, draft.tree.id),
        env.DB.prepare(`
            UPDATE visual_page_trees SET updated_at = ? WHERE page_id = ?
        `).bind(now, pageId),
        env.DB.prepare(`
            UPDATE navigation_items SET status = 'published', updated_at = ?,
                published_at = COALESCE(published_at, ?)
            WHERE href IN (?, ?, ?) AND status <> 'archived'
        `).bind(
            now,
            now,
            `./${draft.page.slug}.html`,
            `/${draft.page.slug}.html`,
            `${draft.page.slug}.html`
        )
    ]);
    return {
        published: true,
        revisionNumber: revision,
        checksum: digest,
        publishedAt: publicationSnapshot.page.publishedAt,
        audit,
        state: await readVisualPublicationState(env, pageId)
    };
}

export async function restoreVisualRevision(env, pageId, revisionNumber, rawInput) {
    const current = await captureVisualSnapshot(env, pageId);
    assertExpectedVersion(rawInput, current.tree.updatedAt);
    const revision = await env.DB.prepare(`
        SELECT revision_number, snapshot_json
        FROM content_revisions
        WHERE entity_type = 'visual_tree' AND entity_id = ?
            AND revision_number = ?
        LIMIT 1
    `).bind(current.tree.id, revisionNumber).first();
    if (!revision) throw new VisualPublicationError("Revisione visuale non trovata.", 404);
    const target = normalizeRestorableSnapshot(parseSnapshot(revision.snapshot_json), current);
    if (!target) {
        throw new VisualPublicationError(
            "Questa revisione contiene solo dati storici parziali e non è ripristinabile.",
            409
        );
    }
    const audit = await auditVisualSnapshot(env, target);
    if (audit.errors.length) {
        throw new VisualPublicationError(
            "La revisione non supera i controlli correnti e non può essere ripristinata.",
            409,
            { audit }
        );
    }
    const now = Math.max(Date.now(), current.tree.updatedAt + 1);
    const statements = [
        env.DB.prepare(`
            DELETE FROM visual_reusable_instances
            WHERE node_id IN (SELECT id FROM visual_nodes WHERE tree_id = ?)
        `).bind(current.tree.id),
        env.DB.prepare(`
            DELETE FROM visual_node_properties
            WHERE node_id IN (SELECT id FROM visual_nodes WHERE tree_id = ?)
        `).bind(current.tree.id),
        env.DB.prepare(`DELETE FROM visual_nodes WHERE tree_id = ?`).bind(current.tree.id)
    ];
    for (const node of sortNodesForInsert(target.nodes)) {
        statements.push(env.DB.prepare(`
            INSERT INTO visual_nodes (
                id, tree_id, parent_id, position, block_type, label,
                created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
            node.id,
            current.tree.id,
            node.parent_id,
            Number(node.position),
            node.block_type,
            String(node.label || node.block_type).slice(0, 160),
            now,
            now
        ));
    }
    for (const property of target.properties) {
        statements.push(env.DB.prepare(`
            INSERT INTO visual_node_properties (
                node_id, domain, property_set, property_name, breakpoint,
                item_position, value_kind, text_value, number_value,
                boolean_value, asset_id, page_reference_id, collection_key,
                created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
            property.node_id,
            property.domain,
            property.property_set,
            property.property_name,
            property.breakpoint || "all",
            Number(property.item_position || 0),
            property.value_kind,
            property.text_value ?? null,
            property.number_value ?? null,
            property.boolean_value ?? null,
            property.asset_id ?? null,
            property.page_reference_id ?? null,
            property.collection_key ?? null,
            now,
            now
        ));
    }
    statements.push(env.DB.prepare(`
        UPDATE visual_trees SET status = 'draft', contract_version = 2,
            updated_at = ? WHERE id = ?
    `).bind(now, current.tree.id));
    statements.push(env.DB.prepare(`
        UPDATE visual_page_trees SET updated_at = ? WHERE page_id = ?
    `).bind(now, pageId));
    const restored = {
        ...target,
        page: { ...current.page },
        tree: { ...current.tree, updatedAt: now }
    };
    statements.push(env.DB.prepare(`
        INSERT INTO content_revisions (
            entity_type, entity_id, revision_number, snapshot_json,
            publication_state, created_at
        ) SELECT 'visual_tree', ?, COALESCE(MAX(revision_number), 0) + 1,
            ?, 'draft', ?
        FROM content_revisions
        WHERE entity_type = 'visual_tree' AND entity_id = ?
    `).bind(current.tree.id, JSON.stringify(restored), now, current.tree.id));
    await env.DB.batch(statements);
    return {
        restored: true,
        restoredFrom: Number(revision.revision_number),
        publishedUnchanged: true,
        state: await readVisualPublicationState(env, pageId)
    };
}

export async function readPublishedVisualSnapshotBySlug(env, slug) {
    const row = await env.DB.prepare(`
        SELECT page.id, page.slug, page.status, mapping.theme_id,
            publication.snapshot_json, publication.revision_number,
            publication.published_at
        FROM site_pages page
        INNER JOIN visual_page_trees mapping ON mapping.page_id = page.id
        INNER JOIN visual_tree_publications publication
            ON publication.tree_id = mapping.tree_id
        WHERE page.slug = ? AND page.status = 'published'
        LIMIT 1
    `).bind(slug).first();
    if (!row) return null;
    const snapshot = parseSnapshot(row.snapshot_json);
    if (!snapshot) return null;
    snapshot.page = {
        ...snapshot.page,
        id: row.id,
        slug: row.slug,
        status: "published",
        publishedAt: Number(row.published_at)
    };
    return {
        snapshot,
        themeId: row.theme_id,
        revisionNumber: Number(row.revision_number)
    };
}

export async function auditVisualSnapshot(env, snapshot) {
    const errors = [];
    const warnings = [];
    const add = (level, category, message, nodeId = null) => {
        (level === "error" ? errors : warnings).push({ category, message, nodeId });
    };
    try {
        validateVisualTreeStructure(snapshot.nodes);
        renderVisualPage({
            page: { ...snapshot.page, status: "published" },
            nodes: snapshot.nodes,
            properties: snapshot.properties
        });
    } catch (error) {
        add("error", "structure", error.message || "Struttura visuale non valida.");
    }
    const bytes = new TextEncoder().encode(JSON.stringify(snapshot)).byteLength;
    if (bytes > MAX_PUBLISHED_BYTES) {
        add("error", "performance", "La pagina supera 512 KiB di dati visuali.");
    } else if (bytes > 256 * 1024 || snapshot.nodes.length > 200) {
        add("warning", "performance", "La pagina è ampia: verifica tempi di caricamento e leggibilità.");
    }
    if (!String(snapshot.page.title || "").trim()) {
        add("error", "seo", "Il titolo SEO è obbligatorio.");
    }
    const description = String(snapshot.page.description || "").trim();
    if (!description) add("warning", "seo", "Aggiungi una descrizione SEO.");
    if (description.length > 170) {
        add("warning", "seo", "La descrizione SEO può essere troncata nei risultati di ricerca.");
    }
    const propertiesByNode = groupProperties(snapshot.properties);
    for (const node of snapshot.nodes) {
        const properties = propertiesByNode.get(node.id) || [];
        const values = editableValues(node.block_type, properties);
        try {
            validateBehaviorRelationships(
                node.block_type,
                node.id,
                values,
                snapshot.nodes,
                snapshot.properties
            );
        } catch (error) {
            add("error", "links", error.message, node.id);
        }
        if (node.block_type === "image") {
            const asset = propertyValue(properties, "content.media", "assetId");
            const alt = propertyValue(properties, "content.media", "alt");
            if (asset && !String(alt || "").trim()) {
                add("error", "accessibility", "L'immagine richiede un testo alternativo.", node.id);
            } else if (!asset) {
                add("warning", "media", "Il blocco immagine usa il ripiego finché non scegli un media.", node.id);
            }
        }
        if (node.block_type === "audio") {
            const source = propertyValue(properties, "content.media", "audioAssetId");
            const title = propertyValue(properties, "content.copy", "title");
            const description = propertyValue(properties, "content.copy", "text");
            const transcript = propertyValue(properties, "content.media", "transcript");
            if (!source) add("error", "media", "Scegli un file audio dalla libreria.", node.id);
            if (!String(title || "").trim()) add("error", "accessibility", "L’audio richiede un titolo.", node.id);
            if (!String(description || "").trim()) add("error", "seo", "L’audio richiede una descrizione.", node.id);
            if (!String(transcript || "").trim()) add("error", "accessibility", "L’audio richiede una trascrizione.", node.id);
        }
        if (node.block_type === "video") {
            const source = propertyValue(properties, "content.media", "videoAssetId");
            const poster = propertyValue(properties, "content.media", "posterAssetId");
            const subtitles = propertyValue(properties, "content.media", "subtitleAssetId");
            const title = propertyValue(properties, "content.copy", "title");
            const description = propertyValue(properties, "content.copy", "text");
            if (!source) add("error", "media", "Scegli un file video dalla libreria.", node.id);
            if (!poster) add("error", "media", "Scegli un’immagine poster per il video.", node.id);
            if (!subtitles) add("error", "accessibility", "Aggiungi i sottotitoli WebVTT del video.", node.id);
            if (!String(title || "").trim()) add("error", "accessibility", "Il video richiede un titolo.", node.id);
            if (!String(description || "").trim()) add("error", "seo", "Il video richiede una descrizione.", node.id);
        }
        for (const property of properties) {
            if (property.property_set === "behavior.link" && property.property_name === "href" &&
                property.text_value && !safeHref(property.text_value) && node.block_type !== "link-list") {
                add("error", "links", "Il collegamento non è sicuro.", node.id);
            }
            if (property.property_name === "externalService" && property.text_value !== "none") {
                add("error", "privacy", "I servizi esterni non sono autorizzati.", node.id);
            }
            if (property.property_name === "telemetry" && property.text_value !== "off") {
                add("error", "privacy", "La telemetria deve restare disattivata.", node.id);
            }
            if (property.property_set === "behavior.form" &&
                property.property_name === "consentMode" && property.text_value !== "required") {
                add("error", "privacy", "Il modulo richiede consenso esplicito.", node.id);
            }
        }
    }
    await auditReferences(env, snapshot, add);
    return { errors, warnings, checkedAt: Date.now(), snapshotBytes: bytes };
}

function compareSnapshots(draft, published) {
    if (!published) {
        return {
            hasPublishedVersion: false,
            changed: true,
            added: draft.nodes.map((node) => node.id),
            removed: [],
            modified: []
        };
    }
    const draftNodes = nodeFingerprints(draft);
    const publicNodes = nodeFingerprints(published);
    return {
        hasPublishedVersion: true,
        changed: JSON.stringify(draft) !== JSON.stringify(published),
        added: [...draftNodes.keys()].filter((id) => !publicNodes.has(id)),
        removed: [...publicNodes.keys()].filter((id) => !draftNodes.has(id)),
        modified: [...draftNodes.keys()].filter((id) =>
            publicNodes.has(id) && publicNodes.get(id) !== draftNodes.get(id)
        )
    };
}

async function auditReferences(env, snapshot, add) {
    const assetProperties = snapshot.properties.filter((row) => row.asset_id);
    const assetIds = new Set(assetProperties.map((row) => row.asset_id));
    const pageIds = new Set(snapshot.properties.map((row) => row.page_reference_id).filter(Boolean));
    for (const id of assetIds) {
        const asset = await env.DB.prepare(`
            SELECT id, media_type, alt_text FROM media_assets
            WHERE id = ? AND state = 'current' LIMIT 1
        `).bind(id).first();
        if (!asset) {
            add("error", "media", `Media non disponibile: ${id}.`);
            continue;
        }
        for (const property of assetProperties.filter((row) => row.asset_id === id)) {
            if (property.property_name === "audioAssetId" &&
                !String(asset.media_type || "").startsWith("audio/")) {
                add("error", "media", "Il blocco audio contiene un file di tipo errato.", property.node_id);
            }
            if (property.property_name === "coverAssetId" &&
                !String(asset.media_type || "").startsWith("image/")) {
                add("error", "media", "La copertina dell’audio deve essere un’immagine.", property.node_id);
            }
            if (property.property_name === "videoAssetId" &&
                !String(asset.media_type || "").startsWith("video/")) {
                add("error", "media", "Il blocco video contiene un file di tipo errato.", property.node_id);
            }
            if (property.property_name === "posterAssetId" &&
                !String(asset.media_type || "").startsWith("image/")) {
                add("error", "media", "Il poster del video deve essere un’immagine.", property.node_id);
            }
            if (property.property_name === "subtitleAssetId" && asset.media_type !== "text/vtt") {
                add("error", "accessibility", "I sottotitoli del video devono essere WebVTT.", property.node_id);
            }
        }
    }
    for (const id of pageIds) {
        const page = await env.DB.prepare(`
            SELECT id FROM site_pages WHERE id = ? AND status <> 'archived' LIMIT 1
        `).bind(id).first();
        if (!page) add("error", "links", `Pagina collegata non disponibile: ${id}.`);
    }
}

async function readRevisions(env, treeId) {
    const result = await env.DB.prepare(`
        SELECT revision_number, publication_state, created_at, snapshot_json
        FROM content_revisions
        WHERE entity_type = 'visual_tree' AND entity_id = ?
        ORDER BY revision_number DESC LIMIT ?
    `).bind(treeId, MAX_REVISIONS).all();
    return resultRows(result).map((row) => ({
        revisionNumber: Number(row.revision_number),
        state: row.publication_state,
        createdAt: Number(row.created_at),
        restorable: Boolean(normalizeRestorableSnapshot(parseSnapshot(row.snapshot_json), null))
    }));
}

function normalizeRestorableSnapshot(snapshot, current) {
    if (!snapshot || !Array.isArray(snapshot.nodes) || !snapshot.nodes.length) return null;
    const treeId = current?.tree.id || snapshot.tree?.id || snapshot.treeId;
    const nodes = snapshot.nodes.map((node) => ({
        id: node.id || node.key,
        tree_id: treeId,
        parent_id: node.parent_id ?? node.parentKey ?? null,
        position: Number(node.position),
        block_type: node.block_type || node.type,
        label: node.label || node.block_type || node.type
    }));
    if (nodes.some((node) => !node.id || !node.block_type || !Number.isInteger(node.position))) {
        return null;
    }
    return {
        version: SNAPSHOT_VERSION,
        page: current?.page || snapshot.page || { id: snapshot.pageId, status: "draft" },
        tree: current?.tree || snapshot.tree || { id: treeId, contractVersion: 2, updatedAt: 0 },
        nodes,
        properties: Array.isArray(snapshot.properties) ? snapshot.properties : []
    };
}

function sortNodesForInsert(nodes) {
    const byId = new Map(nodes.map((node) => [node.id, node]));
    const depth = (node) => {
        let value = 0;
        let current = node;
        const visited = new Set();
        while (current?.parent_id && byId.has(current.parent_id) && !visited.has(current.id)) {
            visited.add(current.id);
            value += 1;
            current = byId.get(current.parent_id);
        }
        return value;
    };
    return [...nodes].sort((left, right) =>
        depth(left) - depth(right) || Number(left.position) - Number(right.position)
    );
}

function nodeFingerprints(snapshot) {
    const properties = groupProperties(snapshot.properties);
    return new Map(snapshot.nodes.map((node) => [
        node.id,
        JSON.stringify([node, properties.get(node.id) || []])
    ]));
}

function groupProperties(properties) {
    const grouped = new Map();
    for (const property of properties || []) {
        const list = grouped.get(property.node_id) || [];
        list.push(property);
        grouped.set(property.node_id, list);
    }
    return grouped;
}

function propertyValue(properties, set, name) {
    const property = properties.find((row) =>
        row.property_set === set && row.property_name === name
    );
    return property?.asset_id || property?.page_reference_id ||
        property?.collection_key || property?.text_value ||
        property?.number_value || property?.boolean_value || null;
}

async function readPage(env, pageId) {
    return env.DB.prepare(`
        SELECT page.id AS page_id, page.slug, page.title, page.description,
            page.status AS page_status, page.updated_at AS page_updated_at,
            page.published_at AS page_published_at,
            tree.id AS tree_id, tree.contract_version,
            tree.status AS tree_status, tree.updated_at AS tree_updated_at
        FROM site_pages page
        INNER JOIN visual_page_trees mapping ON mapping.page_id = page.id
        INNER JOIN visual_trees tree ON tree.id = mapping.tree_id
        WHERE page.id = ? LIMIT 1
    `).bind(pageId).first();
}

async function latestRevisionNumber(env, treeId) {
    const row = await env.DB.prepare(`
        SELECT COALESCE(MAX(revision_number), 0) AS revision_number
        FROM content_revisions
        WHERE entity_type = 'visual_tree' AND entity_id = ?
    `).bind(treeId).first();
    return Number(row?.revision_number || 0);
}

function assertExpectedVersion(rawInput, actual) {
    const expected = Number(rawInput?.expectedUpdatedAt);
    if (!Number.isSafeInteger(expected) || expected < 1) {
        throw new VisualPublicationError("Versione della bozza non valida.");
    }
    if (expected !== Number(actual)) {
        throw new VisualPublicationError(
            "La bozza è stata modificata altrove. Ricaricala prima di continuare.",
            409
        );
    }
}

async function checksum(value) {
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
    return [...new Uint8Array(digest)]
        .map((byte) => byte.toString(16).padStart(2, "0"))
        .join("");
}

function parseSnapshot(value) {
    if (!value) return null;
    try {
        const parsed = typeof value === "string" ? JSON.parse(value) : value;
        return parsed && typeof parsed === "object" ? parsed : null;
    } catch {
        return null;
    }
}

function resultRows(result) {
    return result?.results || [];
}

export { SNAPSHOT_VERSION };
