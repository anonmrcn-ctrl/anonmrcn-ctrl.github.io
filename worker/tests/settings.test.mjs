import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import vm from "node:vm";

import worker from "../src/index.js";
import { CMS_STORAGE_STATEMENTS } from "../src/cms-schema.js";
import {
    LEGACY_SITE_METADATA_PAGES_V1,
    SITE_SETTINGS_SEEDS
} from "../src/settings-seed.js";

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
        ALLOWED_ORIGIN: "https://anonmrcn-ctrl.github.io"
    };
}

function createLegacyEnvironment() {
    const env = createEnvironment();
    env.DB.database.exec(CMS_STORAGE_STATEMENTS.join(";\n"));
    env.DB.database.prepare(`
        INSERT INTO site_settings (
            setting_key, value_json, visibility, status, updated_at, published_at
        ) VALUES ('site.metadata.pages', ?, 'public', 'published', 1, 1)
    `).run(JSON.stringify(LEGACY_SITE_METADATA_PAGES_V1));
    env.DB.database.prepare(`
        INSERT INTO content_initializations (name, applied_at)
        VALUES ('site_settings_v1', 1)
    `).run();
    return env;
}

async function call(env) {
    const response = await worker.fetch(new Request(
        "https://worker.test/api/public/settings/site",
        { headers: { Origin: env.ALLOWED_ORIGIN } }
    ), env, {});
    return { response, data: await response.json() };
}

function setting(key) {
    return SITE_SETTINGS_SEEDS.find((item) => item.key === key)?.value;
}

test("importa una sola volta soltanto impostazioni editoriali pubbliche", async () => {
    const env = createEnvironment();
    const initial = await call(env);

    assert.equal(initial.response.status, 200);
    assert.deepEqual(
        Object.keys(initial.data.settings).sort(),
        SITE_SETTINGS_SEEDS.map((item) => item.key).sort()
    );
    assert.equal(initial.data.settings["site.identity"].name, "anonMrcn");

    await call(env);
    assert.equal(
        env.DB.database.prepare(`
            SELECT COUNT(*) AS total
            FROM site_settings
            WHERE setting_key LIKE 'site.%'
        `).get().total,
        SITE_SETTINGS_SEEDS.length
    );
    assert.equal(
        env.DB.database.prepare(`
            SELECT COUNT(*) AS total
            FROM content_initializations
            WHERE name = 'site_settings_v1'
        `).get().total,
        1
    );
    assert.equal(
        env.DB.database.prepare(`
            SELECT COUNT(*) AS total
            FROM content_initializations
            WHERE name = 'site_metadata_seo_v1'
        `).get().total,
        1
    );
    assert.equal(
        env.DB.database.prepare(`
            SELECT COUNT(*) AS total
            FROM content_initializations
            WHERE name = 'site_metadata_social_v2'
        `).get().total,
        1
    );
});

test("migra una sola volta i metadati legacy senza sovrascrivere personalizzazioni", async () => {
    const legacy = createLegacyEnvironment();
    const migrated = await call(legacy);
    assert.deepEqual(
        migrated.data.settings["site.metadata.pages"],
        setting("site.metadata.pages")
    );
    assert.equal(
        legacy.DB.database.prepare(`
            SELECT COUNT(*) AS total FROM content_initializations
            WHERE name = 'site_metadata_seo_v1'
        `).get().total,
        1
    );

    const customized = createLegacyEnvironment();
    const customPages = structuredClone(LEGACY_SITE_METADATA_PAGES_V1);
    customPages.index.title = "Titolo personalizzato";
    customized.DB.database.prepare(`
        UPDATE site_settings SET value_json = ?
        WHERE setting_key = 'site.metadata.pages'
    `).run(JSON.stringify(customPages));

    const preserved = await call(customized);
    assert.equal(
        preserved.data.settings["site.metadata.pages"].index.title,
        "Titolo personalizzato"
    );
    assert.equal(
        preserved.data.settings["site.metadata.pages"].index.socialImage,
        "https://anonmrcn-ctrl.github.io/logo.PNG"
    );
});

test("l’API esclude impostazioni private, bozze e chiavi non editoriali", async () => {
    const env = createEnvironment();
    await call(env);
    env.DB.database.prepare(`
        UPDATE site_settings SET visibility = 'private'
        WHERE setting_key = 'site.identity'
    `).run();
    env.DB.database.prepare(`
        UPDATE site_settings SET status = 'draft'
        WHERE setting_key = 'site.manifest.admin'
    `).run();
    env.DB.database.prepare(`
        INSERT INTO site_settings (
            setting_key, value_json, visibility, status, updated_at, published_at
        ) VALUES ('technical.worker.url', '"https://example.invalid"',
            'public', 'published', 1, 1)
    `).run();

    const filtered = await call(env);
    assert.equal(filtered.data.settings["site.identity"], undefined);
    assert.equal(filtered.data.settings["site.manifest.admin"], undefined);
    assert.equal(filtered.data.settings["technical.worker.url"], undefined);
});

