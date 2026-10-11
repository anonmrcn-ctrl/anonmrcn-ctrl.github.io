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
    const project = await readFile(resolve(root, "progetto.html"), "utf8");
    const memories = await readFile(resolve(root, "memorie.html"), "utf8");
    assert.equal((project.match(/rel="preconnect" href="https:\/\/unpkg\.com"/g) || []).length, 1);
    assert.match(project, /href="\.\/leaflet\.css\?v=1\.9\.4"/);
    assert.doesNotMatch(project, /href="https:\/\/unpkg\.com\/leaflet[^\"]+\.css/);
    assert.doesNotMatch(memories, /rel="preconnect" href="https:\/\/unpkg\.com"/);
    assert.match(memories, /href="\.\/leaflet\.css\?v=1\.9\.4"/);
    assert.doesNotMatch(memories, /<script[^>]+src="https:\/\/unpkg\.com\/leaflet/);
});

test("Memorie carica mappa e servizio cartografico soltanto su richiesta", async () => {
    const html = await readFile(resolve(root, "memorie.html"), "utf8");
    const script = await readFile(resolve(root, "memorie.js"), "utf8");
    assert.match(html, /id="memorieMapActivate"[^>]+aria-controls="memorieMap"/);
    assert.match(html, /id="memorieMap"[\s\S]*?aria-hidden="true"/);
    assert.match(script, /elements\.mapActivate\.addEventListener\("click", \(\) => activateMap\(\)\)/);
    assert.match(script, /async function activateMap/);
    assert.match(script, /window\.L\.tileLayer/);
});

test("il logo delle schede luogo riserva lo spazio prima del download", async () => {
    const template = await readFile(resolve(root, "scripts/generate-public-pages.mjs"), "utf8");
    assert.match(template, /<img src="\/logo\.webp"[^>]*width="640"[^>]*height="360"[^>]*fetchpriority="high">/);
});
