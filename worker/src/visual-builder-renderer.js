import {
    VISUAL_BLOCK_TYPES,
    VISUAL_PROPERTY_SETS
} from "./visual-builder-storage.js";

export const VISUAL_BLOCK_REGISTRY_VERSION = 1;

const entry = (category, propertySets, renderAs = "section") =>
    Object.freeze({ category, propertySets: Object.freeze(propertySets), renderAs });

export const VISUAL_BLOCK_REGISTRY = Object.freeze({
    "page-root": entry("root", ["content.copy", "presentation.box", "presentation.layout", "presentation.responsive", "behavior.link"], "main"),
    "section": entry("structure", ["content.copy", "presentation.box", "presentation.layout", "presentation.responsive"], "section"),
    "container": entry("structure", ["presentation.box", "presentation.layout", "presentation.responsive"], "div"),
    "stack": entry("structure", ["presentation.layout", "presentation.responsive"], "div"),
    "row": entry("structure", ["presentation.layout", "presentation.responsive"], "div"),
    "columns": entry("structure", ["presentation.layout", "presentation.responsive"], "div"),
    "grid": entry("structure", ["presentation.layout", "presentation.responsive"], "div"),
    "separator": entry("structure", ["presentation.box", "presentation.responsive"], "hr"),
    "spacer": entry("structure", ["presentation.box", "presentation.responsive"], "spacer"),
    "heading": entry("content", ["content.copy", "presentation.typography", "presentation.responsive"], "heading"),
    "rich-text": entry("content", ["content.copy", "presentation.typography", "presentation.responsive"], "paragraph"),
    "list": entry("content", ["content.copy", "presentation.typography", "presentation.responsive"], "list"),
    "quote": entry("content", ["content.copy", "presentation.box", "presentation.typography", "presentation.responsive"], "quote"),
    "image": entry("content", ["content.media", "presentation.box", "presentation.layout", "presentation.responsive", "behavior.link", "technical.binding"], "image"),
    "gallery": entry("content", ["content.media", "presentation.layout", "presentation.responsive", "technical.binding"], "gallery"),
    "button": entry("content", ["content.copy", "presentation.box", "presentation.typography", "behavior.link"], "button"),
    "link-list": entry("navigation", ["content.copy", "presentation.layout", "behavior.link"], "link-list"),
    "menu": entry("navigation", ["content.copy", "presentation.layout", "presentation.responsive", "behavior.collection", "technical.binding"], "nav"),
    "table-of-contents": entry("navigation", ["content.copy", "presentation.layout", "behavior.collection"], "nav"),
    "breadcrumb": entry("navigation", ["content.copy", "presentation.layout", "behavior.collection"], "nav"),
    "global-header": entry("global", ["content.copy", "content.media", "presentation.box", "presentation.layout", "presentation.responsive", "behavior.collection"], "header"),
    "global-footer": entry("global", ["content.copy", "presentation.box", "presentation.layout", "presentation.responsive", "behavior.collection"], "footer"),
    "global-notice": entry("global", ["content.copy", "presentation.box", "presentation.responsive", "behavior.link"], "aside"),
    "project-poem": entry("project", ["content.copy", "presentation.typography", "presentation.responsive", "technical.binding"]),
    "project-path": entry("project", ["content.copy", "presentation.layout", "presentation.responsive", "behavior.collection", "technical.binding"]),
    "project-map": entry("project", ["content.copy", "presentation.layout", "presentation.responsive", "behavior.collection", "technical.binding"]),
    "project-voices": entry("project", ["content.copy", "content.media", "presentation.layout", "presentation.responsive", "behavior.collection", "technical.binding"]),
    "project-places": entry("project", ["content.copy", "content.media", "presentation.layout", "presentation.responsive", "behavior.collection", "technical.binding"]),
    "project-sources": entry("project", ["content.copy", "presentation.layout", "behavior.collection", "technical.binding"]),
    "project-memories": entry("project", ["content.copy", "content.media", "presentation.layout", "presentation.responsive", "behavior.collection", "technical.binding"]),
    "project-archive": entry("project", ["content.copy", "presentation.layout", "presentation.responsive", "behavior.collection", "technical.binding"]),
    "personal-notebook": entry("personal", ["content.copy", "presentation.layout", "presentation.responsive", "behavior.collection", "technical.binding", "technical.security"]),
    "personal-space": entry("personal", ["content.copy", "content.media", "presentation.layout", "presentation.responsive", "behavior.collection", "technical.binding", "technical.security"]),
    "special-access": entry("functional", ["content.copy", "presentation.box", "behavior.form", "technical.binding", "technical.security"]),
    "legal-document": entry("legal", ["content.copy", "presentation.typography", "presentation.responsive", "technical.binding"], "article"),
    "approved-form": entry("functional", ["content.copy", "presentation.box", "presentation.layout", "behavior.form", "technical.binding", "technical.security"]),
    "data-collection": entry("functional", ["content.copy", "presentation.layout", "presentation.responsive", "behavior.collection", "technical.binding"]),
    "data-filter": entry("functional", ["content.copy", "presentation.layout", "behavior.collection", "technical.binding"]),
    "admin-workspace": entry("administration", ["content.copy", "presentation.layout", "presentation.responsive", "technical.security"]),
    "admin-tool-panel": entry("administration", ["content.copy", "presentation.box", "presentation.layout", "presentation.responsive", "technical.binding", "technical.security"])
});

