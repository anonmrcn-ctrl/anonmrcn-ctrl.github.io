const COLOR = /^#[0-9a-f]{6}$/iu;
const LENGTHS = new Set(["0", "0.25rem", "0.5rem", "0.75rem", "1rem", "1.5rem", "2rem", "3rem"]);
const FONTS = new Set(["system", "serif", "sans", "mono"]);
const SHADOWS = new Set(["none", "soft", "strong"]);

export const VISUAL_THEME_TOKEN_SCHEMA = Object.freeze([
    token("palette", "ink", "Testo", "color", "#191919"),
    token("palette", "paper", "Sfondo", "color", "#f4f1e8"),
    token("palette", "accent", "Accento", "color", "#8b1f11"),
    token("palette", "muted", "Testo secondario", "color", "#5b5b5b"),
    token("typography", "body", "Carattere del testo", "font", "system", [...FONTS]),
    token("typography", "heading", "Carattere dei titoli", "font", "serif", [...FONTS]),
    token("scale", "ratio", "Scala tipografica", "number", 1.2, null, 1, 1.5),
    token("spacing", "base", "Spaziatura base", "length", "1rem", [...LENGTHS]),
    token("surface", "panel", "Superficie pannelli", "color", "#e6e0d2"),
    token("border", "radius", "Arrotondamento", "length", "0.25rem", [...LENGTHS]),
    token("shadow", "elevation", "Ombra", "text", "soft", [...SHADOWS]),
    token("motion", "duration", "Durata movimento (ms)", "number", 160, null, 0, 400),
    token("motion", "respect-reduced", "Rispetta movimento ridotto", "boolean", true)
]);

export class VisualThemeStudioError extends Error {
    constructor(message, status = 400) {
        super(message);
        this.status = status;
    }
}

export async function listVisualThemes(env) {
    await ensureDefaultTokens(env);
    const result = await env.DB.prepare(`
        SELECT theme.id, theme.name, theme.status, theme.created_at,
            theme.updated_at, theme.published_at,
            (SELECT count(*) FROM visual_page_trees mapping
                WHERE mapping.theme_id = theme.id) AS impact_count
        FROM visual_themes theme
        ORDER BY theme.name COLLATE NOCASE, theme.id
    `).all();
    const themes = [];
    for (const row of result.results || []) themes.push(await themeRecord(env, row));
    const active = await env.DB.prepare(`
        SELECT theme_id, count(*) AS total FROM visual_page_trees
        WHERE theme_id IS NOT NULL GROUP BY theme_id
        ORDER BY total DESC, theme_id LIMIT 1
    `).first();
    return {
        tokenSchema: VISUAL_THEME_TOKEN_SCHEMA,
        activeThemeId: active?.theme_id || "theme-default",
        themes
    };
}

export async function createVisualTheme(env, rawInput) {
    await ensureDefaultTokens(env);
    const name = normalizeName(rawInput?.name);
    const sourceId = String(rawInput?.sourceThemeId || "theme-default");
    const source = await readTheme(env, sourceId);
    if (!source) throw new VisualThemeStudioError("Tema di partenza non trovato.", 404);
    const themeId = `theme-${crypto.randomUUID()}`;
    const now = Date.now();
    const statements = [env.DB.prepare(`
        INSERT INTO visual_themes (
            id, name, status, created_at, updated_at, published_at
        ) VALUES (?, ?, 'draft', ?, ?, NULL)
    `).bind(themeId, name, now, now)];
    pushTokens(statements, env, themeId, source.tokens, now);
    statements.push(revisionStatement(env, themeId, {
        action: "create_theme",
        name,
        sourceThemeId: sourceId,
        tokens: source.tokens
    }, "draft", now));
    await env.DB.batch(statements);
    return { created: true, theme: await readTheme(env, themeId) };
}

