import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { checkVisualInventory, validateVisualInventory } from "./check-visual-inventory.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("l'inventario pubblicato copre sito, pannello e contratto", async () => {
    assert.deepEqual(await checkVisualInventory(), {
        pages: 21,
        families: 14,
        adminModules: 17,
        areas: 18,
        blockTypes: 41
    });
});

test("il validatore rifiuta confini tecnici e destinazioni sconosciute", async () => {
    const [inventory, contract, contentInventory] = await Promise.all([
        readFile(path.join(root, "docs/cms/visual-component-inventory.json"), "utf8").then(JSON.parse),
        readFile(path.join(root, "docs/cms/block-contract.json"), "utf8").then(JSON.parse),
        readFile(path.join(root, "docs/cms/content-inventory.json"), "utf8").then(JSON.parse)
    ]);
    const invalidInventory = structuredClone(inventory);
    const invalidContract = structuredClone(contract);
    invalidContract.domains.technical.editable = true;
    invalidContract.forbiddenEditorInputs = invalidContract.forbiddenEditorInputs.filter((item) => item !== "javascript");
    invalidInventory.pageFamilies[0].targetBlocks.push("script-libero");
    const errors = await validateVisualInventory(invalidInventory, invalidContract, contentInventory);
    assert.ok(errors.some((error) => error.includes("technical")));
    assert.ok(errors.some((error) => error.includes("script-libero")));
    assert.ok(errors.some((error) => error.includes("javascript")));
});
