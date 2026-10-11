import assert from "node:assert/strict";
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
        return { success: true, meta: { changes: result.changes } };
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

test("il job periodico elimina sessioni scadute e minimizza gli HMAC antiabuso", async () => {
    const schema = await readFile(new URL("../schema.sql", import.meta.url), "utf8");
    const env = {
        DB: new D1DatabaseMock(schema),
        PASSWORD_PEPPER: "privacy-retention-test",
        ALLOWED_ORIGIN: "https://anonmrcn-ctrl.github.io"
    };
    const database = env.DB.database;
    const now = Date.now();
    const day = 24 * 60 * 60 * 1000;

    database.prepare(`
        INSERT INTO locations (
            id, address, username, lat, lon, password_lookup,
            password_salt, password_hash
        ) VALUES (1, 'Zona test', '', 45.5, 12.3, 'lookup', 'salt', 'hash')
    `).run();
    database.prepare(`
        INSERT INTO sessions (session_hash, location_id, created_at, expires_at)
        VALUES ('expired', 1, ?, ?), ('active', 1, ?, ?)
    `).run(now - day, now - 1, now, now + day);
    database.prepare(`
        INSERT INTO mayor_sessions (session_hash, created_at, expires_at)
        VALUES ('mayor-expired', ?, ?), ('mayor-active', ?, ?)
    `).run(now - day, now - 1, now, now + day);
    database.prepare(`
        INSERT INTO memories (
            id, title, author_name, text, lat, lon, status, consent,
            withdrawal_hash, sender_hash, created_at, updated_at
        ) VALUES
            (1, 'Vecchia', '', 'Testo', 45.5, 12.3, 'pending', 1,
             'withdraw-old', 'sender-old', ?, ?),
            (2, 'Recente', '', 'Testo', 45.5, 12.3, 'pending', 1,
             'withdraw-new', 'sender-new', ?, ?)
    `).run(now - day - 1, now - day - 1, now - day + 1000, now - day + 1000);

    let scheduled;
    await worker.scheduled({}, env, {
        waitUntil(promise) {
            scheduled = promise;
        }
    });
    await scheduled;

    assert.deepEqual(
        database.prepare("SELECT session_hash FROM sessions ORDER BY session_hash").all().map((row) => ({ ...row })),
        [{ session_hash: "active" }]
    );
    assert.deepEqual(
        database.prepare("SELECT session_hash FROM mayor_sessions ORDER BY session_hash").all().map((row) => ({ ...row })),
        [{ session_hash: "mayor-active" }]
    );
    assert.deepEqual(
        database.prepare("SELECT id, sender_hash FROM memories ORDER BY id").all().map((row) => ({ ...row })),
        [
            { id: 1, sender_hash: "" },
            { id: 2, sender_hash: "sender-new" }
        ]
    );
});
