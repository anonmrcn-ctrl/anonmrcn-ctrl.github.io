import {
    VISUAL_BLOCK_TYPES,
    VISUAL_PROPERTY_SETS
} from "./visual-builder-storage.js";
import {
    behaviorData,
    parseLinkEntries,
    safeAnchorId,
    safeHref,
    VISUAL_BEHAVIOR_VERSION
} from "./visual-builder-behaviors.js";

export const VISUAL_BLOCK_REGISTRY_VERSION = 2;

const entry = (category, propertySets, renderAs = "section") =>
    Object.freeze({ category, propertySets: Object.freeze(propertySets), renderAs });

export const VISUAL_BLOCK_REGISTRY = Object.freeze({
    "page-root": entry("root", ["content.copy", "presentation.box", "presentation.layout", "presentation.responsive", "behavior.link"], "main"),
    "section": entry("structure", ["content.copy", "presentation.box", "presentation.layout", "presentation.responsive", "behavior.link"], "section"),
    "container": entry("structure", ["presentation.box", "presentation.layout", "presentation.responsive"], "div"),
    "stack": entry("structure", ["presentation.layout", "presentation.responsive"], "div"),
    "row": entry("structure", ["presentation.layout", "presentation.responsive"], "div"),
    "columns": entry("structure", ["presentation.layout", "presentation.responsive"], "div"),
    "grid": entry("structure", ["presentation.layout", "presentation.responsive"], "div"),
    "separator": entry("structure", ["presentation.box", "presentation.responsive"], "hr"),
    "spacer": entry("structure", ["presentation.box", "presentation.responsive"], "spacer"),
    "heading": entry("content", ["content.copy", "presentation.box", "presentation.layout", "presentation.typography", "presentation.responsive", "behavior.link"], "heading"),
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
    "project-poem": entry("project", ["content.copy", "presentation.typography", "presentation.responsive", "technical.binding"], "project-poem"),
    "project-path": entry("project", ["content.copy", "presentation.layout", "presentation.responsive", "behavior.collection", "technical.binding"], "project-path"),
    "project-map": entry("project", ["content.copy", "presentation.layout", "presentation.responsive", "behavior.collection", "technical.binding"], "project-map"),
    "project-voices": entry("project", ["content.copy", "content.media", "presentation.layout", "presentation.responsive", "behavior.collection", "technical.binding"], "project-voices"),
    "project-places": entry("project", ["content.copy", "content.media", "presentation.layout", "presentation.responsive", "behavior.collection", "technical.binding"], "project-places"),
    "project-sources": entry("project", ["content.copy", "presentation.layout", "behavior.collection", "technical.binding"], "project-sources"),
    "project-memories": entry("project", ["content.copy", "content.media", "presentation.layout", "presentation.responsive", "behavior.collection", "technical.binding"], "project-memories"),
    "project-archive": entry("project", ["content.copy", "presentation.layout", "presentation.responsive", "behavior.collection", "technical.binding"], "project-archive"),
    "personal-notebook": entry("personal", ["content.copy", "presentation.layout", "presentation.responsive", "behavior.collection", "technical.binding", "technical.security"], "personal-notebook"),
    "personal-space": entry("personal", ["content.copy", "content.media", "presentation.layout", "presentation.responsive", "behavior.collection", "technical.binding", "technical.security"], "personal-space"),
    "special-access": entry("functional", ["content.copy", "presentation.box", "behavior.form", "technical.binding", "technical.security"], "special-access"),
    "legal-document": entry("legal", ["content.copy", "presentation.typography", "presentation.responsive", "technical.binding"], "article"),
    "approved-form": entry("functional", ["content.copy", "presentation.box", "presentation.layout", "behavior.form", "technical.binding", "technical.security"], "approved-form"),
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
    adapterPayloads = new Map(),
    theme = null,
    publicOrigin = "https://anonmrcn-ctrl.github.io"
}) {
    if (!page || page.status !== "published") {
        throw new VisualRenderError("La pagina non è pubblicata.");
    }
    const { nodeById, childrenByParent } = prepareVisualTree(nodes);
    const valuesByNode = normalizeProperties(properties, nodeById);
    const assetsById = new Map((assets || []).map((asset) => [asset.id, asset]));
    const visited = new Set();
    const html = renderNode(
        (childrenByParent.get("") || [])[0],
        1,
        childrenByParent,
        valuesByNode,
        assetsById,
        adapterPayloads,
        visited
    );
    if (visited.size !== nodeById.size) throw new VisualRenderError("L'albero contiene nodi irraggiungibili o ciclici.");

    const indexable = !PRIVATE_PAGE_SLUGS.has(page.slug);
    const path = page.slug === "index" ? "/" : `/${encodeURIComponent(page.slug)}.html`;
    const canonical = indexable ? new URL(path, publicOrigin).href : null;
    return {
        registryVersion: VISUAL_BLOCK_REGISTRY_VERSION,
        behaviorVersion: VISUAL_BEHAVIOR_VERSION,
        html,
        theme,
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

export function validateVisualTreeStructure(nodes) {
    prepareVisualTree(nodes);
    return true;
}

function prepareVisualTree(nodes) {
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
    const visited = new Set();
    const visit = (node, depth) => {
        if (depth > MAX_DEPTH) throw new VisualRenderError("Profondità massima superata.");
        if (visited.has(node.id)) throw new VisualRenderError("Ciclo nell'albero dei blocchi.");
        visited.add(node.id);
        for (const child of childrenByParent.get(node.id) || []) {
            if (!CATEGORY_CHILDREN[node.definition.category].includes(child.definition.category)) {
                throw new VisualRenderError(`Annidamento non consentito: ${node.block_type} > ${child.block_type}`);
            }
            visit(child, depth + 1);
        }
    };
    visit(roots[0], 1);
    if (visited.size !== nodeById.size) throw new VisualRenderError("L'albero contiene nodi irraggiungibili o ciclici.");
    return { nodeById, childrenByParent };
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

function renderNode(
    node,
    depth,
    childrenByParent,
    valuesByNode,
    assetsById,
    adapterPayloads,
    visited
) {
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
        adapterPayloads,
        visited
    )).join("");
    const values = valuesByNode.get(node.id) || new Map();
    const title = first(values, "content.copy/title") || first(values, "content.copy/eyebrow");
    const text = first(values, "content.copy/text");
    const items = all(values, "content.copy/items");
    const className = `visual-block visual-block--${node.block_type}`;
    const anchorId = safeAnchorId(first(values, "behavior.link/anchorId"));
    const attributes = `${anchorId ? ` id="${escapeHtml(anchorId)}"` : ""} class="${className}" data-block-id="${escapeHtml(node.id)}"${presentationAttributes(values)}`;

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
            return renderButton(values, attributes, title || text);
        case "link-list": {
            const links = all(values, "behavior.link/href").flatMap((item) => parseLinkEntries(item));
            return `<ul${attributes}>${links.map(({ label, href }) => `<li><a href="${escapeHtml(safeHref(href) || "#")}">${escapeHtml(label)}</a></li>`).join("") || items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}${childHtml}</ul>`;
        }
        case "nav":
            return `<nav${attributes}${behaviorData(values, [["behavior.collection/source", "data-navigation-source"]])} aria-label="${escapeHtml(title || "Navigazione")}">${childHtml}</nav>`;
        case "header": return `<header${attributes}>${text ? `<p>${escapeHtml(text)}</p>` : ""}${childHtml}</header>`;
        case "footer": return `<footer${attributes}>${text ? `<p>${escapeHtml(text)}</p>` : ""}${childHtml}</footer>`;
        case "aside": return `<aside${attributes}>${title ? `<h2>${escapeHtml(title)}</h2>` : ""}${text ? `<p>${escapeHtml(text)}</p>` : ""}${childHtml}</aside>`;
        case "article": return `<article${attributes}>${title ? `<h2>${escapeHtml(title)}</h2>` : ""}${text ? `<p>${escapeHtml(text)}</p>` : ""}${childHtml}</article>`;
        case "hr": return `<hr${attributes}>`;
        case "spacer": return `<div${attributes} aria-hidden="true"></div>`;
        case "section":
            if (node.block_type === "data-collection") return renderDataCollection(
                values,
                adapterPayloads.get(node.id),
                node.id,
                attributes,
                title,
                text,
                childHtml
            );
            if (node.block_type === "data-filter") return renderDataFilter(values, attributes, title, childHtml);
            return `<section${attributes}>${title ? `<h2>${escapeHtml(title)}</h2>` : ""}${text ? `<p>${escapeHtml(text)}</p>` : ""}${childHtml}</section>`;
        case "project-poem":
        case "project-path":
        case "project-map":
        case "project-voices":
        case "project-places":
        case "project-sources":
        case "project-memories":
        case "project-archive":
        case "personal-notebook":
        case "personal-space":
        case "special-access":
        case "approved-form":
            return renderAdapter(node, adapterPayloads.get(node.id), attributes, childHtml, values);
        default:
            return `<${node.definition.renderAs}${attributes}>${childHtml}</${node.definition.renderAs}>`;
    }
}

