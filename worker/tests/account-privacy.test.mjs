import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

import worker from "../src/index.js";

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
    constructor(schema) {
        this.database = new DatabaseSync(":memory:");
        this.database.exec(schema);
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

const sha256 = (value) => createHash("sha256").update(value).digest("hex");

async function environment() {
    const schema = await readFile(new URL("../schema.sql", import.meta.url), "utf8");
    return {
        DB: new D1DatabaseMock(schema),
        PASSWORD_PEPPER: "privacy-rights-test",
        ALLOWED_ORIGIN: "https://anonmrcn-ctrl.github.io"
    };
}

async function call(env, path, { method = "GET", token = "", body } = {}) {
    const headers = new Headers({ Origin: env.ALLOWED_ORIGIN });
    if (token) headers.set("Authorization", `Bearer ${token}`);
    if (body) headers.set("Content-Type", "application/json");
    return worker.fetch(new Request(`https://worker.test${path}`, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined
    }), env, { waitUntil() {} });
}

async function seedAccount(env) {
    const database = env.DB.database;
    const now = Date.now();
    const token = "sessione-location-uno";
    const otherToken = "sessione-location-due";

    database.prepare(`
        INSERT INTO locations (
            id, address, username, street_name, street_order, lat, lon,
            privacy_safe, location_consent_at, password_lookup,
            password_salt, password_hash
        ) VALUES
            (1, 'Via Test 1', 'Autore', 'Via Test', 1, 45.55, 12.32,
             1, ?, 'lookup-one', 'salt-one', 'hash-one'),
            (2, 'Via Segreta 1', 'Altra persona', 'Via Segreta', 1, 45.56, 12.33,
             1, NULL, 'lookup-two', 'salt-two', 'hash-two')
    `).run(now);
    database.prepare("UPDATE locations SET is_visible = 1 WHERE id = 1").run();
    database.prepare(`
        INSERT INTO poems (location_id, html)
        VALUES (1, '<p>Poesia personale</p>')
    `).run();
    database.prepare(`
        INSERT INTO sessions (session_hash, location_id, created_at, expires_at)
        VALUES (?, 1, ?, ?), (?, 2, ?, ?)
    `).run(
        sha256(token), now, now + 86400000,
        sha256(otherToken), now, now + 86400000
    );
    database.prepare(`
        INSERT INTO messages (
            sender_location_id, recipient_location_id, text, reveal_sender,
            delivery_type, status, sender_public_consent,
            recipient_public_consent, is_public, published_at,
            created_at, updated_at
        ) VALUES
            (1, 2, 'Messaggio inviato', 1, 'online', 'approved', 1, 1, 1, ?, ?, ?),
            (2, 1, 'Messaggio ricevuto', 0, 'online', 'read', 0, 0, 0, NULL, ?, ?)
    `).run(now, now, now, now, now);
    database.prepare(`
        INSERT INTO push_subscriptions (
            id, audience, location_id, endpoint, p256dh, auth, created_at, updated_at
        ) VALUES ('push-one', 'location', 1, 'https://push.example/one',
            'chiave-p256dh-segreta', 'chiave-auth-segreta', ?, ?)
    `).run(now, now);

    return { now, token, otherToken };
}

test("esporta soltanto i dati propri senza credenziali o identità di terzi", async () => {
    const env = await environment();
    const { token } = await seedAccount(env);
    const response = await call(env, "/api/account/export", { token });
    const text = await response.text();
    const data = JSON.parse(text);

    assert.equal(response.status, 200);
    assert.equal(response.headers.get("Cache-Control"), "no-store");
    assert.equal(response.headers.get("X-Content-Type-Options"), "nosniff");
    assert.match(response.headers.get("Content-Disposition"), /nnmrcn-dati-location-1/u);
    assert.equal(data.format, "nnmrcn-personal-data");
    assert.equal(data.account.id, 1);
    assert.equal(data.account.address, "Via Test · location 1");
    assert.equal(data.poem.html, "<p>Poesia personale</p>");
    assert.deepEqual(data.messages.map((message) => message.direction), ["sent", "received"]);
    assert.equal(data.pushSubscriptions[0].endpoint, "https://push.example/one");
    for (const forbidden of [
        "Via Segreta", "Altra persona", "lookup-one", "salt-one", "hash-one",
        sha256(token), "chiave-p256dh-segreta", "chiave-auth-segreta"
    ]) {
        assert.ok(!text.includes(forbidden), `dato vietato nell'esportazione: ${forbidden}`);
    }
});

