import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
    parseLinkEntries,
    validateBehaviorRelationships,
    validateBehaviorValues
} from "../src/visual-builder-behaviors.js";
import { normalizeInspectorValues } from "../src/visual-builder-inspector.js";
import { renderVisualPage } from "../src/visual-builder-renderer.js";

function property(node, propertySet, name, value, position = 0) {
    return {
        node_id: node,
        domain: propertySet.split(".")[0],
        property_set: propertySet,
        property_name: name,
        breakpoint: "all",
        item_position: position,
        value_kind: name === "href" ? "url" : "text",
        text_value: value,
        number_value: null,
        boolean_value: null,
        asset_id: null,
        page_reference_id: null,
        collection_key: null
    };
}

test("normalizza soltanto comportamenti dichiarativi e privati per impostazione predefinita", () => {
    const collection = normalizeInspectorValues("data-collection", {});
    assert.equal(collection.values.collectionSource, "public-pages");
    assert.equal(collection.values.collectionDisplay, "list");
    assert.equal(collection.values.collectionLimit, "12");
    assert.equal(collection.values.externalService, "none");
    assert.equal(collection.values.telemetry, "off");

    const form = normalizeInspectorValues("approved-form", {});
    assert.equal(form.values.formType, "memory-submission");
    assert.equal(form.values.consentMode, "required");
    assert.equal(form.values.consentDocument, "privacy-current");
    assert.equal(form.values.externalService, "none");
    assert.equal(form.values.telemetry, "off");

    assert.throws(() => normalizeInspectorValues("data-collection", {
        collectionSource: "remote-endpoint",
        externalService: "none",
        telemetry: "off"
    }), /Valore non valido/u);
    assert.throws(() => normalizeInspectorValues("approved-form", {
        externalService: "analytics-vendor"
    }), /Valore non valido/u);
    assert.throws(() => normalizeInspectorValues("data-filter", {
        targetCollection: "collection-one",
        filterSource: "public-pages",
        filterMode: "text",
        externalService: "none",
        telemetry: "anonymous"
    }), /Valore non valido/u);
    assert.throws(() => normalizeInspectorValues("button", {
        title: "Esegui",
        href: "javascript:alert(1)",
        openMode: "same-window"
    }), /destinazione/u);
    assert.throws(() => validateBehaviorValues("approved-form", {
        formType: "memory-submission",
        consentMode: "optional",
        externalService: "none",
        telemetry: "off"
    }), /consenso esplicito/u);
});

test("valida ancore, collegamenti e relazioni fra filtro e raccolta", () => {
    assert.deepEqual(parseLinkEntries("Progetto | ./progetto.html\nFonti | #fonti"), [
        { label: "Progetto", href: "./progetto.html" },
        { label: "Fonti", href: "#fonti" }
    ]);
    assert.throws(() => parseLinkEntries("javascript:alert(1)"), /formato/u);
    assert.throws(() => parseLinkEntries("Male | javascript:alert(1)"), /destinazione sicura/u);

    const nodes = [
        { id: "collection-one", block_type: "data-collection" },
        { id: "filter-one", block_type: "data-filter" },
        { id: "section-one", block_type: "section" }
    ];
    const properties = [
        property("collection-one", "behavior.collection", "source", "public-voices"),
        property("section-one", "behavior.link", "anchorId", "voci")
    ];
    assert.doesNotThrow(() => validateBehaviorRelationships(
        "data-filter",
        "filter-one",
        { targetCollection: "collection-one", filterSource: "public-voices" },
        nodes,
        properties
    ));
    assert.throws(() => validateBehaviorRelationships(
        "data-filter",
        "filter-one",
        { targetCollection: "collection-one", filterSource: "public-pages" },
        nodes,
        properties
    ), /stessa sorgente/u);
    assert.throws(() => validateBehaviorRelationships(
        "section",
        "section-two",
        { anchorId: "voci" },
        nodes,
        properties
    ), /già usata/u);
});

