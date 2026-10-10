import { ADMIN_AUTH_STORAGE_STATEMENTS } from "./cms-schema.js";

const CHALLENGE_TTL_MS = 5 * 60 * 1000;
const SESSION_TTL_MS = 8 * 60 * 60 * 1000;
const MAX_AUTH_REQUEST_BYTES = 128 * 1024;
const ADMIN_ORIGIN = "https://anonmrcn-ctrl.github.io";
const initializations = new WeakMap();

export async function handleAdminAuthRequest(request, env, path) {
    if (request.method === "GET" && path === "/api/admin/auth/status") {
        await ensureAdminAuthStorage(env);
        return json(request, env, {
            configured: await adminCredentialCount(env) > 0,
            passkeysSupported: true
        });
    }
    if (request.method === "POST" && path === "/api/admin/auth/bootstrap/options") {
        return await bootstrapOptions(request, env);
    }
    if (request.method === "POST" && path === "/api/admin/auth/bootstrap/verify") {
        return await bootstrapVerify(request, env);
    }
    if (request.method === "POST" && path === "/api/admin/auth/options") {
        return await loginOptions(request, env);
    }
    if (request.method === "POST" && path === "/api/admin/auth/verify") {
        return await loginVerify(request, env);
    }
    if (request.method === "GET" && path === "/api/admin/auth/session") {
        return await sessionInfo(request, env);
    }
    if (request.method === "POST" && path === "/api/admin/auth/logout") {
        return await logout(request, env);
    }
    if (request.method === "POST" && path === "/api/admin/auth/credentials/options") {
        return await additionalCredentialOptions(request, env);
    }
    if (request.method === "POST" && path === "/api/admin/auth/credentials/verify") {
        return await additionalCredentialVerify(request, env);
    }
    if (request.method === "GET" && path === "/api/admin/auth/credentials") {
        return await listCredentials(request, env);
    }
    return null;
}

export async function adminAuthorized(request, env) {
    await ensureAdminAuthStorage(env);
    if (await activeAdminSession(request, env)) return true;
    if (await adminCredentialCount(env)) return false;
    return await legacyTokenMatches(request, env);
}

export async function ensureAdminAuthStorage(env) {
    let initialization = initializations.get(env.DB);
    if (!initialization) {
        initialization = env.DB.batch(
            ADMIN_AUTH_STORAGE_STATEMENTS.map((statement) =>
                env.DB.prepare(statement)
            )
        ).catch((error) => {
            initializations.delete(env.DB);
            throw error;
        });
        initializations.set(env.DB, initialization);
    }
    await initialization;
}

export async function purgeExpiredAdminAuth(env, now = Date.now()) {
    await ensureAdminAuthStorage(env);
    await env.DB.batch([
        env.DB.prepare(`
            DELETE FROM admin_auth_challenges
            WHERE expires_at <= ? OR used_at IS NOT NULL
        `).bind(now),
        env.DB.prepare(`
            DELETE FROM admin_sessions WHERE expires_at <= ?
        `).bind(now)
    ]);
}

async function bootstrapOptions(request, env) {
    await ensureAdminAuthStorage(env);
    if (await adminCredentialCount(env)) {
        return json(request, env, {
            error: "La prima passkey è già configurata. Usa Accedi con passkey."
        }, 409);
    }
    if (!(await legacyTokenMatches(request, env))) {
        return unauthorized(request, env);
    }
    const displayName = normalizeDisplayName((await readJson(request))?.displayName);
    if (!displayName) {
        return json(request, env, {
            error: "Inserisci un nome da associare alla passkey."
        }, 400);
    }
    const identityId = crypto.randomUUID();
    const userHandle = base64Url(new TextEncoder().encode(identityId));
    const issued = await issueChallenge(env, "bootstrap", null, userHandle);
    return json(request, env, {
        challengeId: issued.id,
        publicKey: registrationOptions(env, issued.challenge, userHandle, displayName, [])
    });
}

