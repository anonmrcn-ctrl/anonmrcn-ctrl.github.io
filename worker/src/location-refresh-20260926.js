const MIGRATION_NAME = "location-refresh-20260926";
const KEY_SHA256 =
    "37d14177489c35d0983431ecf5a84da65d012823b44dbeafff7a3cc862c9851e";
const IV = "i4qHLQxDzMcHiogR";
const CIPHERTEXT =
    "RIxecGtVVxbHsV36596wtVaDJmzxToR1mz-CxpnyGxNRh6e5x-sdQOCWFt0qu3WPr-47n0lqR2Ytt_yRUef1JARw_hl98zfAvTyjQXhcYNmLrAD2lhKCHDZzxMzzEkyb3t4oCHxrYW8JBIO943SubAmoJxUNdDC3F7AN2CcA7PkG2S3uhQuxmRVbnYzkMaJqKDwe5Xt-V9pau7jgL0DJZdh_niGjbc5j-cYdh_3Geae87yKViW4ERJVKHv5cIX_ox_H8NivFZ5d6m_IJRIuZIDG7eyKIkWRLCGI-2j518DlvsEJKXsi7MFWwCvGIiuXgLx83FSWNl6-4uSto2-Fbbk-My_3e28ZTOY82GlUdtuOeAnU1UGVEoHnRILchCQu0gUQao5BFmAiXNONK-bD9oKm-j6hGr2q0UKQW6XuFBFl7XNggUB93F58FZBTtS-uPmMCg1nageJ5-nXeyOu4zJZW7rIbAUMajYIRVPXzDcZ-Ry6LuKJHkl8lm_elnX88BpEc5A4WOyJwAY8B4SV4StsEtyxt9ZmuyvU0Aj3ajEfIKtrS301CJ3659vMMJYQJs0gp-OL7ozNcx5YBMFl-KcIdVFdn7KpmA0slEr3DZ83zRnm9vFBkwdE1-aDlN6OCM4wgpGxQFAAgUjAuRHBPZPW-XtKgTPpqNsA1BjRaHD7dphElpoc5BZA-jMERf7YM1qEGJ_XWr8uQfFD50OEvtwKxqbh2JuqIpyBfHpF6O8HZZ9IK561fs1ObriiIXQDzkRmXRN6gTXdDXYmElhHO9NDL1WBlvZJQ7YX_8Gtib7u98Q-hFdEIwikXXBAJQW6jeaQT6fs1KOEMClolC2vX5i5stesGFrUInqIMWjNCdyIFCEYx8atjgJHJo6CKwOwHKkSSBjYASSiHaNcfe6ZomHxIThuIS4uuy_IwR3WrlwNHZ5OxTt9kKWrlLr4kDTRzCe98RP9CBt4LEjwkIarXkLUdIquTFWCVOWsNkTlv---Wh9-ZzUErOYaFefKsAd2X_JJG8I34T7-znRVm1SFkzWZQH_zJFQwI5PnHHwbLMCdkCcPk3RsKusy0KkJpa00qmyPn0sAUA21VGQePrCteSw2ckEO7euUMlypVpiAkPkjp6lglrYugTBLJe6uMZTu1PCgvtstQ_dUYuQnSf8wSU4y8MB14o5irJ0eA49ClTY0UEsVtlBwqRE1s5FvIoJJKpqtGzRY5xoanopZvvgsaTO-aEnmjVK9sjZxqyvxFb6T4VW4sGaeOtcCsdhEdPmy_NI5LpKm1_ltwy0rB91hRwCjVgj21cooon8To21bGrHBGbUa-zJUOvJvF4GotQmQCUIdcYIjstGfXIrGyeyUEpW6v5ZctN79TJBqEpdAHofiaZKyYwslATzywsBhGg1XDYnop5h2OUMGyk35ijvOwCI5fnSW5JFUx_XrCpePF5odYFw0xmWWzUS5sQQN5KxT0t62eksFcfvAEtXr_uPYe2YESnhMGyz2YD2vEvlrkpGYNZJcjzFnEdR-Jj-13xSVqESim2YMguNgDVaYRKJtBuhehKh8EXG6d65AHHsEgUdIBOLQIiXvJl9dtJJ8rhpv-ikVUip8P093jnPrV-4LmHpbBU_9EKdlOhi7BjSb_lP1PgUqlH4t6gTIdQTGOXukBK96Ysc3eWfo6ugJ81a0VM3caBeJpmN8KVKi9pjhqzYGkgmO66RhyFDbanEqLStmhCZICBCcrXL4vzrUt7I25tJIPITLfhdaNNZ_7mazYzedS0vvbVj15i_DZNByInWp57HC0qxdIElpYqe04ceCx3UcaBjb13p_L1QljyKVYtJz0rFMyuz7q3EnhMqDFPXT6oHngGB8cMXBdYR4qMgO3SyIAGuc-LiKYrZ2XoMU6Dy4UPA1yJVZLpJasPhy_Evy1tRxGnvO2CzMn6jqcvGs7o4ANUyENoJ_R4JPQXbqcVA30Ec9OE-RJOnlew8ECfX_2YBSeiNli98_tj6h8dHxC2vGKXZNTFKttUOgwpLxjcaGXZtLVJSII8Nbf1SBSFpY2bgfaOb3r9DJ9B44qjW8U8oH-cgSVPrjFr0_L4hFCKrek8itnHld8Ee0iOnmF7HPw0f50Q6dzCptXHa8Ld6r33JCLOB0rJEkxZZrzu_MYyhPlAdGoBlvE4_MqbTupHTSB5FaKhHXdhg8MGY84u5Sp6s85NpnRVeRU24Lt8O0GwfuKH5rzpk-udzzcLPg2qfeV4L_ojMg";

