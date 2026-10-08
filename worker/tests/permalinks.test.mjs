import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

import worker from "../src/index.js";
import {
    POEM_SECTION_PERMALINK_SEEDS,
    STATIC_PERMALINK_SEEDS
} from "../src/permalink-seed.js";
import { NARRATIVE_STEP_SEEDS } from "../src/narrative-seed.js";

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

async function request(env, path) {
    return worker.fetch(new Request(`https://worker.test${path}`, {
        headers: { Origin: env.ALLOWED_ORIGIN }
    }), env, {});
}

async function prepareExistingContent(env) {
    await request(env, "/api/public/wiki");
    await request(env, "/api/public/map-entries");
    await request(env, "/api/public/narrative-steps");

    const now = Date.now();
    env.DB.database.prepare(`
        INSERT INTO wiki_entries (
            id, slug, title, summary, body, status,
            created_at, updated_at, published_at
        ) VALUES (41, 'voce-storica', 'Voce storica', '', '', 'published', ?, ?, ?)
    `).run(now, now, now);
    env.DB.database.prepare(`
        INSERT INTO map_entries (
            id, name, category, description, lat, lon,
            source_url, source_label, created_at, updated_at
        ) VALUES (7, 'Luogo storico', 'luogo', '', 45.55, 12.31, '', '', ?, ?)
    `).run(now, now);
}

async function initialize(env) {
    const response = await request(env, "/api/public/settings/site");
    assert.equal(response.status, 200);
}

test("registra gli indirizzi pubblicati con destinazioni e identificativi stabili", async () => {
    const env = createEnvironment();
    await prepareExistingContent(env);
    await initialize(env);
    const database = env.DB.database;
    const expectedCount =
        STATIC_PERMALINK_SEEDS.length +
        POEM_SECTION_PERMALINK_SEEDS.length +
        NARRATIVE_STEP_SEEDS.length +
        1 +
        2;

    assert.equal(
        database.prepare("SELECT COUNT(*) AS total FROM permalinks").get().total,
        expectedCount
    );
    assert.deepEqual({ ...database.prepare(`
        SELECT path, target_type, target_id, state
        FROM permalinks WHERE id = 'permalink-map-entry-qr-7'
    `).get() }, {
        path: "/luogo.html?luogo=7",
        target_type: "map_entry",
        target_id: "7",
        state: "active"
    });
    assert.deepEqual({ ...database.prepare(`
        SELECT path, target_type, target_id
        FROM permalinks WHERE id = 'permalink-wiki-entry-41'
    `).get() }, {
        path: "/voci.html#voce-storica",
        target_type: "wiki_entry",
        target_id: "41"
    });

    const narrative = NARRATIVE_STEP_SEEDS[0];
    assert.deepEqual({ ...database.prepare(`
        SELECT path, target_type, target_id
        FROM permalinks WHERE id = ?
    `).get(`permalink-narrative-${narrative.key}`) }, {
        path:
            `/progetto.html?narrative=${narrative.key}` +
            `&lat=${narrative.lat}&lon=${narrative.lon}&zoom=${narrative.zoom}`,
        target_type: "narrative_step",
        target_id: narrative.key
    });
});

test("risolve esattamente query e frammenti senza registrare segreti QR", async () => {
    const env = createEnvironment();
    await prepareExistingContent(env);
    await initialize(env);

    const path = "/progetto.html?luogo=7#map";
    const response = await request(
        env,
        `/api/public/permalinks/resolve?path=${encodeURIComponent(path)}`
    );
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.permalink.path, path);
    assert.equal(body.permalink.targetType, "map_entry");
    assert.equal(body.permalink.targetId, "7");
    assert.equal(body.permalink.state, "active");

    const paths = env.DB.database.prepare(
        "SELECT path FROM permalinks ORDER BY path"
    ).all().map((row) => row.path);
    assert.equal(paths.some((value) => /(?:chiave|token|password)=/iu.test(value)), false);
    assert.ok(paths.includes("/accesso.html"));
    assert.ok(paths.includes("/index.html#I"));
    assert.ok(paths.includes("/#I"));

    const missing = await request(
        env,
        "/api/public/permalinks/resolve?path=%2Fnon-esiste"
    );
    assert.equal(missing.status, 404);
    const invalid = await request(
        env,
        "/api/public/permalinks/resolve?path=https%3A%2F%2Fexample.com"
    );
    assert.equal(invalid.status, 400);
});

test("l'inventario iniziale è idempotente e i percorsi non sono riscrivibili", async () => {
    const env = createEnvironment();
    await prepareExistingContent(env);
    await initialize(env);
    const database = env.DB.database;
    const before = database.prepare(
        "SELECT COUNT(*) AS total FROM permalinks"
    ).get().total;

    await initialize(env);

    assert.equal(
        database.prepare("SELECT COUNT(*) AS total FROM permalinks").get().total,
        before
    );
    assert.equal(database.prepare(`
        SELECT COUNT(*) AS total FROM content_initializations
        WHERE name = 'permalinks_v1'
    `).get().total, 1);
    assert.throws(() => database.prepare(`
        UPDATE permalinks SET path = '/indirizzo-nuovo'
        WHERE id = 'permalink-map-entry-qr-7'
    `).run(), /permalink paths are immutable/u);
});
