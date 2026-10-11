import { readFile } from "node:fs/promises";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const [program, manifest, seo] = await Promise.all([
    readJson("editorial-program.json"),
    readJson("public-content-manifest.json"),
    readJson("seo.config.json")
]);
const errors = [];
const evidenceTypes = new Set(["fonte", "testimonianza", "interpretazione"]);
const wikis = new Set((manifest.wiki || []).map((entry) => entry.path));
const published = new Set([
    ...wikis,
    ...(manifest.places || []).map((entry) => entry.path),
    ...(seo.indexablePages || []).map((entry) => entry.path)
]);

function fail(message) {
    errors.push(message);
}

async function readJson(relativePath) {
    return JSON.parse(await readFile(path.join(root, relativePath), "utf8"));
}

if (program.version !== 1) fail("versione del programma non supportata");
if (program.siteOrigin !== seo.siteOrigin) fail("origine diversa dalla configurazione SEO");
if (program.timezone !== "Europe/Rome") fail("fuso orario editoriale inatteso");

const definedEvidence = new Set(Object.keys(program.evidenceTypes || {}));
for (const type of evidenceTypes) {
    if (!definedEvidence.has(type) || !String(program.evidenceTypes[type] || "").trim()) {
        fail(`definizione probatoria mancante: ${type}`);
    }
}
for (const type of definedEvidence) {
    if (!evidenceTypes.has(type)) fail(`categoria probatoria non ammessa: ${type}`);
}

if (!Array.isArray(program.privacyRules) || program.privacyRules.length < 4) {
    fail("regole privacy insufficienti");
}

const clusters = new Map();
for (const cluster of program.clusters || []) {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(cluster.id || "")) {
        fail(`identificativo cluster non valido: ${cluster.id || "(vuoto)"}`);
        continue;
    }
    if (clusters.has(cluster.id)) fail(`cluster duplicato: ${cluster.id}`);
    clusters.set(cluster.id, cluster);
    if (!cluster.label || !published.has(cluster.pillarPath)) {
        fail(`${cluster.id}: etichetta o pagina pilastro non valida`);
    }
    if (!Array.isArray(cluster.publishedPaths) || !cluster.publishedPaths.length) {
        fail(`${cluster.id}: nessuna pagina pubblicata`);
    }
    for (const pagePath of cluster.publishedPaths || []) {
        if (!published.has(pagePath)) fail(`${cluster.id}: URL non censito ${pagePath}`);
    }
    if (!Array.isArray(cluster.sourceSeedIds) || !cluster.sourceSeedIds.length) {
        fail(`${cluster.id}: nessuna fonte iniziale`);
    }
}

for (const wikiPath of wikis) {
    if (![...clusters.values()].some((cluster) =>
        cluster.publishedPaths?.includes(wikiPath)
    )) {
        fail(`Voce senza cluster: ${wikiPath}`);
    }
}

const relationshipDegree = new Map([...wikis].map((wikiPath) => [wikiPath, 0]));
const relationshipKeys = new Set();
for (const relationship of program.relationships || []) {
    const key = `${relationship.from}\n${relationship.to}`;
    if (relationshipKeys.has(key)) fail(`relazione duplicata: ${relationship.from} → ${relationship.to}`);
    relationshipKeys.add(key);
    if (!wikis.has(relationship.from) || !wikis.has(relationship.to)) {
        fail(`relazione fra Voci non censite: ${relationship.from} → ${relationship.to}`);
    }
    if (relationship.from === relationship.to) fail(`relazione autoreferenziale: ${relationship.from}`);
    if (!String(relationship.label || "").trim()) fail(`relazione senza etichetta: ${key}`);
    if (relationshipDegree.has(relationship.from)) {
        relationshipDegree.set(relationship.from, relationshipDegree.get(relationship.from) + 1);
    }
    if (relationshipDegree.has(relationship.to)) {
        relationshipDegree.set(relationship.to, relationshipDegree.get(relationship.to) + 1);
    }
}
for (const [wikiPath, degree] of relationshipDegree) {
    if (!degree) fail(`Voce isolata dal grafo editoriale: ${wikiPath}`);
}

let previousDate = "";
const calendarKeys = new Set();
for (const item of program.calendar || []) {
    if (!/^\d{4}-\d{2}-\d{2}$/u.test(item.date || "") || Number.isNaN(Date.parse(`${item.date}T00:00:00Z`))) {
        fail(`data non valida: ${item.date || "(vuota)"}`);
    }
    if (previousDate && item.date < previousDate) fail("calendario non ordinato per data");
    previousDate = item.date;
    if (!clusters.has(item.clusterId)) fail(`${item.date}: cluster sconosciuto ${item.clusterId}`);
    if (!published.has(item.target) && !/^draft:[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(item.target || "")) {
        fail(`${item.date}: destinazione non valida ${item.target || "(vuota)"}`);
    }
    if (!String(item.deliverable || "").trim()) fail(`${item.date}: risultato atteso assente`);
    if (!Array.isArray(item.requiredEvidence) || !item.requiredEvidence.length) {
        fail(`${item.date}: verifiche probatorie assenti`);
    }
    for (const type of item.requiredEvidence || []) {
        if (!evidenceTypes.has(type)) fail(`${item.date}: categoria probatoria sconosciuta ${type}`);
    }
    const key = `${item.date}\n${item.target}`;
    if (calendarKeys.has(key)) fail(`attività duplicata: ${item.date} ${item.target}`);
    calendarKeys.add(key);
}
if (!(program.calendar || []).length) fail("calendario vuoto");

if (errors.length) {
    console.error(errors.map((message) => `- ${message}`).join("\n"));
    process.exitCode = 1;
} else {
    console.log(
        `Programma editoriale valido: ${clusters.size} cluster, ` +
        `${wikis.size} Voci collegate, ${program.calendar.length} attività.`
    );
}
