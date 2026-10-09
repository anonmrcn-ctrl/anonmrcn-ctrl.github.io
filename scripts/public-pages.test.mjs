import assert from "node:assert/strict";
import test from "node:test";

import {
    renderPlacePage,
    renderWikiPage
} from "./generate-public-pages.mjs";

const options = {
    apiBase: "https://worker.example",
    siteOrigin: "https://site.example",
    defaultImage: "https://site.example/logo.png"
};

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