async function bootstrapVerify(request, env) {
    await ensureAdminAuthStorage(env);
    if (await adminCredentialCount(env)) {
        return json(request, env, {
            error: "La prima passkey è già configurata."
        }, 409);
    }
    if (!(await legacyTokenMatches(request, env))) {
        return unauthorized(request, env);
    }
    const value = await readJson(request);
    const displayName = normalizeDisplayName(value?.displayName);
    if (!displayName) {
        return json(request, env, { error: "Nome amministratore non valido." }, 400);
    }
    const challenge = await validChallenge(env, value?.challengeId, "bootstrap");
    if (!challenge) {
        return json(request, env, { error: "Richiesta scaduta o già usata." }, 409);
    }
    const identityId = decodeIdentityId(challenge.user_handle);
    if (!identityId) {
        return json(request, env, { error: "Identità di registrazione non valida." }, 400);
    }
    const registration = await verifyRegistration(
        value?.credential,
        challenge,
        authSettings(env)
    );
    if (registration.error) {
        return json(request, env, { error: registration.error }, 400);
    }
    const now = Date.now();
    const consumed = await consumeChallenge(env, challenge.id, now);
    if (!consumed) {
        return json(request, env, { error: "Richiesta già usata." }, 409);
    }
    await env.DB.batch([
        env.DB.prepare(`
            INSERT INTO admin_identities (id, display_name, created_at, last_login_at)
            VALUES (?, ?, ?, ?)
        `).bind(identityId, displayName, now, now),
        credentialInsert(
            env,
            identityId,
            challenge.user_handle,
            registration,
            now
        )
    ]);
    return json(request, env, await createSessionPayload(env, identityId, now), 201);
}

async function loginOptions(request, env) {
    await ensureAdminAuthStorage(env);
    if (!(await adminCredentialCount(env))) {
        return json(request, env, {
            error: "Nessuna passkey configurata. Configura prima la passkey iniziale."
        }, 409);
    }
    const issued = await issueChallenge(env, "login");
    return json(request, env, {
        challengeId: issued.id,
        publicKey: {
            challenge: issued.challenge,
            timeout: CHALLENGE_TTL_MS,
            rpId: authSettings(env).rpId,
            userVerification: "required"
        }
    });
}

async function loginVerify(request, env) {
    await ensureAdminAuthStorage(env);
    const value = await readJson(request);
    const challenge = await validChallenge(env, value?.challengeId, "login");
    if (!challenge) {
        return json(request, env, { error: "Richiesta scaduta o già usata." }, 409);
    }
    const credentialId = normalizeCredentialId(value?.credential?.rawId || value?.credential?.id);
    const credential = credentialId
        ? await env.DB.prepare(`
            SELECT credential.*, identity.display_name
            FROM admin_credentials credential
            INNER JOIN admin_identities identity ON identity.id = credential.identity_id
            WHERE credential.credential_id = ?
            LIMIT 1
        `).bind(credentialId).first()
        : null;
    if (!credential) {
        return json(request, env, { error: "Passkey non riconosciuta." }, 401);
    }
    const assertion = await verifyAssertion(
        value?.credential,
        challenge,
        credential,
        authSettings(env)
    );
    if (assertion.error) {
        return json(request, env, { error: assertion.error }, 401);
    }
    const now = Date.now();
    const consumed = await consumeChallenge(env, challenge.id, now);
    if (!consumed) {
        return json(request, env, { error: "Richiesta già usata." }, 409);
    }
    await env.DB.batch([
        env.DB.prepare(`
            UPDATE admin_credentials
            SET sign_count = ?, last_used_at = ?
            WHERE credential_id = ?
        `).bind(assertion.signCount, now, credential.credential_id),
        env.DB.prepare(`
            UPDATE admin_identities SET last_login_at = ? WHERE id = ?
        `).bind(now, credential.identity_id)
    ]);
    return json(request, env, await createSessionPayload(
        env,
        credential.identity_id,
        now
    ));
}

async function sessionInfo(request, env) {
    await ensureAdminAuthStorage(env);
    const session = await activeAdminSession(request, env);
    if (!session) return unauthorized(request, env);
    return json(request, env, {
        authenticated: true,
        identity: {
            id: session.identity_id,
            displayName: session.display_name
        },
        expiresAt: Number(session.expires_at)
    });
}

async function logout(request, env) {
    await ensureAdminAuthStorage(env);
    const token = bearerToken(request);
    if (token) {
        await env.DB.prepare("DELETE FROM admin_sessions WHERE session_hash = ?")
            .bind(await sha256Hex(token)).run();
    }
    return json(request, env, { ok: true });
}

