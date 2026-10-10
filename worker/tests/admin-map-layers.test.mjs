import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

import worker from "../src/index.js";
import { MAP_LAYER_SEEDS } from "../src/map-seed.js";

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
        return {
            results: this.database.prepare(this.sql).all(...this.values)
        };
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
            for (const statement of statements) {
                results.push(await statement.run());
            }
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
    if (options.admin) {
        headers.set("X-Admin-Token", env.ADMIN_TOKEN);
    }
    if (options.body) {
        headers.set("Content-Type", "application/json");
    }
    const response = await worker.fetch(new Request(
        `https://worker.test${path}`,
        {
            method: options.method || "GET",
            headers,
            body: options.body ? JSON.stringify(options.body) : undefined
        }
    ), env, {});
    return { response, data: await response.json() };
}

function layerUpdate(layer, overrides = {}) {
    return {
        title: layer.title,
        description: layer.description,
        style: layer.style,
        status: layer.status,
        expectedUpdatedAt: layer.updatedAt,
        ...overrides
    };
}

test("elenca solo all’amministratore i livelli e le sette geometrie archiviate", async () => {
    const env = environment();
    const unauthorized = await call(env, "/api/admin/cms/map-layers");
    const authorized = await call(env, "/api/admin/cms/map-layers", {
        admin: true
    });

    assert.equal(unauthorized.response.status, 401);
    assert.equal(authorized.response.status, 200);
    assert.equal(authorized.data.layers.length, MAP_LAYER_SEEDS.length);
    const features = authorized.data.layers.flatMap((layer) => layer.features);
    assert.equal(features.length, 7);
    assert.ok(features.every((feature) => feature.status === "archived"));
    assert.ok(features.every((feature) => feature.geometry === null));
});

test("aggiorna un livello senza ripubblicare le geometrie ritirate", async () => {
    const env = environment();
    const initial = await call(env, "/api/admin/cms/map-layers", {
        admin: true
    });
    const layer = initial.data.layers.find(
        (item) => item.id === "map-layer-significant-landscapes"
    );
    const updated = await call(
        env,
        `/api/admin/cms/map-layers/${layer.id}`,
        {
            admin: true,
            method: "PATCH",
            body: layerUpdate(layer, {
                title: "Paesaggi significativi di Marcon",
                style: { ...layer.style, weight: 4 }
            })
        }
    );

    assert.equal(updated.response.status, 200);
    assert.equal(updated.data.layer.title, "Paesaggi significativi di Marcon");
    assert.equal(updated.data.layer.slug, layer.slug);
    assert.ok(updated.data.layer.features.every(
        (feature) => feature.status === "archived" && feature.geometry === null
    ));
    assert.equal(env.DB.database.prepare(`
        SELECT COUNT(*) AS total FROM content_revisions
        WHERE entity_type = 'map_layer'
            AND entity_id = 'map-layer-significant-landscapes'
    `).get().total, 2);
    const snapshot = JSON.parse(env.DB.database.prepare(`
        SELECT snapshot_json FROM content_revisions
        WHERE entity_type = 'map_layer'
            AND entity_id = 'map-layer-significant-landscapes'
            AND revision_number = 2
    `).get().snapshot_json);
    assert.equal(snapshot.features.length, 5);
    assert.ok(snapshot.features.every(
        (feature) => feature.status === "archived" && feature.geometry === null
    ));

    const stale = await call(
        env,
        `/api/admin/cms/map-layers/${layer.id}`,
        {
            admin: true,
            method: "PATCH",
            body: layerUpdate(layer, { title: "Sovrascrittura" })
        }
    );
    assert.equal(stale.response.status, 409);
});

