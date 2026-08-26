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
const MAX_CONTACT_NAME_LENGTH = 80;
const MAX_CONTACT_EMAIL_LENGTH = 254;
const MAX_LOCATION_ADDRESS_LENGTH = 240;
const MAX_CONTACT_REQUEST_BYTES = 8192;
const MESSAGE_STATUSES = Object.freeze([
    "pending",
    "pending_delivery",
    "approved",
    "read",
    "delivered",
    "rejected"
]);
const CONTACT_STORAGE_STATEMENTS = Object.freeze([
    `CREATE TABLE IF NOT EXISTS contact_messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL DEFAULT '',
        email TEXT NOT NULL DEFAULT '',
        text TEXT NOT NULL CHECK (length(text) BETWEEN 1 AND 1500),
        status TEXT NOT NULL DEFAULT 'unread'
            CHECK (status IN ('unread', 'read')),
        sender_hash TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
    )`,
    `CREATE INDEX IF NOT EXISTS idx_contact_messages_sender_rate
        ON contact_messages(sender_hash, created_at)`,
    `CREATE INDEX IF NOT EXISTS idx_contact_messages_admin
        ON contact_messages(status, created_at)`
]);
const LOCATION_PROFILE_COLUMNS = Object.freeze([
    {
        name: "username",
        statement: "ALTER TABLE locations ADD COLUMN username TEXT NOT NULL DEFAULT ''"
    },
    {
        name: "is_visible",
        statement:
            "ALTER TABLE locations ADD COLUMN is_visible INTEGER NOT NULL DEFAULT 1 CHECK (is_visible IN (0, 1))"
    }
]);
const MESSAGE_ARCHIVE_COLUMNS = Object.freeze([
    {
        name: "sender_public_consent",
        statement:
            "ALTER TABLE messages ADD COLUMN sender_public_consent INTEGER NOT NULL DEFAULT 0 CHECK (sender_public_consent IN (0, 1))"
    },
    {
        name: "recipient_public_consent",
        statement:
            "ALTER TABLE messages ADD COLUMN recipient_public_consent INTEGER NOT NULL DEFAULT 0 CHECK (recipient_public_consent IN (0, 1))"
    },
    {
        name: "is_public",
        statement:
            "ALTER TABLE messages ADD COLUMN is_public INTEGER NOT NULL DEFAULT 0 CHECK (is_public IN (0, 1))"
    },
    {
        name: "published_at",
        statement: "ALTER TABLE messages ADD COLUMN published_at INTEGER"
    }
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

            if (request.method === "GET" && path === "/api/public/messages") {
                return await listPublicMessages(request, env, url);
            }

            if (request.method === "POST" && path === "/api/messages") {
                return await createMessage(request, env, ctx);
            }

            if (request.method === "POST" && path === "/api/contact") {
                return await createContactMessage(request, env, ctx);
            }

            if (request.method === "POST" && path === "/api/access-request") {
                return await createAccessRequest(request, env, ctx);
            }

            if (
                request.method === "PATCH" &&
                path === "/api/location/preferences"
            ) {
                return await updateLocationPreferences(request, env);
            }

            if (request.method === "PATCH" && /^\/api\/messages\/\d+$/.test(path)) {
                const id = Number(path.split("/").pop());
                return await markMessage(request, env, ctx, id);
            }

            if (request.method === "GET" && path === "/api/admin/messages") {
                return await adminListMessages(request, env, url);
            }

            if (request.method === "GET" && path === "/api/admin/summary") {
                return await adminSummary(request, env);
            }

            if (request.method === "GET" && path === "/api/admin/export") {
                return await adminExportMessages(request, env, url);
            }

            if (request.method === "GET" && path === "/api/admin/contact-messages") {
                return await adminListContactMessages(request, env);
            }

            if (
                request.method === "PATCH" &&
                /^\/api\/admin\/contact-messages\/\d+$/.test(path)
            ) {
                const id = Number(path.split("/").pop());
                return await adminUpdateContactMessage(request, env, id);
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

    await ensureLocationProfileStorage(env);

    const lookup = await hmacHex(env.PASSWORD_PEPPER, password);

    const location = await env.DB.prepare(`
        SELECT
            id,
            address,
            username,
            is_visible,
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
            address: location.address,
            username: location.username,
            visible: Number(location.is_visible) === 1
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
            address: session.address,
            username: session.username,
            visible: Number(session.is_visible) === 1
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

async function updateLocationPreferences(request, env) {
    const session = await requireSession(request, env);

    if (!session) {
        return unauthorized(request, env);
    }

    const body = await readJson(request);

    if (typeof body?.visible !== "boolean") {
        return json(request, env, {
            error: "Preferenza di visibilità non valida."
        }, 400);
    }

    await env.DB.prepare(`
        UPDATE locations
        SET is_visible = ?
        WHERE id = ?
    `).bind(
        body.visible ? 1 : 0,
        session.location_id
    ).run();

    return json(request, env, {
        ok: true,
        location: {
            id: session.location_id,
            address: session.address,
            username: session.username,
            visible: body.visible
        }
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
            l.username,
            l.lat,
            l.lon,
            l.is_visible,
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
        locations: (result.results || []).map((row) => {
            const isOwn = Number(row.id) === Number(session.location_id);
            const visible = Number(row.is_visible) === 1;
            const discloseLocation = isOwn || visible;

            return {
                id: row.id,
                address: discloseLocation
                    ? row.address
                    : row.username || "Location riservata",
                username: row.username,
                lat: discloseLocation ? row.lat : null,
                lon: discloseLocation ? row.lon : null,
                visible,
                hasPoem: Boolean(row.has_poem)
            };
        })
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

    await ensureMessageArchiveStorage(env);

    const result = await env.DB.prepare(`
        SELECT
            m.id,
            m.text,
            m.reveal_sender,
            m.created_at,
            m.status,
            m.sender_public_consent,
            m.recipient_public_consent,
            m.is_public,
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
            status: row.status,
            senderPublicConsent: Boolean(row.sender_public_consent),
            recipientPublicConsent: Boolean(row.recipient_public_consent),
            isPublic: Boolean(row.is_public)
        }))
    });
}

