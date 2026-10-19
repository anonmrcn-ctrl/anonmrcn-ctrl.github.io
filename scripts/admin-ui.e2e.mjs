import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const baseUrl = process.env.ADMIN_UI_BASE_URL ||
    "http://127.0.0.1:8000/admin.html";
const outputDirectory = new URL("../admin-ui-reports/", import.meta.url);
const channel = process.env.ADMIN_UI_CHROME_CHANNEL || "";

await mkdir(outputDirectory, { recursive: true });

const browser = await chromium.launch({
    headless: true,
    ...(channel ? { channel } : { executablePath: chromium.executablePath() })
});

async function auditViewport(name, viewport) {
    const context = await browser.newContext({
        locale: "it-IT",
        viewport
    });
    const page = await context.newPage();

    await page.route(/\/api\/admin\/auth\/status(?:\?.*)?$/u, (route) =>
        route.fulfill({
            contentType: "application/json",
            body: JSON.stringify({ configured: true })
        })
    );
    await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
    await page.locator("#adminPanel").evaluate((element) => {
        element.hidden = false;
    });

    const navigation = page.locator(".admin-sezioni");
    await navigation.scrollIntoViewIfNeeded();
    await navigation.screenshot({
        path: new URL(`admin-navigation-${name}.png`, outputDirectory).pathname
    });

    assert.equal(await navigation.locator("a").count(), 9);
    assert.equal(await navigation.getAttribute("aria-labelledby"), "adminSezioniTitolo");

    const horizontalOverflow = await page.evaluate(() =>
        document.documentElement.scrollWidth - document.documentElement.clientWidth
    );
    assert.ok(horizontalOverflow <= 1, `${name}: overflow orizzontale di ${horizontalOverflow}px`);

    const unlabeledControls = await page.locator(
        "#adminPanel input:not([type='hidden']), #adminPanel select, #adminPanel textarea"
    ).evaluateAll((controls) => controls
        .filter((control) => !control.closest("[hidden]"))
        .filter((control) => {
            if (control.getAttribute("aria-label") || control.getAttribute("aria-labelledby")) {
                return false;
            }
            if (control.id && document.querySelector(`label[for="${CSS.escape(control.id)}"]`)) {
                return false;
            }
            return !control.closest("label");
        })
        .map((control) => control.id || control.outerHTML.slice(0, 80))
    );
    assert.deepEqual(unlabeledControls, [], `${name}: controlli senza etichetta`);

    const shortButtons = await page.locator("#adminPanel button:visible").evaluateAll(
        (buttons) => buttons
            .map((button) => ({
                id: button.id,
                height: button.getBoundingClientRect().height
            }))
            .filter((button) => button.height < 43)
    );
    assert.deepEqual(shortButtons, [], `${name}: pulsanti inferiori a 44px`);

    const guideStart = page.locator("#adminVisualGuideStart");
    await guideStart.scrollIntoViewIfNeeded();
    await guideStart.click();
    const guidePanel = page.locator("#adminVisualGuidePanel");
    await guidePanel.waitFor({ state: "visible" });
    assert.equal(await page.locator("#adminVisualGuideProgress").textContent(), "Passaggio 1 di 6");
    for (let step = 2; step <= 6; step += 1) {
        await page.locator("#adminVisualGuideNext").click();
        assert.equal(
            await page.locator("#adminVisualGuideProgress").textContent(),
            `Passaggio ${step} di 6`
        );
    }
    await page.locator("#adminVisualGuideNext").click();
    assert.equal(await guidePanel.isHidden(), true);
    assert.equal(
        await page.evaluate(() => localStorage.getItem("nnmrcn_visual_guide_complete")),
        "1"
    );

    const firstNavigationLink = navigation.locator("a").first();
    await firstNavigationLink.focus();
    assert.equal(await firstNavigationLink.evaluate((element) =>
        element === document.activeElement
    ), true);
    await page.keyboard.press("Enter");
    assert.equal(new URL(page.url()).hash, "#admin-riepilogo");

    const title = page.locator("#adminPageTitle");
    await title.fill("Titolo di prova non inviato");
    assert.equal(await page.locator("#adminPageForm").getAttribute("data-dirty"), "true");
    await assert.doesNotReject(() => page.locator(
        "#adminPageForm .admin-modifiche"
    ).waitFor({ state: "visible" }));

    await page.locator("#adminPageStatus").evaluate((element) => {
        element.textContent = "Salvataggio della pagina…";
    });
    await page.locator("#adminPageStatus[data-state='busy']").waitFor();
    assert.equal(await page.locator("#adminPageForm").getAttribute("aria-busy"), "true");

    await page.locator("#adminPageStatus").evaluate((element) => {
        element.textContent = "Pagina salvata e revisione registrata.";
    });
    await page.locator("#adminPageStatus[data-state='success']").waitFor();
    assert.equal(await page.locator("#adminPageForm").getAttribute("data-dirty"), null);
    assert.equal(await page.locator("#adminPageForm").getAttribute("aria-busy"), null);

    await context.close();
}