export async function updateVisualTheme(env, themeId, rawInput) {
    await ensureDefaultTokens(env);
    const theme = await readThemeRow(env, themeId);
    if (!theme) throw new VisualThemeStudioError("Tema non trovato.", 404);
    const expectedUpdatedAt = Number(rawInput?.expectedUpdatedAt);
    if (expectedUpdatedAt !== Number(theme.updated_at)) {
        throw new VisualThemeStudioError("Il tema è stato modificato altrove.", 409);
    }
    const name = normalizeName(rawInput?.name);
    const tokens = normalizeTokens(rawInput?.tokens);
    assertAccessible(tokens);
    const now = Math.max(Date.now(), Number(theme.updated_at) + 1);
    const statements = [
        env.DB.prepare(`DELETE FROM visual_theme_tokens WHERE theme_id = ?`).bind(themeId),
        env.DB.prepare(`
            UPDATE visual_themes SET name = ?, status = 'draft', updated_at = ?
            WHERE id = ?
        `).bind(name, now, themeId)
    ];
    pushTokens(statements, env, themeId, tokens, now);
    statements.push(revisionStatement(env, themeId, {
        action: "update_theme",
        name,
        tokens
    }, "draft", now));
    await env.DB.batch(statements);
    return { theme: await readTheme(env, themeId) };
}

export async function compareVisualThemes(env, themeId, otherThemeId) {
    await ensureDefaultTokens(env);
    const [theme, other] = await Promise.all([
        readTheme(env, themeId),
        readTheme(env, otherThemeId)
    ]);
    if (!theme || !other) throw new VisualThemeStudioError("Tema da confrontare non trovato.", 404);
    const before = new Map(other.tokens.map((item) => [keyOf(item), item.value]));
    const changes = theme.tokens
        .filter((item) => before.get(keyOf(item)) !== item.value)
        .map((item) => ({
            group: item.group,
            name: item.name,
            before: before.get(keyOf(item)),
            after: item.value
        }));
    const affected = await env.DB.prepare(`
        SELECT page.id, page.title, page.slug, page.status
        FROM visual_page_trees mapping
        INNER JOIN site_pages page ON page.id = mapping.page_id
        ORDER BY page.title COLLATE NOCASE, page.id
    `).all();
    return {
        theme: { id: theme.id, name: theme.name },
        comparedWith: { id: other.id, name: other.name },
        changes,
        pages: affected.results || [],
        impactCount: (affected.results || []).length
    };
}

export async function publishVisualTheme(env, themeId, rawInput) {
    await ensureDefaultTokens(env);
    const theme = await readTheme(env, themeId);
    if (!theme) throw new VisualThemeStudioError("Tema non trovato.", 404);
    const expectedUpdatedAt = Number(rawInput?.expectedUpdatedAt);
    if (expectedUpdatedAt !== Number(theme.updatedAt)) {
        throw new VisualThemeStudioError("Il tema è stato modificato altrove.", 409);
    }
    assertAccessible(theme.tokens);
    const pages = await env.DB.prepare(`
        SELECT mapping.page_id, mapping.tree_id, tree.status
        FROM visual_page_trees mapping
        INNER JOIN visual_trees tree ON tree.id = mapping.tree_id
        ORDER BY mapping.page_id
    `).all();
    const now = Math.max(Date.now(), Number(theme.updatedAt) + 1);
    const statements = [
        env.DB.prepare(`
            UPDATE visual_themes SET status = 'published', updated_at = ?,
                published_at = COALESCE(published_at, ?)
            WHERE id = ?
        `).bind(now, now, themeId),
        revisionStatement(env, themeId, {
            action: "publish_theme",
            themeId,
            pages: (pages.results || []).map((page) => page.page_id),
            tokens: theme.tokens
        }, "published", now)
    ];
    for (const page of pages.results || []) {
        statements.push(env.DB.prepare(`
            UPDATE visual_page_trees SET theme_id = ?, updated_at = ?
            WHERE page_id = ?
        `).bind(themeId, now, page.page_id));
        statements.push(revisionStatement(env, page.tree_id, {
            action: "apply_global_theme",
            themeId,
            pageId: page.page_id
        }, page.status, now));
    }
    await env.DB.batch(statements);
    return {
        published: true,
        appliedTo: (pages.results || []).length,
        theme: await readTheme(env, themeId)
    };
}

