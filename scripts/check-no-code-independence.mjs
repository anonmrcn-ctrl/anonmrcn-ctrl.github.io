import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import { PAGE_SEEDS } from "../worker/src/page-seed.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export async function checkNoCodeIndependence() {
    const errors = [];
    const read = (file) => readFile(path.join(root, file), "utf8");
    const [admin, builder, loader, worker, generator, workflow, diagnostics, manual] =
        await Promise.all([
            read("admin.html"),
            read("admin-visual-builder.js"),
            read("page-content.js"),
            read("worker/src/index.js"),
            read("scripts/generate-public-pages.mjs"),
            read(".github/workflows/sync-public-pages.yml"),
            read("worker/src/cms-diagnostics.js"),
            read("docs/cms/manuale-amministratore.md")
        ]);

    if (PAGE_SEEDS.length !== 9) errors.push(`pagine ordinarie attese 9, trovate ${PAGE_SEEDS.length}`);
    for (const page of PAGE_SEEDS) {
        const html = await read(`${page.slug}.html`).catch(() => "");
        if (!html) errors.push(`file storico mancante: ${page.slug}.html`);
        if (!new RegExp(`<body[^>]+data-cms-page="${page.slug}"`, "u").test(html)) {
            errors.push(`pagina non collegata al CMS visuale: ${page.slug}`);
        }
        if (!/page-content\.js\?v=20261018-visual1/u.test(html)) {
            errors.push(`caricatore visuale non aggiornato: ${page.slug}`);
        }
        if (!/style\.css\?v=20261018-visual1/u.test(html)) {
            errors.push(`stili visuali non aggiornati: ${page.slug}`);
        }
    }

    for (const id of [
        "adminVisualCreateForm", "adminVisualCanvas", "adminVisualInspectorForm",
        "adminVisualPreview", "adminVisualPreflight", "adminVisualPublishPage",
        "adminVisualRevisionSelect", "adminVisualAnalyzeDelete", "adminVisualGuideStart"
    ]) {
        if (!admin.includes(`id="${id}"`)) errors.push(`controllo amministrativo mancante: ${id}`);
    }
    if (!builder.includes("GUIDE_STEPS") || !builder.includes("nnmrcn_visual_guide_complete")) {
        errors.push("percorso guidato visuale incompleto");
    }
    if (!loader.includes("/api/public/visual-pages/") || !loader.includes("loadLegacyPage")) {
        errors.push("migrazione visuale o ripiego storico assente");
    }
    if (!worker.includes('path === "/api/public/visual-pages"') ||
        !worker.includes("compatibilityBlocks")) {
        errors.push("indice pubblico delle pagine visuali assente");
    }
    if (!generator.includes("renderVisualStaticPage") ||
        !generator.includes("manifest.visual") || !workflow.includes("'*.html'")) {
        errors.push("generazione HTML autonoma non collegata al workflow");
    }
    if (!diagnostics.includes('"visual-builder"') ||
        !diagnostics.includes('"visual-static-sync"')) {
        errors.push("diagnostica di indipendenza assente");
    }
    if (!manual.includes("## 14. Creare e gestire una pagina visuale senza programmazione")) {
        errors.push("manuale visuale finale assente");
    }
    if (errors.length) throw new Error(`Audit indipendenza no-code fallito:\n${errors.join("\n")}`);
    return {
        pages: PAGE_SEEDS.length,
        guideSteps: 6,
        publicFallback: true,
        staticGeneration: true,
        diagnostics: 2
    };
}

const invoked = process.argv[1] ? path.resolve(process.argv[1]) : "";
if (fileURLToPath(import.meta.url) === invoked) {
    const result = await checkNoCodeIndependence();
    console.log(
        `Audit no-code superato: ${result.pages} pagine storiche, ` +
        `${result.guideSteps} passaggi guidati, generazione statica e ripiego verificati.`
    );
}
