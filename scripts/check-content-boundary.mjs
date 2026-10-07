import { access, readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const root = path.resolve(import.meta.dirname, "..");
const manifestPath = path.join(
    root,
    "docs",
    "cms",
    "content-inventory.json"
);
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
const allowedClassifications = new Set([
    "content",
    "protected-content",
    "moderated-content",
    "software"
]);
const ids = new Set();
const missingPaths = [];

if (manifest.version !== 1 || !Array.isArray(manifest.areas)) {
    throw new Error("Manifesto CMS non valido.");
}

for (const area of manifest.areas) {
    if (!area.id || ids.has(area.id)) {
        throw new Error(`Identificativo CMS mancante o duplicato: ${area.id || "?"}`);
    }

    ids.add(area.id);

    if (!allowedClassifications.has(area.classification)) {
        throw new Error(`Classificazione non valida per ${area.id}.`);
    }

    if (!Array.isArray(area.currentSources) || !area.currentSources.length) {
        throw new Error(`Nessun file inventariato per ${area.id}.`);
    }

    if (!Array.isArray(area.targetEntities)) {
        throw new Error(`Entità di destinazione non valide per ${area.id}.`);
    }

    for (const source of area.currentSources) {
        if (source.startsWith("D1:") || source.includes("*")) {
            continue;
        }

        const relativePath = source.split("#", 1)[0];

        try {
            await access(path.join(root, relativePath));
        } catch {
            missingPaths.push(`${area.id}: ${relativePath}`);
        }
    }
}

if (missingPaths.length) {
    throw new Error(`Percorsi mancanti:\n${missingPaths.join("\n")}`);
}

console.log(
    `Confine CMS valido: ${manifest.areas.length} aree, ` +
    `${manifest.areas.filter((area) => area.classification === "software").length} software, ` +
    `${manifest.areas.filter((area) => area.classification !== "software").length} contenuto.`
);