const CATEGORY_CHILDREN = Object.freeze({
    root: ["structure", "content", "navigation", "project", "global", "functional", "personal", "legal"],
    structure: ["structure", "content", "navigation", "project", "functional", "personal", "legal"],
    content: [],
    navigation: ["content", "navigation"],
    project: ["structure", "content", "navigation", "functional"],
    global: ["structure", "content", "navigation", "functional", "legal"],
    functional: ["content", "functional"],
    personal: ["structure", "content", "functional"],
    legal: ["content", "navigation"],
    administration: ["administration", "structure", "content", "navigation", "project", "functional", "legal"]
});

const PRIVATE_PAGE_SLUGS = new Set(["accesso", "spazio-personale", "taccuino"]);
const MAX_DEPTH = 8;
const MAX_CHILDREN = 200;

const registryIds = Object.keys(VISUAL_BLOCK_REGISTRY).sort();
if (JSON.stringify(registryIds) !== JSON.stringify([...VISUAL_BLOCK_TYPES].sort())) {
    throw new Error("Il registro dei blocchi non coincide con lo schema D1");
}
for (const definition of Object.values(VISUAL_BLOCK_REGISTRY)) {
    if (definition.propertySets.some((name) => !VISUAL_PROPERTY_SETS.includes(name))) {
        throw new Error("Il registro usa un insieme di proprietà sconosciuto");
    }
}

export function renderVisualPage({
    page,
    nodes,
    properties,
    assets = [],
    publicOrigin = "https://anonmrcn-ctrl.github.io"
}) {
    if (!page || page.status !== "published") {
        throw new VisualRenderError("La pagina non è pubblicata.");
    }
    const nodeById = new Map();
    const childrenByParent = new Map();
    for (const rawNode of nodes || []) {
        if (nodeById.has(rawNode.id)) throw new VisualRenderError("ID di nodo duplicato.");
        const definition = VISUAL_BLOCK_REGISTRY[rawNode.block_type];
        if (!definition) throw new VisualRenderError(`Tipo di blocco sconosciuto: ${rawNode.block_type}`);
        const node = { ...rawNode, definition };
        nodeById.set(node.id, node);
        const parentKey = node.parent_id || "";
        const siblings = childrenByParent.get(parentKey) || [];
        siblings.push(node);
        childrenByParent.set(parentKey, siblings);
    }
    for (const siblings of childrenByParent.values()) {
        if (siblings.length > MAX_CHILDREN) throw new VisualRenderError("Troppi blocchi allo stesso livello.");
        siblings.sort((a, b) => Number(a.position) - Number(b.position) || a.id.localeCompare(b.id));
        const positions = new Set(siblings.map((node) => Number(node.position)));
        if (positions.size !== siblings.length) throw new VisualRenderError("Posizione di blocco duplicata.");
    }
    const roots = childrenByParent.get("") || [];
    if (roots.length !== 1 || roots[0].block_type !== "page-root") {
        throw new VisualRenderError("L'albero deve avere una sola radice pagina.");
    }
    for (const node of nodeById.values()) {
        if (node.parent_id && !nodeById.has(node.parent_id)) {
            throw new VisualRenderError(`Genitore mancante per ${node.id}.`);
        }
    }

    const valuesByNode = normalizeProperties(properties, nodeById);
    const assetsById = new Map((assets || []).map((asset) => [asset.id, asset]));
    const visited = new Set();
    const html = renderNode(
        roots[0],
        1,
        childrenByParent,
        valuesByNode,
        assetsById,
        visited
    );
    if (visited.size !== nodeById.size) throw new VisualRenderError("L'albero contiene nodi irraggiungibili o ciclici.");

    const indexable = !PRIVATE_PAGE_SLUGS.has(page.slug);
    const path = page.slug === "index" ? "/" : `/${encodeURIComponent(page.slug)}.html`;
    const canonical = indexable ? new URL(path, publicOrigin).href : null;
    return {
        registryVersion: VISUAL_BLOCK_REGISTRY_VERSION,
        html,
        metadata: {
            title: String(page.title || ""),
            description: String(page.description || ""),
            canonical,
            robots: indexable ? "index,follow" : "noindex,nofollow",
            structuredData: indexable ? {
                "@context": "https://schema.org",
                "@type": "WebPage",
                name: String(page.title || ""),
                description: String(page.description || ""),
                url: canonical,
                inLanguage: "it"
            } : null
        }
    };
}

