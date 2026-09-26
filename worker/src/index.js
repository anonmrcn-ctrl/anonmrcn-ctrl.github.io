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
const MAYOR_SESSION_TTL_MS = 4 * 60 * 60 * 1000;
const MAYOR_PASSWORD_SHA256 =
    "a67e12f44ada7f5ad5c4e30a53c6df570721e83e2ff6ea42ce38eaf678891faa";
const MAYOR_ACCESS_TOKEN_SHA256 =
    "5f9c3578b2ddecae87e38f8f25738f0c60624a99bc95280571cc211366cdacb3";
const MESSAGE_LIMIT_PER_HOUR = 5;
const MAX_MESSAGE_LENGTH = 1500;
const MAX_CONTACT_NAME_LENGTH = 80;
const MAX_CONTACT_EMAIL_LENGTH = 254;
const MAX_LOCATION_ADDRESS_LENGTH = 240;
const MAX_CONTACT_REQUEST_BYTES = 8192;
const MAX_JSON_REQUEST_BYTES = 16384;
const MEMORY_LIMIT_PER_DAY = 3;
const MAX_MEMORY_TITLE_LENGTH = 100;
const MAX_MEMORY_AUTHOR_LENGTH = 80;
const MAX_MEMORY_TEXT_LENGTH = 3000;
const MAX_MEMORY_MEDIA_BYTES = 900000;
const MAX_MEMORY_REQUEST_BYTES = 1400000;
const MAX_WIKI_TITLE_LENGTH = 160;
const MAX_WIKI_SLUG_LENGTH = 160;
const MAX_WIKI_SUMMARY_LENGTH = 500;
const MAX_WIKI_BODY_LENGTH = 50000;
const MAX_WIKI_IMAGES = 8;
const MAX_WIKI_IMAGE_BYTES = 700000;
const MAX_WIKI_IMAGE_ALT_LENGTH = 300;
const MAX_WIKI_IMAGE_CAPTION_LENGTH = 500;
const MAX_WIKI_SOURCES = 200;
const MAX_WIKI_SOURCE_URL_LENGTH = 2048;
const MAX_WIKI_SOURCE_TITLE_LENGTH = 500;
const MAX_WIKI_SOURCE_AUTHOR_LENGTH = 300;
const MAX_WIKI_SOURCE_DATE_LENGTH = 100;
const MAX_WIKI_REQUEST_BYTES = 8000000;

class RequestBodyTooLargeError extends Error {}

