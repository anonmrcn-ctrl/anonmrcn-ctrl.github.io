import {
    getPushConfiguration,
    notifyPushSubscribers,
    PushRequestError,
    removePushSubscription,
    savePushSubscription
} from "./push.js";

// workerd refuses PBKDF2 requests above 100,000 iterations.
const PBKDF2_ITERATIONS = 100000;
const SESSION_TTL_MS = 12 * 60 * 60 * 1000;
const MESSAGE_LIMIT_PER_HOUR = 5;
const MAX_MESSAGE_LENGTH = 1500;
const MESSAGE_STATUSES = Object.freeze([
    "pending",
    "pending_delivery",
    "approved",
    "read",
    "delivered",
    "rejected"
]);

export default {
    async fetch(request, env, ctx) {
        try {
            if (request.method === "OPTIONS") {
                return new Response(null, {
                    status: 204,
                    headers: corsHeaders(request, env)
                });
            }

            const url = new URL(request.url);
            const path = url.pathname;

            if (request.method === "POST" && path === "/api/login") {
                return await login(request, env);
            }

            if (request.method === "GET" && path === "/api/session") {
                return await sessionInfo(request, env);
            }

            if (request.method === "POST" && path === "/api/logout") {
                return await logout(request, env);
            }

            if (request.method === "GET" && path === "/api/locations") {
                return await listLocations(request, env);
            }

            if (request.method === "GET" && path.startsWith("/api/poems/")) {
                const id = Number(path.split("/").pop());
                return await getPoem(request, env, id);
            }

            if (request.method === "GET" && path === "/api/messages") {
                return await listMessages(request, env);
            }

            if (request.method === "POST" && path === "/api/messages") {
                return await createMessage(request, env, ctx);
            }

            if (request.method === "PATCH" && /^\/api\/messages\/\d+$/.test(path)) {
                const id = Number(path.split("/").pop());
                return await markMessage(request, env, id);
            }

            if (request.method === "GET" && path === "/api/admin/messages") {
                return await adminListMessages(request, env, url);
            }

            if (request.method === "PATCH" && /^\/api\/admin\/messages\/\d+$/.test(path)) {
                const id = Number(path.split("/").pop());
                return await adminUpdateMessage(request, env, ctx, id);
            }

            if (request.method === "GET" && path === "/api/push/config") {
                return await pushConfiguration(request, env);
            }

            if (request.method === "POST" && path === "/api/push/subscribe") {
                return await subscribeToPush(request, env);
            }

            if (request.method === "POST" && path === "/api/push/unsubscribe") {
                return await unsubscribeFromPush(request, env);
            }

            if (request.method === "GET" && path === "/api/health") {
                return json(request, env, {
                    ok: true,
                    service: "nnmrcn-rete"
                });
            }

            return json(request, env, {
                error: "Not found."
            }, 404);
        } catch (error) {
            console.error(JSON.stringify({
                event: "worker_request_failed",
                method: request.method,
                path: new URL(request.url).pathname,
                error: error instanceof Error ? error.message : String(error)
            }));

            return json(request, env, {
                error: "Errore interno."
            }, 500);
        }
    }
};

async function login(request, env) {
    const body = await readJson(request);
    const password = normalizePassword(body?.password);

    if (!password) {
        return json(request, env, {
            error: "Password non valida."
        }, 400);
    }

    if (!env.PASSWORD_PEPPER) {
        throw new Error("PASSWORD_PEPPER secret missing.");
    }

    const lookup = await hmacHex(env.PASSWORD_PEPPER, password);

    const location = await env.DB.prepare(`
        SELECT
            id,
            address,
            password_salt,
            password_hash
        FROM locations
        WHERE password_lookup = ?
        LIMIT 1
    `).bind(lookup).first();

    if (!location) {
        return json(request, env, {
            error: "Password non riconosciuta."
        }, 401);
    }

    const valid = await verifyPassword(
        password,
        location.password_salt,
        location.password_hash
    );

    if (!valid) {
        return json(request, env, {
            error: "Password non riconosciuta."
        }, 401);
    }

    const now = Date.now();
    const expiresAt = now + SESSION_TTL_MS;
    const token = randomToken(32);
    const sessionHash = await sha256Hex(token);

    await env.DB.prepare(`
        DELETE FROM sessions
        WHERE expires_at <= ?
    `).bind(now).run();

    await env.DB.prepare(`
        INSERT INTO sessions (
            session_hash,
            location_id,
            created_at,
            expires_at
        )
        VALUES (?, ?, ?, ?)
    `).bind(
        sessionHash,
        location.id,
        now,
        expiresAt
    ).run();

    return json(request, env, {
        token,
        expiresAt,
        location: {
            id: location.id,
            address: location.address
        }
    });
}

