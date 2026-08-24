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
        let wheelTarget = null;
        let guardsAttached = false;

        function clampZoom() {
            if (!activeMap || !Number.isFinite(nativeMaxZoom)) {
                return;
            }

            if (activeMap.getZoom() > nativeMaxZoom) {
                activeMap.setView(
                    activeMap.getCenter(),
                    nativeMaxZoom,
                    { animate: false }
                );
            }
        }

        function blockWheelPastMax(event) {
            if (!activeMap || !Number.isFinite(nativeMaxZoom)) {
                return;
            }

            const isZoomingIn = event.deltaY < 0;
            const atMaximum = activeMap.getZoom() >= nativeMaxZoom;

            if (isZoomingIn && atMaximum) {
                event.preventDefault();
                event.stopPropagation();
                event.stopImmediatePropagation();
            }
        }

        function attachZoomGuards() {
            if (
                guardsAttached ||
                !activeMap ||
                !Number.isFinite(nativeMaxZoom)
            ) {
                return;
            }

            activeMap.setMaxZoom(nativeMaxZoom);

            wheelTarget = activeMap.getContainer();
            wheelTarget.addEventListener(
                "wheel",
                blockWheelPastMax,
                { passive: false, capture: true }
            );

            activeMap.on("zoomend", clampZoom);
            guardsAttached = true;
            clampZoom();
        }

        function detachZoomGuards() {
            if (wheelTarget) {
                wheelTarget.removeEventListener(
                    "wheel",
                    blockWheelPastMax,
                    { capture: true }
                );
                wheelTarget = null;
            }

            if (activeMap) {
                activeMap.off("zoomend", clampZoom);
            }

            guardsAttached = false;
        }

        container.on("add", () => {
            activeMap = container._map || null;

            if (activeMap) {
                const currentMaxZoom = activeMap.getMaxZoom();

                if (Number.isFinite(currentMaxZoom)) {
                    previousMaxZoom = currentMaxZoom;
                }
            }

            attachZoomGuards();
        });

        container.on("remove", () => {
            detachZoomGuards();

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
                attachZoomGuards();

                console.info(
                    `Mappa 1975: zoom disponibili ${nativeMinZoom}–${nativeMaxZoom}. ` +
                    `Blocco esplicito dello zoom oltre ${nativeMaxZoom} attivo.`
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
