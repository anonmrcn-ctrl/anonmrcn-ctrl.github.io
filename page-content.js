(() => {
    "use strict";

    const api = window.NNMRCN_API;
    const slug = document.body?.dataset.cmsPage || "";
    const targets = new Map(
        Array.from(document.querySelectorAll("[data-cms-block]"), (element) => [
            element.dataset.cmsBlock,
            element
        ])
    );

    if (!api || !slug || !targets.size) {
        return;
    }

    loadPage();

    async function loadPage() {
        try {
            const data = await api.request(
                `/api/public/pages/${encodeURIComponent(slug)}`
            );

            for (const block of data?.page?.blocks || []) {
                const target = targets.get(block?.id);
                const text = block?.content?.text;

                if (!target || typeof text !== "string") {
                    continue;
                }

                target.textContent = text;
            }

            document.documentElement.dataset.cmsPageSource = "d1";
            window.dispatchEvent(new CustomEvent("nnmrcn:page-content-ready", {
                detail: { slug, source: "d1" }
            }));
        } catch (_) {
            document.documentElement.dataset.cmsPageSource = "fallback";
            window.dispatchEvent(new CustomEvent("nnmrcn:page-content-ready", {
                detail: { slug, source: "fallback" }
            }));
        }
    }
})();
