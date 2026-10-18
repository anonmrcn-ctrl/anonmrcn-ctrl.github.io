import assert from "node:assert/strict";
import test from "node:test";

import { checkNoCodeIndependence } from "./check-no-code-independence.mjs";

test("l'audit finale prova l'indipendenza no-code e la compatibilità", async () => {
    assert.deepEqual(await checkNoCodeIndependence(), {
        pages: 9,
        guideSteps: 6,
        publicFallback: true,
        staticGeneration: true,
        diagnostics: 2
    });
});
