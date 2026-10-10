const BACKUP_FORMAT = "nnmrcn-cms-backup";
const BACKUP_VERSION = 1;
const MAX_BACKUP_MEDIA_BYTES = 48 * 1024 * 1024;
const MAX_BACKUP_MEDIA_OBJECTS = 512;
const MAX_BACKUP_ROWS = 50000;

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
    const mediaRows = (mediaTable?.rows || []).filter(
        (row) => row.owner_type !== "memory"
    );
    if (mediaTable) mediaTable.rows = mediaRows;
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

export async function validateCmsBackup(backup) {
    if (!backup || typeof backup !== "object" || Array.isArray(backup)) {
        throw new CmsBackupValidationError("Il file non contiene un archivio JSON valido.");
    }
    if (backup.format !== BACKUP_FORMAT || backup.version !== BACKUP_VERSION) {
        throw new CmsBackupValidationError("Formato o versione del backup non supportati.");
    }
    if (backup.scope !== "cms-content-and-media") {
        throw new CmsBackupValidationError("Il backup non appartiene al perimetro CMS previsto.");
    }
    if (!backup.integrity || backup.integrity.algorithm !== "SHA-256") {
        throw new CmsBackupValidationError("Firma di integrità del backup assente.");
    }

    const { integrity, ...payload } = backup;
    const archiveChecksum = await sha256Text(JSON.stringify(payload));
    if (archiveChecksum !== integrity.checksum) {
        throw new CmsBackupIntegrityError("Il checksum complessivo del backup non corrisponde.");
    }

    const tables = backup.database?.tables;
    if (!Array.isArray(tables) || tables.length !== CMS_BACKUP_TABLES.length) {
        throw new CmsBackupValidationError("L'elenco delle tabelle CMS è incompleto.");
    }
    const tableNames = tables.map((table) => table?.name);
    if (
        new Set(tableNames).size !== CMS_BACKUP_TABLES.length ||
        CMS_BACKUP_TABLES.some((name) => !tableNames.includes(name))
    ) {
        throw new CmsBackupValidationError("Le tabelle CMS non coincidono con il formato atteso.");
    }

    let rowCount = 0;
    for (const table of tables) {
        if (!Array.isArray(table.rows)) {
            throw new CmsBackupValidationError(`Righe non valide nella tabella ${table.name}.`);
        }
        rowCount += table.rows.length;
        if (rowCount > MAX_BACKUP_ROWS) {
            throw new CmsBackupLimitError(
                `Il backup supera il limite di ${MAX_BACKUP_ROWS} righe.`
            );
        }
        if (table.rows.some((row) => !isPlainObject(row))) {
            throw new CmsBackupValidationError(`Riga non valida nella tabella ${table.name}.`);
        }
    }

    const mediaRows = tables.find((table) => table.name === "media_assets").rows;
    if (mediaRows.some((row) => row.owner_type === "memory")) {
        throw new CmsBackupValidationError(
            "Il backup CMS contiene media personali esclusi dal suo perimetro."
        );
    }
    const expectedMedia = new Map(mediaRows.map((row) => [row.object_key, row]));
    const media = backup.media;
    if (
        !media ||
        !Array.isArray(media.objects) ||
        media.objects.length !== expectedMedia.size ||
        media.objectCount !== media.objects.length
    ) {
        throw new CmsBackupValidationError("L'elenco degli oggetti R2 è incompleto.");
    }
    if (media.objects.length > MAX_BACKUP_MEDIA_OBJECTS) {
        throw new CmsBackupLimitError(
            `L'archivio contiene più di ${MAX_BACKUP_MEDIA_OBJECTS} oggetti R2.`
        );
    }

    let totalMediaBytes = 0;
    const seenKeys = new Set();
    for (const object of media.objects) {
        if (
            !isPlainObject(object) ||
            typeof object.key !== "string" ||
            seenKeys.has(object.key) ||
            typeof object.data !== "string"
        ) {
            throw new CmsBackupValidationError("Oggetto R2 duplicato o non valido.");
        }
        seenKeys.add(object.key);
        const metadata = expectedMedia.get(object.key);
        if (!metadata) {
            throw new CmsBackupValidationError(`Oggetto R2 inatteso: ${object.key}`);
        }
        let bytes;
        try {
            bytes = base64ToBytes(object.data);
        } catch (_) {
            throw new CmsBackupValidationError(`Base64 non valido per ${object.key}.`);
        }
        const checksum = await sha256Hex(bytes);
        if (
            bytes.byteLength !== object.byteSize ||
            object.byteSize !== metadata.byte_size ||
            checksum !== object.checksum ||
            checksum !== metadata.checksum ||
            object.mediaType !== metadata.media_type
        ) {
            throw new CmsBackupIntegrityError(
                `Media non coerente con il catalogo D1: ${object.key}`
            );
        }
        totalMediaBytes += bytes.byteLength;
        if (totalMediaBytes > MAX_BACKUP_MEDIA_BYTES) {
            throw new CmsBackupLimitError(
                "I media superano il limite di 48 MiB del ripristino dal pannello."
            );
        }
    }
    if (totalMediaBytes !== media.totalBytes) {
        throw new CmsBackupIntegrityError("La dimensione complessiva dei media non corrisponde.");
    }

    return {
        valid: true,
        checksum: archiveChecksum,
        createdAt: backup.createdAt,
        tableCount: tables.length,
        rowCount,
        mediaCount: media.objects.length,
        totalMediaBytes,
        confirmation: restoreConfirmation(archiveChecksum)
    };
}

