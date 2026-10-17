import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

import worker from "../src/index.js";
import { PAGE_SEEDS } from "../src/page-seed.js";
import { VISUAL_SPECIALIZED_BLOCK_SEEDS } from "../src/visual-builder-adapters.js";

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
        ALLOWED_ORIGIN: "https://anonmrcn-ctrl.github.io"
    };
}

async function visualPage(env, slug) {
    const response = await worker.fetch(new Request(
        `https://worker.test/api/public/visual-pages/${slug}`,
        { headers: { Origin: env.ALLOWED_ORIGIN } }
    ), env, {});
    return { response, data: await response.json() };
}

test("inizializza una sola volta i blocchi specializzati senza riscrivere il CMS", async () => {
    const env = environment();
    const expectedLegacyBlocks = PAGE_SEEDS.reduce(
        (total, page) => total + page.blocks.length,
        0
    );

    const first = await visualPage(env, "progetto");
    assert.equal(first.response.status, 200);
    const legacySnapshot = env.DB.database.prepare(`
        SELECT id, page_id, position, block_type, content_json
        FROM page_blocks ORDER BY id
    `).all();
    const second = await visualPage(env, "progetto");
    assert.equal(second.response.status, 200);

    const placeholders = VISUAL_SPECIALIZED_BLOCK_SEEDS.map(() => "?").join(", ");
    const ids = VISUAL_SPECIALIZED_BLOCK_SEEDS.map((seed) => seed.id);
    assert.equal(env.DB.database.prepare(`
        SELECT count(*) AS total FROM visual_nodes
        WHERE id IN (${placeholders})
    `).get(...ids).total, VISUAL_SPECIALIZED_BLOCK_SEEDS.length);
    assert.equal(env.DB.database.prepare(`
        SELECT count(*) AS total FROM visual_node_properties
        WHERE node_id IN (${placeholders})
            AND domain = 'technical'
            AND property_set = 'technical.binding'
            AND property_name = 'adapter'
    `).get(...ids).total, VISUAL_SPECIALIZED_BLOCK_SEEDS.length);
    assert.equal(env.DB.database.prepare(`
        SELECT count(*) AS total FROM content_initializations
        WHERE name = 'visual_specialized_blocks_v1'
    `).get().total, 1);
    assert.equal(legacySnapshot.length, expectedLegacyBlocks);
    assert.deepEqual(env.DB.database.prepare(`
        SELECT id, page_id, position, block_type, content_json
        FROM page_blocks ORDER BY id
    `).all(), legacySnapshot);
    assert.match(second.data.page.html, /data-adapter="map-layers"/u);
    assert.match(second.data.page.html, /data-adapter="narrative-steps"/u);
    assert.match(second.data.page.html, /data-adapter="sources"/u);
});

