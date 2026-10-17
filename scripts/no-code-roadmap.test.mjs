import assert from "node:assert/strict";
import test from "node:test";

import {
    checkNoCodeRoadmap,
    validateNoCodeRoadmap
} from "./check-no-code-roadmap.mjs";

test("la roadmap no-code pubblicata è coerente", async () => {
    const roadmap = await checkNoCodeRoadmap();
    assert.equal(roadmap.currentUnit, "13.10");
    assert.equal(roadmap.units[0].status, "complete");
    assert.equal(roadmap.units[1].status, "complete");
    assert.equal(roadmap.units[2].status, "complete");
    assert.equal(roadmap.units[3].status, "complete");
    assert.equal(roadmap.units[4].status, "complete");
    assert.equal(roadmap.units[5].status, "complete");
    assert.equal(roadmap.units[6].status, "complete");
    assert.equal(roadmap.units[7].status, "complete");
    assert.equal(roadmap.units[8].status, "complete");
    assert.equal(roadmap.units[9].status, "complete");
    assert.equal(roadmap.units.at(-1).id, "13.12");
});

test("rifiuta salti, dipendenze future e currentUnit incoerente", () => {
    const roadmap = {
        version: 1,
        objective: "Test",
        status: "planned",
        currentUnit: "13.9",
        allowedStatuses: ["pending", "in_progress", "complete", "blocked"],
        guardrails: ["1", "2", "3", "4", "5", "6"],
        units: [
            {
                id: "13.0",
                title: "A",
                status: "complete",
                dependsOn: ["13.2"],
                deliverables: ["A"],
                acceptance: ["A", "B"]
            },
            {
                id: "13.2",
                title: "B",
                status: "pending",
                dependsOn: [],
                deliverables: ["B"],
                acceptance: ["A", "B"]
            }
        ]
    };
    const errors = validateNoCodeRoadmap(roadmap);
    assert.ok(errors.some((error) => error.includes("ordine non valido")));
    assert.ok(errors.some((error) => error.includes("dipendenza non valida")));
    assert.ok(errors.some((error) => error.includes("currentUnit non coerente")));
});
