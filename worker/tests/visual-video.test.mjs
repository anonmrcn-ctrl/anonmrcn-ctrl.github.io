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
        const bytes = range ? object.bytes.slice(range.offset, range.offset + range.length) : object.bytes;
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

function property(name, valueKind, value) {
    const media = ["videoAssetId", "posterAssetId", "subtitleAssetId", "transcript", "preload", "loop"].includes(name);
    return {
        node_id: "video", domain: "content", property_set: media ? "content.media" : "content.copy",
        property_name: name, breakpoint: "all", item_position: 0,
        value_kind: valueKind,
        text_value: valueKind === "asset" ? null : value,
        number_value: null, boolean_value: null,
        asset_id: valueKind === "asset" ? value : null,
        page_reference_id: null, collection_key: null
    };
}

test("aggiorna lo schema audio esistente e conserva le relazioni", async () => {
    const database = new DatabaseSync(":memory:");
    database.exec("PRAGMA foreign_keys = ON");
    for (const file of [
        "0013_cms_content_foundation.sql", "0015_media_assets_r2.sql",
        "0019_visual_builder_schema.sql", "0020_visual_reusable_instances.sql",
        "0021_visual_publications.sql", "0022_visual_audio_block.sql"
    ]) database.exec(await readFile(new URL(`../migrations/${file}`, import.meta.url), "utf8"));
    database.exec(`
        INSERT INTO site_pages (id, slug, title, description, status, created_at, updated_at)
        VALUES ('page-video', 'video', 'Video', '', 'draft', 1, 1);
        INSERT INTO visual_trees (id, status, created_at, updated_at)
        VALUES ('tree-video', 'draft', 1, 1);
        INSERT INTO visual_page_trees (page_id, tree_id, created_at, updated_at)
        VALUES ('page-video', 'tree-video', 1, 1);
        INSERT INTO visual_nodes (id, tree_id, parent_id, position, block_type, label, created_at, updated_at)
        VALUES ('root-video', 'tree-video', NULL, 1, 'page-root', 'Pagina', 1, 1);
        INSERT INTO visual_node_properties (
            node_id, domain, property_set, property_name, value_kind, text_value, created_at, updated_at
        ) VALUES ('root-video', 'content', 'content.copy', 'title', 'text', 'Conservato', 1, 1);
    `);
    await ensureVisualNodeBlockTypes({ DB: new Database(database) });
    database.prepare(`
        INSERT INTO visual_nodes (id, tree_id, parent_id, position, block_type, label, created_at, updated_at)
        VALUES ('video-test', 'tree-video', 'root-video', 1, 'video', 'Video', 2, 2)
    `).run();
    assert.equal(database.prepare("SELECT text_value FROM visual_node_properties WHERE node_id = 'root-video'").get().text_value, "Conservato");
    assert.deepEqual(database.prepare("PRAGMA foreign_key_check").all(), []);
});

test("la migrazione D1 0023 abilita il video senza perdere i nodi audio", async () => {
    const database = new DatabaseSync(":memory:");
    database.exec("PRAGMA foreign_keys = ON");
    for (const file of [
        "0013_cms_content_foundation.sql", "0015_media_assets_r2.sql",
        "0019_visual_builder_schema.sql", "0020_visual_reusable_instances.sql",
        "0021_visual_publications.sql", "0022_visual_audio_block.sql"
    ]) database.exec(await readFile(new URL(`../migrations/${file}`, import.meta.url), "utf8"));
    database.exec(`
        INSERT INTO site_pages (id, slug, title, description, status, created_at, updated_at)
        VALUES ('page-migration-video', 'migrazione-video', 'Migrazione video', '', 'draft', 1, 1);
        INSERT INTO visual_trees (id, status, created_at, updated_at)
        VALUES ('tree-migration-video', 'draft', 1, 1);
        INSERT INTO visual_page_trees (page_id, tree_id, created_at, updated_at)
        VALUES ('page-migration-video', 'tree-migration-video', 1, 1);
        INSERT INTO visual_nodes (id, tree_id, parent_id, position, block_type, label, created_at, updated_at)
        VALUES ('root-migration-video', 'tree-migration-video', NULL, 1, 'page-root', 'Pagina', 1, 1),
               ('audio-preserved', 'tree-migration-video', 'root-migration-video', 1, 'audio', 'Audio', 1, 1);
    `);
    database.exec(await readFile(new URL("../migrations/0023_visual_video_block.sql", import.meta.url), "utf8"));
    database.prepare(`
        INSERT INTO visual_nodes (id, tree_id, parent_id, position, block_type, label, created_at, updated_at)
        VALUES ('video-migration', 'tree-migration-video', 'root-migration-video', 2, 'video', 'Video', 2, 2)
    `).run();
    assert.equal(database.prepare("SELECT block_type FROM visual_nodes WHERE id = 'audio-preserved'").get().block_type, "audio");
    assert.deepEqual(database.prepare("PRAGMA foreign_key_check").all(), []);
});