test("crea e pubblica una nuova feature senza alterare i sette archivi", async () => {
    const env = environment();
    const created = await call(env, "/api/admin/cms/map-features", {
        admin: true,
        method: "POST",
        body: {
            layerId: "map-layer-relevant-places",
            position: 1,
            title: "Nuovo luogo",
            description: "Feature aggiunta dal pannello.",
            geometry: { type: "Point", coordinates: [12.3, 45.55] },
            properties: { categoria: "luogo", riferimento: "test" },
            status: "published"
        }
    });

    assert.equal(created.response.status, 201);
    assert.match(created.data.feature.id, /^map-feature-[0-9a-f-]{36}$/u);
    assert.equal(env.DB.database.prepare(`
        SELECT COUNT(*) AS total FROM map_features WHERE status = 'archived'
    `).get().total, 7);
    assert.equal(env.DB.database.prepare(`
        SELECT COUNT(*) AS total FROM content_revisions
        WHERE entity_type = 'map_feature' AND entity_id = ?
    `).get(created.data.feature.id).total, 1);

    const publicLayer = await call(
        env,
        "/api/public/map-layers/luoghi-rilevanti"
    );
    assert.equal(publicLayer.response.status, 200);
    assert.equal(publicLayer.data.geojson.features.length, 1);
    assert.equal(publicLayer.data.geojson.features[0].id, created.data.feature.id);
    assert.deepEqual(publicLayer.data.geojson.features[0].geometry, {
        type: "Point",
        coordinates: [12.3, 45.55]
    });

    const archived = await call(
        env,
        `/api/admin/cms/map-features/${created.data.feature.id}`,
        {
            admin: true,
            method: "PATCH",
            body: {
                layerId: created.data.feature.layerId,
                position: created.data.feature.position,
                title: "Nuovo luogo aggiornato",
                description: created.data.feature.description,
                geometry: created.data.feature.geometry,
                properties: created.data.feature.properties,
                status: "archived",
                expectedUpdatedAt: created.data.feature.updatedAt
            }
        }
    );
    assert.equal(archived.response.status, 200);
    assert.equal(archived.data.feature.status, "archived");
    assert.equal(env.DB.database.prepare(`
        SELECT COUNT(*) AS total FROM content_revisions
        WHERE entity_type = 'map_feature' AND entity_id = ?
    `).get(created.data.feature.id).total, 2);
    const afterArchive = await call(
        env,
        "/api/public/map-layers/luoghi-rilevanti"
    );
    assert.equal(afterArchive.data.geojson.features.length, 0);

    const stale = await call(
        env,
        `/api/admin/cms/map-features/${created.data.feature.id}`,
        {
            admin: true,
            method: "PATCH",
            body: {
                layerId: created.data.feature.layerId,
                position: created.data.feature.position,
                title: "Sovrascrittura",
                description: created.data.feature.description,
                geometry: created.data.feature.geometry,
                properties: created.data.feature.properties,
                status: "published",
                expectedUpdatedAt: created.data.feature.updatedAt
            }
        }
    );
    assert.equal(stale.response.status, 409);
});

test("impedisce pubblicazione senza coordinate, collisioni e cancellazioni", async () => {
    const env = environment();
    const missingGeometry = await call(env, "/api/admin/cms/map-features", {
        admin: true,
        method: "POST",
        body: {
            layerId: "map-layer-relevant-places",
            position: 1,
            title: "Senza coordinate",
            description: "",
            geometry: null,
            properties: {},
            status: "published"
        }
    });
    assert.equal(missingGeometry.response.status, 400);

    const firstDraft = await call(env, "/api/admin/cms/map-features", {
        admin: true,
        method: "POST",
        body: {
            layerId: "map-layer-relevant-places",
            position: 1,
            title: "Prima bozza",
            description: "",
            geometry: null,
            properties: {},
            status: "draft"
        }
    });
    assert.equal(firstDraft.response.status, 201);
    const collision = await call(env, "/api/admin/cms/map-features", {
        admin: true,
        method: "POST",
        body: {
            layerId: "map-layer-relevant-places",
            position: 1,
            title: "Posizione duplicata",
            description: "",
            geometry: null,
            properties: {},
            status: "draft"
        }
    });
    assert.equal(collision.response.status, 409);

    const deletion = await call(
        env,
        `/api/admin/cms/map-features/${firstDraft.data.feature.id}`,
        { admin: true, method: "DELETE" }
    );
    assert.equal(deletion.response.status, 404);
    assert.equal(env.DB.database.prepare(`
        SELECT COUNT(*) AS total FROM map_features WHERE id = ?
    `).get(firstDraft.data.feature.id).total, 1);
});

test("il pannello espone editor separati per livelli e geometrie", async () => {
    const [html, source] = await Promise.all([
        readFile(new URL("../../admin.html", import.meta.url), "utf8"),
        readFile(new URL("../../admin.js", import.meta.url), "utf8")
    ]);

    for (const id of [
        "adminMapLayerForm",
        "adminMapLayerSelect",
        "adminMapLayerStyle",
        "adminMapLayerSubmit",
        "adminMapFeatureForm",
        "adminMapFeatureSelect",
        "adminMapFeatureLayer",
        "adminMapFeatureGeometry",
        "adminMapFeatureProperties",
        "adminMapFeatureSubmit"
    ]) {
        assert.match(html, new RegExp(`id="${id}"`, "u"), id);
    }

    assert.match(source, /\/api\/admin\/cms\/map-layers/u);
    assert.match(source, /\/api\/admin\/cms\/map-features/u);
    assert.doesNotMatch(source, /method:\s*"DELETE"[\s\S]{0,160}cms\/map-features/u);
    assert.match(
        html,
        /<script src="\.\/admin\.js\?v=20261011-maintenance1"><\/script>/u
    );
});