async function additionalCredentialOptions(request, env) {
    await ensureAdminAuthStorage(env);
    const session = await activeAdminSession(request, env);
    if (!session) return unauthorized(request, env);
    const credentials = await readCredentials(env, session.identity_id);
    const userHandle = base64Url(new TextEncoder().encode(session.identity_id));
    const issued = await issueChallenge(
        env,
        "register",
        session.identity_id,
        userHandle
    );
    return json(request, env, {
        challengeId: issued.id,
        publicKey: registrationOptions(
            env,
            issued.challenge,
            userHandle,
            session.display_name,
            credentials.map((credential) => credential.credential_id)
        )
    });
}

async function additionalCredentialVerify(request, env) {
    await ensureAdminAuthStorage(env);
    const session = await activeAdminSession(request, env);
    if (!session) return unauthorized(request, env);
    const value = await readJson(request);
    const challenge = await validChallenge(env, value?.challengeId, "register");
    if (!challenge || challenge.identity_id !== session.identity_id) {
        return json(request, env, { error: "Richiesta scaduta o non valida." }, 409);
    }
    const registration = await verifyRegistration(
        value?.credential,
        challenge,
        authSettings(env)
    );
    if (registration.error) {
        return json(request, env, { error: registration.error }, 400);
    }
    const duplicate = await env.DB.prepare(`
        SELECT credential_id FROM admin_credentials WHERE credential_id = ? LIMIT 1
    `).bind(registration.credentialId).first();
    if (duplicate) {
        return json(request, env, { error: "Questa passkey è già registrata." }, 409);
    }
    const now = Date.now();
    const consumed = await consumeChallenge(env, challenge.id, now);
    if (!consumed) {
        return json(request, env, { error: "Richiesta già usata." }, 409);
    }
    await credentialInsert(
        env,
        session.identity_id,
        challenge.user_handle,
        registration,
        now
    ).run();
    return json(request, env, {
        credential: credentialPayload({
            credential_id: registration.credentialId,
            transports_json: JSON.stringify(registration.transports),
            created_at: now,
            last_used_at: null
        }),
        created: true
    }, 201);
}

async function listCredentials(request, env) {
    await ensureAdminAuthStorage(env);
    const session = await activeAdminSession(request, env);
    if (!session) return unauthorized(request, env);
    const credentials = await readCredentials(env, session.identity_id);
    return json(request, env, {
        identity: { id: session.identity_id, displayName: session.display_name },
        credentials: credentials.map(credentialPayload)
    });
}

function credentialPayload(row) {
    return {
        id: row.credential_id,
        transports: parseTransports(row.transports_json),
        createdAt: Number(row.created_at),
        lastUsedAt: row.last_used_at === null ? null : Number(row.last_used_at)
    };
}

function registrationOptions(env, challenge, userHandle, displayName, excludedIds) {
    return {
        challenge,
        rp: {
            id: authSettings(env).rpId,
            name: "anonMrcn"
        },
        user: {
            id: userHandle,
            name: displayName,
            displayName
        },
        pubKeyCredParams: [{ type: "public-key", alg: -7 }],
        timeout: CHALLENGE_TTL_MS,
        attestation: "none",
        authenticatorSelection: {
            residentKey: "required",
            requireResidentKey: true,
            userVerification: "required"
        },
        excludeCredentials: excludedIds.map((id) => ({
            type: "public-key",
            id
        }))
    };
}

async function issueChallenge(env, purpose, identityId = null, userHandle = "") {
    const challenge = randomToken(32);
    const id = crypto.randomUUID();
    const now = Date.now();
    await env.DB.prepare(`
        INSERT INTO admin_auth_challenges (
            id, purpose, challenge_hash, identity_id, user_handle,
            created_at, expires_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `).bind(
        id,
        purpose,
        await sha256Hex(challenge),
        identityId,
        userHandle,
        now,
        now + CHALLENGE_TTL_MS
    ).run();
    return { id, challenge };
}

async function validChallenge(env, challengeIdValue, purpose) {
    const challengeId = String(challengeIdValue || "").trim().toLowerCase();
    if (!/^[0-9a-f-]{36}$/u.test(challengeId)) return null;
    return await env.DB.prepare(`
        SELECT * FROM admin_auth_challenges
        WHERE id = ? AND purpose = ? AND used_at IS NULL AND expires_at > ?
        LIMIT 1
    `).bind(challengeId, purpose, Date.now()).first();
}

async function consumeChallenge(env, challengeId, now) {
    const result = await env.DB.prepare(`
        UPDATE admin_auth_challenges SET used_at = ?
        WHERE id = ? AND used_at IS NULL AND expires_at > ?
    `).bind(now, challengeId, now).run();
    return Number(result.meta?.changes) === 1;
}

