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

test("crea, duplica, pubblica, archivia ed elimina senza spezzare gli URL", async () => {
    const env = environment();
    const denied = await call(env, "/api/admin/cms/visual-pages", {
        method: "POST",
        body: { title: "Negata", slug: "negata" }
    });
    assert.equal(denied.response.status, 401);

    const initial = await call(env, "/api/admin/cms/visual-pages", { admin: true });
    const source = initial.data.pages.find((page) => page.id === "page-progetto");
    const created = await call(env, "/api/admin/cms/visual-pages", {
        admin: true,
        method: "POST",
        body: {
            title: "Pagina autonoma",
            slug: "pagina-autonoma",
            description: "Descrizione della nuova pagina.",
            sourcePageId: source.id,
            includeInNavigation: true
        }
    });
    assert.equal(created.response.status, 201);
    assert.match(created.data.page.id, /^visual-page-/u);
    assert.equal(created.data.page.status, "draft");
    assert.equal(created.data.page.canonicalPath, "/pagina-autonoma.html");

    const listed = await call(env, "/api/admin/cms/visual-pages", { admin: true });
    const page = listed.data.pages.find((item) => item.id === created.data.page.id);
    assert.equal(page.inNavigation, true);
    assert.equal(page.nodes.length, source.nodes.length);
    assert.equal(
        page.nodes.some((node) => source.nodes.some((original) => original.key === node.key)),
        false,
        "la duplicazione assegna nuovi identificativi ai blocchi"
    );

    const changedNodes = page.nodes.map((node) => ({
        ...node,
        label: node.root ? node.label : `${node.label} copia`
    }));
    const canvasSaved = await call(env, `/api/admin/cms/visual-pages/${page.id}`, {
        admin: true,
        method: "PATCH",
        body: { expectedUpdatedAt: page.updatedAt, nodes: changedNodes }
    });
    assert.equal(canvasSaved.response.status, 200);

    const published = await call(
        env,
        `/api/admin/cms/visual-page-lifecycle/${page.id}`,
        {
            admin: true,
            method: "PATCH",
            body: {
                expectedUpdatedAt: canvasSaved.data.page.updatedAt,
                title: "Pagina pubblicata",
                slug: "pagina-pubblicata",
                description: "Una pagina gestita interamente dal pannello visuale.",
                status: "published",
                includeInNavigation: true
            }
        }
    );
    assert.equal(published.response.status, 200);
    assert.equal(published.data.page.canonicalPath, "/pagina-pubblicata.html");
    const publicPage = await call(env, "/api/public/visual-pages/pagina-pubblicata");
    assert.equal(publicPage.response.status, 200);
    assert.match(publicPage.data.page.html, /Pagina pubblicata/u);

    const oldUrl = env.DB.database.prepare(`
        SELECT state, redirect_path FROM permalinks WHERE path = '/pagina-autonoma.html'
    `).get();
    assert.equal(oldUrl.state, "redirect");
    assert.equal(oldUrl.redirect_path, "/pagina-pubblicata.html");
    const activeUrl = env.DB.database.prepare(`
        SELECT state FROM permalinks WHERE path = '/pagina-pubblicata.html'
    `).get();
    assert.equal(activeUrl.state, "active");

    const archived = await call(
        env,
        `/api/admin/cms/visual-page-lifecycle/${page.id}`,
        {
            admin: true,
            method: "PATCH",
            body: {
                expectedUpdatedAt: published.data.page.updatedAt,
                title: published.data.page.title,
                slug: published.data.page.slug,
                description: published.data.page.description,
                status: "archived",
                includeInNavigation: false
            }
        }
    );
    assert.equal(archived.response.status, 200);
    assert.equal(archived.data.page.status, "archived");
    assert.equal((await call(env, "/api/public/visual-pages/pagina-pubblicata")).response.status, 404);

    const recovered = await call(
        env,
        `/api/admin/cms/visual-page-lifecycle/${page.id}`,
        {
            admin: true,
            method: "PATCH",
            body: {
                expectedUpdatedAt: archived.data.page.updatedAt,
                title: archived.data.page.title,
                slug: archived.data.page.slug,
                description: archived.data.page.description,
                status: "draft",
                includeInNavigation: false
            }
        }
    );
    assert.equal(recovered.response.status, 200);
    assert.equal(recovered.data.page.status, "draft");
    const rearchived = await call(
        env,
        `/api/admin/cms/visual-page-lifecycle/${page.id}`,
        {
            admin: true,
            method: "PATCH",
            body: {
                expectedUpdatedAt: recovered.data.page.updatedAt,
                title: recovered.data.page.title,
                slug: recovered.data.page.slug,
                description: recovered.data.page.description,
                status: "archived",
                includeInNavigation: false
            }
        }
    );
    assert.equal(rearchived.response.status, 200);

    const dependencies = await call(
        env,
        `/api/admin/cms/visual-page-dependencies/${page.id}`,
        { admin: true }
    );
    assert.equal(dependencies.response.status, 200);
    assert.equal(dependencies.data.hardDeleteBlocked, false);
    assert.equal(dependencies.data.permalinks.length, 2);

    const badDelete = await call(env, `/api/admin/cms/visual-pages/${page.id}`, {
        admin: true,
        method: "DELETE",
        body: { confirmation: "ELIMINA pagina-pubblicata", redirectPath: "/inesistente.html" }
    });
    assert.equal(badDelete.response.status, 409);

    const replacement = env.DB.database.prepare(`
        SELECT path FROM permalinks
        WHERE state = 'active' AND NOT (target_type = 'site_page' AND target_id = ?)
        ORDER BY path LIMIT 1
    `).get(page.id).path;
    const removed = await call(env, `/api/admin/cms/visual-pages/${page.id}`, {
        admin: true,
        method: "DELETE",
        body: { confirmation: "ELIMINA pagina-pubblicata", redirectPath: replacement }
    });
    assert.equal(removed.response.status, 200);
    assert.equal(removed.data.preservedPermalinks, 2);
    assert.equal(env.DB.database.prepare("SELECT id FROM site_pages WHERE id = ?").get(page.id), undefined);
    assert.equal(env.DB.database.prepare(`
        SELECT count(*) AS total FROM content_revisions
        WHERE entity_type = 'site_page' AND entity_id = ?
    `).get(page.id).total, 5, "la cronologia resta disponibile dopo la cancellazione");
    const redirects = env.DB.database.prepare(`
        SELECT state, redirect_path FROM permalinks
        WHERE target_type = 'site_page' AND target_id = ?
    `).all(page.id);
    assert.equal(redirects.length, 2);
    assert.ok(redirects.every((row) => row.state === "redirect" && row.redirect_path === replacement));
});