function renderAdapter(node, payload, attributes, childHtml, values = new Map()) {
    const rows = Array.isArray(payload) ? payload : [];
    switch (node.block_type) {
        case "project-poem": {
            const sections = new Map();
            for (const line of rows) {
                const section = sections.get(line.section_id) || {
                    title: line.section_title,
                    position: Number(line.section_position),
                    lines: []
                };
                section.lines.push(line);
                sections.set(line.section_id, section);
            }
            return `<article${attributes} data-adapter="poem"><h2>${escapeHtml(rows[0]?.work_title || "Poesia")}</h2>${[...sections.values()].sort((a, b) => a.position - b.position).map((section) => `<section><h3>${escapeHtml(section.title)}</h3>${section.lines.map((line) => `<p id="${escapeHtml(line.line_id)}" data-indent="${Math.max(0, Math.min(12, Number(line.indent_level) || 0))}">${escapeHtml(line.text)}</p>`).join("")}</section>`).join("")}${childHtml}</article>`;
        }
        case "project-path":
            return `<section${attributes} data-adapter="narrative-steps"><h2>Percorso poetico</h2><ol>${rows.map((step) => `<li><h3>${step.title_url ? `<a href="${escapeHtml(safeHref(step.title_url) || "#")}">${escapeHtml(step.title)}</a>` : escapeHtml(step.title)}</h3><blockquote>${escapeHtml(step.verse)}</blockquote><p>${escapeHtml(step.explanation)}</p></li>`).join("")}</ol>${childHtml}</section>`;
        case "project-map":
            return `<section${attributes} data-adapter="map-layers" data-static-fallback="${node.id === "visual-memorie-map" ? "./memorie.html#memorieMap" : "./progetto.html#map"}"><h2>Mappa</h2><ul>${rows.map((layer) => `<li><strong>${escapeHtml(layer.title)}</strong>${layer.description ? ` — ${escapeHtml(layer.description)}` : ""} <span>(${Math.max(0, Number(layer.feature_count) || 0)})</span></li>`).join("")}</ul><p><a href="${node.id === "visual-memorie-map" ? "./memorie.html#memorieMap" : "./progetto.html#map"}">Apri la mappa interattiva</a></p>${childHtml}</section>`;
        case "project-voices":
            return `<section${attributes} data-adapter="wiki-entries"><h2>Voci</h2><ul>${rows.map((item) => `<li><a href="./voci/${encodeURIComponent(item.slug)}.html">${escapeHtml(item.title)}</a>${item.summary ? `<p>${escapeHtml(item.summary)}</p>` : ""}</li>`).join("")}</ul>${childHtml}</section>`;
        case "project-places":
            return `<section${attributes} data-adapter="map-entries"><h2>Luoghi</h2><ul>${rows.map((item) => `<li><a href="./luoghi/${encodeURIComponent(item.id)}.html">${escapeHtml(item.name)}</a>${item.description ? `<p>${escapeHtml(item.description)}</p>` : ""}</li>`).join("")}</ul>${childHtml}</section>`;
        case "project-sources":
            return `<section${attributes} data-adapter="sources"><h2>Fonti</h2><ol>${rows.map((source) => `<li>${source.url ? `<a href="${escapeHtml(safeHref(source.url) || "#")}" rel="noreferrer">${escapeHtml(source.title)}</a>` : escapeHtml(source.title)}${source.author ? ` — ${escapeHtml(source.author)}` : ""}</li>`).join("")}</ol>${childHtml}</section>`;
        case "project-memories":
            return `<section${attributes} data-adapter="memories"><h2>Memorie</h2>${rows.map((memory) => `<article><h3>${escapeHtml(memory.title)}</h3><p>${escapeHtml(memory.text)}</p>${memory.author_name ? `<p>Condivisa da ${escapeHtml(memory.author_name)}</p>` : ""}</article>`).join("")}${childHtml}</section>`;
        case "project-archive":
            return `<section${attributes} data-adapter="public-messages"><h2>Archivio</h2><ol>${rows.map((message) => `<li>${escapeHtml(message.text)}</li>`).join("")}</ol>${childHtml}</section>`;
        case "approved-form":
            return `<section${attributes} data-adapter="memory-form"${behaviorData(values, [
                ["behavior.form/formType", "data-form-type"],
                ["behavior.form/consentDocumentId", "data-consent-document"],
                ["behavior.form/consentMode", "data-consent-mode"],
                ["behavior.form/externalService", "data-external-service"],
                ["behavior.form/telemetry", "data-telemetry"]
            ])} data-static-fallback="./memorie.html#memoriaFormTitolo"><h2>Condividi una Memoria</h2><p>Il modulo completo permette di scegliere il punto sulla mappa e allegare un contenuto, mantenendo consenso e moderazione.</p><p><a href="./memorie.html#memoriaFormTitolo">Apri il modulo completo</a></p></section>`;
        case "personal-notebook":
            return `<section${attributes} data-adapter="local-notebook" data-static-fallback="./taccuino.html"><h2>Taccuino personale</h2><p>I contenuti salvati restano su questo dispositivo.</p><p><a href="./taccuino.html">Apri il taccuino completo</a></p>${childHtml}</section>`;
        case "personal-space":
            return `<section${attributes} data-adapter="personal-space"><h2>Spazio personale</h2><p>Accedi per vedere messaggi e contenuti della tua location.</p><a href="./accesso.html">Vai all'accesso</a>${childHtml}</section>`;
        case "special-access":
            return `<section${attributes} data-adapter="location-access" data-static-fallback="./accesso.html"><h2>Accesso</h2><p>La verifica del collegamento e l'accesso protetto restano nella pagina dedicata.</p><p><a href="./accesso.html">Apri l'accesso sicuro</a></p></section>`;
        default:
            return `<section${attributes}>${childHtml}</section>`;
    }
}

