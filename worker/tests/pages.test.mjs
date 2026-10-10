import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import vm from "node:vm";

import worker from "../src/index.js";
import { PAGE_SEEDS } from "../src/page-seed.js";

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

async function call(env, path) {
    const request = new Request(`https://worker.test${path}`, {
        headers: { Origin: env.ALLOWED_ORIGIN }
    });
    const response = await worker.fetch(request, env, {});
    return {
        response,
        data: await response.json()
    };
}

test("importa una sola volta tutte le pagine e restituisce i blocchi ordinati", async () => {
    const env = createEnvironment();
    const expectedBlocks = PAGE_SEEDS.reduce(
        (total, page) => total + page.blocks.length,
        0
    );

    const initial = await call(env, "/api/public/pages/progetto");
    assert.equal(initial.response.status, 200);
    assert.equal(initial.data.page.slug, "progetto");
    assert.deepEqual(
        initial.data.page.blocks.map((block) => block.id),
        PAGE_SEEDS[0].blocks.map((block) => block.id)
    );
    assert.equal(
        initial.data.page.blocks[1].content.text,
        PAGE_SEEDS[0].blocks[1].content.text
    );

    const repeated = await call(env, "/api/public/pages/progetto");
    assert.equal(repeated.response.status, 200);
    assert.equal(
        env.DB.database.prepare("SELECT COUNT(*) AS total FROM site_pages").get().total,
        PAGE_SEEDS.length,
        "l’inizializzazione ripetuta non deve duplicare le pagine"
    );
    assert.equal(
        env.DB.database.prepare("SELECT COUNT(*) AS total FROM page_blocks").get().total,
        expectedBlocks,
        "l’inizializzazione ripetuta non deve duplicare i blocchi"
    );
    assert.equal(
        env.DB.database.prepare(`
            SELECT COUNT(*) AS total
            FROM content_initializations
            WHERE name = 'site_pages_v1'
        `).get().total,
        1
    );
});

test("l’API pubblica non espone pagine inesistenti o non pubblicate", async () => {
    const env = createEnvironment();

    const missing = await call(env, "/api/public/pages/non-esiste");
    assert.equal(missing.response.status, 404);

    await call(env, "/api/public/pages/autore");
    env.DB.database.prepare(`
        UPDATE site_pages SET status = 'draft' WHERE slug = 'autore'
    `).run();

    const draft = await call(env, "/api/public/pages/autore");
    assert.equal(draft.response.status, 404);
});

test("ogni pagina conserva un blocco statico per ciascun contenuto D1", async () => {
    for (const page of PAGE_SEEDS) {
        const html = await readFile(
            new URL(`../../${page.slug}.html`, import.meta.url),
            "utf8"
        );
        const markers = Array.from(
            html.matchAll(/data-cms-block="([^"]+)"/gu),
            (match) => match[1]
        );
        const expected = page.blocks.map((block) => block.id);

        assert.match(
            html,
            new RegExp(`<body[^>]+data-cms-page="${page.slug}"`, "u"),
            `${page.slug}.html deve dichiarare la propria pagina CMS`
        );
        assert.deepEqual(
            [...markers].sort(),
            [...expected].sort(),
            `${page.slug}.html deve mantenere esattamente i blocchi importati`
        );
        assert.equal(
            new Set(markers).size,
            markers.length,
            `${page.slug}.html non deve duplicare gli identificativi dei blocchi`
        );
        assert.match(
            html,
            /<script(?: defer)? src="\.\/api\.js"><\/script>[\s\S]*?<script(?: defer)? src="\.\/page-content\.js\?v=20261008-pages1"><\/script>/u,
            `${page.slug}.html deve caricare il contenuto dopo il client API`
        );
    }
});

async function executePageLoader(request) {
    const source = await readFile(
        new URL("../../page-content.js", import.meta.url),
        "utf8"
    );
    const target = {
        dataset: { cmsBlock: "progetto-title" },
        textContent: "Titolo statico"
    };
    let finish;
    const ready = new Promise((resolve) => {
        finish = resolve;
    });
    const document = {
        body: { dataset: { cmsPage: "progetto" } },
        documentElement: { dataset: {} },
        querySelectorAll: () => [target]
    };
    const window = {
        NNMRCN_API: { request },
        dispatchEvent: (event) => finish(event)
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

    return { document, event: await ready, target };
}

test("il client applica D1 senza sostituire gli elementi interattivi", async () => {
    const result = await executePageLoader(async () => ({
        page: {
            blocks: [{
                id: "progetto-title",
                content: { text: "Titolo da D1" }
            }]
        }
    }));

    assert.equal(result.target.textContent, "Titolo da D1");
    assert.equal(result.document.documentElement.dataset.cmsPageSource, "d1");
    assert.equal(result.event.detail.slug, "progetto");
    assert.equal(result.event.detail.source, "d1");
});

test("il client conserva il testo statico quando D1 non è raggiungibile", async () => {
    const result = await executePageLoader(async () => {
        throw new Error("Worker non raggiungibile");
    });

    assert.equal(result.target.textContent, "Titolo statico");
    assert.equal(result.document.documentElement.dataset.cmsPageSource, "fallback");
    assert.equal(result.event.detail.slug, "progetto");
    assert.equal(result.event.detail.source, "fallback");
});
