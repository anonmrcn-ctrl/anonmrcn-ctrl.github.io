import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

import worker from "../src/index.js";
import { renderVisualPage } from "../src/visual-builder-renderer.js";
import { ensureVisualNodeBlockTypes } from "../src/visual-builder-storage.js";

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
    constructor(database = new DatabaseSync(":memory:")) {
        this.database = database;
        this.database.exec("PRAGMA foreign_keys = ON");
    }
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
    async get(key, options = {}) {
        const object = this.objects.get(key);
        if (!object) return null;
        const range = options?.range;
        const bytes = range
            ? object.bytes.slice(range.offset, range.offset + range.length)
            : object.bytes;
        return { key, size: object.bytes.byteLength, body: bytes };
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
    const headers = new Headers({ Origin: env.ALLOWED_ORIGIN, ...(options.headers || {}) });
    if (options.admin) headers.set("X-Admin-Token", env.ADMIN_TOKEN);
    if (options.body) headers.set("Content-Type", "application/json");
    return await worker.fetch(new Request(`https://worker.test${path}`, {
        method: options.method || "GET", headers,
        body: options.body ? JSON.stringify(options.body) : undefined
    }), env, { waitUntil() {} });
}

function audioProperty(name, valueKind, value) {
    return {
        node_id: "audio", domain: name === "title" || name === "text" ? "content" : "content",
        property_set: name === "title" || name === "text" ? "content.copy" : "content.media",
        property_name: name, breakpoint: "all", item_position: 0,
        value_kind: valueKind,
        text_value: valueKind === "asset" ? null : value,
        number_value: null, boolean_value: null,
        asset_id: valueKind === "asset" ? value : null,
        page_reference_id: null, collection_key: null
    };
}

test("migra lo schema esistente e conserva nodi e proprietà", async () => {
    const database = new DatabaseSync(":memory:");
    database.exec("PRAGMA foreign_keys = ON");
    for (const file of [
        "0013_cms_content_foundation.sql", "0015_media_assets_r2.sql",
        "0019_visual_builder_schema.sql", "0020_visual_reusable_instances.sql",
        "0021_visual_publications.sql"
    ]) database.exec(await readFile(new URL(`../migrations/${file}`, import.meta.url), "utf8"));
    database.exec(`
        INSERT INTO site_pages (id, slug, title, description, status, created_at, updated_at)
        VALUES ('page-test', 'test', 'Test', '', 'draft', 1, 1);
        INSERT INTO visual_trees (id, status, created_at, updated_at)
        VALUES ('tree-test', 'draft', 1, 1);
        INSERT INTO visual_page_trees (page_id, tree_id, created_at, updated_at)
        VALUES ('page-test', 'tree-test', 1, 1);
        INSERT INTO visual_nodes (id, tree_id, parent_id, position, block_type, label, created_at, updated_at)
        VALUES ('root-test', 'tree-test', NULL, 1, 'page-root', 'Pagina', 1, 1);
        INSERT INTO visual_node_properties (
            node_id, domain, property_set, property_name, value_kind, text_value, created_at, updated_at
        ) VALUES ('root-test', 'content', 'content.copy', 'title', 'text', 'Titolo', 1, 1);
    `);
    const env = { DB: new Database(database) };
    await ensureVisualNodeBlockTypes(env);
    database.prepare(`
        INSERT INTO visual_nodes (id, tree_id, parent_id, position, block_type, label, created_at, updated_at)
        VALUES ('audio-test', 'tree-test', 'root-test', 1, 'audio', 'Audio', 2, 2)
    `).run();
    assert.equal(database.prepare("SELECT text_value FROM visual_node_properties WHERE node_id = 'root-test'").get().text_value, "Titolo");
    assert.equal(database.prepare("SELECT block_type FROM visual_nodes WHERE id = 'audio-test'").get().block_type, "audio");
});

test("la migrazione D1 0022 conserva relazioni e abilita i nodi audio", async () => {
    const database = new DatabaseSync(":memory:");
    database.exec("PRAGMA foreign_keys = ON");
    for (const file of [
        "0013_cms_content_foundation.sql", "0015_media_assets_r2.sql",
        "0019_visual_builder_schema.sql", "0020_visual_reusable_instances.sql",
        "0021_visual_publications.sql"
    ]) database.exec(await readFile(new URL(`../migrations/${file}`, import.meta.url), "utf8"));
    database.exec(`
        INSERT INTO site_pages (id, slug, title, description, status, created_at, updated_at)
        VALUES ('page-migration', 'migrazione', 'Migrazione', '', 'draft', 1, 1);
        INSERT INTO visual_trees (id, status, created_at, updated_at)
        VALUES ('tree-migration', 'draft', 1, 1);
        INSERT INTO visual_page_trees (page_id, tree_id, created_at, updated_at)
        VALUES ('page-migration', 'tree-migration', 1, 1);
        INSERT INTO visual_nodes (id, tree_id, parent_id, position, block_type, label, created_at, updated_at)
        VALUES ('root-migration', 'tree-migration', NULL, 1, 'page-root', 'Pagina', 1, 1);
        INSERT INTO visual_node_properties (
            node_id, domain, property_set, property_name, value_kind, text_value, created_at, updated_at
        ) VALUES ('root-migration', 'content', 'content.copy', 'title', 'text', 'Conservato', 1, 1);
    `);
    database.exec(await readFile(new URL("../migrations/0022_visual_audio_block.sql", import.meta.url), "utf8"));
    database.prepare(`
        INSERT INTO visual_nodes (id, tree_id, parent_id, position, block_type, label, created_at, updated_at)
        VALUES ('audio-migration', 'tree-migration', 'root-migration', 1, 'audio', 'Audio', 2, 2)
    `).run();
    assert.equal(database.prepare("SELECT text_value FROM visual_node_properties WHERE node_id = 'root-migration'").get().text_value, "Conservato");
    assert.deepEqual(database.prepare("PRAGMA foreign_key_check").all(), []);
});