function renderButton(values, attributes, label) {
    const href = safeHref(first(values, "behavior.link/href")) || "#";
    const openMode = first(values, "behavior.link/openMode") || "same-window";
    const external = /^https:\/\//iu.test(href);
    const target = openMode === "new-window" ? ' target="_blank" rel="noopener noreferrer"' : "";
    const disclosure = external ? ' data-external-link="true"' : "";
    return `<a${attributes} href="${escapeHtml(href)}"${target}${disclosure}>${escapeHtml(label)}</a>`;
}

function renderDataCollection(values, payload, nodeId, attributes, title, text, childHtml) {
    const behavior = behaviorData(values, [
        ["behavior.collection/source", "data-collection-source"],
        ["behavior.collection/display", "data-collection-display"],
        ["behavior.collection/limit", "data-collection-limit"],
        ["behavior.collection/externalService", "data-external-service"],
        ["behavior.collection/telemetry", "data-telemetry"]
    ]);
    const limit = Math.max(1, Math.min(24, Number(first(values, "behavior.collection/limit")) || 12));
    const rows = payload?.kind === "data-collection" && Array.isArray(payload.items)
        ? payload.items.slice(0, limit)
        : [];
    const items = rows.map((item) => {
        const label = escapeHtml(item.title);
        const href = safeHref(item.href);
        const heading = href
            ? `<h3><a href="${escapeHtml(href)}"${/^https:\/\//iu.test(href) ? ' rel="noreferrer"' : ""}>${label}</a></h3>`
            : `<h3>${label}</h3>`;
        const searchText = `${item.title || ""} ${item.description || ""}`.trim().toLocaleLowerCase("it");
        return `<article data-collection-item data-search-text="${escapeHtml(searchText)}">${heading}${item.description ? `<p>${escapeHtml(item.description)}</p>` : ""}</article>`;
    }).join("");
    const empty = rows.length ? "" : '<p data-collection-empty>Nessun contenuto pubblicato.</p>';
    return `<section id="${escapeHtml(nodeId)}"${attributes}${behavior} aria-live="polite">${title ? `<h2>${escapeHtml(title)}</h2>` : ""}${text ? `<p>${escapeHtml(text)}</p>` : ""}<div data-collection-results>${items}${empty}${childHtml}</div></section>`;
}

