import {
    mkdir,
    readFile,
    readdir,
    unlink,
    writeFile
} from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

const DEFAULT_API_BASE = "https://nnmrcn-rete.anonmrcn.workers.dev";
const CATEGORY_LABELS = Object.freeze({
    luogo: "Luogo",
    edificio: "Edificio",
    monumento: "Monumento",
    infrastruttura: "Infrastruttura",
    paesaggio: "Paesaggio",
    corso_d_acqua: "Corso d’acqua",
    cava: "Cava",
    percorso: "Percorso"
});

function escapeHtml(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

function xmlEscape(value) {
    return escapeHtml(value);
}

function safeJson(value) {
    return JSON.stringify(value).replace(/</g, "\\u003c");
}

function safeHttpUrl(value) {
    try {
        const url = new URL(String(value || ""));
        return ["http:", "https:"].includes(url.protocol) ? url.href : "";
    } catch (_) {
        return "";
    }
}

function slugify(value) {
    return String(value || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/gu, "")
        .toLocaleLowerCase("it")
        .replace(/[^a-z0-9]+/gu, "-")
        .replace(/^-+|-+$/gu, "");
}

function plainText(value) {
    return String(value || "")
        .replace(/\[fonte:[^\]\n]+\]/gi, "")
        .replace(/\[foto:[0-9a-f-]{36}\]/gi, "")
        .replace(/\[indice\]/gi, "")
        .replace(/\[\[([^\]\n|]+)\|([^\]\n]+)\]\]/g, "$2")
        .replace(/\[\[([^\]\n]+)\]\]/g, "$1")
        .replace(/\[([^\]\n]+)\]\(https?:\/\/[^)\s]+\)/gi, "$1")
        .replace(/[*#|]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

function descriptionFor(value, fallback) {
    const text = plainText(value) || fallback;

    if (text.length <= 180) {
        return text;
    }

    const shortened = text.slice(0, 177);
    const boundary = shortened.lastIndexOf(" ");
    return `${shortened.slice(0, boundary > 120 ? boundary : 177)}…`;
}

function preferredWikiPath(slug) {
    return `/voci/${encodeURIComponent(slug)}.html`;
}

function preferredPlacePath(id) {
    return `/luoghi/${Number(id)}.html`;
}

function placeDescription(place) {
    const category = (CATEGORY_LABELS[place.category] || "Luogo").toLocaleLowerCase("it");
    return descriptionFor(
        `Scheda cartografica del ${category} ${place.name} a Marcon. ${place.description || ""}`,
        `Scheda del luogo ${place.name} nella mappa di anonMrcn.`
    );
}

function normalizedTitle(value) {
    return String(value || "")
        .replace(/[«»“”"']/g, "")
        .replace(/\s+/g, " ")
        .trim()
        .toLocaleLowerCase("it");
}

function parseSourceToken(token) {
    const parts = token.slice(7, -1).split("|");

    if (parts.length !== 4) {
        return null;
    }

    try {
        const [url, title, author, date] = parts.map(decodeURIComponent);

        if (!title || (url && !safeHttpUrl(url))) {
            return null;
        }

        return { url: safeHttpUrl(url), title, author, date };
    } catch (_) {
        return null;
    }
}

function citationContext(scope) {
    return {
        scope,
        items: [],
        byKey: new Map(),
        occurrences: 0
    };
}

function renderCitation(source, citations) {
    const key = JSON.stringify(source);
    let item = citations.byKey.get(key);

    if (!item) {
        item = { ...source, number: citations.items.length + 1, backlinks: [] };
        citations.byKey.set(key, item);
        citations.items.push(item);
    }

    citations.occurrences += 1;
    const callId = `richiamo-${citations.scope}-${citations.occurrences}`;
    item.backlinks.push(callId);
    return `<sup class="voce-richiamo-fonte"><a id="${callId}" href="#fonte-${citations.scope}-${item.number}" aria-label="Fonte ${item.number}: ${escapeHtml(item.title)}">[${item.number}]</a></sup>`;
}

function resolveWikiTarget(wikis, rawSlug, label) {
    const requestedSlug = slugify(rawSlug);
    const normalizedLabel = normalizedTitle(label);
    const labelSlug = slugify(label);

    return wikis.find((entry) => entry.slug === requestedSlug) ||
        wikis.find((entry) =>
            normalizedTitle(entry.title) === normalizedLabel ||
            entry.slug === labelSlug
        ) || null;
}

function renderInline(value, citations, wikis) {
    const source = String(value || "");
    const pattern = /(\*\*[^*\n]+\*\*|\*[^*\n]+\*|\[fonte:[^\]\n]+\]|\[\[[^\]\n]+\]\]|\[[^\]\n]+\]\(https?:\/\/[^)\s]+\))/g;
    let cursor = 0;
    let html = "";

    for (const match of source.matchAll(pattern)) {
        html += escapeHtml(source.slice(cursor, match.index));
        const token = match[0];

        if (token.startsWith("**")) {
            html += `<strong>${renderInline(token.slice(2, -2), citations, wikis)}</strong>`;
        } else if (token.startsWith("*")) {
            html += `<em>${renderInline(token.slice(1, -1), citations, wikis)}</em>`;
        } else if (token.startsWith("[fonte:")) {
            const parsed = parseSourceToken(token);
            html += parsed ? renderCitation(parsed, citations) : escapeHtml(token);
        } else if (token.startsWith("[[")) {
            const [rawSlug, label] = token.slice(2, -2).split("|", 2);
            const linkText = label || rawSlug;
            const target = resolveWikiTarget(wikis, rawSlug, linkText);
            html += target
                ? `<a href="${preferredWikiPath(target.slug)}">${escapeHtml(linkText)}</a>`
                : `<span class="voce-collegamento-mancante" title="Voce non ancora disponibile">${escapeHtml(linkText)}</span>`;
        } else {
            const external = /^\[([^\]]+)\]\((https?:\/\/[^)]+)\)$/.exec(token);
            const url = external ? safeHttpUrl(external[2]) : "";
            html += url
                ? `<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(external[1])}</a>`
                : escapeHtml(token);
        }

        cursor = match.index + token.length;
    }

    return html + escapeHtml(source.slice(cursor));
}

