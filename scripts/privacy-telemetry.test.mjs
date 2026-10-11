import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";

const root = resolve(import.meta.dirname, "..");
const config = JSON.parse(await readFile(resolve(root, "privacy.config.json"), "utf8"));

test("la telemetria richiede opt-in e minimizza il payload", async () => {
    const [script, analytics] = await Promise.all([
        readFile(resolve(root, "privacy-telemetry.js"), "utf8"),
        readFile(resolve(root, "analytics.js"), "utf8")
    ]);
    assert.doesNotThrow(() => new Function(script));
    assert.doesNotThrow(() => new Function(analytics));
    assert.match(script, /readChoice\(\) !== ALLOW/u);
    assert.match(script, /path: \(\) => window\.location\.pathname/u);
    assert.match(script, /referrer: \(\) => ""/u);
    assert.match(script, /title: \(\) => ""/u);
    assert.match(script, /no_events: true/u);
    assert.doesNotMatch(script, /window\.location\.(?:search|hash)/u);
    assert.match(analytics, /!consentAllowed\(\)/u);
    const counter = await readFile(resolve(root, "goatcounter.js"), "utf8");
    assert.doesNotMatch(counter, /\bs:\s*window\.screen\.width/u);
    assert.doesNotMatch(counter, /\bb:\s*is_bot\(\)/u);
});

test("le aree protette non caricano analytics e le pagine pubbliche non li avviano direttamente", async () => {
    for (const page of config.protectedPages) {
        const html = await readFile(resolve(root, page), "utf8");
        assert.doesNotMatch(html, /privacy-telemetry|goatcounter|analytics\.js/iu, page);
    }
    for (const page of config.telemetry.publicPages) {
        const html = await readFile(resolve(root, page), "utf8");
        assert.match(html, /privacy-telemetry\.js\?v=20261011-privacy2/u, page);
        assert.doesNotMatch(html, /data-goatcounter|src="\.\/goatcounter\.js/iu, page);
    }
});

test("le librerie cartografiche non richiedono unpkg", async () => {
    for (const file of [
        "admin.html", "progetto.html", "spazio-personale.html", "taccuino.html",
        "memorie.js"
    ]) {
        const source = await readFile(resolve(root, file), "utf8");
        assert.doesNotMatch(source, /unpkg\.com/iu, file);
    }
});

test("l’audit browser prova rifiuto, consenso, revoca e pagina protetta", async () => {
    const audit = await readFile(resolve(root, "scripts/privacy-ui.e2e.mjs"), "utf8");
    assert.match(audit, /Solo necessari/u);
    assert.match(audit, /Consenti statistiche aggregate/u);
    assert.match(audit, /page\.reload/u);
    assert.match(audit, /spazio-personale\.html/u);
    assert.match(audit, /script\[data-goatcounter\]/u);
    assert.match(audit, /Scarica i miei dati/u);
    assert.match(audit, /ELIMINA I MIEI DATI/u);
    assert.match(audit, /privacy-rights-mobile\.png/u);
});
