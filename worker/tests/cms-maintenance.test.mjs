import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

import worker from "../src/index.js";
import { runCmsDiagnostics } from "../src/cms-diagnostics.js";

class D1StatementMock {
    constructor(database, sql) {
        this.database = database;
        this.sql = sql;
        this.values = [];
    }
    bind(...values) {
        this.values = values;
        return this;
    }
    async first() {
        return this.database.prepare(this.sql).get(...this.values) || null;
    }
    async all() {
        return { results: this.database.prepare(this.sql).all(...this.values) };
    }
    async run() {
        const result = this.database.prepare(this.sql).run(...this.values);
        return {
            success: true,
            meta: {
                changes: result.changes,
                last_row_id: Number(result.lastInsertRowid)
            }
        };
    }
}

class D1DatabaseMock {
    constructor() {
        this.database = new DatabaseSync(":memory:");
        this.database.exec("PRAGMA foreign_keys = ON");
    }
    prepare(sql) {
        return new D1StatementMock(this.database, sql);
    }
    async batch(statements) {
        this.database.exec("BEGIN");
        try {
            const results = [];
            for (const statement of statements) results.push(await statement.run());
            this.database.exec("COMMIT");
            return results;
        } catch (error) {
            this.database.exec("ROLLBACK");
            throw error;
        }
    }
}

class R2BucketMock {
    constructor() {
        this.objects = new Map();
    }
    async put(key, value) {
        const bytes = value instanceof Uint8Array
            ? new Uint8Array(value)
            : new Uint8Array(await new Response(value).arrayBuffer());
        this.objects.set(key, bytes);
        return { key, size: bytes.byteLength };
    }
    async get(key) {
        const bytes = this.objects.get(key);
        return bytes ? { key, size: bytes.byteLength, body: bytes } : null;
    }
    async head(key) {
        const bytes = this.objects.get(key);
        return bytes ? { key, size: bytes.byteLength } : null;
    }
    async delete(value) {
        for (const key of Array.isArray(value) ? value : [value]) {
            this.objects.delete(key);
        }
    }
}

function environment() {
    return {
        DB: new D1DatabaseMock(),
        MEDIA: new R2BucketMock(),
        ADMIN_TOKEN: "test-admin",
        ALLOWED_ORIGIN: "https://anonmrcn-ctrl.github.io"
    };
}

async function call(env, path = "/api/admin/maintenance/export", options = {}) {
    const headers = new Headers({ Origin: env.ALLOWED_ORIGIN });
    if (options.admin) headers.set("X-Admin-Token", env.ADMIN_TOKEN);
    if (options.body !== undefined) headers.set("Content-Type", "application/json");
    return worker.fetch(new Request(
        `https://worker.test${path}`,
        {
            method: options.method || "GET",
            headers,
            body: options.body === undefined ? undefined : JSON.stringify(options.body)
        }
    ), env, { waitUntil() {} });
}

test("esporta contenuti D1 e oggetti R2 senza credenziali o dati personali", async () => {
    const env = environment();
    const denied = await call(env);
    assert.equal(denied.status, 401);

    const initial = await call(env, undefined, { admin: true });
    assert.equal(initial.status, 200);

    const bytes = new TextEncoder().encode("documento di prova");
    const checksum = await sha256Hex(bytes);
    const now = Date.now();
    await env.MEDIA.put("documents/example/original.txt", bytes);
    await env.DB.prepare(`
        INSERT INTO cms_documents (
            id, title, description, accessibility_status, accessibility_note,
            media_type, media_name, byte_size, checksum, created_at, updated_at
        ) VALUES (?, ?, ?, 'reviewed', '', ?, ?, ?, ?, ?, ?)
    `).bind(
        "11111111-1111-4111-8111-111111111111",
        "Documento di prova",
        "Documento usato per verificare il backup.",
        "text/plain",
        "prova.txt",
        bytes.byteLength,
        checksum,
        now,
        now
    ).run();
    await env.DB.prepare(`
        INSERT INTO media_assets (
            id, owner_type, owner_id, variant_key, object_key, media_type,
            media_name, byte_size, checksum, alt_text, caption, state,
            created_at, updated_at
        ) VALUES (?, 'document', ?, 'original', ?, ?, ?, ?, ?, '', '',
            'current', ?, ?)
    `).bind(
        "media-backup-example",
        "11111111-1111-4111-8111-111111111111",
        "documents/example/original.txt",
        "text/plain",
        "prova.txt",
        bytes.byteLength,
        checksum,
        now,
        now
    ).run();

    const response = await call(env, undefined, { admin: true });
    const backup = await response.json();
    assert.equal(response.status, 200);
    assert.match(
        response.headers.get("content-disposition"),
        /^attachment; filename="nnmrcn-cms-\d{4}-\d{2}-\d{2}\.json"$/u
    );
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.equal(backup.format, "nnmrcn-cms-backup");
    assert.equal(backup.version, 1);
    assert.equal(backup.integrity.algorithm, "SHA-256");
    assert.equal(backup.integrity.checksum.length, 64);
    assert.equal(backup.media.objectCount, 1);
    assert.equal(backup.media.totalBytes, bytes.byteLength);
    assert.equal(
        Buffer.from(backup.media.objects[0].data, "base64").toString(),
        "documento di prova"
    );

    const tableNames = backup.database.tables.map((table) => table.name);
    assert.ok(tableNames.includes("site_pages"));
    assert.ok(tableNames.includes("content_revisions"));
    assert.ok(tableNames.includes("permalinks"));
    assert.ok(tableNames.includes("cms_documents"));
    assert.ok(tableNames.includes("media_assets"));
    for (const excluded of [
        "admin_credentials",
        "admin_sessions",
        "contact_messages",
        "messages",
        "locations"
    ]) {
        assert.ok(!tableNames.includes(excluded));
    }
});