async function auditLivePreview(name, viewport) {
    const context = await browser.newContext({
        locale: "it-IT",
        viewport
    });
    const page = await context.newPage();
    let previewPayload = null;
    const visualPage = {
        id: "page-test",
        slug: "test",
        title: "Pagina di prova",
        description: "Descrizione di prova",
        status: "draft",
        updatedAt: 100,
        publishedAt: null,
        canonicalPath: "/test.html",
        inNavigation: false,
        nodes: [
            {
                key: "root-test",
                parentKey: null,
                position: 1,
                type: "page-root",
                label: "Pagina",
                root: true,
                values: {}
            },
            {
                key: "heading-test",
                parentKey: "root-test",
                position: 1,
                type: "heading",
                label: "Titolo",
                root: false,
                values: { title: "Titolo salvato" }
            },
            {
                key: "image-test",
                parentKey: "root-test",
                position: 2,
                type: "image",
                label: "Immagine",
                root: false,
                values: { assetId: "", alt: "", caption: "", credit: "", focalPoint: "center" }
            },
            {
                key: "gallery-test", parentKey: "root-test", position: 3,
                type: "gallery", label: "Galleria", root: false, values: { assetIds: "" }
            },
            {
                key: "audio-test", parentKey: "root-test", position: 4,
                type: "audio", label: "Audio", root: false,
                values: { audioAssetId: "", coverAssetId: "", title: "", text: "", transcript: "" }
            },
            {
                key: "video-test", parentKey: "root-test", position: 5,
                type: "video", label: "Video", root: false,
                values: { videoAssetId: "", posterAssetId: "", subtitleAssetId: "", title: "", text: "" }
            }
        ]
    };

    await page.route(/\/api\/admin\/auth\/status(?:\?.*)?$/u, (route) =>
        route.fulfill({ contentType: "application/json", body: "{\"configured\":true}" })
    );
    await page.route(/\/api\/admin\/cms\/visual-pages$/u, (route) =>
        route.fulfill({
            contentType: "application/json",
            body: JSON.stringify({
                pages: [visualPage],
                palette: ["heading", "image", "gallery", "audio", "video"].map((type) => ({
                    type, label: type, category: "content"
                })),
                inspectorSchemas: {
                    heading: [{
                        key: "title",
                        label: "Titolo",
                        control: "text",
                        propertyName: "text",
                        maxLength: 200,
                        required: true,
                        defaultValue: ""
                    }],
                    image: [
                        {
                            key: "assetId", label: "Immagine", control: "media-picker",
                            propertyName: "assetId", maxLength: 128, required: true,
                            defaultValue: "", format: "single"
                        },
                        {
                            key: "alt", label: "Testo alternativo", control: "text",
                            propertyName: "alt", maxLength: 300, required: true,
                            defaultValue: ""
                        }
                    ],
                    gallery: [{
                        key: "assetIds", label: "Immagini della galleria", control: "media-picker",
                        propertyName: "assetId", maxLength: 8192, required: true,
                        defaultValue: "", format: "lines", mediaKind: "image"
                    }],
                    audio: [{
                        key: "audioAssetId", label: "File audio", control: "media-picker",
                        propertyName: "audioAssetId", maxLength: 128, required: true,
                        defaultValue: "", format: "single", mediaKind: "audio"
                    }],
                    video: [
                        {
                            key: "videoAssetId", label: "File video", control: "media-picker",
                            propertyName: "videoAssetId", maxLength: 128, required: true,
                            defaultValue: "", format: "single", mediaKind: "video"
                        },
                        {
                            key: "posterAssetId", label: "Immagine poster", control: "media-picker",
                            propertyName: "posterAssetId", maxLength: 128, required: true,
                            defaultValue: "", format: "single", mediaKind: "image"
                        },
                        {
                            key: "subtitleAssetId", label: "Sottotitoli italiani", control: "media-picker",
                            propertyName: "subtitleAssetId", maxLength: 128, required: true,
                            defaultValue: "", format: "single", mediaKind: "subtitle"
                        }
                    ]
                }
            })
        })
    );
    await page.route(/\/api\/admin\/cms\/visual-sections$/u, (route) =>
        route.fulfill({ contentType: "application/json", body: "{\"sections\":[]}" })
    );
    await page.route(/\/api\/admin\/cms\/visual-themes$/u, (route) =>
        route.fulfill({
            contentType: "application/json",
            body: "{\"themes\":[],\"tokenSchema\":[],\"activeThemeId\":\"theme-default\"}"
        })
    );
    await page.route(/\/api\/admin\/cms\/visual-media$/u, (route) =>
        route.fulfill({
            contentType: "application/json",
            body: JSON.stringify({
                assets: [
                    {
                        id: "asset-browser-test", kind: "image", source: "voices",
                        name: "Immagine del test browser", mediaType: "image/webp", byteSize: 120,
                        width: 640, height: 480, alt: "Paesaggio di prova",
                        caption: "Didascalia di prova", thumbnailUrl: "/api/public/wiki-images/test?variant=small",
                        publicUrl: "/api/public/wiki-images/test", accessible: true, private: false
                    },
                    {
                        id: "audio-browser-test", kind: "audio", source: "visual-builder",
                        name: "Racconto audio", mediaType: "audio/mpeg", byteSize: 2048,
                        caption: "Descrizione audio", publicUrl: "/api/public/visual-media/audio-browser-test",
                        accessible: true, private: false
                    },
                    {
                        id: "video-browser-test", kind: "video", source: "visual-builder",
                        name: "Passeggiata video", mediaType: "video/mp4", byteSize: 4096,
                        caption: "Descrizione video", publicUrl: "/api/public/visual-media/video-browser-test",
                        accessible: true, private: false
                    },
                    {
                        id: "subtitle-browser-test", kind: "subtitle", source: "visual-builder",
                        name: "Sottotitoli italiani", mediaType: "text/vtt", byteSize: 120,
                        caption: "Italiano", publicUrl: "/api/public/visual-media/subtitle-browser-test",
                        accessible: true, private: false
                    }
                ]
            })
        })
    );
    await page.route(/\/api\/public\/wiki-images\/test(?:\?.*)?$/u, (route) =>
        route.fulfill({
            contentType: "image/svg+xml",
            body: '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="48"></svg>'
        })
    );
    await page.route(/\/api\/admin\/cms\/visual-publication\/page-test$/u, (route) =>
        route.fulfill({
            contentType: "application/json",
            body: JSON.stringify({
                canPublish: false,
                audit: { errors: [], warnings: [] },
                comparison: { changed: false },
                revisions: []
            })
        })
    );
    await page.route(/\/api\/admin\/cms\/visual-preview\/page-test$/u, async (route) => {
        previewPayload = route.request().postDataJSON();
        const title = previewPayload.nodes.find((node) => node.key === "heading-test")
            .values.title;
        await route.fulfill({
            contentType: "application/json",
            headers: {
                "Cache-Control": "no-store",
                "X-Robots-Tag": "noindex, nofollow"
            },
            body: JSON.stringify({
                page: {
                    html: `<main><h2 data-server-preview>${title}</h2></main>`,
                    metadata: { robots: "noindex,nofollow" }
                }
            })
        });
    });

    await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
    await page.evaluate(async () => {
        sessionStorage.setItem("nnmrcn_admin_session", "sessione-test");
        document.getElementById("adminPanel").hidden = false;
        await window.NNMRCN_VISUAL_BUILDER.load();
    });
    await page.locator('[data-visual-select="heading-test"]').click();
    await page.locator("#adminVisualField-title").fill("Titolo corrente non salvato");

    const previewButton = page.locator("#adminVisualServerPreview");
    assert.equal(await previewButton.isEnabled(), true);
    await previewButton.click();
    await page.locator("#adminVisualPreview[data-preview-source='server']").waitFor();
    assert.equal(previewPayload.nodes.find((node) => node.key === "heading-test")
        .values.title, "Titolo corrente non salvato");
    assert.equal(
        await page.locator("#adminVisualPreview [data-server-preview]").textContent(),
        "Titolo corrente non salvato"
    );
    assert.match(await page.locator("#adminVisualStatus").textContent(), /senza salvare né pubblicare/u);

    await page.locator('[data-visual-device="desktop"]').click();
    assert.equal(
        await page.locator("#adminVisualPreview").getAttribute("data-preview-source"),
        "server"
    );

    await page.locator('[data-visual-select="image-test"]').click();
    await page.getByRole("button", { name: "Scegli immagine" }).click();
    await page.locator("#adminVisualMediaDialog").waitFor({ state: "visible" });
    await page.locator("#adminVisualMediaSearch").fill("paesaggio");
    await page.locator("#adminVisualMediaResults").getByRole("button", {
        name: "Seleziona"
    }).click();
    await page.locator("#adminVisualMediaApply").click();
    assert.equal(await page.locator("#adminVisualField-assetId").inputValue(), "asset-browser-test");
    assert.equal(await page.locator("#adminVisualField-alt").inputValue(), "Paesaggio di prova");

    await page.locator('[data-visual-select="gallery-test"]').click();
    await page.getByRole("button", { name: "Scegli e ordina immagini" }).click();
    await page.locator("#adminVisualMediaResults").getByRole("button", { name: "Seleziona" }).click();
    await page.locator("#adminVisualMediaApply").click();
    assert.equal(await page.locator("#adminVisualField-assetIds").inputValue(), "asset-browser-test");

    await page.locator('[data-visual-select="audio-test"]').click();
    await page.getByRole("button", { name: "Scegli audio" }).click();
    await page.locator("#adminVisualMediaResults").getByRole("button", { name: "Seleziona" }).click();
    await page.locator("#adminVisualMediaApply").click();
    assert.equal(await page.locator("#adminVisualField-audioAssetId").inputValue(), "audio-browser-test");

    await page.locator('[data-visual-select="video-test"]').click();
    await page.getByRole("button", { name: "Scegli video" }).click();
    await page.locator("#adminVisualMediaResults").getByRole("button", { name: "Seleziona" }).click();
    await page.locator("#adminVisualMediaApply").click();
    await page.getByRole("button", { name: "Scegli immagine" }).click();
    await page.locator("#adminVisualMediaResults").getByRole("button", { name: "Seleziona" }).click();
    await page.locator("#adminVisualMediaApply").click();
    await page.getByRole("button", { name: "Scegli sottotitoli" }).click();
    await page.locator("#adminVisualMediaResults").getByRole("button", { name: "Seleziona" }).click();
    await page.locator("#adminVisualMediaApply").click();
    assert.equal(await page.locator("#adminVisualField-videoAssetId").inputValue(), "video-browser-test");
    assert.equal(await page.locator("#adminVisualField-posterAssetId").inputValue(), "asset-browser-test");
    assert.equal(await page.locator("#adminVisualField-subtitleAssetId").inputValue(), "subtitle-browser-test");

    await previewButton.click();
    await page.locator("#adminVisualPreview[data-preview-source='server']").waitFor();
    const payloadNodes = new Map(previewPayload.nodes.map((node) => [node.key, node]));
    assert.equal(payloadNodes.get("gallery-test").values.assetIds, "asset-browser-test");
    assert.equal(payloadNodes.get("audio-test").values.audioAssetId, "audio-browser-test");
    assert.equal(payloadNodes.get("video-test").values.videoAssetId, "video-browser-test");
    assert.equal(payloadNodes.get("video-test").values.posterAssetId, "asset-browser-test");
    assert.equal(payloadNodes.get("video-test").values.subtitleAssetId, "subtitle-browser-test");
    await page.locator("#adminVisualPreview").screenshot({
        path: new URL(`admin-visual-media-${name}.png`, outputDirectory).pathname
    });
    await context.close();
}

try {
    await auditViewport("mobile", { width: 375, height: 812 });
    await auditViewport("desktop", { width: 1440, height: 1000 });
    await auditLivePreview("mobile", { width: 375, height: 812 });
    await auditLivePreview("desktop", { width: 1440, height: 1000 });
    console.log("Audit pannello superato: mobile, desktop, guida, tastiera, etichette, feedback, anteprima e media visuali.");
} finally {
    await browser.close();
}
