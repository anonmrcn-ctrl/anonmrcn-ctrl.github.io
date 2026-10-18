import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

import worker from "../src/index.js";

if (typeof crypto.subtle.timingSafeEqual !== "function") {
    crypto.subtle.timingSafeEqual = (first, second) => Buffer.from(first).equals(Buffer.from(second));
}

class Statement {
    constructor(database, sql) { this.database = database; this.sql = sql; this.values = []; }
    bind(...values) { this.values = values; return this; }
    async first() { return this.database.prepare(this.sql).get(...this.values) || null; }
    async all() { return { results: this.database.prepare(this.sql).all(...this.values) }; }
    async run() {
        const result = this.database.prepare(this.sql).run(...this.values);
        return { success: true, meta: { changes: result.changes, last_row_id: Number(result.lastInsertRowid) } };
    }
}

class Database {
    constructor() { this.database = new DatabaseSync(":memory:"); this.database.exec("PRAGMA foreign_keys = ON"); }
    prepare(sql) { return new Statement(this.database, sql); }
    async batch(statements) {
        this.database.exec("BEGIN");
        try {
            const results = [];
            for (const statement of statements) results.push(await statement.run());
            this.database.exec("COMMIT");
            return results;
        } catch (error) { this.database.exec("ROLLBACK"); throw error; }
    }
}

class Bucket {
    constructor() { this.objects = new Map(); }
    async put(key, value, options = {}) {
        const bytes = value instanceof Uint8Array ? new Uint8Array(value) : new Uint8Array(await new Response(value).arrayBuffer());
        this.objects.set(key, { bytes, options });
        return { key, size: bytes.byteLength };
    }
    async head(key) {
        const object = this.objects.get(key);
        return object ? { key, size: object.bytes.byteLength, customMetadata: object.options.customMetadata } : null;
    }
    async get(key) {
        const object = this.objects.get(key);
        return object ? { key, size: object.bytes.byteLength, body: object.bytes } : null;
    }
    async delete(value) { for (const key of Array.isArray(value) ? value : [value]) this.objects.delete(key); }
}

function environment() {
    return {
        DB: new Database(), MEDIA: new Bucket(), ADMIN_TOKEN: "test-admin",
        PASSWORD_PEPPER: "test-pepper", ALLOWED_ORIGIN: "https://anonmrcn-ctrl.github.io"
    };
}

async function call(env, path, options = {}) {
    const headers = new Headers({ Origin: env.ALLOWED_ORIGIN });
    if (options.admin) headers.set("X-Admin-Token", env.ADMIN_TOKEN);
    if (options.body) headers.set("Content-Type", "application/json");
    return await worker.fetch(new Request(`https://worker.test${path}`, {
        method: options.method || "GET", headers,
        body: options.body ? JSON.stringify(options.body) : undefined
    }), env, { waitUntil() {} });
}

function png(width, height, marker) {
    const header = Buffer.alloc(33);
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(header, 0);
    header.writeUInt32BE(13, 8); header.write("IHDR", 12, "ascii");
    header.writeUInt32BE(width, 16); header.writeUInt32BE(height, 20); header[24] = 8; header[25] = 6;
    return Buffer.concat([header, Buffer.from(marker)]).toString("base64");
}

