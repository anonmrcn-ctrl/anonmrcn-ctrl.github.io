import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("il frontend conserva solo la sessione temporanea e resta noindex", async () => {
    const [adminHtml, adminScript, wikiHtml, wikiScript] = await Promise.all([
        readFile(new URL("../../admin.html", import.meta.url), "utf8"),
        readFile(new URL("../../admin.js", import.meta.url), "utf8"),
        readFile(new URL("../../voci.html", import.meta.url), "utf8"),
        readFile(new URL("../../voci.js", import.meta.url), "utf8")
    ]);

    assert.match(adminHtml, /name="robots" content="noindex, nofollow"/u);
    assert.match(adminHtml, /Accedi con passkey/u);
    assert.match(adminHtml, /Configura la prima passkey/u);
    assert.doesNotMatch(adminHtml, /id="adminToken"/u);
    assert.match(adminScript, /nnmrcn_admin_session/u);
    assert.match(adminScript, /Authorization/u);
    assert.doesNotMatch(adminScript, /nnmrcn_admin_token/u);
    assert.match(wikiHtml, /voci\.js\?v=20261010-passkeys1/u);
    assert.match(wikiScript, /nnmrcn_admin_session/u);
    assert.doesNotMatch(wikiScript, /nnmrcn_admin_token/u);
});
