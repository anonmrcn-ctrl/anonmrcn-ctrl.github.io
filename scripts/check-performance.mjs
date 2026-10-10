import { readFile, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import process from "node:process";

const root = resolve(import.meta.dirname, "..");
const config = JSON.parse(await readFile(resolve(root, "performance-budget.json"), "utf8"));
const reportsDirectory = process.argv[2] ? resolve(process.argv[2]) : null;
const failures = [];
const warnings = [];

function fail(message) {
    failures.push(message);
}

function warn(message) {
    warnings.push(message);
}

function localReference(reference) {
    if (!reference || /^(?:https?:|data:|mailto:|tel:|#)/i.test(reference)) return null;
    const clean = reference.split(/[?#]/, 1)[0].replace(/^\.\//, "").replace(/^\//, "");
    if (!/\.(?:css|js|mjs|png|jpe?g|webp|svg|ico|webmanifest)$/i.test(clean)) return null;
    return clean;
}

async function checkStaticRoute(route) {
    const pagePath = resolve(root, route.path.replace(/^\//, ""));
    if (!existsSync(pagePath)) {
        fail(`${route.id}: manca ${route.path}`);
        return;
    }

    const html = await readFile(pagePath, "utf8");
    const htmlBytes = Buffer.byteLength(html);
    if (htmlBytes > config.static.maxHtmlBytes) {
        fail(`${route.id}: HTML ${htmlBytes} B oltre il limite ${config.static.maxHtmlBytes} B`);
    }

    const references = new Set(
        [...html.matchAll(/(?:src|href)=["']([^"']+)["']/gi)]
            .map((match) => localReference(match[1]))
            .filter(Boolean)
    );
    let referencedBytes = htmlBytes;

    for (const reference of references) {
        const assetPath = resolve(root, reference);
        if (!existsSync(assetPath)) continue;
        const asset = await stat(assetPath);
        if (!asset.isFile()) continue;
        referencedBytes += asset.size;
        if (/\.(?:js|mjs)$/i.test(reference) && asset.size > config.static.maxSingleScriptBytes) {
            fail(`${route.id}: ${reference} pesa ${asset.size} B, limite script ${config.static.maxSingleScriptBytes} B`);
        }
        if (/\.css$/i.test(reference) && asset.size > config.static.maxSingleStylesheetBytes) {
            fail(`${route.id}: ${reference} pesa ${asset.size} B, limite CSS ${config.static.maxSingleStylesheetBytes} B`);
        }
    }

    if (referencedBytes > config.static.maxReferencedLocalBytes) {
        fail(`${route.id}: risorse locali referenziate ${referencedBytes} B oltre il limite ${config.static.maxReferencedLocalBytes} B`);
    }
}

function metric(report, auditId) {
    const value = report.audits?.[auditId]?.numericValue;
    return Number.isFinite(value) ? value : null;
}

async function checkLighthouseReport(route, profile) {
    const reportPath = resolve(reportsDirectory, `${route.id}.${profile}.json`);
    if (!existsSync(reportPath)) {
        fail(`${route.id}/${profile}: rapporto Lighthouse assente`);
        return;
    }
    const report = JSON.parse(await readFile(reportPath, "utf8"));
    const values = {
        lcp: metric(report, "largest-contentful-paint"),
        cls: metric(report, "cumulative-layout-shift"),
        tbt: metric(report, "total-blocking-time"),
        bytes: metric(report, "total-byte-weight"),
        score: report.categories?.performance?.score
    };
    for (const [name, value] of Object.entries(values)) {
        if (!Number.isFinite(value)) fail(`${route.id}/${profile}: metrica ${name} assente`);
    }
    if (values.lcp > config.thresholds.largestContentfulPaintMs) fail(`${route.id}/${profile}: LCP ${Math.round(values.lcp)} ms`);
    if (values.cls > config.thresholds.cumulativeLayoutShift) fail(`${route.id}/${profile}: CLS ${values.cls.toFixed(3)}`);
    if (values.tbt > config.thresholds.totalBlockingTimeMs) fail(`${route.id}/${profile}: TBT ${Math.round(values.tbt)} ms`);
    if (values.bytes > config.thresholds.totalByteWeight) fail(`${route.id}/${profile}: trasferimento ${Math.round(values.bytes)} B`);
    if (values.score < config.thresholds.performanceScore) fail(`${route.id}/${profile}: punteggio ${(values.score * 100).toFixed(0)}`);
    console.log(
        `${route.id}/${profile}: score ${(values.score * 100).toFixed(0)}, ` +
        `LCP ${Math.round(values.lcp)} ms, CLS ${values.cls.toFixed(3)}, ` +
        `TBT ${Math.round(values.tbt)} ms, ${Math.round(values.bytes / 1024)} KiB`
    );
}

if (config.version !== 1) fail("performance-budget.json: versione non supportata");
if (!Array.isArray(config.routes) || config.routes.length !== 5) fail("La baseline deve contenere esattamente cinque tipologie");
if (!Array.isArray(config.profiles) || !config.profiles.includes("mobile") || !config.profiles.includes("desktop")) {
    fail("La baseline deve contenere i profili mobile e desktop");
}

for (const route of config.routes || []) await checkStaticRoute(route);

if (reportsDirectory) {
    for (const route of config.routes || []) {
        for (const profile of config.profiles || []) await checkLighthouseReport(route, profile);
    }
} else {
    warn("rapporti Lighthouse non forniti: eseguiti soltanto i budget statici");
}

for (const message of warnings) console.warn(`ATTENZIONE: ${message}`);
if (failures.length) {
    for (const message of failures) console.error(`ERRORE: ${message}`);
    process.exitCode = 1;
} else {
    console.log(`Budget prestazionali validi per ${config.routes.length} tipologie e ${config.profiles.length} profili.`);
}
