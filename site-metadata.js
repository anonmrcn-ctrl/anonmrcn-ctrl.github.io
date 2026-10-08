(() => {
    "use strict";

    const api = window.NNMRCN_API;

    if (!api) {
        finish("fallback");
        return;
    }

    loadMetadata();

    async function loadMetadata() {
        try {
            const data = await api.request("/api/public/settings/site");
            const pages = data?.settings?.["site.metadata.pages"];
            const pageKey = currentPageKey();
            const metadata = pages?.[pageKey];

            if (!metadata || typeof metadata.title !== "string") {
                throw new Error("SITE_METADATA_INVALID");
            }

            document.title = metadata.title;
            applyDescription(metadata.description);
            window.NNMRCN_SITE_SETTINGS = Object.freeze(data.settings);
            finish("d1");
        } catch (_) {
            finish("fallback");
        }
    }

    function currentPageKey() {
        const fileName = String(window.location.pathname || "")
            .split("/")
            .pop() || "index.html";
        return fileName.replace(/\.html$/u, "") || "index";
    }

    function applyDescription(value) {
        if (typeof value !== "string" || !value) {
            return;
        }

        let element = document.querySelector('meta[name="description"]');

        if (!element) {
            element = document.createElement("meta");
            element.name = "description";
            document.head.appendChild(element);
        }

        element.content = value;
    }

    function finish(source) {
        document.documentElement.dataset.cmsMetadataSource = source;
        window.dispatchEvent(new CustomEvent("nnmrcn:metadata-ready", {
            detail: { source }
        }));
    }
})();
