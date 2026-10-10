const BACKUP_FORMAT = "nnmrcn-cms-backup";
const BACKUP_VERSION = 1;
const MAX_BACKUP_MEDIA_BYTES = 48 * 1024 * 1024;
const MAX_BACKUP_MEDIA_OBJECTS = 512;

// Deliberately excludes authentication, sessions, contacts, messages, location
// credentials and rate-limit hashes. Those operational/private records are not
// CMS content and must not silently leave Cloudflare through a browser export.
export const CMS_BACKUP_TABLES = Object.freeze([
    "content_initializations",
    "site_pages",
    "page_blocks",
    "poem_works",
    "poem_sections",
    "poem_lines",
    "navigation_items",
    "onboarding_steps",
    "site_settings",
    "sources",
    "content_source_links",
    "map_layers",
    "map_features",
    "legal_documents",
    "legal_document_versions",
    "content_revisions",
    "permalinks",
    "narrative_steps",
    "wiki_entries",
    "wiki_entry_revisions",
    "wiki_entry_images",
    "map_entries",
    "map_entry_images",
    "cms_documents",
    "media_assets"
]);

export async function createCmsBackup(env, now = Date.now()) {
    const tables = [];

    for (const name of CMS_BACKUP_TABLES) {
        const result = await env.DB.prepare(
            `SELECT * FROM "${name}" ORDER BY rowid`
        ).all();
        tables.push({ name, rows: result.results || [] });
    }

    const mediaTable = tables.find((table) => table.name === "media_assets");
    const mediaRows = mediaTable?.rows || [];
    const objectKeys = [...new Set(mediaRows.map((row) => row.object_key))];

    if (objectKeys.length > MAX_BACKUP_MEDIA_OBJECTS) {
        throw new CmsBackupLimitError(
            `L'archivio contiene più di ${MAX_BACKUP_MEDIA_OBJECTS} oggetti R2.`
        );
    }

    const media = [];
    let totalMediaBytes = 0;

    for (const key of objectKeys) {
        const metadata = mediaRows.find((row) => row.object_key === key);
        const object = await env.MEDIA?.get(key);
        if (!object) {
            throw new CmsBackupIntegrityError(
                `Oggetto R2 mancante per il catalogo D1: ${key}`
            );
        }

        const bytes = new Uint8Array(await new Response(object.body).arrayBuffer());
        totalMediaBytes += bytes.byteLength;
        if (totalMediaBytes > MAX_BACKUP_MEDIA_BYTES) {
            throw new CmsBackupLimitError(
                "I media superano il limite di 48 MiB dell'esportazione dal pannello."
            );
        }

        const checksum = await sha256Hex(bytes);
        if (checksum !== metadata.checksum || bytes.byteLength !== metadata.byte_size) {
            throw new CmsBackupIntegrityError(
                `Oggetto R2 non coerente con il catalogo D1: ${key}`
            );
        }

        media.push({
            key,
            mediaType: metadata.media_type,
            byteSize: bytes.byteLength,
            checksum,
            data: bytesToBase64(bytes)
        });
    }

    const payload = {
        format: BACKUP_FORMAT,
        version: BACKUP_VERSION,
        createdAt: new Date(now).toISOString(),
        scope: "cms-content-and-media",
        privacy: {
            excludesAuthentication: true,
            excludesMessagesContactsAndLocations: true
        },
        database: { tables },
        media: {
            objectCount: media.length,
            totalBytes: totalMediaBytes,
            objects: media
        }
    };

    return {
        ...payload,
        integrity: {
            algorithm: "SHA-256",
            checksum: await sha256Text(JSON.stringify(payload))
        }
    };
}

export function cmsBackupFileName(now = Date.now()) {
    return `nnmrcn-cms-${new Date(now).toISOString().slice(0, 10)}.json`;
}

export class CmsBackupIntegrityError extends Error {}
export class CmsBackupLimitError extends Error {}

async function sha256Text(value) {
    return sha256Hex(new TextEncoder().encode(value));
}

async function sha256Hex(bytes) {
    const digest = await crypto.subtle.digest("SHA-256", bytes);
    return Array.from(new Uint8Array(digest), (byte) =>
        byte.toString(16).padStart(2, "0")
    ).join("");
}

function bytesToBase64(bytes) {
    const chunks = [];
    const chunkSize = 0x8000;
    for (let offset = 0; offset < bytes.length; offset += chunkSize) {
        chunks.push(String.fromCharCode(...bytes.subarray(offset, offset + chunkSize)));
    }
    return btoa(chunks.join(""));
}
