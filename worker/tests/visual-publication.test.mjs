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

test("isola la bozza, blocca una pubblicazione non valida e pubblica in modo atomico", async () => {
    const env = environment();
    const denied = await call(env, "/api/admin/cms/visual-publication/page-autore");
    assert.equal(denied.response.status, 401);

    const pages = await call(env, "/api/admin/cms/visual-pages", { admin: true });
    const page = pages.data.pages.find((item) => item.id === "page-autore");
    const heading = page.nodes.find((node) => node.type === "heading");
    const publicBefore = await call(env, "/api/public/visual-pages/autore");
    const originalHtml = publicBefore.data.page.html;
    assert.ok(publicBefore.data.page.compatibilityBlocks.some((block) =>
        block.id === "autore-title" && block.text === "L’autore"
    ));
    const publicIndex = await call(env, "/api/public/visual-pages");
    assert.equal(publicIndex.response.status, 200);
    assert.equal(publicIndex.data.pages.length, 9);
    assert.ok(publicIndex.data.pages.every((item) => item.generated === false));
    assert.equal(
        publicIndex.data.pages.find((item) => item.slug === "accesso").indexable,
        false
    );

    const now = page.updatedAt + 1;
    env.DB.database.prepare(`
        INSERT INTO visual_node_properties (
            node_id, domain, property_set, property_name, breakpoint,
            item_position, value_kind, text_value, created_at, updated_at
        ) VALUES (?, 'behavior', 'behavior.link', 'href', 'all',
            0, 'url', 'javascript:alert(1)', ?, ?)
    `).run(heading.key, now, now);
    env.DB.database.prepare(`
        UPDATE visual_trees SET status = 'draft', updated_at = ? WHERE id = ?
    `).run(now, page.treeId);

    const state = await call(
        env,
        `/api/admin/cms/visual-publication/${page.id}`,
        { admin: true }
    );
    assert.equal(state.response.status, 200);
    assert.equal(state.data.canPublish, false);
    assert.ok(state.data.audit.errors.some((issue) =>
        issue.category === "links" && issue.nodeId === heading.key
    ));

    const blocked = await call(
        env,
        `/api/admin/cms/visual-publication/${page.id}/publish`,
        {
            admin: true,
            method: "PATCH",
            body: { expectedUpdatedAt: now }
        }
    );
    assert.equal(blocked.response.status, 409);
    const publicAfterError = await call(env, "/api/public/visual-pages/autore");
    assert.equal(publicAfterError.data.page.html, originalHtml);

    env.DB.database.prepare(`
        DELETE FROM visual_node_properties
        WHERE node_id = ? AND property_set = 'behavior.link'
            AND property_name = 'href'
    `).run(heading.key);
    const fixedAt = now + 1;
    env.DB.database.prepare(`
        UPDATE visual_trees SET updated_at = ? WHERE id = ?
    `).run(fixedAt, page.treeId);

    const fixedPages = await call(env, "/api/admin/cms/visual-pages", { admin: true });
    const fixedPage = fixedPages.data.pages.find((item) => item.id === page.id);
    const fixedHeading = fixedPage.nodes.find((node) => node.key === heading.key);
    const saved = await call(
        env,
        `/api/admin/cms/visual-properties/${page.id}/${heading.key}`,
        {
            admin: true,
            method: "PATCH",
            body: {
                expectedUpdatedAt: fixedPage.updatedAt,
                values: { ...fixedHeading.values, title: "Titolo pronto per il pubblico" }
            }
        }
    );
    assert.equal(saved.response.status, 200);
    const stillPublic = await call(env, "/api/public/visual-pages/autore");
    assert.equal(stillPublic.data.page.html, originalHtml);

    const preview = await call(
        env,
        `/api/admin/cms/visual-preview/${page.id}`,
        { admin: true }
    );
    assert.equal(preview.response.status, 200);
    assert.equal(preview.data.page.metadata.robots, "noindex,nofollow");
    assert.match(preview.data.page.html, /Titolo pronto per il pubblico/u);

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
    assert.equal(published.data.checksum.length, 64);
    const publicAfterPublish = await call(env, "/api/public/visual-pages/autore");
    assert.match(publicAfterPublish.data.page.html, /Titolo pronto per il pubblico/u);
    assert.equal(publicAfterPublish.data.page.revisionNumber, published.data.revisionNumber);
});

test("ripristina una revisione come nuova bozza senza riscrivere la cronologia o il pubblico", async () => {
    const env = environment();
    const pages = await call(env, "/api/admin/cms/visual-pages", { admin: true });
    const page = pages.data.pages.find((item) => item.id === "page-autore");
    const heading = page.nodes.find((node) => node.type === "heading");
    const saved = await call(
        env,
        `/api/admin/cms/visual-properties/${page.id}/${heading.key}`,
        {
            admin: true,
            method: "PATCH",
            body: {
                expectedUpdatedAt: page.updatedAt,
                values: { ...heading.values, title: "Versione pubblicata da recuperare" }
            }
        }
    );
    const published = await call(
        env,
        `/api/admin/cms/visual-publication/${page.id}/publish`,
        {
            admin: true,
            method: "PATCH",
            body: { expectedUpdatedAt: saved.data.page.updatedAt }
        }
    );
    const publicHtml = (await call(env, "/api/public/visual-pages/autore")).data.page.html;
    const state = published.data.state;
    const baseline = state.revisions.find((revision) =>
        revision.revisionNumber === 1 && revision.restorable
    );
    assert.ok(baseline);

    const restored = await call(
        env,
        `/api/admin/cms/visual-publication/${page.id}/restore/${baseline.revisionNumber}`,
        {
            admin: true,
            method: "POST",
            body: { expectedUpdatedAt: state.draftUpdatedAt }
        }
    );
    assert.equal(restored.response.status, 200);
    assert.equal(restored.data.publishedUnchanged, true);
    assert.equal(
        (await call(env, "/api/public/visual-pages/autore")).data.page.html,
        publicHtml
    );
    assert.ok(restored.data.state.revisions.length > state.revisions.length);
    assert.equal(restored.data.state.comparison.changed, true);
});

test("il pannello espone preview, preflight, confronto, redo e recupero", async () => {
    const [html, source, css] = await Promise.all([
        readFile(new URL("../../admin.html", import.meta.url), "utf8"),
        readFile(new URL("../../admin-visual-builder.js", import.meta.url), "utf8"),
        readFile(new URL("../../admin-visual-builder.css", import.meta.url), "utf8")
    ]);
    for (const id of [
        "adminVisualRedo", "adminVisualPreflight", "adminVisualServerPreview",
        "adminVisualComparePage", "adminVisualPublishPage",
        "adminVisualRevisionSelect", "adminVisualRestoreRevision"
    ]) assert.match(html, new RegExp(`id="${id}"`, "u"));
    assert.match(source, /redoStack/u);
    assert.match(source, /visual-preview/u);
    assert.match(source, /visual-publication/u);
    assert.match(source, /noindex,nofollow/u);
    assert.match(css, /admin-visual-publication-actions/u);
});
