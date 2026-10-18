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
            const data = await api.request(`/api/public/visual-pages/${encodeURIComponent(slug)}`);

            applyBlocks(data?.page?.compatibilityBlocks || []);
            applyVisualAdditions(data?.page?.html || "");
            document.documentElement.dataset.cmsPageSource = "visual";
            announce("visual");
        } catch (_) {
            await loadLegacyPage();
        }
    }

    async function loadLegacyPage() {
        try {
            const data = await api.request(`/api/public/pages/${encodeURIComponent(slug)}`);

            applyBlocks((data?.page?.blocks || []).map((block) => ({
                id: block?.id,
                text: block?.content?.text
            })));
            document.documentElement.dataset.cmsPageSource = "d1";
            announce("d1");
        } catch (_) {
            document.documentElement.dataset.cmsPageSource = "fallback";
            announce("fallback");
        }
    }

    function applyBlocks(blocks) {
        for (const block of blocks) {
            const target = targets.get(block?.id);
            const text = block?.text;

            if (!target || typeof text !== "string") {
                continue;
            }

            target.textContent = text;
        }
    }

    function applyVisualAdditions(html) {
        if (!html || typeof DOMParser !== "function" || typeof document.querySelector !== "function") {
            return;
        }
        const parsed = new DOMParser().parseFromString(html, "text/html");
        const visualRoot = parsed.querySelector("main[data-block-id]");
        const publicRoot = document.querySelector("main");
        if (!visualRoot || !publicRoot || typeof document.createElement !== "function") return;

        const additions = Array.from(visualRoot.children).filter((candidate) => {
            const id = candidate.getAttribute("data-block-id") || "";
            if (!id || targets.has(id) || candidate.matches("[data-adapter], [data-static-fallback]")) {
                return false;
            }
            if (candidate.querySelector("[data-adapter], [data-static-fallback]")) return false;
            return !Array.from(candidate.querySelectorAll("[data-block-id]")).some((node) =>
                targets.has(node.getAttribute("data-block-id") || "")
            );
        });
        let mount = document.querySelector("[data-cms-visual-additions]");
        if (!additions.length) {
            mount?.remove();
            return;
        }
        if (!mount) {
            mount = document.createElement("section");
            mount.className = "cms-visual-additions";
            mount.dataset.cmsVisualAdditions = "";
            mount.setAttribute("aria-label", "Contenuti aggiunti");
            publicRoot.append(mount);
        }
        mount.replaceChildren(...additions.map((node) => document.importNode(node, true)));
    }

    function announce(source) {
        window.dispatchEvent(new CustomEvent("nnmrcn:page-content-ready", {
            detail: { slug, source }
        }));
    }
})();
