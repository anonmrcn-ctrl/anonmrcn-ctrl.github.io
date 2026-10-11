import assert from "node:assert/strict";
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
}

for (const service of ["github-pages", "cloudflare", "goatcounter", "unpkg", "map-tiles", "search-console"]) {
    assert.ok(config.externalServices.some((item) => item.id === service), `servizio esterno non censito: ${service}`);
}

for (const id of ["PRIV-RETENTION-1", "PRIV-TELEMETRY-1", "PRIV-EXTERNAL-1", "PRIV-RIGHTS-1"]) {
    assert.ok(config.openFindings.some((item) => item.id === id), `rilievo mancante: ${id}`);
}

assert.match(worker, /const CONTACT_RETENTION_MS = 30 \* 24 \* 60 \* 60 \* 1000/u);
assert.match(worker, /path: new URL\(request\.url\)\.pathname/u);
assert.doesNotMatch(worker, /console\.(?:log|error)\([^\n]*(?:authorization|cookie|request\.url|searchParams)/iu);
assert.match(legal, /30 giorni/iu);
assert.match(legal, /GitHub Pages e Cloudflare/iu);
assert.match(legal, /GoatCounter/iu);

console.log(
    `Privacy: ${config.dataClasses.length} classi dati, ` +
    `${config.externalServices.length} servizi esterni e ` +
    `${config.openFindings.length} rilievi tracciati.`
);
