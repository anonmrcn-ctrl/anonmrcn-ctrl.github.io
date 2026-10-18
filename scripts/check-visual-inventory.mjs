import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const inventoryPath = path.join(root, "docs", "cms", "visual-component-inventory.json");
const contractPath = path.join(root, "docs", "cms", "block-contract.json");
const contentInventoryPath = path.join(root, "docs", "cms", "content-inventory.json");

async function listHtmlFiles() {
    const files = (await readdir(root)).filter((file) => file.endsWith(".html"));
    for (const directory of ["luoghi", "voci"]) {
        for (const file of await readdir(path.join(root, directory))) {
            if (file.endsWith(".html")) files.push(`${directory}/${file}`);
        }
    }
    return files.sort();
}

function sameItems(actual, expected) {
    return JSON.stringify([...actual].sort()) === JSON.stringify([...expected].sort());
}

export async function validateVisualInventory(inventory, contract, contentInventory) {
    const errors = [];
    const actualHtml = await listHtmlFiles();
    const domains = contract.domains || {};
    const propertySets = contract.propertySets || {};
    const categories = contract.categories || {};
    const blockTypes = Array.isArray(contract.blockTypes) ? contract.blockTypes : [];
    const blockIds = new Set(blockTypes.map((block) => block.id));

    if (inventory.version !== 1) errors.push("versione inventario non supportata");
    if (contract.version !== 2) errors.push("versione contratto non supportata");
    if (contract.compatibleContentSchema !== 5) errors.push("schema contenuti incompatibile");
    if (contract.limits?.maxDepth < 1 || contract.limits?.maxDepth > 12) errors.push("limite profondità non valido");
    if (contract.limits?.maxChildrenPerNode < 1 || contract.limits?.maxChildrenPerNode > 500) errors.push("limite figli non valido");

    for (const name of ["content", "presentation", "behavior"]) {
        if (domains[name]?.editable !== true) errors.push(`dominio editoriale non modificabile: ${name}`);
    }
    if (domains.technical?.editable !== false) errors.push("il dominio technical deve restare non modificabile");
    for (const [name, definition] of Object.entries(propertySets)) {
        if (!domains[definition.domain]) errors.push(`dominio sconosciuto per ${name}`);
        if (!Array.isArray(definition.properties) || !definition.properties.length) errors.push(`proprietà mancanti per ${name}`);
        if (definition.domain === "technical" && domains.technical?.editable !== false) errors.push(`insieme tecnico modificabile: ${name}`);
    }
    for (const [name, definition] of Object.entries(categories)) {
        for (const child of definition.allowedChildren || []) {
            if (!categories[child]) errors.push(`categoria figlia sconosciuta per ${name}: ${child}`);
        }
    }
    if (blockIds.size !== blockTypes.length) errors.push("ID di blocco duplicati");
    for (const block of blockTypes) {
        if (!categories[block.category]) errors.push(`categoria sconosciuta per ${block.id}`);
        for (const propertySet of block.propertySets || []) {
            if (!propertySets[propertySet]) errors.push(`insieme proprietà sconosciuto per ${block.id}: ${propertySet}`);
        }
    }

    for (const [name, definition] of Object.entries(inventory.ownershipDomains || {})) {
        if (definition.editable !== domains[name]?.editable) errors.push(`confine incoerente per ${name}`);
    }
    const inventoriedHtml = (inventory.pageFamilies || []).flatMap((family) => family.files || []);
    if (!sameItems(inventoriedHtml, actualHtml)) errors.push("la copertura delle pagine HTML non è completa o contiene duplicati");
    for (const file of inventoriedHtml) {
        if (!actualHtml.includes(file)) errors.push(`pagina inventariata inesistente: ${file}`);
    }

    const adminHtml = await readFile(path.join(root, "admin.html"), "utf8");
    for (const module of inventory.adminModules || []) {
        if (!adminHtml.includes(`id="${module.anchor}"`)) errors.push(`modulo amministrativo non trovato: ${module.anchor}`);
    }
    const areas = (contentInventory.areas || []).map((area) => area.id);
    const coveredAreas = (inventory.contentAreaCoverage || []).map((entry) => entry.area);
    if (!sameItems(coveredAreas, areas)) errors.push("la copertura dell'inventario contenuti non è completa o contiene duplicati");

    const targets = [
        ...(inventory.pageFamilies || []),
        ...(inventory.globalComponents || []),
        ...(inventory.adminModules || []),
        ...(inventory.contentAreaCoverage || [])
    ];
    for (const owner of targets) {
        for (const target of owner.targetBlocks || []) {
            if (!blockIds.has(target)) errors.push(`tipo di blocco sconosciuto nell'inventario: ${target}`);
        }
    }

    const forbidden = new Set(contract.forbiddenEditorInputs || []);
    for (const input of ["html", "css", "javascript", "sql", "endpoint", "secret", "token"]) {
        if (!forbidden.has(input)) errors.push(`input tecnico non vietato: ${input}`);
    }
    if ((contract.compatibility?.preserve || []).length < 8) errors.push("garanzie di compatibilità insufficienti");
    return errors;
}

export async function checkVisualInventory() {
    const [inventory, contract, contentInventory] = await Promise.all([
        readFile(inventoryPath, "utf8").then(JSON.parse),
        readFile(contractPath, "utf8").then(JSON.parse),
        readFile(contentInventoryPath, "utf8").then(JSON.parse)
    ]);
    const errors = await validateVisualInventory(inventory, contract, contentInventory);
    if (errors.length) throw new Error(`Inventario visuale non valido:\n${errors.join("\n")}`);
    return {
        pages: (inventory.pageFamilies || []).flatMap((family) => family.files || []).length,
        families: inventory.pageFamilies?.length || 0,
        adminModules: inventory.adminModules?.length || 0,
        areas: inventory.contentAreaCoverage?.length || 0,
        blockTypes: contract.blockTypes?.length || 0
    };
}

const invoked = process.argv[1] ? path.resolve(process.argv[1]) : "";
if (fileURLToPath(import.meta.url) === invoked) {
    const result = await checkVisualInventory();
    console.log(
        `Inventario visuale valido: ${result.pages} pagine in ${result.families} famiglie, ` +
        `${result.adminModules} moduli amministrativi, ${result.areas} aree e ${result.blockTypes} tipi di blocco.`
    );
}