async function listPublicMessages(request, env, url) {
    await ensureMessageArchiveStorage(env);

    const requestedLimit = Number(url.searchParams.get("limit") || 50);
    const limit = Number.isInteger(requestedLimit)
        ? Math.min(Math.max(requestedLimit, 1), 100)
        : 50;
    const cursor = parsePublicArchiveCursor(url.searchParams.get("before"));
    let cursorCondition = "";
    const bindings = [];

    if (cursor) {
        cursorCondition = `
            AND (
                published_at < ? OR
                (published_at = ? AND id < ?)
            )
        `;
        bindings.push(cursor.publishedAt, cursor.publishedAt, cursor.id);
    }

    bindings.push(limit + 1);

    const result = await env.DB.prepare(`
        SELECT
            id,
            text,
            created_at,
            published_at
        FROM messages
        WHERE
            delivery_type = 'online'
            AND status IN ('approved', 'read')
            AND sender_public_consent = 1
            AND recipient_public_consent = 1
            AND is_public = 1
            AND published_at IS NOT NULL
            ${cursorCondition}
        ORDER BY published_at DESC, id DESC
        LIMIT ?
    `).bind(...bindings).all();

    const rows = result.results || [];
    const hasMore = rows.length > limit;
    const visibleRows = hasMore ? rows.slice(0, limit) : rows;
    const last = visibleRows.at(-1);

    return json(request, env, {
        messages: visibleRows.map((row) => ({
            id: row.id,
            text: row.text,
            createdAt: row.created_at,
            publishedAt: row.published_at
        })),
        nextCursor: hasMore && last
            ? `${last.published_at}:${last.id}`
            : null
    });
}

