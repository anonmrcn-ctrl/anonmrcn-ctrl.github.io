import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const root = path.resolve(import.meta.dirname, "..");
const config = JSON.parse(await readFile(path.join(root, "seo.config.json"), "utf8"));
const errors = [];
const titles = new Map();
const descriptions = new Map();

function error(file, message) {
    errors.push(`${file}: ${message}`);
}

function escapeRegExp(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function decodeHtml(value) {
    return value
        .replace(/&amp;/g, "&")
        .replace(/&quot;/g, '"')
        .replace(/&#39;|&apos;/g, "'")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">");
}

function attribute(tag, name) {
    const match = tag.match(
        new RegExp(`\\b${escapeRegExp(name)}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, "i")
    );
    return match ? decodeHtml(match[1] ?? match[2] ?? "") : "";
}

function tags(html, name) {
    return html.match(new RegExp(`<${name}\\b[^>]*>`, "gi")) || [];
}

function metaContent(html, key, value) {
    const match = tags(html, "meta").find((tag) =>
        attribute(tag, key).toLowerCase() === value.toLowerCase()
    );
    return match ? attribute(match, "content") : "";
}

function linkHref(html, rel) {
    const match = tags(html, "link").find((tag) =>
        attribute(tag, "rel").toLowerCase().split(/\s+/).includes(rel)
    );
    return match ? attribute(match, "href") : "";
}

function titleText(html) {
    const matches = [...html.matchAll(/<title>([\s\S]*?)<\/title>/gi)];
    return matches.length === 1 ? decodeHtml(matches[0][1].trim()) : "";
}

function count(html, expression) {
    return [...html.matchAll(expression)].length;
}

function recordUnique(collection, value, file, label) {
    const previous = collection.get(value);
    if (previous) {
        error(file, `${label} duplicato con ${previous}`);
    } else {
        collection.set(value, file);
    }
}

for (const page of config.indexablePages) {
    const html = await readFile(path.join(root, page.file), "utf8");
    const canonical = `${config.siteOrigin}${page.path}`;
    const actualTitle = titleText(html);
    const actualDescription = metaContent(html, "name", "description");

    if (actualTitle !== page.title) {
        error(page.file, `title inatteso: "${actualTitle}"`);
    }
    if (actualDescription !== page.description) {
        error(page.file, "meta description assente o diversa dalla configurazione");
    }
    if (linkHref(html, "canonical") !== canonical) {
        error(page.file, `canonical assente o diverso da ${canonical}`);
    }
    if (!/index/i.test(metaContent(html, "name", "robots"))) {
        error(page.file, "direttiva robots index assente");
    }
    if (count(html, /<h1\b/gi) !== 1) {
        error(page.file, "deve contenere esattamente un h1");
    }
    if (metaContent(html, "property", "og:title") !== page.title) {
        error(page.file, "og:title assente o incoerente");
    }
    if (metaContent(html, "property", "og:description") !== page.description) {
        error(page.file, "og:description assente o incoerente");
    }
    if (metaContent(html, "property", "og:url") !== canonical) {
        error(page.file, "og:url assente o incoerente");
    }
    if (metaContent(html, "property", "og:image") !== config.defaultImage) {
        error(page.file, "og:image assente o incoerente");
    }
    if (metaContent(html, "name", "twitter:card") !== "summary_large_image") {
        error(page.file, "twitter:card assente o incoerente");
    }

    for (const script of html.matchAll(
        /<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
    )) {
        try {
            JSON.parse(script[1]);
        } catch (parseError) {
            error(page.file, `JSON-LD non valido: ${parseError.message}`);
        }
    }

    for (const image of tags(html, "img")) {
        if (!/\balt\s*=/.test(image)) {
            error(page.file, `immagine senza attributo alt: ${image}`);
        }
    }

    recordUnique(titles, actualTitle, page.file, "title");
    recordUnique(descriptions, actualDescription, page.file, "meta description");
}

for (const file of config.noindexPages) {
    const html = await readFile(path.join(root, file), "utf8");
    if (!/noindex/i.test(metaContent(html, "name", "robots"))) {
        error(file, "direttiva noindex assente");
    }
}

const sitemap = await readFile(path.join(root, "sitemap.xml"), "utf8");
for (const page of config.indexablePages) {
    const canonical = `${config.siteOrigin}${page.path}`;
    if (!sitemap.includes(`<loc>${canonical}</loc>`)) {
        error("sitemap.xml", `URL mancante: ${canonical}`);
    }
}
if (count(sitemap, /<loc>/g) !== config.indexablePages.length) {
    error("sitemap.xml", "contiene URL non previsti o duplicati");
}

const robots = await readFile(path.join(root, "robots.txt"), "utf8");
if (!robots.includes(`Sitemap: ${config.siteOrigin}/sitemap.xml`)) {
    error("robots.txt", "riferimento alla sitemap assente");
}

const checkedHtml = new Set([
    ...config.indexablePages.map((page) => page.file),
    ...config.noindexPages
]);
for (const file of checkedHtml) {
    const html = await readFile(path.join(root, file), "utf8");
    for (const link of tags(html, "a")) {
        const href = attribute(link, "href");
        if (!href || /^(?:[a-z]+:|#|\/\/)/i.test(href)) {
            continue;
        }
        const pathname = href.split(/[?#]/, 1)[0];
        if (!pathname) {
            continue;
        }
        const target = pathname === "./" || pathname === "/"
            ? "index.html"
            : pathname.replace(/^\.\//, "").replace(/^\//, "");
        try {
            const details = await stat(path.join(root, target));
            if (!details.isFile()) {
                error(file, `collegamento interno non risolto: ${href}`);
            }
        } catch {
            error(file, `collegamento interno non risolto: ${href}`);
        }
    }
}

if (errors.length) {
    console.error(`Controllo SEO fallito (${errors.length} problemi):`);
    errors.forEach((message) => console.error(`- ${message}`));
    process.exitCode = 1;
} else {
    console.log(
        `Controllo SEO superato: ${config.indexablePages.length} pagine indicizzabili, ` +
        `${config.noindexPages.length} pagine escluse e ${titles.size} title unici.`
    );
}