test("renderizza interazioni prevalidate senza script o endpoint configurabili", () => {
    const nodes = [
        ["root", null, 1, "page-root"],
        ["section", "root", 1, "section"],
        ["heading", "section", 1, "heading"],
        ["button", "root", 2, "button"],
        ["links", "root", 3, "link-list"],
        ["collection-one", "root", 4, "data-collection"],
        ["filter-one", "root", 5, "data-filter"],
        ["form", "root", 6, "approved-form"]
    ].map(([id, parent_id, position, block_type]) => ({ id, parent_id, position, block_type }));
    const properties = [
        property("root", "content.copy", "title", "Pagina interattiva"),
        property("section", "behavior.link", "anchorId", "introduzione"),
        property("heading", "content.copy", "title", "Introduzione"),
        property("heading", "behavior.link", "anchorId", "titolo-introduzione"),
        property("button", "content.copy", "title", "Apri il progetto"),
        property("button", "behavior.link", "href", "https://example.org/progetto"),
        property("button", "behavior.link", "openMode", "new-window"),
        property("links", "behavior.link", "href", "Home | ./index.html", 1),
        property("links", "behavior.link", "href", "Introduzione | #introduzione", 2),
        property("collection-one", "behavior.collection", "source", "public-voices"),
        property("collection-one", "behavior.collection", "display", "cards"),
        property("collection-one", "behavior.collection", "limit", "12"),
        property("collection-one", "behavior.collection", "externalService", "none"),
        property("collection-one", "behavior.collection", "telemetry", "off"),
        property("filter-one", "behavior.collection", "source", "public-voices"),
        property("filter-one", "behavior.collection", "filterMode", "text"),
        property("filter-one", "behavior.collection", "targetCollection", "collection-one"),
        property("filter-one", "behavior.collection", "externalService", "none"),
        property("filter-one", "behavior.collection", "telemetry", "off"),
        property("form", "behavior.form", "formType", "memory-submission"),
        property("form", "behavior.form", "consentDocumentId", "privacy-current"),
        property("form", "behavior.form", "consentMode", "required"),
        property("form", "behavior.form", "externalService", "none"),
        property("form", "behavior.form", "telemetry", "off")
    ];
    const rendered = renderVisualPage({
        page: { id: "page-interactive", slug: "interactive", title: "Interattiva", status: "published" },
        nodes,
        properties,
        adapterPayloads: new Map([["collection-one", {
            kind: "data-collection",
            source: "public-voices",
            items: [{
                id: "voice-one",
                title: "Voce sicura",
                description: "<script>non eseguire</script>",
                href: "./voci/voce-sicura.html"
            }]
        }]])
    });

    assert.equal(rendered.registryVersion, 2);
    assert.equal(rendered.behaviorVersion, 1);
    assert.match(rendered.html, /id="introduzione"/u);
    assert.match(rendered.html, /target="_blank" rel="noopener noreferrer"/u);
    assert.match(rendered.html, /data-external-link="true"/u);
    assert.match(rendered.html, /<a href="\.\/index\.html">Home<\/a>/u);
    assert.match(rendered.html, /data-collection-source="public-voices"/u);
    assert.match(rendered.html, /data-collection-item/u);
    assert.match(rendered.html, /&lt;script&gt;non eseguire&lt;\/script&gt;/u);
    assert.match(rendered.html, /data-filter-target="collection-one"/u);
    assert.match(rendered.html, /aria-controls="collection-one"/u);
    assert.match(rendered.html, /data-consent-mode="required"/u);
    assert.match(rendered.html, /data-external-service="none"/u);
    assert.match(rendered.html, /data-telemetry="off"/u);
    assert.doesNotMatch(rendered.html, /<script|javascript:|data-endpoint|style=/iu);
});

test("il pannello offre controlli visuali e riferimenti selezionabili", async () => {
    const source = await readFile(new URL("../../admin-visual-builder.js", import.meta.url), "utf8");
    const runtime = await readFile(new URL("../../visual-behaviors.js", import.meta.url), "utf8");
    const inspector = await readFile(new URL("../src/visual-builder-inspector.js", import.meta.url), "utf8");
    const behaviors = await readFile(new URL("../src/visual-builder-behaviors.js", import.meta.url), "utf8");
    assert.match(source, /field\.control === "node-reference"/u);
    assert.match(source, /candidate\.type === "data-collection"/u);
    assert.match(source, /field\.defaultValue/u);
    assert.match(behaviors, /Nessun servizio esterno/u);
    assert.match(behaviors, /Consenso esplicito obbligatorio/u);
    assert.doesNotMatch(inspector, /control.*(?:html|javascript|sql)/iu);
    assert.match(runtime, /data-filter-target/u);
    assert.match(runtime, /data-collection-item/u);
    assert.match(runtime, /item\.hidden = !matches/u);
    assert.doesNotMatch(runtime, /\bfetch\b|eval\(|new Function/u);
});
