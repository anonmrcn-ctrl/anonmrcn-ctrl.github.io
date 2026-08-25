const PUSH_TTL_SECONDS = 24 * 60 * 60;
const PUSH_RECORD_SIZE = 4096;
const PUSH_KEY_ID = "vapid";

const PUSH_STORAGE_STATEMENTS = Object.freeze([
    `CREATE TABLE IF NOT EXISTS push_keys (
        id TEXT PRIMARY KEY,
        public_key TEXT NOT NULL,
        encrypted_private_key TEXT NOT NULL,
        created_at INTEGER NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS push_subscriptions (
        id TEXT PRIMARY KEY,
        audience TEXT NOT NULL CHECK (audience IN ('admin', 'location')),
        location_id INTEGER,
        endpoint TEXT NOT NULL,
        p256dh TEXT NOT NULL,
        auth TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        CHECK (
            (audience = 'admin' AND location_id IS NULL) OR
            (audience = 'location' AND location_id IS NOT NULL)
        ),
        FOREIGN KEY (location_id) REFERENCES locations(id) ON DELETE CASCADE
    )`,
    `CREATE INDEX IF NOT EXISTS idx_push_subscriptions_audience
        ON push_subscriptions(audience, location_id)`
]);

export class PushRequestError extends Error {
    constructor(message, status = 400) {
        super(message);
        this.name = "PushRequestError";
        this.status = status;
    }
}

export async function getPushConfiguration(env, identity) {
    await ensurePushStorage(env);

    const key = await getOrCreateVapidKey(env);

    return {
        publicKey: key.public_key,
        audience: identity.audience,
        locationId: identity.locationId
    };
}

export async function savePushSubscription(env, identity, subscription) {
    const endpoint = validateEndpoint(subscription?.endpoint);
    const p256dh = validatePublicKey(subscription?.keys?.p256dh);
    const auth = validateAuthenticationSecret(subscription?.keys?.auth);
    const id = await subscriptionId(identity, endpoint);
    const now = Date.now();

    await ensurePushStorage(env);

    await env.DB.prepare(`
        INSERT INTO push_subscriptions (
            id,
            audience,
            location_id,
            endpoint,
            p256dh,
            auth,
            created_at,
            updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
            p256dh = excluded.p256dh,
            auth = excluded.auth,
            updated_at = excluded.updated_at
    `).bind(
        id,
        identity.audience,
        identity.locationId,
        endpoint,
        p256dh,
        auth,
        now,
        now
    ).run();

    return { ok: true };
}

export async function removePushSubscription(env, identity, endpointValue) {
    const endpoint = validateEndpoint(endpointValue);
    const id = await subscriptionId(identity, endpoint);

    await ensurePushStorage(env);

    await env.DB.prepare(`
        DELETE FROM push_subscriptions
        WHERE id = ?
    `).bind(id).run();

    return { ok: true };
}

export async function notifyPushSubscribers(env, audience, locationId, notification) {
    await ensurePushStorage(env);

    let statement = env.DB.prepare(`
        SELECT id, endpoint, p256dh, auth
        FROM push_subscriptions
        WHERE audience = ? AND location_id IS NULL
        LIMIT 100
    `).bind(audience);

    if (audience === "location") {
        statement = env.DB.prepare(`
            SELECT id, endpoint, p256dh, auth
            FROM push_subscriptions
            WHERE audience = ? AND location_id = ?
            LIMIT 100
        `).bind(audience, locationId);
    }

    const subscriptions = (await statement.all()).results || [];

    if (!subscriptions.length) {
        return;
    }

    const key = await getOrCreateVapidKey(env);

    const results = await Promise.allSettled(
        subscriptions.map((subscription) =>
            sendPushNotification(env, key, subscription, notification)
        )
    );

    results.forEach((result, index) => {
        if (result.status === "rejected") {
            console.error(JSON.stringify({
                event: "push_delivery_failed",
                audience,
                subscriptionId: subscriptions[index].id,
                error: result.reason instanceof Error
                    ? result.reason.message
                    : String(result.reason)
            }));
        }
    });
}

async function ensurePushStorage(env) {
    await env.DB.batch(
        PUSH_STORAGE_STATEMENTS.map((statement) => env.DB.prepare(statement))
    );
}

async function getOrCreateVapidKey(env) {
    let stored = await env.DB.prepare(`
        SELECT public_key, encrypted_private_key
        FROM push_keys
        WHERE id = ?
        LIMIT 1
    `).bind(PUSH_KEY_ID).first();

    if (stored) {
        return stored;
    }

    const pair = await crypto.subtle.generateKey(
        { name: "ECDSA", namedCurve: "P-256" },
        true,
        ["sign", "verify"]
    );

    const publicBytes = new Uint8Array(
        await crypto.subtle.exportKey("raw", pair.publicKey)
    );
    const privateJwk = await crypto.subtle.exportKey("jwk", pair.privateKey);
    const encryptedPrivateKey = await encryptPrivateKey(env, privateJwk);

    await env.DB.prepare(`
        INSERT OR IGNORE INTO push_keys (
            id,
            public_key,
            encrypted_private_key,
            created_at
        )
        VALUES (?, ?, ?, ?)
    `).bind(
        PUSH_KEY_ID,
        toBase64Url(publicBytes),
        encryptedPrivateKey,
        Date.now()
    ).run();

    stored = await env.DB.prepare(`
        SELECT public_key, encrypted_private_key
        FROM push_keys
        WHERE id = ?
        LIMIT 1
    `).bind(PUSH_KEY_ID).first();

    if (!stored) {
        throw new Error("Impossibile inizializzare le chiavi push.");
    }

    return stored;
}

