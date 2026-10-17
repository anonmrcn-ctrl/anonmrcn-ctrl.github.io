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

function change(tokens, group, name, value) {
    return tokens.map((item) => item.group === group && item.name === name
        ? { ...item, value }
        : item);
}

test("crea, confronta, valida, pubblica e ripristina temi globali", async () => {
    const env = environment();
    assert.equal((await call(env, "/api/admin/cms/visual-themes")).response.status, 401);
    await call(env, "/api/admin/cms/visual-pages", { admin: true });
    const initial = await call(env, "/api/admin/cms/visual-themes", { admin: true });
    assert.equal(initial.response.status, 200);
    assert.equal(initial.data.activeThemeId, "theme-default");
    const original = initial.data.themes.find((theme) => theme.id === "theme-default");
    assert.equal(original.tokens.length, 13);
    assert.equal(initial.data.tokenSchema.length, 13);

    const created = await call(env, "/api/admin/cms/visual-themes", {
        admin: true,
        method: "POST",
        body: { name: "Tema leggibile", sourceThemeId: original.id }
    });
    assert.equal(created.response.status, 201);
    assert.equal(created.data.theme.status, "draft");
    let tokens = change(created.data.theme.tokens, "palette", "accent", "#005f73");
    tokens = change(tokens, "typography", "body", "sans");
    tokens = change(tokens, "spacing", "base", "1.5rem");
    tokens = change(tokens, "motion", "duration", 120);
    const saved = await call(env, `/api/admin/cms/visual-themes/${created.data.theme.id}`, {
        admin: true,
        method: "PATCH",
        body: {
            expectedUpdatedAt: created.data.theme.updatedAt,
            name: created.data.theme.name,
            tokens
        }
    });
    assert.equal(saved.response.status, 200);

    const badContrast = await call(env, `/api/admin/cms/visual-themes/${created.data.theme.id}`, {
        admin: true,
        method: "PATCH",
        body: {
            expectedUpdatedAt: saved.data.theme.updatedAt,
            name: saved.data.theme.name,
            tokens: change(saved.data.theme.tokens, "palette", "ink", "#f4f1e8")
        }
    });
    assert.equal(badContrast.response.status, 400);
    assert.match(badContrast.data.error, /Contrasto/u);
    const unsafeMotion = await call(env, `/api/admin/cms/visual-themes/${created.data.theme.id}`, {
        admin: true,
        method: "PATCH",
        body: {
            expectedUpdatedAt: saved.data.theme.updatedAt,
            name: saved.data.theme.name,
            tokens: change(saved.data.theme.tokens, "motion", "respect-reduced", false)
        }
    });
    assert.equal(unsafeMotion.response.status, 400);
    assert.match(unsafeMotion.data.error, /movimento ridotto/u);

    const comparison = await call(
        env,
        `/api/admin/cms/visual-themes/${created.data.theme.id}/compare?other=theme-default`,
        { admin: true }
    );
    assert.equal(comparison.response.status, 200);
    assert.equal(comparison.data.impactCount, 9);
    assert.ok(comparison.data.changes.some((item) => item.name === "accent"));
    assert.ok(comparison.data.changes.some((item) => item.name === "body"));

    const published = await call(env, `/api/admin/cms/visual-themes/${created.data.theme.id}/publish`, {
        admin: true,
        method: "PATCH",
        body: { expectedUpdatedAt: saved.data.theme.updatedAt }
    });
    assert.equal(published.response.status, 200);
    assert.equal(published.data.appliedTo, 9);
    assert.equal(env.DB.database.prepare(`
        SELECT count(*) AS total FROM visual_page_trees WHERE theme_id = ?
    `).get(created.data.theme.id).total, 9);
    const publicPage = await call(env, "/api/public/visual-pages/autore");
    assert.equal(publicPage.response.status, 200);
    assert.equal(publicPage.data.page.theme.id, created.data.theme.id);
    assert.equal(publicPage.data.page.theme.tokens.length, 13);

    const restored = await call(env, "/api/admin/cms/visual-themes/theme-default/publish", {
        admin: true,
        method: "PATCH",
        body: { expectedUpdatedAt: original.updatedAt }
    });
    assert.equal(restored.response.status, 200);
    assert.equal(restored.data.appliedTo, 9);
    assert.equal(env.DB.database.prepare(`
        SELECT count(*) AS total FROM visual_page_trees WHERE theme_id = 'theme-default'
    `).get().total, 9);
    assert.ok(env.DB.database.prepare(`
        SELECT count(*) AS total FROM content_revisions
        WHERE entity_type = 'visual_theme' AND entity_id = ?
    `).get(created.data.theme.id).total >= 3);
});

test("lo studio grafico genera controlli sicuri e anteprima dal vivo", async () => {
    const [html, source, css] = await Promise.all([
        readFile(new URL("../../admin.html", import.meta.url), "utf8"),
        readFile(new URL("../../admin-visual-builder.js", import.meta.url), "utf8"),
        readFile(new URL("../../admin-visual-builder.css", import.meta.url), "utf8")
    ]);
    for (const id of [
        "adminVisualThemeSelect", "adminVisualThemeName", "adminVisualThemeFields",
        "adminVisualThemeCreate", "adminVisualThemeSave", "adminVisualThemeCompare",
        "adminVisualThemePublish", "adminVisualThemeComparison"
    ]) assert.match(html, new RegExp(`id="${id}"`, "u"));
    assert.match(source, /tokenSchema/u);
    assert.match(source, /visual-themes/u);
    assert.match(source, /applyThemePreview/u);
    assert.match(css, /--visual-theme-ink/u);
    assert.match(css, /prefers-reduced-motion:\s*reduce/u);
});