function parseTableRow(line) {
    const value = String(line || "").trim();

    if (!value.startsWith("|") || !value.endsWith("|")) {
        return null;
    }

    return value.slice(1, -1).split(/(?<!\\)\|/u).map((cell) =>
        cell.replace(/\\\|/g, "|").trim()
    );
}

function tableAt(lines, index) {
    let headerIndex = index;
    let caption = "";
    const marker = /^\[tabella(?::([^\]]*))?\]$/i.exec(lines[index]?.trim() || "");

    if (marker) {
        headerIndex += 1;
        try {
            caption = marker[1] ? decodeURIComponent(marker[1]) : "";
        } catch (_) {
            caption = marker[1] || "";
        }
    }

    const headers = parseTableRow(lines[headerIndex]);
    const separators = parseTableRow(lines[headerIndex + 1]);

    if (
        !headers || headers.length < 2 || !separators ||
        separators.length !== headers.length ||
        !separators.every((cell) => /^:?-{3,}:?$/.test(cell))
    ) {
        return null;
    }

    const rows = [];
    let endIndex = headerIndex + 1;

    for (let rowIndex = headerIndex + 2; rowIndex < lines.length; rowIndex += 1) {
        const cells = parseTableRow(lines[rowIndex]);
        if (!cells) break;
        rows.push(headers.map((_, cellIndex) => cells[cellIndex] || ""));
        endIndex = rowIndex;
    }

    return { caption, headers, rows, endIndex };
}