function renderDataFilter(values, attributes, title, childHtml) {
    const target = first(values, "behavior.collection/targetCollection");
    const behavior = behaviorData(values, [
        ["behavior.collection/source", "data-filter-source"],
        ["behavior.collection/filterMode", "data-filter-mode"],
        ["behavior.collection/targetCollection", "data-filter-target"],
        ["behavior.collection/externalService", "data-external-service"],
        ["behavior.collection/telemetry", "data-telemetry"]
    ]);
    return `<section${attributes}${behavior}>${title ? `<h2>${escapeHtml(title)}</h2>` : ""}<label>${escapeHtml(title || "Filtra i contenuti")}<input type="search" autocomplete="off" aria-controls="${escapeHtml(target)}"></label><output data-filter-count aria-live="polite"></output>${childHtml}</section>`;
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

function presentationAttributes(values) {
    const definitions = [
        ["visual-align", "presentation.layout/alignment", "all", ["left", "center", "right"]],
        ["visual-width", "presentation.layout/width", "all", ["compact", "content", "wide", "full"]],
        ["visual-space-top", "presentation.box/spaceTop", "all", ["space-0", "space-1", "space-2", "space-3", "space-4", "space-5", "space-6"]],
        ["visual-space-bottom", "presentation.box/spaceBottom", "all", ["space-0", "space-1", "space-2", "space-3", "space-4", "space-5", "space-6"]],
        ["visual-font", "presentation.typography/fontFamily", "all", ["serif", "sans", "display"]],
        ["visual-size", "presentation.typography/fontSize", "all", ["small", "normal", "large", "xlarge"]],
        ["visual-color", "presentation.typography/color", "all", ["ink", "muted", "paper", "soft", "accent", "dark"]],
        ["visual-background", "presentation.box/background", "all", ["ink", "muted", "paper", "soft", "accent", "dark"]],
        ["visual-border", "presentation.box/border", "all", ["none", "thin", "strong"]],
        ["visual-radius", "presentation.box/radius", "all", ["none", "small", "large"]],
        ["visual-phone", "presentation.responsive/visibility", "phone", ["visible", "hidden"]],
        ["visual-tablet", "presentation.responsive/visibility", "tablet", ["visible", "hidden"]],
        ["visual-desktop", "presentation.responsive/visibility", "desktop", ["visible", "hidden"]]
    ];
    return definitions.map(([attribute, prefix, breakpoint, allowed]) => {
        const value = values.get(`${prefix}/${breakpoint}`)?.[0]?.value;
        return allowed.includes(value)
            ? ` data-${attribute}="${value}"`
            : "";
    }).join("");
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
