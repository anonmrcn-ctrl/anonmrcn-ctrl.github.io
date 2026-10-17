export const VISUAL_BEHAVIOR_VERSION = 1;

export const VISUAL_BEHAVIOR_OPTIONS = Object.freeze({
    linkOpenModes: Object.freeze([
        option("same-window", "Nella stessa finestra"),
        option("new-window", "In una nuova finestra")
    ]),
    navigationSources: Object.freeze([
        option("site-menu", "Menu principale pubblicato"),
        option("page-sections", "Sezioni della pagina")
    ]),
    tableOfContentsSources: Object.freeze([
        option("page-headings", "Titoli della pagina")
    ]),
    breadcrumbSources: Object.freeze([
        option("page-hierarchy", "Gerarchia delle pagine")
    ]),
    collectionSources: Object.freeze([
        option("public-pages", "Pagine pubblicate"),
        option("public-voices", "Voci pubblicate"),
        option("public-places", "Luoghi pubblicati"),
        option("public-sources", "Fonti pubblicate"),
        option("public-memories", "Memorie approvate con consenso")
    ]),
    collectionDisplays: Object.freeze([
        option("list", "Elenco"),
        option("cards", "Schede"),
        option("compact", "Compatta")
    ]),
    collectionLimits: Object.freeze([
        option("6", "6 elementi"),
        option("12", "12 elementi"),
        option("24", "24 elementi")
    ]),
    filterModes: Object.freeze([
        option("text", "Ricerca testuale"),
        option("category", "Scelta categoria"),
        option("place", "Scelta luogo")
    ]),
    formTypes: Object.freeze([
        option("memory-submission", "Invio di una Memoria")
    ]),
    consentModes: Object.freeze([
        option("required", "Consenso esplicito obbligatorio")
    ]),
    externalServices: Object.freeze([
        option("none", "Nessun servizio esterno")
    ]),
    telemetryModes: Object.freeze([
        option("off", "Disattivata")
    ])
});

const COLLECTION_SOURCES = new Set(VISUAL_BEHAVIOR_OPTIONS.collectionSources.map(({ value }) => value));
const LINK_OPEN_MODES = new Set(VISUAL_BEHAVIOR_OPTIONS.linkOpenModes.map(({ value }) => value));
const FILTER_MODES = new Set(VISUAL_BEHAVIOR_OPTIONS.filterModes.map(({ value }) => value));
const ANCHOR_PATTERN = /^[a-z][a-z0-9_-]{0,63}$/u;
const TARGET_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;

export function validateBehaviorValues(type, values) {
    const normalized = values || {};
    if (normalized.anchorId && !ANCHOR_PATTERN.test(normalized.anchorId)) {
        throw new Error("L’ancora deve iniziare con una lettera e usare soltanto lettere minuscole, numeri, trattini o trattini bassi.");
    }
    if (normalized.openMode && !LINK_OPEN_MODES.has(normalized.openMode)) {
        throw new Error("Modalità di apertura del collegamento non valida.");
    }
    if (normalized.links) parseLinkEntries(normalized.links);

    if (type === "data-collection") {
        if (!COLLECTION_SOURCES.has(normalized.collectionSource)) {
            throw new Error("Scegli una sorgente dati interna consentita.");
        }
        enforcePrivacyDefaults(normalized);
    }
    if (type === "data-filter") {
        if (!COLLECTION_SOURCES.has(normalized.filterSource)) {
            throw new Error("Scegli la stessa sorgente interna della raccolta da filtrare.");
        }
        if (!FILTER_MODES.has(normalized.filterMode)) {
            throw new Error("Modalità del filtro non valida.");
        }
        if (!TARGET_PATTERN.test(normalized.targetCollection || "")) {
            throw new Error("Indica l’identificativo del blocco raccolta da filtrare.");
        }
        enforcePrivacyDefaults(normalized);
    }
    if (type === "approved-form") {
        if (normalized.formType !== "memory-submission") {
            throw new Error("Il modulo selezionato non è autorizzato.");
        }
        if (normalized.consentMode !== "required") {
            throw new Error("La raccolta dati richiede consenso esplicito.");
        }
        enforcePrivacyDefaults(normalized);
    }
    return normalized;
}

export function validateBehaviorRelationships(type, nodeId, values, nodes, properties) {
    if (values.anchorId) {
        const duplicate = (properties || []).some((property) =>
            property.node_id !== nodeId &&
            property.property_set === "behavior.link" &&
            property.property_name === "anchorId" &&
            property.text_value === values.anchorId
        );
        if (duplicate) throw new Error("Questa ancora è già usata nella pagina.");
    }
    if (type !== "data-filter") return;
    const target = (nodes || []).find((node) => node.id === values.targetCollection);
    if (!target || target.block_type !== "data-collection") {
        throw new Error("Il filtro deve essere collegato a un blocco raccolta della stessa pagina.");
    }
    const source = (properties || []).find((property) =>
        property.node_id === target.id &&
        property.property_set === "behavior.collection" &&
        property.property_name === "source"
    )?.text_value || "public-pages";
    if (source !== values.filterSource) {
        throw new Error("Filtro e raccolta devono usare la stessa sorgente dati.");
    }
}

export function parseLinkEntries(rawValue) {
    const lines = String(rawValue || "").split(/\r?\n/u).map((line) => line.trim()).filter(Boolean);
    return lines.slice(0, 100).map((line) => {
        const separator = line.indexOf("|");
        if (separator < 1) {
            throw new Error("Ogni collegamento deve usare il formato «Etichetta | destinazione».");
        }
        const label = line.slice(0, separator).trim();
        const href = line.slice(separator + 1).trim();
        if (!label || label.length > 160 || !safeHref(href)) {
            throw new Error("Ogni collegamento deve avere un’etichetta breve e una destinazione sicura.");
        }
        return Object.freeze({ label, href });
    });
}

export function safeHref(value) {
    const href = String(value || "").trim();
    return /^(?:https:\/\/|mailto:|tel:|\/|\.\/|\.\.\/|#)/iu.test(href) ? href : null;
}

export function safeAnchorId(value) {
    const anchor = String(value || "").trim();
    return ANCHOR_PATTERN.test(anchor) ? anchor : null;
}

export function behaviorData(values, keys) {
    return keys.map(([property, attribute]) => {
        const value = firstValue(values, property);
        return value ? ` ${attribute}="${escapeAttribute(value)}"` : "";
    }).join("");
}

export function firstValue(values, key) {
    const list = values?.get(`${key}/all`) || [];
    return String(list[0]?.value ?? "").trim();
}

function enforcePrivacyDefaults(values) {
    if (values.externalService !== "none") {
        throw new Error("I servizi esterni non sono abilitati per questo blocco.");
    }
    if (values.telemetry !== "off") {
        throw new Error("La telemetria deve restare disattivata.");
    }
}

function option(value, label) {
    return Object.freeze({ value, label });
}

function escapeAttribute(value) {
    return String(value).replace(/[&<>"']/gu, (character) => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    })[character]);
}
