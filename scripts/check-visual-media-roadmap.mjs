import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const defaultPath = path.join(root, "docs", "cms", "visual-media-roadmap.json");

export function validateVisualMediaRoadmap(roadmap) {
    const errors = [];
    const statuses = new Set(roadmap.allowedStatuses || []);
    const units = Array.isArray(roadmap.units) ? roadmap.units : [];
    const ids = new Set();

    if (roadmap.version !== 1) errors.push("versione non supportata");
    if (!roadmap.objective?.trim()) errors.push("obiettivo mancante");
    if (!statuses.has("pending") || !statuses.has("in_progress") ||
        !statuses.has("complete") || !statuses.has("blocked")) {
        errors.push("stati obbligatori mancanti");
    }
    if (!Array.isArray(roadmap.guardrails) || roadmap.guardrails.length < 6) {
        errors.push("guardrail insufficienti");
    }

    let active = 0;
    for (const [index, unit] of units.entries()) {
        const expectedId = `14.${index}`;
        if (unit.id !== expectedId) errors.push(`ordine non valido: atteso ${expectedId}`);
        if (!unit.id || ids.has(unit.id)) errors.push(`ID duplicato o mancante: ${unit.id || "?"}`);
        ids.add(unit.id);
        if (!statuses.has(unit.status)) errors.push(`stato non valido per ${unit.id}`);
        if (unit.status === "in_progress") active += 1;
        if (!Array.isArray(unit.deliverables) || !unit.deliverables.length) {
            errors.push(`deliverable mancanti per ${unit.id}`);
        }
        if (!Array.isArray(unit.acceptance) || unit.acceptance.length < 2) {
            errors.push(`criteri insufficienti per ${unit.id}`);
        }
        for (const dependency of unit.dependsOn || []) {
            const dependencyIndex = units.findIndex((candidate) => candidate.id === dependency);
            if (dependencyIndex < 0 || dependencyIndex >= index) {
                errors.push(`dipendenza non valida per ${unit.id}: ${dependency}`);
            }
            if (unit.status === "complete" && units[dependencyIndex]?.status !== "complete") {
                errors.push(`dipendenza incompleta per ${unit.id}: ${dependency}`);
            }
        }
    }

    if (active > 1) errors.push("più unità in corso");
    const firstOpen = units.find((unit) => unit.status !== "complete")?.id || null;
    if (roadmap.currentUnit !== firstOpen) {
        errors.push(`currentUnit non coerente: atteso ${firstOpen || "null"}`);
    }
    const expectedStatus = firstOpen ? "planned" : "complete";
    if (roadmap.status !== expectedStatus && !(firstOpen && roadmap.status === "in_progress")) {
        errors.push(`stato complessivo non coerente: atteso ${expectedStatus}`);
    }
    return errors;
}

export async function checkVisualMediaRoadmap(file = defaultPath) {
    const roadmap = JSON.parse(await readFile(file, "utf8"));
    const errors = validateVisualMediaRoadmap(roadmap);
    if (errors.length) {
        throw new Error(`Roadmap anteprima/media/audio/video non valida:\n${errors.join("\n")}`);
    }
    return roadmap;
}

const invoked = process.argv[1] ? path.resolve(process.argv[1]) : "";
if (fileURLToPath(import.meta.url) === invoked) {
    const roadmap = await checkVisualMediaRoadmap();
    console.log(
        `Roadmap anteprima/media/audio/video valida: ${roadmap.units.length} unità; ` +
        `prima unità aperta ${roadmap.currentUnit || "nessuna"}.`
    );
}