async function verifyRegistration(value, challenge, settings) {
    try {
        if (value?.type !== "public-key") {
            return { error: "Tipo di credenziale non supportato." };
        }
        const rawId = fromBase64Url(value?.rawId || value?.id || "");
        const clientData = fromBase64Url(value?.response?.clientDataJSON || "");
        const attestation = fromBase64Url(value?.response?.attestationObject || "");
        await verifyClientData(clientData, "webauthn.create", challenge, settings);
        const decoded = decodeCbor(attestation).value;
        if (!(decoded instanceof Map) || decoded.get("fmt") !== "none") {
            return { error: "La passkey usa un formato di attestazione non supportato." };
        }
        const authData = decoded.get("authData");
        if (!(authData instanceof Uint8Array)) {
            return { error: "Dati della passkey mancanti." };
        }
        const parsed = await parseRegistrationAuthData(authData, settings.rpId);
        if (!safeEqual(rawId, parsed.credentialIdBytes)) {
            return { error: "Identificativo della passkey incoerente." };
        }
        return {
            credentialId: base64Url(parsed.credentialIdBytes),
            publicKeySpki: parsed.publicKeySpki,
            signCount: parsed.signCount,
            transports: normalizeTransports(value?.response?.transports),
            rpId: settings.rpId
        };
    } catch (error) {
        return { error: error instanceof Error ? error.message : "Passkey non valida." };
    }
}

async function verifyAssertion(value, challenge, credential, settings) {
    try {
        if (value?.type !== "public-key") {
            return { error: "Tipo di credenziale non supportato." };
        }
        const rawId = fromBase64Url(value?.rawId || value?.id || "");
        if (base64Url(rawId) !== credential.credential_id) {
            return { error: "Passkey non riconosciuta." };
        }
        const clientData = fromBase64Url(value?.response?.clientDataJSON || "");
        const authenticatorData = fromBase64Url(value?.response?.authenticatorData || "");
        const signature = fromBase64Url(value?.response?.signature || "");
        await verifyClientData(clientData, "webauthn.get", challenge, settings);
        const parsed = await parseAssertionAuthData(authenticatorData, settings.rpId);
        const signed = concatenate(authenticatorData, await sha256Bytes(clientData));
        const key = await crypto.subtle.importKey(
            "spki",
            fromBase64Url(credential.public_key_spki),
            { name: "ECDSA", namedCurve: "P-256" },
            false,
            ["verify"]
        );
        const valid = await crypto.subtle.verify(
            { name: "ECDSA", hash: "SHA-256" },
            key,
            derEcdsaToRaw(signature),
            signed
        );
        if (!valid) return { error: "Firma della passkey non valida." };
        const previous = Number(credential.sign_count) || 0;
        if (previous > 0 && parsed.signCount > 0 && parsed.signCount <= previous) {
            return { error: "Contatore della passkey non valido." };
        }
        return { signCount: parsed.signCount };
    } catch (error) {
        return { error: error instanceof Error ? error.message : "Accesso non valido." };
    }
}

async function verifyClientData(bytes, type, challenge, settings) {
    let client;
    try {
        client = JSON.parse(new TextDecoder().decode(bytes));
    } catch (_) {
        throw new Error("Dati client della passkey non validi.");
    }
    if (client.type !== type || client.origin !== settings.origin || client.crossOrigin === true) {
        throw new Error("Origine o tipo della passkey non validi.");
    }
    if (await sha256Hex(String(client.challenge || "")) !== challenge.challenge_hash) {
        throw new Error("Sfida della passkey non valida.");
    }
}

