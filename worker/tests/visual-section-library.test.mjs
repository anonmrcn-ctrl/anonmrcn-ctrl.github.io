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
        for (let index = 0; index < left.byteLength; index += 1) difference |= left[index] ^ right[index];
        return difference === 0;
    };
}

class D1StatementMock {
    constructor(database, sql) { this.database = database; this.sql = sql; this.values = []; }
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

test("salva, duplica, collega, sincronizza e scollega sezioni visuali", async () => {
    const env = environment();
    const denied = await call(env, "/api/admin/cms/visual-sections");
    assert.equal(denied.response.status, 401);
    const initial = await call(env, "/api/admin/cms/visual-pages", { admin: true });
    const page = initial.data.pages.find((item) => item.id === "page-autore");
    const root = page.nodes.find((node) => node.root);
    const first = page.nodes.find((node) => node.parentKey === root.key);
    const second = page.nodes.find((node) => node.parentKey === root.key && node.key !== first.key);

    const created = await call(env, "/api/admin/cms/visual-sections", {
        admin: true,
        method: "POST",
        body: { name: "Sezione biografia", pageId: page.id, nodeId: first.key }
    });
    assert.equal(created.response.status, 201);
    assert.equal(created.data.section.status, "draft");
    assert.equal(created.data.section.impactCount, 0);
    const sectionId = created.data.section.id;

    const blockedInsert = await call(env, `/api/admin/cms/visual-sections/${sectionId}/insert`, {
        admin: true,
        method: "POST",
        body: {
            pageId: page.id,
            parentNodeId: root.key,
            expectedUpdatedAt: page.updatedAt,
            mode: "linked"
        }
    });
    assert.equal(blockedInsert.response.status, 409);

    const published = await call(env, `/api/admin/cms/visual-sections/${sectionId}/publish`, {
        admin: true,
        method: "PATCH",
        body: { expectedUpdatedAt: created.data.section.updatedAt }
    });
    assert.equal(published.response.status, 200);
    assert.equal(published.data.synchronized, 0);

    const inserted = await call(env, `/api/admin/cms/visual-sections/${sectionId}/insert`, {
        admin: true,
        method: "POST",
        body: {
            pageId: page.id,
            parentNodeId: root.key,
            expectedUpdatedAt: page.updatedAt,
            mode: "linked"
        }
    });
    assert.equal(inserted.response.status, 200);
    assert.equal(inserted.data.linked, true);

    const impact = await call(env, `/api/admin/cms/visual-sections/${sectionId}/impact`, { admin: true });
    assert.equal(impact.data.impactCount, 1);
    assert.equal(impact.data.pages[0].page_id, page.id);

    const updated = await call(env, `/api/admin/cms/visual-sections/${sectionId}`, {
        admin: true,
        method: "PATCH",
        body: {
            name: "Sezione biografia aggiornata",
            pageId: page.id,
            nodeId: second.key,
            expectedUpdatedAt: published.data.section.updatedAt
        }
    });
    assert.equal(updated.response.status, 200);
    assert.equal(updated.data.section.status, "draft");
    const republished = await call(env, `/api/admin/cms/visual-sections/${sectionId}/publish`, {
        admin: true,
        method: "PATCH",
        body: { expectedUpdatedAt: updated.data.section.updatedAt }
    });
    assert.equal(republished.response.status, 200);
    assert.equal(republished.data.synchronized, 1);

    const refreshed = await call(env, "/api/admin/cms/visual-pages", { admin: true });
    const refreshedPage = refreshed.data.pages.find((item) => item.id === page.id);
    const linkedNode = refreshedPage.nodes.find((node) => node.key === inserted.data.nodeId);
    assert.equal(linkedNode.label, second.label);

    const unlinked = await call(
        env,
        `/api/admin/cms/visual-section-links/${page.id}/${inserted.data.nodeId}`,
        {
            admin: true,
            method: "DELETE",
            body: { expectedUpdatedAt: refreshedPage.updatedAt }
        }
    );
    assert.equal(unlinked.response.status, 200);
    assert.equal((await call(
        env,
        `/api/admin/cms/visual-sections/${sectionId}/impact`,
        { admin: true }
    )).data.impactCount, 0);
    assert.ok(env.DB.database.prepare("SELECT id FROM visual_nodes WHERE id = ?").get(inserted.data.nodeId));

    const duplicated = await call(env, `/api/admin/cms/visual-sections/${sectionId}/duplicate`, {
        admin: true,
        method: "POST",
        body: { name: "Sezione biografia alternativa" }
    });
    assert.equal(duplicated.response.status, 201);
    assert.notEqual(duplicated.data.section.id, sectionId);
    assert.equal(duplicated.data.section.status, "draft");

    const copyInserted = await call(env, `/api/admin/cms/visual-sections/${sectionId}/insert`, {
        admin: true,
        method: "POST",
        body: {
            pageId: page.id,
            parentNodeId: root.key,
            expectedUpdatedAt: unlinked.data.updatedAt,
            mode: "copy"
        }
    });
    assert.equal(copyInserted.response.status, 200);
    assert.equal(copyInserted.data.linked, false);
    assert.equal(env.DB.database.prepare(`
        SELECT count(*) AS total FROM visual_reusable_instances WHERE section_id = ?
    `).get(sectionId).total, 0);
});

test("il pannello offre libreria, impatto e parti globali senza codice", async () => {
    const [html, source] = await Promise.all([
        readFile(new URL("../../admin.html", import.meta.url), "utf8"),
        readFile(new URL("../../admin-visual-builder.js", import.meta.url), "utf8")
    ]);
    for (const id of [
        "adminVisualLibraryName", "adminVisualLibrarySelect",
        "adminVisualLibrarySave", "adminVisualLibraryUpdate",
        "adminVisualLibraryInsertLinked", "adminVisualLibraryInsertCopy",
        "adminVisualLibraryUnlink", "adminVisualLibraryImpact",
        "adminVisualLibraryPublish"
    ]) assert.match(html, new RegExp(`id="${id}"`, "u"));
    assert.match(html, /intestazione, menu,\s*piè di pagina e avvisi globali/iu);
    assert.match(source, /visual-sections/u);
    assert.match(source, /visual-section-links/u);
    assert.match(source, /impactCount/u);
});
