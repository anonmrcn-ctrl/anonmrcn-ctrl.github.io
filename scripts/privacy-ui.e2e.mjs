import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const baseUrl = process.env.PRIVACY_UI_BASE_URL || "http://127.0.0.1:8000";
const outputDirectory = new URL("../privacy-ui-reports/", import.meta.url);
const channel = process.env.PRIVACY_UI_CHROME_CHANNEL || "";

await mkdir(outputDirectory, { recursive: true });

const browser = await chromium.launch({
    headless: true,
    ...(channel ? { channel } : { executablePath: chromium.executablePath() })
});

try {
    const context = await browser.newContext({
        locale: "it-IT",
        viewport: { width: 375, height: 812 }
    });
    const page = await context.newPage();

    await page.route("https://anonmrcn.goatcounter.com/**", (route) =>
        route.fulfill({ status: 204, body: "" })
    );
    await page.goto(`${baseUrl}/index.html`, { waitUntil: "domcontentloaded" });

    const panel = page.locator("#privacyTelemetryPanel");
    assert.equal(await panel.isVisible(), true);
    assert.equal(await page.locator("script[data-goatcounter]").count(), 0);
    assert.equal(await page.evaluate(() =>
        localStorage.getItem("nnmrcn_telemetry_consent_v1")
    ), null);
    await panel.screenshot({
        path: new URL("privacy-consent-mobile.png", outputDirectory).pathname
    });

    await page.getByRole("button", { name: "Solo necessari" }).click();
    assert.equal(await panel.isVisible(), false);
    assert.equal(await page.evaluate(() =>
        localStorage.getItem("nnmrcn_telemetry_consent_v1")
    ), "deny");
    assert.equal(await page.locator("script[data-goatcounter]").count(), 0);

    await page.getByRole("button", { name: "Privacy e statistiche" }).click();
    await page.getByRole("button", { name: "Consenti statistiche aggregate" }).click();
    assert.equal(await page.evaluate(() =>
        localStorage.getItem("nnmrcn_telemetry_consent_v1")
    ), "allow");
    assert.equal(await page.locator("script[data-goatcounter]").count(), 1);

    await page.reload({ waitUntil: "domcontentloaded" });
    assert.equal(await page.locator("#privacyTelemetryPanel").count(), 0);
    assert.equal(
        await page.getByRole("button", { name: "Statistiche consentite" }).isVisible(),
        true
    );
    assert.equal(await page.locator("script[data-goatcounter]").count(), 1);

    await page.getByRole("button", { name: "Statistiche consentite" }).click();
    await page.getByRole("button", { name: "Solo necessari" }).click();
    assert.equal(await page.evaluate(() =>
        localStorage.getItem("nnmrcn_telemetry_consent_v1")
    ), "deny");

    await page.goto(`${baseUrl}/spazio-personale.html`, { waitUntil: "domcontentloaded" });
    assert.equal(await page.locator("#privacyTelemetryOpen").count(), 0);
    assert.equal(await page.locator("script[data-goatcounter]").count(), 0);
    assert.equal(await page.locator('script[src*="analytics.js"]').count(), 0);
    await page.evaluate(() => {
        document.querySelector("[data-spazio-personale-contenuto]").hidden = false;
    });
    const exportButton = page.getByRole("button", { name: "Scarica i miei dati" });
    await page.locator("details.spazio-eliminazione > summary").click();
    const deleteButton = page.getByRole("button", { name: "Elimina account e dati" });
    const confirmation = page.getByLabel(/Per confermare scrivi/u);
    assert.equal(await exportButton.isVisible(), true);
    assert.equal(await deleteButton.isEnabled(), false);
    await confirmation.fill("ELIMINA I MIEI DATI");
    assert.equal(await deleteButton.isEnabled(), true);
    assert.equal(await page.evaluate(() =>
        document.documentElement.scrollWidth <= document.documentElement.clientWidth
    ), true);
    await page.locator("#i-tuoi-dati").screenshot({
        path: new URL("privacy-rights-mobile.png", outputDirectory).pathname
    });

    await context.close();
} finally {
    await browser.close();
}
