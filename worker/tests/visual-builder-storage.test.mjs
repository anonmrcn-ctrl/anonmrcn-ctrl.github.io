import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

import { CMS_STORAGE_STATEMENTS } from "../src/cms-schema.js";
import { PAGE_SEEDS } from "../src/page-seed.js";
import {
    initializeVisualBuilderContent,
    VISUAL_BLOCK_TYPES,
    VISUAL_PROPERTY_SETS
} from "../src/visual-builder-storage.js";

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
        return { success: true, meta: { changes: result.changes } };
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

function count(database, table) {
    return database.prepare(`SELECT COUNT(*) AS total FROM ${table}`).get().total;
}

function seedLegacyPages(database) {
    const now = 1_760_000_000_000;
    for (const page of PAGE_SEEDS) {
        database.prepare(`
            INSERT INTO site_pages (
                id, slug, title, description, status,
                created_at, updated_at, published_at
            ) VALUES (?, ?, ?, ?, 'published', ?, ?, ?)
        `).run(page.id, page.slug, page.title, page.description, now, now, now);
        for (const block of page.blocks) {
            database.prepare(`
                INSERT INTO page_blocks (
                    id, page_id, position, block_type, content_json,
                    created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?)
            `).run(
                block.id,
                page.id,
                block.position,
                block.type,
                JSON.stringify(block.content),
                now,
                now
            );
        }
        database.prepare(`
            INSERT INTO content_revisions (
                entity_type, entity_id, revision_number, snapshot_json,
                publication_state, created_at
            ) VALUES ('page', ?, 1, ?, 'published', ?)
        `).run(page.id, JSON.stringify(page), now);
    }
}

test("lo schema runtime coincide con il contratto dei blocchi v1", async () => {
    const contract = JSON.parse(await readFile(
        new URL("../../docs/cms/block-contract.json", import.meta.url),
        "utf8"
    ));
    assert.deepEqual(
        [...VISUAL_BLOCK_TYPES].sort(),
        contract.blockTypes.map((block) => block.id).sort()
    );
    assert.deepEqual(
        [...VISUAL_PROPERTY_SETS].sort(),
        Object.keys(contract.propertySets).sort()
    );
    assert.equal(contract.compatibleContentSchema, 5);
});

test("importa pagine e blocchi in alberi normalizzati con ID stabili", async () => {
    const db = new D1DatabaseMock();
    db.database.exec(`${CMS_STORAGE_STATEMENTS.join(";\n")}\n;`);
    seedLegacyPages(db.database);
    const expectedBlocks = PAGE_SEEDS.reduce((total, page) => total + page.blocks.length, 0);
    const legacyPages = db.database.prepare("SELECT * FROM site_pages ORDER BY id").all();
    const legacyBlocks = db.database.prepare("SELECT * FROM page_blocks ORDER BY id").all();
    const legacyRevisions = db.database.prepare("SELECT * FROM content_revisions ORDER BY id").all();

    await initializeVisualBuilderContent({ DB: db });
    await initializeVisualBuilderContent({ DB: db });

    assert.equal(count(db.database, "visual_themes"), 1);
    assert.equal(count(db.database, "visual_trees"), PAGE_SEEDS.length);
    assert.equal(count(db.database, "visual_page_trees"), PAGE_SEEDS.length);
    assert.equal(count(db.database, "visual_nodes"), PAGE_SEEDS.length + expectedBlocks);
    assert.equal(count(db.database, "visual_node_properties"), (PAGE_SEEDS.length * 2) + expectedBlocks);
    assert.equal(count(db.database, "content_initializations"), 1);
    assert.deepEqual(
        db.database.prepare(`
            SELECT id FROM visual_nodes WHERE parent_id IS NOT NULL ORDER BY id
        `).all().map((row) => row.id),
        legacyBlocks.map((row) => row.id),
        "gli ID dei blocchi pubblicati non cambiano"
    );
    assert.deepEqual(db.database.prepare("SELECT * FROM site_pages ORDER BY id").all(), legacyPages);
    assert.deepEqual(db.database.prepare("SELECT * FROM page_blocks ORDER BY id").all(), legacyBlocks);
    assert.deepEqual(
        db.database.prepare("SELECT * FROM content_revisions ORDER BY id").all(),
        legacyRevisions,
        "l'importazione non riscrive la cronologia"
    );
    const projectTree = db.database.prepare(`
        SELECT page_id, tree_id, theme_id FROM visual_page_trees
        WHERE page_id = 'page-progetto'
    `).get();
    assert.deepEqual({ ...projectTree }, {
        page_id: "page-progetto",
        tree_id: "visual-tree-page-progetto",
        theme_id: "theme-default"
    });
    assert.equal(db.database.prepare(`
        SELECT text_value FROM visual_node_properties
        WHERE node_id = 'progetto-map-intro'
            AND property_set = 'content.copy' AND property_name = 'text'
    `).get().text_value, PAGE_SEEDS[0].blocks[1].content.text);
});