function parsePublicArchiveCursor(value) {
    const [publishedAtText, idText] = String(value || "").split(":");
    const publishedAt = Number(publishedAtText);
    const id = Number(idText);

    if (
        !Number.isInteger(publishedAt) ||
        publishedAt <= 0 ||
        !Number.isInteger(id) ||
        id <= 0
    ) {
        return null;
    }

    return { publishedAt, id };
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
    const publicConsent =
        deliveryType === "online" && body?.publicConsent === true;

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

    await ensureMessageArchiveStorage(env);

    const result = await env.DB.prepare(`
        INSERT INTO messages (
            sender_location_id,
            recipient_location_id,
            text,
            reveal_sender,
            delivery_type,
            status,
            sender_public_consent,
            created_at,
            updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
        session.location_id,
        recipientId,
        text,
        revealSender ? 1 : 0,
        deliveryType,
        status,
        publicConsent ? 1 : 0,
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

async function markMessage(request, env, ctx, messageId) {
    const session = await requireSession(request, env);

    if (!session) {
        return unauthorized(request, env);
    }

    const body = await readJson(request);
    const action = body?.action;

    if (!["read", "allow_public", "revoke_public"].includes(action)) {
        return json(request, env, {
            error: "Azione non valida."
        }, 400);
    }

    await ensureMessageArchiveStorage(env);

    const message = await env.DB.prepare(`
        SELECT
            id,
            delivery_type,
            status,
            sender_public_consent,
            recipient_public_consent,
            is_public
        FROM messages
        WHERE
            id = ?
            AND recipient_location_id = ?
        LIMIT 1
    `).bind(
        messageId,
        session.location_id
    ).first();

    if (!message || message.delivery_type !== "online") {
        return json(request, env, {
            error: "Messaggio non trovato."
        }, 404);
    }

    if (action === "read") {
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

        return json(request, env, { ok: true });
    }

    if (!["approved", "read"].includes(message.status)) {
        return json(request, env, {
            error: "Il messaggio non è ancora disponibile."
        }, 409);
    }

    if (action === "allow_public") {
        if (!Boolean(message.sender_public_consent)) {
            return json(request, env, {
                error: "Il mittente non ha autorizzato la pubblicazione."
            }, 409);
        }

        await env.DB.prepare(`
            UPDATE messages
            SET
                recipient_public_consent = 1,
                updated_at = ?
            WHERE id = ?
        `).bind(
            Date.now(),
            messageId
        ).run();

        queuePushNotification(
            ctx,
            env,
            "admin",
            null,
            {
                title: "nnMrcn — archivio",
                body: "Un messaggio ha ricevuto entrambi i consensi ed è pronto per la pubblicazione.",
                url: "/admin.html",
                tag: `nnmrcn-public-${messageId}`
            }
        );

        return json(request, env, {
            ok: true,
            recipientPublicConsent: true,
            isPublic: Boolean(message.is_public)
        });
    }

    await env.DB.prepare(`
        UPDATE messages
        SET
            recipient_public_consent = 0,
            is_public = 0,
            published_at = NULL,
            updated_at = ?
        WHERE id = ?
    `).bind(
        Date.now(),
        messageId
    ).run();

    return json(request, env, {
        ok: true,
        recipientPublicConsent: false,
        isPublic: false
    });
}

async function createContactMessage(request, env, ctx) {
    const contentLength = Number(request.headers.get("Content-Length") || 0);

    if (contentLength > MAX_CONTACT_REQUEST_BYTES) {
        return json(request, env, {
            error: "Il messaggio inviato è troppo lungo."
        }, 413);
    }

    const body = await readJson(request);

    if (!body || typeof body !== "object" || Array.isArray(body)) {
        return json(request, env, {
            error: "Messaggio non valido."
        }, 400);
    }

    if (String(body.website || "").trim()) {
        return json(request, env, { ok: true }, 201);
    }

    const name = String(body.name || "").trim();
    const email = String(body.email || "").trim();
    const text = String(body.text || "").trim();

    if (name.length > MAX_CONTACT_NAME_LENGTH) {
        return json(request, env, {
            error: "Il nome inserito è troppo lungo."
        }, 400);
    }

    if (!validEmail(email, false)) {
        return json(request, env, {
            error: "L’indirizzo email non è valido."
        }, 400);
    }

    if (!text || text.length > MAX_MESSAGE_LENGTH) {
        return json(request, env, {
            error: `Il messaggio deve contenere da 1 a ${MAX_MESSAGE_LENGTH} caratteri.`
        }, 400);
    }

    return saveContactMessage(request, env, ctx, {
        name,
        email,
        text,
        notificationTitle: "nnMrcn — nuovo contatto",
        notificationBody: "Hai ricevuto un nuovo messaggio diretto."
    });
}

async function createAccessRequest(request, env, ctx) {
    const contentLength = Number(request.headers.get("Content-Length") || 0);

    if (contentLength > MAX_CONTACT_REQUEST_BYTES) {
        return json(request, env, {
            error: "La richiesta inviata è troppo lunga."
        }, 413);
    }

    const body = await readJson(request);

    if (!body || typeof body !== "object" || Array.isArray(body)) {
        return json(request, env, {
            error: "Richiesta non valida."
        }, 400);
    }

    if (String(body.website || "").trim()) {
        return json(request, env, { ok: true }, 201);
    }

    const username = String(body.username || "").trim();
    const address = String(body.address || "").trim();
    const email = String(body.email || "").trim();
    const latValue = body.lat;
    const lonValue = body.lon;
    const hasLat = latValue !== null && latValue !== undefined && String(latValue).trim() !== "";
    const hasLon = lonValue !== null && lonValue !== undefined && String(lonValue).trim() !== "";
    const lat = hasLat ? Number(latValue) : null;
    const lon = hasLon ? Number(lonValue) : null;
    const hasPoint =
        hasLat &&
        hasLon &&
        Number.isFinite(lat) &&
        Number.isFinite(lon) &&
        lat >= -90 &&
        lat <= 90 &&
        lon >= -180 &&
        lon <= 180;

    if (username.length > MAX_CONTACT_NAME_LENGTH) {
        return json(request, env, {
            error: "Lo username inserito è troppo lungo."
        }, 400);
    }

    if (address.length > MAX_LOCATION_ADDRESS_LENGTH) {
        return json(request, env, {
            error: "L’indirizzo inserito è troppo lungo."
        }, 400);
    }

    if (!validEmail(email, true)) {
        return json(request, env, {
            error: "Inserisci un indirizzo email valido per ricevere il codice."
        }, 400);
    }

    if (hasLat !== hasLon || ((hasLat || hasLon) && !hasPoint)) {
        return json(request, env, {
            error: "Il punto selezionato sulla mappa non è valido."
        }, 400);
    }

    if (!username && !address && !hasPoint) {
        return json(request, env, {
            error: "Inserisci almeno lo username oppure la tua location."
        }, 400);
    }

    const lines = [
        "Richiesta di codice.",
        `Username: ${username || "non indicato"}`,
        `Indirizzo: ${address || "non indicato"}`
    ];

    if (hasPoint) {
        const coordinates = `${lat.toFixed(6)}, ${lon.toFixed(6)}`;
        lines.push(`Coordinate: ${coordinates}`);
        lines.push(`Mappa: https://www.google.com/maps?q=${lat.toFixed(6)},${lon.toFixed(6)}`);
    } else {
        lines.push("Coordinate: non indicate");
    }

    lines.push("Visibilità iniziale: mostra sulla mappa dopo la registrazione");

    return saveContactMessage(request, env, ctx, {
        name: username,
        email,
        text: lines.join("\n"),
        notificationTitle: "nnMrcn — richiesta di codice",
        notificationBody: "Hai ricevuto una nuova richiesta di accesso."
    });
}

