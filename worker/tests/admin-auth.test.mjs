import assert from "node:assert/strict";
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

const ORIGIN = "https://anonmrcn-ctrl.github.io";
const RP_ID = "anonmrcn-ctrl.github.io";

function environment() {
    return {
        DB: new D1DatabaseMock(),
        ADMIN_TOKEN: "token-iniziale-segreto",
        ALLOWED_ORIGIN: ORIGIN
    };
}

async function call(env, path, options = {}) {
    const headers = new Headers({ Origin: ORIGIN });
    if (options.legacyToken) {
        headers.set("X-Admin-Token", options.legacyToken);
    }
    if (options.session) {
        headers.set("Authorization", `Bearer ${options.session}`);
    }
    if (options.body !== undefined) {
        headers.set("Content-Type", "application/json");
    }
    return await worker.fetch(new Request(`https://worker.test${path}`, {
        method: options.method || "GET",
        headers,
        body: options.body === undefined
            ? undefined
            : JSON.stringify(options.body)
    }), env, { waitUntil() {} });
}

function base64Url(value) {
    return Buffer.from(value).toString("base64url");
}

function fromBase64Url(value) {
    return new Uint8Array(Buffer.from(value, "base64url"));
}

function join(...values) {
    return new Uint8Array(Buffer.concat(values.map((value) => Buffer.from(value))));
}

function uint32(value) {
    const bytes = Buffer.alloc(4);
    bytes.writeUInt32BE(value);
    return bytes;
}

function cborLength(major, length) {
    if (length < 24) return Uint8Array.of((major << 5) | length);
    if (length < 256) return Uint8Array.of((major << 5) | 24, length);
    return Uint8Array.of((major << 5) | 25, length >> 8, length & 0xff);
}

function cborBytes(value) {
    return join(cborLength(2, value.length), value);
}

function cborText(value) {
    const bytes = new TextEncoder().encode(value);
    return join(cborLength(3, bytes.length), bytes);
}

function cborMap(entries) {
    return join(
        cborLength(5, entries.length),
        ...entries.flatMap(([key, value]) => [key, value])
    );
}

function cborInteger(value) {
    if (value >= 0) return cborLength(0, value);
    return cborLength(1, -1 - value);
}

async function sha256(value) {
    return new Uint8Array(await crypto.subtle.digest("SHA-256", value));
}

async function newAuthenticator() {
    const keys = await crypto.subtle.generateKey(
        { name: "ECDSA", namedCurve: "P-256" },
        true,
        ["sign", "verify"]
    );
    const jwk = await crypto.subtle.exportKey("jwk", keys.publicKey);
    return {
        keys,
        credentialId: crypto.getRandomValues(new Uint8Array(32)),
        x: fromBase64Url(jwk.x),
        y: fromBase64Url(jwk.y)
    };
}

function clientData(type, challenge, origin = ORIGIN) {
    return new TextEncoder().encode(JSON.stringify({ type, challenge, origin }));
}

async function registrationCredential(authenticator, challenge, origin = ORIGIN) {
    const coseKey = cborMap([
        [cborInteger(1), cborInteger(2)],
        [cborInteger(3), cborInteger(-7)],
        [cborInteger(-1), cborInteger(1)],
        [cborInteger(-2), cborBytes(authenticator.x)],
        [cborInteger(-3), cborBytes(authenticator.y)]
    ]);
    const authenticatorData = join(
        await sha256(new TextEncoder().encode(RP_ID)),
        Uint8Array.of(0x45),
        uint32(1),
        new Uint8Array(16),
        Uint8Array.of(0, authenticator.credentialId.length),
        authenticator.credentialId,
        coseKey
    );
    const attestationObject = cborMap([
        [cborText("fmt"), cborText("none")],
        [cborText("attStmt"), cborMap([])],
        [cborText("authData"), cborBytes(authenticatorData)]
    ]);
    const client = clientData("webauthn.create", challenge, origin);
    return {
        id: base64Url(authenticator.credentialId),
        rawId: base64Url(authenticator.credentialId),
        type: "public-key",
        response: {
            clientDataJSON: base64Url(client),
            attestationObject: base64Url(attestationObject),
            transports: ["internal"]
        }
    };
}

async function assertionCredential(
    authenticator,
    challenge,
    counter = 2,
    origin = ORIGIN
) {
    const authenticatorData = join(
        await sha256(new TextEncoder().encode(RP_ID)),
        Uint8Array.of(0x05),
        uint32(counter)
    );
    const client = clientData("webauthn.get", challenge, origin);
    const signed = join(authenticatorData, await sha256(client));
    const signature = new Uint8Array(await crypto.subtle.sign(
        { name: "ECDSA", hash: "SHA-256" },
        authenticator.keys.privateKey,
        signed
    ));
    return {
        id: base64Url(authenticator.credentialId),
        rawId: base64Url(authenticator.credentialId),
        type: "public-key",
        response: {
            clientDataJSON: base64Url(client),
            authenticatorData: base64Url(authenticatorData),
            signature: base64Url(signature),
            userHandle: null
        }
    };
}

