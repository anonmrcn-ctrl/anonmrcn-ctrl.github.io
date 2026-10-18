import assert from "node:assert/strict";
import test from "node:test";

import {
    checkVisualMediaRoadmap,
    validateVisualMediaRoadmap
} from "./check-visual-media-roadmap.mjs";

test("la roadmap anteprima, media, audio e video pubblicata è coerente", async () => {
    const roadmap = await checkVisualMediaRoadmap();
    assert.equal(roadmap.status, "in_progress");
    assert.equal(roadmap.currentUnit, "14.5");
    assert.ok(roadmap.units.slice(0, 5).every((unit) => unit.status === "complete"));
    assert.ok(roadmap.units.slice(5).every((unit) => unit.status === "pending"));
    assert.equal(roadmap.units.at(-1).id, "14.6");
});

test("rifiuta salti, dipendenze future e currentUnit incoerente", () => {
    const roadmap = {
        version: 1,
        objective: "Test",
        status: "planned",
        currentUnit: "14.9",
        allowedStatuses: ["pending", "in_progress", "complete", "blocked"],
        guardrails: ["1", "2", "3", "4", "5", "6"],
        units: [
            {
                id: "14.0",
                title: "A",
                status: "complete",
                dependsOn: ["14.2"],
                deliverables: ["A"],
                acceptance: ["A", "B"]
            },
            {
                id: "14.2",
                title: "B",
                status: "pending",
                dependsOn: [],
                deliverables: ["B"],
                acceptance: ["A", "B"]
            }
        ]
    };
    const errors = validateVisualMediaRoadmap(roadmap);
    assert.ok(errors.some((error) => error.includes("ordine non valido")));
    assert.ok(errors.some((error) => error.includes("dipendenza non valida")));
    assert.ok(errors.some((error) => error.includes("currentUnit non coerente")));
});
