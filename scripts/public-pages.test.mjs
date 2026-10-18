import assert from "node:assert/strict";
import test from "node:test";

import {
    renderEditorialRelationships,
    renderPlacePage,
    renderVisualStaticPage,
    renderWikiCollectionFallback,
    renderWikiPage
} from "./generate-public-pages.mjs";

const options = {
    apiBase: "https://worker.example",
    siteOrigin: "https://site.example",
    defaultImage: "https://site.example/logo.png"
};

test("la pagina visuale autonoma ha HTML statico, canonical, tema e nessun codice eseguibile", () => {
    const html = renderVisualStaticPage({
        page: {
            id: "visual-page-1",
            slug: "pagina-autonoma",
            revisionNumber: 3,
            updatedAt: 1791500000000,
            html: '<main class="visual-block visual-block--page-root" data-block-id="root"><h1>Pagina autonoma</h1><p class="visual-block visual-block--rich-text" data-block-id="testo">Testo pubblico.</p></main>',
            metadata: {
                title: "Pagina autonoma",
                description: "Una pagina creata senza programmazione.",
                canonical: "https://site.example/pagina-autonoma.html",
                robots: "index,follow",
                structuredData: {
                    "@context": "https://schema.org",
                    "@type": "WebPage",
                    name: "Pagina autonoma"
                }
            },
            theme: {
                tokens: [
                    { group: "palette", name: "accent", value: "#005f73" },
                    { group: "typography", name: "heading", value: "serif" }
                ]
            }
        }
    }, options);

    assert.match(html, /<h1>Pagina autonoma<\/h1>/u);
    assert.match(html, /rel="canonical" href="https:\/\/site\.example\/pagina-autonoma\.html"/u);
    assert.match(html, /--visual-accent:#005f73/u);
    assert.match(html, /application\/ld\+json/u);
    assert.doesNotMatch(html, /<script\b(?![^>]*application\/ld\+json)/u);
});

const wikis = [
    {
        id: 1,
        slug: "prima-voce",
        title: "Prima voce",
        summary: "Sommario con [[seconda-voce|un collegamento]].",
        body: "## Storia\n\nTesto **documentato**.[fonte:https%3A%2F%2Fexample.com|Fonte|Ente|2026]",
        images: [],
        updatedAt: 1791500000000,
        publishedAt: 1791400000000
    },
    {
        id: 2,
        slug: "seconda-voce",
        title: "Seconda voce",
        summary: "Secondo sommario.",
        body: "Testo.",
        images: [],
        updatedAt: 1791500000000,
        publishedAt: 1791400000000
    }
];

test("la Voce autonoma contiene testo, canonical e link preferiti senza JavaScript", () => {
    const html = renderWikiPage(wikis[0], wikis, options);

    assert.match(html, /<h1>Prima voce<\/h1>/u);
    assert.match(html, /<p>Testo <strong>documentato<\/strong>/u);
    assert.match(html, /href="\/voci\/seconda-voce\.html"/u);
    assert.match(html, /rel="canonical" href="https:\/\/site\.example\/voci\/prima-voce\.html"/u);
    assert.match(html, /<h2 id="fonti-voce-1">Fonti<\/h2>/u);
    assert.equal((html.match(/<h1\b/gu) || []).length, 1);
    assert.equal(/<script\b(?![^>]*application\/ld\+json)/u.test(html), false);
});

test("il grafo editoriale produce collegamenti contestuali sicuri", () => {
    const html = renderEditorialRelationships("/voci/prima-voce.html", [{
        from: "/voci/prima-voce.html",
        to: "/voci/seconda-voce.html",
        label: "Seconda voce <documentata>"
    }]);

    assert.match(html, /Approfondisci nel territorio/u);
    assert.match(html, /href="\/voci\/seconda-voce\.html"/u);
    assert.match(html, /Seconda voce &lt;documentata&gt;/u);
    assert.doesNotMatch(html, /<documentata>/u);
});

test("l'indice statico delle Voci conserva destinazioni, ordine e testo sicuro", () => {
    const html = renderWikiCollectionFallback([
        wikis[1],
        { ...wikis[0], title: '"Prima voce" <script>', summary: "Testo <img>." }
    ]);

    assert.match(html, /href="\.\/voci\/prima-voce\.html" data-wiki-slug="prima-voce"/u);
    assert.match(html, /&lt;script&gt;/u);
    assert.match(html, /Testo &lt;img&gt;\./u);
    assert.ok(html.indexOf("prima-voce.html") < html.indexOf("seconda-voce.html"));
});

test("la Voce sincronizza immagine sociale, alt, formato e dimensioni", () => {
    const entry = {
        ...wikis[0],
        body: "Testo.\n\n[foto:media-1]",
        images: [{
            id: "media-1",
            mediaUrl: "/api/public/wiki-images/media-1",
            socialUrl: "/api/public/wiki-images/media-1?variant=social",
            alt: "Veduta delle cave",
            width: 1600,
            height: 900,
            type: "image/jpeg",
            socialWidth: 1200,
            socialHeight: 630,
            socialType: "image/webp"
        }]
    };
    const html = renderWikiPage(entry, [entry, wikis[1]], options);

    assert.match(html, /property="og:image" content="https:\/\/worker\.example\/api\/public\/wiki-images\/media-1\?variant=social"/u);
    assert.match(html, /property="og:image:type" content="image\/webp"/u);
    assert.match(html, /property="og:image:width" content="1200"/u);
    assert.match(html, /property="og:image:height" content="630"/u);
    assert.match(html, /property="og:image:alt" content="Veduta delle cave"/u);
    assert.match(html, /name="twitter:image:alt" content="Veduta delle cave"/u);
});

test("l’HTML generato neutralizza contenuto eseguibile", () => {
    const unsafe = {
        ...wikis[0],
        title: "<img src=x onerror=alert(1)>",
        summary: "<script>alert(1)</script>",
        body: "[clic](javascript:alert(1))"
    };
    const html = renderWikiPage(unsafe, [unsafe], options);

    assert.doesNotMatch(html, /<img src=x/u);
    assert.doesNotMatch(html, /<script>alert/u);
    assert.doesNotMatch(html, /href="javascript:/u);
    assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/u);
});

test("la scheda luogo usa il proprio URL canonico e collega la Voce preferita", () => {
    const place = {
        id: 7,
        name: "Prima voce",
        category: "luogo",
        description: "Descrizione pubblica del luogo.",
        lat: 45.55,
        lon: 12.31,
        sourceUrl: "https://site.example/voci.html#prima-voce",
        sourceLabel: "Approfondisci",
        imageUrl: "",
        updatedAt: 1791500000000
    };
    const html = renderPlacePage(place, wikis, options);

    assert.match(html, /<h1>Prima voce<\/h1>/u);
    assert.match(html, /https:\/\/site\.example\/luoghi\/7\.html/u);
    assert.match(html, /href="\/voci\/prima-voce\.html"/u);
    assert.doesNotMatch(html, /href="[^"]*voci\.html#/u);
    assert.equal((html.match(/<h1\b/gu) || []).length, 1);
});
