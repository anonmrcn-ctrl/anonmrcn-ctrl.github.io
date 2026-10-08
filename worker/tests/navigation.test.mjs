import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import vm from "node:vm";

import worker from "../src/index.js";
import { NAVIGATION_SEEDS } from "../src/navigation-seed.js";

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
        ADMIN_TOKEN: "test-admin",
        ALLOWED_ORIGIN: "https://anonmrcn-ctrl.github.io"
    };
}

async function adminCall(env, options = {}) {
    const response = await worker.fetch(new Request(
        "https://worker.test/api/admin/cms/navigation",
        {
            method: options.method || "GET",
            headers: {
                Origin: env.ALLOWED_ORIGIN,
                "X-Admin-Token": env.ADMIN_TOKEN,
                "Content-Type": "application/json"
            },
            body: options.body ? JSON.stringify(options.body) : undefined
        }
    ), env, {});
    return { response, data: await response.json() };
}

test("il pannello aggiorna il menu con concorrenza e revisioni", async () => {
    const env = createEnvironment();
    const initial = await adminCall(env);
    const items = initial.data.items.map((item) => ({
        id: item.id,
        label: item.id === "nav-main-poem" ? "Poesia" : item.label,
        href: item.href,
        visibility: item.visibility,
        status: item.status
    }));
    const updated = await adminCall(env, {
        method: "PATCH",
        body: { expectedUpdatedAt: initial.data.updatedAt, items }
    });
    assert.equal(updated.response.status, 200);
    assert.equal(updated.data.items[0].label, "Poesia");
    assert.equal((await call(env)).data.menus.main[0].label, "Poesia");
    assert.equal(env.DB.database.prepare(`
        SELECT COUNT(*) AS total FROM content_revisions
        WHERE entity_type = 'navigation_item' AND entity_id = 'nav-main-poem'
    `).get().total, 2);
    const stale = await adminCall(env, {
        method: "PATCH",
        body: { expectedUpdatedAt: initial.data.updatedAt, items }
    });
    assert.equal(stale.response.status, 409);
});

async function call(env) {
    const request = new Request("https://worker.test/api/public/navigation", {
        headers: { Origin: env.ALLOWED_ORIGIN }
    });
    const response = await worker.fetch(request, env, {});
    return { response, data: await response.json() };
}

test("importa una sola volta menu e collegamenti globali", async () => {
    const env = createEnvironment();
    const initial = await call(env);

    assert.equal(initial.response.status, 200);
    assert.deepEqual(
        initial.data.menus.main.map((item) => item.id),
        [
            "nav-main-poem",
            "nav-main-author",
            "nav-main-project",
            "nav-main-public-space"
        ]
    );
    assert.equal(initial.data.menus.support[0].label, "Sostieni il progetto");
    assert.equal(initial.data.menus.utility[0].href, "./admin.html");

    const repeated = await call(env);
    assert.equal(repeated.response.status, 200);
    assert.equal(
        env.DB.database.prepare(
            "SELECT COUNT(*) AS total FROM navigation_items"
        ).get().total,
        NAVIGATION_SEEDS.length
    );
    assert.equal(
        env.DB.database.prepare(`
            SELECT COUNT(*) AS total
            FROM content_initializations
            WHERE name = 'navigation_v1'
        `).get().total,
        1
    );
});

test("l’API pubblica filtra bozze e voci riservate", async () => {
    const env = createEnvironment();
    await call(env);
    env.DB.database.prepare(`
        UPDATE navigation_items SET status = 'draft'
        WHERE id = 'nav-main-author'
    `).run();
    env.DB.database.prepare(`
        UPDATE navigation_items SET visibility = 'authenticated'
        WHERE id = 'nav-main-project'
    `).run();

    const filtered = await call(env);
    assert.deepEqual(
        filtered.data.menus.main.map((item) => item.id),
        ["nav-main-poem", "nav-main-public-space"]
    );
});

function plainText(value) {
    return value.replace(/<[^>]+>/gu, " ").replace(/\s+/gu, " ").trim();
}

function extractLink(fragment, className) {
    const pattern = new RegExp(
        `<a[^>]*class="[^"]*${className}[^"]*"[^>]*href="([^"]+)"[^>]*>` +
        `([\\s\\S]*?)<\\/a>`,
        "u"
    );
    const reversePattern = new RegExp(
        `<a[^>]*href="([^"]+)"[^>]*class="[^"]*${className}[^"]*"[^>]*>` +
        `([\\s\\S]*?)<\\/a>`,
        "u"
    );
    const match = fragment.match(pattern) || fragment.match(reversePattern);
    assert.ok(match, `collegamento ${className} mancante`);
    return { href: match[1], label: plainText(match[2]) };
}

