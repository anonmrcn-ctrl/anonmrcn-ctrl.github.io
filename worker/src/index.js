import {
    getPushConfiguration,
    notifyPushSubscribers,
    PushRequestError,
    removePushSubscription,
    savePushSubscription
} from "./push.js";
import { CMS_STORAGE_STATEMENTS } from "./cms-schema.js";
import { PRIVACY_DOCUMENT_SEED } from "./legal-seed.js";
import { MAP_LAYER_SEEDS } from "./map-seed.js";
import { NARRATIVE_STEP_SEEDS } from "./narrative-seed.js";
import { NAVIGATION_SEEDS } from "./navigation-seed.js";
import {
    WELCOME_INTRO_SEED,
    WELCOME_STEP_SEEDS
} from "./onboarding-seed.js";
import { PAGE_SEEDS } from "./page-seed.js";
import {
    POEM_SECTION_PERMALINK_SEEDS,
    STATIC_PERMALINK_SEEDS
} from "./permalink-seed.js";
import { POEM_SEED } from "./poem-seed.js";
import {
    SHARED_SOURCE_IDS_BY_URL,
    SHARED_SOURCE_SEEDS
} from "./source-seed.js";
import { SITE_SETTINGS_SEEDS } from "./settings-seed.js";

// workerd refuses PBKDF2 requests above 100,000 iterations.
const PBKDF2_ITERATIONS = 100000;
const SESSION_TTL_MS = 365 * 24 * 60 * 60 * 1000;
const SESSION_RENEWAL_INTERVAL_MS = 24 * 60 * 60 * 1000;
const MAYOR_SESSION_TTL_MS = 4 * 60 * 60 * 1000;
const MAYOR_PASSWORD_SHA256 =
    "a67e12f44ada7f5ad5c4e30a53c6df570721e83e2ff6ea42ce38eaf678891faa";
const MAYOR_ACCESS_TOKEN_SHA256 =
    "5f9c3578b2ddecae87e38f8f25738f0c60624a99bc95280571cc211366cdacb3";
const LOCATION_ACCESS_TOKEN_SHA256 =
    "e5cf056306b37f875f6bdae97ab0fbb39261102d06c30cee7045f324c79d83d9";