async function encryptPrivateKey(env, jwk) {
    const key = await privateKeyEncryptionKey(env, ["encrypt"]);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encoded = encodeText(JSON.stringify(jwk));

    const encrypted = new Uint8Array(await crypto.subtle.encrypt(
        { name: "AES-GCM", iv },
        key,
        encoded
    ));

    return toBase64Url(concatBytes(iv, encrypted));
}

async function decryptPrivateKey(env, encryptedValue) {
    const encoded = fromBase64Url(encryptedValue);

    if (encoded.length <= 12) {
        throw new Error("Chiave push cifrata non valida.");
    }

    const key = await privateKeyEncryptionKey(env, ["decrypt"]);
    const decrypted = await crypto.subtle.decrypt(
        { name: "AES-GCM", iv: encoded.slice(0, 12) },
        key,
        encoded.slice(12)
    );

    return JSON.parse(new TextDecoder().decode(decrypted));
}

async function privateKeyEncryptionKey(env, usages) {
    if (!env.PASSWORD_PEPPER) {
        throw new Error("PASSWORD_PEPPER secret missing.");
    }

    const material = await crypto.subtle.digest(
        "SHA-256",
        encodeText(`nnmrcn-push-vapid:${env.PASSWORD_PEPPER}`)
    );

    return crypto.subtle.importKey(
        "raw",
        material,
        { name: "AES-GCM" },
        false,
        usages
    );
}

async function sendPushNotification(env, vapidKey, subscription, notification) {
    const endpoint = validateEndpoint(subscription.endpoint);
    const encrypted = await encryptPushPayload(subscription, notification);
    const authorization = await createVapidAuthorization(
        env,
        vapidKey,
        new URL(endpoint).origin
    );

    const response = await fetch(endpoint, {
        method: "POST",
        headers: {
            "Authorization": authorization,
            "Content-Encoding": "aes128gcm",
            "Content-Type": "application/octet-stream",
            "TTL": String(PUSH_TTL_SECONDS),
            "Urgency": "normal"
        },
        body: encrypted
    });

    if (response.status === 404 || response.status === 410) {
        await env.DB.prepare(`
            DELETE FROM push_subscriptions
            WHERE endpoint = ?
        `).bind(endpoint).run();
        return;
    }

    if (!response.ok) {
        throw new Error(`Servizio push non disponibile: HTTP ${response.status}.`);
    }
}

async function createVapidAuthorization(env, vapidKey, audience) {
    const header = encodeJsonBase64Url({ typ: "JWT", alg: "ES256" });
    const claims = encodeJsonBase64Url({
        aud: audience,
        exp: Math.floor(Date.now() / 1000) + 12 * 60 * 60,
        sub: env.ALLOWED_ORIGIN || "https://anonmrcn-ctrl.github.io"
    });
    const unsignedToken = `${header}.${claims}`;
    const privateJwk = await decryptPrivateKey(
        env,
        vapidKey.encrypted_private_key
    );

    const privateKey = await crypto.subtle.importKey(
        "jwk",
        privateJwk,
        { name: "ECDSA", namedCurve: "P-256" },
        false,
        ["sign"]
    );

    const signature = new Uint8Array(await crypto.subtle.sign(
        { name: "ECDSA", hash: "SHA-256" },
        privateKey,
        encodeText(unsignedToken)
    ));

    return `vapid t=${unsignedToken}.${toBase64Url(signature)}, k=${vapidKey.public_key}`;
}