function validEmail(email, required) {
    if (!email) {
        return !required;
    }

    return (
        email.length <= MAX_CONTACT_EMAIL_LENGTH &&
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(email)
    );
}

async function saveContactMessage(
    request,
    env,
    ctx,
    { name, email, text, notificationTitle, notificationBody }
) {
    if (!env.PASSWORD_PEPPER) {
        throw new Error("PASSWORD_PEPPER secret missing.");
    }

    await ensureContactStorage(env);

    const sender = request.headers.get("CF-Connecting-IP") || "unknown";
    const senderHash = await hmacHex(
        env.PASSWORD_PEPPER,
        `contact:${sender}`
    );
    const now = Date.now();

    const previous = await env.DB.prepare(`
        SELECT COUNT(*) AS count
        FROM contact_messages
        WHERE
            sender_hash = ?
            AND created_at >= ?
    `).bind(
        senderHash,
        now - 60 * 60 * 1000
    ).first();

    if (Number(previous?.count || 0) >= MESSAGE_LIMIT_PER_HOUR) {
        return json(request, env, {
            error: "Hai inviato troppi messaggi. Riprova più tardi."
        }, 429);
    }

    const result = await env.DB.prepare(`
        INSERT INTO contact_messages (
            name,
            email,
            text,
            status,
            sender_hash,
            created_at,
            updated_at
        )
        VALUES (?, ?, ?, 'unread', ?, ?, ?)
    `).bind(
        name,
        email,
        text,
        senderHash,
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
            title: notificationTitle,
            body: notificationBody,
            url: "/admin.html",
            tag: `nnmrcn-contact-${messageId || now}`
        }
    );

    return json(request, env, {
        ok: true,
        id: messageId
    }, 201);
}

