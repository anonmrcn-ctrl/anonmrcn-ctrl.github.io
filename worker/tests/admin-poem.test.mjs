import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

import worker from "../src/index.js";

if (typeof crypto.subtle.timingSafeEqual !== "function") {
    crypto.subtle.timingSafeEqual = (first, second) => {
        const left = new Uint8Array(first);
        const right = new Uint8Array(second);
        let difference = left.byteLength ^ right.byteLength;

        for (let index = 0; index < Math.min(left.length, right.length); index += 1) {
            difference |= left[index] ^ right[index];
        }
        return difference === 0;
    };
}

class Statement {
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

class Database {
    constructor() {
        this.database = new DatabaseSync(":memory:");
        this.database.exec("PRAGMA foreign_keys = ON");
    }

    prepare(sql) {
        return new Statement(this.database, sql);
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

function environment() {
    return {
        DB: new Database(),
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

    const response = await worker.fetch(new Request(`https://worker.test${path}`, {
        method: options.method || "GET",
        headers,
        body: options.body ? JSON.stringify(options.body) : undefined
    }), env, {});

    return { response, data: await response.json() };
}

function updateBody(poem, overrides = {}) {
    return {
        title: poem.title,
        subtitle: poem.subtitle,
        status: poem.status,
        expectedUpdatedAt: poem.updatedAt,
        lines: poem.sections.flatMap((section) => section.lines).map((line) => ({
            id: line.id,
            text: line.text,
            indent: line.indent
        })),
        ...overrides
    };
}

test("espone opera, quattro canti e 121 versi soltanto all'amministratore", async () => {
    const env = environment();
    const unauthorized = await call(env, "/api/admin/cms/poem");
    const authorized = await call(env, "/api/admin/cms/poem", { admin: true });
    const poem = authorized.data.poem;

    assert.equal(unauthorized.response.status, 401);
    assert.equal(authorized.response.status, 200);
    assert.equal(poem.sections.length, 4);
    assert.equal(
        poem.sections.flatMap((section) => section.lines).length,
        121
    );
    assert.deepEqual(poem.sections.map((section) => section.anchor), [
        "I", "II", "III", "IV"
    ]);
    assert.equal(poem.sections.at(-1).lines.at(-1).metadata.metricRow, 165);
});

test("modifica testo e rientro senza cambiare metrica, ordine o ancore", async () => {
    const env = environment();
    const initial = await call(env, "/api/admin/cms/poem", { admin: true });
    const poem = initial.data.poem;
    const lines = updateBody(poem).lines;
    const changedId = lines[1].id;

    lines[1] = { ...lines[1], text: "Verso aggiornato", indent: 2 };
    const updated = await call(env, "/api/admin/cms/poem", {
        admin: true,
        method: "PATCH",
        body: updateBody(poem, {
            title: "Il Gajo tra i Praelli — edizione",
            lines
        })
    });

    assert.equal(updated.response.status, 200);
    assert.equal(updated.data.unchanged, false);
    assert.ok(updated.data.poem.updatedAt > poem.updatedAt);
    assert.deepEqual(updated.data.poem.sections.map((section) => section.anchor), [
        "I", "II", "III", "IV"
    ]);
    const changed = updated.data.poem.sections
        .flatMap((section) => section.lines)
        .find((line) => line.id === changedId);
    assert.equal(changed.text, "Verso aggiornato");
    assert.equal(changed.indent, 2);
    assert.equal(changed.metadata.metricRow, 2);

    const publicPoem = await call(
        env,
        "/api/public/poems/il-gajo-tra-i-praelli"
    );
    assert.equal(publicPoem.data.poem.title, updated.data.poem.title);
    assert.equal(publicPoem.data.poem.sections[0].lines[1].text, changed.text);

    const database = env.DB.database;
    assert.equal(database.prepare(`
        SELECT COUNT(*) AS total FROM content_revisions
        WHERE entity_type = 'poem_work'
            AND entity_id = 'poem-il-gajo-tra-i-praelli'
    `).get().total, 2);
    assert.equal(database.prepare(`
        SELECT COUNT(*) AS total FROM content_revisions
        WHERE entity_type = 'poem_line' AND entity_id = ?
    `).get(changedId).total, 2);
});

test("rifiuta versi estranei e una versione di lavoro superata", async () => {
    const env = environment();
    const initial = await call(env, "/api/admin/cms/poem", { admin: true });
    const poem = initial.data.poem;
    const invalidBody = updateBody(poem);

    invalidBody.lines[0] = {
        id: "verso-estraneo",
        text: "Testo",
        indent: 0
    };
    const invalid = await call(env, "/api/admin/cms/poem", {
        admin: true,
        method: "PATCH",
        body: invalidBody
    });
    assert.equal(invalid.response.status, 400);

    const saved = await call(env, "/api/admin/cms/poem", {
        admin: true,
        method: "PATCH",
        body: updateBody(poem, { subtitle: "Nuovo sottotitolo" })
    });
    assert.equal(saved.response.status, 200);

    const stale = await call(env, "/api/admin/cms/poem", {
        admin: true,
        method: "PATCH",
        body: updateBody(poem, { subtitle: "Sovrascrittura" })
    });
    assert.equal(stale.response.status, 409);
});

test("il pannello raggruppa i versi per canto e invia solo campi modificabili", async () => {
    const [html, source] = await Promise.all([
        readFile(new URL("../../admin.html", import.meta.url), "utf8"),
        readFile(new URL("../../admin.js", import.meta.url), "utf8")
    ]);

    for (const id of [
        "adminPoemForm",
        "adminPoemTitle",
        "adminPoemSubtitle",
        "adminPoemPublicationStatus",
        "adminPoemSections",
        "adminPoemSubmit",
        "adminPoemReload",
        "adminPoemStatus"
    ]) {
        assert.match(html, new RegExp(`id="${id}"`, "u"), id);
    }

    assert.match(source, /dataset\.cmsPoemLine/u);
    assert.match(source, /expectedUpdatedAt: loadedCmsPoem\.updatedAt/u);
    assert.doesNotMatch(source, /metadata:\s*field/u);
    assert.match(
        html,
        /<script src="\.\/admin\.js\?v=20261010-responsive-media1"><\/script>/u
    );
});