test("gli adattatori filtrano dati privati, rendono inerte il contenuto e mantengono i ripieghi", async () => {
    const env = environment();
    const now = Date.now();

    assert.equal((await visualPage(env, "spazio-pubblico")).response.status, 200);
    assert.equal((await visualPage(env, "memorie")).response.status, 200);
    const archiveWithoutLegacyTable = await visualPage(env, "archivio");
    assert.equal(archiveWithoutLegacyTable.response.status, 200);
    assert.match(archiveWithoutLegacyTable.data.page.html, /data-adapter="public-messages"/u);

    env.DB.database.prepare(`
        INSERT INTO wiki_entries (
            slug, title, summary, body, status, created_at, updated_at, published_at
        ) VALUES
            ('voce-pubblica', 'Voce pubblica', '<script>voce</script>', '', 'published', ?, ?, ?),
            ('voce-bozza', 'Voce segreta', 'Non pubblicare', '', 'draft', ?, ?, NULL)
    `).run(now, now, now, now, now);
    env.DB.database.prepare(`
        INSERT INTO map_entries (
            name, category, description, lat, lon,
            source_url, source_label, created_at, updated_at
        ) VALUES ('Luogo <script>mappa</script>', 'luogo', 'Descrizione pubblica',
            45.5, 12.3, '', '', ?, ?)
    `).run(now, now);
    env.DB.database.prepare(`
        INSERT INTO memories (
            title, author_name, text, lat, lon, status, consent,
            withdrawal_hash, sender_hash, created_at, updated_at, published_at
        ) VALUES
            ('Memoria pubblica', 'Autrice', '<script>memoria</script>', 45.5, 12.3,
             'approved', 1, 'ritiro-pubblico', 'mittente-pubblico', ?, ?, ?),
            ('Memoria privata', '', 'Non pubblicare', 45.5, 12.3,
             'pending', 1, 'ritiro-privato', 'mittente-privato', ?, ?, NULL)
    `).run(now, now, now, now, now);
    env.DB.database.exec(`
        CREATE TABLE messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            text TEXT NOT NULL,
            sender_public_consent INTEGER NOT NULL DEFAULT 0,
            recipient_public_consent INTEGER NOT NULL DEFAULT 0,
            is_public INTEGER NOT NULL DEFAULT 0,
            published_at INTEGER
        );
    `);
    env.DB.database.prepare(`
        INSERT INTO messages (
            text, sender_public_consent, recipient_public_consent,
            is_public, published_at
        ) VALUES
            ('<script>messaggio</script>', 1, 1, 1, ?),
            ('Messaggio senza consenso', 1, 0, 1, ?),
            ('Messaggio privato', 1, 1, 0, ?)
    `).run(now, now, now);
    env.DB.database.prepare(`
        INSERT INTO sources (
            id, source_type, title, url, status, created_at, updated_at, published_at
        ) VALUES ('fonte-adattatore', 'web', '<script>fonte</script>',
            'javascript:alert(1)', 'published', ?, ?, ?)
    `).run(now, now, now);
    env.DB.database.prepare(`
        UPDATE narrative_steps
        SET explanation = '<script>percorso</script>',
            title_url = 'javascript:alert(2)'
        WHERE id = (SELECT id FROM narrative_steps ORDER BY id LIMIT 1)
    `).run();

    const publicSpace = await visualPage(env, "spazio-pubblico");
    assert.equal(publicSpace.response.status, 200);
    assert.match(publicSpace.data.page.html, /Voce pubblica/u);
    assert.doesNotMatch(publicSpace.data.page.html, /Voce segreta/u);
    assert.match(publicSpace.data.page.html, /&lt;script&gt;voce&lt;\/script&gt;/u);
    assert.match(publicSpace.data.page.html, /Luogo &lt;script&gt;mappa&lt;\/script&gt;/u);
    assert.doesNotMatch(publicSpace.data.page.html, /<script/u);

    const memories = await visualPage(env, "memorie");
    assert.equal(memories.response.status, 200);
    assert.match(memories.data.page.html, /Memoria pubblica/u);
    assert.doesNotMatch(memories.data.page.html, /Memoria privata/u);
    assert.match(memories.data.page.html, /&lt;script&gt;memoria&lt;\/script&gt;/u);
    assert.match(memories.data.page.html, /data-static-fallback="\.\/memorie\.html#memorieMap"/u);
    assert.match(memories.data.page.html, /data-static-fallback="\.\/memorie\.html#memoriaFormTitolo"/u);

    const archive = await visualPage(env, "archivio");
    assert.equal(archive.response.status, 200);
    assert.match(archive.data.page.html, /&lt;script&gt;messaggio&lt;\/script&gt;/u);
    assert.doesNotMatch(archive.data.page.html, /senza consenso|Messaggio privato/u);

    const project = await visualPage(env, "progetto");
    assert.equal(project.response.status, 200);
    assert.match(project.data.page.html, /&lt;script&gt;fonte&lt;\/script&gt;/u);
    assert.match(project.data.page.html, /&lt;script&gt;percorso&lt;\/script&gt;/u);
    assert.doesNotMatch(project.data.page.html, /javascript:/u);
    assert.match(project.data.page.html, /href="#"/u);
});

test("poesia e funzioni personali restano blocchi sicuri e collegati alle pagine esistenti", async () => {
    const env = environment();
    await visualPage(env, "progetto");
    const projectTree = env.DB.database.prepare(`
        SELECT tree_id FROM visual_page_trees WHERE page_id = 'page-progetto'
    `).get();
    const root = env.DB.database.prepare(`
        SELECT id FROM visual_nodes WHERE tree_id = ? AND parent_id IS NULL
    `).get(projectTree.tree_id);
    const position = env.DB.database.prepare(`
        SELECT max(position) AS position FROM visual_nodes WHERE parent_id = ?
    `).get(root.id).position + 1;
    env.DB.database.prepare(`
        INSERT INTO visual_nodes (
            id, tree_id, parent_id, position, block_type, label,
            created_at, updated_at
        ) VALUES ('visual-progetto-poesia', ?, ?, ?, 'project-poem', 'Poesia', ?, ?)
    `).run(projectTree.tree_id, root.id, position, Date.now(), Date.now());

    const project = await visualPage(env, "progetto");
    assert.equal(project.response.status, 200);
    assert.match(project.data.page.html, /data-adapter="poem"/u);
    assert.match(project.data.page.html, /data-indent="[0-9]+"/u);

    const notebook = await visualPage(env, "taccuino");
    const personal = await visualPage(env, "spazio-personale");
    const access = await visualPage(env, "accesso");
    assert.match(notebook.data.page.html, /data-static-fallback="\.\/taccuino\.html"/u);
    assert.match(personal.data.page.html, /href="\.\/accesso\.html"/u);
    assert.match(access.data.page.html, /data-static-fallback="\.\/accesso\.html"/u);
    assert.equal(notebook.data.page.metadata.robots, "noindex,nofollow");
    assert.equal(personal.data.page.metadata.robots, "noindex,nofollow");
    assert.equal(access.data.page.metadata.robots, "noindex,nofollow");
});