async function parseRegistrationAuthData(bytes, rpId) {
    if (bytes.length < 55) throw new Error("Dati autenticatore incompleti.");
    await verifyRpAndFlags(bytes, rpId, true);
    const signCount = uint32be(bytes, 33);
    const credentialLength = (bytes[53] << 8) | bytes[54];
    const credentialStart = 55;
    const credentialEnd = credentialStart + credentialLength;
    if (!credentialLength || credentialEnd >= bytes.length) {
        throw new Error("Identificativo della passkey mancante.");
    }
    const credentialIdBytes = bytes.slice(credentialStart, credentialEnd);
    const cose = decodeCbor(bytes, credentialEnd).value;
    if (!(cose instanceof Map) || cose.get(1) !== 2 ||
        cose.get(3) !== -7 || cose.get(-1) !== 1) {
        throw new Error("La passkey deve usare ECDSA P-256.");
    }
    const x = cose.get(-2);
    const y = cose.get(-3);
    if (!(x instanceof Uint8Array) || x.length !== 32 ||
        !(y instanceof Uint8Array) || y.length !== 32) {
        throw new Error("Chiave pubblica della passkey non valida.");
    }
    const key = await crypto.subtle.importKey(
        "jwk",
        { kty: "EC", crv: "P-256", x: base64Url(x), y: base64Url(y), ext: true },
        { name: "ECDSA", namedCurve: "P-256" },
        true,
        ["verify"]
    );
    const spki = new Uint8Array(await crypto.subtle.exportKey("spki", key));
    return { credentialIdBytes, publicKeySpki: base64Url(spki), signCount };
}

async function parseAssertionAuthData(bytes, rpId) {
    if (bytes.length < 37) throw new Error("Dati autenticatore incompleti.");
    await verifyRpAndFlags(bytes, rpId, false);
    return { signCount: uint32be(bytes, 33) };
}

async function verifyRpAndFlags(bytes, rpId, registration) {
    const expected = await sha256Bytes(new TextEncoder().encode(rpId));
    if (!safeEqual(bytes.slice(0, 32), expected)) {
        throw new Error("Dominio della passkey non valido.");
    }
    const flags = bytes[32];
    if (!(flags & 0x01) || !(flags & 0x04)) {
        throw new Error("La passkey richiede presenza e verifica dell’utente.");
    }
    if (registration && !(flags & 0x40)) {
        throw new Error("Dati di registrazione della passkey mancanti.");
    }
}

function decodeCbor(bytes, start = 0) {
    let offset = start;
    const first = bytes[offset++];
    if (first === undefined) throw new Error("CBOR incompleto.");
    const major = first >> 5;
    const additional = first & 0x1f;
    const lengthInfo = cborLength(bytes, offset, additional);
    const length = lengthInfo.value;
    offset = lengthInfo.offset;
    if (major === 0) return { value: length, offset };
    if (major === 1) return { value: -1 - length, offset };
    if (major === 2) {
        const end = offset + length;
        if (end > bytes.length) throw new Error("CBOR incompleto.");
        return { value: bytes.slice(offset, end), offset: end };
    }
    if (major === 3) {
        const end = offset + length;
        if (end > bytes.length) throw new Error("CBOR incompleto.");
        return { value: new TextDecoder().decode(bytes.slice(offset, end)), offset: end };
    }
    if (major === 4) {
        const value = [];
        for (let index = 0; index < length; index += 1) {
            const item = decodeCbor(bytes, offset);
            value.push(item.value);
            offset = item.offset;
        }
        return { value, offset };
    }
    if (major === 5) {
        const value = new Map();
        for (let index = 0; index < length; index += 1) {
            const key = decodeCbor(bytes, offset);
            const item = decodeCbor(bytes, key.offset);
            value.set(key.value, item.value);
            offset = item.offset;
        }
        return { value, offset };
    }
    if (major === 7 && additional === 20) return { value: false, offset };
    if (major === 7 && additional === 21) return { value: true, offset };
    if (major === 7 && additional === 22) return { value: null, offset };
    throw new Error("Tipo CBOR non supportato.");
}

function cborLength(bytes, offset, additional) {
    if (additional < 24) return { value: additional, offset };
    if (additional === 24) return { value: bytes[offset], offset: offset + 1 };
    if (additional === 25) {
        return { value: (bytes[offset] << 8) | bytes[offset + 1], offset: offset + 2 };
    }
    if (additional === 26) {
        return { value: uint32be(bytes, offset), offset: offset + 4 };
    }
    throw new Error("Lunghezza CBOR non supportata.");
}

function derEcdsaToRaw(signature) {
    if (signature.length === 64) return signature;
    let offset = 0;
    if (signature[offset++] !== 0x30) throw new Error("Firma ECDSA non valida.");
    const sequence = derLength(signature, offset);
    offset = sequence.offset;
    if (offset + sequence.length !== signature.length || signature[offset++] !== 0x02) {
        throw new Error("Firma ECDSA non valida.");
    }
    const rLength = derLength(signature, offset);
    offset = rLength.offset;
    const r = signature.slice(offset, offset + rLength.length);
    offset += rLength.length;
    if (signature[offset++] !== 0x02) throw new Error("Firma ECDSA non valida.");
    const sLength = derLength(signature, offset);
    offset = sLength.offset;
    const s = signature.slice(offset, offset + sLength.length);
    return concatenate(padInteger(r), padInteger(s));
}