async function adminListContactMessages(request, env) {
    if (!(await adminAuthorized(request, env))) {
        return unauthorized(request, env);
    }

    await ensureContactStorage(env);

    const result = await env.DB.prepare(`
        SELECT
            id,
            name,
            email,
            text,
            status,
            created_at
        FROM contact_messages
        ORDER BY
            CASE WHEN status = 'unread' THEN 0 ELSE 1 END,
            created_at DESC
        LIMIT 250
    `).all();

    return json(request, env, {
        messages: (result.results || []).map((row) => ({
            id: row.id,
            name: row.name,
            email: row.email,
            text: row.text,
            status: row.status,
            createdAt: row.created_at
        }))
    });
}

async function adminUpdateContactMessage(request, env, messageId) {
    if (!(await adminAuthorized(request, env))) {
        return unauthorized(request, env);
    }

    const body = await readJson(request);

    if (body?.action !== "read") {
        return json(request, env, {
            error: "Azione non valida."
        }, 400);
    }

    await ensureContactStorage(env);

    const message = await env.DB.prepare(`
        SELECT id
        FROM contact_messages
        WHERE id = ?
        LIMIT 1
    `).bind(messageId).first();

    if (!message) {
        return json(request, env, {
            error: "Messaggio non trovato."
        }, 404);
    }

    await env.DB.prepare(`
        UPDATE contact_messages
        SET
            status = 'read',
            updated_at = ?
        WHERE id = ?
    `).bind(
        Date.now(),
        messageId
    ).run();

    return json(request, env, {
        ok: true,
        status: "read"
    });
}

async function ensureContactStorage(env) {
    await env.DB.batch(
        CONTACT_STORAGE_STATEMENTS.map((statement) =>
            env.DB.prepare(statement)
        )
    );
}

async function ensureLocationProfileStorage(env) {
    const result = await env.DB.prepare("PRAGMA table_info(locations)").all();
    const columns = new Set(
        (result.results || []).map((column) => String(column.name))
    );

    for (const column of LOCATION_PROFILE_COLUMNS) {
        if (columns.has(column.name)) {
            continue;
        }

        try {
            await env.DB.prepare(column.statement).run();
        } catch (error) {
            if (!/duplicate column name/iu.test(String(error?.message || error))) {
                throw error;
            }
        }
    }
}

async function ensureMessageArchiveStorage(env) {
    const result = await env.DB.prepare("PRAGMA table_info(messages)").all();
    const columns = new Set(
        (result.results || []).map((column) => String(column.name))
    );

    for (const column of MESSAGE_ARCHIVE_COLUMNS) {
        if (columns.has(column.name)) {
            continue;
        }

        try {
            await env.DB.prepare(column.statement).run();
        } catch (error) {
            if (!/duplicate column name/iu.test(String(error?.message || error))) {
                throw error;
            }
        }
    }

    await env.DB.prepare(`
        CREATE INDEX IF NOT EXISTS idx_messages_public_archive
        ON messages(is_public, published_at, id)
    `).run();
}

