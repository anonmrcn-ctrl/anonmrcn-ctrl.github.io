import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

import worker from "../src/index.js";
import { PRIVACY_DOCUMENT_SEED } from "../src/legal-seed.js";

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

function environment() {
    return {
        DB: new D1DatabaseMock(),
        ADMIN_TOKEN: "test-admin",
        ALLOWED_ORIGIN: "https://anonmrcn-ctrl.github.io"
    };
}

async function call(env, path, options = {}) {
    const headers = new Headers({ Origin: env.ALLOWED_ORIGIN });
    if (options.admin) headers.set("X-Admin-Token", env.ADMIN_TOKEN);
    if (options.body) headers.set("Content-Type", "application/json");
    const response = await worker.fetch(new Request(`https://worker.test${path}`, {
        method: options.method || "GET",
        headers,
        body: options.body ? JSON.stringify(options.body) : undefined
    }), env, {});
    return { response, data: await response.json() };
}

test("prepara e pubblica una nuova versione legale senza riscrivere la precedente", async () => {
    const env = environment();
    const denied = await call(env, "/api/admin/cms/legal");
    const listed = await call(env, "/api/admin/cms/legal", { admin: true });
    assert.equal(denied.response.status, 401);
    assert.equal(listed.response.status, 200);
    assert.equal(listed.data.documents[0].currentVersion, 1);

    const bodyHtml = `${PRIVACY_DOCUMENT_SEED.version.bodyHtml}\n<p>Versione due.</p>`;
    const created = await call(env, "/api/admin/cms/legal/privacy/versions", {
        admin: true,
        method: "POST",
        body: { effectiveDate: "2026-10-10", bodyHtml }
    });
    assert.equal(created.response.status, 201);
    assert.equal(created.data.version.id, "privacy-v2");
    assert.equal(created.data.version.status, "draft");

    const stillPublished = await call(env, "/api/public/legal/privacy");
    assert.equal(stillPublished.data.document.version.number, 1);
    assert.equal(
        stillPublished.data.document.version.bodyHtml,
        PRIVACY_DOCUMENT_SEED.version.bodyHtml
    );

    const saved = await call(env, "/api/admin/cms/legal/versions/privacy-v2", {
        admin: true,
        method: "PATCH",
        body: {
            effectiveDate: "2026-10-11",
            bodyHtml: `${bodyHtml}\n<p>Correzione.</p>`,
            expectedChecksum: created.data.version.checksum,
            expectedEffectiveDate: created.data.version.effectiveDate
        }
    });
    assert.equal(saved.response.status, 200);
    assert.notEqual(saved.data.version.checksum, created.data.version.checksum);

    const stale = await call(env, "/api/admin/cms/legal/versions/privacy-v2", {
        admin: true,
        method: "PATCH",
        body: {
            effectiveDate: "2026-10-12",
            bodyHtml,
            expectedChecksum: created.data.version.checksum,
            expectedEffectiveDate: created.data.version.effectiveDate
        }
    });
    assert.equal(stale.response.status, 409);

    const published = await call(
        env,
        "/api/admin/cms/legal/versions/privacy-v2/publish",
        { admin: true, method: "POST", body: {
            expectedChecksum: saved.data.version.checksum,
            expectedEffectiveDate: saved.data.version.effectiveDate
        } }
    );
    assert.equal(published.response.status, 200);
    assert.equal(published.data.document.currentVersion, 2);
    assert.equal(published.data.version.status, "published");

    const publicVersion = await call(env, "/api/public/legal/privacy");
    assert.equal(publicVersion.data.document.version.number, 2);
    assert.equal(publicVersion.data.document.version.effectiveDate, "2026-10-11");
    assert.match(publicVersion.data.document.version.bodyHtml, /Correzione/u);
    assert.equal(env.DB.database.prepare(`
        SELECT body_html FROM legal_document_versions
        WHERE id = 'privacy-2026-10-03'
    `).get().body_html, PRIVACY_DOCUMENT_SEED.version.bodyHtml);
    assert.equal(env.DB.database.prepare(`
        SELECT COUNT(*) AS total FROM content_revisions
        WHERE entity_type = 'legal_document_version' AND entity_id = 'privacy-v2'
    `).get().total, 3);

    const immutable = await call(env, "/api/admin/cms/legal/versions/privacy-v2", {
        admin: true,
        method: "PATCH",
        body: {
            effectiveDate: "2026-10-12",
            bodyHtml,
            expectedChecksum: saved.data.version.checksum,
            expectedEffectiveDate: saved.data.version.effectiveDate
        }
    });
    assert.equal(immutable.response.status, 409);
});

