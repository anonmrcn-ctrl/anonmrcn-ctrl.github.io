import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

const root = path.resolve(import.meta.dirname, "..");

function number(value) {
    return typeof value === "number" && Number.isFinite(value);
}

function daysBetween(start, end) {
    return (Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / 86400000 + 1;
}

function date(value) {
    return /^\d{4}-\d{2}-\d{2}$/u.test(value || "") &&
        Number.isFinite(Date.parse(`${value}T00:00:00Z`));
}

function walkFields(value, visit, trail = []) {
    if (!value || typeof value !== "object") return;
    for (const [key, child] of Object.entries(value)) {
        visit(key, trail);
        walkFields(child, visit, [...trail, key]);
    }
}

export function validateOrganicReport(report, config, clusterIds) {
    const errors = [];
    const metrics = config.metrics || [];
    const prohibited = new Set((config.privacy?.prohibitedFields || []).map((field) =>
        field.toLocaleLowerCase("en")
    ));
    const fail = (message) => errors.push(message);

    if (report.version !== config.version) fail("versione del rapporto non supportata");
    for (const field of ["period", "baseline"]) {
        const range = report[field];
        if (!range || !/^\d{4}-\d{2}-\d{2}$/u.test(range.start || "") ||
            !/^\d{4}-\d{2}-\d{2}$/u.test(range.end || "") ||
            !Number.isFinite(daysBetween(range.start, range.end)) ||
            daysBetween(range.start, range.end) < 28) {
            fail(`${field}: periodo assente, non valido o inferiore a 28 giorni`);
        }
    }
    if (!Array.isArray(report.sources) || !report.sources.length ||
        report.sources.some((source) => !config.allowedSources.includes(source))) {
        fail("fonti del rapporto assenti o non ammesse");
    }

    walkFields(report, (key, trail) => {
        if (prohibited.has(key.toLocaleLowerCase("en"))) {
            fail(`campo vietato per privacy: ${[...trail, key].join(".")}`);
        }
    });

    function validateMetrics(values, label) {
        if (!values || typeof values !== "object" || Array.isArray(values)) {
            fail(`${label}: metriche assenti`);
            return;
        }
        for (const metric of metrics) {
            const comparison = values[metric];
            if (!comparison || !number(comparison.current) ||
                !number(comparison.baseline) || !number(comparison.delta)) {
                fail(`${label}.${metric}: confronto incompleto`);
                continue;
            }
            const expected = comparison.current - comparison.baseline;
            if (Math.abs(expected - comparison.delta) > 0.000001) {
                fail(`${label}.${metric}: delta non coerente`);
            }
            if (["indexedPages", "impressions", "clicks", "ctr"].includes(metric) &&
                (comparison.current < 0 || comparison.baseline < 0)) {
                fail(`${label}.${metric}: valore negativo`);
            }
        }
        for (const metric of Object.keys(values)) {
            if (!metrics.includes(metric)) fail(`${label}: metrica non prevista ${metric}`);
        }
    }

    validateMetrics(report.overall, "overall");
    const seenClusters = new Set();
    for (const cluster of report.clusters || []) {
        if (!clusterIds.has(cluster.id)) fail(`cluster sconosciuto: ${cluster.id}`);
        if (seenClusters.has(cluster.id)) fail(`cluster duplicato: ${cluster.id}`);
        seenClusters.add(cluster.id);
        validateMetrics(cluster.metrics, `clusters.${cluster.id}`);
        const impressions = cluster.metrics?.impressions?.current;
        if (number(impressions) && impressions < config.privacy.minimumGroupImpressions) {
            fail(`clusters.${cluster.id}: gruppo sotto la soglia di aggregazione`);
        }
    }
    if (!Array.isArray(report.excludedGroups) ||
        report.excludedGroups.some((id) => !clusterIds.has(id))) {
        fail("gruppi esclusi non validi");
    }
    if (!Array.isArray(report.editorialDecisions)) fail("decisioni editoriali assenti");
    return errors;
}

export function validateMonitoringConfiguration(config) {
    const errors = [];
    const fail = (message) => errors.push(message);
    const property = config.property || {};
    const sitemap = config.sitemap || {};
    const window = config.firstObservationWindow || {};

    if (config.implementationStatus !== "complete") {
        fail("implementazione del monitoraggio non completata");
    }
    if (property.type !== "url-prefix" ||
        property.url !== "https://anonmrcn-ctrl.github.io/" || !date(property.verifiedOn)) {
        fail("proprietà Search Console non verificabile");
    }
    if (sitemap.url !== "https://anonmrcn-ctrl.github.io/sitemap.xml" ||
        !date(sitemap.submittedOn)) {
        fail("invio della sitemap non verificabile");
    }
    if (!date(window.start) || !date(window.end) ||
        daysBetween(window.start, window.end) < 28 || window.minimumDays !== 28) {
        fail("prima finestra di osservazione inferiore a 28 giorni");
    }
    if (!date(window.earliestExportOn) ||
        Date.parse(`${window.earliestExportOn}T00:00:00Z`) <=
            Date.parse(`${window.end}T00:00:00Z`)) {
        fail("data del primo export non successiva alla finestra di osservazione");
    }
    if (window.status !== "collecting") {
        fail("stato della prima finestra non coerente");
    }
    return errors;
}

export async function checkOrganicReports(base = root) {
    const [config, editorial] = await Promise.all([
        readFile(path.join(base, "organic-monitoring.json"), "utf8").then(JSON.parse),
        readFile(path.join(base, "editorial-program.json"), "utf8").then(JSON.parse)
    ]);
    const directory = path.join(base, config.reportsDirectory);
    const files = (await readdir(directory)).filter((file) => file.endsWith(".json")).sort();
    const clusterIds = new Set((editorial.clusters || []).map((cluster) => cluster.id));
    const errors = validateMonitoringConfiguration(config);

    if (config.version !== 1 || config.cadence !== "quarterly") {
        errors.push("configurazione del monitoraggio non supportata");
    }
    if (!config.allowedSources?.includes("Google Search Console") ||
        !config.metrics?.includes("impressions") ||
        !config.metrics?.includes("clicks") ||
        !config.privacy?.minimumGroupImpressions) {
        errors.push("configurazione aggregata incompleta");
    }
    for (const file of files) {
        const report = JSON.parse(await readFile(path.join(directory, file), "utf8"));
        errors.push(...validateOrganicReport(report, config, clusterIds).map((message) =>
            `${file}: ${message}`
        ));
    }
    return { errors, reports: files.length };
}

const invoked = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : "";
if (import.meta.url === invoked) {
    const result = await checkOrganicReports();
    if (result.errors.length) {
        console.error(result.errors.map((message) => `- ${message}`).join("\n"));
        process.exitCode = 1;
    } else {
        console.log(result.reports
            ? `Rapporti organici validi: ${result.reports}.`
            : "Monitoraggio organico completato; primo export operativo previsto non prima del 9 novembre 2026."
        );
    }
}
