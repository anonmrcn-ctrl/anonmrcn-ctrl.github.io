import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const config = JSON.parse(read("privacy.config.json"));
const schema = read("worker/schema.sql");
const worker = read("worker/src/index.js");
const sitemap = read("sitemap.xml");
const legal = `${read("privacy.html")}\n${read("worker/src/legal-seed.js")}`;

assert.match(config.version, /^\d{4}-\d{2}-\d{2}$/u);
assert.match(config.ownerContact, /^[^\s@]+@[^\s@]+\.[^\s@]+$/u);
assert.ok(config.principles.length >= 5, "principi privacy incompleti");
assert.ok(config.dataClasses.length >= 8, "classi di dati incomplete");

const dataIds = new Set();
const documentedTables = new Set();
for (const item of config.dataClasses) {
    assert.ok(item.id && !dataIds.has(item.id), `classe duplicata: ${item.id}`);
    dataIds.add(item.id);
    assert.ok(item.purpose && item.minimization && item.retention);
    assert.ok(Array.isArray(item.tables) && item.tables.length > 0);
    for (const table of item.tables) {
        assert.match(
            schema,
            new RegExp(`CREATE TABLE IF NOT EXISTS ${table}\\s*\\(`, "u"),
            `tabella non trovata nell'inventario D1: ${table}`
        );
        documentedTables.add(table);
    }
}

for (const table of [
    "locations", "sessions", "messages", "contact_messages", "memories",
    "push_subscriptions", "admin_credentials", "admin_auth_challenges",
    "admin_sessions", "cms_documents"
]) {
    assert.ok(documentedTables.has(table), `tabella sensibile non censita: ${table}`);
}

for (const page of config.protectedPages) {
    const html = read(page);
    assert.match(html, /<meta name="robots" content="[^"]*noindex/iu, `${page} deve essere noindex`);
    assert.ok(!sitemap.includes(`/${page}`), `${page} non deve comparire nella sitemap`);
    assert.doesNotMatch(
        html,
        /(?:privacy-telemetry|goatcounter|analytics\.js)/iu,
        `${page} non deve caricare telemetria`
    );
}

for (const page of config.telemetry.publicPages) {
    const html = read(page);
    assert.match(html, /privacy-telemetry\.js\?v=20261011-privacy2/u, `${page}: consenso assente`);
    assert.doesNotMatch(html, /data-goatcounter|src="\.\/goatcounter\.js/iu, `${page}: GoatCounter parte direttamente`);
}

for (const service of ["github-pages", "cloudflare", "goatcounter", "map-tiles", "search-console"]) {
    assert.ok(config.externalServices.some((item) => item.id === service), `servizio esterno non censito: ${service}`);
}
assert.ok(!config.externalServices.some((item) => item.id === "unpkg"));

assert.equal(config.openFindings.length, 0, "l'audit privacy finale ha rilievi aperti");
for (const id of ["PRIV-RETENTION-1", "PRIV-TELEMETRY-1", "PRIV-EXTERNAL-1", "PRIV-RIGHTS-1"]) {
    assert.ok(
        config.resolvedFindings.some((item) => item.id === id),
        `risoluzione non registrata: ${id}`
    );
}

const telemetry = read("privacy-telemetry.js");
const analytics = read("analytics.js");
const goatCounter = read("goatcounter.js");
assert.match(telemetry, /nnmrcn_telemetry_consent_v1/u);
assert.match(telemetry, /readChoice\(\) !== ALLOW/u);
assert.match(telemetry, /path: \(\) => window\.location\.pathname/u);
assert.match(telemetry, /referrer: \(\) => ""/u);
assert.match(telemetry, /no_events: true/u);
assert.match(analytics, /!consentAllowed\(\)/u);
assert.doesNotMatch(goatCounter, /\bs:\s*window\.screen\.width/u);
assert.doesNotMatch(goatCounter, /\bb:\s*is_bot\(\)/u);

for (const source of [
    "admin.html", "progetto.html", "spazio-personale.html", "taccuino.html",
    "memorie.js"
]) {
    assert.doesNotMatch(read(source), /unpkg\.com/iu, `${source}: dipendenza unpkg residua`);
}

for (const [file, expected] of [
    ["vendor/leaflet-1.9.4.js", "db49d009c841f5ca34a888c96511ae936fd9f5533e90d8b2c4d57596f4e5641a"],
    ["vendor/pmtiles-4.4.1.js", "36bcbe1ba97cc07b3fc90cee9cba11729b04e25ec8790cf65a0787d5b38e091b"]
]) {
    const digest = crypto.createHash("sha256").update(fs.readFileSync(path.join(root, file))).digest("hex");
    assert.equal(digest, expected, `${file}: checksum inatteso`);
}

assert.match(worker, /const CONTACT_RETENTION_MS = 30 \* 24 \* 60 \* 60 \* 1000/u);
assert.match(worker, /const MEMORY_ABUSE_RETENTION_MS = 24 \* 60 \* 60 \* 1000/u);
assert.match(worker, /SET sender_hash = ''[\s\S]*created_at < \?/u);
assert.match(worker, /DELETE FROM sessions[\s\S]*WHERE expires_at <= \?/u);
assert.match(worker, /DELETE FROM mayor_sessions[\s\S]*WHERE expires_at <= \?/u);
assert.match(worker, /path: new URL\(request\.url\)\.pathname/u);
assert.doesNotMatch(worker, /console\.(?:log|error)\([^\n]*(?:authorization|cookie|request\.url|searchParams)/iu);
assert.match(legal, /30 giorni/iu);
assert.match(legal, /24\s+ore/iu);
assert.match(legal, /GitHub Pages e Cloudflare/iu);
assert.match(legal, /GoatCounter/iu);
assert.match(legal, /Spazio personale/iu);
assert.match(legal, /identificativo numerico storico/iu);
assert.match(worker, /GET" && path === "\/api\/account\/export/u);
assert.match(worker, /DELETE" && path === "\/api\/account"/u);
assert.match(worker, /WHERE id = \? AND deleted_at IS NULL/u);
assert.match(schema, /deleted_at INTEGER/u);

const personalSpace = read("spazio-personale.html");
const personalScript = read("spazio-personale.js");
assert.match(personalSpace, /id="esportaDatiButton"/u);
assert.match(personalSpace, /id="eliminaAccountConferma"/u);
assert.match(personalSpace, /ELIMINA I MIEI DATI/u);
assert.match(personalScript, /\/api\/account\/export/u);
assert.match(personalScript, /method: "DELETE"/u);

console.log(
    `Privacy: ${config.dataClasses.length} classi dati, ` +
    `${config.externalServices.length} servizi esterni, ` +
    `${config.openFindings.length} rilievi aperti e ` +
    `${config.resolvedFindings.length} risolti.`
);
