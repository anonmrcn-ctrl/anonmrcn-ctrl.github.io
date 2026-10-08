import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import vm from "node:vm";

import worker from "../src/index.js";
import {
    WELCOME_INTRO_SEED,
    WELCOME_STEP_SEEDS
} from "../src/onboarding-seed.js";

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

async function call(env) {
    const request = new Request(
        "https://worker.test/api/public/onboarding/welcome",
        { headers: { Origin: env.ALLOWED_ORIGIN } }
    );
    const response = await worker.fetch(request, env, {});
    return { response, data: await response.json() };
}

test("importa una sola volta introduzione e cinque schermate del tour", async () => {
    const env = createEnvironment();
    const initial = await call(env);

    assert.equal(initial.response.status, 200);
    assert.deepEqual(
        {
            title: initial.data.intro.title,
            subtitle: initial.data.intro.subtitle
        },
        WELCOME_INTRO_SEED
    );
    assert.deepEqual(
        initial.data.steps.map((step) => step.id),
        WELCOME_STEP_SEEDS.map((step) => step.id)
    );
    assert.deepEqual(
        initial.data.steps[3].markers,
        WELCOME_STEP_SEEDS[3].action.markers
    );

    const repeated = await call(env);
    assert.equal(repeated.response.status, 200);
    assert.equal(
        env.DB.database.prepare(
            "SELECT COUNT(*) AS total FROM onboarding_steps"
        ).get().total,
        WELCOME_STEP_SEEDS.length
    );
    assert.equal(
        env.DB.database.prepare(`
            SELECT COUNT(*) AS total
            FROM content_initializations
            WHERE name = 'onboarding_welcome_v1'
        `).get().total,
        1
    );
});

test("l’API pubblica esclude le bozze e le impostazioni private", async () => {
    const env = createEnvironment();
    await call(env);
    env.DB.database.prepare(`
        UPDATE onboarding_steps SET status = 'draft'
        WHERE id = 'welcome-map'
    `).run();

    const filtered = await call(env);
    assert.equal(filtered.response.status, 200);
    assert.equal(filtered.data.steps.length, WELCOME_STEP_SEEDS.length - 1);
    assert.ok(!filtered.data.steps.some((step) => step.id === "welcome-map"));

    env.DB.database.prepare(`
        UPDATE site_settings SET visibility = 'private'
        WHERE setting_key = 'onboarding.welcome.intro'
    `).run();
    const hidden = await call(env);
    assert.equal(hidden.response.status, 404);
});

function extractFallback(source, name, type) {
    const close = type === "array" ? "\\]" : "\\}";
    const match = source.match(new RegExp(
        `const ${name} = Object\\.freeze\\((${type === "array" ? "\\[" : "\\{"}[\\s\\S]*?${close})\\);`,
        "u"
    ));
    assert.ok(match, `${name} non trovato`);
    return JSON.parse(JSON.stringify(vm.runInNewContext(`(${match[1]})`)));
}

test("il ripiego statico conserva esattamente testi, URL e indicatori", async () => {
    const source = await readFile(
        new URL("../../sessione.js", import.meta.url),
        "utf8"
    );
    const intro = extractFallback(source, "WELCOME_INTRO_FALLBACK", "object");
    const features = extractFallback(
        source,
        "WELCOME_FEATURES_FALLBACK",
        "array"
    );
    const expectedFeatures = WELCOME_STEP_SEEDS.map((step) => ({
        title: step.title,
        description: step.body,
        details: step.action.details,
        preview: step.action.preview,
        alt: step.action.alt,
        markers: step.action.markers
    }));

    assert.deepEqual(intro, WELCOME_INTRO_SEED);
    assert.deepEqual(features, expectedFeatures);
    assert.match(source, /const SESSION_KEY = "nnmrcn_session";/u);
    assert.match(source, /localStorage\.getItem\(SESSION_KEY\)/u);
    assert.match(source, /sessionStorage\.getItem\(SESSION_KEY\)/u);
});

async function executeLoader(request) {
    const source = await readFile(
        new URL("../../onboarding-content.js", import.meta.url),
        "utf8"
    );
    const events = [];
    const document = { documentElement: { dataset: {} } };
    const window = {
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
    await window.NNMRCN_ONBOARDING_READY;
    return { document, events, window };
}

test("il client applica il contenuto D1 e segnala la sorgente", async () => {
    const features = WELCOME_STEP_SEEDS.map((step) => ({
        id: step.id,
        title: step.title,
        description: step.body,
        ...step.action
    }));
    const result = await executeLoader(async () => ({
        intro: WELCOME_INTRO_SEED,
        steps: features
    }));

    assert.equal(result.document.documentElement.dataset.cmsOnboardingSource, "d1");
    assert.equal(result.events[0].detail.source, "d1");
    assert.equal(result.window.NNMRCN_ONBOARDING_CONTENT.features.length, 5);
    assert.equal(
        result.window.NNMRCN_ONBOARDING_CONTENT.features[0].preview,
        WELCOME_STEP_SEEDS[0].action.preview
    );
});

test("il client mantiene il ripiego statico se il Worker non risponde", async () => {
    const result = await executeLoader(async () => {
        throw new Error("Worker non raggiungibile");
    });

    assert.equal(
        result.document.documentElement.dataset.cmsOnboardingSource,
        "fallback"
    );
    assert.equal(result.events[0].detail.source, "fallback");
    assert.equal(result.window.NNMRCN_ONBOARDING_CONTENT, undefined);
});

test("ogni pagina che usa la sessione carica prima il tour amministrabile", async () => {
    const pageNames = [
        "index",
        "progetto",
        "autore",
        "logo",
        "spazio-pubblico",
        "archivio",
        "memorie",
        "taccuino",
        "spazio-personale",
        "voci",
        "admin",
        "accesso"
    ];

    for (const pageName of pageNames) {
        const html = await readFile(
            new URL(`../../${pageName}.html`, import.meta.url),
            "utf8"
        );
        assert.match(
            html,
            /<script src="\.\/onboarding-content\.js\?v=20261008-onboarding1"><\/script>[\s\S]*?<script src="\.\/sessione\.js\?v=20261008-onboarding1"><\/script>/u,
            pageName
        );
    }
});