async function sessionInfo(request, env) {
    const session = await requireSession(request, env);

    if (!session) {
        return json(request, env, {
            error: "Sessione non valida."
        }, 401);
    }

    return json(request, env, {
        location: {
            id: session.location_id,
            address: session.address
        },
        expiresAt: session.expires_at
    });
}

async function logout(request, env) {
    const token = bearerToken(request);

    if (token) {
        const sessionHash = await sha256Hex(token);

        await env.DB.prepare(`
            DELETE FROM sessions
            WHERE session_hash = ?
        `).bind(sessionHash).run();
    }

    return json(request, env, {
        ok: true
    });
}

async function listLocations(request, env) {
    const session = await requireSession(request, env);

    if (!session) {
        return unauthorized(request, env);
    }

    const result = await env.DB.prepare(`
        SELECT
            l.id,
            l.address,
            l.lat,
            l.lon,
            CASE
                WHEN p.location_id IS NULL THEN 0
                ELSE 1
            END AS has_poem
        FROM locations l
        LEFT JOIN poems p
            ON p.location_id = l.id
        ORDER BY l.id
    `).all();

    return json(request, env, {
        locations: (result.results || []).map((row) => ({
            id: row.id,
            address: row.address,
            lat: row.lat,
            lon: row.lon,
            hasPoem: Boolean(row.has_poem)
        }))
    });
}

async function getPoem(request, env, locationId) {
    const session = await requireSession(request, env);

    if (!session) {
        return unauthorized(request, env);
    }

    if (!Number.isInteger(locationId) || locationId <= 0) {
        return json(request, env, {
            error: "Location non valida."
        }, 400);
    }

    const poem = await env.DB.prepare(`
        SELECT html
        FROM poems
        WHERE location_id = ?
        LIMIT 1
    `).bind(locationId).first();

    if (!poem) {
        return json(request, env, {
            error: "Poesia non disponibile."
        }, 404);
    }

    return json(request, env, {
        html: poem.html
    });
}

async function listMessages(request, env) {
    const session = await requireSession(request, env);

    if (!session) {
        return unauthorized(request, env);
    }

    const result = await env.DB.prepare(`
        SELECT
            m.id,
            m.text,
            m.reveal_sender,
            m.created_at,
            m.status,
            CASE
                WHEN m.reveal_sender = 1 THEN sender.address
                ELSE NULL
            END AS sender_address
        FROM messages m
        JOIN locations sender
            ON sender.id = m.sender_location_id
        WHERE
            m.recipient_location_id = ?
            AND m.delivery_type = 'online'
            AND m.status IN ('approved', 'read')
        ORDER BY m.created_at DESC
        LIMIT 100
    `).bind(session.location_id).all();

    return json(request, env, {
        messages: (result.results || []).map((row) => ({
            id: row.id,
            text: row.text,
            senderAddress: row.sender_address,
            createdAt: row.created_at,
            status: row.status
        }))
    });
}

