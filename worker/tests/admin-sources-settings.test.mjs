import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

import worker from "../src/index.js";

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

function sourceUpdate(source, overrides = {}) {
    return {
        type: source.type,
        title: source.title,
        author: source.author,
        publicationDate: source.publicationDate,
        url: source.url,
        note: source.note,
        status: source.status,
        expectedUpdatedAt: source.updatedAt,
        ...overrides
    };
}

test("protegge e aggiorna il catalogo fonti conservando ID e collegamenti", async () => {
    const env = environment();
    const denied = await call(env, "/api/admin/cms/sources");
    const listed = await call(env, "/api/admin/cms/sources", { admin: true });
    assert.equal(denied.response.status, 401);
    assert.equal(listed.response.status, 200);
    assert.ok(listed.data.sources.length >= 17);

    const source = listed.data.sources.find(
        (item) => item.id === "source-zero-wikipedia"
    );
    assert.ok(source.links.length > 0);
    const updated = await call(env, `/api/admin/cms/sources/${source.id}`, {
        admin: true,
        method: "PATCH",
        body: sourceUpdate(source, { note: "Consultata per il corso del fiume." })
    });
    assert.equal(updated.response.status, 200);
    assert.equal(updated.data.source.id, source.id);
    assert.deepEqual(updated.data.source.links, source.links);
    assert.equal(updated.data.source.note, "Consultata per il corso del fiume.");
    assert.equal(env.DB.database.prepare(`
        SELECT COUNT(*) AS total FROM content_revisions
        WHERE entity_type = 'source' AND entity_id = ?
    `).get(source.id).total, 2);

    const stale = await call(env, `/api/admin/cms/sources/${source.id}`, {
        admin: true,
        method: "PATCH",
        body: sourceUpdate(source, { title: "Sovrascrittura" })
    });
    assert.equal(stale.response.status, 409);
});

test("crea fonti con ID stabile e rifiuta URL non sicuri", async () => {
    const env = environment();
    const created = await call(env, "/api/admin/cms/sources", {
        admin: true,
        method: "POST",
        body: {
            type: "book",
            title: "Archivio del territorio",
            author: "Autore locale",
            publicationDate: "2026",
            url: "https://example.org/fonte",
            note: "Nuova scheda bibliografica."
        }
    });
    assert.equal(created.response.status, 201);
    assert.match(created.data.source.id, /^source-[0-9a-f-]{36}$/u);
    assert.equal(created.data.source.links.length, 0);
    assert.equal(env.DB.database.prepare(`
        SELECT COUNT(*) AS total FROM content_revisions
        WHERE entity_type = 'source' AND entity_id = ?
    `).get(created.data.source.id).total, 1);

    const invalid = await call(env, "/api/admin/cms/sources", {
        admin: true,
        method: "POST",
        body: { type: "web", title: "Non sicura", url: "javascript:alert(1)" }
    });
    assert.equal(invalid.response.status, 400);
});

test("espone e modifica solo impostazioni editoriali site.*", async () => {
    const env = environment();
    await call(env, "/api/admin/cms/settings", { admin: true });
    env.DB.database.prepare(`
        INSERT INTO site_settings (
            setting_key, value_json, visibility, status, updated_at, published_at
        ) VALUES ('technical.worker.url', '{"url":"https://worker.test"}',
            'private', 'published', 1, 1)
    `).run();

    const listed = await call(env, "/api/admin/cms/settings", { admin: true });
    assert.deepEqual(
        listed.data.settings.map((setting) => setting.key).sort(),
        [
            "site.identity",
            "site.manifest.admin",
            "site.manifest.public",
            "site.metadata.pages"
        ]
    );
    const identity = listed.data.settings.find(
        (setting) => setting.key === "site.identity"
    );
    const updated = await call(env, "/api/admin/cms/settings/site.identity", {
        admin: true,
        method: "PATCH",
        body: {
            value: { ...identity.value, projectName: "nnMrcn — Marcon" },
            expectedUpdatedAt: identity.updatedAt
        }
    });
    assert.equal(updated.response.status, 200);
    assert.equal(updated.data.setting.value.projectName, "nnMrcn — Marcon");
    assert.equal(updated.data.setting.status, identity.status);
    assert.equal(updated.data.setting.visibility, identity.visibility);
    assert.equal(env.DB.database.prepare(`
        SELECT COUNT(*) AS total FROM content_revisions
        WHERE entity_type = 'site_setting' AND entity_id = 'site.identity'
    `).get().total, 2);

    const publicSettings = await call(env, "/api/public/settings/site");
    assert.equal(
        publicSettings.data.settings["site.identity"].projectName,
        "nnMrcn — Marcon"
    );
    const technical = await call(
        env,
        "/api/admin/cms/settings/technical.worker.url",
        { admin: true, method: "PATCH", body: {
            value: { url: "https://evil.example" }, expectedUpdatedAt: 1
        } }
    );
    assert.equal(technical.response.status, 404);
});