test("lo schema tipizzato valida annidamento, responsive e riferimenti R2", () => {
    const database = new DatabaseSync(":memory:");
    database.exec("PRAGMA foreign_keys = ON");
    database.exec(`${CMS_STORAGE_STATEMENTS.join(";\n")}\n;`);
    const now = Date.now();
    database.prepare(`
        INSERT INTO site_pages (id, slug, title, status, created_at, updated_at)
        VALUES ('page-test', 'test', 'Test', 'draft', ?, ?)
    `).run(now, now);
    database.prepare(`
        INSERT INTO visual_themes (id, name, status, created_at, updated_at)
        VALUES ('theme-test', 'Tema test', 'draft', ?, ?)
    `).run(now, now);
    database.prepare(`
        INSERT INTO visual_trees (id, status, created_at, updated_at)
        VALUES ('tree-test', 'draft', ?, ?)
    `).run(now, now);
    database.prepare(`
        INSERT INTO visual_page_trees (page_id, tree_id, theme_id, created_at, updated_at)
        VALUES ('page-test', 'tree-test', 'theme-test', ?, ?)
    `).run(now, now);
    database.prepare(`
        INSERT INTO visual_nodes (
            id, tree_id, parent_id, position, block_type, created_at, updated_at
        ) VALUES ('root-test', 'tree-test', NULL, 1, 'page-root', ?, ?)
    `).run(now, now);
    database.prepare(`
        INSERT INTO visual_nodes (
            id, tree_id, parent_id, position, block_type, created_at, updated_at
        ) VALUES ('image-test', 'tree-test', 'root-test', 1, 'image', ?, ?)
    `).run(now, now);
    database.prepare(`
        INSERT INTO media_assets (
            id, owner_type, owner_id, object_key, media_type, byte_size,
            checksum, created_at, updated_at
        ) VALUES ('asset-test', 'wiki_image', 'wiki-1', 'wiki/test.webp',
            'image/webp', 10, ?, ?, ?)
    `).run("a".repeat(64), now, now);
    database.prepare(`
        INSERT INTO visual_node_properties (
            node_id, domain, property_set, property_name, value_kind,
            asset_id, created_at, updated_at
        ) VALUES ('image-test', 'content', 'content.media', 'assetId',
            'asset', 'asset-test', ?, ?)
    `).run(now, now);
    database.prepare(`
        INSERT INTO visual_node_properties (
            node_id, domain, property_set, property_name, breakpoint,
            value_kind, text_value, created_at, updated_at
        ) VALUES ('image-test', 'presentation', 'presentation.responsive',
            'width', 'phone', 'length', '100%', ?, ?)
    `).run(now, now);

    assert.throws(() => database.prepare(`
        INSERT INTO visual_nodes (
            id, tree_id, parent_id, position, block_type, created_at, updated_at
        ) VALUES ('second-root', 'tree-test', NULL, 2, 'page-root', ?, ?)
    `).run(now, now), /UNIQUE constraint failed/u);
    assert.throws(() => database.prepare(`
        INSERT INTO visual_nodes (
            id, tree_id, parent_id, position, block_type, created_at, updated_at
        ) VALUES ('script-test', 'tree-test', 'root-test', 2, 'script', ?, ?)
    `).run(now, now), /CHECK constraint failed/u);
    assert.throws(() => database.prepare(`
        INSERT INTO visual_node_properties (
            node_id, domain, property_set, property_name, value_kind,
            text_value, created_at, updated_at
        ) VALUES ('image-test', 'technical', 'content.copy', 'secret',
            'text', 'no', ?, ?)
    `).run(now, now), /CHECK constraint failed/u);
    assert.throws(() => database.prepare(`
        INSERT INTO visual_node_properties (
            node_id, domain, property_set, property_name, value_kind,
            text_value, asset_id, created_at, updated_at
        ) VALUES ('image-test', 'content', 'content.media', 'invalid',
            'asset', 'testo', 'asset-test', ?, ?)
    `).run(now, now), /CHECK constraint failed/u);
});

test("la migrazione 0019 è append-only e coincide con lo schema runtime", async () => {
    const database = new DatabaseSync(":memory:");
    database.exec("PRAGMA foreign_keys = ON");
    database.exec(`
        CREATE TABLE site_pages (id TEXT PRIMARY KEY);
        CREATE TABLE media_assets (id TEXT PRIMARY KEY);
        CREATE TABLE page_blocks (id TEXT PRIMARY KEY, content_json TEXT);
        CREATE TABLE content_revisions (id INTEGER PRIMARY KEY, snapshot_json TEXT);
        INSERT INTO site_pages VALUES ('page-preserved');
        INSERT INTO page_blocks VALUES ('block-preserved', '{"text":"intatto"}');
        INSERT INTO content_revisions VALUES (1, '{"title":"intatto"}');
    `);
    const migration = await readFile(
        new URL("../migrations/0019_visual_builder_schema.sql", import.meta.url),
        "utf8"
    );
    database.exec(migration);
    assert.deepEqual({ ...database.prepare("SELECT * FROM site_pages").get() }, {
        id: "page-preserved"
    });
    assert.deepEqual({ ...database.prepare("SELECT * FROM page_blocks").get() }, {
        id: "block-preserved",
        content_json: "{\"text\":\"intatto\"}"
    });
    assert.deepEqual({ ...database.prepare("SELECT * FROM content_revisions").get() }, {
        id: 1,
        snapshot_json: "{\"title\":\"intatto\"}"
    });
    for (const table of [
        "visual_themes", "visual_theme_tokens", "visual_trees",
        "visual_page_trees", "visual_nodes", "visual_node_properties",
        "visual_reusable_sections"
    ]) {
        assert.ok(database.prepare(`
            SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?
        `).get(table));
    }
});
