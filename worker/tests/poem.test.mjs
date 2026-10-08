import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import vm from "node:vm";

import worker from "../src/index.js";
import { POEM_SEED } from "../src/poem-seed.js";

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

test("importa una sola volta opera, canti e versi nell’ordine originale", async () => {
    const env = createEnvironment();
    const initial = await call(
        env,
        "/api/public/poems/il-gajo-tra-i-praelli"
    );

    assert.equal(initial.response.status, 200);
    assert.equal(initial.data.poem.id, POEM_SEED.id);
    assert.equal(initial.data.poem.title, "Il Gajo tra i Praelli");
    assert.deepEqual(
        initial.data.poem.sections.map((section) => section.anchor),
        ["I", "II", "III", "IV"]
    );
    assert.deepEqual(
        initial.data.poem.sections.map((section) => section.lines.length),
        [30, 31, 28, 32]
    );
    assert.equal(
        initial.data.poem.sections[3].lines.at(-1).metadata.metricRow,
        165
    );

    const repeated = await call(
        env,
        "/api/public/poems/il-gajo-tra-i-praelli"
    );
    assert.equal(repeated.response.status, 200);
    assert.equal(
        env.DB.database.prepare("SELECT COUNT(*) AS total FROM poem_works").get().total,
        1
    );
    assert.equal(
        env.DB.database.prepare("SELECT COUNT(*) AS total FROM poem_sections").get().total,
        4
    );
    assert.equal(
        env.DB.database.prepare("SELECT COUNT(*) AS total FROM poem_lines").get().total,
        121
    );
    assert.equal(
        env.DB.database.prepare(`
            SELECT COUNT(*) AS total
            FROM content_initializations
            WHERE name = 'poem_il_gajo_v1'
        `).get().total,
        1
    );
});

test("l’API pubblica non espone opere inesistenti o non pubblicate", async () => {
    const env = createEnvironment();
    const missing = await call(env, "/api/public/poems/non-esiste");

    assert.equal(missing.response.status, 404);

    env.DB.database.prepare(`
        UPDATE poem_works SET status = 'draft'
        WHERE slug = 'il-gajo-tra-i-praelli'
    `).run();
    const draft = await call(
        env,
        "/api/public/poems/il-gajo-tra-i-praelli"
    );

    assert.equal(draft.response.status, 404);
});

function decodeText(raw) {
    return raw
        .replace(/[\t\r\n ]+/gu, " ")
        .replace(/^ +| +$/gu, "")
        .replaceAll("&nbsp;", "\u00a0")
        .replaceAll("&amp;", "&");
}

function extractStaticPoem(html) {
    const main = html.match(/<main class="poesia">([\s\S]*?)<\/main>/u)?.[1];
    const sections = [];
    let metricRow = 0;
    let stanzaCount = 0;

    assert.ok(main, "la copia statica della poesia deve essere presente");

    for (const sectionMatch of main.matchAll(
        /<section class="canto" id="([^"]+)">([\s\S]*?)<\/section>/gu
    )) {
        const body = sectionMatch[2];
        const title = decodeText(
            body.match(/<h2 class="numero">([\s\S]*?)<\/h2>/u)?.[1] || ""
        );
        const lines = [];
        let stanza = 0;

        for (const paragraphMatch of body.matchAll(
            /<p(?: class="([^"]+)")?>([\s\S]*?)<\/p>/gu
        )) {
            const paragraphClass = paragraphMatch[1] || "";
            stanza += 1;

            if (stanzaCount > 0) {
                metricRow += 1;
            }
            stanzaCount += 1;

            for (const token of paragraphMatch[2].matchAll(
                /<span(?: class="([^"]+)")?>([\s\S]*?)<\/span>|([^<]+)/gu
            )) {
                const text = decodeText(token[2] ?? token[3] ?? "");

                if (!text) {
                    continue;
                }

                const lineClass = token[1] || "";
                const indent = lineClass === "rientro"
                    ? 1
                    : lineClass === "rientro-profondo"
                        ? 2
                        : lineClass === "rientro-massimo"
                            ? 3
                            : 0;
                metricRow += 1;
                lines.push({
                    text,
                    indent,
                    stanza,
                    paragraphClass,
                    metricRow
                });
            }
        }

        sections.push({ anchor: sectionMatch[1], title, lines });
    }

    return sections;
}

function seedShape() {
    return POEM_SEED.sections.map((section) => ({
        anchor: section.anchor,
        title: section.title,
        lines: section.lines.map((line) => ({
            text: line.text,
            indent: line.indent,
            stanza: line.metadata.stanza,
            paragraphClass: line.metadata.paragraphClass,
            metricRow: line.metadata.metricRow
        }))
    }));
}

