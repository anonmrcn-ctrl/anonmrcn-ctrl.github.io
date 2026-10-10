import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";

const root = resolve(import.meta.dirname, "..");
const dynamicPages = ["index.html", "progetto.html", "voci.html", "memorie.html", "luogo.html"];

test("gli script a fondo pagina non bloccano il parser e conservano l'ordine", async () => {
    for (const page of dynamicPages) {
        const html = await readFile(resolve(root, page), "utf8");
        const body = html.slice(html.indexOf("<body"));
        const scripts = [...body.matchAll(/<script\b([^>]*)\bsrc=["'][^"']+["'][^>]*>/gi)];
        assert.ok(scripts.length > 0, `${page}: nessuno script esterno nel body`);
        for (const script of scripts) {
            assert.match(script[0], /\bdefer\b/i, `${page}: script privo di defer: ${script[0]}`);
            assert.doesNotMatch(script[0], /\basync\b/i, `${page}: async romperebbe l'ordine delle dipendenze`);
        }
    }
});

test("le pagine dinamiche preparano la connessione al Worker", async () => {
    for (const page of dynamicPages) {
        const html = await readFile(resolve(root, page), "utf8");
        assert.match(
            html,
            /<link rel="preconnect" href="https:\/\/nnmrcn-rete\.anonmrcn\.workers\.dev" crossorigin>/,
            `${page}: preconnect al Worker assente`
        );
    }
});

test("le mappe preparano un'unica connessione alle librerie esterne", async () => {
    for (const page of ["progetto.html", "memorie.html"]) {
        const html = await readFile(resolve(root, page), "utf8");
        assert.equal((html.match(/rel="preconnect" href="https:\/\/unpkg\.com"/g) || []).length, 1, page);
    }
});

test("il logo delle schede luogo riserva lo spazio prima del download", async () => {
    const template = await readFile(resolve(root, "scripts/generate-public-pages.mjs"), "utf8");
    assert.match(template, /<img src="\/logo\.webp"[^>]*width="640"[^>]*height="360"[^>]*fetchpriority="high">/);
});