export async function restoreCmsBackup(env, backup, confirmation, now = Date.now()) {
    const report = await validateCmsBackup(backup);
    if (confirmation !== report.confirmation) {
        throw new CmsBackupValidationError("Conferma di ripristino non valida.");
    }

    const tables = new Map(
        backup.database.tables.map((table) => [table.name, table.rows])
    );
    const mediaRows = tables.get("media_assets");
    const targetByOriginalKey = new Map();
    const restoreId = `${now}-${crypto.randomUUID()}`;
    for (const object of backup.media.objects) {
        const keyHash = await sha256Text(object.key);
        targetByOriginalKey.set(
            object.key,
            `restores/${report.checksum.slice(0, 16)}/${restoreId}/${keyHash}`
        );
    }
    tables.set("media_assets", mediaRows.map((row) => ({
        ...row,
        object_key: targetByOriginalKey.get(row.object_key)
    })));

    const uploadedKeys = [];
    try {
        for (const object of backup.media.objects) {
            const targetKey = targetByOriginalKey.get(object.key);
            const bytes = base64ToBytes(object.data);
            await env.MEDIA.put(targetKey, bytes, {
                httpMetadata: {
                    contentType: object.mediaType,
                    cacheControl: "private, max-age=0, no-store"
                },
                customMetadata: {
                    checksum: object.checksum,
                    restoredFrom: object.key,
                    restoredAt: String(now)
                }
            });
            const stored = await env.MEDIA.head(targetKey);
            if (!stored || Number(stored.size) !== bytes.byteLength) {
                throw new CmsBackupRestoreError(`Verifica R2 fallita per ${object.key}.`);
            }
            uploadedKeys.push(targetKey);
        }

        const triggers = await existingCmsTriggers(env);
        const statements = [
            ...triggers.map((trigger) =>
                env.DB.prepare(`DROP TRIGGER IF EXISTS "${trigger.name}"`)
            ),
            ...[...CMS_BACKUP_TABLES].reverse().map((name) =>
                env.DB.prepare(`DELETE FROM "${name}"`)
            )
        ];

        for (const name of CMS_BACKUP_TABLES) {
            const columns = await tableColumns(env, name);
            for (const row of tables.get(name)) {
                validateRowColumns(name, row, columns);
                const placeholders = columns.map(() => "?").join(", ");
                statements.push(env.DB.prepare(`
                    INSERT INTO "${name}" (${columns.map(quoteIdentifier).join(", ")})
                    VALUES (${placeholders})
                `).bind(...columns.map((column) => row[column])));
            }
        }
        statements.push(...triggers.map((trigger) => env.DB.prepare(trigger.sql)));
        await env.DB.batch(statements);
    } catch (error) {
        if (uploadedKeys.length) await env.MEDIA.delete(uploadedKeys);
        if (
            error instanceof CmsBackupValidationError ||
            error instanceof CmsBackupIntegrityError ||
            error instanceof CmsBackupLimitError ||
            error instanceof CmsBackupRestoreError
        ) {
            throw error;
        }
        throw new CmsBackupRestoreError(
            `Ripristino interrotto senza modificare D1: ${error.message || error}`
        );
    }

    return {
        restored: true,
        restoredAt: new Date(now).toISOString(),
        checksum: report.checksum,
        rowCount: report.rowCount,
        mediaCount: report.mediaCount,
        retainedPreviousMedia: true
    };
}

export function restoreConfirmation(checksum) {
    return `RIPRISTINA ${checksum.slice(0, 12)}`;
}

export class CmsBackupIntegrityError extends Error {}
export class CmsBackupLimitError extends Error {}
export class CmsBackupRestoreError extends Error {}
export class CmsBackupValidationError extends Error {}

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

function base64ToBytes(value) {
    if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/u.test(value)) {
        throw new TypeError("Invalid base64");
    }
    const binary = atob(value);
    return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function isPlainObject(value) {
    return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

async function existingCmsTriggers(env) {
    const names = CMS_BACKUP_TABLES.map((name) => `'${name}'`).join(", ");
    const result = await env.DB.prepare(`
        SELECT name, sql
        FROM sqlite_master
        WHERE type = 'trigger' AND tbl_name IN (${names}) AND sql IS NOT NULL
        ORDER BY name
    `).all();
    return (result.results || []).map((trigger) => {
        if (!/^[a-z0-9_]+$/u.test(trigger.name)) {
            throw new CmsBackupRestoreError("Nome trigger D1 non valido.");
        }
        return trigger;
    });
}

async function tableColumns(env, name) {
    const result = await env.DB.prepare(`PRAGMA table_info("${name}")`).all();
    const columns = (result.results || []).map((column) => column.name);
    if (!columns.length || columns.some((column) => !/^[a-z0-9_]+$/u.test(column))) {
        throw new CmsBackupRestoreError(`Schema D1 non valido per ${name}.`);
    }
    return columns;
}

function validateRowColumns(table, row, columns) {
    const keys = Object.keys(row).sort();
    const expected = [...columns].sort();
    if (keys.length !== expected.length || keys.some((key, index) => key !== expected[index])) {
        throw new CmsBackupValidationError(`Colonne non compatibili nella tabella ${table}.`);
    }
}

function quoteIdentifier(value) {
    return `"${value}"`;
}