test("il seed D1 coincide integralmente con la copia HTML di ripiego", async () => {
    const html = await readFile(new URL("../../index.html", import.meta.url), "utf8");

    assert.deepEqual(extractStaticPoem(html), seedShape());
    assert.match(
        html,
        /<script src="\.\/api\.js"><\/script>\s*<script src="\.\/poem-content\.js\?v=20261008-poem1"><\/script>/u
    );
});

test("i riferimenti territoriali conservano i numeri di rigo pubblicati", async () => {
    const metricSource = await readFile(
        new URL("../../poesia-metrica.js", import.meta.url),
        "utf8"
    );
    const context = { window: {} };
    vm.runInNewContext(metricSource, context);
    const metric = context.window.NNMRCN_POEM_METRIC.lines;
    const lines = POEM_SEED.sections.flatMap((section) => section.lines);
    const expectedTerms = {
        gaggio: "Gajo",
        praello: "Praelli",
        viaAlta: "via Alta",
        viaFornace: "via Fornace",
        viaBoscoBerizzi: "via Bosco Berizzi",
        colmello: "Colmello",
        pojanon: "Pojanon",
        zero: "Zero",
        viaCostituzione: "via della Costituzione",
        fossaStorta: "Fossa Storta",
        a57: "A57",
        a27: "A27",
        a4: "A4"
    };

    for (const [key, term] of Object.entries(expectedTerms)) {
        const line = lines.find(
            (candidate) => candidate.metadata.metricRow === Number(metric[key])
        );
        assert.ok(line, `il rigo metrico di ${key} deve esistere`);
        assert.match(line.text, new RegExp(term, "u"), key);
    }
});

class FakeElement {
    constructor(tagName) {
        this.tagName = tagName;
        this.children = [];
        this.dataset = {};
        this.className = "";
        this.id = "";
        this.textContent = "";
    }

    append(...children) {
        this.children.push(...children);
    }

    replaceChildren(...children) {
        this.children = children.flatMap((child) =>
            child.tagName === "#fragment" ? child.children : [child]
        );
    }
}

async function executePoemLoader(request) {
    const source = await readFile(
        new URL("../../poem-content.js", import.meta.url),
        "utf8"
    );
    const poemRoot = new FakeElement("main");
    const fallback = new FakeElement("section");
    poemRoot.children = [fallback];
    const document = {
        documentElement: new FakeElement("html"),
        querySelector: () => poemRoot,
        createElement: (tagName) => new FakeElement(tagName),
        createDocumentFragment: () => new FakeElement("#fragment")
    };
    let event = null;
    const window = {
        NNMRCN_API: { request },
        dispatchEvent: (nextEvent) => {
            event = nextEvent;
        }
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
    await window.NNMRCN_POEM_READY;

    return { document, event, fallback, poemRoot };
}

test("il client ricostruisce canto, strofa, rientro e identificativo", async () => {
    const result = await executePoemLoader(async () => ({
        poem: {
            sections: [{
                anchor: "I",
                position: 1,
                title: "I",
                lines: [{
                    id: "poem-gajo-i-001",
                    text: "Verso da D1",
                    indent: 1,
                    metadata: { stanza: 1, paragraphClass: "figura" }
                }]
            }]
        }
    }));
    const section = result.poemRoot.children[0];
    const paragraph = section.children[1];
    const line = paragraph.children[0];

    assert.equal(section.id, "I");
    assert.equal(section.className, "canto");
    assert.equal(paragraph.className, "figura");
    assert.equal(line.className, "rientro");
    assert.equal(line.dataset.poemLine, "poem-gajo-i-001");
    assert.equal(line.textContent, "Verso da D1");
    assert.equal(result.document.documentElement.dataset.cmsPoemSource, "d1");
    assert.equal(result.event.detail.source, "d1");
});

test("il client conserva la poesia HTML se il Worker non è raggiungibile", async () => {
    const result = await executePoemLoader(async () => {
        throw new Error("Worker non raggiungibile");
    });

    assert.equal(result.poemRoot.children[0], result.fallback);
    assert.equal(
        result.document.documentElement.dataset.cmsPoemSource,
        "fallback"
    );
    assert.equal(result.event.detail.source, "fallback");
});

test("metrica e interazioni attendono il caricamento del contenuto", async () => {
    const [verses, interactions] = await Promise.all([
        readFile(new URL("../../versi.js", import.meta.url), "utf8"),
        readFile(new URL("../../poesia-interattiva.js", import.meta.url), "utf8")
    ]);

    assert.match(verses, /NNMRCN_POEM_READY/u);
    assert.match(verses, /NNMRCN_POEM_RENDERED/u);
    assert.match(interactions, /NNMRCN_POEM_RENDERED/u);
});
