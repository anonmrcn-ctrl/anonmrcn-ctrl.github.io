(function visualBehaviors() {
    "use strict";

    function normalize(value) {
        return String(value || "").trim().toLocaleLowerCase("it");
    }

    function connectFilter(block) {
        const input = block.querySelector("input[type='search']");
        const output = block.querySelector("[data-filter-count]");
        const targetId = block.dataset.filterTarget;
        const target = targetId ? document.getElementById(targetId) : null;
        if (!input || !output || !target) return;
        const items = [...target.querySelectorAll("[data-collection-item]")];
        const apply = () => {
            const query = normalize(input.value);
            let visible = 0;
            for (const item of items) {
                const matches = !query || normalize(item.dataset.searchText).includes(query);
                item.hidden = !matches;
                if (matches) visible += 1;
            }
            output.textContent = query
                ? `${visible} risultati visibili su ${items.length}`
                : `${items.length} contenuti disponibili`;
        };
        input.addEventListener("input", apply);
        apply();
    }

    function initialize() {
        document.querySelectorAll("[data-filter-target]").forEach(connectFilter);
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", initialize, { once: true });
    } else {
        initialize();
    }
}());
