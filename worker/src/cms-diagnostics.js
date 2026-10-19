import { captureVisualSnapshot } from "./visual-publication.js";

const SITE_ORIGIN = "https://anonmrcn-ctrl.github.io";
const WORKER_ORIGIN = "https://nnmrcn-rete.anonmrcn.workers.dev";
const MAX_PUBLIC_PAGES = 40;
const MAX_IMAGE_REQUESTS = 20;
const ALLOWED_NOINDEX_PATHS = new Set([
    "/accesso.html",
    "/admin.html",
    "/spazio-personale.html",
    "/taccuino.html"
]);

export async function runCmsDiagnostics(env, fetchImpl = fetch, now = Date.now()) {
    const checks = [];
    const add = (code, label, status, detail) =>
        checks.push({ code, label, status, detail });

    const foreignKeys = await env.DB.prepare("PRAGMA foreign_key_check").all();
    const foreignKeyErrors = foreignKeys.results || [];
    add(
        "d1-foreign-keys",
        "Relazioni D1",
        foreignKeyErrors.length ? "fail" : "pass",
        foreignKeyErrors.length
            ? `${foreignKeyErrors.length} relazioni non valide.`
            : "Nessuna relazione non valida."
    );

    const mediaResult = await env.DB.prepare(`
        SELECT id, object_key, media_type, alt_text, state, byte_size
        FROM media_assets
        ORDER BY object_key
    `).all();
    const mediaRows = mediaResult.results || [];
    let missingMedia = 0;
    let wrongMediaSize = 0;
    for (const row of mediaRows) {
        const object = await env.MEDIA?.head(row.object_key);
        if (!object) missingMedia += 1;
        else if (Number(object.size) !== Number(row.byte_size)) wrongMediaSize += 1;
    }
    add(
        "r2-catalog",
        "Catalogo media R2",
        missingMedia || wrongMediaSize ? "fail" : "pass",
        missingMedia || wrongMediaSize
            ? `${missingMedia} oggetti mancanti e ${wrongMediaSize} dimensioni non coerenti.`
            : `${mediaRows.length} oggetti D1 presenti in R2 con la dimensione attesa.`
    );

    const visualResult = await env.DB.prepare(`
        SELECT page.id, page.slug, page.status, mapping.tree_id,
            publication.revision_number, publication.snapshot_json
        FROM site_pages page
        LEFT JOIN visual_page_trees mapping ON mapping.page_id = page.id
        LEFT JOIN visual_tree_publications publication
            ON publication.tree_id = mapping.tree_id
        ORDER BY page.id
    `).all();
    const visualRows = visualResult.results || [];
    const missingTrees = visualRows.filter((row) => !row.tree_id);
    const missingPublications = visualRows.filter((row) =>
        row.status === "published" && !row.snapshot_json
    );
    const invalidSnapshots = visualRows.filter((row) => {
        if (!row.snapshot_json) return false;
        try {
            const snapshot = JSON.parse(row.snapshot_json);
            return snapshot?.page?.id !== row.id || !Array.isArray(snapshot?.nodes) ||
                !snapshot.nodes.length || !Array.isArray(snapshot?.properties);
        } catch (_) {
            return true;
        }
    });
    add(
        "visual-builder",
        "Copertura del builder visuale",
        missingTrees.length || missingPublications.length || invalidSnapshots.length ? "fail" : "pass",
        missingTrees.length || missingPublications.length || invalidSnapshots.length
            ? `${missingTrees.length} pagine senza albero, ${missingPublications.length} pubblicazioni mancanti e ${invalidSnapshots.length} snapshot non validi.`
            : `${visualRows.length} pagine gestite a blocchi; ogni pagina pubblicata ha uno snapshot autonomo.`
    );

    const mediaById = new Map(mediaRows.map((row) => [row.id, row]));
    const mediaBlocks = { image: 0, gallery: 0, audio: 0, video: 0 };
    let draftMediaIssues = 0;
    let publicationMediaIssues = 0;
    let previewFailures = 0;
    for (const row of visualRows.filter((entry) => entry.tree_id)) {
        try {
            const draft = await captureVisualSnapshot(env, row.id);
            const summary = summarizeVisualMedia(draft, mediaById);
            draftMediaIssues += summary.issues;
            for (const type of Object.keys(mediaBlocks)) mediaBlocks[type] += summary.blocks[type];
        } catch (_) {
            previewFailures += 1;
        }
        if (row.status === "published" && row.snapshot_json) {
            try {
                publicationMediaIssues += summarizeVisualMedia(
                    JSON.parse(row.snapshot_json),
                    mediaById
                ).issues;
            } catch (_) {
                publicationMediaIssues += 1;
            }
        }
    }
    const blockDetail = Object.entries(mediaBlocks)
        .map(([type, count]) => `${type} ${count}`)
        .join(", ");
    add(
        "visual-media-drafts",
        "Anteprima e media nel builder",
        previewFailures ? "fail" : draftMediaIssues ? "warn" : "pass",
        previewFailures
            ? `${previewFailures} bozze non possono essere ricostruite per l’anteprima.`
            : `${blockDetail}; ${draftMediaIssues} campi o riferimenti da completare nelle bozze.`
    );
    add(
        "visual-media-publication",
        "Media nelle pagine pubblicate",
        publicationMediaIssues ? "fail" : "pass",
        publicationMediaIssues
            ? `${publicationMediaIssues} riferimenti, formati o metadati obbligatori non validi.`
            : "Immagini, gallerie, audio e video pubblicati hanno riferimenti e metadati coerenti."
    );

    const [healthResponse, manifestResponse, sitemapResponse, robotsResponse] =
        await Promise.all([
            fetchImpl(`${WORKER_ORIGIN}/api/health`, { headers: { Accept: "application/json" } }),
            fetchImpl(`${SITE_ORIGIN}/public-content-manifest.json`, { headers: { Accept: "application/json" } }),
            fetchImpl(`${SITE_ORIGIN}/sitemap.xml`, { headers: { Accept: "application/xml" } }),
            fetchImpl(`${SITE_ORIGIN}/robots.txt`, { headers: { Accept: "text/plain" } })
        ]);

    const health = healthResponse.ok ? await healthResponse.json().catch(() => null) : null;
    add(
        "worker-health",
        "API pubblica",
        healthResponse.ok && health?.ok === true && health?.mediaStorage === "r2"
            ? "pass"
            : "fail",
        healthResponse.ok
            ? `Schema ${health?.contentSchema ?? "?"}; media ${health?.mediaStorage || "non dichiarati"}.`
            : `HTTP ${healthResponse.status}.`
    );

    const manifest = manifestResponse.ok
        ? await manifestResponse.json().catch(() => null)
        : null;
    const sitemap = sitemapResponse.ok ? await sitemapResponse.text() : "";
    const robots = robotsResponse.ok ? await robotsResponse.text() : "";
    if (!manifest || !Array.isArray(manifest.wiki) || !Array.isArray(manifest.places)) {
        add("static-manifest", "Pubblicazione statica", "fail", "Manifest pubblico assente o non valido.");
        return diagnosticReport(checks, now, manifestResponse, null);
    }

    const publishedWikiResult = await env.DB.prepare(`
        SELECT id, slug, updated_at
        FROM wiki_entries
        WHERE status = 'published'
        ORDER BY id
    `).all();
    const publishedPlacesResult = await env.DB.prepare(`
        SELECT id, updated_at
        FROM map_entries
        ORDER BY id
    `).all();
    const publishedWiki = publishedWikiResult.results || [];
    const publishedPlaces = publishedPlacesResult.results || [];
    const staleWiki = publishedWiki.filter((row) => {
        const item = manifest.wiki.find((entry) => Number(entry.id) === Number(row.id));
        return !item || item.path !== `/voci/${row.slug}.html` ||
            Number(item.updatedAt) !== Number(row.updated_at);
    });
    const stalePlaces = publishedPlaces.filter((row) => {
        const item = manifest.places.find((entry) => Number(entry.id) === Number(row.id));
        return !item || Number(item.updatedAt) !== Number(row.updated_at);
    });
    const extraManifest = [
        ...manifest.wiki.filter((entry) =>
            !publishedWiki.some((row) => Number(row.id) === Number(entry.id))
        ),
        ...manifest.places.filter((entry) =>
            !publishedPlaces.some((row) => Number(row.id) === Number(entry.id))
        )
    ];
    add(
        "static-manifest",
        "Pubblicazione statica",
        staleWiki.length || stalePlaces.length || extraManifest.length ? "fail" : "pass",
        staleWiki.length || stalePlaces.length || extraManifest.length
            ? `${staleWiki.length + stalePlaces.length} contenuti D1 non allineati e ${extraManifest.length} pagine statiche eccedenti.`
            : `${manifest.wiki.length} Voci e ${manifest.places.length} luoghi allineati a D1.`
    );

    const generatedVisual = visualRows.filter((row) =>
        row.status === "published" && String(row.id).startsWith("visual-page-")
    );
    const manifestVisual = Array.isArray(manifest.visual) ? manifest.visual : [];
    const pendingVisual = generatedVisual.filter((row) => {
        const item = manifestVisual.find((entry) => entry.id === row.id);
        return !item || item.path !== `/${row.slug}.html` ||
            Number(item.revisionNumber) !== Number(row.revision_number);
    });
    const staleVisual = manifestVisual.filter((entry) =>
        !generatedVisual.some((row) => row.id === entry.id)
    );
    add(
        "visual-static-sync",
        "Pagine visuali autonome",
        pendingVisual.length || staleVisual.length ? "warn" : "pass",
        pendingVisual.length || staleVisual.length
            ? `${pendingVisual.length} pagine attendono la generazione statica e ${staleVisual.length} file risultano da rimuovere.`
            : `${manifestVisual.length} pagine create dal builder hanno file HTML, canonical e revisione allineati.`
    );

    const sitemapUrls = parseSitemapUrls(sitemap);
    const expectedGenerated = [...manifest.wiki, ...manifest.places]
        .concat(manifestVisual)
        .map((entry) => `${SITE_ORIGIN}${entry.path}`);
    const sitemapInvalid = !sitemapResponse.ok || sitemapUrls.length === 0 ||
        expectedGenerated.some((url) => !sitemapUrls.includes(url)) ||
        sitemapUrls.some((url) => /\/(?:admin|accesso|spazio-personale|taccuino)\.html/u.test(url));
    add(
        "sitemap",
        "Sitemap e robots",
        sitemapInvalid || !robotsResponse.ok ||
            !robots.includes(`Sitemap: ${SITE_ORIGIN}/sitemap.xml`)
            ? "fail"
            : "pass",
        sitemapInvalid
            ? "Sitemap assente, incompleta o contenente pagine private."
            : `${sitemapUrls.length} URL pubblici; aree private escluse e robots collegato.`
    );

    if (sitemapUrls.length > MAX_PUBLIC_PAGES) {
        add(
            "public-pages",
            "Pagine, canonical e contenuto",
            "fail",
            `La sitemap supera il limite diagnostico di ${MAX_PUBLIC_PAGES} pagine.`
        );
        return diagnosticReport(checks, now, manifestResponse, manifest);
    }

    const pageResults = await Promise.all(sitemapUrls.map(async (url) => {
        const response = await fetchImpl(url, { headers: { Accept: "text/html" } });
        return {
            url,
            ok: response.ok,
            status: response.status,
            html: response.ok ? await response.text() : ""
        };
    }));
    let invalidPages = 0;
    const internalLinks = new Set();
    const images = new Set();
    for (const page of pageResults) {
        const canonical = firstAttribute(page.html, "link", "rel", "canonical", "href");
        if (
            !page.ok ||
            canonical !== page.url ||
            !/<title>[^<]+<\/title>/iu.test(page.html) ||
            !/<h1(?:\s[^>]*)?>[\s\S]*?<\/h1>/iu.test(page.html) ||
            /<meta[^>]+name=["']robots["'][^>]+content=["'][^"']*noindex/iu.test(page.html)
        ) {
            invalidPages += 1;
        }
        for (const href of attributes(page.html, "a", "href")) {
            const normalized = normalizeInternalUrl(href, page.url);
            if (normalized) internalLinks.add(normalized);
        }
        for (const src of attributes(page.html, "img", "src")) {
            const normalized = normalizeAssetUrl(src, page.url);
            if (normalized) images.add(normalized);
        }
        for (const srcset of attributes(page.html, "source", "srcset")) {
            for (const candidate of srcset.split(",")) {
                const normalized = normalizeAssetUrl(candidate.trim().split(/\s+/u)[0], page.url);
                if (normalized) images.add(normalized);
            }
        }
        const social = firstMetaContent(page.html, "property", "og:image");
        const socialUrl = normalizeAssetUrl(social, page.url);
        if (socialUrl) images.add(socialUrl);
    }
    add(
        "public-pages",
        "Pagine, canonical e contenuto",
        invalidPages ? "fail" : "pass",
        invalidPages
            ? `${invalidPages} pagine non rispondono o hanno title, h1, canonical o robots incoerenti.`
            : `${pageResults.length} pagine HTML rispondono con canonical e contenuto indicizzabile.`
    );

    const permalinkResult = await env.DB.prepare(`
        SELECT path FROM permalinks WHERE state <> 'gone'
    `).all();
    const knownPaths = new Set((permalinkResult.results || []).map((row) => row.path));
    let unknownLinks = 0;
    for (const value of internalLinks) {
        const url = new URL(value);
        const exactPath = `${url.pathname}${url.search}${url.hash}`;
        if (
            !sitemapUrls.includes(`${url.origin}${url.pathname}`) &&
            !knownPaths.has(exactPath) &&
            !knownPaths.has(`${url.pathname}${url.search}`) &&
            !ALLOWED_NOINDEX_PATHS.has(url.pathname) &&
            !isStaticAssetPath(url.pathname)
        ) {
            unknownLinks += 1;
        }
    }
    add(
        "internal-links",
        "Collegamenti interni",
        unknownLinks ? "warn" : "pass",
        unknownLinks
            ? `${unknownLinks} collegamenti non risultano in sitemap, permalink o pagine private note.`
            : `${internalLinks.size} collegamenti compatibili con sitemap e permalink.`
    );

    const checkedImages = [...images].slice(0, MAX_IMAGE_REQUESTS);
    const imageResponses = await Promise.all(checkedImages.map(async (url) => {
        const response = await fetchImpl(url, { method: "HEAD" });
        return response.ok;
    }));
    const missingImages = imageResponses.filter((ok) => !ok).length;
    const untestedImages = Math.max(0, images.size - checkedImages.length);
    add(
        "images",
        "Immagini pubbliche",
        missingImages ? "fail" : untestedImages ? "warn" : "pass",
        missingImages
            ? `${missingImages} immagini non rispondono; ${checkedImages.length} controllate.`
            : `${checkedImages.length} immagini rispondono${untestedImages ? `; ${untestedImages} oltre il limite rapido` : ""}.`
    );

    return diagnosticReport(checks, now, manifestResponse, manifest);
}

function diagnosticReport(checks, now, manifestResponse, manifest) {
    const failures = checks.filter((check) => check.status === "fail").length;
    const warnings = checks.filter((check) => check.status === "warn").length;
    const timestamps = [
        ...(manifest?.wiki || []),
        ...(manifest?.places || []),
        ...(manifest?.visual || [])
    ].map((entry) => Number(entry.updatedAt) || 0);
    return {
        ok: failures === 0,
        checkedAt: new Date(now).toISOString(),
        failures,
        warnings,
        publication: {
            manifestLastModified: manifestResponse?.headers?.get("last-modified") || null,
            latestContentUpdatedAt: Math.max(0, ...timestamps) || null
        },
        checks
    };
}

function summarizeVisualMedia(snapshot, mediaById) {
    const blocks = { image: 0, gallery: 0, audio: 0, video: 0 };
    let issues = 0;
    const properties = new Map();
    for (const property of snapshot?.properties || []) {
        if (!properties.has(property.node_id)) properties.set(property.node_id, []);
        properties.get(property.node_id).push(property);
    }
    const values = (nodeId, name) => (properties.get(nodeId) || [])
        .filter((property) => property.property_name === name)
        .map((property) => property.asset_id || property.text_value || "")
        .filter(Boolean);
    const asset = (id, prefix, exact = null) => {
        const row = mediaById.get(id);
        return Boolean(row && row.state === "current" && (
            exact ? row.media_type === exact : String(row.media_type || "").startsWith(prefix)
        ));
    };
    for (const node of snapshot?.nodes || []) {
        const type = node.block_type || node.type;
        if (!(type in blocks)) continue;
        blocks[type] += 1;
        if (type === "image") {
            const source = values(node.id || node.key, "assetId")[0];
            if (source && (!asset(source, "image/") || !values(node.id || node.key, "alt")[0])) {
                issues += 1;
            }
        } else if (type === "gallery") {
            const sources = values(node.id || node.key, "assetId");
            if (sources.some((id) => !asset(id, "image/") ||
                !String(mediaById.get(id)?.alt_text || "").trim())) issues += 1;
        } else if (type === "audio") {
            const id = node.id || node.key;
            const source = values(id, "audioAssetId")[0];
            const cover = values(id, "coverAssetId")[0];
            if (!source || !asset(source, "audio/") ||
                (cover && !asset(cover, "image/")) ||
                !values(id, "title")[0] || !values(id, "text")[0] ||
                !values(id, "transcript")[0]) issues += 1;
        } else if (type === "video") {
            const id = node.id || node.key;
            const source = values(id, "videoAssetId")[0];
            const poster = values(id, "posterAssetId")[0];
            const subtitles = values(id, "subtitleAssetId")[0];
            if (!source || !asset(source, "video/") ||
                !poster || !asset(poster, "image/") ||
                !subtitles || !asset(subtitles, "", "text/vtt") ||
                !values(id, "title")[0] || !values(id, "text")[0]) issues += 1;
        }
    }
    return { blocks, issues };
}

function parseSitemapUrls(xml) {
    return [...String(xml).matchAll(/<loc>(https:\/\/anonmrcn-ctrl\.github\.io\/[^<]*)<\/loc>/gu)]
        .map((match) => match[1]);
}

function attributes(html, tag, attribute) {
    const expression = new RegExp(`<${tag}\\b[^>]*\\b${attribute}=["']([^"']+)["'][^>]*>`, "giu");
    return [...String(html).matchAll(expression)].map((match) => match[1]);
}

function firstAttribute(html, tag, matchName, matchValue, resultName) {
    for (const element of String(html).matchAll(new RegExp(`<${tag}\\b[^>]*>`, "giu"))) {
        const value = element[0];
        if (new RegExp(`\\b${matchName}=["']${matchValue}["']`, "iu").test(value)) {
            return value.match(new RegExp(`\\b${resultName}=["']([^"']+)["']`, "iu"))?.[1] || "";
        }
    }
    return "";
}

function firstMetaContent(html, matchName, matchValue) {
    return firstAttribute(html, "meta", matchName, matchValue, "content");
}

function normalizeInternalUrl(value, base) {
    if (!value || /^(?:mailto:|tel:|javascript:)/iu.test(value)) return null;
    try {
        const url = new URL(value, base);
        return url.origin === SITE_ORIGIN ? url.href : null;
    } catch (_) {
        return null;
    }
}

function normalizeAssetUrl(value, base) {
    if (!value || value.startsWith("data:")) return null;
    try {
        const url = new URL(value, base);
        return url.protocol === "https:" ? url.href : null;
    } catch (_) {
        return null;
    }
}

function isStaticAssetPath(path) {
    return /\.(?:css|js|json|xml|webmanifest|ico|png|jpe?g|webp|svg|woff2?|pdf)$/iu.test(path);
}