test("rifiuta un backup quando D1 e R2 non sono coerenti", async () => {
    const env = environment();
    const initial = await call(env, undefined, { admin: true });
    assert.equal(initial.status, 200);

    const now = Date.now();
    await env.DB.prepare(`
        INSERT INTO media_assets (
            id, owner_type, owner_id, variant_key, object_key, media_type,
            media_name, byte_size, checksum, alt_text, caption, state,
            created_at, updated_at
        ) VALUES (?, 'document', ?, 'original', ?, 'text/plain', 'perso.txt',
            4, ?, '', '', 'current', ?, ?)
    `).bind(
        "media-missing-example",
        "22222222-2222-4222-8222-222222222222",
        "documents/missing/original.txt",
        "0".repeat(64),
        now,
        now
    ).run();

    const response = await call(env, undefined, { admin: true });
    assert.equal(response.status, 409);
    assert.match((await response.json()).error, /Oggetto R2 mancante/u);
});

test("valida e ripristina D1 e R2 soltanto dopo una conferma esplicita", async () => {
    const env = environment();
    const bytes = new TextEncoder().encode("versione nel backup");
    const checksum = await sha256Hex(bytes);
    const now = Date.now();

    const initialized = await call(env, undefined, { admin: true });
    assert.equal(initialized.status, 200);
    await env.MEDIA.put("documents/restore/original.txt", bytes);
    await env.DB.prepare(`
        INSERT INTO cms_documents (
            id, title, description, accessibility_status, accessibility_note,
            media_type, media_name, byte_size, checksum, created_at, updated_at
        ) VALUES (?, ?, ?, 'reviewed', '', ?, ?, ?, ?, ?, ?)
    `).bind(
        "33333333-3333-4333-8333-333333333333",
        "Documento da ripristinare",
        "Verifica del ripristino controllato.",
        "text/plain",
        "ripristino.txt",
        bytes.byteLength,
        checksum,
        now,
        now
    ).run();
    await env.DB.prepare(`
        INSERT INTO media_assets (
            id, owner_type, owner_id, variant_key, object_key, media_type,
            media_name, byte_size, checksum, alt_text, caption, state,
            created_at, updated_at
        ) VALUES (?, 'document', ?, 'original', ?, 'text/plain', ?, ?, ?, '', '',
            'current', ?, ?)
    `).bind(
        "media-restore-example",
        "33333333-3333-4333-8333-333333333333",
        "documents/restore/original.txt",
        "ripristino.txt",
        bytes.byteLength,
        checksum,
        now,
        now
    ).run();

    const exported = await call(env, undefined, { admin: true });
    const backup = await exported.json();
    assert.equal(exported.status, 200);

    const validationResponse = await call(
        env,
        "/api/admin/maintenance/restore/validate",
        { admin: true, method: "POST", body: backup }
    );
    const validation = await validationResponse.json();
    assert.equal(validationResponse.status, 200);
    assert.equal(validation.valid, true);
    assert.match(validation.confirmation, /^RIPRISTINA [0-9a-f]{12}$/u);

    await env.DB.prepare(`
        UPDATE site_pages SET title = 'Modifica successiva al backup'
        WHERE id = 'page-progetto'
    `).run();

    const refused = await call(env, "/api/admin/maintenance/restore", {
        admin: true,
        method: "POST",
        body: { backup, confirmation: "RIPRISTINA SBAGLIATO" }
    });
    assert.equal(refused.status, 400);
    assert.equal(
        env.DB.database.prepare("SELECT title FROM site_pages WHERE id = 'page-progetto'").get().title,
        "Modifica successiva al backup"
    );

    const restoredResponse = await call(env, "/api/admin/maintenance/restore", {
        admin: true,
        method: "POST",
        body: { backup, confirmation: validation.confirmation }
    });
    const restored = await restoredResponse.json();
    assert.equal(restoredResponse.status, 200);
    assert.equal(restored.restored, true);
    assert.equal(restored.checksum, validation.checksum);
    assert.equal(restored.mediaCount, 1);
    assert.equal(
        env.DB.database.prepare("SELECT title FROM site_pages WHERE id = 'page-progetto'").get().title,
        "Il progetto"
    );

    const media = env.DB.database.prepare(`
        SELECT object_key, checksum FROM media_assets
        WHERE id = 'media-restore-example'
    `).get();
    assert.match(media.object_key, /^restores\/[0-9a-f]{16}\//u);
    assert.equal(media.checksum, checksum);
    assert.ok(env.MEDIA.objects.has(media.object_key));
    assert.ok(env.MEDIA.objects.has("documents/restore/original.txt"));

    const immutableTriggers = env.DB.database.prepare(`
        SELECT COUNT(*) AS total FROM sqlite_master
        WHERE type = 'trigger' AND name IN (
            'content_revisions_immutable_update',
            'content_revisions_immutable_delete',
            'legal_versions_published_immutable_update',
            'legal_versions_published_immutable_delete',
            'permalinks_path_immutable'
        )
    `).get();
    assert.equal(immutableTriggers.total, 5);
});

test("il pannello separa verifica e conferma del ripristino", async () => {
    const root = new URL("../../", import.meta.url);
    const [html, script] = await Promise.all([
        readFile(new URL("admin.html", root), "utf8"),
        readFile(new URL("admin.js", root), "utf8")
    ]);
    assert.match(html, /id="adminCmsBackup"/u);
    assert.match(html, /id="adminCmsRestoreFile"/u);
    assert.match(html, /id="adminCmsRestoreValidate"/u);
    assert.match(html, /id="adminCmsRestoreConfirmationInput"/u);
    assert.match(html, /id="adminCmsRestore"/u);
    assert.match(html, /id="adminCmsDiagnostics"/u);
    assert.match(script, /\/api\/admin\/maintenance\/restore\/validate/u);
    assert.match(script, /\/api\/admin\/maintenance\/restore/u);
    assert.match(script, /\/api\/admin\/maintenance\/diagnostics/u);
    assert.match(script, /window\.confirm/u);
});

test("la diagnostica confronta D1, R2, sitemap, canonical e immagini", async () => {
    const env = environment();
    const denied = await call(env, "/api/admin/maintenance/diagnostics");
    assert.equal(denied.status, 401);
    const initialized = await call(env, undefined, { admin: true });
    assert.equal(initialized.status, 200);

    const fakeFetch = async (input, options = {}) => {
        const url = String(input);
        if (url.endsWith("/api/health")) {
            return Response.json({ ok: true, contentSchema: 4, mediaStorage: "r2" });
        }
        if (url.endsWith("/public-content-manifest.json")) {
            return Response.json(
                { version: 1, source: "D1 public API", wiki: [], places: [] },
                { headers: { "Last-Modified": "Sun, 11 Oct 2026 00:00:00 GMT" } }
            );
        }
        if (url.endsWith("/sitemap.xml")) {
            return new Response(
                "<urlset><url><loc>https://anonmrcn-ctrl.github.io/</loc></url></urlset>",
                { headers: { "Content-Type": "application/xml" } }
            );
        }
        if (url.endsWith("/robots.txt")) {
            return new Response(
                "User-agent: *\nSitemap: https://anonmrcn-ctrl.github.io/sitemap.xml\n"
            );
        }
        if (url === "https://anonmrcn-ctrl.github.io/") {
            return new Response(`<!doctype html><html><head>
                <title>anonMrcn</title>
                <link rel="canonical" href="https://anonmrcn-ctrl.github.io/">
                <meta property="og:image" content="https://anonmrcn-ctrl.github.io/logo.PNG">
                </head><body><h1>anonMrcn</h1>
                <img src="./logo.PNG" alt="Logo">
                </body></html>`, { headers: { "Content-Type": "text/html" } });
        }
        if (url === "https://anonmrcn-ctrl.github.io/logo.PNG" && options.method === "HEAD") {
            return new Response(null, { status: 200 });
        }
        return new Response("not found", { status: 404 });
    };

    const report = await runCmsDiagnostics(env, fakeFetch, Date.UTC(2026, 9, 11));
    assert.equal(report.ok, true);
    assert.equal(report.failures, 0);
    assert.equal(report.publication.manifestLastModified, "Sun, 11 Oct 2026 00:00:00 GMT");
    assert.deepEqual(
        report.checks.map((check) => [check.code, check.status]),
        [
            ["d1-foreign-keys", "pass"],
            ["r2-catalog", "pass"],
            ["worker-health", "pass"],
            ["static-manifest", "pass"],
            ["sitemap", "pass"],
            ["public-pages", "pass"],
            ["internal-links", "pass"],
            ["images", "pass"]
        ]
    );
});

async function sha256Hex(bytes) {
    const digest = await crypto.subtle.digest("SHA-256", bytes);
    return Buffer.from(digest).toString("hex");
}
