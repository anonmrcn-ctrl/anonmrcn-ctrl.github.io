import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

import worker from "../src/index.js";

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

function renumber(nodes) {
    for (const parentKey of new Set(nodes.map((node) => node.parentKey))) {
        nodes
            .filter((node) => node.parentKey === parentKey)
            .sort((left, right) => left.position - right.position)
            .forEach((node, index) => { node.position = index + 1; });
    }
    return nodes;
}

test("il canvas protetto modifica, duplica e rimuove blocchi con cronologia", async () => {
    const env = environment();
    const denied = await call(env, "/api/admin/cms/visual-pages");
    const initial = await call(env, "/api/admin/cms/visual-pages", { admin: true });
    assert.equal(denied.response.status, 401);
    assert.equal(initial.response.status, 200);
    assert.equal(initial.data.pages.length, 9);
    assert.ok(initial.data.palette.some((item) => item.type === "section"));
    assert.ok(!initial.data.palette.some((item) => item.type === "page-root"));
    assert.ok(!JSON.stringify(initial.data).includes("technical.binding"));

    const page = initial.data.pages.find((item) => item.id === "page-autore");
    const root = page.nodes.find((node) => node.root);
    const children = page.nodes.filter((node) => node.parentKey === root.key);
    const source = children[0];
    const removed = children.at(-1);
    const nodes = page.nodes
        .filter((node) => node.key !== removed.key)
        .map((node) => ({ ...node }));
    const movedSource = nodes.find((node) => node.key === source.key);
    movedSource.parentKey = "new-section";
    movedSource.position = 1;
    nodes.push({
        key: "new-section",
        parentKey: root.key,
        position: 999,
        type: "section",
        label: "Sezione di prova",
        copyOf: null
    }, {
        key: "new-copy",
        parentKey: "new-section",
        position: 2,
        type: source.type,
        label: "Copia accessibile",
        copyOf: source.key
    });
    renumber(nodes);

    const saved = await call(env, `/api/admin/cms/visual-pages/${page.id}`, {
        admin: true,
        method: "PATCH",
        body: {
            expectedUpdatedAt: page.updatedAt,
            nodes: nodes.map(({ root: _root, ...node }) => node)
        }
    });
    assert.equal(saved.response.status, 200);
    assert.equal(saved.data.unchanged, false);
    assert.ok(saved.data.page.updatedAt > page.updatedAt);
    assert.ok(!saved.data.page.nodes.some((node) => node.key === removed.key));
    assert.ok(!saved.data.page.nodes.some((node) => node.key.startsWith("new-")));
    const section = saved.data.page.nodes.find((node) => node.label === "Sezione di prova");
    const copy = saved.data.page.nodes.find((node) => node.label === "Copia accessibile");
    assert.equal(saved.data.page.nodes.find((node) => node.key === source.key).parentKey, section.key);
    assert.equal(copy.parentKey, section.key);

    const database = env.DB.database;
    const sourceProperties = database.prepare(`
        SELECT count(*) AS total FROM visual_node_properties WHERE node_id = ?
    `).get(source.key).total;
    const copiedProperties = database.prepare(`
        SELECT count(*) AS total FROM visual_node_properties WHERE node_id = ?
    `).get(copy.key).total;
    assert.equal(copiedProperties, sourceProperties);
    assert.equal(database.prepare(`
        SELECT count(*) AS total FROM content_revisions
        WHERE entity_type = 'visual_tree' AND entity_id = ?
    `).get(page.treeId).total, 2, "baseline e nuova revisione sono recuperabili");
    assert.ok(database.prepare(`
        SELECT snapshot_json FROM content_revisions
        WHERE entity_type = 'visual_tree' AND entity_id = ? AND revision_number = 1
    `).get(page.treeId).snapshot_json.includes(removed.key));

    const publicPage = await call(env, "/api/public/visual-pages/autore");
    assert.equal(publicPage.response.status, 200);
    assert.ok(publicPage.data.page.html.includes(`data-block-id="${section.key}"`));

    const stale = await call(env, `/api/admin/cms/visual-pages/${page.id}`, {
        admin: true,
        method: "PATCH",
        body: { expectedUpdatedAt: page.updatedAt, nodes }
    });
    assert.equal(stale.response.status, 409);
});

test("il server rifiuta radici, tipi e annidamenti non validi", async () => {
    const env = environment();
    const initial = await call(env, "/api/admin/cms/visual-pages", { admin: true });
    const page = initial.data.pages.find((item) => item.id === "page-autore");
    const root = page.nodes.find((node) => node.root);
    const child = page.nodes.find((node) => !node.root);
    const base = page.nodes.map((node) => ({ ...node }));

    const badType = base.map((node) => node.key === child.key
        ? { ...node, type: "script" }
        : node);
    const typeResponse = await call(env, `/api/admin/cms/visual-pages/${page.id}`, {
        admin: true,
        method: "PATCH",
        body: { expectedUpdatedAt: page.updatedAt, nodes: badType }
    });
    assert.equal(typeResponse.response.status, 400);

    const badRoot = base.map((node) => node.key === root.key
        ? { ...node, parentKey: child.key }
        : node);
    const rootResponse = await call(env, `/api/admin/cms/visual-pages/${page.id}`, {
        admin: true,
        method: "PATCH",
        body: { expectedUpdatedAt: page.updatedAt, nodes: badRoot }
    });
    assert.equal(rootResponse.response.status, 400);

    const contentChildren = base.filter((node) => !node.root);
    const invalidNested = base.map((node) => node.key === contentChildren[1].key
        ? { ...node, parentKey: contentChildren[0].key, position: 1 }
        : node);
    renumber(invalidNested);
    const nestedResponse = await call(env, `/api/admin/cms/visual-pages/${page.id}`, {
        admin: true,
        method: "PATCH",
        body: { expectedUpdatedAt: page.updatedAt, nodes: invalidNested }
    });
    assert.equal(nestedResponse.response.status, 400);
});

test("il pannello offre comandi equivalenti per mouse, tocco e tastiera", async () => {
    const [html, source, css] = await Promise.all([
        readFile(new URL("../../admin.html", import.meta.url), "utf8"),
        readFile(new URL("../../admin-visual-builder.js", import.meta.url), "utf8"),
        readFile(new URL("../../style.css", import.meta.url), "utf8")
    ]);
    for (const id of [
        "adminVisualPageSelect", "adminVisualPalette", "adminVisualAdd",
        "adminVisualUndo", "adminVisualCanvas", "adminVisualSave",
        "adminVisualReload", "adminVisualStatus"
    ]) {
        assert.match(html, new RegExp(`id="${id}"`, "u"), id);
    }
    for (const operation of ["up", "down", "indent", "outdent", "duplicate", "remove"]) {
        assert.ok(source.includes(`["${operation}"`), operation);
    }
    assert.match(source, /\.draggable = !node\.root/u);
    assert.match(source, /addEventListener\("drop"/u);
    assert.match(source, /event\.altKey/u);
    assert.match(source, /ArrowUp/u);
    assert.match(source, /undoStack/u);
    assert.match(source, /beforeunload/u);
    assert.match(source, /aria-selected/u);
    assert.match(css, /min-height:\s*2\.75rem/u);
    assert.match(css, /@media \(max-width: 700px\)/u);
    assert.match(html, /admin-visual-builder\.js\?v=20261018-behavior1/u);
});