test("impedisce di alterare struttura e versione dei metadati pagina", async () => {
    const env = environment();
    const listed = await call(env, "/api/admin/cms/settings", { admin: true });
    const pages = listed.data.settings.find(
        (setting) => setting.key === "site.metadata.pages"
    );
    const missingPage = structuredClone(pages.value);
    delete missingPage.index;
    const invalid = await call(
        env,
        "/api/admin/cms/settings/site.metadata.pages",
        { admin: true, method: "PATCH", body: {
            value: missingPage, expectedUpdatedAt: pages.updatedAt
        } }
    );
    assert.equal(invalid.response.status, 400);

    const stale = await call(
        env,
        "/api/admin/cms/settings/site.metadata.pages",
        { admin: true, method: "PATCH", body: {
            value: pages.value, expectedUpdatedAt: pages.updatedAt - 1
        } }
    );
    assert.equal(stale.response.status, 409);
});

test("il pannello espone editor separati per fonti e impostazioni", async () => {
    const [html, script] = await Promise.all([
        readFile(new URL("../../admin.html", import.meta.url), "utf8"),
        readFile(new URL("../../admin.js", import.meta.url), "utf8")
    ]);
    assert.match(html, /id="adminSourceForm"/u);
    assert.match(html, /id="adminSettingForm"/u);
    assert.match(script, /\/api\/admin\/cms\/sources/u);
    assert.match(script, /\/api\/admin\/cms\/settings/u);
    assert.match(html, /configurazione tecnica\s+restano protetti/u);
    assert.match(html, /id="adminSourcePublicationStatus"/u);
    assert.match(html, /id="adminSettingPublicationStatus"/u);
});

test("bozze di fonti e impostazioni restano escluse dalle API pubbliche", async () => {
    const env = environment();
    const sources = await call(env, "/api/admin/cms/sources", { admin: true });
    const source = sources.data.sources.find(
        (item) => item.id === "source-zero-wikipedia"
    );
    const draftedSource = await call(
        env,
        `/api/admin/cms/sources/${source.id}`,
        { admin: true, method: "PATCH", body: sourceUpdate(source, {
            status: "draft"
        }) }
    );
    assert.equal(draftedSource.response.status, 200);
    assert.equal(draftedSource.data.source.status, "draft");
    const publicSources = await call(
        env,
        "/api/public/sources?contentType=narrative_step&contentId=zero"
    );
    assert.equal(
        publicSources.data.sources.some((item) => item.id === source.id),
        false
    );

    const settings = await call(env, "/api/admin/cms/settings", { admin: true });
    const identity = settings.data.settings.find(
        (setting) => setting.key === "site.identity"
    );
    const draftedSetting = await call(
        env,
        "/api/admin/cms/settings/site.identity",
        { admin: true, method: "PATCH", body: {
            value: identity.value,
            status: "draft",
            expectedUpdatedAt: identity.updatedAt
        } }
    );
    assert.equal(draftedSetting.response.status, 200);
    assert.equal(draftedSetting.data.setting.status, "draft");
    const publicSettings = await call(env, "/api/public/settings/site");
    assert.equal(publicSettings.data.settings["site.identity"], undefined);
    assert.equal(env.DB.database.prepare(`
        SELECT publication_state FROM content_revisions
        WHERE entity_type = 'site_setting' AND entity_id = 'site.identity'
        ORDER BY revision_number DESC LIMIT 1
    `).get().publication_state, "draft");
});

