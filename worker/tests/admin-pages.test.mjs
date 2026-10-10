import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

import worker from "../src/index.js";
import { PAGE_SEEDS } from "../src/page-seed.js";

if (typeof crypto.subtle.timingSafeEqual !== "function") {
    crypto.subtle.timingSafeEqual = (first, second) => {
        const left = new Uint8Array(first);
        const right = new Uint8Array(second);

        if (left.byteLength !== right.byteLength) {
            return false;
        }

        let difference = 0;
        for (let index = 0; index < left.byteLength; index += 1) {
            difference |= left[index] ^ right[index];
        }
        return difference === 0;
    };
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

function createEnvironment() {
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

function updateBody(page, overrides = {}) {
    return {
        title: page.title,
        description: page.description,
        status: page.status,
        expectedUpdatedAt: page.updatedAt,
        blocks: page.blocks.map((block) => ({
            id: block.id,
            text: block.text
        })),
        ...overrides
    };
}

test("elenca pagine e blocchi soltanto all'amministratore", async () => {
    const env = createEnvironment();
    const unauthorized = await call(env, "/api/admin/cms/pages");
    const authorized = await call(env, "/api/admin/cms/pages", {
        admin: true
    });

    assert.equal(unauthorized.response.status, 401);
    assert.equal(authorized.response.status, 200);
    assert.equal(authorized.data.pages.length, PAGE_SEEDS.length);

    for (const seed of PAGE_SEEDS) {
        const page = authorized.data.pages.find((item) => item.id === seed.id);

        assert.ok(page, seed.id);
        assert.equal(page.slug, seed.slug);
        assert.equal(page.status, "published");
        assert.deepEqual(
            page.blocks.map((block) => block.id),
            seed.blocks.map((block) => block.id)
        );
    }
});

test("salva pagina e blocchi conservando una revisione append-only", async () => {
    const env = createEnvironment();
    const initial = await call(env, "/api/admin/cms/pages", { admin: true });
    const page = initial.data.pages.find((item) => item.id === "page-progetto");
    const body = updateBody(page, {
        title: "Il progetto aggiornato",
        blocks: page.blocks.map((block, index) => ({
            id: block.id,
            text: index === 1 ? "Introduzione aggiornata." : block.text
        }))
    });
    const updated = await call(env, `/api/admin/cms/pages/${page.id}`, {
        admin: true,
        method: "PATCH",
        body
    });

    assert.equal(updated.response.status, 200);
    assert.equal(updated.data.unchanged, false);
    assert.equal(updated.data.page.title, body.title);
    assert.ok(updated.data.page.updatedAt > page.updatedAt);
    assert.equal(updated.data.page.blocks[1].text, "Introduzione aggiornata.");

    const publicPage = await call(env, "/api/public/pages/progetto");
    assert.equal(publicPage.data.page.title, body.title);
    assert.equal(
        publicPage.data.page.blocks[1].content.text,
        "Introduzione aggiornata."
    );

    const database = env.DB.database;
    assert.equal(database.prepare(`
        SELECT COUNT(*) AS total FROM content_revisions
        WHERE entity_type = 'site_page' AND entity_id = 'page-progetto'
    `).get().total, 2);
    assert.equal(database.prepare(`
        SELECT COUNT(*) AS total FROM content_revisions
        WHERE entity_type = 'page_block' AND entity_id = 'progetto-map-intro'
    `).get().total, 2);
    assert.equal(database.prepare(`
        SELECT COUNT(*) AS total FROM content_revisions
        WHERE entity_type = 'page_block' AND entity_id = 'progetto-title'
    `).get().total, 1);

    const firstSnapshot = JSON.parse(database.prepare(`
        SELECT snapshot_json FROM content_revisions
        WHERE
            entity_type = 'site_page'
            AND entity_id = 'page-progetto'
            AND revision_number = 1
    `).get().snapshot_json);
    assert.equal(firstSnapshot.title, "Il progetto");
});

test("rifiuta blocchi estranei e salvataggi basati su una versione superata", async () => {
    const env = createEnvironment();
    const initial = await call(env, "/api/admin/cms/pages", { admin: true });
    const page = initial.data.pages.find((item) => item.id === "page-autore");
    const invalidBlocks = updateBody(page);

    invalidBlocks.blocks[0] = {
        id: "blocco-di-un-altra-pagina",
        text: "Testo"
    };

    const invalid = await call(env, `/api/admin/cms/pages/${page.id}`, {
        admin: true,
        method: "PATCH",
        body: invalidBlocks
    });
    assert.equal(invalid.response.status, 400);

    const firstUpdate = await call(env, `/api/admin/cms/pages/${page.id}`, {
        admin: true,
        method: "PATCH",
        body: updateBody(page, { title: "L’autore aggiornato" })
    });
    assert.equal(firstUpdate.response.status, 200);

    const stale = await call(env, `/api/admin/cms/pages/${page.id}`, {
        admin: true,
        method: "PATCH",
        body: updateBody(page, { title: "Sovrascrittura" })
    });
    assert.equal(stale.response.status, 409);

    const current = await call(env, "/api/admin/cms/pages", { admin: true });
    assert.equal(
        current.data.pages.find((item) => item.id === page.id).title,
        "L’autore aggiornato"
    );
});

test("il pannello espone il modulo pagine e usa la nuova API CMS", async () => {
    const [html, source] = await Promise.all([
        readFile(new URL("../../admin.html", import.meta.url), "utf8"),
        readFile(new URL("../../admin.js", import.meta.url), "utf8")
    ]);

    for (const id of [
        "adminPageForm",
        "adminPageSelect",
        "adminPageTitle",
        "adminPageDescription",
        "adminPagePublicationStatus",
        "adminPageBlocks",
        "adminPageSubmit",
        "adminPageReload",
        "adminPageStatus"
    ]) {
        assert.match(html, new RegExp(`id="${id}"`, "u"), id);
    }

    assert.match(source, /\/api\/admin\/cms\/pages/u);
    assert.match(source, /expectedUpdatedAt: page\.updatedAt/u);
    assert.match(
        html,
        /<script src="\.\/admin\.js\?v=20261010-documents1"><\/script>/u
    );
});