test("carica audio privato e abilita Range solo dopo la pubblicazione", async () => {
    const env = environment();
    const pages = await call(env, "/api/admin/cms/visual-pages", { admin: true });
    const pagesBody = await pages.json();
    assert.ok(pagesBody.palette.some((entry) => entry.type === "audio"));
    assert.equal(pagesBody.inspectorSchemas.audio.find((field) => field.key === "audioAssetId").mediaKind, "audio");
    const bytes = Buffer.from("ID3-audio-di-prova-per-range");
    const created = await call(env, "/api/admin/cms/visual-media", {
        admin: true, method: "POST",
        body: {
            kind: "audio", title: "Voce narrante", description: "Lettura del testo",
            file: { name: "voce.mp3", type: "audio/mpeg", data: bytes.toString("base64") }
        }
    });
    const body = await created.json();
    assert.equal(created.status, 201);
    assert.equal(body.asset.kind, "audio");
    assert.equal(body.asset.private, true);
    assert.equal((await call(env, body.asset.publicUrl)).status, 404);
    const privateRange = await call(env, body.asset.publicUrl, {
        admin: true, headers: { Range: "bytes=0-3" }
    });
    assert.equal(privateRange.status, 206);
    assert.equal(privateRange.headers.get("content-range"), `bytes 0-3/${bytes.length}`);
    assert.equal(privateRange.headers.get("accept-ranges"), "bytes");
    assert.equal(privateRange.headers.get("x-robots-tag"), "noindex, nofollow");
    assert.equal(Buffer.from(await privateRange.arrayBuffer()).toString(), "ID3-");
    const publication = env.DB.database.prepare("SELECT tree_id FROM visual_tree_publications LIMIT 1").get();
    env.DB.database.prepare("UPDATE visual_tree_publications SET snapshot_json = ? WHERE tree_id = ?")
        .run(JSON.stringify({ properties: [{ property_name: "audioAssetId", asset_id: body.asset.id }] }), publication.tree_id);
    const publicRange = await call(env, body.asset.publicUrl, { headers: { Range: "bytes=-5" } });
    assert.equal(publicRange.status, 206);
    assert.equal(publicRange.headers.get("cache-control"), "public, max-age=31536000, immutable");
    assert.equal((await call(env, body.asset.publicUrl, { headers: { Range: "bytes=999-1000" } })).status, 416);
});

test("renderizza controlli e trascrizione senza autoplay e limita AudioObject alle pagine indicizzabili", () => {
    const nodes = [
        { id: "root", parent_id: null, position: 1, block_type: "page-root" },
        { id: "audio", parent_id: "root", position: 1, block_type: "audio" }
    ];
    const properties = [
        audioProperty("title", "text", "Voce narrante"),
        audioProperty("text", "text", "Lettura del percorso"),
        audioProperty("audioAssetId", "asset", "audio-one"),
        audioProperty("transcript", "text", "Testo completo della lettura."),
        audioProperty("preload", "text", "metadata"),
        audioProperty("loop", "text", "no")
    ];
    const rendered = renderVisualPage({
        page: { id: "page", slug: "ascolta", title: "Ascolta", description: "Pagina audio", status: "published" },
        nodes, properties,
        assets: [{ id: "audio-one", media_type: "audio/mpeg", publicUrl: "/api/public/visual-media/media-audio" }]
    });
    assert.match(rendered.html, /<audio controls preload="metadata"/u);
    assert.match(rendered.html, /<summary>Trascrizione<\/summary>/u);
    assert.doesNotMatch(rendered.html, /autoplay|<iframe|<script/iu);
    const audioObject = rendered.metadata.structuredData["@graph"].find((item) => item["@type"] === "AudioObject");
    assert.equal(audioObject.transcript, "Testo completo della lettura.");
    const privatePage = renderVisualPage({
        page: { id: "private", slug: "spazio-personale", title: "Privata", status: "published" },
        nodes, properties,
        assets: [{ id: "audio-one", media_type: "audio/mpeg", publicUrl: "/api/public/visual-media/media-audio" }]
    });
    assert.equal(privatePage.metadata.structuredData, null);
});

test("il pannello configura audio e trascrizione senza URL o autoplay", async () => {
    const [html, source] = await Promise.all([
        readFile(new URL("../../admin.html", import.meta.url), "utf8"),
        readFile(new URL("../../admin-visual-builder.js", import.meta.url), "utf8")
    ]);
    assert.match(html, /id="adminVisualMediaUploadSummary"/u);
    assert.match(source, /audio\/mpeg,audio\/ogg,audio\/webm,audio\/mp4,audio\/wav/u);
    assert.match(source, /field\.mediaKind === "audio"/u);
    assert.match(source, /Aggiungi la trascrizione accessibile dell’audio/u);
    assert.doesNotMatch(source, /\.autoplay\s*=|setAttribute\(["']autoplay/iu);
});
