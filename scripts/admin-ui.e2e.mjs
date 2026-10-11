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

    assert.equal(await navigation.locator("a").count(), 8);
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

try {
    await auditViewport("mobile", { width: 375, height: 812 });
    await auditViewport("desktop", { width: 1440, height: 1000 });
    console.log("Audit pannello superato: mobile, desktop, tastiera, etichette e feedback.");
} finally {
    await browser.close();
}
