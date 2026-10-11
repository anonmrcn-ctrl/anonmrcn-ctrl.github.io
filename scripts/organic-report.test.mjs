import assert from "node:assert/strict";
import test from "node:test";

import { validateOrganicReport } from "./check-organic-report.mjs";

const config = {
    version: 1,
    allowedSources: ["Google Search Console"],
    metrics: ["impressions", "clicks"],
    privacy: {
        minimumGroupImpressions: 20,
        prohibitedFields: ["query", "url", "visitorId", "ip", "token", "qr"]
    }
};
const clusters = new Set(["acque-e-bonifiche"]);
const comparison = (current, baseline) => ({
    current,
    baseline,
    delta: current - baseline
});

function validReport() {
    return {
        version: 1,
        period: { label: "2027-Q1", start: "2027-01-01", end: "2027-03-31" },
        sources: ["Google Search Console"],
        baseline: { label: "baseline", start: "2026-10-01", end: "2026-12-29" },
        overall: { impressions: comparison(200, 100), clicks: comparison(20, 10) },
        clusters: [{
            id: "acque-e-bonifiche",
            metrics: { impressions: comparison(80, 40), clicks: comparison(8, 4) }
        }],
        excludedGroups: [],
        editorialDecisions: ["Consolidare i collegamenti fra le Voci del cluster."]
    };
}

test("accetta soltanto confronti aggregati coerenti", () => {
    assert.deepEqual(validateOrganicReport(validReport(), config, clusters), []);
});

test("rifiuta query grezze, gruppi piccoli e delta manipolati", () => {
    const report = validReport();
    report.clusters[0].query = "nome e cognome";
    report.clusters[0].metrics.impressions.current = 5;
    report.overall.clicks.delta = 99;
    const errors = validateOrganicReport(report, config, clusters);

    assert.ok(errors.some((message) => message.includes("campo vietato")));
    assert.ok(errors.some((message) => message.includes("soglia di aggregazione")));
    assert.ok(errors.some((message) => message.includes("delta non coerente")));
});
