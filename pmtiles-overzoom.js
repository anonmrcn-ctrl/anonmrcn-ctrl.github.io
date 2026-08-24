(() => {
    "use strict";

    if (!window.L || !window.pmtiles?.leafletRasterLayer) {
        console.error("Leaflet o PMTiles non sono disponibili: overzoom non attivato.");
        return;
    }

    const originalLeafletRasterLayer = window.pmtiles.leafletRasterLayer;

    window.pmtiles.leafletRasterLayer = function (source, options = {}) {
        const container = L.layerGroup();

        source.getHeader()
            .then((header) => {
                const nativeMinZoom = Number(header?.minZoom);
                const nativeMaxZoom = Number(header?.maxZoom);

                if (!Number.isFinite(nativeMaxZoom)) {
                    throw new Error("maxZoom PMTiles non valido.");
                }

                const layer = originalLeafletRasterLayer(source, {
                    ...options,
                    minNativeZoom: Number.isFinite(nativeMinZoom)
                        ? nativeMinZoom
                        : undefined,
                    maxNativeZoom: nativeMaxZoom,
                    maxZoom: Math.max(
                        Number(options.maxZoom) || 22,
                        nativeMaxZoom
                    )
                });

                layer.on("tileerror", (event) => {
                    container.fire("tileerror", event, true);
                });

                container.addLayer(layer);

                console.info(
                    `Mappa 1975: zoom nativo ${nativeMinZoom}–${nativeMaxZoom}; overzoom fino a ${layer.options.maxZoom}.`
                );
            })
            .catch((error) => {
                console.error(
                    "Impossibile inizializzare l'overzoom del PMTiles 1975.",
                    error
                );
            });

        return container;
    };
})();