test("rifiuta bozze legali pericolose e una seconda bozza simultanea", async () => {
    const env = environment();
    await call(env, "/api/admin/cms/legal", { admin: true });
    const invalid = await call(env, "/api/admin/cms/legal/privacy/versions", {
        admin: true,
        method: "POST",
        body: { effectiveDate: "2026-10-10", bodyHtml: "<script>alert(1)</script>" }
    });
    assert.equal(invalid.response.status, 400);

    const created = await call(env, "/api/admin/cms/legal/privacy/versions", {
        admin: true,
        method: "POST",
        body: { effectiveDate: "2026-10-10", bodyHtml: "<section><p>Bozza</p></section>" }
    });
    assert.equal(created.response.status, 201);
    const second = await call(env, "/api/admin/cms/legal/privacy/versions", {
        admin: true,
        method: "POST",
        body: { effectiveDate: "2026-10-11", bodyHtml: "<p>Altra</p>" }
    });
    assert.equal(second.response.status, 409);
});

test("registra e controlla permalink senza cambiare il percorso", async () => {
    const env = environment();
    const denied = await call(env, "/api/admin/cms/permalinks");
    const listed = await call(env, "/api/admin/cms/permalinks", { admin: true });
    assert.equal(denied.response.status, 401);
    assert.ok(listed.data.permalinks.some((item) => item.path === "/privacy.html"));

    const created = await call(env, "/api/admin/cms/permalinks", {
        admin: true,
        method: "POST",
        body: {
            path: "/informativa-vecchia.html",
            targetType: "legal_document_route",
            targetId: "privacy",
            state: "redirect",
            redirectPath: "/privacy.html"
        }
    });
    assert.equal(created.response.status, 201);
    assert.match(created.data.permalink.id, /^permalink-[0-9a-f-]{36}$/u);

    const updated = await call(
        env,
        `/api/admin/cms/permalinks/${created.data.permalink.id}`,
        { admin: true, method: "PATCH", body: {
            path: "/tentativo-riscrittura.html",
            state: "gone",
            redirectPath: null,
            expectedUpdatedAt: created.data.permalink.updatedAt
        } }
    );
    assert.equal(updated.response.status, 200);
    assert.equal(updated.data.permalink.path, "/informativa-vecchia.html");
    assert.equal(updated.data.permalink.state, "gone");

    const stale = await call(
        env,
        `/api/admin/cms/permalinks/${created.data.permalink.id}`,
        { admin: true, method: "PATCH", body: {
            state: "active", expectedUpdatedAt: created.data.permalink.updatedAt
        } }
    );
    assert.equal(stale.response.status, 409);
    assert.throws(() => env.DB.database.prepare(`
        UPDATE permalinks SET path = '/riscritto.html' WHERE id = ?
    `).run(created.data.permalink.id), /permalink paths are immutable/u);
});

test("blocca segreti, duplicati e reindirizzamenti verso URL non registrati", async () => {
    const env = environment();
    await call(env, "/api/admin/cms/permalinks", { admin: true });
    for (const body of [
        {
            path: "/accesso.html?token=segreto",
            targetType: "route", targetId: "accesso", state: "active"
        },
        {
            path: "/privacy.html",
            targetType: "route", targetId: "privacy", state: "active"
        },
        {
            path: "/vecchio.html",
            targetType: "route", targetId: "privacy", state: "redirect",
            redirectPath: "/inesistente.html"
        }
    ]) {
        const result = await call(env, "/api/admin/cms/permalinks", {
            admin: true, method: "POST", body
        });
        assert.ok([400, 409].includes(result.response.status));
    }
});

test("il pannello include i controlli legali e dei permalink", async () => {
    const [html, script] = await Promise.all([
        readFile(new URL("../../admin.html", import.meta.url), "utf8"),
        readFile(new URL("../../admin.js", import.meta.url), "utf8")
    ]);
    assert.match(html, /id="adminLegalForm"/u);
    assert.match(html, /id="adminPermalinkForm"/u);
    assert.match(script, /\/api\/admin\/cms\/legal/u);
    assert.match(script, /\/api\/admin\/cms\/permalinks/u);
});
