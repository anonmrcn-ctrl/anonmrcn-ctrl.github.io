(() => {
    "use strict";

    const requests = new Map();
    const extensions = [];

    function loadGeoJSON(url) {
        const cached = requests.get(url);

        if (cached) {
            return cached;
        }

        const request = fetch(url).then((response) => {
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            return response.json();
        });

        requests.set(url, request);
        request.catch(() => {
            if (requests.get(url) === request) {
                requests.delete(url);
            }
        });

        return request;
    }

    function registerExtension(extension) {
        extensions.push(extension);
    }

    function extendOverlays(overlays) {
        return extensions.reduce(
            (current, extension) =>
                typeof extension.overlays === "function"
                    ? extension.overlays(current)
                    : current,
            overlays
        );
    }

    function enhanceControl(control) {
        extensions.forEach((extension) => extension.control?.(control));
    }

    function enhanceFeature(feature, layer) {
        extensions.forEach((extension) => extension.feature?.(feature, layer));
    }

    window.NNMRCN_MAP = Object.freeze({
        loadGeoJSON,
        registerExtension,
        extendOverlays,
        enhanceControl,
        enhanceFeature
    });
})();
