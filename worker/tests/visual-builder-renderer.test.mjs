import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

import worker from "../src/index.js";
import {
    renderVisualPage,
    VISUAL_BLOCK_REGISTRY,
    VISUAL_BLOCK_REGISTRY_VERSION,
    VisualRenderError
} from "../src/visual-builder-renderer.js";

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

function property(node, propertySet, name, valueKind, values = {}, position = 0) {
    return {
        node_id: node,
        domain: propertySet.split(".")[0],
        property_set: propertySet,
        property_name: name,
        breakpoint: "all",
        item_position: position,
        value_kind: valueKind,
        text_value: null,
        number_value: null,
        boolean_value: null,
        asset_id: null,
        page_reference_id: null,
        collection_key: null,
        ...values
    };
}

test("il registro eseguibile coincide con il contratto v2", async () => {
    const contract = JSON.parse(await readFile(
        new URL("../../docs/cms/block-contract.json", import.meta.url),
        "utf8"
    ));
    assert.equal(VISUAL_BLOCK_REGISTRY_VERSION, contract.version);
    assert.deepEqual(
        Object.keys(VISUAL_BLOCK_REGISTRY).sort(),
        contract.blockTypes.map((block) => block.id).sort()
    );
    for (const block of contract.blockTypes) {
        assert.equal(VISUAL_BLOCK_REGISTRY[block.id].category, block.category);
        assert.deepEqual(
            [...VISUAL_BLOCK_REGISTRY[block.id].propertySets].sort(),
            [...block.propertySets].sort(),
            block.id
        );
    }
});

test("renderizza i blocchi ordinari con HTML semantico e contenuto inerte", () => {
    const nodes = [
        ["root", null, 1, "page-root"],
        ["section", "root", 1, "section"],
        ["container", "section", 1, "container"],
        ["columns", "container", 1, "columns"],
        ["heading", "columns", 1, "heading"],
        ["text", "columns", 2, "rich-text"],
        ["list", "columns", 3, "list"],
        ["quote", "columns", 4, "quote"],
        ["image", "columns", 5, "image"],
        ["gallery", "columns", 6, "gallery"],
        ["button", "columns", 7, "button"],
        ["separator", "columns", 8, "separator"],
        ["spacer", "columns", 9, "spacer"]
    ].map(([id, parent_id, position, block_type]) => ({
        id, parent_id, position, block_type
    }));
    const properties = [
        property("root", "content.copy", "title", "text", { text_value: "Pagina <prova>" }),
        property("section", "content.copy", "title", "text", { text_value: "Sezione" }),
        property("heading", "content.copy", "title", "text", { text_value: "Titolo" }),
        property("text", "content.copy", "text", "text", { text_value: "<script>alert(1)</script> Testo" }),
        property("list", "content.copy", "items", "text", { text_value: "Uno" }, 1),
        property("list", "content.copy", "items", "text", { text_value: "Due" }, 2),
        property("quote", "content.copy", "text", "text", { text_value: "Citazione" }),
        property("quote", "content.copy", "title", "text", { text_value: "Autore" }),
        property("image", "content.media", "assetId", "asset", { asset_id: "asset-1" }),
        property("image", "content.media", "alt", "text", { text_value: "Alt \"sicuro\"" }),
        property("image", "content.media", "caption", "text", { text_value: "Didascalia" }),
        property("button", "content.copy", "title", "text", { text_value: "Apri" }),
        property("button", "behavior.link", "href", "url", { text_value: "javascript:alert(1)" })
    ];
    const rendered = renderVisualPage({
        page: {
            id: "page-test",
            slug: "test",
            title: "Pagina test",
            description: "Descrizione",
            status: "published"
        },
        nodes,
        properties,
        assets: [{
            id: "asset-1",
            publicUrl: "/api/public/wiki-images/11111111-1111-4111-8111-111111111111",
            alt_text: "",
            caption: "",
            width: 800,
            height: 600
        }]
    });

    assert.match(rendered.html, /^<main/u);
    assert.match(rendered.html, /<section/u);
    assert.match(rendered.html, /<h2/u);
    assert.match(rendered.html, /<ul/u);
    assert.match(rendered.html, /<blockquote/u);
    assert.match(rendered.html, /<figure/u);
    assert.match(rendered.html, /role="group" aria-label="Galleria"/u);
    assert.match(rendered.html, /<hr/u);
    assert.match(rendered.html, /aria-hidden="true"/u);
    assert.match(rendered.html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/u);
    assert.match(rendered.html, /href="#"/u);
    assert.match(rendered.html, /alt="Alt &quot;sicuro&quot;"/u);
    assert.doesNotMatch(rendered.html, /<script|javascript:|onerror=|style=/iu);
    assert.equal(rendered.metadata.canonical, "https://anonmrcn-ctrl.github.io/test.html");
    assert.equal(rendered.metadata.robots, "index,follow");
    assert.equal(rendered.metadata.structuredData["@type"], "WebPage");
});