test("carica video e sottotitoli privati e serve il video con Range dopo la pubblicazione", async () => {
    const env = environment();
    const pages = await call(env, "/api/admin/cms/visual-pages", { admin: true });
    const pagesBody = await pages.json();
    assert.ok(pagesBody.palette.some((entry) => entry.type === "video"));
    assert.equal(pagesBody.inspectorSchemas.video.find((field) => field.key === "subtitleAssetId").mediaKind, "subtitle");
    const videoBytes = Buffer.concat([Buffer.from([0, 0, 0, 20]), Buffer.from("ftypisom-video-prova")]);
    const videoResponse = await call(env, "/api/admin/cms/visual-media", {
        admin: true, method: "POST",
        body: {
            kind: "video", title: "Percorso filmato", description: "Veduta del percorso",
            file: { name: "percorso.mp4", type: "video/mp4", data: videoBytes.toString("base64") }
        }
    });
    const videoBody = await videoResponse.json();
    assert.equal(videoResponse.status, 201);
    assert.equal(videoBody.asset.kind, "video");
    const subtitleBytes = Buffer.from("WEBVTT\n\n00:00.000 --> 00:02.000\nInizio del percorso.\n");
    const subtitleResponse = await call(env, "/api/admin/cms/visual-media", {
        admin: true, method: "POST",
        body: {
            kind: "subtitle", title: "Italiano",
            file: { name: "it.vtt", type: "text/vtt", data: subtitleBytes.toString("base64") }
        }
    });
    const subtitleBody = await subtitleResponse.json();
    assert.equal(subtitleResponse.status, 201);
    assert.equal(subtitleBody.asset.kind, "subtitle");
    assert.equal((await call(env, videoBody.asset.publicUrl)).status, 404);
    assert.equal((await call(env, subtitleBody.asset.publicUrl)).status, 404);
    const privateRange = await call(env, videoBody.asset.publicUrl, {
        admin: true, headers: { Range: "bytes=4-7" }
    });
    assert.equal(privateRange.status, 206);
    assert.equal(Buffer.from(await privateRange.arrayBuffer()).toString(), "ftyp");
    assert.equal(privateRange.headers.get("x-robots-tag"), "noindex, nofollow");
    const publication = env.DB.database.prepare("SELECT tree_id FROM visual_tree_publications LIMIT 1").get();
    env.DB.database.prepare("UPDATE visual_tree_publications SET snapshot_json = ? WHERE tree_id = ?")
        .run(JSON.stringify({ properties: [
            { property_name: "videoAssetId", asset_id: videoBody.asset.id },
            { property_name: "subtitleAssetId", asset_id: subtitleBody.asset.id }
        ] }), publication.tree_id);
    assert.equal((await call(env, videoBody.asset.publicUrl, { headers: { Range: "bytes=-5" } })).status, 206);
    const publicSubtitle = await call(env, subtitleBody.asset.publicUrl);
    assert.equal(publicSubtitle.status, 200);
    assert.equal(publicSubtitle.headers.get("content-type"), "text/vtt");
});

test("renderizza video, poster e sottotitoli senza autoplay e limita VideoObject", () => {
    const nodes = [
        { id: "root", parent_id: null, position: 1, block_type: "page-root" },
        { id: "video", parent_id: "root", position: 1, block_type: "video" }
    ];
    const properties = [
        property("title", "text", "Cammino d’autunno"),
        property("text", "text", "Veduta commentata del percorso."),
        property("videoAssetId", "asset", "video-one"),
        property("posterAssetId", "asset", "poster-one"),
        property("subtitleAssetId", "asset", "subtitle-one"),
        property("transcript", "text", "Trascrizione completa del filmato."),
        property("preload", "text", "metadata"),
        property("loop", "text", "no")
    ];
    const assets = [
        { id: "video-one", media_type: "video/mp4", publicUrl: "/api/public/visual-media/video-one", created_at: 1792368000000 },
        { id: "poster-one", media_type: "image/webp", publicUrl: "/api/public/visual-media/poster-one", width: 1280, height: 720 },
        { id: "subtitle-one", media_type: "text/vtt", publicUrl: "/api/public/visual-media/subtitle-one" }
    ];
    const rendered = renderVisualPage({
        page: { id: "page", slug: "guarda", title: "Guarda", description: "Pagina video", status: "published" },
        nodes, properties, assets
    });
    assert.match(rendered.html, /<video controls playsinline preload="metadata" poster=/u);
    assert.match(rendered.html, /<track kind="captions"[^>]+srclang="it"[^>]+default>/u);
    assert.match(rendered.html, /<summary>Trascrizione<\/summary>/u);
    assert.doesNotMatch(rendered.html, /autoplay|<iframe|<script/iu);
    const videoObject = rendered.metadata.structuredData["@graph"].find((item) => item["@type"] === "VideoObject");
    assert.equal(videoObject.name, "Cammino d’autunno");
    assert.match(videoObject.thumbnailUrl, /poster-one$/u);
    const privatePage = renderVisualPage({
        page: { id: "private", slug: "spazio-personale", title: "Privata", status: "published" },
        nodes, properties, assets
    });
    assert.equal(privatePage.metadata.structuredData, null);
});

test("il pannello configura video, poster e sottotitoli senza URL o autoplay", async () => {
    const [html, source, css] = await Promise.all([
        readFile(new URL("../../admin.html", import.meta.url), "utf8"),
        readFile(new URL("../../admin-visual-builder.js", import.meta.url), "utf8"),
        readFile(new URL("../../style.css", import.meta.url), "utf8")
    ]);
    assert.match(html, /admin-visual-builder\.js\?v=20261019-video1/u);
    assert.match(source, /video\/mp4,video\/webm/u);
    assert.match(source, /text\/vtt,\.vtt/u);
    assert.match(source, /Aggiungi i sottotitoli WebVTT del video/u);
    assert.doesNotMatch(source, /\.autoplay\s*=|setAttribute\(["']autoplay/iu);
    assert.match(css, /\.visual-block--video video/u);
});