const MESSAGE_LIMIT_PER_HOUR = 5;
const MAX_MESSAGE_LENGTH = 1500;
const MAX_CONTACT_NAME_LENGTH = 80;
const MAX_CONTACT_EMAIL_LENGTH = 254;
const MAX_LOCATION_ADDRESS_LENGTH = 240;
const MAX_CONTACT_REQUEST_BYTES = 8192;
const CONTACT_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;
const LOCATION_MIN_SHIFT_METERS = 250;
const LOCATION_MAX_SHIFT_METERS = 400;
const CIVIC_NUMBER_SOURCE = String.raw`\d{1,4}[a-z]?(?:[\/-](?:\d{1,4}[a-z]?|[a-z]))?(?:\s+(?:bis|ter|quater))?`;
const EXPLICIT_CIVIC_NUMBER_PATTERN = new RegExp(
    String.raw`\s*,?\s*(?:numero|civico|n(?:[°ºo])?)\.?\s*${CIVIC_NUMBER_SOURCE}`,
    "giu"
);
const CIVIC_BEFORE_LOCALITY_PATTERN = new RegExp(
    String.raw`(\p{L}[\p{L}'’.-]*(?:\s+(?:\d{1,2}\s+)?\p{L}[\p{L}'’.-]*)+)\s+${CIVIC_NUMBER_SOURCE}(?=\s+(?:\d{5}\s+)?\p{L})`,
    "giu"
);
const CIVIC_BEFORE_BOUNDARY_PATTERN = new RegExp(
    String.raw`\s+${CIVIC_NUMBER_SOURCE}(?=\s*(?:,|$))`,
    "giu"
);
const NUMBERED_ROUTE_PREFIX_PATTERN =
    /(?:strada\s+(?:regionale|statale|provinciale)|s[prs])\s*$/iu;
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
const MAX_MAP_ENTRY_NAME_LENGTH = 160;
const MAX_MAP_ENTRY_DESCRIPTION_LENGTH = 3000;
const MAX_MAP_ENTRY_SOURCE_URL_LENGTH = 2048;
const MAX_MAP_ENTRY_SOURCE_LABEL_LENGTH = 160;
const MAX_MAP_ENTRY_IMAGE_BYTES = 700000;
const MAX_MAP_ENTRY_REQUEST_BYTES = 1000000;
const MAX_NARRATIVE_STEP_REQUEST_BYTES = 64000;
const MAX_NARRATIVE_STEP_LABEL_LENGTH = 160;
const MAX_NARRATIVE_STEP_VERSE_LENGTH = 240;
const MAX_NARRATIVE_STEP_TEXT_LENGTH = 5000;
const MAX_NARRATIVE_STEP_SOURCES = 20;
const MAX_NARRATIVE_SOURCE_TERMS = 20;

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
const MAP_ENTRY_CATEGORIES = new Set([
    "luogo",
    "edificio",
    "monumento",
    "infrastruttura",
    "paesaggio",
    "corso_d_acqua",
    "cava",
    "percorso"
]);
const NARRATIVE_STATUSES = new Set(["draft", "published"]);
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
const MAP_ENTRY_STORAGE_STATEMENTS = Object.freeze([
    `CREATE TABLE IF NOT EXISTS map_entries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL CHECK (length(name) BETWEEN 2 AND 160),
        category TEXT NOT NULL DEFAULT 'luogo'
            CHECK (category IN (
                'luogo',
                'edificio',
                'monumento',
                'infrastruttura',
                'paesaggio',
                'corso_d_acqua',
                'cava',
                'percorso'
            )),
        description TEXT NOT NULL DEFAULT ''
            CHECK (length(description) <= 3000),
        lat REAL NOT NULL CHECK (lat BETWEEN -90 AND 90),
        lon REAL NOT NULL CHECK (lon BETWEEN -180 AND 180),
        source_url TEXT NOT NULL DEFAULT ''
            CHECK (length(source_url) <= 2048),
        source_label TEXT NOT NULL DEFAULT ''
            CHECK (length(source_label) <= 160),
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
    )`,
    `CREATE INDEX IF NOT EXISTS idx_map_entries_name
        ON map_entries(name COLLATE NOCASE, id)`,
    `CREATE TABLE IF NOT EXISTS map_entry_images (
        entry_id INTEGER PRIMARY KEY,
        media_type TEXT NOT NULL
            CHECK (media_type IN ('image/jpeg', 'image/png', 'image/webp')),
        media_name TEXT NOT NULL DEFAULT '',
        media_data TEXT NOT NULL,
        updated_at INTEGER NOT NULL,
        FOREIGN KEY (entry_id)
            REFERENCES map_entries(id)
            ON DELETE CASCADE
    )`
]);
const NARRATIVE_STORAGE_STATEMENTS = Object.freeze([
    `CREATE TABLE IF NOT EXISTS narrative_steps (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        stable_key TEXT NOT NULL UNIQUE
            CHECK (length(stable_key) BETWEEN 1 AND 160),
        position INTEGER NOT NULL DEFAULT 1
            CHECK (position BETWEEN 1 AND 9999),
        verse TEXT NOT NULL
            CHECK (length(verse) BETWEEN 1 AND 240),
        label TEXT NOT NULL
            CHECK (length(label) BETWEEN 1 AND 160),
        title TEXT NOT NULL
            CHECK (length(title) BETWEEN 1 AND 160),
        title_url TEXT NOT NULL DEFAULT ''
            CHECK (length(title_url) <= 2048),
        lat REAL NOT NULL CHECK (lat BETWEEN -90 AND 90),
        lon REAL NOT NULL CHECK (lon BETWEEN -180 AND 180),
        zoom INTEGER NOT NULL DEFAULT 16 CHECK (zoom BETWEEN 10 AND 19),
        explanation TEXT NOT NULL
            CHECK (length(explanation) BETWEEN 1 AND 5000),
        sources_json TEXT NOT NULL DEFAULT '[]',
        status TEXT NOT NULL DEFAULT 'draft'
            CHECK (status IN ('draft', 'published')),
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        published_at INTEGER
    )`,
    `CREATE INDEX IF NOT EXISTS idx_narrative_steps_public
        ON narrative_steps(status, position, id)`,
    `CREATE TABLE IF NOT EXISTS content_initializations (
        name TEXT PRIMARY KEY,
        applied_at INTEGER NOT NULL
    )`
]);
const LOCATION_PROFILE_COLUMNS = Object.freeze([
    {
        name: "username",
        statement: "ALTER TABLE locations ADD COLUMN username TEXT NOT NULL DEFAULT ''"
    },
    {
        name: "street_name",
        statement: "ALTER TABLE locations ADD COLUMN street_name TEXT NOT NULL DEFAULT ''"
    },
    {
        name: "street_order",
        statement:
            "ALTER TABLE locations ADD COLUMN street_order INTEGER NOT NULL DEFAULT 0 CHECK (street_order >= 0)"
    },
    {
        name: "is_visible",
        statement:
            "ALTER TABLE locations ADD COLUMN is_visible INTEGER NOT NULL DEFAULT 0 CHECK (is_visible IN (0, 1))"
    },
    {
        name: "welcome_seen_at",
        statement: "ALTER TABLE locations ADD COLUMN welcome_seen_at INTEGER"
    },
    {
        name: "privacy_safe",
        statement:
            "ALTER TABLE locations ADD COLUMN privacy_safe INTEGER NOT NULL DEFAULT 0 CHECK (privacy_safe IN (0, 1))"
    },
    {
        name: "location_consent_at",
        statement: "ALTER TABLE locations ADD COLUMN location_consent_at INTEGER"
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
const cmsStorageInitializations = new WeakMap();
const mayorStorageInitializations = new WeakMap();


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

            if (
                request.method === "POST" &&
                path === "/api/welcome/complete"
            ) {
                return await completeWelcome(request, env);
            }

            if (request.method === "POST" && path === "/api/mayor/access") {
                return await checkMayorAccess(request, env);
            }

            if (request.method === "POST" && path === "/api/location/access") {
                return await checkLocationAccess(request, env);
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

            if (request.method === "GET" && path === "/api/public/map-entries") {
                return await listPublicMapEntries(request, env);
            }

            if (
                request.method === "GET" &&
                /^\/api\/public\/pages\/[a-z0-9]+(?:-[a-z0-9]+)*$/.test(path)
            ) {
                const slug = path.split("/").pop();
                return await getPublicPage(request, env, slug);
            }

            if (
                request.method === "GET" &&
                /^\/api\/public\/poems\/[a-z0-9]+(?:-[a-z0-9]+)*$/.test(path)
            ) {
                const slug = path.split("/").pop();
                return await getPublicPoem(request, env, slug);
            }

            if (request.method === "GET" && path === "/api/public/navigation") {
                return await getPublicNavigation(request, env);
            }

            if (
                request.method === "GET" &&
                path === "/api/public/onboarding/welcome"
            ) {
                return await getPublicOnboarding(request, env, "welcome");
            }

            if (
                request.method === "GET" &&
                /^\/api\/public\/map-layers\/[a-z0-9]+(?:-[a-z0-9]+)*$/.test(path)
            ) {
                const slug = path.split("/").pop();
                return await getPublicMapLayer(request, env, slug);
            }

            if (request.method === "GET" && path === "/api/public/sources") {
                return await getPublicSources(request, env, url);
            }

            if (
                request.method === "GET" &&
                path === "/api/public/settings/site"
            ) {
                return await getPublicSiteSettings(request, env);
            }

            if (
                request.method === "GET" &&
                path === "/api/public/permalinks/resolve"
            ) {
                return await getPublicPermalink(request, env, url);
            }

            if (
                request.method === "GET" &&
                /^\/api\/public\/legal\/[a-z0-9]+(?:-[a-z0-9]+)*$/.test(path)
            ) {
                const slug = path.split("/").pop();
                return await getPublicLegalDocument(request, env, slug);
            }

            if (
                request.method === "GET" &&
                path === "/api/public/narrative-steps"
            ) {
                return await listPublicNarrativeSteps(request, env);
            }

            if (
                request.method === "GET" &&
                /^\/api\/public\/map-entry-images\/\d+$/.test(path)
            ) {
                const entryId = Number(path.split("/").pop());
                return await getPublicMapEntryImage(request, env, entryId);
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

            if (request.method === "GET" && path === "/api/admin/map-entries") {
                return await adminListMapEntries(request, env);
            }

            if (request.method === "POST" && path === "/api/admin/map-entries") {
                return await adminCreateMapEntry(request, env);
            }

            if (
                request.method === "PATCH" &&
                /^\/api\/admin\/map-entries\/\d+$/.test(path)
            ) {
                const id = Number(path.split("/").pop());
                return await adminUpdateMapEntry(request, env, id);
            }

            if (
                request.method === "DELETE" &&
                /^\/api\/admin\/map-entries\/\d+$/.test(path)
            ) {
                const id = Number(path.split("/").pop());
                return await adminDeleteMapEntry(request, env, id);
            }

            if (
                request.method === "GET" &&
                path === "/api/admin/narrative-steps"
            ) {
                return await adminListNarrativeSteps(request, env);
            }

            if (
                request.method === "POST" &&
                path === "/api/admin/narrative-steps"
            ) {
                return await adminCreateNarrativeStep(request, env);
            }

            if (
                request.method === "PATCH" &&
                /^\/api\/admin\/narrative-steps\/\d+$/.test(path)
            ) {
                const id = Number(path.split("/").pop());
                return await adminUpdateNarrativeStep(request, env, id);
            }

            if (
                request.method === "DELETE" &&
                /^\/api\/admin\/narrative-steps\/\d+$/.test(path)
            ) {
                const id = Number(path.split("/").pop());
                return await adminDeleteNarrativeStep(request, env, id);
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
                await ensureCmsStorage(env);
                return json(request, env, {
                    ok: true,
                    service: "nnmrcn-rete",
                    privacyVersion: "2026-10-03",
                    contentSchema: 1
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
    },

    async scheduled(_controller, env, ctx) {
        ctx.waitUntil((async () => {
            await ensureContactStorage(env);
            await purgeExpiredContactMessages(env);
            await ensureLocationProfileStorage(env);
            await ensureCmsStorage(env);
        })());
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
            welcome_seen_at,
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
        welcomeRequired: location.welcome_seen_at === null,
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
        expiresAt: session.expires_at,
        welcomeRequired: session.welcome_seen_at === null
    });
}

async function completeWelcome(request, env) {
    const session = await requireSession(request, env);

    if (!session) {
        return unauthorized(request, env);
    }

    await env.DB.prepare(`
        UPDATE locations
        SET welcome_seen_at = COALESCE(welcome_seen_at, ?)
        WHERE id = ?
    `).bind(
        Date.now(),
        session.location_id
    ).run();

    return json(request, env, {
        ok: true,
        welcomeRequired: false
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

async function checkLocationAccess(request, env) {
    const body = await readJson(request);
    const accessToken = String(body?.accessToken || "").trim();

    if (!(await matchesSha256(accessToken, LOCATION_ACCESS_TOKEN_SHA256))) {
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
        SET
            is_visible = ?,
            location_consent_at = ?
        WHERE id = ?
    `).bind(
        body.visible ? 1 : 0,
        body.visible ? Date.now() : null,
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
                    : `Location ${row.id} riservata`,
                username: isOwn ? row.username : "",
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
    const privacyConsent = body.privacyConsent === true;
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

    if (!privacyConsent) {
        return json(request, env, {
            error: "Per inviare la richiesta devi accettare l’informativa sulla privacy."
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

    const safeAddress = sanitizePublicLocationLabel(address);
    const approximatePoint = hasPoint
        ? await approximateCoordinates(
            env,
            lat,
            lon,
            `access-request:${email.toLowerCase()}`
        )
        : null;
    const lines = [
        "Richiesta di codice.",
        `Username: ${username || "non indicato"}`,
        `Via o zona approssimativa: ${safeAddress || "non indicata"}`,
        "Consenso privacy: prestato (versione 2026-10-03)"
    ];

    if (approximatePoint) {
        const coordinates =
            `${approximatePoint.lat.toFixed(6)}, ${approximatePoint.lon.toFixed(6)}`;
        lines.push(`Coordinate approssimative: ${coordinates}`);
        lines.push(
            `Mappa approssimativa: https://www.google.com/maps?q=${approximatePoint.lat.toFixed(6)},${approximatePoint.lon.toFixed(6)}`
        );
    } else {
        lines.push("Coordinate approssimative: non indicate");
    }

    lines.push(
        "Visibilità iniziale: posizione nascosta fino alla scelta esplicita dell’utente",
        "Conservazione: richiesta da cancellare automaticamente entro 30 giorni"
    );

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
    await purgeExpiredContactMessages(env);

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
    await purgeExpiredContactMessages(env);

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
    await purgeExpiredContactMessages(env);

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

async function listPublicMapEntries(request, env) {
    await ensureMapEntryStorage(env);

    return json(request, env, {
        entries: await readMapEntries(env)
    });
}

async function adminListMapEntries(request, env) {
    if (!(await adminAuthorized(request, env))) {
        return unauthorized(request, env);
    }

    await ensureMapEntryStorage(env);

    return json(request, env, {
        entries: await readMapEntries(env)
    });
}

async function adminCreateMapEntry(request, env) {
    if (!(await adminAuthorized(request, env))) {
        return unauthorized(request, env);
    }

    await ensureMapEntryStorage(env);

    const input = normalizeMapEntryInput(
        await readJson(request, MAX_MAP_ENTRY_REQUEST_BYTES)
    );

    if (input.error) {
        return json(request, env, { error: input.error }, 400);
    }

    const now = Date.now();
    const result = await env.DB.prepare(`
        INSERT INTO map_entries (
            name,
            category,
            description,
            lat,
            lon,
            source_url,
            source_label,
            created_at,
            updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
        input.name,
        input.category,
        input.description,
        input.lat,
        input.lon,
        input.sourceUrl,
        input.sourceLabel,
        now,
        now
    ).run();

    const id = Number(result.meta?.last_row_id);
    await updateMapEntryImage(env, id, input.image, input.removeImage, now);
    const entry = await getMapEntryById(env, id);

    return json(request, env, {
        ok: true,
        entry: mapEntryPayload(entry)
    }, 201);
}

async function adminUpdateMapEntry(request, env, entryId) {
    if (!(await adminAuthorized(request, env))) {
        return unauthorized(request, env);
    }

    if (!Number.isInteger(entryId) || entryId <= 0) {
        return json(request, env, { error: "Voce non valida." }, 400);
    }

    await ensureMapEntryStorage(env);

    if (!(await getMapEntryById(env, entryId))) {
        return json(request, env, { error: "Voce non trovata." }, 404);
    }

    const input = normalizeMapEntryInput(
        await readJson(request, MAX_MAP_ENTRY_REQUEST_BYTES)
    );

    if (input.error) {
        return json(request, env, { error: input.error }, 400);
    }

    const now = Date.now();

    await env.DB.prepare(`
        UPDATE map_entries
        SET
            name = ?,
            category = ?,
            description = ?,
            lat = ?,
            lon = ?,
            source_url = ?,
            source_label = ?,
            updated_at = ?
        WHERE id = ?
    `).bind(
        input.name,
        input.category,
        input.description,
        input.lat,
        input.lon,
        input.sourceUrl,
        input.sourceLabel,
        now,
        entryId
    ).run();

    await updateMapEntryImage(
        env,
        entryId,
        input.image,
        input.removeImage,
        now
    );

    return json(request, env, {
        ok: true,
        entry: mapEntryPayload(await getMapEntryById(env, entryId))
    });
}

async function adminDeleteMapEntry(request, env, entryId) {
    if (!(await adminAuthorized(request, env))) {
        return unauthorized(request, env);
    }

    if (!Number.isInteger(entryId) || entryId <= 0) {
        return json(request, env, { error: "Voce non valida." }, 400);
    }

    await ensureMapEntryStorage(env);

    if (!(await getMapEntryById(env, entryId))) {
        return json(request, env, { error: "Voce non trovata." }, 404);
    }

    await env.DB.batch([
        env.DB.prepare(`
            DELETE FROM map_entry_images
            WHERE entry_id = ?
        `).bind(entryId),
        env.DB.prepare(`
            DELETE FROM map_entries
            WHERE id = ?
        `).bind(entryId)
    ]);

    return json(request, env, { ok: true });
}

async function getMapEntryById(env, entryId) {
    return await env.DB.prepare(`
        SELECT
            entry.id,
            entry.name,
            entry.category,
            entry.description,
            entry.lat,
            entry.lon,
            entry.source_url,
            entry.source_label,
            entry.created_at,
            entry.updated_at,
            image.entry_id AS image_entry_id,
            image.updated_at AS image_updated_at
        FROM map_entries entry
        LEFT JOIN map_entry_images image ON image.entry_id = entry.id
        WHERE entry.id = ?
        LIMIT 1
    `).bind(entryId).first();
}

async function readMapEntries(env) {
    const result = await env.DB.prepare(`
        SELECT
            entry.id,
            entry.name,
            entry.category,
            entry.description,
            entry.lat,
            entry.lon,
            entry.source_url,
            entry.source_label,
            entry.created_at,
            entry.updated_at,
            image.entry_id AS image_entry_id,
            image.updated_at AS image_updated_at
        FROM map_entries entry
        LEFT JOIN map_entry_images image ON image.entry_id = entry.id
        ORDER BY entry.name COLLATE NOCASE, entry.id
    `).all();

    return (result.results || []).map(mapEntryPayload);
}

function mapEntryPayload(row) {
    return {
        id: Number(row.id),
        name: row.name,
        category: row.category,
        description: row.description,
        lat: Number(row.lat),
        lon: Number(row.lon),
        sourceUrl: row.source_url,
        sourceLabel: row.source_label,
        createdAt: Number(row.created_at),
        updatedAt: Number(row.updated_at),
        imageUrl: row.image_entry_id === null || row.image_entry_id === undefined
            ? ""
            : `/api/public/map-entry-images/${row.id}?v=${Number(row.image_updated_at)}`
    };
}

function normalizeMapEntryInput(value) {
    const name = String(value?.name || "").trim();
    const category = String(value?.category || "luogo").trim();
    const description = String(value?.description || "").trim();
    const lat = Number(value?.lat);
    const lon = Number(value?.lon);
    const sourceUrl = String(value?.sourceUrl || "").trim();
    let sourceLabel = String(value?.sourceLabel || "").trim();
    const removeImage = value?.removeImage === true;
    const image = value?.image
        ? normalizeMapEntryImage(value.image)
        : null;

    if (image?.error) {
        return image;
    }

    if (image && removeImage) {
        return { error: "Non è possibile aggiungere e rimuovere la fotografia insieme." };
    }

    if (name.length < 2 || name.length > MAX_MAP_ENTRY_NAME_LENGTH) {
        return { error: "Il nome deve contenere da 2 a 160 caratteri." };
    }

    if (!MAP_ENTRY_CATEGORIES.has(category)) {
        return { error: "Categoria non valida." };
    }

    if (description.length > MAX_MAP_ENTRY_DESCRIPTION_LENGTH) {
        return { error: "La descrizione non può superare 3000 caratteri." };
    }

    if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
        return { error: "Latitudine non valida." };
    }

    if (!Number.isFinite(lon) || lon < -180 || lon > 180) {
        return { error: "Longitudine non valida." };
    }

    if (sourceUrl.length > MAX_MAP_ENTRY_SOURCE_URL_LENGTH) {
        return { error: "Il collegamento alla fonte è troppo lungo." };
    }

    if (sourceUrl) {
        try {
            const parsed = new URL(sourceUrl);

            if (!["http:", "https:"].includes(parsed.protocol)) {
                return { error: "Il collegamento deve usare HTTP o HTTPS." };
            }
        } catch (_) {
            return { error: "Il collegamento alla fonte non è valido." };
        }

        sourceLabel ||= "Fonte esterna";
    } else {
        sourceLabel = "";
    }

    if (sourceLabel.length > MAX_MAP_ENTRY_SOURCE_LABEL_LENGTH) {
        return { error: "L’etichetta della fonte è troppo lunga." };
    }

    return {
        name,
        category,
        description,
        lat,
        lon,
        sourceUrl,
        sourceLabel,
        image,
        removeImage
    };
}

function normalizeMapEntryImage(value) {
    const media = validateWikiImageMedia({
        name: value?.name || "fotografia",
        type: value?.type,
        data: value?.data
    });

    if (media.error) {
        return media;
    }

    const bytes = fromBase64(media.data);

    if (bytes.length > MAX_MAP_ENTRY_IMAGE_BYTES) {
        return { error: "La fotografia è troppo grande." };
    }

    return media;
}

async function getPublicPage(request, env, slug) {
    await ensureCmsStorage(env);

    const page = await env.DB.prepare(`
        SELECT id, slug, title, description, updated_at, published_at
        FROM site_pages
        WHERE slug = ? AND status = 'published'
        LIMIT 1
    `).bind(slug).first();

    if (!page) {
        return json(request, env, { error: "Pagina non trovata." }, 404);
    }

    const result = await env.DB.prepare(`
        SELECT id, position, block_type, content_json, updated_at
        FROM page_blocks
        WHERE page_id = ?
        ORDER BY position ASC, id ASC
    `).bind(page.id).all();

    return json(request, env, {
        page: {
            id: page.id,
            slug: page.slug,
            title: page.title,
            description: page.description,
            updatedAt: Number(page.updated_at),
            publishedAt: Number(page.published_at),
            blocks: (result.results || []).map((block) => ({
                id: block.id,
                position: Number(block.position),
                type: block.block_type,
                content: JSON.parse(block.content_json),
                updatedAt: Number(block.updated_at)
            }))
        }
    });
}

async function getPublicPoem(request, env, slug) {
    await ensureCmsStorage(env);

    const poem = await env.DB.prepare(`
        SELECT id, slug, title, subtitle, updated_at, published_at
        FROM poem_works
        WHERE slug = ? AND status = 'published'
        LIMIT 1
    `).bind(slug).first();

    if (!poem) {
        return json(request, env, { error: "Poesia non trovata." }, 404);
    }

    const [sectionResult, lineResult] = await Promise.all([
        env.DB.prepare(`
            SELECT id, position, title, updated_at
            FROM poem_sections
            WHERE poem_id = ?
            ORDER BY position ASC, id ASC
        `).bind(poem.id).all(),
        env.DB.prepare(`
            SELECT
                poem_lines.id,
                poem_lines.section_id,
                poem_lines.position,
                poem_lines.text,
                poem_lines.indent_level,
                poem_lines.metadata_json,
                poem_lines.updated_at
            FROM poem_lines
            INNER JOIN poem_sections
                ON poem_sections.id = poem_lines.section_id
            WHERE poem_sections.poem_id = ?
            ORDER BY
                poem_sections.position ASC,
                poem_lines.position ASC,
                poem_lines.id ASC
        `).bind(poem.id).all()
    ]);
    const linesBySection = new Map();

    for (const line of lineResult.results || []) {
        const lines = linesBySection.get(line.section_id) || [];
        let metadata = {};

        try {
            metadata = JSON.parse(line.metadata_json || "{}");
        } catch (_) {
            metadata = {};
        }

        lines.push({
            id: line.id,
            position: Number(line.position),
            text: line.text,
            indent: Number(line.indent_level),
            metadata,
            updatedAt: Number(line.updated_at)
        });
        linesBySection.set(line.section_id, lines);
    }

    return json(request, env, {
        poem: {
            id: poem.id,
            slug: poem.slug,
            title: poem.title,
            subtitle: poem.subtitle,
            updatedAt: Number(poem.updated_at),
            publishedAt: Number(poem.published_at),
            sections: (sectionResult.results || []).map((section) => ({
                id: section.id,
                position: Number(section.position),
                title: section.title,
                anchor: /^[IVXLCDM]+$/u.test(section.title)
                    ? section.title
                    : section.id,
                updatedAt: Number(section.updated_at),
                lines: linesBySection.get(section.id) || []
            }))
        }
    });
}

async function getPublicNavigation(request, env) {
    await ensureCmsStorage(env);

    const result = await env.DB.prepare(`
        SELECT id, menu_key, position, label, href, visibility, updated_at
        FROM navigation_items
        WHERE status = 'published' AND visibility = 'public'
        ORDER BY menu_key ASC, position ASC, id ASC
    `).all();
    const menus = {};

    for (const row of result.results || []) {
        const items = menus[row.menu_key] || [];
        items.push({
            id: row.id,
            position: Number(row.position),
            label: row.label,
            href: row.href,
            visibility: row.visibility,
            updatedAt: Number(row.updated_at)
        });
        menus[row.menu_key] = items;
    }

    return json(request, env, { menus });
}

async function getPublicOnboarding(request, env, tourKey) {
    await ensureCmsStorage(env);

    const [introRow, stepResult] = await Promise.all([
        env.DB.prepare(`
            SELECT value_json, updated_at
            FROM site_settings
            WHERE setting_key = ?
                AND visibility = 'public'
                AND status = 'published'
            LIMIT 1
        `).bind(`onboarding.${tourKey}.intro`).first(),
        env.DB.prepare(`
            SELECT id, position, title, body, action_json, updated_at
            FROM onboarding_steps
            WHERE tour_key = ? AND status = 'published'
            ORDER BY position ASC, id ASC
        `).bind(tourKey).all()
    ]);

    if (!introRow) {
        return json(request, env, { error: "Tour non trovato." }, 404);
    }

    let intro = {};

    try {
        intro = JSON.parse(introRow.value_json);
    } catch (_) {}

    return json(request, env, {
        intro: {
            title: String(intro.title || ""),
            subtitle: String(intro.subtitle || ""),
            updatedAt: Number(introRow.updated_at)
        },
        steps: (stepResult.results || []).map((row) => {
            let action = {};

            try {
                action = JSON.parse(row.action_json);
            } catch (_) {}

            return {
                id: row.id,
                position: Number(row.position),
                title: row.title,
                description: row.body,
                details: Array.isArray(action.details) ? action.details : [],
                preview: String(action.preview || ""),
                alt: String(action.alt || ""),
                markers: Array.isArray(action.markers) ? action.markers : [],
                updatedAt: Number(row.updated_at)
            };
        })
    });
}

async function getPublicMapLayer(request, env, slug) {
    await ensureCmsStorage(env);

    const layer = await env.DB.prepare(`
        SELECT id, slug, title, description, layer_type, style_json, updated_at
        FROM map_layers
        WHERE slug = ? AND status = 'published'
        LIMIT 1
    `).bind(slug).first();

    if (!layer) {
        return json(request, env, { error: "Livello non trovato." }, 404);
    }

    const result = await env.DB.prepare(`
        SELECT
            id,
            position,
            title,
            description,
            geometry_json,
            properties_json,
            updated_at
        FROM map_features
        WHERE layer_id = ? AND status = 'published'
        ORDER BY position ASC, id ASC
    `).bind(layer.id).all();
    const parseJson = (value, fallback) => {
        try {
            return JSON.parse(value);
        } catch (_) {
            return fallback;
        }
    };

    return json(request, env, {
        layer: {
            id: layer.id,
            slug: layer.slug,
            title: layer.title,
            description: layer.description,
            type: layer.layer_type,
            style: parseJson(layer.style_json, {}),
            updatedAt: Number(layer.updated_at)
        },
        geojson: {
            type: "FeatureCollection",
            name: layer.title,
            features: (result.results || []).map((row) => ({
                type: "Feature",
                id: row.id,
                geometry: parseJson(row.geometry_json, null),
                properties: {
                    ...parseJson(row.properties_json, {}),
                    nome: row.title,
                    descrizione: row.description,
                    cmsPosition: Number(row.position),
                    cmsUpdatedAt: Number(row.updated_at)
                }
            }))
        }
    });
}

async function getPublicSources(request, env, url) {
    await ensureCmsStorage(env);

    const contentType = String(url.searchParams.get("contentType") || "");
    const contentId = String(url.searchParams.get("contentId") || "");
    const allowedTypes = new Set([
        "narrative_step",
        "wiki_entry",
        "map_entry",
        "map_feature"
    ]);

    if (
        !allowedTypes.has(contentType) ||
        !contentId ||
        contentId.length > 160
    ) {
        return json(request, env, { error: "Contenuto non valido." }, 400);
    }

    if (!(await publicSourceTargetExists(env, contentType, contentId))) {
        return json(request, env, { error: "Contenuto non trovato." }, 404);
    }

    const result = await env.DB.prepare(`
        SELECT
            link.position,
            link.context,
            source.id,
            source.source_type,
            source.title,
            source.author,
            source.publication_date,
            source.url,
            source.note,
            source.updated_at
        FROM content_source_links link
        INNER JOIN sources source ON source.id = link.source_id
        WHERE link.content_type = ? AND link.content_id = ?
        ORDER BY link.position ASC, source.id ASC
    `).bind(contentType, contentId).all();

    return json(request, env, {
        sources: (result.results || []).map((row) => ({
            id: row.id,
            position: Number(row.position),
            type: row.source_type,
            title: row.title,
            author: row.author,
            publicationDate: row.publication_date,
            url: row.url,
            note: row.note,
            context: parseJsonValue(row.context, {}),
            updatedAt: Number(row.updated_at)
        }))
    });
}

async function getPublicSiteSettings(request, env) {
    await ensureCmsStorage(env);

    const result = await env.DB.prepare(`
        SELECT setting_key, value_json, updated_at
        FROM site_settings
        WHERE
            setting_key LIKE 'site.%'
            AND visibility = 'public'
            AND status = 'published'
        ORDER BY setting_key ASC
    `).all();
    const settings = {};
    const updatedAt = {};

    for (const row of result.results || []) {
        settings[row.setting_key] = parseJsonValue(row.value_json, {});
        updatedAt[row.setting_key] = Number(row.updated_at);
    }

    return json(request, env, { settings, updatedAt });
}

async function getPublicPermalink(request, env, url) {
    await ensureCmsStorage(env);

    const path = String(url.searchParams.get("path") || "");

    if (!path.startsWith("/") || path.length > 2048) {
        return json(request, env, { error: "Permalink non valido." }, 400);
    }

    const row = await env.DB.prepare(`
        SELECT
            id, path, target_type, target_id, state,
            redirect_path, created_at, updated_at
        FROM permalinks
        WHERE path = ?
        LIMIT 1
    `).bind(path).first();

    if (!row) {
        return json(request, env, { error: "Permalink non trovato." }, 404);
    }

    return json(request, env, {
        permalink: {
            id: row.id,
            path: row.path,
            targetType: row.target_type,
            targetId: row.target_id,
            state: row.state,
            redirectPath: row.redirect_path,
            createdAt: Number(row.created_at),
            updatedAt: Number(row.updated_at)
        }
    });
}

async function getPublicLegalDocument(request, env, slug) {
    await ensureCmsStorage(env);

    const row = await env.DB.prepare(`
        SELECT
            document.id,
            document.slug,
            document.title,
            version.id AS version_id,
            version.version_number,
            version.effective_date,
            version.body_html,
            version.checksum,
            version.published_at
        FROM legal_documents document
        INNER JOIN legal_document_versions version
            ON version.document_id = document.id
            AND version.version_number = document.current_version
        WHERE document.slug = ? AND version.status = 'published'
        LIMIT 1
    `).bind(slug).first();

    if (!row) {
        return json(request, env, { error: "Documento legale non trovato." }, 404);
    }

    return json(request, env, {
        document: {
            id: row.id,
            slug: row.slug,
            title: row.title,
            version: {
                id: row.version_id,
                number: Number(row.version_number),
                effectiveDate: row.effective_date,
                bodyHtml: row.body_html,
                checksum: row.checksum,
                publishedAt: Number(row.published_at)
            }
        }
    });
}

async function publicSourceTargetExists(env, contentType, contentId) {
    if (contentType === "narrative_step") {
        return Boolean(await env.DB.prepare(`
            SELECT id FROM narrative_steps
            WHERE stable_key = ? AND status = 'published'
            LIMIT 1
        `).bind(contentId).first());
    }

    if (!/^[1-9]\d*$/u.test(contentId) && contentType !== "map_feature") {
        return false;
    }

    if (contentType === "wiki_entry") {
        return Boolean(await env.DB.prepare(`
            SELECT id FROM wiki_entries
            WHERE id = ? AND status = 'published'
            LIMIT 1
        `).bind(Number(contentId)).first());
    }

    if (contentType === "map_entry") {
        return Boolean(await env.DB.prepare(`
            SELECT id FROM map_entries WHERE id = ? LIMIT 1
        `).bind(Number(contentId)).first());
    }

    return Boolean(await env.DB.prepare(`
        SELECT feature.id
        FROM map_features feature
        INNER JOIN map_layers layer ON layer.id = feature.layer_id
        WHERE
            feature.id = ?
            AND feature.status = 'published'
            AND layer.status = 'published'
        LIMIT 1
    `).bind(contentId).first());
}

function parseJsonValue(value, fallback) {
    try {
        return JSON.parse(value);
    } catch (_) {
        return fallback;
    }
}

async function listPublicNarrativeSteps(request, env) {
    await ensureNarrativeStorage(env);

    return json(request, env, {
        steps: await readNarrativeSteps(env, false)
    });
}

async function adminListNarrativeSteps(request, env) {
    if (!(await adminAuthorized(request, env))) {
        return unauthorized(request, env);
    }

    await ensureNarrativeStorage(env);

    return json(request, env, {
        steps: await readNarrativeSteps(env, true)
    });
}

async function adminCreateNarrativeStep(request, env) {
    if (!(await adminAuthorized(request, env))) {
        return unauthorized(request, env);
    }

    await ensureNarrativeStorage(env);

    const input = normalizeNarrativeStepInput(
        await readJson(request, MAX_NARRATIVE_STEP_REQUEST_BYTES)
    );

    if (input.error) {
        return json(request, env, { error: input.error }, 400);
    }

    const now = Date.now();
    const stableKey = await uniqueNarrativeStepKey(env, input.label);
    const publishedAt = input.status === "published" ? now : null;
    const result = await env.DB.prepare(`
        INSERT INTO narrative_steps (
            stable_key,
            position,
            verse,
            label,
            title,
            title_url,
            lat,
            lon,
            zoom,
            explanation,
            sources_json,
            status,
            created_at,
            updated_at,
            published_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
        stableKey,
        input.position,
        input.verse,
        input.label,
        input.title,
        input.titleUrl,
        input.lat,
        input.lon,
        input.zoom,
        input.text,
        JSON.stringify(input.sources),
        input.status,
        now,
        now,
        publishedAt
    ).run();

    const id = Number(result.meta?.last_row_id);

    return json(request, env, {
        ok: true,
        step: narrativeStepPayload(await getNarrativeStepById(env, id))
    }, 201);
}

async function adminUpdateNarrativeStep(request, env, stepId) {
    if (!(await adminAuthorized(request, env))) {
        return unauthorized(request, env);
    }

    if (!Number.isInteger(stepId) || stepId <= 0) {
        return json(request, env, { error: "Tappa non valida." }, 400);
    }

    await ensureNarrativeStorage(env);

    const existing = await getNarrativeStepById(env, stepId);

    if (!existing) {
        return json(request, env, { error: "Tappa non trovata." }, 404);
    }

    const input = normalizeNarrativeStepInput(
        await readJson(request, MAX_NARRATIVE_STEP_REQUEST_BYTES)
    );

    if (input.error) {
        return json(request, env, { error: input.error }, 400);
    }

    const now = Date.now();
    const publishedAt = input.status === "published"
        ? Number(existing.published_at) || now
        : Number(existing.published_at) || null;

    await env.DB.prepare(`
        UPDATE narrative_steps
        SET
            position = ?,
            verse = ?,
            label = ?,
            title = ?,
            title_url = ?,
            lat = ?,
            lon = ?,
            zoom = ?,
            explanation = ?,
            sources_json = ?,
            status = ?,
            updated_at = ?,
            published_at = ?
        WHERE id = ?
    `).bind(
        input.position,
        input.verse,
        input.label,
        input.title,
        input.titleUrl,
        input.lat,
        input.lon,
        input.zoom,
        input.text,
        JSON.stringify(input.sources),
        input.status,
        now,
        publishedAt,
        stepId
    ).run();

    return json(request, env, {
        ok: true,
        step: narrativeStepPayload(await getNarrativeStepById(env, stepId))
    });
}

async function adminDeleteNarrativeStep(request, env, stepId) {
    if (!(await adminAuthorized(request, env))) {
        return unauthorized(request, env);
    }

    if (!Number.isInteger(stepId) || stepId <= 0) {
        return json(request, env, { error: "Tappa non valida." }, 400);
    }

    await ensureNarrativeStorage(env);

    const existing = await getNarrativeStepById(env, stepId);

    if (!existing) {
        return json(request, env, { error: "Tappa non trovata." }, 404);
    }

    if (Number(existing.published_at)) {
        await env.DB.prepare(`
            UPDATE narrative_steps
            SET status = 'draft', updated_at = ?
            WHERE id = ?
        `).bind(Date.now(), stepId).run();

        return json(request, env, {
            ok: true,
            archived: true,
            step: narrativeStepPayload(await getNarrativeStepById(env, stepId))
        });
    }

    await env.DB.prepare(`
        DELETE FROM narrative_steps
        WHERE id = ?
    `).bind(stepId).run();

    return json(request, env, { ok: true, deleted: true });
}

async function getNarrativeStepById(env, stepId) {
    return await env.DB.prepare(`
        SELECT *
        FROM narrative_steps
        WHERE id = ?
        LIMIT 1
    `).bind(stepId).first();
}

async function readNarrativeSteps(env, includeDrafts) {
    const where = includeDrafts ? "" : "WHERE status = 'published'";
    const result = await env.DB.prepare(`
        SELECT *
        FROM narrative_steps
        ${where}
        ORDER BY position, id
    `).all();

    return (result.results || []).map(narrativeStepPayload);
}

function narrativeStepPayload(row) {
    let sources = [];

    try {
        const parsed = JSON.parse(row.sources_json || "[]");
        sources = Array.isArray(parsed) ? parsed : [];
    } catch (_) {
        sources = [];
    }

    return {
        id: Number(row.id),
        key: row.stable_key,
        position: Number(row.position),
        verse: row.verse,
        label: row.label,
        title: row.title,
        titleUrl: row.title_url,
        lat: Number(row.lat),
        lon: Number(row.lon),
        zoom: Number(row.zoom),
        text: row.explanation,
        sources,
        published: row.status === "published",
        everPublished: Boolean(Number(row.published_at)),
        createdAt: Number(row.created_at),
        updatedAt: Number(row.updated_at)
    };
}

function normalizeNarrativeStepInput(value) {
    const position = Number(value?.position);
    const verse = String(value?.verse || "").trim();
    const label = String(value?.label || "").trim();
    const title = String(value?.title || "").trim();
    const titleUrl = String(value?.titleUrl || "").trim();
    const lat = Number(value?.lat);
    const lon = Number(value?.lon);
    const zoom = Number(value?.zoom);
    const text = String(value?.text || "").trim();
    const status = value?.published === false ? "draft" : "published";
    const sources = normalizeNarrativeSources(value?.sources);

    if (!Number.isInteger(position) || position < 1 || position > 9999) {
        return { error: "L’ordine deve essere un numero intero da 1 a 9999." };
    }

    if (!verse || verse.length > MAX_NARRATIVE_STEP_VERSE_LENGTH) {
        return { error: "Il riferimento al verso è obbligatorio e non può superare 240 caratteri." };
    }

    if (!label || label.length > MAX_NARRATIVE_STEP_LABEL_LENGTH) {
        return { error: "L’etichetta è obbligatoria e non può superare 160 caratteri." };
    }

    if (!title || title.length > MAX_NARRATIVE_STEP_LABEL_LENGTH) {
        return { error: "Il titolo è obbligatorio e non può superare 160 caratteri." };
    }

    const titleUrlError = validateNarrativeUrl(titleUrl, "Il collegamento del titolo");
    if (titleUrlError) {
        return { error: titleUrlError };
    }

    if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
        return { error: "Latitudine non valida." };
    }

    if (!Number.isFinite(lon) || lon < -180 || lon > 180) {
        return { error: "Longitudine non valida." };
    }

    if (!Number.isInteger(zoom) || zoom < 10 || zoom > 19) {
        return { error: "Lo zoom deve essere un numero intero da 10 a 19." };
    }

    if (!text || text.length > MAX_NARRATIVE_STEP_TEXT_LENGTH) {
        return { error: "La spiegazione è obbligatoria e non può superare 5000 caratteri." };
    }

    if (sources.error) {
        return sources;
    }

    if (!NARRATIVE_STATUSES.has(status)) {
        return { error: "Stato non valido." };
    }

    return {
        position,
        verse,
        label,
        title,
        titleUrl,
        lat,
        lon,
        zoom,
        text,
        sources,
        status
    };
}

function normalizeNarrativeSources(value) {
    if (value === undefined || value === null) {
        return [];
    }

    if (!Array.isArray(value) || value.length > MAX_NARRATIVE_STEP_SOURCES) {
        return { error: "Le fonti della tappa non sono valide." };
    }

    const sources = [];

    for (const item of value) {
        const url = String(item?.url || "").trim();
        const rawTerms = Array.isArray(item?.terms) ? item.terms : [];
        const terms = Array.from(new Set(rawTerms.map((term) =>
            String(term || "").trim()
        ).filter(Boolean)));

        if (!terms.length || terms.length > MAX_NARRATIVE_SOURCE_TERMS) {
            return { error: "Ogni fonte deve avere da 1 a 20 termini collegati." };
        }

        if (terms.some((term) => term.length > 100)) {
            return { error: "Un termine collegato a una fonte è troppo lungo." };
        }

        const urlError = validateNarrativeUrl(url, "Un collegamento alle fonti");
        if (urlError || !url) {
            return { error: urlError || "Ogni fonte deve avere un collegamento." };
        }

        sources.push({ terms, url });
    }

    return sources;
}

function validateNarrativeUrl(value, label) {
    if (!value) {
        return "";
    }

    if (value.length > 2048) {
        return `${label} è troppo lungo.`;
    }

    try {
        const parsed = new URL(value);
        if (!["http:", "https:"].includes(parsed.protocol)) {
            return `${label} deve usare HTTP o HTTPS.`;
        }
    } catch (_) {
        return `${label} non è valido.`;
    }

    return "";
}

async function uniqueNarrativeStepKey(env, label) {
    const root = narrativeStepKey(label) || "tappa";
    let candidate = root;
    let suffix = 2;

    while (await env.DB.prepare(`
        SELECT id FROM narrative_steps WHERE stable_key = ? LIMIT 1
    `).bind(candidate).first()) {
        candidate = `${root}-${suffix}`;
        suffix += 1;
    }

    return candidate;
}

function narrativeStepKey(value) {
    return String(value || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/gu, "")
        .toLocaleLowerCase("it")
        .replace(/[^a-z0-9]+/gu, "-")
        .replace(/^-+|-+$/gu, "")
        .slice(0, 160);
}

async function updateMapEntryImage(env, entryId, image, removeImage, now) {
    if (removeImage) {
        await env.DB.prepare(`
            DELETE FROM map_entry_images
            WHERE entry_id = ?
        `).bind(entryId).run();
        return;
    }

    if (!image) {
        return;
    }

    await env.DB.prepare(`
        INSERT INTO map_entry_images (
            entry_id,
            media_type,
            media_name,
            media_data,
            updated_at
        ) VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(entry_id) DO UPDATE SET
            media_type = excluded.media_type,
            media_name = excluded.media_name,
            media_data = excluded.media_data,
            updated_at = excluded.updated_at
    `).bind(
        entryId,
        image.type,
        image.name,
        image.data,
        now
    ).run();
}

async function getPublicMapEntryImage(request, env, entryId) {
    if (!Number.isInteger(entryId) || entryId <= 0) {
        return json(request, env, { error: "Fotografia non disponibile." }, 404);
    }

    await ensureMapEntryStorage(env);

    const image = await env.DB.prepare(`
        SELECT image.media_type, image.media_data
        FROM map_entry_images image
        INNER JOIN map_entries entry ON entry.id = image.entry_id
        WHERE image.entry_id = ?
        LIMIT 1
    `).bind(entryId).first();

    if (!image?.media_data) {
        return json(request, env, { error: "Fotografia non disponibile." }, 404);
    }

    const bytes = fromBase64(image.media_data);
    const extension = memoryMediaExtension(image.media_type);

    return new Response(bytes, {
        headers: {
            "Content-Type": image.media_type,
            "Content-Length": String(bytes.byteLength),
            "Content-Disposition":
                `inline; filename="luogo-${entryId}.${extension}"`,
            "Cache-Control": "public, max-age=3600",
            "X-Content-Type-Options": "nosniff",
            ...corsHeaders(request, env)
        }
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

async function ensureMapEntryStorage(env) {
    await env.DB.batch(
        MAP_ENTRY_STORAGE_STATEMENTS.map((statement) =>
            env.DB.prepare(statement)
        )
    );
}

async function ensureNarrativeStorage(env) {
    await env.DB.batch(
        NARRATIVE_STORAGE_STATEMENTS.map((statement) =>
            env.DB.prepare(statement)
        )
    );

    const initialized = await env.DB.prepare(`
        SELECT name
        FROM content_initializations
        WHERE name = 'narrative_steps_v1'
        LIMIT 1
    `).first();

    if (initialized) {
        return;
    }

    const now = Date.now();
    const inserts = NARRATIVE_STEP_SEEDS.map((step) =>
        env.DB.prepare(`
            INSERT OR IGNORE INTO narrative_steps (
                stable_key,
                position,
                verse,
                label,
                title,
                title_url,
                lat,
                lon,
                zoom,
                explanation,
                sources_json,
                status,
                created_at,
                updated_at,
                published_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'published', ?, ?, ?)
        `).bind(
            step.key,
            step.position,
            step.verse,
            step.label,
            step.title,
            step.titleUrl,
            step.lat,
            step.lon,
            step.zoom,
            step.text,
            JSON.stringify(step.sources),
            now,
            now,
            now
        )
    );

    inserts.push(env.DB.prepare(`
        INSERT OR IGNORE INTO content_initializations (name, applied_at)
        VALUES ('narrative_steps_v1', ?)
    `).bind(now));

    await env.DB.batch(inserts);
}

async function ensureContactStorage(env) {
    await env.DB.batch(
        CONTACT_STORAGE_STATEMENTS.map((statement) =>
            env.DB.prepare(statement)
        )
    );
}

async function purgeExpiredContactMessages(env, now = Date.now()) {
    await env.DB.prepare(`
        DELETE FROM contact_messages
        WHERE created_at < ?
    `).bind(now - CONTACT_RETENTION_MS).run();
}

async function ensureMemoryStorage(env) {
    await env.DB.batch(
        MEMORY_STORAGE_STATEMENTS.map((statement) =>
            env.DB.prepare(statement)
        )
    );
}

async function ensureCmsStorage(env) {
    let initialization = cmsStorageInitializations.get(env.DB);

    if (!initialization) {
        initialization = initializeCmsStorage(env).catch((error) => {
            cmsStorageInitializations.delete(env.DB);
            throw error;
        });
        cmsStorageInitializations.set(env.DB, initialization);
    }

    await initialization;
}

async function initializeCmsStorage(env) {
    await env.DB.batch(
        CMS_STORAGE_STATEMENTS.map((statement) =>
            env.DB.prepare(statement)
        )
    );

    await initializePageContent(env);
    await initializePoemContent(env);
    await initializeNavigationContent(env);
    await initializeOnboardingContent(env);
    await initializeMapContent(env);
    await initializeSourceContent(env);
    await initializeSiteSettings(env);
    await initializeLegalContent(env);
    await initializeContentRevisions(env);
    await initializePermalinks(env);
}

async function initializeLegalContent(env) {
    const initialized = await env.DB.prepare(`
        SELECT name
        FROM content_initializations
        WHERE name = 'legal_documents_v1'
        LIMIT 1
    `).first();

    if (initialized) {
        return;
    }

    const document = PRIVACY_DOCUMENT_SEED;
    const version = document.version;
    const now = Date.now();

    await env.DB.batch([
        env.DB.prepare(`
            INSERT OR IGNORE INTO legal_documents (
                id,
                slug,
                title,
                current_version,
                created_at,
                updated_at
            ) VALUES (?, ?, ?, ?, ?, ?)
        `).bind(
            document.id,
            document.slug,
            document.title,
            version.number,
            now,
            now
        ),
        env.DB.prepare(`
            INSERT OR IGNORE INTO legal_document_versions (
                id,
                document_id,
                version_number,
                effective_date,
                body_html,
                checksum,
                status,
                created_at,
                published_at
            ) VALUES (?, ?, ?, ?, ?, ?, 'published', ?, ?)
        `).bind(
            version.id,
            document.id,
            version.number,
            version.effectiveDate,
            version.bodyHtml,
            version.checksum,
            now,
            now
        ),
        env.DB.prepare(`
            INSERT OR IGNORE INTO content_initializations (name, applied_at)
            VALUES ('legal_documents_v1', ?)
        `).bind(now)
    ]);
}

async function initializePermalinks(env) {
    const initialized = await env.DB.prepare(`
        SELECT name
        FROM content_initializations
        WHERE name = 'permalinks_v1'
        LIMIT 1
    `).first();

    if (initialized) {
        return;
    }

    const [wikiEntries, mapEntries, narrativeSteps] = await Promise.all([
        env.DB.prepare(`
            SELECT id, slug
            FROM wiki_entries
            WHERE status = 'published'
            ORDER BY id
        `).all(),
        env.DB.prepare(`
            SELECT id
            FROM map_entries
            ORDER BY id
        `).all(),
        env.DB.prepare(`
            SELECT stable_key, lat, lon, zoom
            FROM narrative_steps
            WHERE status = 'published'
            ORDER BY position, id
        `).all()
    ]);
    const records = [
        ...STATIC_PERMALINK_SEEDS,
        ...POEM_SECTION_PERMALINK_SEEDS
    ];

    for (const entry of wikiEntries.results || []) {
        records.push({
            id: `permalink-wiki-entry-${entry.id}`,
            path: `/voci.html#${encodeURIComponent(entry.slug)}`,
            targetType: "wiki_entry",
            targetId: String(entry.id)
        });
    }

    for (const entry of mapEntries.results || []) {
        records.push(
            {
                id: `permalink-map-entry-qr-${entry.id}`,
                path: `/luogo.html?luogo=${entry.id}`,
                targetType: "map_entry",
                targetId: String(entry.id)
            },
            {
                id: `permalink-map-entry-map-${entry.id}`,
                path: `/progetto.html?luogo=${entry.id}#map`,
                targetType: "map_entry",
                targetId: String(entry.id)
            }
        );
    }

    for (const step of narrativeSteps.results || []) {
        records.push({
            id: `permalink-narrative-${step.stable_key}`,
            path:
                `/progetto.html?narrative=${encodeURIComponent(step.stable_key)}` +
                `&lat=${step.lat}&lon=${step.lon}&zoom=${step.zoom}`,
            targetType: "narrative_step",
            targetId: step.stable_key
        });
    }

    const now = Date.now();
    const statements = records.map((record) => env.DB.prepare(`
        INSERT OR IGNORE INTO permalinks (
            id,
            path,
            target_type,
            target_id,
            state,
            redirect_path,
            created_at,
            updated_at
        ) VALUES (?, ?, ?, ?, 'active', NULL, ?, ?)
    `).bind(
        record.id,
        record.path,
        record.targetType,
        record.targetId,
        now,
        now
    ));

    statements.push(env.DB.prepare(`
        INSERT OR IGNORE INTO content_initializations (name, applied_at)
        VALUES ('permalinks_v1', ?)
    `).bind(now));

    await env.DB.batch(statements);
}

async function initializePageContent(env) {
    const initialized = await env.DB.prepare(`
        SELECT name
        FROM content_initializations
        WHERE name = 'site_pages_v1'
        LIMIT 1
    `).first();

    if (initialized) {
        return;
    }

    const now = Date.now();
    const inserts = [];

    for (const page of PAGE_SEEDS) {
        inserts.push(env.DB.prepare(`
            INSERT OR IGNORE INTO site_pages (
                id,
                slug,
                title,
                description,
                status,
                created_at,
                updated_at,
                published_at
            ) VALUES (?, ?, ?, ?, 'published', ?, ?, ?)
        `).bind(
            page.id,
            page.slug,
            page.title,
            page.description,
            now,
            now,
            now
        ));

        for (const block of page.blocks) {
            inserts.push(env.DB.prepare(`
                INSERT OR IGNORE INTO page_blocks (
                    id,
                    page_id,
                    position,
                    block_type,
                    content_json,
                    created_at,
                    updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?)
            `).bind(
                block.id,
                page.id,
                block.position,
                block.type,
                JSON.stringify(block.content),
                now,
                now
            ));
        }
    }

    inserts.push(env.DB.prepare(`
        INSERT OR IGNORE INTO content_initializations (name, applied_at)
        VALUES ('site_pages_v1', ?)
    `).bind(now));

    await env.DB.batch(inserts);
}

async function initializePoemContent(env) {
    const initialized = await env.DB.prepare(`
        SELECT name
        FROM content_initializations
        WHERE name = 'poem_il_gajo_v1'
        LIMIT 1
    `).first();

    if (initialized) {
        return;
    }

    const now = Date.now();
    const inserts = [env.DB.prepare(`
        INSERT OR IGNORE INTO poem_works (
            id,
            slug,
            title,
            subtitle,
            status,
            created_at,
            updated_at,
            published_at
        ) VALUES (?, ?, ?, ?, 'published', ?, ?, ?)
    `).bind(
        POEM_SEED.id,
        POEM_SEED.slug,
        POEM_SEED.title,
        POEM_SEED.subtitle,
        now,
        now,
        now
    )];

    for (const section of POEM_SEED.sections) {
        inserts.push(env.DB.prepare(`
            INSERT OR IGNORE INTO poem_sections (
                id,
                poem_id,
                position,
                title,
                created_at,
                updated_at
            ) VALUES (?, ?, ?, ?, ?, ?)
        `).bind(
            section.id,
            POEM_SEED.id,
            section.position,
            section.title,
            now,
            now
        ));

        for (const line of section.lines) {
            inserts.push(env.DB.prepare(`
                INSERT OR IGNORE INTO poem_lines (
                    id,
                    section_id,
                    position,
                    text,
                    indent_level,
                    metadata_json,
                    created_at,
                    updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `).bind(
                line.id,
                section.id,
                line.position,
                line.text,
                line.indent,
                JSON.stringify(line.metadata),
                now,
                now
            ));
        }
    }

    for (let index = 0; index < inserts.length; index += 40) {
        await env.DB.batch(inserts.slice(index, index + 40));
    }

    await env.DB.prepare(`
        INSERT OR IGNORE INTO content_initializations (name, applied_at)
        VALUES ('poem_il_gajo_v1', ?)
    `).bind(now).run();
}

async function initializeNavigationContent(env) {
    const initialized = await env.DB.prepare(`
        SELECT name
        FROM content_initializations
        WHERE name = 'navigation_v1'
        LIMIT 1
    `).first();

    if (initialized) {
        return;
    }

    const now = Date.now();
    const inserts = NAVIGATION_SEEDS.map((item) => env.DB.prepare(`
        INSERT OR IGNORE INTO navigation_items (
            id,
            menu_key,
            position,
            label,
            href,
            visibility,
            status,
            created_at,
            updated_at,
            published_at
        ) VALUES (?, ?, ?, ?, ?, ?, 'published', ?, ?, ?)
    `).bind(
        item.id,
        item.menuKey,
        item.position,
        item.label,
        item.href,
        item.visibility,
        now,
        now,
        now
    ));

    inserts.push(env.DB.prepare(`
        INSERT OR IGNORE INTO content_initializations (name, applied_at)
        VALUES ('navigation_v1', ?)
    `).bind(now));

    await env.DB.batch(inserts);
}

async function initializeOnboardingContent(env) {
    const initialized = await env.DB.prepare(`
        SELECT name
        FROM content_initializations
        WHERE name = 'onboarding_welcome_v1'
        LIMIT 1
    `).first();

    if (initialized) {
        return;
    }

    const now = Date.now();
    const inserts = WELCOME_STEP_SEEDS.map((step) => env.DB.prepare(`
        INSERT OR IGNORE INTO onboarding_steps (
            id,
            tour_key,
            position,
            title,
            body,
            action_json,
            status,
            created_at,
            updated_at,
            published_at
        ) VALUES (?, ?, ?, ?, ?, ?, 'published', ?, ?, ?)
    `).bind(
        step.id,
        step.tourKey,
        step.position,
        step.title,
        step.body,
        JSON.stringify(step.action),
        now,
        now,
        now
    ));

    inserts.push(env.DB.prepare(`
        INSERT OR IGNORE INTO site_settings (
            setting_key,
            value_json,
            visibility,
            status,
            updated_at,
            published_at
        ) VALUES (?, ?, 'public', 'published', ?, ?)
    `).bind(
        "onboarding.welcome.intro",
        JSON.stringify(WELCOME_INTRO_SEED),
        now,
        now
    ));
    inserts.push(env.DB.prepare(`
        INSERT OR IGNORE INTO content_initializations (name, applied_at)
        VALUES ('onboarding_welcome_v1', ?)
    `).bind(now));

    await env.DB.batch(inserts);
}

async function initializeMapContent(env) {
    const initialized = await env.DB.prepare(`
        SELECT name
        FROM content_initializations
        WHERE name = 'map_layers_v1'
        LIMIT 1
    `).first();

    if (initialized) {
        return;
    }

    const now = Date.now();
    const inserts = [];

    for (const layer of MAP_LAYER_SEEDS) {
        inserts.push(env.DB.prepare(`
            INSERT OR IGNORE INTO map_layers (
                id,
                slug,
                title,
                description,
                layer_type,
                position,
                style_json,
                status,
                created_at,
                updated_at,
                published_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
            layer.id,
            layer.slug,
            layer.title,
            layer.description,
            layer.layerType,
            layer.position,
            JSON.stringify(layer.style),
            layer.status,
            now,
            now,
            layer.status === "published" ? now : null
        ));

        for (const item of layer.features) {
            inserts.push(env.DB.prepare(`
                INSERT OR IGNORE INTO map_features (
                    id,
                    layer_id,
                    position,
                    title,
                    description,
                    geometry_json,
                    properties_json,
                    status,
                    created_at,
                    updated_at,
                    published_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).bind(
                item.id,
                layer.id,
                item.position,
                item.title,
                item.description,
                JSON.stringify(item.geometry),
                JSON.stringify(item.properties),
                item.status,
                now,
                now,
                item.status === "published" ? now : null
            ));
        }
    }

    inserts.push(env.DB.prepare(`
        INSERT OR IGNORE INTO content_initializations (name, applied_at)
        VALUES ('map_layers_v1', ?)
    `).bind(now));

    for (let index = 0; index < inserts.length; index += 40) {
        await env.DB.batch(inserts.slice(index, index + 40));
    }
}

async function initializeSourceContent(env) {
    const initialized = await env.DB.prepare(`
        SELECT name
        FROM content_initializations
        WHERE name = 'shared_sources_v1'
        LIMIT 1
    `).first();

    if (initialized) {
        return;
    }

    await ensureNarrativeStorage(env);
    await ensureWikiStorage(env);
    await ensureMapEntryStorage(env);

    const now = Date.now();
    const statements = SHARED_SOURCE_SEEDS.map((source) =>
        sourceInsertStatement(env, source, now)
    );
    const [narrativeResult, wikiResult, mapEntryResult, mapFeatureResult] =
        await Promise.all([
            env.DB.prepare(`
                SELECT stable_key, sources_json
                FROM narrative_steps
                ORDER BY id
            `).all(),
            env.DB.prepare(`
                SELECT id, body
                FROM wiki_entries
                ORDER BY id
            `).all(),
            env.DB.prepare(`
                SELECT id, name, source_url, source_label
                FROM map_entries
                WHERE source_url <> ''
                ORDER BY id
            `).all(),
            env.DB.prepare(`
                SELECT id, title, properties_json
                FROM map_features
                ORDER BY layer_id, position, id
            `).all()
        ]);

    for (const row of narrativeResult.results || []) {
        const sources = parseJsonValue(row.sources_json, []).map((source) => ({
            title: source.terms?.[0] || source.url,
            url: source.url,
            context: { terms: source.terms || [] }
        }));
        statements.push(...await sourceLinkStatements(
            env,
            "narrative_step",
            row.stable_key,
            sources,
            now
        ));
    }

    for (const row of wikiResult.results || []) {
        statements.push(...await sourceLinkStatements(
            env,
            "wiki_entry",
            String(row.id),
            extractWikiSourceCitations(row.body),
            now
        ));
    }

    for (const row of mapEntryResult.results || []) {
        statements.push(...await sourceLinkStatements(
            env,
            "map_entry",
            String(row.id),
            [{
                title: row.source_label || row.name,
                url: row.source_url,
                context: { label: row.source_label || "" }
            }],
            now
        ));
    }

    for (const row of mapFeatureResult.results || []) {
        const properties = parseJsonValue(row.properties_json, {});
        const sources = [
            [properties.municipal_url, `${row.title} — Comune di Marcon`, "municipal"],
            [properties.wikipedia_url, `${row.title} — Wikipedia`, "wikipedia"],
            [properties.google_maps_url, `${row.title} — Google Maps`, "map"]
        ].filter(([sourceUrl]) => sourceUrl).map(([sourceUrl, title, role]) => ({
            title,
            url: sourceUrl,
            sourceType: role === "map" ? "map" : "web",
            context: { role }
        }));
        statements.push(...await sourceLinkStatements(
            env,
            "map_feature",
            row.id,
            sources,
            now
        ));
    }

    statements.push(env.DB.prepare(`
        INSERT OR IGNORE INTO content_initializations (name, applied_at)
        VALUES ('shared_sources_v1', ?)
    `).bind(now));

    for (let index = 0; index < statements.length; index += 40) {
        await env.DB.batch(statements.slice(index, index + 40));
    }
}

async function initializeSiteSettings(env) {
    const initialized = await env.DB.prepare(`
        SELECT name
        FROM content_initializations
        WHERE name = 'site_settings_v1'
        LIMIT 1
    `).first();

    if (initialized) {
        return;
    }

    const now = Date.now();
    const statements = SITE_SETTINGS_SEEDS.map((setting) => env.DB.prepare(`
        INSERT OR IGNORE INTO site_settings (
            setting_key,
            value_json,
            visibility,
            status,
            updated_at,
            published_at
        ) VALUES (?, ?, 'public', 'published', ?, ?)
    `).bind(setting.key, JSON.stringify(setting.value), now, now));

    statements.push(env.DB.prepare(`
        INSERT OR IGNORE INTO content_initializations (name, applied_at)
        VALUES ('site_settings_v1', ?)
    `).bind(now));

    await env.DB.batch(statements);
}

async function initializeContentRevisions(env) {
    const initialized = await env.DB.prepare(`
        SELECT name
        FROM content_initializations
        WHERE name = 'content_revisions_v1'
        LIMIT 1
    `).first();

    if (initialized) {
        return;
    }

    const [
        pages,
        blocks,
        works,
        sections,
        lines,
        navigation,
        onboarding,
        settings,
        layers,
        features,
        sources,
        sourceLinks,
        narrative
    ] = await Promise.all([
        env.DB.prepare(`
            SELECT id, slug, title, description, status
            FROM site_pages ORDER BY id
        `).all(),
        env.DB.prepare(`
            SELECT id, page_id, position, block_type, content_json
            FROM page_blocks ORDER BY page_id, position, id
        `).all(),
        env.DB.prepare(`
            SELECT id, slug, title, subtitle, status
            FROM poem_works ORDER BY id
        `).all(),
        env.DB.prepare(`
            SELECT id, poem_id, position, title
            FROM poem_sections ORDER BY poem_id, position, id
        `).all(),
        env.DB.prepare(`
            SELECT id, section_id, position, text, indent_level, metadata_json
            FROM poem_lines ORDER BY section_id, position, id
        `).all(),
        env.DB.prepare(`
            SELECT
                id, menu_key, parent_id, position, label, href,
                visibility, status
            FROM navigation_items ORDER BY menu_key, position, id
        `).all(),
        env.DB.prepare(`
            SELECT id, tour_key, position, title, body, action_json, status
            FROM onboarding_steps ORDER BY tour_key, position, id
        `).all(),
        env.DB.prepare(`
            SELECT setting_key, value_json, visibility, status
            FROM site_settings
            WHERE
                setting_key LIKE 'site.%'
                OR setting_key LIKE 'onboarding.%'
            ORDER BY setting_key
        `).all(),
        env.DB.prepare(`
            SELECT
                id, slug, title, description, layer_type,
                position, style_json, status
            FROM map_layers ORDER BY position, id
        `).all(),
        env.DB.prepare(`
            SELECT
                id, layer_id, position, title, description,
                geometry_json, properties_json, status
            FROM map_features ORDER BY layer_id, position, id
        `).all(),
        env.DB.prepare(`
            SELECT
                id, source_type, title, author,
                publication_date, url, note
            FROM sources ORDER BY id
        `).all(),
        env.DB.prepare(`
            SELECT
                content_type, content_id, source_id, position, context
            FROM content_source_links
            ORDER BY source_id, content_type, content_id, position
        `).all(),
        env.DB.prepare(`
            SELECT
                stable_key, position, verse, label, title, title_url,
                lat, lon, zoom, explanation, sources_json, status
            FROM narrative_steps ORDER BY position, id
        `).all()
    ]);
    const revisions = [];

    for (const page of pages.results || []) {
        revisions.push({
            type: "site_page",
            id: page.id,
            state: page.status,
            snapshot: {
                id: page.id,
                slug: page.slug,
                title: page.title,
                description: page.description,
                blocks: (blocks.results || [])
                    .filter((block) => block.page_id === page.id)
                    .map((block) => ({
                        id: block.id,
                        position: Number(block.position),
                        type: block.block_type,
                        content: parseJsonValue(block.content_json, {})
                    }))
            }
        });
    }

    for (const block of blocks.results || []) {
        const parent = (pages.results || []).find(
            (page) => page.id === block.page_id
        );
        revisions.push({
            type: "page_block",
            id: block.id,
            state: parent?.status,
            snapshot: {
                id: block.id,
                pageId: block.page_id,
                position: Number(block.position),
                type: block.block_type,
                content: parseJsonValue(block.content_json, {})
            }
        });
    }

    for (const work of works.results || []) {
        revisions.push({
            type: "poem_work",
            id: work.id,
            state: work.status,
            snapshot: {
                id: work.id,
                slug: work.slug,
                title: work.title,
                subtitle: work.subtitle,
                sections: (sections.results || [])
                    .filter((section) => section.poem_id === work.id)
                    .map((section) => ({
                        id: section.id,
                        position: Number(section.position),
                        title: section.title,
                        lines: (lines.results || [])
                            .filter((line) => line.section_id === section.id)
                            .map((line) => ({
                                id: line.id,
                                position: Number(line.position),
                                text: line.text,
                                indent: Number(line.indent_level),
                                metadata: parseJsonValue(
                                    line.metadata_json,
                                    {}
                                )
                            }))
                    }))
            }
        });
    }

    for (const section of sections.results || []) {
        const parent = (works.results || []).find(
            (work) => work.id === section.poem_id
        );
        revisions.push({
            type: "poem_section",
            id: section.id,
            state: parent?.status,
            snapshot: {
                id: section.id,
                poemId: section.poem_id,
                position: Number(section.position),
                title: section.title
            }
        });
    }

    for (const line of lines.results || []) {
        const section = (sections.results || []).find(
            (item) => item.id === line.section_id
        );
        const work = (works.results || []).find(
            (item) => item.id === section?.poem_id
        );
        revisions.push({
            type: "poem_line",
            id: line.id,
            state: work?.status,
            snapshot: {
                id: line.id,
                sectionId: line.section_id,
                position: Number(line.position),
                text: line.text,
                indent: Number(line.indent_level),
                metadata: parseJsonValue(line.metadata_json, {})
            }
        });
    }

    for (const item of navigation.results || []) {
        revisions.push({
            type: "navigation_item",
            id: item.id,
            state: item.status,
            snapshot: {
                id: item.id,
                menuKey: item.menu_key,
                parentId: item.parent_id,
                position: Number(item.position),
                label: item.label,
                href: item.href,
                visibility: item.visibility
            }
        });
    }

    for (const step of onboarding.results || []) {
        revisions.push({
            type: "onboarding_step",
            id: step.id,
            state: step.status,
            snapshot: {
                id: step.id,
                tourKey: step.tour_key,
                position: Number(step.position),
                title: step.title,
                body: step.body,
                action: parseJsonValue(step.action_json, {})
            }
        });
    }

    for (const setting of settings.results || []) {
        revisions.push({
            type: "site_setting",
            id: setting.setting_key,
            state: setting.status,
            snapshot: {
                key: setting.setting_key,
                value: parseJsonValue(setting.value_json, {}),
                visibility: setting.visibility
            }
        });
    }

    for (const layer of layers.results || []) {
        revisions.push({
            type: "map_layer",
            id: layer.id,
            state: layer.status,
            snapshot: {
                id: layer.id,
                slug: layer.slug,
                title: layer.title,
                description: layer.description,
                type: layer.layer_type,
                position: Number(layer.position),
                style: parseJsonValue(layer.style_json, {}),
                features: (features.results || [])
                    .filter((feature) => feature.layer_id === layer.id)
                    .map((feature) => ({
                        id: feature.id,
                        position: Number(feature.position),
                        title: feature.title,
                        description: feature.description,
                        geometry: parseJsonValue(
                            feature.geometry_json,
                            null
                        ),
                        properties: parseJsonValue(
                            feature.properties_json,
                            {}
                        ),
                        status: feature.status
                    }))
            }
        });
    }

    for (const feature of features.results || []) {
        revisions.push({
            type: "map_feature",
            id: feature.id,
            state: feature.status,
            snapshot: {
                id: feature.id,
                layerId: feature.layer_id,
                position: Number(feature.position),
                title: feature.title,
                description: feature.description,
                geometry: parseJsonValue(feature.geometry_json, null),
                properties: parseJsonValue(feature.properties_json, {})
            }
        });
    }

    for (const source of sources.results || []) {
        revisions.push({
            type: "source",
            id: source.id,
            state: "published",
            snapshot: {
                id: source.id,
                type: source.source_type,
                title: source.title,
                author: source.author,
                publicationDate: source.publication_date,
                url: source.url,
                note: source.note,
                links: (sourceLinks.results || [])
                    .filter((link) => link.source_id === source.id)
                    .map((link) => ({
                        contentType: link.content_type,
                        contentId: link.content_id,
                        position: Number(link.position),
                        context: parseJsonValue(link.context, {})
                    }))
            }
        });
    }

    for (const step of narrative.results || []) {
        revisions.push({
            type: "narrative_step",
            id: step.stable_key,
            state: step.status,
            snapshot: {
                key: step.stable_key,
                position: Number(step.position),
                verse: step.verse,
                label: step.label,
                title: step.title,
                titleUrl: step.title_url,
                lat: Number(step.lat),
                lon: Number(step.lon),
                zoom: Number(step.zoom),
                text: step.explanation,
                sources: parseJsonValue(step.sources_json, [])
            }
        });
    }

    const now = Date.now();
    const statements = revisions.map((revision) => env.DB.prepare(`
        INSERT OR IGNORE INTO content_revisions (
            entity_type,
            entity_id,
            revision_number,
            snapshot_json,
            publication_state,
            created_at
        ) VALUES (?, ?, 1, ?, ?, ?)
    `).bind(
        revision.type,
        revision.id,
        JSON.stringify(revision.snapshot),
        revisionState(revision.state),
        now
    ));

    statements.push(env.DB.prepare(`
        INSERT OR IGNORE INTO content_initializations (name, applied_at)
        VALUES ('content_revisions_v1', ?)
    `).bind(now));

    for (let index = 0; index < statements.length; index += 40) {
        await env.DB.batch(statements.slice(index, index + 40));
    }
}

function revisionState(value) {
    return ["draft", "published", "archived"].includes(value)
        ? value
        : "draft";
}

function sourceInsertStatement(env, source, now) {
    return env.DB.prepare(`
        INSERT OR IGNORE INTO sources (
            id,
            source_type,
            title,
            author,
            publication_date,
            url,
            note,
            created_at,
            updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
        source.id,
        source.sourceType || "web",
        source.title,
        source.author || "",
        source.publicationDate || "",
        source.url || "",
        source.note || "",
        now,
        now
    );
}

async function sourceLinkStatements(env, contentType, contentId, rawSources, now) {
    const statements = [];
    const unique = new Map();

    for (const raw of rawSources) {
        const source = normalizeSharedSource(raw);

        if (!source) {
            continue;
        }

        source.id = await sharedSourceId(source);
        const existing = unique.get(source.id);

        if (existing) {
            existing.occurrences += 1;
            continue;
        }

        unique.set(source.id, { source, occurrences: 1 });
    }

    let position = 0;
    for (const { source, occurrences } of unique.values()) {
        position += 1;
        statements.push(sourceInsertStatement(env, source, now));
        const context = {
            ...(source.context || {}),
            ...(occurrences > 1 ? { occurrences } : {})
        };
        const serializedContext = JSON.stringify(context);
        statements.push(env.DB.prepare(`
            INSERT OR IGNORE INTO content_source_links (
                content_type,
                content_id,
                source_id,
                position,
                context
            ) VALUES (?, ?, ?, ?, ?)
        `).bind(
            contentType,
            contentId,
            source.id,
            position,
            serializedContext.length <= 1000 ? serializedContext : "{}"
        ));
    }

    return statements;
}

function normalizeSharedSource(value) {
    const title = String(value?.title || "").trim();
    const url = String(value?.url || "").trim();

    if (!title) {
        return null;
    }

    return {
        sourceType: value?.sourceType || (url ? "web" : "book"),
        title,
        author: String(value?.author || "").trim(),
        publicationDate: String(value?.publicationDate || "").trim(),
        url,
        note: String(value?.note || "").trim(),
        context: value?.context || {}
    };
}

async function sharedSourceId(source) {
    if (source.url && SHARED_SOURCE_IDS_BY_URL[source.url]) {
        return SHARED_SOURCE_IDS_BY_URL[source.url];
    }

    const identity = source.url
        ? `url:${source.url}`
        : `record:${source.title}\n${source.author}\n${source.publicationDate}`;
    const digest = await crypto.subtle.digest(
        "SHA-256",
        new TextEncoder().encode(identity)
    );
    const hex = Array.from(new Uint8Array(digest), (byte) =>
        byte.toString(16).padStart(2, "0")
    ).join("");

    return `source-${hex.slice(0, 32)}`;
}

function extractWikiSourceCitations(body) {
    const matches = String(body || "").matchAll(/\[fonte:([^\]\n]+)\]/gu);
    const sources = [];

    for (const match of matches) {
        const parts = match[1].split("|");

        if (parts.length !== 4) {
            continue;
        }

        try {
            const [url, title, author, publicationDate] = parts.map((part) =>
                decodeURIComponent(part).trim()
            );

            if (title) {
                sources.push({
                    title,
                    author,
                    publicationDate,
                    url,
                    context: { title, author, publicationDate }
                });
            }
        } catch (_) {}
    }

    return sources;
}

async function ensureMayorStorage(env) {
    let initialization = mayorStorageInitializations.get(env.DB);

    if (!initialization) {
        initialization = initializeMayorStorage(env).catch((error) => {
            mayorStorageInitializations.delete(env.DB);
            throw error;
        });
        mayorStorageInitializations.set(env.DB, initialization);
    }

    await initialization;
}

async function initializeMayorStorage(env) {
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

    await env.DB.prepare(`
        CREATE TRIGGER IF NOT EXISTS locations_private_by_default
        AFTER INSERT ON locations
        FOR EACH ROW
        WHEN NEW.is_visible <> 0
        BEGIN
            UPDATE locations
            SET is_visible = 0
            WHERE id = NEW.id;
        END
    `).run();

    await env.DB.prepare(`
        UPDATE locations
        SET is_visible = 0
        WHERE location_consent_at IS NULL AND is_visible <> 0
    `).run();

    await normalizeLocationRecords(env);

    await env.DB.prepare(`
        CREATE UNIQUE INDEX IF NOT EXISTS idx_locations_street_order
        ON locations(street_name, street_order)
        WHERE street_name <> '' AND street_order > 0
    `).run();
}

async function normalizeLocationRecords(env) {
    if (!env.PASSWORD_PEPPER) {
        throw new Error("PASSWORD_PEPPER secret missing.");
    }

    const result = await env.DB.prepare(`
        SELECT
            id,
            address,
            street_name,
            street_order,
            lat,
            lon,
            privacy_safe
        FROM locations
        ORDER BY id
    `).all();
    const rows = result.results || [];

    if (!rows.length) {
        return;
    }

    const streetGroups = new Map();
    const normalizedRows = [];

    for (const row of rows) {
        const proposedStreet = extractLocationStreet(
            row.street_name || row.address
        );
        const streetKey = normalizeLocationStreetKey(proposedStreet);
        let group = streetGroups.get(streetKey);

        if (!group) {
            group = {
                name: proposedStreet,
                count: 0
            };
            streetGroups.set(streetKey, group);
        }

        group.count += 1;

        let lat = Number(row.lat);
        let lon = Number(row.lon);

        if (Number(row.privacy_safe) !== 1) {
            const approximatePoint = await approximateCoordinates(
                env,
                lat,
                lon,
                `location:${row.id}`
            );

            lat = approximatePoint.lat;
            lon = approximatePoint.lon;
        }

        normalizedRows.push({
            id: Number(row.id),
            address: formatLocationLabel(group.name, group.count),
            streetName: group.name,
            streetOrder: group.count,
            lat,
            lon,
            privacySafe: 1
        });
    }

    const requiresUpdate = normalizedRows.some((row, index) => {
        const current = rows[index];

        return current.address !== row.address ||
            current.street_name !== row.streetName ||
            Number(current.street_order) !== row.streetOrder ||
            Number(current.lat) !== row.lat ||
            Number(current.lon) !== row.lon ||
            Number(current.privacy_safe) !== row.privacySafe;
    });

    if (!requiresUpdate) {
        return;
    }

    const temporaryStatements = normalizedRows.map((row) =>
        env.DB.prepare(`
            UPDATE locations
            SET
                address = ?,
                street_name = '',
                street_order = 0
            WHERE id = ?
        `).bind(
            `__nnmrcn_location_${row.id}__`,
            row.id
        )
    );
    const finalStatements = normalizedRows.map((row) =>
        env.DB.prepare(`
            UPDATE locations
            SET
                address = ?,
                street_name = ?,
                street_order = ?,
                lat = ?,
                lon = ?,
                privacy_safe = 1
            WHERE id = ?
        `).bind(
            row.address,
            row.streetName,
            row.streetOrder,
            row.lat,
            row.lon,
            row.id
        )
    );

    await env.DB.batch([
        ...temporaryStatements,
        ...finalStatements
    ]);
}

function extractLocationStreet(value) {
    const withoutLegacyNumber = String(value || "")
        .trim()
        .replace(
            /\s*[·•]\s*location\s+\d+\s*$/iu,
            ""
        );

    return sanitizePublicLocationLabel(withoutLegacyNumber) || "Marcon";
}

function normalizeLocationStreetKey(value) {
    return String(value || "")
        .normalize("NFKC")
        .toLocaleLowerCase("it")
        .replace(/[.‘’'`´]/gu, "")
        .replace(/\s+/gu, " ")
        .trim();
}

function formatLocationLabel(streetName, streetOrder) {
    const suffix = ` · location ${streetOrder}`;
    const availableLength = Math.max(
        1,
        MAX_LOCATION_ADDRESS_LENGTH - suffix.length
    );
    const safeStreet = String(streetName || "Marcon")
        .slice(0, availableLength)
        .trim() || "Marcon";

    return `${safeStreet}${suffix}`;
}

function sanitizePublicLocationLabel(value) {
    return String(value || "")
        .normalize("NFKC")
        .trim()
        .replace(EXPLICIT_CIVIC_NUMBER_PATTERN, "")
        .replace(CIVIC_BEFORE_LOCALITY_PATTERN, "$1")
        .replace(
            CIVIC_BEFORE_BOUNDARY_PATTERN,
            (match, offset, input) =>
                NUMBERED_ROUTE_PREFIX_PATTERN.test(
                    input.slice(0, offset)
                ) ? match : ""
        )
        .replace(/\s*,\s*/gu, ", ")
        .replace(/\s{2,}/gu, " ")
        .replace(/^[,\s]+|[,\s]+$/gu, "")
        .slice(0, MAX_LOCATION_ADDRESS_LENGTH);
}

async function approximateCoordinates(env, lat, lon, seed) {
    if (!env.PASSWORD_PEPPER) {
        throw new Error("PASSWORD_PEPPER secret missing.");
    }

    const digest = await hmacHex(
        env.PASSWORD_PEPPER,
        `location-privacy:${seed}:${Number(lat).toFixed(6)}:${Number(lon).toFixed(6)}`
    );
    const distanceRatio = parseInt(digest.slice(0, 8), 16) / 0xffffffff;
    const angleRatio = parseInt(digest.slice(8, 16), 16) / 0xffffffff;
    const distance = LOCATION_MIN_SHIFT_METERS +
        distanceRatio * (LOCATION_MAX_SHIFT_METERS - LOCATION_MIN_SHIFT_METERS);
    const angle = angleRatio * Math.PI * 2;
    const latRadians = Number(lat) * Math.PI / 180;
    const latOffset = distance * Math.cos(angle) / 111320;
    const lonScale = Math.max(Math.abs(Math.cos(latRadians)), 0.01);
    const lonOffset = distance * Math.sin(angle) / (111320 * lonScale);

    return {
        lat: Math.max(-90, Math.min(90, Number(lat) + latOffset)),
        lon: Math.max(-180, Math.min(180, Number(lon) + lonOffset))
    };
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
    await purgeExpiredContactMessages(env);
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
            l.is_visible,
            l.welcome_seen_at
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

    if (!session) {
        return null;
    }

    const renewalThreshold =
        now + SESSION_TTL_MS - SESSION_RENEWAL_INTERVAL_MS;

    if (Number(session.expires_at) <= renewalThreshold) {
        const expiresAt = now + SESSION_TTL_MS;

        await env.DB.prepare(`
            UPDATE sessions
            SET expires_at = ?
            WHERE session_hash = ?
        `).bind(
            expiresAt,
            sessionHash
        ).run();

        session.expires_at = expiresAt;
    }

    return session;
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
