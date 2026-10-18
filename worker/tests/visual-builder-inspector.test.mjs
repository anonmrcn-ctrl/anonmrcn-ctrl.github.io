import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

import worker from "../src/index.js";
import { normalizeInspectorValues } from "../src/visual-builder-inspector.js";

if (typeof crypto.subtle.timingSafeEqual !== "function") {
    crypto.subtle.timingSafeEqual = (first, second) => {
        const left = new Uint8Array(first);
        const right = new Uint8Array(second);
        if (left.byteLength !== right.byteLength) return false;
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
    bind(...values) { this.values = values; return this; }
    async first() { return this.database.prepare(this.sql).get(...this.values) || null; }
    async all() { return { results: this.database.prepare(this.sql).all(...this.values) }; }
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
    prepare(sql) { return new D1StatementMock(this.database, sql); }
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

test("l'ispettore salva contenuto e stile tipizzati senza toccare i binding", async () => {
    const env = environment();
    const initial = await call(env, "/api/admin/cms/visual-pages", { admin: true });
    assert.equal(initial.response.status, 200);
    assert.equal(initial.data.inspectorVersion, 2);
    assert.ok(initial.data.inspectorSchemas.heading.some((field) => field.key === "title"));
    assert.ok(initial.data.inspectorSchemas.heading.some((field) => field.key === "visibilityPhone"));
    assert.ok(!JSON.stringify(initial.data).includes("technical.binding"));

    const page = initial.data.pages.find((item) => item.id === "page-progetto");
    const heading = page.nodes.find((node) => node.key === "progetto-title");
    const technicalBefore = env.DB.database.prepare(`
        SELECT count(*) AS total FROM visual_node_properties
        WHERE node_id = 'visual-progetto-map' AND domain = 'technical'
    `).get().total;
    const values = {
        ...heading.values,
        title: "Titolo visuale aggiornato",
        alignment: "center",
        width: "compact",
        spaceTop: "space-3",
        spaceBottom: "space-2",
        fontFamily: "serif",
        fontSize: "xlarge",
        textColor: "paper",
        background: "dark",
        border: "thin",
        radius: "small",
        visibilityPhone: "hidden",
        visibilityTablet: "visible",
        visibilityDesktop: "visible"
    };
    const saved = await call(
        env,
        `/api/admin/cms/visual-properties/${page.id}/${heading.key}`,
        {
            admin: true,
            method: "PATCH",
            body: { expectedUpdatedAt: page.updatedAt, values }
        }
    );
    assert.equal(saved.response.status, 200);
    const savedHeading = saved.data.page.nodes.find((node) => node.key === heading.key);
    assert.equal(savedHeading.values.title, values.title);
    assert.equal(savedHeading.values.visibilityPhone, "hidden");
    assert.equal(env.DB.database.prepare(`
        SELECT count(*) AS total FROM visual_node_properties
        WHERE node_id = 'visual-progetto-map' AND domain = 'technical'
    `).get().total, technicalBefore);
    assert.equal(env.DB.database.prepare(`
        SELECT count(*) AS total FROM content_revisions
        WHERE entity_type = 'visual_tree' AND entity_id = ?
    `).get(page.treeId).total, 2);

    const publicPage = await call(env, "/api/public/visual-pages/progetto");
    assert.equal(publicPage.response.status, 200);
    assert.doesNotMatch(publicPage.data.page.html, /Titolo visuale aggiornato/u);
    const published = await call(
        env,
        `/api/admin/cms/visual-publication/${page.id}/publish`,
        {
            admin: true,
            method: "PATCH",
            body: { expectedUpdatedAt: saved.data.page.updatedAt }
        }
    );
    assert.equal(published.response.status, 200);
    const publicAfterPublish = await call(env, "/api/public/visual-pages/progetto");
    assert.match(publicAfterPublish.data.page.html, /Titolo visuale aggiornato/u);
    assert.match(publicAfterPublish.data.page.html, /data-visual-align="center"/u);
    assert.match(publicAfterPublish.data.page.html, /data-visual-background="dark"/u);
    assert.match(publicAfterPublish.data.page.html, /data-visual-phone="hidden"/u);
    assert.doesNotMatch(publicPage.data.page.html, /style=/u);

    const invalidContrast = await call(
        env,
        `/api/admin/cms/visual-properties/${page.id}/${heading.key}`,
        {
            admin: true,
            method: "PATCH",
            body: {
                expectedUpdatedAt: published.data.state.draftUpdatedAt,
                values: { ...values, textColor: "accent", background: "paper" }
            }
        }
    );
    assert.equal(invalidContrast.response.status, 400);
    assert.match(invalidContrast.data.error, /Contrasto insufficiente/u);
});

test("blocca URL, opzioni e visibilità incompatibili", () => {
    assert.throws(() => normalizeInspectorValues("button", {
        title: "Apri",
        href: "javascript:alert(1)"
    }), /destinazione/u);
    assert.throws(() => normalizeInspectorValues("heading", {
        title: "Titolo",
        alignment: "diagonale",
        visibilityPhone: "visible",
        visibilityTablet: "visible",
        visibilityDesktop: "visible"
    }), /Valore non valido/u);
    assert.throws(() => normalizeInspectorValues("heading", {
        title: "Titolo",
        visibilityPhone: "hidden",
        visibilityTablet: "hidden",
        visibilityDesktop: "hidden"
    }), /nascosto su tutti/u);
    assert.throws(() => normalizeInspectorValues("image", {
        alt: "",
        visibilityPhone: "visible",
        visibilityTablet: "visible",
        visibilityDesktop: "visible"
    }), /obbligatorio/u);
});

test("l'anteprima genera i campi dallo schema e mostra breakpoint e avvisi", async () => {
    const [html, source, css] = await Promise.all([
        readFile(new URL("../../admin.html", import.meta.url), "utf8"),
        readFile(new URL("../../admin-visual-builder.js", import.meta.url), "utf8"),
        readFile(new URL("../../admin-visual-builder.css", import.meta.url), "utf8")
    ]);
    for (const id of [
        "adminVisualInspectorForm", "adminVisualInspectorFields",
        "adminVisualInspectorSave", "adminVisualPreview",
        "adminVisualPreviewDevice", "adminVisualWarnings"
    ]) assert.match(html, new RegExp(`id="${id}"`, "u"));
    for (const device of ["phone", "tablet", "desktop"]) {
        assert.match(html, new RegExp(`data-visual-device="${device}"`, "u"));
    }
    assert.match(source, /inspectorSchemas\[node\?\.type\]/u);
    assert.match(source, /addEventListener\("input"/u);
    assert.match(source, /contrastRatio/u);
    assert.match(source, /visual-properties/u);
    assert.match(source, /textContent =/u);
    assert.match(css, /data-visual-background="dark"/u);
    assert.match(css, /data-visual-phone="hidden"/u);
    assert.match(css, /width:\s*min\(360px, 100%\)/u);
    assert.match(html, /admin-visual-builder\.css\?v=20261019-audio1/u);
});
