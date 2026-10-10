import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
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
        ALLOWED_ORIGIN: "https://anonmrcn-ctrl.github.io"
    };
}

async function call(env, path, options = {}) {
    const headers = new Headers({ Origin: env.ALLOWED_ORIGIN });
    if (options.admin) headers.set("X-Admin-Token", env.ADMIN_TOKEN);
    if (options.body !== undefined) headers.set("Content-Type", "application/json");
    return await worker.fetch(new Request(`https://worker.test${path}`, {
        method: options.method || "GET",
        headers,
        body: options.body === undefined ? undefined : JSON.stringify(options.body)
    }), env, { waitUntil() {} });
}

function encodedFile(name, type, bytes) {
    return {
        name,
        type,
        data: Buffer.from(bytes).toString("base64")
    };
}

function documentInput(file, overrides = {}) {
    return {
        title: "Verbale di ricerca",
        description: "Trascrizione accessibile del verbale di ricerca territoriale.",
        accessibilityStatus: "reviewed",
        accessibilityNote: "Testo ricercabile e lingua italiana impostata.",
        ...(file ? { file } : {}),
        ...overrides
    };
}

test("protegge elenco, upload e download dei documenti", async () => {
    const env = environment();
    const deniedList = await call(env, "/api/admin/cms/documents");
    assert.equal(deniedList.status, 401);

    const deniedCreate = await call(env, "/api/admin/cms/documents", {
        method: "POST",
        body: documentInput(encodedFile(
            "verbale.pdf",
            "application/pdf",
            "%PDF-1.7\ncontenuto privato\n%%EOF"
        ))
    });
    assert.equal(deniedCreate.status, 401);
    assert.equal(env.MEDIA.objects.size, 0);

    const created = await call(env, "/api/admin/cms/documents", {
        admin: true,
        method: "POST",
        body: documentInput(encodedFile(
            "verbale.pdf",
            "application/pdf",
            "%PDF-1.7\ncontenuto privato\n%%EOF"
        ))
    });
    const createdBody = await created.json();
    assert.equal(created.status, 201);
    assert.match(createdBody.document.id, /^[0-9a-f-]{36}$/u);
    assert.equal(createdBody.document.versionCount, 1);
    assert.equal(createdBody.document.accessibilityStatus, "reviewed");
    assert.equal(createdBody.document.checksum.length, 64);
    assert.equal(env.MEDIA.objects.size, 1);

    const deniedDownload = await call(env, createdBody.document.downloadUrl);
    assert.equal(deniedDownload.status, 401);

    const downloaded = await call(env, createdBody.document.downloadUrl, {
        admin: true
    });
    assert.equal(downloaded.status, 200);
    assert.equal(downloaded.headers.get("content-type"), "application/pdf");
    assert.equal(
        downloaded.headers.get("content-disposition"),
        'attachment; filename="verbale.pdf"'
    );
    assert.equal(downloaded.headers.get("cache-control"), "private, no-store");
    assert.equal(downloaded.headers.get("x-content-type-options"), "nosniff");
    assert.equal(downloaded.headers.get("x-media-storage"), "r2");
    assert.match(
        Buffer.from(await downloaded.arrayBuffer()).toString(),
        /contenuto privato/u
    );
});

test("sostituisce il file conservando la versione precedente e controlla i conflitti", async () => {
    const env = environment();
    const created = await call(env, "/api/admin/cms/documents", {
        admin: true,
        method: "POST",
        body: documentInput(encodedFile(
            "prima.pdf", "application/pdf", "%PDF-1.7\nprima\n%%EOF"
        ))
    });
    const first = (await created.json()).document;

    const metadataOnly = await call(env, `/api/admin/cms/documents/${first.id}`, {
        admin: true,
        method: "PATCH",
        body: documentInput(null, {
            title: "Verbale aggiornato",
            expectedUpdatedAt: first.updatedAt
        })
    });
    const metadata = (await metadataOnly.json()).document;
    assert.equal(metadataOnly.status, 200);
    assert.equal(metadata.versionCount, 1);
    assert.equal(env.MEDIA.objects.size, 1);

    const replaced = await call(env, `/api/admin/cms/documents/${first.id}`, {
        admin: true,
        method: "PATCH",
        body: documentInput(encodedFile(
            "seconda.txt", "text/plain", "seconda versione accessibile"
        ), {
            title: "Verbale aggiornato",
            expectedUpdatedAt: metadata.updatedAt
        })
    });
    const replacedBody = await replaced.json();
    assert.equal(replaced.status, 200);
    assert.equal(replacedBody.replaced, true);
    assert.equal(replacedBody.document.versionCount, 2);
    assert.equal(replacedBody.document.mediaName, "seconda.txt");
    assert.equal(env.MEDIA.objects.size, 2);

    const states = env.DB.database.prepare(`
        SELECT state, COUNT(*) AS total
        FROM media_assets
        WHERE owner_type = 'document' AND owner_id = ?
        GROUP BY state ORDER BY state
    `).all(first.id).map((row) => ({ ...row }));
    assert.deepEqual(states, [
        { state: "current", total: 1 },
        { state: "retained", total: 1 }
    ]);

    const stale = await call(env, `/api/admin/cms/documents/${first.id}`, {
        admin: true,
        method: "PATCH",
        body: documentInput(null, { expectedUpdatedAt: first.updatedAt })
    });
    assert.equal(stale.status, 409);

    const downloaded = await call(env, replacedBody.document.downloadUrl, {
        admin: true
    });
    assert.equal(downloaded.headers.get("content-type"), "text/plain");
    assert.equal(
        Buffer.from(await downloaded.arrayBuffer()).toString(),
        "seconda versione accessibile"
    );
});