function derLength(bytes, offset) {
    const first = bytes[offset++];
    if (first < 0x80) return { length: first, offset };
    const count = first & 0x7f;
    if (!count || count > 2) throw new Error("Firma ECDSA non valida.");
    let length = 0;
    for (let index = 0; index < count; index += 1) {
        length = (length << 8) | bytes[offset++];
    }
    return { length, offset };
}

function padInteger(bytes) {
    let value = bytes;
    while (value.length > 32 && value[0] === 0) value = value.slice(1);
    if (value.length > 32) throw new Error("Firma ECDSA non valida.");
    const padded = new Uint8Array(32);
    padded.set(value, 32 - value.length);
    return padded;
}

function credentialInsert(env, identityId, userHandle, registration, now) {
    return env.DB.prepare(`
        INSERT INTO admin_credentials (
            credential_id, identity_id, user_handle, public_key_spki,
            sign_count, transports_json, rp_id, created_at, last_used_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
        registration.credentialId,
        identityId,
        userHandle,
        registration.publicKeySpki,
        registration.signCount,
        JSON.stringify(registration.transports),
        registration.rpId,
        now,
        null
    );
}

async function createSessionPayload(env, identityId, now) {
    const token = randomToken(32);
    const expiresAt = now + SESSION_TTL_MS;
    await env.DB.prepare(`
        INSERT INTO admin_sessions (
            session_hash, identity_id, created_at, expires_at, last_seen_at
        ) VALUES (?, ?, ?, ?, ?)
    `).bind(await sha256Hex(token), identityId, now, expiresAt, now).run();
    const identity = await env.DB.prepare(`
        SELECT id, display_name FROM admin_identities WHERE id = ? LIMIT 1
    `).bind(identityId).first();
    return {
        token,
        expiresAt,
        identity: {
            id: identity.id,
            displayName: identity.display_name
        }
    };
}

async function activeAdminSession(request, env) {
    const token = bearerToken(request);
    if (!token) return null;
    const now = Date.now();
    const row = await env.DB.prepare(`
        SELECT
            session.session_hash,
            session.identity_id,
            session.expires_at,
            session.last_seen_at,
            identity.display_name
        FROM admin_sessions session
        INNER JOIN admin_identities identity ON identity.id = session.identity_id
        WHERE session.session_hash = ? AND session.expires_at > ?
        LIMIT 1
    `).bind(await sha256Hex(token), now).first();
    if (row && now - Number(row.last_seen_at) > 60 * 1000) {
        await env.DB.prepare(`
            UPDATE admin_sessions SET last_seen_at = ? WHERE session_hash = ?
        `).bind(now, row.session_hash).run();
    }
    return row;
}

async function legacyTokenMatches(request, env) {
    const supplied = request.headers.get("X-Admin-Token") || "";
    const expected = env.ADMIN_TOKEN || "";
    if (!supplied || !expected) return false;
    const [first, second] = await Promise.all([
        sha256Bytes(new TextEncoder().encode(supplied)),
        sha256Bytes(new TextEncoder().encode(expected))
    ]);
    return safeEqual(first, second);
}

async function adminCredentialCount(env) {
    const row = await env.DB.prepare(`
        SELECT COUNT(*) AS total FROM admin_credentials
    `).first();
    return Number(row?.total || 0);
}

async function readCredentials(env, identityId = "") {
    const statement = identityId
        ? env.DB.prepare(`
            SELECT * FROM admin_credentials
            WHERE identity_id = ? ORDER BY created_at, credential_id
        `).bind(identityId)
        : env.DB.prepare(`
            SELECT * FROM admin_credentials ORDER BY created_at, credential_id
        `);
    return (await statement.all()).results || [];
}

function authSettings(env) {
    const origin = new URL(env.ALLOWED_ORIGIN || ADMIN_ORIGIN).origin;
    const rpId = String(env.ADMIN_RP_ID || new URL(origin).hostname).toLowerCase();
    const hostname = new URL(origin).hostname.toLowerCase();
    if (hostname !== rpId && !hostname.endsWith(`.${rpId}`)) {
        throw new Error("ADMIN_RP_ID non corrisponde all’origine amministrativa.");
    }
    return { origin, rpId };
}

function normalizeDisplayName(value) {
    const name = String(value || "").trim();
    return name && name.length <= 120 ? name : "";
}

function normalizeCredentialId(value) {
    try {
        return base64Url(fromBase64Url(String(value || "")));
    } catch (_) {
        return "";
    }
}

function normalizeTransports(value) {
    if (!Array.isArray(value)) return [];
    const allowed = new Set(["ble", "hybrid", "internal", "nfc", "usb"]);
    return Array.from(new Set(value.map((item) => String(item || ""))
        .filter((item) => allowed.has(item))));
}

function parseTransports(value) {
    try {
        return normalizeTransports(JSON.parse(value || "[]"));
    } catch (_) {
        return [];
    }
}

function decodeIdentityId(value) {
    try {
        const id = new TextDecoder().decode(fromBase64Url(value));
        return /^[0-9a-f-]{36}$/u.test(id) ? id : "";
    } catch (_) {
        return "";
    }
}

function bearerToken(request) {
    const header = request.headers.get("Authorization") || "";
    return header.startsWith("Bearer ") ? header.slice(7).trim() : "";
}

function randomToken(length) {
    const bytes = new Uint8Array(length);
    crypto.getRandomValues(bytes);
    return base64Url(bytes);
}

async function sha256Hex(value) {
    const bytes = typeof value === "string"
        ? new TextEncoder().encode(value)
        : value;
    return toHex(await sha256Bytes(bytes));
}

async function sha256Bytes(value) {
    return new Uint8Array(await crypto.subtle.digest("SHA-256", value));
}

function safeEqual(first, second) {
    if (first.length !== second.length) return false;
    let difference = 0;
    for (let index = 0; index < first.length; index += 1) {
        difference |= first[index] ^ second[index];
    }
    return difference === 0;
}

function concatenate(...values) {
    const size = values.reduce((total, value) => total + value.length, 0);
    const joined = new Uint8Array(size);
    let offset = 0;
    for (const value of values) {
        joined.set(value, offset);
        offset += value.length;
    }
    return joined;
}

function uint32be(bytes, offset) {
    return ((bytes[offset] << 24) >>> 0) +
        (bytes[offset + 1] << 16) +
        (bytes[offset + 2] << 8) +
        bytes[offset + 3];
}

function base64Url(bytes) {
    let binary = "";
    bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
    return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function fromBase64Url(value) {
    const normalized = String(value || "").replaceAll("-", "+").replaceAll("_", "/");
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
    const binary = atob(padded);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
        bytes[index] = binary.charCodeAt(index);
    }
    return bytes;
}

function toHex(bytes) {
    return Array.from(bytes).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function readJson(request) {
    try {
        const contentLength = Number(request.headers.get("Content-Length"));
        if (Number.isFinite(contentLength) && contentLength > MAX_AUTH_REQUEST_BYTES) {
            return null;
        }
        const text = await request.text();
        if (new TextEncoder().encode(text).byteLength > MAX_AUTH_REQUEST_BYTES) {
            return null;
        }
        return JSON.parse(text);
    } catch (_) {
        return null;
    }
}

function unauthorized(request, env) {
    return json(request, env, { error: "Non autorizzato." }, 401);
}

function json(request, env, body, status = 200) {
    return new Response(JSON.stringify(body), {
        status,
        headers: {
            "Content-Type": "application/json; charset=utf-8",
            "Cache-Control": "no-store",
            "X-Content-Type-Options": "nosniff",
            ...corsHeaders(request, env)
        }
    });
}

function corsHeaders(request, env) {
    const origin = request.headers.get("Origin") || "";
    const allowedOrigin = env.ALLOWED_ORIGIN || ADMIN_ORIGIN;
    const headers = {
        "Access-Control-Allow-Methods": "GET,POST,PATCH,DELETE,OPTIONS",
        "Access-Control-Allow-Headers": "Authorization,Content-Type,X-Admin-Token,X-Memory-Token",
        "Access-Control-Max-Age": "86400",
        "Vary": "Origin"
    };
    if (origin === allowedOrigin || origin === "http://localhost:8000" ||
        origin === "http://127.0.0.1:8000") {
        headers["Access-Control-Allow-Origin"] = origin;
    }
    return headers;
}
