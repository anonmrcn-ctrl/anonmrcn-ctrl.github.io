import assert from "node:assert/strict";
import { createHash, webcrypto } from "node:crypto";
import { readFile } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import vm from "node:vm";

import worker from "../src/index.js";
import { PRIVACY_DOCUMENT_SEED } from "../src/legal-seed.js";

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

async function call(env, path) {
    const response = await worker.fetch(new Request(
        `https://worker.test${path}`,
        { headers: { Origin: env.ALLOWED_ORIGIN } }
    ), env, {});

    return { response, data: await response.json() };
}

test("importa la versione privacy del 3 ottobre 2026 con checksum verificabile", async () => {
    const env = createEnvironment();
    const first = await call(env, "/api/public/legal/privacy");
    const second = await call(env, "/api/public/legal/privacy");
    const version = PRIVACY_DOCUMENT_SEED.version;
    const checksum = createHash("sha256")
        .update(version.bodyHtml)
        .digest("hex");

    assert.equal(first.response.status, 200);
    assert.equal(second.response.status, 200);
    assert.equal(first.data.document.id, "privacy");
    assert.equal(first.data.document.title, PRIVACY_DOCUMENT_SEED.title);
    assert.equal(first.data.document.version.number, 1);
    assert.equal(first.data.document.version.effectiveDate, "2026-10-03");
    assert.equal(first.data.document.version.bodyHtml, version.bodyHtml);
    assert.equal(first.data.document.version.checksum, checksum);
    assert.equal(version.checksum, checksum);
    assert.equal(env.DB.database.prepare(`
        SELECT COUNT(*) AS total FROM legal_documents
    `).get().total, 1);
    assert.equal(env.DB.database.prepare(`
        SELECT COUNT(*) AS total FROM legal_document_versions
    `).get().total, 1);
    assert.equal(env.DB.database.prepare(`
        SELECT COUNT(*) AS total FROM content_initializations
        WHERE name = 'legal_documents_v1'
    `).get().total, 1);
});

test("espone soltanto la versione corrente pubblicata e ne vieta la riscrittura", async () => {
    const env = createEnvironment();
    await call(env, "/api/public/legal/privacy");
    const database = env.DB.database;
    const now = Date.now();

    database.prepare(`
        INSERT INTO legal_documents (
            id, slug, title, current_version, created_at, updated_at
        ) VALUES ('bozza', 'bozza', 'Bozza', 1, ?, ?)
    `).run(now, now);
    database.prepare(`
        INSERT INTO legal_document_versions (
            id, document_id, version_number, effective_date, body_html,
            checksum, status, created_at, published_at
        ) VALUES (
            'bozza-v1', 'bozza', 1, '2026-10-08', '<p>Bozza</p>',
            '12345678901234567890123456789012', 'draft', ?, NULL
        )
    `).run(now);

    const draft = await call(env, "/api/public/legal/bozza");
    assert.equal(draft.response.status, 404);
    assert.throws(() => database.prepare(`
        UPDATE legal_document_versions SET body_html = '<p>Cambiato</p>'
        WHERE id = 'privacy-2026-10-03'
    `).run(), /published legal versions are immutable/u);
    assert.throws(() => database.prepare(`
        DELETE FROM legal_document_versions
        WHERE id = 'privacy-2026-10-03'
    `).run(), /published legal versions are immutable/u);
});

function normalizeHtml(value) {
    return String(value || "")
        .replace(/>\s+</gu, "><")
        .replace(/\s+/gu, " ")
        .trim();
}

test("la pagina conserva integralmente l'informativa statica come ripiego", async () => {
    const html = await readFile(
        new URL("../../privacy.html", import.meta.url),
        "utf8"
    );
    const body = /<div id="privacyDocumento"[^>]*>([\s\S]*?)<\/div>/u
        .exec(html)?.[1];

    assert.ok(body);
    assert.equal(
        normalizeHtml(body),
        normalizeHtml(PRIVACY_DOCUMENT_SEED.version.bodyHtml)
    );
    assert.match(html, /data-legal-title/u);
    assert.match(html, /data-legal-effective-date/u);
    assert.match(
        html,
        /<script(?: defer)? src="\.\/api\.js"><\/script>[\s\S]*?<script(?: defer)? src="\.\/privacy-content\.js\?v=20261008-legal1"><\/script>/u
    );
});

async function executeLoader(request) {
    const source = await readFile(
        new URL("../../privacy-content.js", import.meta.url),
        "utf8"
    );
    const target = { innerHTML: "<section>Ripiego</section>" };
    const title = { textContent: "Titolo statico" };
    const effectiveDate = { textContent: "Data statica" };
    let finish;
    const ready = new Promise((resolve) => {
        finish = resolve;
    });
    const document = {
        documentElement: { dataset: {} },
        getElementById: (id) => id === "privacyDocumento" ? target : null,
        querySelector: (selector) =>
            selector === "[data-legal-title]" ? title : effectiveDate
    };
    const window = {
        NNMRCN_API: { request },
        crypto: webcrypto,
        dispatchEvent: (event) => finish(event)
    };

    vm.runInNewContext(source, {
        Array,
        CustomEvent: class CustomEvent {
            constructor(type, options) {
                this.type = type;
                this.detail = options.detail;
            }
        },
        document,
        TextEncoder,
        Uint8Array,
        window
    });

    return { document, event: await ready, target, title, effectiveDate };
}

test("il client applica soltanto contenuto D1 con checksum valido", async () => {
    const result = await executeLoader(async () => ({
        document: PRIVACY_DOCUMENT_SEED
    }));

    assert.equal(
        result.target.innerHTML,
        PRIVACY_DOCUMENT_SEED.version.bodyHtml
    );
    assert.equal(result.title.textContent, PRIVACY_DOCUMENT_SEED.title);
    assert.equal(
        result.effectiveDate.textContent,
        "Ultimo aggiornamento: 3 ottobre 2026"
    );
    assert.equal(result.document.documentElement.dataset.legalDocumentSource, "d1");
    assert.equal(
        result.document.documentElement.dataset.legalDocumentChecksum,
        PRIVACY_DOCUMENT_SEED.version.checksum
    );
    assert.equal(result.event.detail.source, "d1");
});

test("il client mantiene il ripiego se API o checksum non sono validi", async () => {
    for (const request of [
        async () => {
            throw new Error("offline");
        },
        async () => ({
            document: {
                ...PRIVACY_DOCUMENT_SEED,
                version: {
                    ...PRIVACY_DOCUMENT_SEED.version,
                    checksum: "0".repeat(64)
                }
            }
        })
    ]) {
        const result = await executeLoader(request);

        assert.equal(result.target.innerHTML, "<section>Ripiego</section>");
        assert.equal(result.title.textContent, "Titolo statico");
        assert.equal(result.document.documentElement.dataset.legalDocumentSource, "fallback");
        assert.equal(result.event.detail.source, "fallback");
    }
});