function normalizeProperties(properties, nodeById) {
    const valuesByNode = new Map();
    for (const property of properties || []) {
        const node = nodeById.get(property.node_id);
        if (!node) throw new VisualRenderError(`Proprietà orfana: ${property.property_name}`);
        if (!node.definition.propertySets.includes(property.property_set)) {
            throw new VisualRenderError(`Proprietà non consentita per ${node.block_type}: ${property.property_set}`);
        }
        if (property.domain === "technical") continue;
        const value = propertyValue(property);
        const values = valuesByNode.get(node.id) || new Map();
        const key = `${property.property_set}/${property.property_name}/${property.breakpoint || "all"}`;
        const list = values.get(key) || [];
        list.push({ position: Number(property.item_position || 0), value });
        list.sort((a, b) => a.position - b.position);
        values.set(key, list);
        valuesByNode.set(node.id, values);
    }
    return valuesByNode;
}

function propertyValue(property) {
    switch (property.value_kind) {
        case "integer": return Number.parseInt(property.number_value, 10);
        case "number": return Number(property.number_value);
        case "boolean": return Boolean(property.boolean_value);
        case "asset": return { type: "asset", id: property.asset_id };
        case "page": return { type: "page", id: property.page_reference_id };
        case "collection": return { type: "collection", key: property.collection_key };
        case "text":
        case "color":
        case "length":
        case "url": return String(property.text_value ?? "");
        default: throw new VisualRenderError(`Valore non supportato: ${property.value_kind}`);
    }
}

