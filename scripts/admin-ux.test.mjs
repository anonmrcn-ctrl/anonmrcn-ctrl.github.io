import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const adminHtml = await readFile(new URL("../admin.html", import.meta.url), "utf8");
const adminJs = await readFile(new URL("../admin.js", import.meta.url), "utf8");
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
    assert.equal(links.length, 9);

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

test("feedback e conflitti usano messaggi comprensibili senza cancellare i moduli", () => {
    assert.match(adminJs, /error\?\.status === 401/u);
    assert.match(adminJs, /error\?\.status === 409/u);
    assert.match(adminJs, /Le tue modifiche sono ancora nel modulo/u);
    assert.match(adminJs, /Accesso ripristinato[\s\S]*modifiche non salvate/u);
    assert.match(adminJs, /hasUnsavedAdminChanges\(\)/u);
    assert.match(adminJs, /beforeunload/u);
});

test("gli stati di attesa, riuscita ed errore sono annunciati e visibili", () => {
    for (const state of ["busy", "success", "error"]) {
        assert.match(adminJs, new RegExp(`return "${state}"`, "u"));
        assert.match(styleCss, new RegExp(`data-state="${state}"`, "u"));
    }
    assert.match(adminJs, /aria-atomic/u);
    assert.match(adminJs, /setAttribute\("role", "status"\)/u);
    assert.match(adminJs, /Modifiche non ancora salvate\./u);
});

test("l’audit browser copre smartphone, desktop, tastiera e moduli", async () => {
    const e2e = await readFile(new URL("./admin-ui.e2e.mjs", import.meta.url), "utf8");
    assert.match(e2e, /width: 375, height: 812/u);
    assert.match(e2e, /width: 1440, height: 1000/u);
    assert.match(e2e, /page\.keyboard\.press\("Enter"\)/u);
    assert.match(e2e, /controlli senza etichetta/u);
    assert.match(e2e, /pulsanti inferiori a 44px/u);
    assert.match(e2e, /data-state='busy'/u);
    assert.match(e2e, /data-state='success'/u);
});
