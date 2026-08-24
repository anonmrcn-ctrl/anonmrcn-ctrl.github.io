(() => {
    "use strict";

    if (!window.L || !window.pmtiles?.leafletRasterLayer) {
        console.error("Leaflet o PMTiles non sono disponibili: limite zoom 1975 non attivato.");
        return;
    }

    const originalLeafletRasterLayer = window.pmtiles.leafletRasterLayer;
    const TODAY_MAX_ZOOM = 19;

    window.pmtiles.leafletRasterLayer = function (source, options = {}) {
        const container = L.layerGroup();
        let nativeMinZoom = null;
        let nativeMaxZoom = null;
        let activeMap = null;
        let previousMaxZoom = TODAY_MAX_ZOOM;

        function apply1975ZoomLimit() {
            if (!activeMap || !Number.isFinite(nativeMaxZoom)) {
                return;
            }

            activeMap.setMaxZoom(nativeMaxZoom);

            if (activeMap.getZoom() > nativeMaxZoom) {
                activeMap.setZoom(nativeMaxZoom);
            }
        }

        container.on("add", () => {
            activeMap = container._map || null;

            if (activeMap) {
                const currentMaxZoom = activeMap.getMaxZoom();

                if (Number.isFinite(currentMaxZoom)) {
                    previousMaxZoom = currentMaxZoom;
                }
            }

            apply1975ZoomLimit();
        });

        container.on("remove", () => {
            if (activeMap) {
                const restoredMaxZoom =
                    Number.isFinite(previousMaxZoom) && previousMaxZoom > 0
                        ? previousMaxZoom
                        : TODAY_MAX_ZOOM;

                activeMap.setMaxZoom(restoredMaxZoom);
            }

            activeMap = null;
        });

        source.getHeader()
            .then((header) => {
                nativeMinZoom = Number(header?.minZoom);
                nativeMaxZoom = Number(header?.maxZoom);

                if (!Number.isFinite(nativeMaxZoom)) {
                    throw new Error("maxZoom PMTiles non valido.");
                }

                const layer = originalLeafletRasterLayer(source, {
                    ...options,
                    minZoom: Number.isFinite(nativeMinZoom)
                        ? nativeMinZoom
                        : undefined,
                    maxZoom: nativeMaxZoom
                });

                layer.on("tileerror", (event) => {
                    container.fire("tileerror", event, true);
                });

                container.addLayer(layer);
                apply1975ZoomLimit();

                console.info(
                    `Mappa 1975: zoom disponibili ${nativeMinZoom}–${nativeMaxZoom}. ` +
                    `Con il livello 1975 attivo lo zoom massimo è ${nativeMaxZoom}.`
                );
            })
            .catch((error) => {
                console.error(
                    "Impossibile leggere i limiti di zoom del PMTiles 1975.",
                    error
                );
            });

        return container;
    };
})();