function renderTable(table, citations, wikis) {
    const caption = table.caption
        ? `<caption>${renderInline(table.caption, citations, wikis)}</caption>`
        : "";
    const head = table.headers.map((value) =>
        `<th scope="col">${renderInline(value, citations, wikis)}</th>`
    ).join("");
    const body = table.rows.map((row) => `<tr>${row.map((value) =>
        `<td>${renderInline(value, citations, wikis)}</td>`
    ).join("")}</tr>`).join("");
    return `<div class="voce-tabella-contenitore" role="region" aria-label="${escapeHtml(table.caption || "Tabella della voce")}"><table class="voce-tabella">${caption}<thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>`;
}

function renderWikiBody(entry, wikis, citations, apiBase) {
    const lines = String(entry.body || "").split(/\r?\n/);
    const images = new Map((entry.images || []).map((image) => [image.id, image]));
    const headingCounts = new Map();
    const headings = lines.flatMap((line, lineIndex) => {
        const match = /^(#{2,3})\s+(.+)$/.exec(line.trim());
        if (!match) return [];
        const title = plainText(match[2]) || "Sezione";
        const base = slugify(title) || "sezione";
        const count = (headingCounts.get(base) || 0) + 1;
        headingCounts.set(base, count);
        return [{
            lineIndex,
            level: match[1].length,
            title,
            id: `${entry.slug}-${base}${count > 1 ? `-${count}` : ""}`
        }];
    });
    const headingsByLine = new Map(headings.map((item) => [item.lineIndex, item]));
    let html = headings.length >= 2
        ? `<nav class="voce-indice-interno" aria-label="Indice della voce"><p class="voce-indice-interno-titolo">Indice</p><ol>${headings.map((heading) => `<li class="voce-indice-${heading.level === 3 ? "sottosezione" : "sezione"}"><a href="#${heading.id}">${escapeHtml(heading.title)}</a></li>`).join("")}</ol></nav>`
        : "";
    let paragraph = [];
    let list = [];

    const flushParagraph = () => {
        if (paragraph.length) {
            html += `<p>${renderInline(paragraph.join(" "), citations, wikis)}</p>`;
            paragraph = [];
        }
    };
    const flushList = () => {
        if (list.length) {
            html += `<ul>${list.map((item) => `<li>${renderInline(item, citations, wikis)}</li>`).join("")}</ul>`;
            list = [];
        }
    };

    for (let index = 0; index < lines.length; index += 1) {
        const trimmed = lines[index].trim();
        const table = tableAt(lines, index);
        const heading = /^(#{2,3})\s+(.+)$/.exec(trimmed);
        const listItem = /^[-*]\s+(.+)$/.exec(trimmed);
        const photo = /^\[foto:([0-9a-f-]{36})\]$/.exec(trimmed);

        if (table) {
            flushParagraph();
            flushList();
            html += renderTable(table, citations, wikis);
            index = table.endIndex;
        } else if (!trimmed) {
            flushParagraph();
            flushList();
        } else if (heading) {
            flushParagraph();
            flushList();
            const data = headingsByLine.get(index);
            const tag = heading[1].length === 2 ? "h2" : "h3";
            html += `<${tag} id="${data.id}">${renderInline(heading[2], citations, wikis)}</${tag}>`;
        } else if (trimmed.toLocaleLowerCase("it") === "[indice]") {
            flushParagraph();
            flushList();
        } else if (photo) {
            flushParagraph();
            flushList();
            const image = images.get(photo[1]);
            const imageUrl = image?.mediaUrl
                ? new URL(image.mediaUrl, `${apiBase}/`).href
                : "";
            if (image && imageUrl) {
                const srcset = (image.sources || []).map((source) =>
                    `${new URL(source.url, `${apiBase}/`).href} ${Number(source.width)}w`
                ).join(", ");
                const dimensions = image.width && image.height
                    ? ` width="${Number(image.width)}" height="${Number(image.height)}"`
                    : "";
                const responsive = srcset
                    ? ` srcset="${escapeHtml(srcset)}" sizes="${escapeHtml(image.sizes || "(max-width: 640px) 100vw, 960px")}"`
                    : "";
                html += `<figure class="voce-foto"><img src="${escapeHtml(imageUrl)}"${responsive}${dimensions} alt="${escapeHtml(image.alt || "")}" loading="lazy" decoding="async">${image.caption ? `<figcaption>${renderInline(image.caption, citations, wikis)}</figcaption>` : ""}</figure>`;
            }
        } else if (listItem) {
            flushParagraph();
            list.push(listItem[1]);
        } else {
            flushList();
            paragraph.push(trimmed);
        }
    }

    flushParagraph();
    flushList();
    return html || "<p>Questa voce non contiene ancora un approfondimento.</p>";
}

function renderReferences(citations) {
    if (!citations.items.length) return "";
    return `<section class="voce-fonti" aria-labelledby="fonti-${citations.scope}"><h2 id="fonti-${citations.scope}">Fonti</h2><ol>${citations.items.map((source) => {
        const title = source.url
            ? `<a href="${escapeHtml(source.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(source.title)}</a>`
            : escapeHtml(source.title);
        const details = [source.author, source.date].filter(Boolean);
        const backlinks = source.backlinks.map((id, index) =>
            `<a class="voce-fonte-ritorno" href="#${id}" aria-label="Torna al richiamo ${index + 1} della fonte ${source.number}">↑</a>`
        ).join("");
        return `<li id="fonte-${citations.scope}-${source.number}">${title}${details.length ? `<span class="voce-fonte-dettagli"> — ${escapeHtml(details.join(", "))}.</span>` : ""}${backlinks}</li>`;
    }).join("")}</ol></section>`;
}

function pageShell({ title, description, canonical, image, type, jsonLd, body, stylesheet }) {
    return `<!DOCTYPE html>