test("carica, cataloga e pubblica in sicurezza un’immagine del builder", async () => {
    const env = environment();
    const input = {
        alt: "Facciata in mattoni illuminata dal sole",
        caption: "Dettaglio della facciata restaurata.",
        file: {
            name: "facciata.png", type: "image/png", data: png(1200, 800, "originale-builder"),
            variants: [{ key: "small", type: "image/png", data: png(480, 320, "variante-builder") }]
        }
    };
    assert.equal((await call(env, "/api/admin/cms/visual-media", { method: "POST", body: input })).status, 401);
    const created = await call(env, "/api/admin/cms/visual-media", { admin: true, method: "POST", body: input });
    const body = await created.json();
    assert.equal(created.status, 201);
    assert.equal(body.asset.source, "builder");
    assert.equal(body.asset.private, true);
    assert.deepEqual(body.variants, ["small"]);
    assert.match(body.checksum, /^[a-f0-9]{64}$/u);
    assert.equal(env.MEDIA.objects.size, 2);
    const rows = env.DB.database.prepare(`SELECT owner_type, owner_id, variant_key, state FROM media_assets WHERE owner_id LIKE 'visual-%' ORDER BY variant_key`).all();
    assert.equal(rows.length, 2);
    assert.ok(rows.every((row) => row.owner_type === "memory" && row.state === "current"));
    for (const object of env.MEDIA.objects.values()) {
        assert.match(object.options.customMetadata.checksum, /^[a-f0-9]{64}$/u);
        assert.equal(object.options.httpMetadata.cacheControl, "private, max-age=0, no-store");
    }
    assert.equal((await call(env, body.asset.publicUrl)).status, 404);
    const preview = await call(env, body.asset.publicUrl, { admin: true });
    assert.equal(preview.status, 200);
    assert.equal(preview.headers.get("cache-control"), "private, no-store");
    assert.equal(preview.headers.get("x-robots-tag"), "noindex, nofollow");
    const publication = env.DB.database.prepare("SELECT tree_id FROM visual_tree_publications ORDER BY tree_id LIMIT 1").get();
    env.DB.database.prepare("UPDATE visual_tree_publications SET snapshot_json = ? WHERE tree_id = ?")
        .run(JSON.stringify({ properties: [{ asset_id: body.asset.id }] }), publication.tree_id);
    const publicResponse = await call(env, body.asset.publicUrl);
    assert.equal(publicResponse.status, 200);
    assert.equal(publicResponse.headers.get("cache-control"), "public, max-age=31536000, immutable");
});

test("rifiuta firma incoerente senza lasciare oggetti R2", async () => {
    const env = environment();
    const response = await call(env, "/api/admin/cms/visual-media", {
        admin: true, method: "POST",
        body: { alt: "Descrizione", file: { name: "falso.jpg", type: "image/jpeg", data: png(400, 300, "non-jpeg") } }
    });
    assert.equal(response.status, 400);
    assert.match((await response.json()).error, /non corrisponde/u);
    assert.equal(env.MEDIA.objects.size, 0);
});

test("applica la quota prima di scrivere nuovi oggetti in R2", async () => {
    const env = environment();
    const initialized = await call(env, "/api/admin/cms/visual-media", { admin: true });
    assert.equal(initialized.status, 200);
    const insert = env.DB.database.prepare(`
        INSERT INTO media_assets (
            id, owner_type, owner_id, variant_key, object_key, media_type, media_name,
            byte_size, checksum, width, height, alt_text, caption, state, created_at, updated_at
        ) VALUES (?, 'memory', ?, 'original', ?, 'image/png', 'quota.png', 1, ?, 1, 1, 'Alt', '', 'current', 1, 1)
    `);
    for (let index = 0; index < 250; index += 1) {
        insert.run(
            `media-quota-${index}`,
            `visual-quota-${index}`,
            `visual/quota-${index}/original.png`,
            String(index).padStart(64, "0")
        );
    }
    const response = await call(env, "/api/admin/cms/visual-media", {
        admin: true,
        method: "POST",
        body: {
            alt: "Descrizione",
            file: { name: "oltre-quota.png", type: "image/png", data: png(400, 300, "quota") }
        }
    });
    assert.equal(response.status, 409);
    assert.match((await response.json()).error, /quota/u);
    assert.equal(env.MEDIA.objects.size, 0);
});

test("il builder espone avanzamento, annullamento e varianti senza codici tecnici", async () => {
    const [html, source, css] = await Promise.all([
        readFile(new URL("../../admin.html", import.meta.url), "utf8"),
        readFile(new URL("../../admin-visual-builder.js", import.meta.url), "utf8"),
        readFile(new URL("../../admin-visual-builder.css", import.meta.url), "utf8")
    ]);
    assert.match(html, /id="adminVisualMediaFile"[^>]+accept="image\/jpeg,image\/png,image\/webp"/u);
    assert.match(html, /id="adminVisualMediaUploadProgress"/u);
    assert.match(source, /xhr\.upload\.addEventListener\("progress"/u);
    assert.match(source, /mediaUploadTask\.xhr\?\.abort\(\)/u);
    assert.match(source, /createImageBitmap\(file\)/u);
    assert.match(source, /\[\["small", 480\], \["medium", 960\]\]/u);
    assert.match(css, /\.admin-visual-media-upload progress/u);
});