test("rimuove metadati D1 e tutte le versioni R2 con conferma di versione", async () => {
    const env = environment();
    const created = await call(env, "/api/admin/cms/documents", {
        admin: true,
        method: "POST",
        body: documentInput(encodedFile(
            "documento.md", "text/markdown", "# Documento\n\nTesto."
        ))
    });
    const item = (await created.json()).document;

    const stale = await call(env, `/api/admin/cms/documents/${item.id}`, {
        admin: true,
        method: "DELETE",
        body: { expectedUpdatedAt: item.updatedAt - 1 }
    });
    assert.equal(stale.status, 409);
    assert.equal(env.MEDIA.objects.size, 1);

    const removed = await call(env, `/api/admin/cms/documents/${item.id}`, {
        admin: true,
        method: "DELETE",
        body: { expectedUpdatedAt: item.updatedAt }
    });
    assert.equal(removed.status, 200);
    assert.deepEqual(await removed.json(), {
        ok: true,
        id: item.id,
        deletedObjects: 1
    });
    assert.equal(env.MEDIA.objects.size, 0);
    assert.equal(env.DB.database.prepare(
        "SELECT COUNT(*) AS total FROM cms_documents"
    ).get().total, 0);
    assert.equal(env.DB.database.prepare(
        "SELECT COUNT(*) AS total FROM media_assets WHERE owner_type = 'document'"
    ).get().total, 0);
});

test("rifiuta formati contraffatti e non conserva documenti senza R2", async () => {
    const env = environment();
    const invalid = await call(env, "/api/admin/cms/documents", {
        admin: true,
        method: "POST",
        body: documentInput(encodedFile(
            "falso.pdf", "application/pdf", "non è un pdf"
        ))
    });
    assert.equal(invalid.status, 400);
    assert.match((await invalid.json()).error, /non corrisponde/u);

    const missingDescription = await call(env, "/api/admin/cms/documents", {
        admin: true,
        method: "POST",
        body: documentInput(encodedFile(
            "testo.txt", "text/plain", "testo"
        ), { description: "" })
    });
    assert.equal(missingDescription.status, 400);

    const noR2 = environment(false);
    const unavailable = await call(noR2, "/api/admin/cms/documents", {
        admin: true,
        method: "POST",
        body: documentInput(encodedFile(
            "testo.txt", "text/plain", "testo"
        ))
    });
    assert.equal(unavailable.status, 503);
    assert.match((await unavailable.json()).error, /R2/u);
});

test("il pannello espone un flusso documenti comprensibile e non pubblico", async () => {
    const root = new URL("../../", import.meta.url);
    const [html, script, sitemap] = await Promise.all([
        readFile(new URL("admin.html", root), "utf8"),
        readFile(new URL("admin.js", root), "utf8"),
        readFile(new URL("sitemap.xml", root), "utf8")
    ]);
    assert.match(html, /<h2 id="adminDocumentiTitolo">Documenti privati<\/h2>/u);
    assert.match(html, /Descrizione accessibile/u);
    assert.match(html, /Verifica di accessibilità/u);
    assert.match(html, /Rimuovi definitivamente/u);
    assert.match(script, /loadCmsDocuments/u);
    assert.match(script, /downloadCmsDocument/u);
    assert.doesNotMatch(sitemap, /api\/admin\/cms\/documents/u);
    assert.match(html, /<meta name="robots" content="noindex, nofollow">/u);
});
