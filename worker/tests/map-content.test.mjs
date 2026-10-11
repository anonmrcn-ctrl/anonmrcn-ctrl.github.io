import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import vm from "node:vm";

import worker from "../src/index.js";
import { MAP_LAYER_SEEDS } from "../src/map-seed.js";

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

function createEnvironment() {
    return {
        DB: new D1DatabaseMock(),
        ALLOWED_ORIGIN: "https://anonmrcn-ctrl.github.io"
    };
}

async function call(env, slug = "percorsi") {
    const request = new Request(
        `https://worker.test/api/public/map-layers/${slug}`,
        { headers: { Origin: env.ALLOWED_ORIGIN } }
    );
    const response = await worker.fetch(request, env, {});
    return { response, data: await response.json() };
}

test("importa una sola volta quattro livelli senza ripristinare geometrie rimosse", async () => {
    const env = createEnvironment();
    const initial = await call(env);

    assert.equal(initial.response.status, 200);
    assert.equal(initial.data.layer.id, "map-layer-cycle-routes");
    assert.deepEqual(initial.data.geojson.features, []);

    for (const layer of MAP_LAYER_SEEDS) {
        const source = JSON.parse(await readFile(
            new URL(`../../${layer.sourcePath.slice(2)}`, import.meta.url),
            "utf8"
        ));
        assert.equal(source.type, "FeatureCollection");
        assert.equal(source.features.length, 0, layer.sourcePath);
    }

    await call(env, "luoghi-significativi");
    assert.equal(
        env.DB.database.prepare(
            "SELECT COUNT(*) AS total FROM map_layers"
        ).get().total,
        4
    );
    assert.equal(
        env.DB.database.prepare(
            "SELECT COUNT(*) AS total FROM map_features WHERE status = 'archived'"
        ).get().total,
        7
    );
    assert.equal(
        env.DB.database.prepare(`
            SELECT COUNT(*) AS total
            FROM content_initializations
            WHERE name = 'map_layers_v1'
        `).get().total,
        1
    );
});

test("l’API espone soltanto livelli e geometrie pubblicati", async () => {
    const env = createEnvironment();
    await call(env, "luoghi-significativi");
    env.DB.database.prepare(`
        UPDATE map_features
        SET
            geometry_json = ?,
            status = 'published',
            published_at = ?
        WHERE id = 'map-feature-river-zero'
    `).run(JSON.stringify({ type: "Point", coordinates: [12.3, 45.55] }), Date.now());

    const published = await call(env, "luoghi-significativi");
    assert.equal(published.data.geojson.features.length, 1);
    assert.equal(published.data.geojson.features[0].id, "map-feature-river-zero");
    assert.deepEqual(published.data.geojson.features[0].geometry, {
        type: "Point",
        coordinates: [12.3, 45.55]
    });
    assert.equal(
        published.data.geojson.features[0].properties.wikipedia_url,
        "https://it.wikipedia.org/wiki/Zero_(fiume)"
    );

    env.DB.database.prepare(`
        UPDATE map_layers SET status = 'draft'
        WHERE slug = 'luoghi-significativi'
    `).run();
    const hidden = await call(env, "luoghi-significativi");
    assert.equal(hidden.response.status, 404);
});

test("metadati archiviati conservano i testi e collegamenti JavaScript", async () => {
    const source = await Promise.all([
        "mappa.js",
        "percorsi.js",
        "marcon-da-sud.js",
        "cave-rilevanti.js",
        "fiumi-wikipedia.js"
    ].map((name) => readFile(new URL(`../../${name}`, import.meta.url), "utf8")));
    const legacy = source.join("\n");

    for (const layer of MAP_LAYER_SEEDS) {
        assert.match(legacy, new RegExp(escapeRegex(layer.title), "u"));

        for (const item of layer.features) {
            assert.match(legacy, new RegExp(escapeRegex(item.title), "u"));
            for (const value of Object.values(item.properties)) {
                if (typeof value === "string") {
                    assert.match(legacy, new RegExp(escapeRegex(value), "u"));
                }
            }
            for (const paragraph of item.description.split("\n\n")) {
                if (paragraph && !paragraph.startsWith("Lunghezza nel Comune")) {
                    assert.match(legacy, new RegExp(escapeRegex(paragraph), "u"));
                }
            }
        }
    }
});

function escapeRegex(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}

async function executeLoader(request) {
    const source = await readFile(
        new URL("../../map-content.js", import.meta.url),
        "utf8"
    );
    const events = [];
    const document = { documentElement: { dataset: {} } };
    const window = {
        NNMRCN_API: { request },
        dispatchEvent: (event) => events.push(event)
    };

    vm.runInNewContext(source, {
        CustomEvent: class CustomEvent {
            constructor(type, options) {
                this.type = type;
                this.detail = options.detail;
            }
        },
        document,
        window
    });
    return { document, events, window };
}

test("il client carica GeoJSON da D1 e usa il file locale in caso di errore", async () => {
    const remote = { type: "FeatureCollection", features: [] };
    const success = await executeLoader(async () => ({ geojson: remote }));
    const remoteResult = await success.window.NNMRCN_MAP_CONTENT.load(
        "./percorsi.geojson",
        async () => ({ type: "fallback" })
    );

    assert.equal(remoteResult.type, "FeatureCollection");
    assert.equal(success.document.documentElement.dataset.cmsMapSource, "d1");
    assert.equal(success.events[0].detail.slug, "percorsi");

    const failed = await executeLoader(async () => {
        throw new Error("Worker non raggiungibile");
    });
    const fallback = { type: "FeatureCollection", features: [] };
    const fallbackResult = await failed.window.NNMRCN_MAP_CONTENT.load(
        "./marcon-da-sud.geojson",
        async () => fallback
    );

    assert.equal(fallbackResult, fallback);
    assert.equal(
        failed.document.documentElement.dataset.cmsMapSource,
        "fallback"
    );
});

test("la pagina della mappa installa il caricatore D1 prima del motore", async () => {
    const html = await readFile(
        new URL("../../progetto.html", import.meta.url),
        "utf8"
    );
    const mapSource = await readFile(
        new URL("../../mappa.js", import.meta.url),
        "utf8"
    );

    assert.match(
        html,
        /<script(?: defer)? src="\.\/map-content\.js\?v=20261008-map-content1"><\/script>\s*<script(?: defer)? src="\.\/mappa\.js"><\/script>/u
    );
    assert.match(mapSource, /window\.NNMRCN_MAP_CONTENT\?\.load/u);
});