export async function readPublicTheme(env, themeId) {
    await ensureDefaultTokens(env);
    const theme = await readTheme(env, themeId);
    if (!theme || theme.status !== "published") return null;
    return { id: theme.id, name: theme.name, tokens: theme.tokens };
}

async function ensureDefaultTokens(env) {
    const now = Date.now();
    const statements = VISUAL_THEME_TOKEN_SCHEMA.map((descriptor) => {
        const value = rowValue(descriptor.kind, descriptor.default);
        return env.DB.prepare(`
            INSERT OR IGNORE INTO visual_theme_tokens (
                theme_id, token_group, token_name, breakpoint, value_kind,
                text_value, number_value, boolean_value, created_at, updated_at
            ) VALUES ('theme-default', ?, ?, 'all', ?, ?, ?, ?, ?, ?)
        `).bind(
            descriptor.group,
            descriptor.name,
            descriptor.kind,
            value.text,
            value.number,
            value.boolean,
            now,
            now
        );
    });
    if (statements.length) await env.DB.batch(statements);
}

async function readTheme(env, themeId) {
    const row = await readThemeRow(env, themeId);
    return row ? themeRecord(env, row) : null;
}

async function readThemeRow(env, themeId) {
    return env.DB.prepare(`
        SELECT id, name, status, created_at, updated_at, published_at,
            (SELECT count(*) FROM visual_page_trees mapping
                WHERE mapping.theme_id = visual_themes.id) AS impact_count
        FROM visual_themes WHERE id = ? LIMIT 1
    `).bind(themeId).first();
}

async function themeRecord(env, row) {
    const result = await env.DB.prepare(`
        SELECT token_group, token_name, breakpoint, value_kind,
            text_value, number_value, boolean_value
        FROM visual_theme_tokens WHERE theme_id = ?
        ORDER BY token_group, token_name, breakpoint
    `).bind(row.id).all();
    return {
        id: row.id,
        name: row.name,
        status: row.status,
        impactCount: Number(row.impact_count || 0),
        createdAt: Number(row.created_at),
        updatedAt: Number(row.updated_at),
        publishedAt: row.published_at === null ? null : Number(row.published_at),
        tokens: (result.results || []).map((item) => ({
            group: item.token_group,
            name: item.token_name,
            breakpoint: item.breakpoint,
            kind: item.value_kind,
            value: valueOf(item)
        }))
    };
}

function normalizeTokens(value) {
    if (!Array.isArray(value) || value.length !== VISUAL_THEME_TOKEN_SCHEMA.length) {
        throw new VisualThemeStudioError("Il tema deve includere tutti i controlli grafici.");
    }
    const supplied = new Map(value.map((item) => [keyOf(item), item.value]));
    if (supplied.size !== VISUAL_THEME_TOKEN_SCHEMA.length) {
        throw new VisualThemeStudioError("Il tema contiene controlli duplicati o sconosciuti.");
    }
    return VISUAL_THEME_TOKEN_SCHEMA.map((descriptor) => {
        const key = keyOf(descriptor);
        if (!supplied.has(key)) throw new VisualThemeStudioError(`Controllo mancante: ${key}.`);
        const raw = supplied.get(key);
        let normalized;
        if (descriptor.kind === "color") {
            normalized = String(raw || "").toLowerCase();
            if (!COLOR.test(normalized)) throw new VisualThemeStudioError(`${descriptor.label}: colore non valido.`);
        } else if (descriptor.kind === "font") {
            normalized = String(raw || "");
            if (!FONTS.has(normalized)) throw new VisualThemeStudioError(`${descriptor.label}: carattere non valido.`);
        } else if (descriptor.kind === "length") {
            normalized = String(raw || "");
            if (!LENGTHS.has(normalized)) throw new VisualThemeStudioError(`${descriptor.label}: misura non valida.`);
        } else if (descriptor.group === "shadow") {
            normalized = String(raw || "");
            if (!SHADOWS.has(normalized)) throw new VisualThemeStudioError("Ombra non valida.");
        } else if (descriptor.kind === "number") {
            normalized = Number(raw);
            if (!Number.isFinite(normalized) || normalized < descriptor.min || normalized > descriptor.max) {
                throw new VisualThemeStudioError(`${descriptor.label}: valore fuori intervallo.`);
            }
        } else if (descriptor.kind === "boolean") {
            normalized = raw === true;
            if (descriptor.name === "respect-reduced" && !normalized) {
                throw new VisualThemeStudioError("Il movimento ridotto deve essere sempre rispettato.");
            }
        } else {
            normalized = String(raw || "");
        }
        return {
            group: descriptor.group,
            name: descriptor.name,
            breakpoint: "all",
            kind: descriptor.kind,
            value: normalized
        };
    });
}

