(() => {
    "use strict";

    const api = window.NNMRCN_API;
    const slugs = Object.freeze({
        "./percorsi.geojson": "percorsi",
        "./luoghi-rilevanti.geojson": "luoghi-rilevanti",
        "./marcon-da-sud.geojson": "marcon-da-sud",
        "./luoghi-significativi.geojson": "luoghi-significativi"
    });

    async function load(url, fallback) {
        const slug = slugs[url];

        if (!api || !slug) {
            return fallback();
        }

        try {
            const data = await api.request(`/api/public/map-layers/${slug}`);
            const collection = data?.geojson;

            if (
                collection?.type !== "FeatureCollection" ||
                !Array.isArray(collection.features)
            ) {
                throw new Error("MAP_CONTENT_INVALID");
            }

            finish("d1", slug);
            return collection;
        } catch (_) {
            const collection = await fallback();
            finish("fallback", slug);
            return collection;
        }
    }

    function finish(source, slug) {
        document.documentElement.dataset.cmsMapSource = source;
        window.dispatchEvent(new CustomEvent("nnmrcn:map-content-ready", {
            detail: { source, slug }
        }));
    }

    window.NNMRCN_MAP_CONTENT = Object.freeze({ load });
})();
