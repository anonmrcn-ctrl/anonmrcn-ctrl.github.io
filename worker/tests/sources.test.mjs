import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

import worker from "../src/index.js";
import { NARRATIVE_STEP_SEEDS } from "../src/narrative-seed.js";
import { SHARED_SOURCE_SEEDS } from "../src/source-seed.js";

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
    const response = await worker.fetch(new Request(`https://worker.test${path}`, {
        headers: { Origin: env.ALLOWED_ORIGIN }
    }), env, {});
    return { response, data: await response.json() };
}

test("deduplica le diciassette fonti del percorso e conserva ordine e termini", async () => {
    const env = createEnvironment();
    const initial = await request(
        env,
        "/api/public/sources?contentType=narrative_step&contentId=zero"
    );

    assert.equal(initial.response.status, 200);
    assert.deepEqual(
        initial.data.sources.map((source) => source.url),
        NARRATIVE_STEP_SEEDS.find((step) => step.key === "zero")
            .sources.map((source) => source.url)
    );
    assert.deepEqual(initial.data.sources[0].context.terms, ["Zero"]);

    const seededIds = env.DB.database.prepare(`
        SELECT id FROM sources WHERE id LIKE 'source-%'
    `).all().map((row) => row.id);
    for (const source of SHARED_SOURCE_SEEDS) {
        assert.ok(seededIds.includes(source.id), source.id);
    }
    assert.equal(
        env.DB.database.prepare(`
            SELECT COUNT(*) AS total
            FROM content_initializations
            WHERE name = 'shared_sources_v1'
        `).get().total,
        1
    );

    await request(
        env,
        "/api/public/sources?contentType=narrative_step&contentId=zero"
    );
    assert.equal(
        env.DB.database.prepare(`
            SELECT COUNT(*) AS total
            FROM content_initializations
            WHERE name = 'shared_sources_v1'
        `).get().total,
        1
    );
});

test("unifica URL di Voci e luoghi senza alterare citazioni o campi originali", async () => {
    const env = createEnvironment();
    await request(env, "/api/public/wiki");
    await request(env, "/api/public/map-entries");
    const now = Date.now();
    const url = "https://it.wikipedia.org/wiki/Marcon";
    const token =
        "[fonte:https%3A%2F%2Fit.wikipedia.org%2Fwiki%2FMarcon|" +
        "Etichetta%20locale|Autore%20locale|2026]";
    const body = `${token}\nTesto. ${token}`;

    env.DB.database.prepare(`
        INSERT INTO wiki_entries (
            id, slug, title, summary, body, status,
            created_at, updated_at, published_at
        ) VALUES (1, 'voce-test', 'Voce test', '', ?, 'published', ?, ?, ?)
    `).run(body, now, now, now);
    env.DB.database.prepare(`
        INSERT INTO wiki_entries (
            id, slug, title, summary, body, status,
            created_at, updated_at, published_at
        ) VALUES (2, 'bozza-test', 'Bozza test', '', ?, 'draft', ?, ?, NULL)
    `).run(token, now, now);
    env.DB.database.prepare(`
        INSERT INTO map_entries (
            id, name, category, description, lat, lon,
            source_url, source_label, created_at, updated_at
        ) VALUES (
            1, 'Luogo test', 'luogo', '', 45.5, 12.3,
            ?, 'Etichetta mappa', ?, ?
        )
    `).run(url, now, now);

    const wiki = await request(
        env,
        "/api/public/sources?contentType=wiki_entry&contentId=1"
    );
    const map = await request(
        env,
        "/api/public/sources?contentType=map_entry&contentId=1"
    );
    const draft = await request(
        env,
        "/api/public/sources?contentType=wiki_entry&contentId=2"
    );

    assert.equal(wiki.response.status, 200);
    assert.equal(wiki.data.sources.length, 1);
    assert.equal(wiki.data.sources[0].id, "source-marcon-wikipedia");
    assert.equal(wiki.data.sources[0].context.title, "Etichetta locale");
    assert.equal(wiki.data.sources[0].context.occurrences, 2);
    assert.equal(map.data.sources[0].id, "source-marcon-wikipedia");
    assert.equal(map.data.sources[0].context.label, "Etichetta mappa");
    assert.equal(draft.response.status, 404);
    assert.equal(
        env.DB.database.prepare(
            "SELECT COUNT(*) AS total FROM sources WHERE url = ?"
        ).get(url).total,
        1
    );
    assert.equal(
        env.DB.database.prepare(
            "SELECT body FROM wiki_entries WHERE id = 1"
        ).get().body,
        body
    );
    const originalMapSource = env.DB.database.prepare(`
        SELECT source_url, source_label FROM map_entries WHERE id = 1
    `).get();
    assert.equal(originalMapSource.source_url, url);
    assert.equal(originalMapSource.source_label, "Etichetta mappa");
});

test("il catalogo statico copre ogni URL usato dal percorso poetico", () => {
    const expected = new Set(
        NARRATIVE_STEP_SEEDS.flatMap((step) =>
            step.sources.map((source) => source.url)
        )
    );
    const actual = new Set(SHARED_SOURCE_SEEDS.map((source) => source.url));

    assert.deepEqual(actual, expected);
    assert.equal(actual.size, SHARED_SOURCE_SEEDS.length);
});