const MEMORY_STATUSES = Object.freeze([
    "pending",
    "approved",
    "rejected"
]);
const MEMORY_MEDIA_TYPES = new Set([
    "image/jpeg",
    "image/png",
    "image/webp",
    "audio/mpeg",
    "audio/ogg",
    "audio/webm",
    "audio/mp4"
]);
const WIKI_STATUSES = new Set(["draft", "published"]);
const WIKI_IMAGE_TYPES = new Set([
    "image/jpeg",
    "image/png",
    "image/webp"
]);
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
const MEMORY_STORAGE_STATEMENTS = Object.freeze([
    `CREATE TABLE IF NOT EXISTS memories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL CHECK (length(title) BETWEEN 3 AND 100),
        author_name TEXT NOT NULL DEFAULT '' CHECK (length(author_name) <= 80),
        text TEXT NOT NULL CHECK (length(text) BETWEEN 1 AND 3000),
        lat REAL NOT NULL CHECK (lat BETWEEN -90 AND 90),
        lon REAL NOT NULL CHECK (lon BETWEEN -180 AND 180),
        media_type TEXT NOT NULL DEFAULT '',
        media_name TEXT NOT NULL DEFAULT '',
        media_data TEXT,
        status TEXT NOT NULL DEFAULT 'pending'
            CHECK (status IN ('pending', 'approved', 'rejected')),
        consent INTEGER NOT NULL CHECK (consent = 1),
        withdrawal_hash TEXT NOT NULL UNIQUE,
        sender_hash TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        published_at INTEGER
    )`,
    `CREATE INDEX IF NOT EXISTS idx_memories_public
        ON memories(status, published_at, id)`,
    `CREATE INDEX IF NOT EXISTS idx_memories_sender_rate
        ON memories(sender_hash, created_at)`
]);
const WIKI_STORAGE_STATEMENTS = Object.freeze([
    `CREATE TABLE IF NOT EXISTS wiki_entries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        slug TEXT NOT NULL UNIQUE
            CHECK (length(slug) BETWEEN 1 AND 160),
        title TEXT NOT NULL
            CHECK (length(title) BETWEEN 2 AND 160),
        summary TEXT NOT NULL DEFAULT ''
            CHECK (length(summary) <= 500),
        body TEXT NOT NULL DEFAULT ''
            CHECK (length(body) <= 50000),
        status TEXT NOT NULL DEFAULT 'draft'
            CHECK (status IN ('draft', 'published')),
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        published_at INTEGER
    )`,
    `CREATE INDEX IF NOT EXISTS idx_wiki_entries_public
        ON wiki_entries(status, title, id)`,
    `CREATE TABLE IF NOT EXISTS wiki_entry_revisions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        entry_id INTEGER NOT NULL,
        revision_number INTEGER NOT NULL,
        slug TEXT NOT NULL,
        title TEXT NOT NULL,
        summary TEXT NOT NULL DEFAULT '',
        body TEXT NOT NULL DEFAULT '',
        status TEXT NOT NULL
            CHECK (status IN ('draft', 'published')),
        created_at INTEGER NOT NULL,
        UNIQUE (entry_id, revision_number),
        FOREIGN KEY (entry_id)
            REFERENCES wiki_entries(id)
            ON DELETE CASCADE
    )`,
    `CREATE INDEX IF NOT EXISTS idx_wiki_revisions_entry
        ON wiki_entry_revisions(entry_id, revision_number DESC)`,
    `CREATE TABLE IF NOT EXISTS wiki_entry_images (
        id TEXT PRIMARY KEY,
        entry_id INTEGER NOT NULL,
        media_type TEXT NOT NULL
            CHECK (media_type IN ('image/jpeg', 'image/png', 'image/webp')),
        media_name TEXT NOT NULL DEFAULT '',
        media_data TEXT NOT NULL,
        alt_text TEXT NOT NULL
            CHECK (length(alt_text) BETWEEN 1 AND 300),
        caption TEXT NOT NULL DEFAULT ''
            CHECK (length(caption) <= 500),
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        FOREIGN KEY (entry_id)
            REFERENCES wiki_entries(id)
            ON DELETE CASCADE
    )`,
    `CREATE INDEX IF NOT EXISTS idx_wiki_images_entry
        ON wiki_entry_images(entry_id, created_at, id)`
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
const MAYOR_STORAGE_STATEMENTS = Object.freeze([
    `CREATE TABLE IF NOT EXISTS mayor_sessions (
        session_hash TEXT PRIMARY KEY,
        created_at INTEGER NOT NULL,
        expires_at INTEGER NOT NULL
    )`,
    `CREATE INDEX IF NOT EXISTS idx_mayor_sessions_expiry
        ON mayor_sessions(expires_at)`,
    `CREATE TABLE IF NOT EXISTS mayor_message (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        title TEXT NOT NULL DEFAULT 'Messaggio per il sindaco',
        body TEXT NOT NULL DEFAULT '',
        updated_at INTEGER NOT NULL
    )`
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

            if (request.method === "POST" && path === "/api/mayor/access") {
                return await checkMayorAccess(request, env);
            }

            if (request.method === "POST" && path === "/api/mayor/login") {
                return await mayorLogin(request, env);
            }

            if (request.method === "GET" && path === "/api/mayor/message") {
                return await getMayorMessage(request, env);
            }

            if (request.method === "POST" && path === "/api/mayor/logout") {
                return await mayorLogout(request, env);
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

            if (request.method === "GET" && path === "/api/public/memories") {
                return await listPublicMemories(request, env);
            }

            if (request.method === "GET" && path === "/api/public/wiki") {
                return await listPublicWikiEntries(request, env);
            }

            if (
                request.method === "GET" &&
                /^\/api\/public\/wiki\/[a-z0-9]+(?:-[a-z0-9]+)*$/.test(path)
            ) {
                const slug = path.split("/").pop();
                return await getPublicWikiEntry(request, env, slug);
            }

            if (
                request.method === "GET" &&
                /^\/api\/public\/wiki-images\/[0-9a-f-]{36}$/.test(path)
            ) {
                const imageId = path.split("/").pop();
                return await getWikiImage(request, env, imageId, false);
            }

            if (request.method === "POST" && path === "/api/memories") {
                return await createMemory(request, env, ctx);
            }

            if (
                request.method === "GET" &&
                /^\/api\/memories\/\d+\/media$/.test(path)
            ) {
                const id = Number(path.split("/")[3]);
                return await getMemoryMedia(request, env, id);
            }

            if (
                request.method === "GET" &&
                /^\/api\/memories\/\d+\/status$/.test(path)
            ) {
                const id = Number(path.split("/")[3]);
                return await getMemoryStatus(request, env, id);
            }

            if (
                request.method === "DELETE" &&
                /^\/api\/memories\/\d+$/.test(path)
            ) {
                const id = Number(path.split("/").pop());
                return await withdrawMemory(request, env, id);
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

            if (request.method === "GET" && path === "/api/admin/memories") {
                return await adminListMemories(request, env, url);
            }

            if (request.method === "GET" && path === "/api/admin/wiki") {
                return await adminListWikiEntries(request, env);
            }

            if (request.method === "POST" && path === "/api/admin/wiki") {
                return await adminCreateWikiEntry(request, env);
            }

            if (
                request.method === "PATCH" &&
                /^\/api\/admin\/wiki\/\d+$/.test(path)
            ) {
                const id = Number(path.split("/").pop());
                return await adminUpdateWikiEntry(request, env, id);
            }

            if (
                request.method === "GET" &&
                /^\/api\/admin\/wiki-images\/[0-9a-f-]{36}$/.test(path)
            ) {
                const imageId = path.split("/").pop();
                return await getWikiImage(request, env, imageId, true);
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

            if (
                request.method === "PATCH" &&
                /^\/api\/admin\/memories\/\d+$/.test(path)
            ) {
                const id = Number(path.split("/").pop());
                return await adminUpdateMemory(request, env, id);
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
            if (error instanceof RequestBodyTooLargeError) {
                return json(request, env, {
                    error: "Richiesta troppo grande."
                }, 413);
            }

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

async function checkMayorAccess(request, env) {
    const body = await readJson(request);
    const accessToken = String(body?.accessToken || "").trim();

    if (!(await matchesSha256(accessToken, MAYOR_ACCESS_TOKEN_SHA256))) {
        return json(request, env, {
            error: "Collegamento di accesso non valido."
        }, 401);
    }

    return json(request, env, {
        ok: true
    });
}

async function mayorLogin(request, env) {
    const body = await readJson(request);
    const accessToken = String(body?.accessToken || "").trim();
    const password = normalizePassword(body?.password);

    const [validAccessToken, validPassword] = await Promise.all([
        matchesSha256(accessToken, MAYOR_ACCESS_TOKEN_SHA256),
        matchesSha256(password, MAYOR_PASSWORD_SHA256)
    ]);

    if (!validAccessToken || !validPassword) {
        return json(request, env, {
            error: "Credenziali non riconosciute."
        }, 401);
    }

    await ensureMayorStorage(env);

    const now = Date.now();
    const expiresAt = now + MAYOR_SESSION_TTL_MS;
    const token = randomToken(32);
    const sessionHash = await sha256Hex(token);

    await env.DB.prepare(`
        DELETE FROM mayor_sessions
        WHERE expires_at <= ?
    `).bind(now).run();

    await env.DB.prepare(`
        INSERT INTO mayor_sessions (
            session_hash,
            created_at,
            expires_at
        )
        VALUES (?, ?, ?)
    `).bind(
        sessionHash,
        now,
        expiresAt
    ).run();

    return json(request, env, {
        token,
        expiresAt
    });
}

async function getMayorMessage(request, env) {
    const session = await requireMayorSession(request, env);

    if (!session) {
        return unauthorized(request, env);
    }

    const message = await env.DB.prepare(`
        SELECT title, body, updated_at
        FROM mayor_message
        WHERE id = 1
    `).first();

    return json(request, env, {
        title: message?.title || "Messaggio per il sindaco",
        body: message?.body || "",
        updatedAt: message?.updated_at || null,
        expiresAt: session.expires_at
    });
}

async function mayorLogout(request, env) {
    const token = bearerToken(request);

    if (token) {
        await ensureMayorStorage(env);
        const sessionHash = await sha256Hex(token);

        await env.DB.prepare(`
            DELETE FROM mayor_sessions
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

async function listPublicMemories(request, env) {
    await ensureMemoryStorage(env);

    const result = await env.DB.prepare(`
        SELECT
            id,
            title,
            author_name,
            text,
            lat,
            lon,
            media_type,
            created_at,
            published_at
        FROM memories
        WHERE
            status = 'approved'
            AND published_at IS NOT NULL
        ORDER BY published_at DESC, id DESC
        LIMIT 250
    `).all();

    return json(request, env, {
        memories: (result.results || []).map((row) => ({
            id: row.id,
            title: row.title,
            authorName: row.author_name,
            text: row.text,
            lat: row.lat,
            lon: row.lon,
            mediaType: row.media_type,
            mediaUrl: row.media_type
                ? `/api/memories/${row.id}/media`
                : null,
            createdAt: row.created_at,
            publishedAt: row.published_at
        }))
    });
}

async function createMemory(request, env, ctx) {
    const contentLength = Number(request.headers.get("Content-Length") || 0);

    if (contentLength > MAX_MEMORY_REQUEST_BYTES) {
        return json(request, env, {
            error: "Il contenuto allegato è troppo grande."
        }, 413);
    }

    const body = await readJson(request, MAX_MEMORY_REQUEST_BYTES);

    if (!body || typeof body !== "object" || Array.isArray(body)) {
        return json(request, env, {
            error: "Memoria non valida."
        }, 400);
    }

    if (String(body.website || "").trim()) {
        return json(request, env, { ok: true }, 201);
    }

    const title = String(body.title || "").trim();
    const authorName = String(body.authorName || "").trim();
    const text = String(body.text || "").trim();
    const lat = Number(body.lat);
    const lon = Number(body.lon);

    if (title.length < 3 || title.length > MAX_MEMORY_TITLE_LENGTH) {
        return json(request, env, {
            error: `Il titolo deve contenere da 3 a ${MAX_MEMORY_TITLE_LENGTH} caratteri.`
        }, 400);
    }

    if (authorName.length > MAX_MEMORY_AUTHOR_LENGTH) {
        return json(request, env, {
            error: "Il nome o lo username è troppo lungo."
        }, 400);
    }

    if (!text || text.length > MAX_MEMORY_TEXT_LENGTH) {
        return json(request, env, {
            error: `Il testo deve contenere da 1 a ${MAX_MEMORY_TEXT_LENGTH} caratteri.`
        }, 400);
    }

    if (
        !Number.isFinite(lat) ||
        !Number.isFinite(lon) ||
        lat < -90 ||
        lat > 90 ||
        lon < -180 ||
        lon > 180
    ) {
        return json(request, env, {
            error: "Seleziona un punto valido sulla mappa."
        }, 400);
    }

    if (body.consent !== true) {
        return json(request, env, {
            error: "Per inviare la memoria è necessaria l’autorizzazione alla pubblicazione."
        }, 400);
    }

    const media = validateMemoryMedia(body.media);

    if (media.error) {
        return json(request, env, { error: media.error }, 400);
    }

    if (!env.PASSWORD_PEPPER) {
        throw new Error("PASSWORD_PEPPER secret missing.");
    }

    await ensureMemoryStorage(env);

    const sender = request.headers.get("CF-Connecting-IP") || "unknown";
    const senderHash = await hmacHex(
        env.PASSWORD_PEPPER,
        `memory:${sender}`
    );
    const now = Date.now();
    const previous = await env.DB.prepare(`
        SELECT COUNT(*) AS count
        FROM memories
        WHERE
            sender_hash = ?
            AND created_at >= ?
    `).bind(
        senderHash,
        now - 24 * 60 * 60 * 1000
    ).first();

    if (Number(previous?.count || 0) >= MEMORY_LIMIT_PER_DAY) {
        return json(request, env, {
            error: "Hai inviato troppe memorie. Riprova domani."
        }, 429);
    }

    const withdrawalToken = randomToken(24);
    const withdrawalHash = await sha256Hex(withdrawalToken);
    const result = await env.DB.prepare(`
        INSERT INTO memories (
            title,
            author_name,
            text,
            lat,
            lon,
            media_type,
            media_name,
            media_data,
            status,
            consent,
            withdrawal_hash,
            sender_hash,
            created_at,
            updated_at,
            published_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', 1, ?, ?, ?, ?, NULL)
    `).bind(
        title,
        authorName,
        text,
        lat,
        lon,
        media.type,
        media.name,
        media.data,
        withdrawalHash,
        senderHash,
        now,
        now
    ).run();

    const memoryId = result.meta?.last_row_id ?? null;

    queuePushNotification(
        ctx,
        env,
        "admin",
        null,
        {
            title: "nnMrcn — nuova memoria",
            body: "Hai ricevuto una memoria da controllare.",
            url: "/admin.html",
            tag: `nnmrcn-memory-${memoryId || now}`
        }
    );

    return json(request, env, {
        ok: true,
        id: memoryId,
        status: "pending",
        withdrawalToken
    }, 201);
}

function validateMemoryMedia(value) {
    if (!value || typeof value !== "object" || !value.data) {
        return { type: "", name: "", data: null, error: "" };
    }

    const type = String(value.type || "").toLowerCase();
    const name = String(value.name || "allegato").trim().slice(0, 160);
    const data = String(value.data || "").replace(/\s+/gu, "");
    const maxBase64Length = Math.ceil(MAX_MEMORY_MEDIA_BYTES / 3) * 4 + 4;

    if (!MEMORY_MEDIA_TYPES.has(type)) {
        return {
            error: "Formato non supportato. Usa JPEG, PNG, WebP, MP3, OGG, WebM o M4A."
        };
    }

    if (!data || data.length > maxBase64Length || !/^[A-Za-z0-9+/]*={0,2}$/u.test(data)) {
        return { error: "L’allegato è troppo grande o non è valido." };
    }

    let bytes;

    try {
        bytes = fromBase64(data);
    } catch (_) {
        return { error: "L’allegato non è valido." };
    }

    if (
        !bytes.length ||
        bytes.length > MAX_MEMORY_MEDIA_BYTES ||
        !memoryMediaSignatureMatches(type, bytes)
    ) {
        return { error: "Il contenuto dell’allegato non corrisponde al formato indicato." };
    }

    return { type, name, data, error: "" };
}

function memoryMediaSignatureMatches(type, bytes) {
    const startsWith = (...values) =>
        values.every((value, index) => bytes[index] === value);
    const ascii = (offset, value) =>
        Array.from(value).every(
            (character, index) =>
                bytes[offset + index] === character.charCodeAt(0)
        );

    if (type === "image/jpeg") {
        return startsWith(0xff, 0xd8, 0xff);
    }

    if (type === "image/png") {
        return startsWith(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a);
    }

    if (type === "image/webp") {
        return ascii(0, "RIFF") && ascii(8, "WEBP");
    }

    if (type === "audio/ogg") {
        return ascii(0, "OggS");
    }

    if (type === "audio/webm") {
        return startsWith(0x1a, 0x45, 0xdf, 0xa3);
    }

    if (type === "audio/mpeg") {
        return ascii(0, "ID3") || (bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0);
    }

    if (type === "audio/mp4") {
        return ascii(4, "ftyp");
    }

    return false;
}

async function getMemoryStatus(request, env, memoryId) {
    const memory = await memoryForWithdrawal(request, env, memoryId);

    if (!memory) {
        return unauthorized(request, env);
    }

    return json(request, env, {
        id: memory.id,
        title: memory.title,
        status: memory.status,
        createdAt: memory.created_at,
        publishedAt: memory.published_at
    });
}

async function withdrawMemory(request, env, memoryId) {
    const memory = await memoryForWithdrawal(request, env, memoryId);

    if (!memory) {
        return unauthorized(request, env);
    }

    await env.DB.prepare(`
        DELETE FROM memories
        WHERE id = ?
    `).bind(memoryId).run();

    return json(request, env, { ok: true });
}

async function memoryForWithdrawal(request, env, memoryId) {
    if (!Number.isInteger(memoryId) || memoryId <= 0) {
        return null;
    }

    const token = request.headers.get("X-Memory-Token") || "";

    if (!token) {
        return null;
    }

    await ensureMemoryStorage(env);
    const withdrawalHash = await sha256Hex(token);

    return await env.DB.prepare(`
        SELECT id, title, status, created_at, published_at
        FROM memories
        WHERE
            id = ?
            AND withdrawal_hash = ?
        LIMIT 1
    `).bind(memoryId, withdrawalHash).first();
}

async function getMemoryMedia(request, env, memoryId) {
    if (!Number.isInteger(memoryId) || memoryId <= 0) {
        return json(request, env, { error: "Memoria non valida." }, 400);
    }

    await ensureMemoryStorage(env);

    const memory = await env.DB.prepare(`
        SELECT id, media_type, media_data, status
        FROM memories
        WHERE id = ?
        LIMIT 1
    `).bind(memoryId).first();

    if (!memory || !memory.media_type || !memory.media_data) {
        return json(request, env, { error: "Allegato non disponibile." }, 404);
    }

    const publicMemory = memory.status === "approved";

    if (!publicMemory && !(await adminAuthorized(request, env))) {
        return unauthorized(request, env);
    }

    const bytes = fromBase64(memory.media_data);
    const extension = memoryMediaExtension(memory.media_type);

    return new Response(bytes, {
        headers: {
            "Content-Type": memory.media_type,
            "Content-Length": String(bytes.byteLength),
            "Content-Disposition":
                `inline; filename="memoria-${memoryId}.${extension}"`,
            "Cache-Control": "no-store",
            "X-Content-Type-Options": "nosniff",
            ...corsHeaders(request, env)
        }
    });
}

function memoryMediaExtension(type) {
    return {
        "image/jpeg": "jpg",
        "image/png": "png",
        "image/webp": "webp",
        "audio/mpeg": "mp3",
        "audio/ogg": "ogg",
        "audio/webm": "webm",
        "audio/mp4": "m4a"
    }[type] || "bin";
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

    const body = await readJson(request, MAX_CONTACT_REQUEST_BYTES);

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

    const body = await readJson(request, MAX_CONTACT_REQUEST_BYTES);

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

async function listPublicWikiEntries(request, env) {
    await ensureWikiStorage(env);

    const result = await env.DB.prepare(`
        SELECT
            id,
            slug,
            title,
            summary,
            updated_at,
            published_at
        FROM wiki_entries
        WHERE status = 'published'
        ORDER BY title COLLATE NOCASE, id
    `).all();

    return json(request, env, {
        entries: (result.results || []).map((row) =>
            wikiEntryPayload(row, false)
        )
    });
}

async function getPublicWikiEntry(request, env, slug) {
    await ensureWikiStorage(env);

    const entry = await env.DB.prepare(`
        SELECT
            id,
            slug,
            title,
            summary,
            body,
            updated_at,
            published_at
        FROM wiki_entries
        WHERE slug = ? AND status = 'published'
        LIMIT 1
    `).bind(slug).first();

    if (!entry) {
        return json(request, env, {
            error: "Voce non trovata."
        }, 404);
    }

    return json(request, env, {
        entry: await wikiEntryWithImages(env, entry, true)
    });
}

async function adminListWikiEntries(request, env) {
    if (!(await adminAuthorized(request, env))) {
        return unauthorized(request, env);
    }

    await ensureWikiStorage(env);

    const result = await env.DB.prepare(`
        SELECT
            entry.id,
            entry.slug,
            entry.title,
            entry.summary,
            entry.body,
            entry.status,
            entry.created_at,
            entry.updated_at,
            entry.published_at,
            COALESCE((
                SELECT MAX(revision_number)
                FROM wiki_entry_revisions revision
                WHERE revision.entry_id = entry.id
            ), 0) AS revision_number
        FROM wiki_entries entry
        ORDER BY entry.updated_at DESC, entry.id DESC
    `).all();

    return json(request, env, {
        entries: await Promise.all((result.results || []).map((row) =>
            wikiEntryWithImages(env, row, true)
        ))
    });
}

async function adminCreateWikiEntry(request, env) {
    if (!(await adminAuthorized(request, env))) {
        return unauthorized(request, env);
    }

    await ensureWikiStorage(env);

    const input = normalizeWikiEntryInput(
        await readJson(request, MAX_WIKI_REQUEST_BYTES)
    );

    if (input.error) {
        return json(request, env, { error: input.error }, 400);
    }

    const imageValidation = await validateWikiImageOwnership(
        env,
        0,
        input.images
    );

    if (imageValidation.error) {
        return json(request, env, { error: imageValidation.error }, 400);
    }

    if (await wikiSlugExists(env, input.slug)) {
        return json(request, env, {
            error: "Esiste già una voce con questo indirizzo."
        }, 409);
    }

    const now = Date.now();
    const publishedAt = input.status === "published" ? now : null;
    const result = await env.DB.prepare(`
        INSERT INTO wiki_entries (
            slug,
            title,
            summary,
            body,
            status,
            created_at,
            updated_at,
            published_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
        input.slug,
        input.title,
        input.summary,
        input.body,
        input.status,
        now,
        now,
        publishedAt
    ).run();

    const entryId = Number(result.meta?.last_row_id);

    if (!Number.isInteger(entryId) || entryId <= 0) {
        throw new Error("Wiki entry id missing after insert.");
    }

    await env.DB.batch([
        wikiRevisionStatement(env, entryId, 1, input, now),
        ...wikiImageStatements(
            env,
            entryId,
            input.images,
            imageValidation.existing,
            now
        )
    ]);

    return json(request, env, {
        ok: true,
        entry: await getAdminWikiEntry(env, entryId)
    }, 201);
}

async function adminUpdateWikiEntry(request, env, entryId) {
    if (!(await adminAuthorized(request, env))) {
        return unauthorized(request, env);
    }

    if (!Number.isInteger(entryId) || entryId <= 0) {
        return json(request, env, {
            error: "Voce non valida."
        }, 400);
    }

    await ensureWikiStorage(env);

    const existing = await getAdminWikiEntry(env, entryId);

    if (!existing) {
        return json(request, env, {
            error: "Voce non trovata."
        }, 404);
    }

    const input = normalizeWikiEntryInput(
        await readJson(request, MAX_WIKI_REQUEST_BYTES)
    );

    if (input.error) {
        return json(request, env, { error: input.error }, 400);
    }

    const imageValidation = await validateWikiImageOwnership(
        env,
        entryId,
        input.images
    );

    if (imageValidation.error) {
        return json(request, env, { error: imageValidation.error }, 400);
    }

    if (await wikiSlugExists(env, input.slug, entryId)) {
        return json(request, env, {
            error: "Esiste già una voce con questo indirizzo."
        }, 409);
    }

    const now = Date.now();
    const publishedAt = input.status === "published"
        ? existing.publishedAt || now
        : null;
    const revisionNumber = Number(existing.revisionNumber || 0) + 1;

    await env.DB.batch([
        env.DB.prepare(`
            UPDATE wiki_entries
            SET
                slug = ?,
                title = ?,
                summary = ?,
                body = ?,
                status = ?,
                updated_at = ?,
                published_at = ?
            WHERE id = ?
        `).bind(
            input.slug,
            input.title,
            input.summary,
            input.body,
            input.status,
            now,
            publishedAt,
            entryId
        ),
        wikiRevisionStatement(
            env,
            entryId,
            revisionNumber,
            input,
            now
        ),
        ...wikiImageStatements(
            env,
            entryId,
            input.images,
            imageValidation.existing,
            now
        ),
        wikiImageCleanupStatement(env, entryId, input.images)
    ]);

    return json(request, env, {
        ok: true,
        entry: await getAdminWikiEntry(env, entryId)
    });
}

function normalizeWikiEntryInput(value) {
    const title = String(value?.title || "").trim();
    const slug = String(value?.slug || slugifyWikiTitle(title))
        .trim()
        .toLowerCase();
    const summary = String(value?.summary || "").trim();
    const body = String(value?.body || "").trim();
    const status = String(value?.status || "draft").trim();

    if (title.length < 2 || title.length > MAX_WIKI_TITLE_LENGTH) {
        return { error: "Il titolo deve contenere da 2 a 160 caratteri." };
    }

    if (
        !slug ||
        slug.length > MAX_WIKI_SLUG_LENGTH ||
        !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)
    ) {
        return {
            error: "L’indirizzo può contenere solo lettere minuscole, numeri e trattini."
        };
    }

    if (summary.length > MAX_WIKI_SUMMARY_LENGTH) {
        return { error: "Il sommario non può superare 500 caratteri." };
    }

    if (body.length > MAX_WIKI_BODY_LENGTH) {
        return { error: "Il testo non può superare 50.000 caratteri." };
    }

    if (!WIKI_STATUSES.has(status)) {
        return { error: "Stato della voce non valido." };
    }

    if (status === "published" && !body) {
        return { error: "Una voce pubblicata deve contenere del testo." };
    }

    const sourcesError = validateWikiSources(body);

    if (sourcesError) {
        return { error: sourcesError };
    }

    const images = normalizeWikiImages(value?.images, body);

    if (images.error) {
        return images;
    }

    return { title, slug, summary, body, status, images };
}

function validateWikiSources(body) {
    const sourcePattern = /\[fonte:([^\]\n]+)\]/g;
    const matches = Array.from(String(body || "").matchAll(sourcePattern));

    if (matches.length > MAX_WIKI_SOURCES) {
        return `Una voce può contenere al massimo ${MAX_WIKI_SOURCES} richiami alle fonti.`;
    }

    if (String(body || "").replace(sourcePattern, "").includes("[fonte:")) {
        return "Una fonte nel testo è incompleta o non valida.";
    }

    for (const match of matches) {
        const parts = match[1].split("|");

        if (parts.length !== 4) {
            return "Una fonte nel testo non ha tutti i campi previsti.";
        }

        let decoded;

        try {
            decoded = parts.map((part) => decodeURIComponent(part));
        } catch (_) {
            return "Una fonte nel testo contiene dati non validi.";
        }

        const [url, title, author, date] = decoded.map((part) => part.trim());

        if (!title || title.length > MAX_WIKI_SOURCE_TITLE_LENGTH) {
            return `Il titolo di ogni fonte deve contenere da 1 a ${MAX_WIKI_SOURCE_TITLE_LENGTH} caratteri.`;
        }

        if (author.length > MAX_WIKI_SOURCE_AUTHOR_LENGTH) {
            return `L’autore o ente della fonte non può superare ${MAX_WIKI_SOURCE_AUTHOR_LENGTH} caratteri.`;
        }

        if (date.length > MAX_WIKI_SOURCE_DATE_LENGTH) {
            return `La data della fonte non può superare ${MAX_WIKI_SOURCE_DATE_LENGTH} caratteri.`;
        }

        if (url.length > MAX_WIKI_SOURCE_URL_LENGTH) {
            return "Il collegamento della fonte è troppo lungo.";
        }

        if (url) {
            try {
                const parsed = new URL(url);

                if (!["http:", "https:"].includes(parsed.protocol)) {
                    return "Il collegamento della fonte deve iniziare con http:// o https://.";
                }
            } catch (_) {
                return "Il collegamento della fonte non è valido.";
            }
        }
    }

    return "";
}

function normalizeWikiImages(value, body) {
    const imageIds = extractWikiImageIds(body);

    if (imageIds.length > MAX_WIKI_IMAGES) {
        return {
            error: `Una voce può contenere al massimo ${MAX_WIKI_IMAGES} fotografie.`
        };
    }

    if (!imageIds.length) {
        return [];
    }

    if (!Array.isArray(value) || value.length > MAX_WIKI_IMAGES) {
        return { error: "I dati delle fotografie non sono validi." };
    }

    const supplied = new Map();

    for (const rawImage of value) {
        const image = normalizeWikiImage(rawImage);

        if (image.error) {
            return image;
        }

        if (supplied.has(image.id)) {
            return { error: "La stessa fotografia è stata inserita più volte." };
        }

        supplied.set(image.id, image);
    }

    const images = [];

    for (const imageId of imageIds) {
        const image = supplied.get(imageId);

        if (!image) {
            return {
                error: "Una fotografia presente nel testo non ha i dati necessari. Reinseriscila dall’editor."
            };
        }

        images.push(image);
    }

    return images;
}

function normalizeWikiImage(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        return { error: "Fotografia non valida." };
    }

    const id = String(value.id || "").trim().toLowerCase();
    const name = String(value.name || "fotografia").trim().slice(0, 160);
    const type = String(value.type || "").trim().toLowerCase();
    const alt = String(value.alt || "").trim();
    const caption = String(value.caption || "").trim();
    const data = String(value.data || "").replace(/\s+/gu, "");

    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(id)) {
        return { error: "Identificativo della fotografia non valido." };
    }

    if (!alt || alt.length > MAX_WIKI_IMAGE_ALT_LENGTH) {
        return {
            error: `Il testo alternativo deve contenere da 1 a ${MAX_WIKI_IMAGE_ALT_LENGTH} caratteri.`
        };
    }

    if (caption.length > MAX_WIKI_IMAGE_CAPTION_LENGTH) {
        return {
            error: `La didascalia non può superare ${MAX_WIKI_IMAGE_CAPTION_LENGTH} caratteri.`
        };
    }

    if (!data) {
        return { id, name, type, alt, caption, data: "" };
    }

    const media = validateWikiImageMedia({ name, type, data });

    if (media.error) {
        return media;
    }

    return { id, name: media.name, type: media.type, alt, caption, data: media.data };
}

function validateWikiImageMedia(value) {
    const type = String(value.type || "").toLowerCase();
    const name = String(value.name || "fotografia").trim().slice(0, 160);
    const data = String(value.data || "").replace(/\s+/gu, "");
    const maxBase64Length = Math.ceil(MAX_WIKI_IMAGE_BYTES / 3) * 4 + 4;

    if (!WIKI_IMAGE_TYPES.has(type)) {
        return { error: "Formato non supportato. Usa JPEG, PNG o WebP." };
    }

    if (!data || data.length > maxBase64Length || !/^[A-Za-z0-9+/]*={0,2}$/u.test(data)) {
        return { error: "La fotografia è troppo grande o non è valida." };
    }

    let bytes;

    try {
        bytes = fromBase64(data);
    } catch (_) {
        return { error: "La fotografia non è valida." };
    }

    if (
        !bytes.length ||
        bytes.length > MAX_WIKI_IMAGE_BYTES ||
        !memoryMediaSignatureMatches(type, bytes)
    ) {
        return {
            error: "Il contenuto della fotografia non corrisponde al formato indicato."
        };
    }

    return { type, name, data, error: "" };
}

function extractWikiImageIds(body) {
    const ids = [];
    const seen = new Set();
    const pattern = /\[foto:([0-9a-f-]{36})\]/g;

    for (const match of String(body || "").matchAll(pattern)) {
        const id = match[1].toLowerCase();

        if (!seen.has(id)) {
            seen.add(id);
            ids.push(id);
        }
    }

    return ids;
}

async function validateWikiImageOwnership(env, entryId, images) {
    if (!images.length) {
        return { existing: new Map(), error: "" };
    }

    const placeholders = images.map(() => "?").join(", ");
    const result = await env.DB.prepare(`
        SELECT id, entry_id
        FROM wiki_entry_images
        WHERE id IN (${placeholders})
    `).bind(...images.map((image) => image.id)).all();
    const existing = new Map(
        (result.results || []).map((row) => [row.id, Number(row.entry_id)])
    );

    for (const image of images) {
        const ownerId = existing.get(image.id);

        if (ownerId !== undefined && ownerId !== entryId) {
            return { error: "Una fotografia appartiene a un’altra voce." };
        }

        if (ownerId === undefined && !image.data) {
            return {
                error: "I dati di una nuova fotografia sono mancanti. Seleziona nuovamente il file."
            };
        }
    }

    return { existing, error: "" };
}

function wikiImageStatements(env, entryId, images, existing, now) {
    return images.map((image) => {
        if (existing.has(image.id)) {
            if (image.data) {
                return env.DB.prepare(`
                    UPDATE wiki_entry_images
                    SET
                        media_type = ?,
                        media_name = ?,
                        media_data = ?,
                        alt_text = ?,
                        caption = ?,
                        updated_at = ?
                    WHERE id = ? AND entry_id = ?
                `).bind(
                    image.type,
                    image.name,
                    image.data,
                    image.alt,
                    image.caption,
                    now,
                    image.id,
                    entryId
                );
            }

            return env.DB.prepare(`
                UPDATE wiki_entry_images
                SET alt_text = ?, caption = ?, updated_at = ?
                WHERE id = ? AND entry_id = ?
            `).bind(
                image.alt,
                image.caption,
                now,
                image.id,
                entryId
            );
        }

        return env.DB.prepare(`
            INSERT INTO wiki_entry_images (
                id,
                entry_id,
                media_type,
                media_name,
                media_data,
                alt_text,
                caption,
                created_at,
                updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
            image.id,
            entryId,
            image.type,
            image.name,
            image.data,
            image.alt,
            image.caption,
            now,
            now
        );
    });
}

function wikiImageCleanupStatement(env, entryId, images) {
    if (!images.length) {
        return env.DB.prepare(`
            DELETE FROM wiki_entry_images
            WHERE entry_id = ?
        `).bind(entryId);
    }

    const placeholders = images.map(() => "?").join(", ");
    return env.DB.prepare(`
        DELETE FROM wiki_entry_images
        WHERE entry_id = ? AND id NOT IN (${placeholders})
    `).bind(entryId, ...images.map((image) => image.id));
}

function slugifyWikiTitle(title) {
    return String(title || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, MAX_WIKI_SLUG_LENGTH);
}

async function wikiSlugExists(env, slug, excludedId = 0) {
    const row = await env.DB.prepare(`
        SELECT id
        FROM wiki_entries
        WHERE slug = ? AND id <> ?
        LIMIT 1
    `).bind(slug, excludedId).first();

    return Boolean(row);
}

async function getAdminWikiEntry(env, entryId) {
    const row = await env.DB.prepare(`
        SELECT
            entry.id,
            entry.slug,
            entry.title,
            entry.summary,
            entry.body,
            entry.status,
            entry.created_at,
            entry.updated_at,
            entry.published_at,
            COALESCE((
                SELECT MAX(revision_number)
                FROM wiki_entry_revisions revision
                WHERE revision.entry_id = entry.id
            ), 0) AS revision_number
        FROM wiki_entries entry
        WHERE entry.id = ?
        LIMIT 1
    `).bind(entryId).first();

    return row ? wikiEntryPayload(row, true) : null;
}

function wikiRevisionStatement(env, entryId, revisionNumber, input, now) {
    return env.DB.prepare(`
        INSERT INTO wiki_entry_revisions (
            entry_id,
            revision_number,
            slug,
            title,
            summary,
            body,
            status,
            created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
        entryId,
        revisionNumber,
        input.slug,
        input.title,
        input.summary,
        input.body,
        input.status,
        now
    );
}

function wikiEntryPayload(row, includeBody) {
    const entry = {
        id: Number(row.id),
        slug: row.slug,
        title: row.title,
        summary: row.summary || "",
        status: row.status,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        publishedAt: row.published_at,
        revisionNumber: Number(row.revision_number || 0)
    };

    if (includeBody) {
        entry.body = row.body || "";
    }

    return entry;
}

async function wikiEntryWithImages(env, row, includeBody) {
    const entry = wikiEntryPayload(row, includeBody);
    entry.images = includeBody
        ? await getWikiEntryImages(env, entry.id, entry.body)
        : [];
    return entry;
}

async function getWikiEntryImages(env, entryId, body) {
    const imageIds = extractWikiImageIds(body);

    if (!imageIds.length) {
        return [];
    }

    const placeholders = imageIds.map(() => "?").join(", ");
    const result = await env.DB.prepare(`
        SELECT id, media_type, media_name, alt_text, caption
        FROM wiki_entry_images
        WHERE entry_id = ? AND id IN (${placeholders})
    `).bind(entryId, ...imageIds).all();
    const byId = new Map((result.results || []).map((row) => [row.id, row]));

    return imageIds.flatMap((id) => {
        const image = byId.get(id);

        if (!image) {
            return [];
        }

        return [{
            id: image.id,
            type: image.media_type,
            name: image.media_name,
            alt: image.alt_text,
            caption: image.caption,
            mediaUrl: `/api/public/wiki-images/${image.id}`,
            adminMediaUrl: `/api/admin/wiki-images/${image.id}`
        }];
    });
}

async function getWikiImage(request, env, imageId, adminOnly) {
    if (adminOnly && !(await adminAuthorized(request, env))) {
        return unauthorized(request, env);
    }

    await ensureWikiStorage(env);

    const image = await env.DB.prepare(`
        SELECT
            image.id,
            image.media_type,
            image.media_data,
            entry.body,
            entry.status
        FROM wiki_entry_images image
        INNER JOIN wiki_entries entry ON entry.id = image.entry_id
        WHERE image.id = ?
        LIMIT 1
    `).bind(imageId).first();

    if (
        !image ||
        !image.media_data ||
        (!adminOnly && (
            image.status !== "published" ||
            !String(image.body || "").includes(`[foto:${imageId}]`)
        ))
    ) {
        return json(request, env, { error: "Fotografia non disponibile." }, 404);
    }

    const bytes = fromBase64(image.media_data);
    const extension = memoryMediaExtension(image.media_type);

    return new Response(bytes, {
        headers: {
            "Content-Type": image.media_type,
            "Content-Length": String(bytes.byteLength),
            "Content-Disposition":
                `inline; filename="voce-${imageId}.${extension}"`,
            "Cache-Control": adminOnly
                ? "no-store"
                : "public, max-age=3600",
            "X-Content-Type-Options": "nosniff",
            ...corsHeaders(request, env)
        }
    });
}

async function ensureWikiStorage(env) {
    await env.DB.batch(
        WIKI_STORAGE_STATEMENTS.map((statement) =>
            env.DB.prepare(statement)
        )
    );
}

async function ensureContactStorage(env) {
    await env.DB.batch(
        CONTACT_STORAGE_STATEMENTS.map((statement) =>
            env.DB.prepare(statement)
        )
    );
}

async function ensureMemoryStorage(env) {
    await env.DB.batch(
        MEMORY_STORAGE_STATEMENTS.map((statement) =>
            env.DB.prepare(statement)
        )
    );
}

async function ensureMayorStorage(env) {
    await env.DB.batch(
        MAYOR_STORAGE_STATEMENTS.map((statement) =>
            env.DB.prepare(statement)
        )
    );

    await env.DB.prepare(`
        INSERT OR IGNORE INTO mayor_message (
            id,
            title,
            body,
            updated_at
        )
        VALUES (1, 'Messaggio per il sindaco', '', ?)
    `).bind(Date.now()).run();
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
    await ensureMemoryStorage(env);

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

    const memorySummary = await env.DB.prepare(`
        SELECT
            COALESCE(SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END), 0)
                AS pending_memories,
            COALESCE(SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END), 0)
                AS public_memories
        FROM memories
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
        unreadContacts: Number(summary?.unread_contacts || 0),
        pendingMemories: Number(memorySummary?.pending_memories || 0),
        publicMemories: Number(memorySummary?.public_memories || 0)
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

async function adminListMemories(request, env, url) {
    if (!(await adminAuthorized(request, env))) {
        return unauthorized(request, env);
    }

    await ensureMemoryStorage(env);

    const requestedStatus = url.searchParams.get("status") || "pending";
    const status = MEMORY_STATUSES.includes(requestedStatus)
        ? requestedStatus
        : "pending";
    const showAll = requestedStatus === "all";
    let statement = env.DB.prepare(`
        SELECT
            id,
            title,
            author_name,
            text,
            lat,
            lon,
            media_type,
            media_name,
            status,
            created_at,
            updated_at,
            published_at
        FROM memories
        ${showAll ? "" : "WHERE status = ?"}
        ORDER BY created_at DESC
        LIMIT 250
    `);

    if (!showAll) {
        statement = statement.bind(status);
    }

    const result = await statement.all();

    return json(request, env, {
        memories: (result.results || []).map((row) => ({
            id: row.id,
            title: row.title,
            authorName: row.author_name,
            text: row.text,
            lat: row.lat,
            lon: row.lon,
            mediaType: row.media_type,
            mediaName: row.media_name,
            mediaUrl: row.media_type
                ? `/api/memories/${row.id}/media`
                : null,
            status: row.status,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
            publishedAt: row.published_at
        }))
    });
}

async function adminUpdateMemory(request, env, memoryId) {
    if (!(await adminAuthorized(request, env))) {
        return unauthorized(request, env);
    }

    const body = await readJson(request);
    const action = body?.action;

    if (!["approve", "reject"].includes(action)) {
        return json(request, env, { error: "Azione non valida." }, 400);
    }

    await ensureMemoryStorage(env);

    const memory = await env.DB.prepare(`
        SELECT id, status
        FROM memories
        WHERE id = ?
        LIMIT 1
    `).bind(memoryId).first();

    if (!memory) {
        return json(request, env, { error: "Memoria non trovata." }, 404);
    }

    const nextStatus = action === "approve" ? "approved" : "rejected";
    const now = Date.now();

    await env.DB.prepare(`
        UPDATE memories
        SET
            status = ?,
            updated_at = ?,
            published_at = ?
        WHERE id = ?
    `).bind(
        nextStatus,
        now,
        nextStatus === "approved" ? now : null,
        memoryId
    ).run();

    return json(request, env, {
        ok: true,
        status: nextStatus,
        publishedAt: nextStatus === "approved" ? now : null
    });
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

async function requireMayorSession(request, env) {
    const token = bearerToken(request);

    if (!token) {
        return null;
    }

    await ensureMayorStorage(env);

    const sessionHash = await sha256Hex(token);
    const now = Date.now();

    const session = await env.DB.prepare(`
        SELECT session_hash, expires_at
        FROM mayor_sessions
        WHERE
            session_hash = ?
            AND expires_at > ?
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

async function matchesSha256(value, expectedHex) {
    if (!value || !/^[0-9a-f]{64}$/u.test(expectedHex)) {
        return false;
    }

    const digest = await crypto.subtle.digest(
        "SHA-256",
        new TextEncoder().encode(value)
    );
    const expected = fromHex(expectedHex);

    return crypto.subtle.timingSafeEqual(digest, expected.buffer);
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

function fromHex(value) {
    const bytes = new Uint8Array(value.length / 2);

    for (let index = 0; index < value.length; index += 2) {
        bytes[index / 2] = Number.parseInt(value.slice(index, index + 2), 16);
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

async function readJson(request, maximumBytes = MAX_JSON_REQUEST_BYTES) {
    const contentLength = Number(request.headers.get("Content-Length"));

    if (Number.isFinite(contentLength) && contentLength > maximumBytes) {
        throw new RequestBodyTooLargeError();
    }

    if (!request.body) {
        return null;
    }

    const reader = request.body.getReader();
    const chunks = [];
    let totalBytes = 0;

    try {
        while (true) {
            const { done, value } = await reader.read();

            if (done) {
                break;
            }

            totalBytes += value.byteLength;

            if (totalBytes > maximumBytes) {
                await reader.cancel().catch(() => {});
                throw new RequestBodyTooLargeError();
            }

            chunks.push(value);
        }
    } finally {
        reader.releaseLock();
    }

    const data = new Uint8Array(totalBytes);
    let offset = 0;

    for (const chunk of chunks) {
        data.set(chunk, offset);
        offset += chunk.byteLength;
    }

    try {
        return JSON.parse(new TextDecoder().decode(data));
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
        "Access-Control-Allow-Methods": "GET,POST,PATCH,DELETE,OPTIONS",
        "Access-Control-Allow-Headers":
            "Authorization,Content-Type,X-Admin-Token,X-Memory-Token",
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
                "X-Content-Type-Options": "nosniff",
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
            "X-Content-Type-Options": "nosniff",
            "X-Export-Truncated": truncated ? "1" : "0",
            ...corsHeaders(request, env)
        }
    });
}