function assertAccessible(tokens) {
    const values = new Map(tokens.map((item) => [keyOf(item), item.value]));
    const contrast = contrastRatio(values.get("palette/ink"), values.get("palette/paper"));
    if (contrast < 4.5) {
        throw new VisualThemeStudioError(`Contrasto testo/sfondo insufficiente (${contrast.toFixed(2)}:1).`);
    }
    const mutedContrast = contrastRatio(values.get("palette/muted"), values.get("palette/paper"));
    if (mutedContrast < 4.5) {
        throw new VisualThemeStudioError(`Contrasto del testo secondario insufficiente (${mutedContrast.toFixed(2)}:1).`);
    }
}

function pushTokens(statements, env, themeId, tokens, now) {
    for (const item of tokens) {
        const value = rowValue(item.kind, item.value);
        statements.push(env.DB.prepare(`
            INSERT INTO visual_theme_tokens (
                theme_id, token_group, token_name, breakpoint, value_kind,
                text_value, number_value, boolean_value, created_at, updated_at
            ) VALUES (?, ?, ?, 'all', ?, ?, ?, ?, ?, ?)
        `).bind(
            themeId,
            item.group,
            item.name,
            item.kind,
            value.text,
            value.number,
            value.boolean,
            now,
            now
        ));
    }
}

function revisionStatement(env, id, snapshot, status, now) {
    return env.DB.prepare(`
        INSERT INTO content_revisions (
            entity_type, entity_id, revision_number, snapshot_json,
            publication_state, created_at
        ) SELECT ?, ?, COALESCE(MAX(revision_number), 0) + 1, ?, ?, ?
        FROM content_revisions WHERE entity_type = ? AND entity_id = ?
    `).bind(
        id.startsWith("theme-") ? "visual_theme" : "visual_tree",
        id,
        JSON.stringify(snapshot),
        status,
        now,
        id.startsWith("theme-") ? "visual_theme" : "visual_tree",
        id
    );
}

function rowValue(kind, value) {
    return {
        text: ["text", "color", "font", "length"].includes(kind) ? String(value) : null,
        number: kind === "number" ? Number(value) : null,
        boolean: kind === "boolean" ? (value ? 1 : 0) : null
    };
}

function valueOf(row) {
    if (row.value_kind === "number") return Number(row.number_value);
    if (row.value_kind === "boolean") return Boolean(row.boolean_value);
    return String(row.text_value);
}

function token(group, name, label, kind, defaultValue, options = null, min = null, max = null) {
    return Object.freeze({ group, name, label, kind, default: defaultValue, options, min, max });
}

function keyOf(item) {
    return `${item.group}/${item.name}`;
}

function normalizeName(value) {
    const name = String(value || "").trim();
    if (!name || name.length > 120) {
        throw new VisualThemeStudioError("Il nome del tema deve contenere da 1 a 120 caratteri.");
    }
    return name;
}

function contrastRatio(first, second) {
    const luminance = (hex) => {
        const channels = [1, 3, 5].map((offset) => Number.parseInt(hex.slice(offset, offset + 2), 16) / 255)
            .map((channel) => channel <= 0.03928
                ? channel / 12.92
                : ((channel + 0.055) / 1.055) ** 2.4);
        return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
    };
    const left = luminance(first);
    const right = luminance(second);
    return (Math.max(left, right) + 0.05) / (Math.min(left, right) + 0.05);
}
