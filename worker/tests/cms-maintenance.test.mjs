import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

import worker from "../src/index.js";

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

async function call(env, options = {}) {
    const headers = new Headers({ Origin: env.ALLOWED_ORIGIN });
    if (options.admin) headers.set("X-Admin-Token", env.ADMIN_TOKEN);
    return worker.fetch(new Request(
        "https://worker.test/api/admin/maintenance/export",
        { headers }
    ), env, { waitUntil() {} });
}

test("esporta contenuti D1 e oggetti R2 senza credenziali o dati personali", async () => {
    const env = environment();
    const denied = await call(env);
    assert.equal(denied.status, 401);

    const initial = await call(env, { admin: true });
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

    const response = await call(env, { admin: true });
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
    const initial = await call(env, { admin: true });
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

    const response = await call(env, { admin: true });
    assert.equal(response.status, 409);
    assert.match((await response.json()).error, /Oggetto R2 mancante/u);
});

async function sha256Hex(bytes) {
    const digest = await crypto.subtle.digest("SHA-256", bytes);
    return Buffer.from(digest).toString("hex");
}
