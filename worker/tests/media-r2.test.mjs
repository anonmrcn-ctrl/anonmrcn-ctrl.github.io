import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

import worker from "../src/index.js";

if (typeof crypto.subtle.timingSafeEqual !== "function") {
    crypto.subtle.timingSafeEqual = (first, second) =>
        Buffer.from(first).equals(Buffer.from(second));
}

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
    async put(key, value, options = {}) {
        const bytes = value instanceof Uint8Array
            ? new Uint8Array(value)
            : new Uint8Array(await new Response(value).arrayBuffer());
        this.objects.set(key, { bytes, options });
        return { key, size: bytes.byteLength };
    }
    async head(key) {
        const object = this.objects.get(key);
        return object ? { key, size: object.bytes.byteLength } : null;
    }
    async get(key) {
        const object = this.objects.get(key);
        return object
            ? { key, size: object.bytes.byteLength, body: object.bytes }
            : null;
    }
    async delete(value) {
        const keys = Array.isArray(value) ? value : [value];
        keys.forEach((key) => this.objects.delete(key));
    }
}

function environment(withR2 = true) {
    return {
        DB: new D1DatabaseMock(),
        ...(withR2 ? { MEDIA: new R2BucketMock() } : {}),
        ADMIN_TOKEN: "test-admin",
        PASSWORD_PEPPER: "test-pepper",
        ALLOWED_ORIGIN: "https://anonmrcn-ctrl.github.io"
    };
}

async function call(env, path, options = {}) {
    const headers = new Headers({ Origin: env.ALLOWED_ORIGIN });
    if (options.admin) headers.set("X-Admin-Token", env.ADMIN_TOKEN);
    if (options.memoryToken) headers.set("X-Memory-Token", options.memoryToken);
    if (options.body) headers.set("Content-Type", "application/json");
    const response = await worker.fetch(new Request(`https://worker.test${path}`, {
        method: options.method || "GET",
        headers,
        body: options.body ? JSON.stringify(options.body) : undefined
    }), env, { waitUntil() {} });
    return response;
}

function mapEntry(image, overrides = {}) {
    return {
        name: "Luogo R2",
        category: "luogo",
        description: "Descrizione del luogo.",
        lat: 45.55,
        lon: 12.31,
        sourceUrl: "",
        sourceLabel: "",
        ...(image ? { image } : {}),
        ...overrides
    };
}

function image(name, value) {
    const bytes = Buffer.concat([
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
        Buffer.from(value)
    ]);
    return {
        name,
        type: "image/png",
        data: bytes.toString("base64")
    };
}

test("sposta in R2 gli originali nuovi e conserva la versione sostituita", async () => {
    const env = environment();
    const created = await call(env, "/api/admin/map-entries", {
        admin: true,
        method: "POST",
        body: mapEntry(image("prima.png", "prima-immagine"))
    });
    const createdBody = await created.json();
    assert.equal(created.status, 201);
    const id = createdBody.entry.id;
    const database = env.DB.database;

    assert.equal(database.prepare(`
        SELECT media_data FROM map_entry_images WHERE entry_id = ?
    `).get(id).media_data, "");
    assert.equal(database.prepare(`
        SELECT COUNT(*) AS total FROM media_assets
        WHERE owner_type = 'map_entry' AND owner_id = ? AND state = 'current'
    `).get(String(id)).total, 1);
    assert.equal(env.MEDIA.objects.size, 1);

    const firstPublic = await call(env, `/api/public/map-entry-images/${id}`);
    assert.equal(firstPublic.status, 200);
    assert.equal(
        Buffer.from(await firstPublic.arrayBuffer()).toString().endsWith("prima-immagine"),
        true
    );
    assert.equal(firstPublic.headers.get("content-type"), "image/png");
    assert.equal(firstPublic.headers.get("x-media-storage"), "r2");

    const updated = await call(env, `/api/admin/map-entries/${id}`, {
        admin: true,
        method: "PATCH",
        body: mapEntry(image("seconda.png", "seconda-immagine"))
    });
    assert.equal(updated.status, 200);
    assert.deepEqual(database.prepare(`
        SELECT state, COUNT(*) AS total
        FROM media_assets
        WHERE owner_type = 'map_entry' AND owner_id = ?
        GROUP BY state ORDER BY state
    `).all(String(id)).map((row) => ({ ...row })), [
        { state: "current", total: 1 },
        { state: "retained", total: 1 }
    ]);
    assert.equal(env.MEDIA.objects.size, 2);

    const secondPublic = await call(env, `/api/public/map-entry-images/${id}`);
    assert.equal(
        Buffer.from(await secondPublic.arrayBuffer()).toString().endsWith("seconda-immagine"),
        true
    );
});

