import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const adminHtml = await readFile(new URL("../admin.html", import.meta.url), "utf8");
const styleCss = await readFile(new URL("../style.css", import.meta.url), "utf8");

function attribute(tag, name) {
    return tag.match(new RegExp(`\\b${name}="([^"]+)"`, "u"))?.[1] || "";
}

test("l’indice amministrativo collega attività chiare a sezioni esistenti", () => {
    const navigation = adminHtml.match(
        /<nav class="admin-sezioni"[\s\S]*?<\/nav>/u
    )?.[0];

    assert.ok(navigation, "manca la navigazione delle sezioni amministrative");
    assert.match(navigation, /aria-labelledby="adminSezioniTitolo"/u);

    const links = [...navigation.matchAll(/<a\s+[^>]*href="#([^"]+)"[^>]*>([^<]+)<\/a>/gu)];
    assert.equal(links.length, 8);

    for (const [, target, label] of links) {
        assert.ok(label.trim().length >= 3, `etichetta poco chiara per #${target}`);
        assert.match(adminHtml, new RegExp(`\\bid="${target}"`, "u"), `destinazione #${target} assente`);
    }
});

test("gli identificativi del pannello sono univoci e le sezioni hanno un titolo associato", () => {
    const tagsWithId = [...adminHtml.matchAll(/<[^>]+\bid="[^"]+"[^>]*>/gu)].map((match) => match[0]);
    const ids = tagsWithId.map((tag) => attribute(tag, "id"));
    assert.equal(new Set(ids).size, ids.length, "il pannello contiene ID duplicati");

    for (const section of adminHtml.matchAll(/<section\s+[^>]*aria-labelledby="([^"]+)"[^>]*>/gu)) {
        assert.match(adminHtml, new RegExp(`\\bid="${section[1]}"`, "u"), `titolo #${section[1]} assente`);
    }
});

test("la navigazione resta leggibile da tastiera e smartphone", () => {
    assert.match(styleCss, /\.admin-sezioni a\s*\{[\s\S]*?min-height:\s*2\.75rem/u);
    assert.match(styleCss, /\.admin-sezioni a:focus-visible/u);
    assert.match(
        styleCss,
        /@media \(max-width:\s*560px\)[\s\S]*?\.admin-sezioni ul\s*\{[\s\S]*?grid-template-columns:\s*1fr/u
    );
});

test("la pagina amministrativa resta esclusa dall’indicizzazione", () => {
    assert.match(adminHtml, /<meta name="robots" content="noindex, nofollow">/u);
});