async function createMessage(request, env, ctx) {
    const session = await requireSession(request, env);

    if (!session) {
        return unauthorized(request, env);
    }

    const body = await readJson(request);
    const recipientId = Number(body?.recipientId);
    const text = String(body?.text || "").trim();
    const revealSender = body?.revealSender === true;
    const deliveryType =
        body?.deliveryType === "physical"
            ? "physical"
            : "online";

    if (!Number.isInteger(recipientId) || recipientId <= 0) {
        return json(request, env, {
            error: "Destinatario non valido."
        }, 400);
    }

    if (recipientId === Number(session.location_id)) {
        return json(request, env, {
            error: "Non puoi inviare un messaggio alla tua stessa location."
        }, 400);
    }

    if (!text || text.length > MAX_MESSAGE_LENGTH) {
        return json(request, env, {
            error: `Il messaggio deve contenere da 1 a ${MAX_MESSAGE_LENGTH} caratteri.`
        }, 400);
    }

    const recipient = await env.DB.prepare(`
        SELECT id
        FROM locations
        WHERE id = ?
        LIMIT 1
    `).bind(recipientId).first();

    if (!recipient) {
        return json(request, env, {
            error: "Destinatario non trovato."
        }, 404);
    }

    const oneHourAgo = Date.now() - 60 * 60 * 1000;

    const countRow = await env.DB.prepare(`
        SELECT COUNT(*) AS count
        FROM messages
        WHERE
            sender_location_id = ?
            AND created_at >= ?
    `).bind(
        session.location_id,
        oneHourAgo
    ).first();

    if (Number(countRow?.count || 0) >= MESSAGE_LIMIT_PER_HOUR) {
        return json(request, env, {
            error: "Limite temporaneo di invio raggiunto."
        }, 429);
    }

    const now = Date.now();
    const status =
        deliveryType === "physical"
            ? "pending_delivery"
            : "pending";

    const result = await env.DB.prepare(`
        INSERT INTO messages (
            sender_location_id,
            recipient_location_id,
            text,
            reveal_sender,
            delivery_type,
            status,
            created_at,
            updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
        session.location_id,
        recipientId,
        text,
        revealSender ? 1 : 0,
        deliveryType,
        status,
        now,
        now
    ).run();

    const messageId = result.meta?.last_row_id ?? null;

    queuePushNotification(
        ctx,
        env,
        "admin",
        null,
        {
            title: "nnMrcn — nuovo messaggio",
            body: deliveryType === "physical"
                ? "È arrivata una lettera da controllare."
                : "È arrivato un messaggio da approvare.",
            url: "/admin.html",
            tag: `nnmrcn-admin-${messageId || now}`
        }
    );

    return json(request, env, {
        ok: true,
        id: messageId,
        status
    }, 201);
}

async function markMessage(request, env, messageId) {
    const session = await requireSession(request, env);

    if (!session) {
        return unauthorized(request, env);
    }

    const body = await readJson(request);

    if (body?.action !== "read") {
        return json(request, env, {
            error: "Azione non valida."
        }, 400);
    }

    await env.DB.prepare(`
        UPDATE messages
        SET
            status = 'read',
            updated_at = ?
        WHERE
            id = ?
            AND recipient_location_id = ?
            AND delivery_type = 'online'
            AND status = 'approved'
    `).bind(
        Date.now(),
        messageId,
        session.location_id
    ).run();

    return json(request, env, {
        ok: true
    });
}

async function adminListMessages(request, env, url) {
    if (!(await adminAuthorized(request, env))) {
        return unauthorized(request, env);
    }

    const status = url.searchParams.get("status") || "active";
    const filterByStatus = MESSAGE_STATUSES.includes(status);

    let where = `
        WHERE m.status IN ('pending', 'pending_delivery')
    `;

    if (status === "all") {
        where = "";
    } else if (filterByStatus) {
        where = "WHERE m.status = ?";
    }

    let statement = env.DB.prepare(`
        SELECT
            m.id,
            m.text,
            m.reveal_sender,
            m.delivery_type,
            m.status,
            m.created_at,
            sender.address AS sender_address,
            recipient.address AS recipient_address
        FROM messages m
        JOIN locations sender
            ON sender.id = m.sender_location_id
        JOIN locations recipient
            ON recipient.id = m.recipient_location_id
        ${where}
        ORDER BY m.created_at DESC
        LIMIT 250
    `);

    if (filterByStatus) {
        statement = statement.bind(status);
    }

    const result = await statement.all();

    return json(request, env, {
        messages: (result.results || []).map((row) => ({
            id: row.id,
            text: row.text,
            revealSender: Boolean(row.reveal_sender),
            deliveryType: row.delivery_type,
            status: row.status,
            createdAt: row.created_at,
            senderAddress: row.sender_address,
            recipientAddress: row.recipient_address
        }))
    });
}

async function adminUpdateMessage(request, env, ctx, messageId) {
    if (!(await adminAuthorized(request, env))) {
        return unauthorized(request, env);
    }

    const body = await readJson(request);
    const action = body?.action;

    const message = await env.DB.prepare(`
        SELECT
            id,
            delivery_type,
            status,
            recipient_location_id
        FROM messages
        WHERE id = ?
        LIMIT 1
    `).bind(messageId).first();

    if (!message) {
        return json(request, env, {
            error: "Messaggio non trovato."
        }, 404);
    }

    let nextStatus = null;

    if (
        action === "approve" &&
        message.delivery_type === "online" &&
        message.status === "pending"
    ) {
        nextStatus = "approved";
    }

    if (
        action === "delivered" &&
        message.delivery_type === "physical" &&
        message.status === "pending_delivery"
    ) {
        nextStatus = "delivered";
    }

    if (
        action === "reject" &&
        ["pending", "pending_delivery"].includes(message.status)
    ) {
        nextStatus = "rejected";
    }

    if (!nextStatus) {
        return json(request, env, {
            error: "Transizione di stato non valida."
        }, 400);
    }

    await env.DB.prepare(`
        UPDATE messages
        SET
            status = ?,
            updated_at = ?
        WHERE id = ?
    `).bind(
        nextStatus,
        Date.now(),
        messageId
    ).run();

    if (nextStatus === "approved") {
        queuePushNotification(
            ctx,
            env,
            "location",
            message.recipient_location_id,
            {
                title: "nnMrcn — nuovo messaggio",
                body: "Hai ricevuto un nuovo messaggio.",
                url: "/progetto.html",
                tag: `nnmrcn-message-${messageId}`
            }
        );
    }

    return json(request, env, {
        ok: true,
        status: nextStatus
    });
}

async function pushConfiguration(request, env) {
    const identity = await requirePushIdentity(request, env);

    if (!identity) {
        return unauthorized(request, env);
    }

    return json(request, env, await getPushConfiguration(env, identity));
}

async function subscribeToPush(request, env) {
    const identity = await requirePushIdentity(request, env);

    if (!identity) {
        return unauthorized(request, env);
    }

    const body = await readJson(request);

    try {
        return json(
            request,
            env,
            await savePushSubscription(env, identity, body?.subscription),
            201
        );
    } catch (error) {
        if (error instanceof PushRequestError) {
            return json(request, env, { error: error.message }, error.status);
        }

        throw error;
    }
}

async function unsubscribeFromPush(request, env) {
    const identity = await requirePushIdentity(request, env);

    if (!identity) {
        return unauthorized(request, env);
    }

    const body = await readJson(request);

    try {
        return json(
            request,
            env,
            await removePushSubscription(env, identity, body?.endpoint)
        );
    } catch (error) {
        if (error instanceof PushRequestError) {
            return json(request, env, { error: error.message }, error.status);
        }

        throw error;
    }
}

async function requirePushIdentity(request, env) {
    if (request.headers.has("X-Admin-Token")) {
        if (!(await adminAuthorized(request, env))) {
            return null;
        }

        return { audience: "admin", locationId: null };
    }

    const session = await requireSession(request, env);

    if (!session) {
        return null;
    }

    return {
        audience: "location",
        locationId: Number(session.location_id)
    };
}

function queuePushNotification(ctx, env, audience, locationId, notification) {
    ctx.waitUntil(
        notifyPushSubscribers(env, audience, locationId, notification)
            .catch((error) => {
                console.error(JSON.stringify({
                    event: "push_notification_failed",
                    audience,
                    error: error instanceof Error
                        ? error.message
                        : String(error)
                }));
            })
    );
}

async function requireSession(request, env) {
    const token = bearerToken(request);

    if (!token) {
        return null;
    }

    const sessionHash = await sha256Hex(token);
    const now = Date.now();

    const session = await env.DB.prepare(`
        SELECT
            s.session_hash,
            s.location_id,
            s.expires_at,
            l.address
        FROM sessions s
        JOIN locations l
            ON l.id = s.location_id
        WHERE
            s.session_hash = ?
            AND s.expires_at > ?
        LIMIT 1
    `).bind(
        sessionHash,
        now
    ).first();

    return session || null;
}

function bearerToken(request) {
    const header = request.headers.get("Authorization") || "";

    if (!header.startsWith("Bearer ")) {
        return "";
    }

    return header.slice(7).trim();
}

function unauthorized(request, env) {
    return json(request, env, {
        error: "Non autorizzato."
    }, 401);
}

async function adminAuthorized(request, env) {
    const supplied = request.headers.get("X-Admin-Token") || "";
    const expected = env.ADMIN_TOKEN || "";

    if (!expected) {
        return false;
    }

    const encoder = new TextEncoder();
    const [suppliedHash, expectedHash] = await Promise.all([
        crypto.subtle.digest("SHA-256", encoder.encode(supplied)),
        crypto.subtle.digest("SHA-256", encoder.encode(expected))
    ]);

    return crypto.subtle.timingSafeEqual(suppliedHash, expectedHash);
}

function normalizePassword(value) {
    return String(value || "").trim().toUpperCase();
}

async function verifyPassword(password, saltB64, expectedHashB64) {
    const encoder = new TextEncoder();

    const key = await crypto.subtle.importKey(
        "raw",
        encoder.encode(password),
        "PBKDF2",
        false,
        ["deriveBits"]
    );

    const actualBits = await crypto.subtle.deriveBits(
        {
            name: "PBKDF2",
            salt: fromBase64(saltB64),
            iterations: PBKDF2_ITERATIONS,
            hash: "SHA-256"
        },
        key,
        256
    );

    const actual = new Uint8Array(actualBits);
    const expected = fromBase64(expectedHashB64);

    if (actual.length !== expected.length) {
        return false;
    }

    return crypto.subtle.timingSafeEqual(actual, expected);
}

async function hmacHex(secret, value) {
    const encoder = new TextEncoder();

    const key = await crypto.subtle.importKey(
        "raw",
        encoder.encode(secret),
        {
            name: "HMAC",
            hash: "SHA-256"
        },
        false,
        ["sign"]
    );

    const signature = await crypto.subtle.sign(
        "HMAC",
        key,
        encoder.encode(value)
    );

    return toHex(new Uint8Array(signature));
}

async function sha256Hex(value) {
    const digest = await crypto.subtle.digest(
        "SHA-256",
        new TextEncoder().encode(value)
    );

    return toHex(new Uint8Array(digest));
}

function randomToken(bytes) {
    const data = new Uint8Array(bytes);
    crypto.getRandomValues(data);

    return base64Url(data);
}

function fromBase64(value) {
    const binary = atob(value);
    const bytes = new Uint8Array(binary.length);

    for (let i = 0; i < binary.length; i += 1) {
        bytes[i] = binary.charCodeAt(i);
    }

    return bytes;
}

function base64Url(bytes) {
    let binary = "";

    bytes.forEach((byte) => {
        binary += String.fromCharCode(byte);
    });

    return btoa(binary)
        .replaceAll("+", "-")
        .replaceAll("/", "_")
        .replaceAll("=", "");
}

function toHex(bytes) {
    return Array.from(bytes)
        .map((byte) => byte.toString(16).padStart(2, "0"))
        .join("");
}

async function readJson(request) {
    try {
        return await request.json();
    } catch (_) {
        return null;
    }
}

function corsHeaders(request, env) {
    const origin = request.headers.get("Origin") || "";
    const allowedOrigin =
        env.ALLOWED_ORIGIN ||
        "https://anonmrcn-ctrl.github.io";

    const headers = {
        "Access-Control-Allow-Methods": "GET,POST,PATCH,OPTIONS",
        "Access-Control-Allow-Headers":
            "Authorization,Content-Type,X-Admin-Token",
        "Access-Control-Max-Age": "86400",
        "Vary": "Origin"
    };

    if (
        origin === allowedOrigin ||
        origin === "http://localhost:8000" ||
        origin === "http://127.0.0.1:8000"
    ) {
        headers["Access-Control-Allow-Origin"] = origin;
    }

    return headers;
}

function json(request, env, body, status = 200) {
    return new Response(
        JSON.stringify(body),
        {
            status,
            headers: {
                "Content-Type": "application/json; charset=utf-8",
                "Cache-Control": "no-store",
                ...corsHeaders(request, env)
            }
        }
    );
}