test("l’anteprima protetta legge l’ultima revisione senza pubblicarla", async () => {
    const env = environment();
    const denied = await call(env, "/api/admin/cms/preview");
    assert.equal(denied.response.status, 401);

    const settings = await call(env, "/api/admin/cms/settings", { admin: true });
    const identity = settings.data.settings.find(
        (setting) => setting.key === "site.identity"
    );
    const draftValue = { ...identity.value, projectName: "Anteprima riservata" };
    await call(env, "/api/admin/cms/settings/site.identity", {
        admin: true,
        method: "PATCH",
        body: {
            value: draftValue,
            status: "draft",
            expectedUpdatedAt: identity.updatedAt
        }
    });

    const preview = await call(
        env,
        "/api/admin/cms/preview?entityType=site_setting&entityId=site.identity",
        { admin: true }
    );
    assert.equal(preview.response.status, 200);
    assert.equal(preview.data.previews.length, 1);
    assert.equal(preview.data.previews[0].state, "draft");
    assert.equal(
        preview.data.previews[0].snapshot.value.projectName,
        "Anteprima riservata"
    );
    const publicSettings = await call(env, "/api/public/settings/site");
    assert.equal(publicSettings.data.settings["site.identity"], undefined);

    const missingPair = await call(
        env,
        "/api/admin/cms/preview?entityType=site_setting",
        { admin: true }
    );
    assert.equal(missingPair.response.status, 400);
});

test("consulta e ripristina la cronologia creando una nuova revisione", async () => {
    const env = environment();
    const denied = await call(
        env,
        "/api/admin/cms/revisions?entityType=site_setting&entityId=site.identity"
    );
    assert.equal(denied.response.status, 401);

    const settings = await call(env, "/api/admin/cms/settings", { admin: true });
    const identity = settings.data.settings.find(
        (setting) => setting.key === "site.identity"
    );
    const originalValue = structuredClone(identity.value);
    const changed = await call(env, "/api/admin/cms/settings/site.identity", {
        admin: true,
        method: "PATCH",
        body: {
            value: { ...identity.value, projectName: "Versione da annullare" },
            status: "draft",
            expectedUpdatedAt: identity.updatedAt
        }
    });
    assert.equal(changed.response.status, 200);

    const history = await call(
        env,
        "/api/admin/cms/revisions?entityType=site_setting&entityId=site.identity",
        { admin: true }
    );
    assert.equal(history.response.status, 200);
    assert.deepEqual(
        history.data.revisions.map((revision) => revision.revisionNumber),
        [2, 1]
    );
    assert.equal(history.data.revisions[0].state, "draft");
    assert.equal(history.data.revisions[1].restorable, true);

    const restored = await call(
        env,
        "/api/admin/cms/revisions/site_setting/site.identity/1/restore",
        { admin: true, method: "POST" }
    );
    assert.equal(restored.response.status, 200);
    assert.deepEqual(restored.data.setting.value, originalValue);
    assert.equal(restored.data.setting.status, identity.status);

    const rows = env.DB.database.prepare(`
        SELECT revision_number, snapshot_json, publication_state
        FROM content_revisions
        WHERE entity_type = 'site_setting' AND entity_id = 'site.identity'
        ORDER BY revision_number
    `).all();
    assert.equal(rows.length, 3);
    assert.equal(rows[1].publication_state, "draft");
    assert.deepEqual(JSON.parse(rows[2].snapshot_json), JSON.parse(rows[0].snapshot_json));
    assert.equal(rows[2].publication_state, rows[0].publication_state);

    const unsupported = await call(
        env,
        "/api/admin/cms/revisions/page_block/block-home-intro/1/restore",
        { admin: true, method: "POST" }
    );
    assert.equal(unsupported.response.status, 400);
});

test("il pannello rende l’anteprima senza creare una pagina pubblica", async () => {
    const [html, script] = await Promise.all([
        readFile(new URL("../../admin.html", import.meta.url), "utf8"),
        readFile(new URL("../../admin.js", import.meta.url), "utf8")
    ]);
    assert.match(html, /id="adminPreviewSelect"/u);
    assert.match(html, /non riceve un URL\s+pubblico o indicizzabile/u);
    assert.match(script, /\/api\/admin\/cms\/preview/u);
    assert.match(script, /setAttribute\("sandbox", ""\)/u);
    assert.match(html, /id="adminRevisionComparison"/u);
    assert.match(html, /Ripristina come nuova revisione/u);
    assert.match(script, /\/api\/admin\/cms\/revisions/u);
});