test("blocca la cancellazione delle pagine storiche e con dati collegati", async () => {
    const env = environment();
    const initial = await call(env, "/api/admin/cms/visual-pages", { admin: true });
    const legacy = await call(
        env,
        "/api/admin/cms/visual-page-dependencies/page-progetto",
        { admin: true }
    );
    assert.equal(legacy.data.builderManaged, false);
    assert.equal(legacy.data.hardDeleteBlocked, true);

    const created = await call(env, "/api/admin/cms/visual-pages", {
        admin: true,
        method: "POST",
        body: { title: "Pagina collegata", slug: "pagina-collegata", description: "" }
    });
    const targetId = created.data.page.id;
    const sourceNode = initial.data.pages
        .find((page) => page.id === "page-progetto")
        .nodes.find((node) => !node.root).key;
    const now = Date.now();
    env.DB.database.prepare(`
        INSERT INTO visual_node_properties (
            node_id, domain, property_set, property_name, breakpoint,
            item_position, value_kind, page_reference_id, created_at, updated_at
        ) VALUES (?, 'behavior', 'behavior.link', 'page', 'all', 91, 'page', ?, ?, ?)
    `).run(sourceNode, targetId, now, now);

    const archived = await call(
        env,
        `/api/admin/cms/visual-page-lifecycle/${targetId}`,
        {
            admin: true,
            method: "PATCH",
            body: {
                expectedUpdatedAt: created.data.page.updatedAt,
                title: created.data.page.title,
                slug: created.data.page.slug,
                description: "",
                status: "archived",
                includeInNavigation: false
            }
        }
    );
    assert.equal(archived.response.status, 200);
    const dependencies = await call(
        env,
        `/api/admin/cms/visual-page-dependencies/${targetId}`,
        { admin: true }
    );
    assert.equal(dependencies.data.pageReferences.length, 1);
    assert.equal(dependencies.data.hardDeleteBlocked, true);

    const replacement = env.DB.database.prepare(`
        SELECT path FROM permalinks WHERE state = 'active' AND target_id <> ? ORDER BY path LIMIT 1
    `).get(targetId).path;
    const blocked = await call(env, `/api/admin/cms/visual-pages/${targetId}`, {
        admin: true,
        method: "DELETE",
        body: { confirmation: "ELIMINA pagina-collegata", redirectPath: replacement }
    });
    assert.equal(blocked.response.status, 409);
    assert.match(blocked.data.error, /dati collegati/u);
    assert.ok(env.DB.database.prepare("SELECT id FROM site_pages WHERE id = ?").get(targetId));
});

test("la gestione pagine è disponibile senza codice e con conferme esplicite", async () => {
    const [html, source, css] = await Promise.all([
        readFile(new URL("../../admin.html", import.meta.url), "utf8"),
        readFile(new URL("../../admin-visual-builder.js", import.meta.url), "utf8"),
        readFile(new URL("../../admin-visual-builder.css", import.meta.url), "utf8")
    ]);
    for (const id of [
        "adminVisualCreateForm", "adminVisualCreateTemplate",
        "adminVisualLifecycleForm", "adminVisualLifecycleStatus",
        "adminVisualAnalyzeDelete", "adminVisualDependencies",
        "adminVisualDeleteRedirect", "adminVisualDeleteConfirmation",
        "adminVisualDelete"
    ]) assert.match(html, new RegExp(`id="${id}"`, "u"));
    assert.match(source, /visual-page-lifecycle/u);
    assert.match(source, /visual-page-dependencies/u);
    assert.match(source, /ELIMINA/u);
    assert.match(source, /window\.confirm/u);
    assert.match(css, /admin-visual-page-management/u);
    assert.match(css, /admin-visual-danger/u);
    assert.match(html, /admin-visual-builder\.js\?v=20261018-pages1/u);
});