function renderNode(node, depth, childrenByParent, valuesByNode, assetsById, visited) {
    if (depth > MAX_DEPTH) throw new VisualRenderError("Profondità massima superata.");
    if (visited.has(node.id)) throw new VisualRenderError("Ciclo nell'albero dei blocchi.");
    visited.add(node.id);
    const children = childrenByParent.get(node.id) || [];
    for (const child of children) {
        if (!CATEGORY_CHILDREN[node.definition.category].includes(child.definition.category)) {
            throw new VisualRenderError(`Annidamento non consentito: ${node.block_type} > ${child.block_type}`);
        }
    }
    const childHtml = children.map((child) => renderNode(
        child,
        depth + 1,
        childrenByParent,
        valuesByNode,
        assetsById,
        visited
    )).join("");
    const values = valuesByNode.get(node.id) || new Map();
    const title = first(values, "content.copy/title") || first(values, "content.copy/eyebrow");
    const text = first(values, "content.copy/text");
    const items = all(values, "content.copy/items");
    const className = `visual-block visual-block--${node.block_type}`;
    const attributes = ` class="${className}" data-block-id="${escapeHtml(node.id)}"`;

    switch (node.definition.renderAs) {
        case "main":
            return `<main${attributes}><h1>${escapeHtml(title)}</h1>${text ? `<p>${escapeHtml(text)}</p>` : ""}${childHtml}</main>`;
        case "heading":
            return `<h2${attributes}>${escapeHtml(title || text)}</h2>`;
        case "paragraph":
            return `<p${attributes}>${escapeHtml(text)}</p>`;
        case "list":
            return `<ul${attributes}>${items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`;
        case "quote":
            return `<blockquote${attributes}><p>${escapeHtml(text)}</p>${title ? `<cite>${escapeHtml(title)}</cite>` : ""}</blockquote>`;
        case "image":
            return renderImage(node, values, assetsById, attributes);
        case "gallery":
            return `<div${attributes} role="group" aria-label="Galleria">${childHtml}</div>`;
        case "button":
            return `<a${attributes} href="${escapeHtml(safeHref(first(values, "behavior.link/href")))}">${escapeHtml(title || text)}</a>`;
        case "link-list":
            return `<ul${attributes}>${items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}${childHtml}</ul>`;
        case "nav":
            return `<nav${attributes} aria-label="${escapeHtml(title || "Navigazione")}">${childHtml}</nav>`;
        case "header": return `<header${attributes}>${text ? `<p>${escapeHtml(text)}</p>` : ""}${childHtml}</header>`;
        case "footer": return `<footer${attributes}>${text ? `<p>${escapeHtml(text)}</p>` : ""}${childHtml}</footer>`;
        case "aside": return `<aside${attributes}>${title ? `<h2>${escapeHtml(title)}</h2>` : ""}${text ? `<p>${escapeHtml(text)}</p>` : ""}${childHtml}</aside>`;
        case "article": return `<article${attributes}>${title ? `<h2>${escapeHtml(title)}</h2>` : ""}${text ? `<p>${escapeHtml(text)}</p>` : ""}${childHtml}</article>`;
        case "hr": return `<hr${attributes}>`;
        case "spacer": return `<div${attributes} aria-hidden="true"></div>`;
        case "section":
            return `<section${attributes}>${title ? `<h2>${escapeHtml(title)}</h2>` : ""}${text ? `<p>${escapeHtml(text)}</p>` : ""}${childHtml}</section>`;
        default:
            return `<${node.definition.renderAs}${attributes}>${childHtml}</${node.definition.renderAs}>`;
    }
}

function renderImage(node, values, assetsById, attributes) {
    const assetReference = first(values, "content.media/assetId");
    const asset = assetReference?.type === "asset" ? assetsById.get(assetReference.id) : null;
    if (!asset?.publicUrl) {
        return `<figure${attributes} data-media-fallback="true"><figcaption>Immagine non disponibile</figcaption></figure>`;
    }
    const alt = first(values, "content.media/alt") || asset.alt_text || "";
    const caption = first(values, "content.media/caption") || asset.caption || "";
    const image = `<img src="${escapeHtml(safeMediaUrl(asset.publicUrl))}" alt="${escapeHtml(alt)}"${asset.width ? ` width="${Number(asset.width)}"` : ""}${asset.height ? ` height="${Number(asset.height)}"` : ""} loading="lazy" decoding="async">`;
    return `<figure${attributes}>${image}${caption ? `<figcaption>${escapeHtml(caption)}</figcaption>` : ""}</figure>`;
}

function first(values, prefix) {
    return values.get(`${prefix}/all`)?.[0]?.value ?? "";
}

function all(values, prefix) {
    return (values.get(`${prefix}/all`) || []).map((item) => item.value);
}

function safeHref(value) {
    const href = String(value || "").trim();
    if (!href) return "#";
    if (/^(?:https:\/\/|mailto:|tel:|\/|\.\/|\.\.\/|#)/iu.test(href)) return href;
    return "#";
}

function safeMediaUrl(value) {
    const url = String(value || "").trim();
    return /^(?:https:\/\/|\/api\/public\/)/iu.test(url) ? url : "";
}

function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/gu, (character) => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        "\"": "&quot;",
        "'": "&#39;"
    })[character]);
}

export class VisualRenderError extends Error {}
