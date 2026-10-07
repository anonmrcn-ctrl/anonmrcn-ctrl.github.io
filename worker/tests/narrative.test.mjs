import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

import worker from "../src/index.js";

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

const env = {
    DB: new D1DatabaseMock(),
    ADMIN_TOKEN: "test-admin",
    ALLOWED_ORIGIN: "https://anonmrcn-ctrl.github.io"
};

function request(path, options = {}) {
    const headers = new Headers(options.headers || {});
    headers.set("Origin", env.ALLOWED_ORIGIN);

    if (options.admin) {
        headers.set("X-Admin-Token", env.ADMIN_TOKEN);
    }

    if (options.body) {
        headers.set("Content-Type", "application/json");
    }

    return new Request(`https://worker.test${path}`, {
        method: options.method || "GET",
        headers,
        body: options.body ? JSON.stringify(options.body) : undefined
    });
}

async function call(path, options) {
    const response = await worker.fetch(request(path, options), env, {});
    return {
        response,
        data: await response.json()
    };
}

test("inizializza, modifica e pubblica il percorso poetico", async () => {
    const initial = await call("/api/public/narrative-steps");

    assert.equal(initial.response.status, 200);
    assert.equal(initial.data.steps.length, 13);
    assert.equal(initial.data.steps[0].key, "gaggio");
    assert.equal(initial.data.steps[3].key, "via-fornace");

    const repeated = await call("/api/public/narrative-steps");
    assert.equal(repeated.data.steps.length, 13, "l’inizializzazione non duplica le tappe");

    const created = await call("/api/admin/narrative-steps", {
        admin: true,
        method: "POST",
        body: {
            position: 14,
            verse: "v. 150 — «prova»",
            label: "Tappa di prova",
            title: "Tappa di prova",
            titleUrl: "",
            lat: 45.55,
            lon: 12.32,
            zoom: 16,
            text: "Una spiegazione di prova.",
            sources: [],
            published: true
        }
    });

    assert.equal(created.response.status, 201);
    assert.equal(created.data.step.key, "tappa-di-prova");

    const stepId = created.data.step.id;
    const drafted = await call(`/api/admin/narrative-steps/${stepId}`, {
        admin: true,
        method: "PATCH",
        body: {
            ...created.data.step,
            text: "Spiegazione aggiornata.",
            published: false
        }
    });

    assert.equal(drafted.response.status, 200);
    assert.equal(drafted.data.step.published, false);
    assert.equal(drafted.data.step.everPublished, true);

    const publicAfterDraft = await call("/api/public/narrative-steps");
    assert.equal(publicAfterDraft.data.steps.length, 13);

    const adminList = await call("/api/admin/narrative-steps", { admin: true });
    assert.equal(adminList.data.steps.length, 14);

    const deleted = await call(`/api/admin/narrative-steps/${stepId}`, {
        admin: true,
        method: "DELETE"
    });
    assert.equal(deleted.response.status, 200);
    assert.equal(deleted.data.archived, true);

    const finalList = await call("/api/admin/narrative-steps", { admin: true });
    assert.equal(finalList.data.steps.length, 14);
    assert.equal(
        finalList.data.steps.find((step) => step.id === stepId).published,
        false
    );

    const draft = await call("/api/admin/narrative-steps", {
        admin: true,
        method: "POST",
        body: {
            position: 15,
            verse: "v. 151 — «bozza»",
            label: "Bozza eliminabile",
            title: "Bozza eliminabile",
            titleUrl: "",
            lat: 45.55,
            lon: 12.32,
            zoom: 16,
            text: "Questa tappa non è mai stata pubblicata.",
            sources: [],
            published: false
        }
    });

    const removedDraft = await call(
        `/api/admin/narrative-steps/${draft.data.step.id}`,
        { admin: true, method: "DELETE" }
    );
    assert.equal(removedDraft.data.deleted, true);
});

test("protegge l’editor e rifiuta fonti non valide", async () => {
    const unauthorized = await call("/api/admin/narrative-steps");
    assert.equal(unauthorized.response.status, 401);

    const invalid = await call("/api/admin/narrative-steps", {
        admin: true,
        method: "POST",
        body: {
            position: 14,
            verse: "v. 150 — «prova»",
            label: "Fonte non valida",
            title: "Fonte non valida",
            lat: 45.55,
            lon: 12.32,
            zoom: 16,
            text: "Una spiegazione di prova.",
            sources: [{ terms: ["termine"], url: "javascript:alert(1)" }],
            published: true
        }
    });

    assert.equal(invalid.response.status, 400);
});
