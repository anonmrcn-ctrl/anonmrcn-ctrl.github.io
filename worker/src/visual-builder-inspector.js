import { VISUAL_BLOCK_REGISTRY } from "./visual-builder-renderer.js";

export const VISUAL_INSPECTOR_VERSION = 1;

const option = (value, label, color = null) => Object.freeze({ value, label, color });

const STYLE_FIELDS = Object.freeze([
    field("alignment", "Allineamento", "presentation.layout", "alignment", "text", "select", [
        option("left", "Sinistra"), option("center", "Centro"), option("right", "Destra")
    ]),
    field("width", "Larghezza", "presentation.layout", "width", "text", "select", [
        option("compact", "Compatta"), option("content", "Contenuto"),
        option("wide", "Ampia"), option("full", "Tutta larghezza")
    ]),
    field("spaceTop", "Spazio sopra", "presentation.box", "spaceTop", "length", "select", spacing()),
    field("spaceBottom", "Spazio sotto", "presentation.box", "spaceBottom", "length", "select", spacing()),
    field("fontFamily", "Carattere", "presentation.typography", "fontFamily", "text", "select", [
        option("serif", "Serif"), option("sans", "Senza grazie"), option("display", "Titolo")
    ]),
    field("fontSize", "Dimensione testo", "presentation.typography", "fontSize", "length", "select", [
        option("small", "Piccola"), option("normal", "Normale"),
        option("large", "Grande"), option("xlarge", "Molto grande")
    ]),
    field("textColor", "Colore testo", "presentation.typography", "color", "color", "select", colors()),
    field("background", "Sfondo", "presentation.box", "background", "color", "select", colors()),
    field("border", "Bordo", "presentation.box", "border", "text", "select", [
        option("none", "Nessuno"), option("thin", "Sottile"), option("strong", "Marcato")
    ]),
    field("radius", "Angoli", "presentation.box", "radius", "length", "select", [
        option("none", "Dritti"), option("small", "Poco arrotondati"), option("large", "Arrotondati")
    ]),
    field("visibilityPhone", "Su smartphone", "presentation.responsive", "visibility", "text", "select", visibility(), "phone"),
    field("visibilityTablet", "Su tablet", "presentation.responsive", "visibility", "text", "select", visibility(), "tablet"),
    field("visibilityDesktop", "Su desktop", "presentation.responsive", "visibility", "text", "select", visibility(), "desktop")
]);

const COPY_FIELDS = Object.freeze({
    "page-root": [textField("title", "Titolo pagina", "title", 200), textArea("text", "Descrizione", "text", 500)],
    section: [textField("title", "Titolo sezione", "title", 200), textArea("text", "Testo introduttivo", "text", 5000)],
    heading: [textField("title", "Titolo", "title", 200)],
    "rich-text": [textArea("text", "Testo", "text", 20000)],
    list: [textArea("items", "Voci, una per riga", "items", 10000, "lines")],
    quote: [textArea("text", "Citazione", "text", 5000), textField("title", "Autore", "title", 200)],
    button: [textField("title", "Etichetta", "title", 160), urlField("href", "Destinazione")],
    "link-list": [textArea("items", "Elementi, uno per riga", "items", 10000, "lines")],
    image: [mediaField("alt", "Testo alternativo", "alt", 300, true), mediaField("caption", "Didascalia", "caption", 500)],
    "global-header": [textField("title", "Titolo", "title", 200), textArea("text", "Testo", "text", 2000)],
    "global-footer": [textArea("text", "Testo", "text", 2000)],
    "global-notice": [textField("title", "Titolo", "title", 200), textArea("text", "Avviso", "text", 2000)],
    "legal-document": [textField("title", "Titolo", "title", 200), textArea("text", "Testo", "text", 20000)]
});

export const VISUAL_INSPECTOR_SCHEMAS = Object.freeze(Object.fromEntries(
    ["page-root", "section", "container", "stack", "row", "columns", "grid",
        "separator", "spacer", "heading", "rich-text", "list", "quote", "image",
        "gallery", "button", "link-list", "menu", "table-of-contents", "breadcrumb",
        "global-header", "global-footer", "global-notice", "project-poem", "project-path",
        "project-map", "project-voices", "project-places", "project-sources",
        "project-memories", "project-archive", "personal-notebook", "personal-space",
        "special-access", "legal-document", "approved-form", "data-collection", "data-filter"
    ].map((type) => {
        const allowedSets = new Set(VISUAL_BLOCK_REGISTRY[type]?.propertySets || []);
        const fields = [...(COPY_FIELDS[type] || []), ...STYLE_FIELDS]
            .filter((descriptor) => allowedSets.has(descriptor.propertySet));
        return [type, Object.freeze(fields)];
    })
));

export function editableValues(type, properties) {
    const values = {};
    for (const descriptor of VISUAL_INSPECTOR_SCHEMAS[type] || []) {
        const matches = (properties || []).filter((property) =>
            property.property_set === descriptor.propertySet &&
            property.property_name === descriptor.propertyName &&
            String(property.breakpoint || "all") === descriptor.breakpoint
        ).sort((left, right) => Number(left.item_position) - Number(right.item_position));
        if (descriptor.format === "lines") {
            values[descriptor.key] = matches.map(propertyValue).join("\n");
        } else if (matches.length) {
            values[descriptor.key] = propertyValue(matches[0]);
        } else if (descriptor.propertyName === "visibility") {
            values[descriptor.key] = "visible";
        } else {
            values[descriptor.key] = "";
        }
    }
    return values;
}

