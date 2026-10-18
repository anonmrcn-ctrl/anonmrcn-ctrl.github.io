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

async function auditLivePreview() {
    const context = await browser.newContext({
        locale: "it-IT",
        viewport: { width: 1440, height: 1000 }
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
                palette: [{ type: "heading", label: "Titolo", category: "content" }],
                inspectorSchemas: {
                    heading: [{
                        key: "title",
                        label: "Titolo",
                        control: "text",
                        propertyName: "text",
                        maxLength: 200,
                        required: true,
                        defaultValue: ""
                    }]
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
    await context.close();
}

try {
    await auditViewport("mobile", { width: 375, height: 812 });
    await auditViewport("desktop", { width: 1440, height: 1000 });
    await auditLivePreview();
    console.log("Audit pannello superato: mobile, desktop, guida, tastiera, etichette, feedback e anteprima fedele.");
} finally {
    await browser.close();
}
