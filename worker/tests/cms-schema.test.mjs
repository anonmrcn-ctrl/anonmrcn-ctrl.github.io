import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

import { CMS_STORAGE_STATEMENTS } from "../src/cms-schema.js";
import worker from "../src/index.js";

const EXPECTED_TABLES = Object.freeze([
    "content_revisions",
    "content_source_links",
    "legal_document_versions",
    "legal_documents",
    "map_features",
    "map_layers",
    "navigation_items",
    "onboarding_steps",
    "page_blocks",
    "permalinks",
    "poem_lines",
    "poem_sections",
    "poem_works",
    "site_pages",
    "site_settings",
    "sources"
]);

function databaseWithCmsSchema() {
    const database = new DatabaseSync(":memory:");
    database.exec("PRAGMA foreign_keys = ON");
    database.exec(`${CMS_STORAGE_STATEMENTS.join(";\n")}\n;`);
    return database;
}

function listCmsTables(database) {
    const allTables = database.prepare(`
        SELECT name
        FROM sqlite_master
        WHERE type = 'table' AND name NOT LIKE 'sqlite_%'
        ORDER BY name
    `).all().map((row) => row.name);

    return allTables.filter((name) => EXPECTED_TABLES.includes(name));
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

test("crea tutte le entità della fondazione CMS", () => {
    const database = databaseWithCmsSchema();

    assert.deepEqual(listCmsTables(database), EXPECTED_TABLES);

    const now = Date.now();
    database.prepare(`
        INSERT INTO site_pages (
            id, slug, title, status, created_at, updated_at, published_at
        ) VALUES (?, ?, ?, 'published', ?, ?, ?)
    `).run("page-project", "progetto", "Il progetto", now, now, now);
    database.prepare(`
        INSERT INTO page_blocks (
            id, page_id, position, block_type, content_json, created_at, updated_at
        ) VALUES (?, ?, 1, 'paragraph', ?, ?, ?)
    `).run(
        "page-project-introduction",
        "page-project",
        JSON.stringify({ text: "Contenuto conservato." }),
        now,
        now
    );

    database.prepare(`
        INSERT INTO poem_works (
            id, slug, title, status, created_at, updated_at
        ) VALUES ('poem-main', 'anonmrcn', 'anonMrcn', 'draft', ?, ?)
    `).run(now, now);
    database.prepare(`
        INSERT INTO poem_sections (
            id, poem_id, position, title, created_at, updated_at
        ) VALUES ('poem-main-section-1', 'poem-main', 1, 'I', ?, ?)
    `).run(now, now);
    database.prepare(`
        INSERT INTO poem_lines (
            id, section_id, position, text, created_at, updated_at
        ) VALUES ('poem-main-line-1', 'poem-main-section-1', 1, 'Primo verso', ?, ?)
    `).run(now, now);

    database.prepare(`
        INSERT INTO sources (
            id, title, created_at, updated_at
        ) VALUES ('source-1', 'Fonte di prova', ?, ?)
    `).run(now, now);
    database.prepare(`
        INSERT INTO content_source_links (
            content_type, content_id, source_id, position
        ) VALUES ('page', 'page-project', 'source-1', 1)
    `).run();

    database.prepare(`
        INSERT INTO navigation_items (
            id, menu_key, position, label, href, status, created_at, updated_at
        ) VALUES ('nav-project', 'main', 1, 'Il progetto', './progetto.html',
            'published', ?, ?)
    `).run(now, now);

    assert.throws(
        () => database.prepare(`
            INSERT INTO navigation_items (
                id, menu_key, position, label, href, status, created_at, updated_at
            ) VALUES ('nav-author', 'main', 1, 'L’autore', './autore.html',
                'published', ?, ?)
        `).run(now, now),
        /UNIQUE constraint failed/u,
        "anche le voci alla radice del menu devono avere un ordine univoco"
    );

    assert.throws(
        () => database.prepare(`
            INSERT INTO site_settings (
                setting_key, value_json, status, updated_at
            ) VALUES ('site.metadata', '{non-json}', 'draft', ?)
        `).run(now),
        /CHECK constraint failed/u,
        "i campi JSON non devono accettare dati corrotti"
    );

    assert.equal(
        database.prepare("SELECT COUNT(*) AS total FROM page_blocks").get().total,
        1
    );
    assert.equal(
        database.prepare("SELECT COUNT(*) AS total FROM poem_lines").get().total,
        1
    );

    database.prepare("DELETE FROM site_pages WHERE id = 'page-project'").run();
    database.prepare("DELETE FROM poem_works WHERE id = 'poem-main'").run();

    assert.equal(
        database.prepare("SELECT COUNT(*) AS total FROM page_blocks").get().total,
        0,
        "i blocchi seguono la pagina senza lasciare record orfani"
    );
    assert.equal(
        database.prepare("SELECT COUNT(*) AS total FROM poem_lines").get().total,
        0,
        "sezioni e versi seguono l’opera senza lasciare record orfani"
    );
});

test("protegge revisioni, versioni legali pubblicate e percorsi permanenti", () => {
    const database = databaseWithCmsSchema();
    const now = Date.now();

    database.prepare(`
        INSERT INTO content_revisions (
            entity_type, entity_id, revision_number, snapshot_json,
            publication_state, created_at
        ) VALUES ('page', 'page-project', 1, '{}', 'published', ?)
    `).run(now);

    assert.throws(
        () => database.prepare(`
            UPDATE content_revisions SET snapshot_json = '{"changed":true}'
            WHERE entity_type = 'page' AND entity_id = 'page-project'
        `).run(),
        /content revisions are immutable/u
    );

    database.prepare(`
        INSERT INTO legal_documents (
            id, slug, title, current_version, created_at, updated_at
        ) VALUES ('privacy', 'privacy', 'Privacy', 1, ?, ?)
    `).run(now, now);
    database.prepare(`
        INSERT INTO legal_document_versions (
            id, document_id, version_number, effective_date, body_html,
            checksum, status, created_at, published_at
        ) VALUES (
            'privacy-v1', 'privacy', 1, '2026-10-03', '<p>Testo</p>',
            '12345678901234567890123456789012', 'published', ?, ?
        )
    `).run(now, now);

    assert.throws(
        () => database.prepare(`
            DELETE FROM legal_document_versions WHERE id = 'privacy-v1'
        `).run(),
        /published legal versions are immutable/u
    );

    database.prepare(`
        INSERT INTO permalinks (
            id, path, target_type, target_id, state, created_at, updated_at
        ) VALUES ('place-1-link', '/luogo.html?id=1', 'map_entry', '1', 'active', ?, ?)
    `).run(now, now);

    assert.throws(
        () => database.prepare(`
            UPDATE permalinks SET path = '/nuovo-indirizzo' WHERE id = 'place-1-link'
        `).run(),
        /permalink paths are immutable/u
    );
});

test("la migrazione SQL e lo schema completo espongono la stessa fondazione", async () => {
    for (const relativePath of [
        "../migrations/0013_cms_content_foundation.sql",
        "../schema.sql"
    ]) {
        const database = new DatabaseSync(":memory:");
        const sql = await readFile(new URL(relativePath, import.meta.url), "utf8");
        database.exec(sql);
        assert.deepEqual(listCmsTables(database), EXPECTED_TABLES, relativePath);
    }
});

test("la migrazione 0014 conserva le fonti e aggiunge lo stato pubblicato", async () => {
    const database = new DatabaseSync(":memory:");
    const foundation = await readFile(
        new URL("../migrations/0013_cms_content_foundation.sql", import.meta.url),
        "utf8"
    );
    const migration = await readFile(
        new URL("../migrations/0014_source_publication_state.sql", import.meta.url),
        "utf8"
    );
    database.exec(foundation);
    database.prepare(`
        INSERT INTO sources (id, title, created_at, updated_at)
        VALUES ('fonte-esistente', 'Fonte esistente', 10, 10)
    `).run();
    database.exec(migration);
    const row = database.prepare(`
        SELECT id, status, published_at FROM sources
        WHERE id = 'fonte-esistente'
    `).get();
    assert.deepEqual({ ...row }, {
        id: "fonte-esistente",
        status: "published",
        published_at: 10
    });
});

test("l’health check aggiorna una fondazione 0013 prima di creare indici nuovi", async () => {
    const db = new D1DatabaseMock();
    const foundation = await readFile(
        new URL("../migrations/0013_cms_content_foundation.sql", import.meta.url),
        "utf8"
    );
    db.database.exec(foundation);
    db.database.prepare(`
        INSERT INTO sources (id, title, created_at, updated_at)
        VALUES ('fonte-produzione', 'Fonte produzione', 10, 10)
    `).run();

    const response = await worker.fetch(new Request(
        "https://worker.test/api/health",
        { headers: { Origin: "https://anonmrcn-ctrl.github.io" } }
    ), {
        DB: db,
        ALLOWED_ORIGIN: "https://anonmrcn-ctrl.github.io"
    }, {});
    const data = await response.json();

    assert.equal(response.status, 200);
    assert.equal(data.ok, true);
    assert.deepEqual({ ...db.database.prepare(`
        SELECT id, status, published_at FROM sources
        WHERE id = 'fonte-produzione'
    `).get() }, {
        id: "fonte-produzione",
        status: "published",
        published_at: 10
    });
    assert.ok(db.database.prepare(`
        SELECT name FROM sqlite_master
        WHERE type = 'index' AND name = 'idx_sources_public'
    `).get());
});

test("l’health check installa la fondazione prima di dichiarare il servizio sano", async () => {
    const db = new D1DatabaseMock();
    const request = new Request("https://worker.test/api/health", {
        headers: { Origin: "https://anonmrcn-ctrl.github.io" }
    });
    const response = await worker.fetch(request, {
        DB: db,
        ALLOWED_ORIGIN: "https://anonmrcn-ctrl.github.io"
    }, {});
    const data = await response.json();

    assert.equal(response.status, 200);
    assert.equal(data.ok, true);
    assert.equal(data.contentSchema, 2);
    assert.deepEqual(listCmsTables(db.database), EXPECTED_TABLES);
});