test("richiede conferma esatta e anonimizza l'account preservandone l'ID", async () => {
    const env = await environment();
    const { token, otherToken } = await seedAccount(env);
    const database = env.DB.database;

    const refused = await call(env, "/api/account", {
        method: "DELETE",
        token,
        body: { confirmation: "elimina" }
    });
    assert.equal(refused.status, 400);
    assert.equal(database.prepare("SELECT COUNT(*) AS total FROM messages").get().total, 2);

    const deleted = await call(env, "/api/account", {
        method: "DELETE",
        token,
        body: { confirmation: "ELIMINA I MIEI DATI" }
    });
    const result = await deleted.json();
    assert.equal(deleted.status, 200);
    assert.equal(result.preservedId, 1);

    const tombstone = database.prepare(`
        SELECT * FROM locations WHERE id = 1
    `).get();
    assert.equal(tombstone.address, "Location 1 eliminata");
    assert.equal(tombstone.username, "");
    assert.equal(tombstone.lat, 0);
    assert.equal(tombstone.lon, 0);
    assert.equal(tombstone.is_visible, 0);
    assert.ok(Number(tombstone.deleted_at) > 0);
    assert.match(tombstone.password_lookup, /^deleted:1:/u);

    for (const table of ["poems", "messages", "push_subscriptions"]) {
        assert.equal(database.prepare(`SELECT COUNT(*) AS total FROM ${table}`).get().total, 0);
    }
    assert.equal(
        database.prepare("SELECT COUNT(*) AS total FROM sessions WHERE location_id = 1").get().total,
        0
    );
    assert.equal(database.prepare("SELECT COUNT(*) AS total FROM locations").get().total, 2);

    const oldSession = await call(env, "/api/session", { token });
    assert.equal(oldSession.status, 401);
    const locations = await call(env, "/api/locations", { token: otherToken });
    assert.deepEqual((await locations.json()).locations.map((item) => item.id), [2]);
});

test("protegge esportazione e cancellazione senza una sessione location", async () => {
    const env = await environment();
    for (const [path, method] of [
        ["/api/account/export", "GET"],
        ["/api/account", "DELETE"]
    ]) {
        const response = await call(env, path, {
            method,
            body: method === "DELETE" ? { confirmation: "ELIMINA I MIEI DATI" } : undefined
        });
        assert.equal(response.status, 401);
        assert.equal(response.headers.get("Cache-Control"), "no-store");
    }
});

test("l’health aggiorna in modo conservativo uno schema location precedente", async () => {
    const currentSchema = await readFile(new URL("../schema.sql", import.meta.url), "utf8");
    const legacySchema = currentSchema
        .replace("    deleted_at INTEGER,\n", "")
        .replace(" AND deleted_at IS NULL", "")
        .replace(/\nCREATE INDEX IF NOT EXISTS idx_locations_active\nON locations\(deleted_at, id\);\n/u, "\n");
    const env = {
        DB: new D1DatabaseMock(legacySchema),
        PASSWORD_PEPPER: "privacy-runtime-upgrade",
        ALLOWED_ORIGIN: "https://anonmrcn-ctrl.github.io"
    };
    env.DB.database.prepare(`
        INSERT INTO locations (
            id, address, lat, lon, privacy_safe,
            password_lookup, password_salt, password_hash
        ) VALUES (7, 'Via Storica', 45.55, 12.32, 1, 'lookup', 'salt', 'hash')
    `).run();

    const response = await call(env, "/api/health");
    const data = await response.json();
    const columns = env.DB.database.prepare("PRAGMA table_info(locations)").all();
    const indexSql = env.DB.database.prepare(`
        SELECT sql FROM sqlite_master
        WHERE type = 'index' AND name = 'idx_locations_street_order'
    `).get().sql;

    assert.equal(response.status, 200);
    assert.equal(data.contentSchema, 5);
    assert.ok(columns.some((column) => column.name === "deleted_at"));
    assert.match(indexSql, /deleted_at IS NULL/u);
    assert.equal(env.DB.database.prepare("SELECT COUNT(*) AS total FROM locations").get().total, 1);
});