export async function applyLocationRefresh(env, suppliedKey) {
    const keyText = String(suppliedKey || "").trim();

    if (!(await digestMatches(keyText, KEY_SHA256))) {
        throw new Error("Invalid location refresh key.");
    }

    await env.DB.prepare(`
        CREATE TABLE IF NOT EXISTS internal_migrations (
            name TEXT PRIMARY KEY,
            applied_at INTEGER NOT NULL
        )
    `).run();

    const existing = await env.DB.prepare(`
        SELECT name
        FROM internal_migrations
        WHERE name = ?
    `).bind(MIGRATION_NAME).first();

    if (existing) {
        return {
            ok: true,
            alreadyApplied: true,
            updated: 20
        };
    }

    const updates = await decryptUpdates(keyText);
    validateUpdates(updates);

    const locations = await env.DB.prepare(`
        SELECT id
        FROM locations
        WHERE id BETWEEN 1 AND 20
        ORDER BY id
    `).all();
    const ids = (locations.results || []).map((row) => Number(row.id));

    if (ids.length !== 20 || ids.some((id, index) => id !== index + 1)) {
        throw new Error("Expected locations 1 through 20 before refresh.");
    }

    const temporaryStatements = updates.map((entry) =>
        env.DB.prepare(`
            UPDATE locations
            SET address = ?
            WHERE id = ?
        `).bind(
            `__nnmrcn_refresh_20260926_${entry.id}`,
            entry.id
        )
    );
    const finalStatements = updates.map((entry) =>
        env.DB.prepare(`
            UPDATE locations
            SET address = ?, lat = ?, lon = ?
            WHERE id = ?
        `).bind(
            entry.address,
            entry.lat,
            entry.lon,
            entry.id
        )
    );

    await env.DB.batch([
        ...temporaryStatements,
        ...finalStatements,
        env.DB.prepare(`
            INSERT INTO internal_migrations (name, applied_at)
            VALUES (?, ?)
        `).bind(MIGRATION_NAME, Date.now())
    ]);

    const refreshed = await env.DB.prepare(`
        SELECT id, address, lat, lon
        FROM locations
        WHERE id BETWEEN 1 AND 20
        ORDER BY id
    `).all();
    const rows = refreshed.results || [];
    const mismatches = updates
        .filter((entry, index) => {
            const row = rows[index];
            return !row ||
                Number(row.id) !== entry.id ||
                row.address !== entry.address ||
                Math.abs(Number(row.lat) - entry.lat) > 1e-10 ||
                Math.abs(Number(row.lon) - entry.lon) > 1e-10;
        })
        .map((entry) => entry.id);

    if (mismatches.length > 0) {
        throw new Error(`Location refresh verification failed: ${mismatches.join(",")}`);
    }

    return {
        ok: true,
        alreadyApplied: false,
        updated: rows.length
    };
}

async function decryptUpdates(keyText) {
    const key = await crypto.subtle.importKey(
        "raw",
        base64UrlBytes(keyText),
        "AES-GCM",
        false,
        ["decrypt"]
    );
    const plaintext = await crypto.subtle.decrypt(
        {
            name: "AES-GCM",
            iv: base64UrlBytes(IV)
        },
        key,
        base64UrlBytes(CIPHERTEXT)
    );

    return JSON.parse(new TextDecoder().decode(plaintext));
}

function validateUpdates(updates) {
    if (!Array.isArray(updates) || updates.length !== 20) {
        throw new Error("Invalid location refresh payload.");
    }

    const ids = new Set();

    for (const entry of updates) {
        const id = Number(entry?.id);
        const address = String(entry?.address || "").trim();
        const lat = Number(entry?.lat);
        const lon = Number(entry?.lon);

        if (
            !Number.isInteger(id) ||
            id < 1 ||
            id > 20 ||
            ids.has(id) ||
            address.length < 3 ||
            address.length > 240 ||
            !Number.isFinite(lat) ||
            lat < -90 ||
            lat > 90 ||
            !Number.isFinite(lon) ||
            lon < -180 ||
            lon > 180
        ) {
            throw new Error("Invalid location refresh entry.");
        }

        ids.add(id);
    }
}

async function digestMatches(value, expectedHex) {
    if (!value) {
        return false;
    }

    const digest = await crypto.subtle.digest(
        "SHA-256",
        new TextEncoder().encode(value)
    );
    const expected = hexBytes(expectedHex);

    return crypto.subtle.timingSafeEqual(digest, expected.buffer);
}

function base64UrlBytes(value) {
    const padded = value
        .replaceAll("-", "+")
        .replaceAll("_", "/")
        .padEnd(Math.ceil(value.length / 4) * 4, "=");
    const binary = atob(padded);
    const bytes = new Uint8Array(binary.length);

    for (let index = 0; index < binary.length; index += 1) {
        bytes[index] = binary.charCodeAt(index);
    }

    return bytes;
}

function hexBytes(value) {
    const bytes = new Uint8Array(value.length / 2);

    for (let index = 0; index < value.length; index += 2) {
        bytes[index / 2] = Number.parseInt(value.slice(index, index + 2), 16);
    }

    return bytes;
}