async function bootstrap(env, authenticator) {
    const optionsResponse = await call(env, "/api/admin/auth/bootstrap/options", {
        method: "POST",
        legacyToken: env.ADMIN_TOKEN,
        body: { displayName: "Marta" }
    });
    const options = await optionsResponse.json();
    assert.equal(optionsResponse.status, 200);
    const verifyResponse = await call(env, "/api/admin/auth/bootstrap/verify", {
        method: "POST",
        legacyToken: env.ADMIN_TOKEN,
        body: {
            displayName: "Marta",
            challengeId: options.challengeId,
            credential: await registrationCredential(
                authenticator,
                options.publicKey.challenge
            )
        }
    });
    const session = await verifyResponse.json();
    assert.equal(verifyResponse.status, 201);
    return session;
}

test("la prima passkey disattiva definitivamente il token condiviso", async () => {
    const env = environment();
    const statusBefore = await call(env, "/api/admin/auth/status");
    assert.deepEqual(await statusBefore.json(), {
        configured: false,
        passkeysSupported: true
    });

    const denied = await call(env, "/api/admin/auth/bootstrap/options", {
        method: "POST",
        legacyToken: "sbagliato",
        body: { displayName: "Marta" }
    });
    assert.equal(denied.status, 401);

    const authenticator = await newAuthenticator();
    const session = await bootstrap(env, authenticator);
    assert.equal(session.identity.displayName, "Marta");
    assert.match(session.token, /^[A-Za-z0-9_-]{43}$/u);
    assert.ok(session.expiresAt > Date.now());

    const statusAfter = await call(env, "/api/admin/auth/status");
    assert.equal((await statusAfter.json()).configured, true);
    assert.equal(statusAfter.headers.get("cache-control"), "no-store");

    const oldToken = await call(env, "/api/admin/summary", {
        legacyToken: env.ADMIN_TOKEN
    });
    assert.equal(oldToken.status, 401);

    const currentSession = await call(env, "/api/admin/auth/session", {
        session: session.token
    });
    assert.equal(currentSession.status, 200);
    assert.equal((await currentSession.json()).identity.displayName, "Marta");

    const stored = env.DB.database.prepare(`
        SELECT session_hash FROM admin_sessions LIMIT 1
    `).get();
    assert.equal(stored.session_hash.length, 64);
    assert.notEqual(stored.session_hash, session.token);
});

test("l’accesso verifica firma, origine, contatore e uso singolo della sfida", async () => {
    const env = environment();
    const authenticator = await newAuthenticator();
    await bootstrap(env, authenticator);

    const optionsResponse = await call(env, "/api/admin/auth/options", {
        method: "POST",
        body: {}
    });
    const options = await optionsResponse.json();
    assert.equal(options.publicKey.userVerification, "required");
    assert.equal("allowCredentials" in options.publicKey, false);
    const credential = await assertionCredential(
        authenticator,
        options.publicKey.challenge
    );
    const login = await call(env, "/api/admin/auth/verify", {
        method: "POST",
        body: { challengeId: options.challengeId, credential }
    });
    assert.equal(login.status, 200);
    assert.equal((await login.json()).identity.displayName, "Marta");

    const replay = await call(env, "/api/admin/auth/verify", {
        method: "POST",
        body: { challengeId: options.challengeId, credential }
    });
    assert.equal(replay.status, 409);

    const nextOptionsResponse = await call(env, "/api/admin/auth/options", {
        method: "POST",
        body: {}
    });
    const nextOptions = await nextOptionsResponse.json();
    const wrongOrigin = await call(env, "/api/admin/auth/verify", {
        method: "POST",
        body: {
            challengeId: nextOptions.challengeId,
            credential: await assertionCredential(
                authenticator,
                nextOptions.publicKey.challenge,
                3,
                "https://example.invalid"
            )
        }
    });
    assert.equal(wrongOrigin.status, 401);
    assert.match((await wrongOrigin.json()).error, /Origine/u);

    const repeatedCounter = await call(env, "/api/admin/auth/verify", {
        method: "POST",
        body: {
            challengeId: nextOptions.challengeId,
            credential: await assertionCredential(
                authenticator,
                nextOptions.publicKey.challenge,
                2
            )
        }
    });
    assert.equal(repeatedCounter.status, 401);
    assert.match((await repeatedCounter.json()).error, /Contatore/u);
});

test("una sessione autenticata può registrare una passkey aggiuntiva", async () => {
    const env = environment();
    const first = await newAuthenticator();
    const session = await bootstrap(env, first);
    const second = await newAuthenticator();

    const optionsResponse = await call(
        env,
        "/api/admin/auth/credentials/options",
        { method: "POST", session: session.token, body: {} }
    );
    const options = await optionsResponse.json();
    assert.equal(optionsResponse.status, 200);
    assert.equal(options.publicKey.excludeCredentials.length, 1);

    const created = await call(env, "/api/admin/auth/credentials/verify", {
        method: "POST",
        session: session.token,
        body: {
            challengeId: options.challengeId,
            credential: await registrationCredential(
                second,
                options.publicKey.challenge
            )
        }
    });
    assert.equal(created.status, 201);

    const listed = await call(env, "/api/admin/auth/credentials", {
        session: session.token
    });
    const body = await listed.json();
    assert.equal(body.credentials.length, 2);
    assert.ok(body.credentials.every((item) => item.transports.includes("internal")));
});