test("rifiuta tipi, proprietà e annidamenti non registrati", () => {
    const page = { id: "page", slug: "page", title: "Page", status: "published" };
    assert.throws(() => renderVisualPage({
        page,
        nodes: [{ id: "root", parent_id: null, position: 1, block_type: "script" }],
        properties: []
    }), VisualRenderError);
    assert.throws(() => renderVisualPage({
        page,
        nodes: [
            { id: "root", parent_id: null, position: 1, block_type: "page-root" },
            { id: "text", parent_id: "root", position: 1, block_type: "rich-text" }
        ],
        properties: [property("text", "behavior.form", "endpoint", "text", { text_value: "x" })]
    }), VisualRenderError);
    assert.throws(() => renderVisualPage({
        page,
        nodes: [
            { id: "root", parent_id: null, position: 1, block_type: "page-root" },
            { id: "text", parent_id: "root", position: 1, block_type: "rich-text" },
            { id: "nested", parent_id: "text", position: 1, block_type: "heading" }
        ],
        properties: []
    }), VisualRenderError);
});

test("l'API visuale espone soltanto alberi pubblicati e conserva noindex", async () => {
    const db = new D1DatabaseMock();
    const env = {
        DB: db,
        ALLOWED_ORIGIN: "https://anonmrcn-ctrl.github.io"
    };
    const publicResponse = await worker.fetch(new Request(
        "https://worker.test/api/public/visual-pages/progetto",
        { headers: { Origin: env.ALLOWED_ORIGIN } }
    ), env, {});
    const publicData = await publicResponse.json();
    assert.equal(publicResponse.status, 200);
    assert.equal(publicData.page.registryVersion, 2);
    assert.equal(publicData.page.behaviorVersion, 1);
    assert.equal(publicData.page.metadata.robots, "index,follow");
    assert.equal(
        publicData.page.metadata.canonical,
        "https://anonmrcn-ctrl.github.io/progetto.html"
    );
    assert.match(publicData.page.html, /data-block-id="progetto-map-intro"/u);
    assert.doesNotMatch(publicData.page.html, /<script|style=/iu);

    const privateResponse = await worker.fetch(new Request(
        "https://worker.test/api/public/visual-pages/spazio-personale",
        { headers: { Origin: env.ALLOWED_ORIGIN } }
    ), env, {});
    const privateData = await privateResponse.json();
    assert.equal(privateResponse.status, 200);
    assert.equal(privateData.page.metadata.robots, "noindex,nofollow");
    assert.equal(privateData.page.metadata.canonical, null);
    assert.equal(privateData.page.metadata.structuredData, null);

    db.database.prepare(`
        UPDATE visual_trees SET status = 'draft'
        WHERE id = 'visual-tree-page-progetto'
    `).run();
    const draftResponse = await worker.fetch(new Request(
        "https://worker.test/api/public/visual-pages/progetto",
        { headers: { Origin: env.ALLOWED_ORIGIN } }
    ), env, {});
    assert.equal(draftResponse.status, 404);
});