<html lang="it">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="description" content="${escapeHtml(description)}">
    <meta name="robots" content="index, follow, max-image-preview:large">
    <meta name="theme-color" content="#f4f1e8">
    <title>${escapeHtml(title)}</title>
    <link rel="canonical" href="${escapeHtml(canonical)}">
    <meta property="og:type" content="${type}">
    <meta property="og:locale" content="it_IT">
    <meta property="og:site_name" content="anonMrcn">
    <meta property="og:title" content="${escapeHtml(title)}">
    <meta property="og:description" content="${escapeHtml(description)}">
    <meta property="og:url" content="${escapeHtml(canonical)}">
    <meta property="og:image" content="${escapeHtml(image)}">
    <meta property="og:image:alt" content="Immagine del progetto anonMrcn">
    <meta name="twitter:card" content="summary_large_image">
    <link rel="icon" href="/favicon.ico?v=logo3" sizes="any">
    <link rel="stylesheet" href="/style.css?v=20261009-admin-actions1">
    <link rel="stylesheet" href="/${stylesheet}">
    <link rel="stylesheet" href="/public-content.css?v=20261009-permalink1">
    <script type="application/ld+json">${safeJson(jsonLd)}</script>
</head>
${body}
</html>
`;
}

export function renderWikiPage(entry, wikis, options) {
    const pathName = preferredWikiPath(entry.slug);
    const canonical = `${options.siteOrigin}${pathName}`;
    const title = `${entry.title} — Voce di Marcon`;
    const description = descriptionFor(
        entry.summary || entry.body,
        `Approfondimento su ${entry.title} nel territorio di Marcon.`
    );
    const firstImage = (entry.images || []).find((image) => image.mediaUrl);
    const image = firstImage
        ? new URL(firstImage.mediaUrl, `${options.apiBase}/`).href
        : options.defaultImage;
    const citations = citationContext(`voce-${entry.id}`);
    const summary = entry.summary
        ? `<p class="voce-sommario">${renderInline(entry.summary, citations, wikis)}</p>`
        : "";
    const body = renderWikiBody(entry, wikis, citations, options.apiBase);
    const updated = Number(entry.updatedAt) > 0
        ? `<p class="voce-metadati">Ultima modifica: <time datetime="${new Date(Number(entry.updatedAt)).toISOString()}">${new Intl.DateTimeFormat("it-IT", { dateStyle: "long" }).format(new Date(Number(entry.updatedAt)))}</time></p>`
        : "";
    const jsonLd = {
        "@context": "https://schema.org",
        "@type": "Article",
        headline: entry.title,
        description,
        inLanguage: "it-IT",
        mainEntityOfPage: canonical,
        image,
        publisher: { "@type": "Organization", name: "anonMrcn" },
        ...(entry.publishedAt ? { datePublished: new Date(Number(entry.publishedAt)).toISOString() } : {}),
        ...(entry.updatedAt ? { dateModified: new Date(Number(entry.updatedAt)).toISOString() } : {})
    };

    return pageShell({
        title,
        description,
        canonical,
        image,
        type: "article",
        stylesheet: "voci.css?v=20260912-tabelle-a-capo2",
        jsonLd,
        body: `<body class="pagina-voci pagina-contenuto-statico">
    <main class="spazio-pubblico voci-pagina contenuto-statico">
        <nav class="contenuto-statico-breadcrumb" aria-label="Percorso"><a href="/voci.html">Voci</a><span aria-hidden="true">/</span><span aria-current="page">${escapeHtml(entry.title)}</span></nav>
        <article class="voce-articolo">
            <h1>${escapeHtml(entry.title)}</h1>
            ${summary}
            <div class="voce-corpo">${body}</div>
            ${renderReferences(citations)}
            ${updated}
        </article>
        <nav class="contenuto-statico-azioni" aria-label="Continua la navigazione"><a href="/voci.html">Tutte le Voci</a><a href="/progetto.html#map">Esplora la mappa</a></nav>
    </main>