export function normalizeInspectorValues(type, rawValues) {
    if (!rawValues || typeof rawValues !== "object" || Array.isArray(rawValues)) {
        throw new Error("Proprietà visuali non valide.");
    }
    const schema = VISUAL_INSPECTOR_SCHEMAS[type];
    if (!schema) throw new Error("Questo tipo di blocco non ha un ispettore.");
    const known = new Set(schema.map((descriptor) => descriptor.key));
    if (Object.keys(rawValues).some((key) => !known.has(key))) {
        throw new Error("L'ispettore contiene una proprietà non consentita.");
    }
    const normalized = {};
    for (const descriptor of schema) {
        const value = String(rawValues[descriptor.key] ?? "").trim();
        if (descriptor.required && !value) {
            throw new Error(`«${descriptor.label}» è obbligatorio.`);
        }
        if (value.length > descriptor.maxLength) {
            throw new Error(`«${descriptor.label}» è troppo lungo.`);
        }
        if (descriptor.options && value && !descriptor.options.some((item) => item.value === value)) {
            throw new Error(`Valore non valido per «${descriptor.label}».`);
        }
        if (descriptor.control === "url" && value && !safeHref(value)) {
            throw new Error("La destinazione deve essere HTTPS, locale, email, telefono o ancora.");
        }
        normalized[descriptor.key] = value;
    }
    if (["visibilityPhone", "visibilityTablet", "visibilityDesktop"].every(
        (key) => normalized[key] === "hidden"
    )) {
        throw new Error("Il blocco non può essere nascosto su tutti i dispositivi.");
    }
    const contrast = contrastRatio(
        colorValue(normalized.textColor || "ink"),
        colorValue(normalized.background || "paper")
    );
    if (contrast < 4.5) {
        throw new Error(`Contrasto insufficiente (${contrast.toFixed(2)}:1): scegli colori più leggibili.`);
    }
    return { schema, values: normalized };
}

export function inspectorRows(normalized, now) {
    const rows = [];
    for (const descriptor of normalized.schema) {
        const value = normalized.values[descriptor.key];
        if (!value) continue;
        const values = descriptor.format === "lines"
            ? value.split(/\r?\n/u).map((item) => item.trim()).filter(Boolean).slice(0, 100)
            : [value];
        values.forEach((item, index) => rows.push({
            domain: descriptor.propertySet.split(".")[0],
            propertySet: descriptor.propertySet,
            propertyName: descriptor.propertyName,
            breakpoint: descriptor.breakpoint,
            itemPosition: descriptor.format === "lines" ? index + 1 : 0,
            valueKind: descriptor.valueKind,
            textValue: item,
            createdAt: now,
            updatedAt: now
        }));
    }
    return rows;
}

function field(key, label, propertySet, propertyName, valueKind, control, options = null, breakpoint = "all", maxLength = 96, required = false, format = "single") {
    return Object.freeze({ key, label, propertySet, propertyName, valueKind, control, options, breakpoint, maxLength, required, format });
}

function textField(key, label, propertyName, maxLength) {
    return field(key, label, "content.copy", propertyName, "text", "text", null, "all", maxLength);
}

function textArea(key, label, propertyName, maxLength, format = "single") {
    return field(key, label, "content.copy", propertyName, "text", "textarea", null, "all", maxLength, false, format);
}

function urlField(key, label) {
    return field(key, label, "behavior.link", "href", "url", "url", null, "all", 2048);
}

function mediaField(key, label, propertyName, maxLength, required = false) {
    return field(key, label, "content.media", propertyName, "text", "text", null, "all", maxLength, required);
}

function spacing() {
    return Array.from({ length: 7 }, (_, index) => option(`space-${index}`, String(index)));
}

function colors() {
    return [
        option("ink", "Inchiostro", "#191919"),
        option("muted", "Grigio", "#5b5b5b"),
        option("paper", "Carta", "#f4f1e8"),
        option("soft", "Carta scura", "#e6e0d2"),
        option("accent", "Giallo", "#d6a900"),
        option("dark", "Blu notte", "#202733")
    ];
}

function visibility() {
    return [option("visible", "Visibile"), option("hidden", "Nascosto")];
}

function propertyValue(property) {
    if (property.value_kind === "boolean") return property.boolean_value ? "true" : "false";
    if (["integer", "number"].includes(property.value_kind)) return String(property.number_value ?? "");
    return String(property.text_value ?? "");
}

function safeHref(value) {
    return /^(?:https:\/\/|mailto:|tel:|\/|\.\/|\.\.\/|#)/iu.test(value);
}

function colorValue(name) {
    return colors().find((item) => item.value === name)?.color || "#191919";
}

function contrastRatio(first, second) {
    const [lighter, darker] = [luminance(first), luminance(second)].sort((a, b) => b - a);
    return (lighter + 0.05) / (darker + 0.05);
}

function luminance(hex) {
    const channels = hex.match(/[a-f0-9]{2}/giu).map((value) => parseInt(value, 16) / 255);
    const linear = channels.map((value) => value <= 0.03928
        ? value / 12.92
        : ((value + 0.055) / 1.055) ** 2.4);
    return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
}