async function adminSummary(request, env) {
    if (!(await adminAuthorized(request, env))) {
        return unauthorized(request, env);
    }

    await ensureContactStorage(env);
    await ensureMessageArchiveStorage(env);

    const summary = await env.DB.prepare(`
        SELECT
            COALESCE(SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END), 0)
                AS pending_online,
            COALESCE(SUM(CASE WHEN status = 'pending_delivery' THEN 1 ELSE 0 END), 0)
                AS pending_delivery,
            COALESCE(SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END), 0)
                AS approved,
            COALESCE(SUM(CASE WHEN status = 'read' THEN 1 ELSE 0 END), 0)
                AS read_count,
            COALESCE(SUM(CASE WHEN status = 'delivered' THEN 1 ELSE 0 END), 0)
                AS delivered,
            COALESCE(SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END), 0)
                AS rejected,
            COALESCE(SUM(
                CASE
                    WHEN
                        delivery_type = 'online' AND
                        status IN ('approved', 'read') AND
                        sender_public_consent = 1 AND
                        recipient_public_consent = 1 AND
                        is_public = 0
                    THEN 1
                    ELSE 0
                END
            ), 0) AS publishable,
            COALESCE(SUM(CASE WHEN is_public = 1 THEN 1 ELSE 0 END), 0)
                AS public_count,
            (SELECT COUNT(*) FROM contact_messages WHERE status = 'unread')
                AS unread_contacts
        FROM messages
    `).first();

    return json(request, env, {
        pendingOnline: Number(summary?.pending_online || 0),
        pendingDelivery: Number(summary?.pending_delivery || 0),
        approved: Number(summary?.approved || 0),
        read: Number(summary?.read_count || 0),
        delivered: Number(summary?.delivered || 0),
        rejected: Number(summary?.rejected || 0),
        publishable: Number(summary?.publishable || 0),
        public: Number(summary?.public_count || 0),
        unreadContacts: Number(summary?.unread_contacts || 0)
    });
}

async function adminExportMessages(request, env, url) {
    if (!(await adminAuthorized(request, env))) {
        return unauthorized(request, env);
    }

    await ensureMessageArchiveStorage(env);

    const format = url.searchParams.get("format") === "json" ? "json" : "csv";
    const result = await env.DB.prepare(`
        SELECT
            m.id,
            m.text,
            m.reveal_sender,
            m.delivery_type,
            m.status,
            m.sender_public_consent,
            m.recipient_public_consent,
            m.is_public,
            m.published_at,
            m.created_at,
            m.updated_at,
            sender.address AS sender_address,
            recipient.address AS recipient_address
        FROM messages m
        JOIN locations sender
            ON sender.id = m.sender_location_id
        JOIN locations recipient
            ON recipient.id = m.recipient_location_id
        ORDER BY m.created_at DESC
        LIMIT 5001
    `).all();

    const allRows = result.results || [];
    const truncated = allRows.length > 5000;
    const rows = truncated ? allRows.slice(0, 5000) : allRows;
    const date = new Date().toISOString().slice(0, 10);

    if (format === "json") {
        const data = rows.map(exportMessageRow);

        return downloadResponse(
            request,
            env,
            JSON.stringify({ exportedAt: Date.now(), truncated, messages: data }, null, 2),
            "application/json; charset=utf-8",
            `nnmrcn-messaggi-${date}.json`,
            truncated
        );
    }

    const headers = [
        "id",
        "createdAt",
        "updatedAt",
        "senderAddress",
        "recipientAddress",
        "text",
        "revealSender",
        "deliveryType",
        "status",
        "senderPublicConsent",
        "recipientPublicConsent",
        "isPublic",
        "publishedAt"
    ];
    const lines = [
        headers.join(","),
        ...rows.map((row) => {
            const message = exportMessageRow(row);
            return headers.map((key) => csvCell(message[key])).join(",");
        })
    ];

    return downloadResponse(
        request,
        env,
        lines.join("\r\n"),
        "text/csv; charset=utf-8",
        `nnmrcn-messaggi-${date}.csv`,
        truncated
    );
}