</body>`
    });
}

function relatedWiki(place, wikis) {
    const source = String(place.sourceUrl || "");
    let sourceSlug = "";

    try {
        const parsed = new URL(source);
        if (parsed.pathname.endsWith("/voci.html") && parsed.hash.length > 1) {
            sourceSlug = decodeURIComponent(parsed.hash.slice(1));
        }
    } catch (_) {
        sourceSlug = "";
    }

    return wikis.find((entry) => entry.slug === sourceSlug) ||
        wikis.find((entry) => normalizedTitle(entry.title) === normalizedTitle(place.name)) ||
        null;
}

export function renderPlacePage(place, wikis, options) {
    const pathName = preferredPlacePath(place.id);
    const canonical = `${options.siteOrigin}${pathName}`;
    const title = `${place.name} — Luogo di Marcon`;
    const description = placeDescription(place);
    const image = place.imageUrl
        ? new URL(place.imageUrl, `${options.apiBase}/`).href
        : options.defaultImage;
    const imageSrcset = (place.imageSources || []).map((source) =>
        `${new URL(source.url, `${options.apiBase}/`).href} ${Number(source.width)}w`
    ).join(", ");
    const imageResponsive = imageSrcset
        ? ` srcset="${escapeHtml(imageSrcset)}" sizes="${escapeHtml(place.imageSizes || "(max-width: 640px) 100vw, 960px")}"`
        : "";
    const imageDimensions = place.imageWidth && place.imageHeight
        ? ` width="${Number(place.imageWidth)}" height="${Number(place.imageHeight)}"`
        : "";
    const wiki = relatedWiki(place, wikis);
    const externalSource = !wiki ? safeHttpUrl(place.sourceUrl) : "";
    const detailLink = wiki
        ? `<a class="luogo-scheda-azione luogo-scheda-azione-principale" href="${preferredWikiPath(wiki.slug)}">Apri la voce completa</a>`
        : externalSource
            ? `<a class="luogo-scheda-azione luogo-scheda-azione-principale" href="${escapeHtml(externalSource)}" target="_blank" rel="noopener noreferrer">${escapeHtml(place.sourceLabel || "Consulta la fonte")}</a>`
            : "";
    const jsonLd = {
        "@context": "https://schema.org",
        "@type": "Place",
        name: place.name,
        description,
        url: canonical,
        image,
        geo: {
            "@type": "GeoCoordinates",
            latitude: Number(place.lat),
            longitude: Number(place.lon)
        }
    };

    return pageShell({
        title,
        description,
        canonical,
        image,
        type: "article",
        stylesheet: "luogo.css?v=20261007-place-photo1",
        jsonLd,
        body: `<body class="pagina-luogo-scheda pagina-contenuto-statico">
    <main class="luogo-scheda-pagina contenuto-statico">
        <a class="luogo-scheda-logo" href="/progetto.html" aria-label="Vai al progetto anonMrcn"><img src="/logo.webp" alt="anonMrcn"></a>
        <article class="luogo-scheda">
            ${place.imageUrl ? `<figure class="luogo-scheda-banner"><img src="${escapeHtml(image)}"${imageResponsive}${imageDimensions} alt="Fotografia di ${escapeHtml(place.name)}" loading="eager" decoding="async"></figure>` : ""}
            <div class="luogo-scheda-corpo">
                <p class="luogo-scheda-categoria">${escapeHtml(CATEGORY_LABELS[place.category] || "Luogo")}</p>
                <h1>${escapeHtml(place.name)}</h1>
                <div class="luogo-scheda-testo"><p>${escapeHtml(place.description || "La spiegazione di questo luogo non è ancora disponibile.")}</p></div>
                <nav class="luogo-scheda-azioni" aria-label="Approfondisci questo luogo">
                    ${detailLink}
                    <a class="luogo-scheda-azione" href="/progetto.html?luogo=${Number(place.id)}#map">Visualizza sulla mappa</a>
                </nav>
            </div>
        </article>
        <a class="luogo-scheda-ritorno" href="/progetto.html">Torna al progetto</a>
    </main>
