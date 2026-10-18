import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

import worker from "../src/index.js";

if (typeof crypto.subtle.timingSafeEqual !== "function") {
    crypto.subtle.timingSafeEqual = (first, second) => {
        const left = new Uint8Array(first);
        const right = new Uint8Array(second);
        if (left.byteLength !== right.byteLength) return false;
        let difference = 0;
        for (let index = 0; index < left.byteLength; index += 1) {
            difference |= left[index] ^ right[index];
        }
        return difference === 0;
    };
}

class D1StatementMock {
    constructor(database, sql) { this.database = database; this.sql = sql; this.values = []; }
    bind(...values) { this.values = values; return this; }
    async first() { return this.database.prepare(this.sql).get(...this.values) || null; }
    async all() { return { results: this.database.prepare(this.sql).all(...this.values) }; }
    async run() {
        const result = this.database.prepare(this.sql).run(...this.values);
        return { success: true, meta: { changes: result.changes } };
    }
}

class D1DatabaseMock {
    constructor() {
        this.database = new DatabaseSync(":memory:");
        this.database.exec("PRAGMA foreign_keys = ON");
    }
    prepare(sql) { return new D1StatementMock(this.database, sql); }
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

function environment() {
    return {
        DB: new D1DatabaseMock(),
        ADMIN_TOKEN: "test-admin",
        ALLOWED_ORIGIN: "https://anonmrcn-ctrl.github.io"
    };
}

async function call(env, path, options = {}) {
    const headers = new Headers({ Origin: env.ALLOWED_ORIGIN });
    if (options.admin) headers.set("X-Admin-Token", env.ADMIN_TOKEN);
    if (options.body) headers.set("Content-Type", "application/json");
    const response = await worker.fetch(new Request(`https://worker.test${path}`, {
        method: options.method || "GET",
        headers,
        body: options.body ? JSON.stringify(options.body) : undefined
    }), env, {});
    return { response, data: await response.json() };
}

function insertAsset(database, {
    id, ownerType = "wiki_image", ownerId = id, variant = "original",
    state = "current", alt = "Testo alternativo"
}) {
    database.prepare(`
        INSERT INTO media_assets (
            id, owner_type, owner_id, variant_key, object_key, media_type,
            media_name, byte_size, checksum, width, height, alt_text, caption,
            state, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, 'image/webp', ?, 120, ?, 640, 480, ?, ?, ?, 10, 10)
    `).run(
        id, ownerType, ownerId, variant, `catalog/${id}.webp`,
        `${id}.webp`, id[0].repeat(64), alt, `Didascalia ${id}`, state
    );
}

test("espone e salva immagini D1/R2 senza richiedere ID o URL nell'interfaccia", async () => {
    const env = environment();
    const initial = await call(env, "/api/admin/cms/visual-pages", { admin: true });
    const database = env.DB.database;
    insertAsset(database, { id: "asset-one" });
    insertAsset(database, { id: "asset-two", ownerType: "map_entry" });
    insertAsset(database, { id: "asset-no-alt", alt: "" });
    insertAsset(database, { id: "asset-retained", state: "retained" });
    insertAsset(database, { id: "asset-small", variant: "small" });

    assert.equal((await call(env, "/api/admin/cms/visual-media")).response.status, 401);
    const library = await call(env, "/api/admin/cms/visual-media", { admin: true });
    assert.equal(library.response.status, 200);
    assert.deepEqual(
        library.data.assets.map((asset) => asset.id),
        ["asset-no-alt", "asset-one", "asset-two"]
    );
    assert.equal(library.data.assets.find((asset) => asset.id === "asset-no-alt").accessible, false);
    assert.ok(library.data.assets.every((asset) =>
        asset.thumbnailUrl.endsWith("?variant=small") && !Object.hasOwn(asset, "objectKey")
    ));
    assert.equal(
        initial.data.inspectorSchemas.image.find((field) => field.key === "assetId").control,
        "media-picker"
    );
    assert.equal(
        initial.data.inspectorSchemas.gallery.find((field) => field.key === "assetIds").format,
        "lines"
    );

    const page = initial.data.pages.find((item) => item.id === "page-autore");
    const tree = database.prepare(`
        SELECT tree_id FROM visual_page_trees WHERE page_id = ?
    `).get(page.id);
    const root = database.prepare(`
        SELECT id FROM visual_nodes WHERE tree_id = ? AND parent_id IS NULL
    `).get(tree.tree_id);
    const nextPosition = database.prepare(`
        SELECT coalesce(max(position), 0) + 1 AS position
        FROM visual_nodes WHERE tree_id = ? AND parent_id = ?
    `).get(tree.tree_id, root.id).position;
    database.prepare(`
        INSERT INTO visual_nodes (
            id, tree_id, parent_id, position, block_type, label, created_at, updated_at
        ) VALUES ('image-picker-test', ?, ?, ?, 'image', 'Immagine test', 10, 10)
    `).run(tree.tree_id, root.id, nextPosition);
    database.prepare(`
        INSERT INTO visual_nodes (
            id, tree_id, parent_id, position, block_type, label, created_at, updated_at
        ) VALUES ('gallery-picker-test', ?, ?, ?, 'gallery', 'Galleria test', 10, 10)
    `).run(tree.tree_id, root.id, nextPosition + 1);

    const refreshed = await call(env, "/api/admin/cms/visual-pages", { admin: true });
    const currentPage = refreshed.data.pages.find((item) => item.id === page.id);
    const imageSaved = await call(
        env,
        `/api/admin/cms/visual-properties/${page.id}/image-picker-test`,
        {
            admin: true,
            method: "PATCH",
            body: {
                expectedUpdatedAt: currentPage.updatedAt,
                values: {
                    assetId: "asset-one",
                    alt: "Descrizione scelta nel blocco",
                    caption: "Didascalia scelta",
                    credit: "Archivio locale",
                    focalPoint: "top"
                }
            }
        }
    );
    assert.equal(imageSaved.response.status, 200);
    const imageProperty = database.prepare(`
        SELECT value_kind, text_value, asset_id
        FROM visual_node_properties
        WHERE node_id = 'image-picker-test' AND property_name = 'assetId'
    `).get();
    assert.deepEqual({ ...imageProperty }, {
        value_kind: "asset", text_value: null, asset_id: "asset-one"
    });

    const gallerySaved = await call(
        env,
        `/api/admin/cms/visual-properties/${page.id}/gallery-picker-test`,
        {
            admin: true,
            method: "PATCH",
            body: {
                expectedUpdatedAt: imageSaved.data.page.updatedAt,
                values: { assetIds: "asset-two\nasset-one" }
            }
        }
    );
    assert.equal(gallerySaved.response.status, 200);
    assert.deepEqual(database.prepare(`
        SELECT asset_id FROM visual_node_properties
        WHERE node_id = 'gallery-picker-test' AND property_name = 'assetId'
        ORDER BY item_position
    `).all().map((row) => row.asset_id), ["asset-two", "asset-one"]);

    const inaccessible = await call(
        env,
        `/api/admin/cms/visual-properties/${page.id}/gallery-picker-test`,
        {
            admin: true,
            method: "PATCH",
            body: {
                expectedUpdatedAt: gallerySaved.data.page.updatedAt,
                values: { assetIds: "asset-no-alt" }
            }
        }
    );
    assert.equal(inaccessible.response.status, 400);
    assert.match(inaccessible.data.error, /testo alternativo/u);
});

test("il pannello offre ricerca, filtro, miniature, sostituzione, ordine e rimozione", async () => {
    const [html, source, css] = await Promise.all([
        readFile(new URL("../../admin.html", import.meta.url), "utf8"),
        readFile(new URL("../../admin-visual-builder.js", import.meta.url), "utf8"),
        readFile(new URL("../../admin-visual-builder.css", import.meta.url), "utf8")
    ]);
    for (const id of [
        "adminVisualMediaDialog", "adminVisualMediaSearch", "adminVisualMediaSource",
        "adminVisualMediaResults", "adminVisualMediaSelected", "adminVisualMediaApply",
        "adminVisualMediaClear"
    ]) assert.match(html, new RegExp(`id="${id}"`, "u"));
    assert.match(source, /\/api\/admin\/cms\/visual-media/u);
    assert.match(source, /openMediaPicker/u);
    assert.match(source, /mediaPicker\.ids\.splice/u);
    assert.match(source, /Sostituisci immagine/u);
    assert.match(css, /admin-visual-media-results/u);
    assert.match(css, /max-width:\s*42rem/u);
});
