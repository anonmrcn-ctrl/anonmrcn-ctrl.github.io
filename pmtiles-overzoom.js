(() => {
    "use strict";

    if (!window.pmtiles?.leafletRasterLayer) {
        console.error("PMTiles non è disponibile: overzoom non attivato.");
        return;
    }

    const originalLeafletRasterLayer = window.pmtiles.leafletRasterLayer;

    window.pmtiles.leafletRasterLayer = function (source, options = {}) {
        const layer = originalLeafletRasterLayer(source, {
            ...options,
            maxZoom: options.maxZoom ?? 19,
            maxNativeZoom: options.maxNativeZoom ?? 17
        });

        source.getHeader()
            .then((header) => {
                const nativeMaxZoom = Number(header?.maxZoom);

                if (!Number.isFinite(nativeMaxZoom)) {
                    return;
                }

                layer.options.maxNativeZoom = nativeMaxZoom;
                layer.options.maxZoom = Math.max(
                    Number(layer.options.maxZoom) || nativeMaxZoom,
                    nativeMaxZoom
                );

                if (layer._map) {
                    layer.redraw();
                }
            })
            .catch((error) => {
                console.error(
                    "Impossibile leggere il livello massimo del PMTiles.",
                    error
                );
            });

        return layer;
    };
})();