</body>`
    });
}

async function fetchJson(apiBase, pathname) {
    const response = await fetch(`${apiBase}${pathname}`, {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(30000)
    });

    if (!response.ok) {
        throw new Error(`${pathname}: HTTP ${response.status}`);
    }

    return await response.json();
}

async function clearGeneratedHtml(directory) {
    await mkdir(directory, { recursive: true });
    const files = await readdir(directory, { withFileTypes: true });

    await Promise.all(files.flatMap((file) =>
        file.isFile() && file.name.endsWith(".html")
            ? [unlink(path.join(directory, file.name))]
            : []
    ));
}

function manifestEntry(entry, file, pathName, title, description) {
    return {
        id: Number(entry.id),
        file,
        path: pathName,
        title,
        description,
        updatedAt: Number(entry.updatedAt) || 0
    };
}

function sitemapXml(siteOrigin, staticPages, generatedPages) {
    const items = [
        ...staticPages.map((page) => ({ path: page.path, updatedAt: 0 })),
        ...generatedPages
    ];
    const urls = items.map((item) => {
        const lastmod = item.updatedAt
            ? `<lastmod>${new Date(item.updatedAt).toISOString().slice(0, 10)}</lastmod>`
            : "";
        return `  <url><loc>${xmlEscape(`${siteOrigin}${item.path}`)}</loc>${lastmod}</url>`;
    }).join("\n");
    return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}

export async function generatePublicPages({ root, apiBase = DEFAULT_API_BASE }) {
    const config = JSON.parse(await readFile(path.join(root, "seo.config.json"), "utf8"));
    const normalizedApiBase = String(apiBase).replace(/\/+$/u, "");
    const [wikiList, mapList] = await Promise.all([
        fetchJson(normalizedApiBase, "/api/public/wiki"),
        fetchJson(normalizedApiBase, "/api/public/map-entries")
    ]);
    const summaries = Array.isArray(wikiList.entries) ? wikiList.entries : [];
    const places = Array.isArray(mapList.entries) ? mapList.entries : [];
    const wikis = await Promise.all(summaries.map(async (summary) => {
        if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(summary.slug)) {
            throw new Error(`Slug pubblico non valido: ${summary.slug}`);
        }
        const data = await fetchJson(
            normalizedApiBase,
            `/api/public/wiki/${encodeURIComponent(summary.slug)}`
        );
        return data.entry;
    }));
    const wikiDirectory = path.join(root, "voci");
    const placeDirectory = path.join(root, "luoghi");
    const options = {
        apiBase: normalizedApiBase,
        siteOrigin: config.siteOrigin,
        defaultImage: config.defaultImage
    };
    const wikiOutputs = wikis.map((entry) => {
        const pathName = preferredWikiPath(entry.slug);
        return {
            file: `voci/${entry.slug}.html`,
            path: pathName,
            html: renderWikiPage(entry, wikis, options),
            manifest: manifestEntry(
                entry,
                `voci/${entry.slug}.html`,
                pathName,
                `${entry.title} — Voce di Marcon`,
                descriptionFor(entry.summary || entry.body, `Approfondimento su ${entry.title} nel territorio di Marcon.`)
            )
        };
    }).sort((first, second) => first.path.localeCompare(second.path, "it"));
    const placeOutputs = places.map((entry) => {
        if (!Number.isInteger(Number(entry.id)) || Number(entry.id) <= 0) {
            throw new Error(`ID luogo pubblico non valido: ${entry.id}`);
        }
        const pathName = preferredPlacePath(entry.id);
        return {
            file: `luoghi/${Number(entry.id)}.html`,
            path: pathName,
            html: renderPlacePage(entry, wikis, options),
            manifest: manifestEntry(
                entry,
                `luoghi/${Number(entry.id)}.html`,
                pathName,
                `${entry.name} — Luogo di Marcon`,
                placeDescription(entry)
            )
        };
    }).sort((first, second) => first.path.localeCompare(second.path, "it"));

    await Promise.all([
        clearGeneratedHtml(wikiDirectory),
        clearGeneratedHtml(placeDirectory)
    ]);
    await Promise.all([
        ...wikiOutputs.map((output) => writeFile(
            path.join(root, output.file),
            output.html,
            "utf8"
        )),
        ...placeOutputs.map((output) => writeFile(
            path.join(root, output.file),
            output.html,
            "utf8"
        ))
    ]);

    const manifest = {
        version: 1,
        source: "D1 public API",
        wiki: wikiOutputs.map((output) => output.manifest),
        places: placeOutputs.map((output) => output.manifest)
    };
    const generated = [...manifest.wiki, ...manifest.places];
    await Promise.all([
        writeFile(
            path.join(root, config.generatedManifest),
            `${JSON.stringify(manifest, null, 2)}\n`,
            "utf8"
        ),
        writeFile(
            path.join(root, "sitemap.xml"),
            sitemapXml(config.siteOrigin, config.indexablePages, generated),
            "utf8"
        )
    ]);
    return manifest;
}

const invokedPath = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : "";

if (import.meta.url === invokedPath) {
    const root = path.resolve(import.meta.dirname, "..");
    const apiBase = process.env.PUBLIC_CONTENT_API_BASE || DEFAULT_API_BASE;

    generatePublicPages({ root, apiBase })
        .then((manifest) => {
            console.log(
                `Pagine pubbliche generate: ${manifest.wiki.length} Voci e ` +
                `${manifest.places.length} luoghi.`
            );
        })
        .catch((error) => {
            console.error(`Generazione pagine pubbliche fallita: ${error.message}`);
            process.exitCode = 1;
        });
}