test("titoli e descrizioni D1 coincidono con i quattordici ripieghi HTML", async () => {
    const pages = setting("site.metadata.pages");

    assert.equal(Object.keys(pages).length, 14);
    for (const [key, metadata] of Object.entries(pages)) {
        const html = await readFile(
            new URL(`../../${key}.html`, import.meta.url),
            "utf8"
        );
        const title = html.match(/<title>([^<]*)<\/title>/u)?.[1] || "";
        const description = html.match(
            /<meta name="description" content="([^"]*)">/u
        )?.[1] || "";

        assert.equal(metadata.title, title, `${key}.html title`);
        assert.equal(metadata.description, description, `${key}.html description`);
        assert.equal(
            metadata.socialImage,
            "https://anonmrcn-ctrl.github.io/logo.PNG",
            `${key}.html social image`
        );
        assert.match(
            html,
            /<script src="\.\/api\.js"><\/script>[\s\S]*?<script src="\.\/site-metadata\.js\?v=20261009-seo2"><\/script>/u,
            key
        );
    }
});

test("i valori editoriali dei manifest coincidono senza migrare opzioni tecniche", async () => {
    const publicManifest = JSON.parse(await readFile(
        new URL("../../manifest.webmanifest", import.meta.url),
        "utf8"
    ));
    const adminManifest = JSON.parse(await readFile(
        new URL("../../admin.webmanifest", import.meta.url),
        "utf8"
    ));
    const publicSetting = setting("site.manifest.public");
    const adminSetting = setting("site.manifest.admin");

    assert.deepEqual(publicSetting, {
        name: publicManifest.name,
        shortName: publicManifest.short_name,
        description: publicManifest.description
    });
    assert.deepEqual(adminSetting, {
        name: adminManifest.name,
        shortName: adminManifest.short_name,
        description: adminManifest.description
    });

    const serialized = JSON.stringify(SITE_SETTINGS_SEEDS);
    assert.doesNotMatch(serialized, /nnmrcn-rete\.anonmrcn\.workers\.dev/u);
    assert.doesNotMatch(serialized, /NNMRCN_ANALYTICS_TOKEN/u);
    assert.doesNotMatch(serialized, /theme_color|background_color|start_url|icons/u);

    const config = await readFile(
        new URL("../../config.js", import.meta.url),
        "utf8"
    );
    assert.match(config, /window\.NNMRCN_API_BASE/u);
    assert.match(config, /window\.NNMRCN_ANALYTICS_TOKEN/u);
});

async function executeLoader(request, pathname = "/progetto.html") {
    const source = await readFile(
        new URL("../../site-metadata.js", import.meta.url),
        "utf8"
    );
    const description = { content: "Ripiego" };
    const social = {
        "og:title": { content: "Titolo statico" },
        "og:description": { content: "Ripiego" },
        "og:image": { content: "https://example.invalid/fallback.png" }
    };
    const events = [];
    const document = {
        title: "Titolo statico",
        documentElement: { dataset: {} },
        head: { appendChild() {} },
        querySelector: (selector) => {
            if (selector === 'meta[name="description"]') return description;
            const property = selector.match(/^meta\[property="([^"]+)"\]$/u)?.[1];
            return property ? social[property] || null : null;
        },
        createElement: () => ({
            setAttribute(name, value) {
                this[name] = value;
            }
        })
    };
    const window = {
        location: { pathname },
        NNMRCN_API: { request },
        dispatchEvent: (event) => events.push(event)
    };

    vm.runInNewContext(source, {
        CustomEvent: class CustomEvent {
            constructor(type, options) {
                this.type = type;
                this.detail = options.detail;
            }
        },
        document,
        window
    });
    await new Promise((resolve) => setImmediate(resolve));
    return { description, document, events, social, window };
}

test("il client applica D1 e mantiene il metadato statico in caso di errore", async () => {
    const settings = Object.fromEntries(
        SITE_SETTINGS_SEEDS.map((item) => [item.key, item.value])
    );
    const success = await executeLoader(async () => ({ settings }));

    assert.equal(success.document.title, "Mappa poetica e storica di Marcon — nnMrcn");
    assert.equal(
        success.description.content,
        "Esplora i luoghi della poesia, la mappa storica di Marcon del 1975 e le trasformazioni del territorio attraverso il progetto nnMrcn."
    );
    assert.equal(
        success.social["og:image"].content,
        "https://anonmrcn-ctrl.github.io/logo.PNG"
    );
    assert.equal(success.document.documentElement.dataset.cmsMetadataSource, "d1");
    assert.equal(success.events[0].detail.source, "d1");

    const failed = await executeLoader(async () => {
        throw new Error("Worker non raggiungibile");
    });
    assert.equal(failed.document.title, "Titolo statico");
    assert.equal(failed.description.content, "Ripiego");
    assert.equal(
        failed.document.documentElement.dataset.cmsMetadataSource,
        "fallback"
    );
});