test("mantiene il blob D1 come ripiego quando il binding R2 non è disponibile", async () => {
    const env = environment(false);
    const created = await call(env, "/api/admin/map-entries", {
        admin: true,
        method: "POST",
        body: mapEntry(image("ripiego.png", "ripiego-d1"))
    });
    const createdBody = await created.json();
    assert.equal(created.status, 201);
    const id = createdBody.entry.id;

    assert.notEqual(env.DB.database.prepare(`
        SELECT media_data FROM map_entry_images WHERE entry_id = ?
    `).get(id).media_data, "");
    const response = await call(env, `/api/public/map-entry-images/${id}`);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("x-media-storage"), "d1");
    assert.equal(
        Buffer.from(await response.arrayBuffer()).toString().endsWith("ripiego-d1"),
        true
    );
});

test("serve da R2 le fotografie delle Voci mantenendo alt e didascalia in D1", async () => {
    const env = environment();
    const imageId = "123e4567-e89b-42d3-a456-426614174000";
    const photo = {
        id: imageId,
        ...image("voce.png", "foto-voce"),
        alt: "Descrizione accessibile",
        caption: "Didascalia documentata"
    };
    const created = await call(env, "/api/admin/wiki", {
        admin: true,
        method: "POST",
        body: {
            title: "Voce con foto",
            slug: "voce-con-foto",
            summary: "Sommario",
            body: `Testo.\n\n[foto:${imageId}]`,
            status: "published",
            images: [photo]
        }
    });
    assert.equal(created.status, 201);
    const database = env.DB.database;
    const stored = database.prepare(`
        SELECT media_data, alt_text, caption
        FROM wiki_entry_images WHERE id = ?
    `).get(imageId);
    assert.deepEqual({ ...stored }, {
        media_data: "",
        alt_text: "Descrizione accessibile",
        caption: "Didascalia documentata"
    });
    assert.equal(database.prepare(`
        SELECT COUNT(*) AS total FROM media_assets
        WHERE owner_type = 'wiki_image' AND owner_id = ? AND state = 'current'
    `).get(imageId).total, 1);

    const response = await call(env, `/api/public/wiki-images/${imageId}`);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("x-media-storage"), "r2");
    assert.equal(
        Buffer.from(await response.arrayBuffer()).toString().endsWith("foto-voce"),
        true
    );
});

test("il ritiro di una memoria elimina originale R2 e metadati", async () => {
    const env = environment();
    const created = await call(env, "/api/memories", {
        method: "POST",
        body: {
            title: "Memoria con foto",
            authorName: "",
            text: "Testo della memoria.",
            lat: 45.55,
            lon: 12.31,
            consent: true,
            media: image("memoria.png", "foto-memoria")
        }
    });
    const data = await created.json();
    assert.equal(created.status, 201);
    assert.equal(env.MEDIA.objects.size, 1);
    assert.equal(env.DB.database.prepare(`
        SELECT media_data FROM memories WHERE id = ?
    `).get(data.id).media_data, null);

    const privateMedia = await call(env, `/api/memories/${data.id}/media`, {
        admin: true
    });
    assert.equal(privateMedia.status, 200);
    assert.equal(privateMedia.headers.get("x-media-storage"), "r2");
    assert.equal(
        Buffer.from(await privateMedia.arrayBuffer()).toString().endsWith("foto-memoria"),
        true
    );

    const withdrawn = await call(env, `/api/memories/${data.id}`, {
        method: "DELETE",
        memoryToken: data.withdrawalToken
    });
    assert.equal(withdrawn.status, 200);
    assert.equal(env.MEDIA.objects.size, 0);
    assert.equal(env.DB.database.prepare(`
        SELECT COUNT(*) AS total FROM media_assets
        WHERE owner_type = 'memory' AND owner_id = ?
    `).get(String(data.id)).total, 0);
    assert.equal(env.DB.database.prepare(`
        SELECT COUNT(*) AS total FROM memories WHERE id = ?
    `).get(data.id).total, 0);
});