async function encryptPushPayload(subscription, notification) {
    const userPublicBytes = fromBase64Url(subscription.p256dh);
    const authenticationSecret = fromBase64Url(subscription.auth);

    const userPublicKey = await crypto.subtle.importKey(
        "raw",
        userPublicBytes,
        { name: "ECDH", namedCurve: "P-256" },
        false,
        []
    );

    const serverPair = await crypto.subtle.generateKey(
        { name: "ECDH", namedCurve: "P-256" },
        true,
        ["deriveBits"]
    );

    const serverPublicBytes = new Uint8Array(
        await crypto.subtle.exportKey("raw", serverPair.publicKey)
    );

    const sharedSecret = new Uint8Array(await crypto.subtle.deriveBits(
        { name: "ECDH", public: userPublicKey },
        serverPair.privateKey,
        256
    ));

    const keyInfo = concatBytes(
        encodeText("WebPush: info\u0000"),
        userPublicBytes,
        serverPublicBytes
    );

    const inputKeyingMaterial = await deriveHkdf(
        sharedSecret,
        authenticationSecret,
        keyInfo,
        256
    );

    const salt = crypto.getRandomValues(new Uint8Array(16));

    const contentKey = await deriveHkdf(
        inputKeyingMaterial,
        salt,
        encodeText("Content-Encoding: aes128gcm\u0000"),
        128
    );

    const nonce = await deriveHkdf(
        inputKeyingMaterial,
        salt,
        encodeText("Content-Encoding: nonce\u0000"),
        96
    );

    const plaintext = concatBytes(
        encodeText(JSON.stringify(notification)),
        Uint8Array.of(2)
    );

    if (plaintext.length + 16 >= PUSH_RECORD_SIZE) {
        throw new Error("Notifica push troppo lunga.");
    }

    const encryptionKey = await crypto.subtle.importKey(
        "raw",
        contentKey,
        { name: "AES-GCM" },
        false,
        ["encrypt"]
    );

    const ciphertext = new Uint8Array(await crypto.subtle.encrypt(
        { name: "AES-GCM", iv: nonce },
        encryptionKey,
        plaintext
    ));

    const recordSize = new Uint8Array(4);
    new DataView(recordSize.buffer).setUint32(0, PUSH_RECORD_SIZE);

    return concatBytes(
        salt,
        recordSize,
        Uint8Array.of(serverPublicBytes.length),
        serverPublicBytes,
        ciphertext
    );
}

async function deriveHkdf(material, salt, info, length) {
    const key = await crypto.subtle.importKey(
        "raw",
        material,
        "HKDF",
        false,
        ["deriveBits"]
    );

    return new Uint8Array(await crypto.subtle.deriveBits(
        { name: "HKDF", hash: "SHA-256", salt, info },
        key,
        length
    ));
}

async function subscriptionId(identity, endpoint) {
    const digest = await crypto.subtle.digest("SHA-256", encodeText(endpoint));
    const location = identity.locationId === null
        ? "admin"
        : String(identity.locationId);

    return `${identity.audience}:${location}:${toBase64Url(new Uint8Array(digest))}`;
}

function validateEndpoint(value) {
    const endpoint = String(value || "");

    if (!endpoint || endpoint.length > 2048) {
        throw new PushRequestError("Indirizzo push non valido.");
    }

    let url;

    try {
        url = new URL(endpoint);
    } catch (_) {
        throw new PushRequestError("Indirizzo push non valido.");
    }

    const host = url.hostname.toLowerCase();
    const supportedHost =
        host === "fcm.googleapis.com" ||
        host === "updates.push.services.mozilla.com" ||
        host.endsWith(".push.services.mozilla.com") ||
        host === "web.push.apple.com" ||
        host.endsWith(".push.apple.com") ||
        host.endsWith(".notify.windows.com") ||
        host.endsWith(".wns.windows.com");

    if (
        url.protocol !== "https:" ||
        url.username ||
        url.password ||
        !supportedHost
    ) {
        throw new PushRequestError("Servizio push non riconosciuto.");
    }

    return endpoint;
}

function validatePublicKey(value) {
    const encoded = String(value || "");
    const bytes = decodeSubscriptionValue(encoded);

    if (bytes.length !== 65 || bytes[0] !== 4) {
        throw new PushRequestError("Chiave pubblica push non valida.");
    }

    return encoded;
}

function validateAuthenticationSecret(value) {
    const encoded = String(value || "");
    const bytes = decodeSubscriptionValue(encoded);

    if (bytes.length !== 16) {
        throw new PushRequestError("Chiave di autenticazione push non valida.");
    }

    return encoded;
}

function decodeSubscriptionValue(value) {
    if (!/^[A-Za-z0-9_-]+$/.test(value)) {
        throw new PushRequestError("Dati push non validi.");
    }

    try {
        return fromBase64Url(value);
    } catch (_) {
        throw new PushRequestError("Dati push non validi.");
    }
}

function encodeJsonBase64Url(value) {
    return toBase64Url(encodeText(JSON.stringify(value)));
}

function encodeText(value) {
    return new TextEncoder().encode(value);
}

function concatBytes(...parts) {
    const result = new Uint8Array(
        parts.reduce((length, part) => length + part.length, 0)
    );
    let offset = 0;

    parts.forEach((part) => {
        result.set(part, offset);
        offset += part.length;
    });

    return result;
}

function toBase64Url(bytes) {
    let binary = "";

    bytes.forEach((byte) => {
        binary += String.fromCharCode(byte);
    });

    return btoa(binary)
        .replaceAll("+", "-")
        .replaceAll("/", "_")
        .replaceAll("=", "");
}

function fromBase64Url(value) {
    const normalized = value.replaceAll("-", "+").replaceAll("_", "/");
    const padded = normalized + "=".repeat((4 - normalized.length % 4) % 4);
    const binary = atob(padded);

    return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}