function exportMessageRow(row) {
    return {
        id: row.id,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        senderAddress: row.sender_address,
        recipientAddress: row.recipient_address,
        text: row.text,
        revealSender: Boolean(row.reveal_sender),
        deliveryType: row.delivery_type,
        status: row.status,
        senderPublicConsent: Boolean(row.sender_public_consent),
        recipientPublicConsent: Boolean(row.recipient_public_consent),
        isPublic: Boolean(row.is_public),
        publishedAt: row.published_at
    };
}

function csvCell(value) {
    let text = value === null || value === undefined ? "" : String(value);

    if (/^[=+\-@]/u.test(text)) {
        text = `'${text}`;
    }

    return `"${text.replaceAll('"', '""')}"`;
}

async function adminListMessages(request, env, url) {
    if (!(await adminAuthorized(request, env))) {
        return unauthorized(request, env);
    }

    await ensureMessageArchiveStorage(env);

    const status = url.searchParams.get("status") || "active";
    const filterByStatus = MESSAGE_STATUSES.includes(status);

    let where = `
        WHERE m.status IN ('pending', 'pending_delivery')
    `;

    if (status === "all") {
        where = "";
    } else if (status === "publishable") {
        where = `
            WHERE
                m.delivery_type = 'online' AND
                m.status IN ('approved', 'read') AND
                m.sender_public_consent = 1 AND
                m.recipient_public_consent = 1 AND
                m.is_public = 0
        `;
    } else if (status === "public") {
        where = "WHERE m.is_public = 1";
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
            m.sender_public_consent,
            m.recipient_public_consent,
            m.is_public,
            m.published_at,
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
            senderPublicConsent: Boolean(row.sender_public_consent),
            recipientPublicConsent: Boolean(row.recipient_public_consent),
            isPublic: Boolean(row.is_public),
            publishedAt: row.published_at,
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

    await ensureMessageArchiveStorage(env);

    const message = await env.DB.prepare(`
        SELECT
            id,
            delivery_type,
            status,
            sender_public_consent,
            recipient_public_consent,
            is_public,
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

    if (action === "publish") {
        if (
            message.delivery_type !== "online" ||
            !["approved", "read"].includes(message.status) ||
            !Boolean(message.sender_public_consent) ||
            !Boolean(message.recipient_public_consent)
        ) {
            return json(request, env, {
                error: "Il messaggio non dispone di tutti i consensi necessari."
            }, 409);
        }

        const publishedAt = Date.now();

        await env.DB.prepare(`
            UPDATE messages
            SET
                is_public = 1,
                published_at = ?,
                updated_at = ?
            WHERE id = ?
        `).bind(
            publishedAt,
            publishedAt,
            messageId
        ).run();

        return json(request, env, {
            ok: true,
            status: message.status,
            isPublic: true,
            publishedAt
        });
    }

    if (action === "unpublish" && Boolean(message.is_public)) {
        await env.DB.prepare(`
            UPDATE messages
            SET
                is_public = 0,
                published_at = NULL,
                updated_at = ?
            WHERE id = ?
        `).bind(
            Date.now(),
            messageId
        ).run();

        return json(request, env, {
            ok: true,
            status: message.status,
            isPublic: false,
            publishedAt: null
        });
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

    await ensureLocationProfileStorage(env);

    const sessionHash = await sha256Hex(token);
    const now = Date.now();

    const session = await env.DB.prepare(`
        SELECT
            s.session_hash,
            s.location_id,
            s.expires_at,
            l.address,
            l.username,
            l.is_visible
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

function downloadResponse(
    request,
    env,
    body,
    contentType,
    fileName,
    truncated = false
) {
    return new Response(body, {
        headers: {
            "Content-Type": contentType,
            "Content-Disposition": `attachment; filename="${fileName}"`,
            "Cache-Control": "no-store",
            "X-Export-Truncated": truncated ? "1" : "0",
            ...corsHeaders(request, env)
        }
    });
}