test("tutte le pagine conservano lo stesso menu come ripiego", async () => {
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
        "voci"
    ];
    const expectedMain = NAVIGATION_SEEDS
        .filter((item) => item.menuKey === "main")
        .map(({ label, href }) => ({ label, href }));
    const expectedSupport = NAVIGATION_SEEDS.find(
        (item) => item.menuKey === "support"
    );
    const expectedUtility = NAVIGATION_SEEDS.find(
        (item) => item.menuKey === "utility"
    );

    for (const pageName of pageNames) {
        const html = await readFile(
            new URL(`../../${pageName}.html`, import.meta.url),
            "utf8"
        );
        const menu = html.match(
            /<nav[^>]*class="menu-principale"[\s\S]*?<\/nav>/u
        )?.[0];
        const main = menu?.match(
            /<div class="menu-contenuto">([\s\S]*?)<\/div>/u
        )?.[1];

        assert.ok(menu, `${pageName}.html deve conservare il menu statico`);
        assert.ok(main, `${pageName}.html deve conservare le voci principali`);

        const items = Array.from(
            main.matchAll(/<a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gu),
            (match) => ({ href: match[1], label: plainText(match[2]) })
        );
        assert.deepEqual(items, expectedMain, pageName);

        const support = extractLink(menu, "menu-donazioni");
        const utility = extractLink(menu, "menu-admin-link");
        assert.deepEqual(support, {
            href: expectedSupport.href,
            label: expectedSupport.label
        });
        assert.deepEqual(utility, {
            href: expectedUtility.href,
            label: expectedUtility.label
        });
        assert.match(
            html,
            /<script src="\.\/api\.js"><\/script>[\s\S]*?<script src="\.\/navigation-content\.js\?v=20261008-navigation1"><\/script>/u,
            pageName
        );
    }
});

class FakeElement {
    constructor(tagName) {
        this.tagName = tagName.toUpperCase();
        this.children = [];
        this.dataset = {};
        this.hidden = false;
        this.href = "";
        this.textContent = "";
        this.className = "";
    }

    querySelectorAll(selector) {
        if (selector === ":scope > a") {
            return this.children.filter((child) => child.tagName === "A");
        }
        return [];
    }

    querySelector(selector) {
        if (selector === ".menu-contenuto") {
            return this.menuContent || null;
        }
        if (selector === ".menu-donazioni") {
            return this.support || null;
        }
        if (selector === ".menu-admin-link") {
            return this.utility || null;
        }
        if (selector.includes("data-spazio-personale")) {
            return this.children.find((child) =>
                Object.hasOwn(child.dataset, "spazioPersonaleLink") ||
                Object.hasOwn(child.dataset, "spazioPersonaleErrore")
            ) || null;
        }
        return null;
    }

    insertBefore(element, boundary) {
        this.children = this.children.filter((child) => child !== element);
        const index = boundary ? this.children.indexOf(boundary) : -1;

        if (index >= 0) {
            this.children.splice(index, 0, element);
        } else {
            this.children.push(element);
        }
    }
}

async function executeNavigationLoader(request) {
    const source = await readFile(
        new URL("../../navigation-content.js", import.meta.url),
        "utf8"
    );
    const main = new FakeElement("div");
    main.children = [0, 1, 2, 3].map(() => new FakeElement("a"));
    main.children[1].className = "voce-attiva";
    const privateLink = new FakeElement("a");
    privateLink.dataset.spazioPersonaleLink = "";
    main.children.push(privateLink);
    const menu = new FakeElement("nav");
    menu.menuContent = main;
    menu.support = new FakeElement("a");
    menu.utility = new FakeElement("a");
    const document = {
        documentElement: new FakeElement("html"),
        getElementById: () => menu,
        createElement: (tagName) => new FakeElement(tagName)
    };
    let finish;
    const ready = new Promise((resolve) => {
        finish = resolve;
    });
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

    return { document, event: await ready, main, menu, privateLink };
}

test("il client applica ordine e testi senza perdere stato o link privato", async () => {
    const mainItems = NAVIGATION_SEEDS
        .filter((item) => item.menuKey === "main")
        .toReversed();
    const support = NAVIGATION_SEEDS.find((item) => item.menuKey === "support");
    const utility = NAVIGATION_SEEDS.find((item) => item.menuKey === "utility");
    const result = await executeNavigationLoader(async () => ({
        menus: { main: mainItems, support: [support], utility: [utility] }
    }));

    assert.deepEqual(
        result.main.children.slice(0, 4).map(
            (element) => element.dataset.cmsNavigationItem
        ),
        mainItems.map((item) => item.id)
    );
    assert.equal(result.main.children.at(-1), result.privateLink);
    assert.equal(
        result.main.children.find(
            (element) => element.dataset.cmsNavigationItem === "nav-main-author"
        ).className,
        "voce-attiva"
    );
    assert.equal(result.menu.support.href, support.href);
    assert.equal(result.menu.utility.textContent, utility.label);
    assert.equal(
        result.document.documentElement.dataset.cmsNavigationSource,
        "d1"
    );
    assert.equal(result.event.detail.source, "d1");
});

test("il client conserva il menu statico quando il Worker non risponde", async () => {
    const result = await executeNavigationLoader(async () => {
        throw new Error("Worker non raggiungibile");
    });

    assert.equal(result.main.children.length, 5);
    assert.equal(result.main.children[1].className, "voce-attiva");
    assert.equal(
        result.document.documentElement.dataset.cmsNavigationSource,
        "fallback"
    );
    assert.equal(result.event.detail.source, "fallback");
});
