(() => {
    "use strict";

    const api = window.NNMRCN_API;

    window.NNMRCN_ONBOARDING_READY = loadOnboarding();

    async function loadOnboarding() {
        if (!api) {
            finish("fallback");
            return;
        }

        try {
            const data = await api.request("/api/public/onboarding/welcome");
            const intro = normalizeIntro(data?.intro);
            const features = (data?.steps || [])
                .map(normalizeFeature)
                .filter(Boolean);

            if (!intro || !features.length) {
                throw new Error("ONBOARDING_CONTENT_INVALID");
            }

            window.NNMRCN_ONBOARDING_CONTENT = Object.freeze({
                intro: Object.freeze(intro),
                features: Object.freeze(features)
            });
            finish("d1");
        } catch (_) {
            finish("fallback");
        }
    }

    function normalizeIntro(value) {
        if (
            !value ||
            typeof value.title !== "string" ||
            typeof value.subtitle !== "string"
        ) {
            return null;
        }

        return { title: value.title, subtitle: value.subtitle };
    }

    function normalizeFeature(value) {
        if (
            !value ||
            typeof value.title !== "string" ||
            typeof value.description !== "string" ||
            !Array.isArray(value.details) ||
            typeof value.preview !== "string" ||
            typeof value.alt !== "string" ||
            !Array.isArray(value.markers)
        ) {
            return null;
        }

        const details = value.details.filter(
            (detail) => typeof detail === "string"
        );
        const markers = value.markers.filter((marker) =>
            marker &&
            typeof marker.label === "string" &&
            typeof marker.x === "string" &&
            typeof marker.y === "string"
        ).map((marker) => ({
            label: marker.label,
            x: marker.x,
            y: marker.y,
            ...(marker.tone === "yellow" || marker.tone === "red"
                ? { tone: marker.tone }
                : {})
        }));

        return Object.freeze({
            id: String(value.id || ""),
            title: value.title,
            description: value.description,
            details: Object.freeze(details),
            preview: value.preview,
            alt: value.alt,
            markers: Object.freeze(markers)
        });
    }

    function finish(source) {
        document.documentElement.dataset.cmsOnboardingSource = source;
        window.dispatchEvent(new CustomEvent("nnmrcn:onboarding-ready", {
            detail: { source }
        }));
    }
})();
