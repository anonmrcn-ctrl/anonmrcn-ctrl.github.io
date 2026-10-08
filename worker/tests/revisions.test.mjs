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

async function initialize(env) {
    const response = await worker.fetch(new Request(
        "https://worker.test/api/public/settings/site",
        { headers: { Origin: env.ALLOWED_ORIGIN } }
    ), env, {});
    assert.equal(response.status, 200);
}

function count(database, table, where = "") {
    return database.prepare(
        `SELECT COUNT(*) AS total FROM ${table} ${where}`
    ).get().total;
}

test("crea la revisione uno di ogni contenuto importato", async () => {
    const env = createEnvironment();
    await initialize(env);
    const database = env.DB.database;
    const expectations = {
        site_page: count(database, "site_pages"),
        page_block: count(database, "page_blocks"),
        poem_work: count(database, "poem_works"),
        poem_section: count(database, "poem_sections"),
        poem_line: count(database, "poem_lines"),
        navigation_item: count(database, "navigation_items"),
        onboarding_step: count(database, "onboarding_steps"),
        site_setting: count(
            database,
            "site_settings",
            "WHERE setting_key LIKE 'site.%' OR setting_key LIKE 'onboarding.%'"
        ),
        map_layer: count(database, "map_layers"),
        map_feature: count(database, "map_features"),
        source: count(database, "sources"),
        narrative_step: count(database, "narrative_steps")
    };
    const revisions = database.prepare(`
        SELECT entity_type, COUNT(*) AS total
        FROM content_revisions
        GROUP BY entity_type
    `).all();
    const actual = Object.fromEntries(
        revisions.map((row) => [row.entity_type, row.total])
    );

    assert.deepEqual(actual, expectations);
    assert.equal(
        count(database, "content_revisions"),
        Object.values(expectations).reduce((sum, value) => sum + value, 0)
    );
    assert.equal(
        count(database, "content_revisions", "WHERE revision_number <> 1"),
        0
    );
    assert.equal(
        count(
            database,
            "content_initializations",
            "WHERE name = 'content_revisions_v1'"
        ),
        1
    );
});

test("le fotografie iniziali includono struttura e stato senza perdere figli", async () => {
    const env = createEnvironment();
    await initialize(env);
    const database = env.DB.database;
    const project = JSON.parse(database.prepare(`
        SELECT snapshot_json FROM content_revisions
        WHERE entity_type = 'site_page' AND entity_id = 'page-progetto'
    `).get().snapshot_json);
    const poem = JSON.parse(database.prepare(`
        SELECT snapshot_json FROM content_revisions
        WHERE entity_type = 'poem_work' AND entity_id = 'poem-il-gajo-tra-i-praelli'
    `).get().snapshot_json);
    const mapLayers = database.prepare(`
        SELECT snapshot_json FROM content_revisions
        WHERE entity_type = 'map_layer'
    `).all().map((row) => JSON.parse(row.snapshot_json));

    assert.equal(
        project.blocks.length,
        count(database, "page_blocks", "WHERE page_id = 'page-progetto'")
    );
    assert.equal(poem.sections.length, 4);
    assert.equal(
        poem.sections.flatMap((section) => section.lines).length,
        121
    );
    assert.equal(
        mapLayers.flatMap((layer) => layer.features).length,
        7
    );
    assert.equal(
        count(
            database,
            "content_revisions",
            "WHERE entity_type = 'map_feature' AND publication_state = 'archived'"
        ),
        7
    );
});

test("la revisione iniziale è idempotente e non segue modifiche successive", async () => {
    const env = createEnvironment();
    await initialize(env);
    const database = env.DB.database;
    const before = count(database, "content_revisions");
    const original = database.prepare(`
        SELECT snapshot_json FROM content_revisions
        WHERE entity_type = 'site_page' AND entity_id = 'page-progetto'
    `).get().snapshot_json;

    database.prepare(`
        UPDATE site_pages SET title = 'Titolo modificato'
        WHERE id = 'page-progetto'
    `).run();
    await initialize(env);

    assert.equal(count(database, "content_revisions"), before);
    assert.equal(database.prepare(`
        SELECT snapshot_json FROM content_revisions
        WHERE entity_type = 'site_page' AND entity_id = 'page-progetto'
    `).get().snapshot_json, original);
    assert.throws(() => database.prepare(`
        UPDATE content_revisions SET snapshot_json = '{}'
        WHERE entity_type = 'site_page' AND entity_id = 'page-progetto'
    `).run(), /content revisions are immutable/u);
    assert.throws(() => database.prepare(`
        DELETE FROM content_revisions
        WHERE entity_type = 'site_page' AND entity_id = 'page-progetto'
    `).run(), /content revisions are immutable/u);
});
