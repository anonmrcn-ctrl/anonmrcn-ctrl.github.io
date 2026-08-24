(() => {
    "use strict";

    if (!window.NNMRCN_MAP || !window.L?.layerGroup) {
        return;
    }

    const mapExtensions = window.NNMRCN_MAP;
    const ROUTE_NAME = "Proposta di percorso ciclo-turistico";
    const PLACES_NAME = "Luoghi rilevanti lungo il percorso";
    const SOUTH_ROUTE_NAME = "Marcon da sud";
    const SOUTH_ROUTE_URL = "./marcon-da-sud.geojson";

    function buildPopup(feature) {
        const root = document.createElement("div");
        root.className = "popup-percorso";

        const title = document.createElement("strong");
        title.textContent = feature.properties?.nome || SOUTH_ROUTE_NAME;
        root.appendChild(title);

        return root;
    }

    async function loadSouthRoute(targetGroup) {
        const data = await mapExtensions.loadGeoJSON(SOUTH_ROUTE_URL);
        const layer = L.geoJSON(data, {
            style: {
                color: "#704f3b",
                weight: 5,
                opacity: 0.95,
                dashArray: "5 7",
                lineCap: "round",
                lineJoin: "round"
            },
            onEachFeature(feature, featureLayer) {
                const name = feature.properties?.nome || SOUTH_ROUTE_NAME;

                featureLayer.bindTooltip(name, {
                    sticky: true,
                    direction: "top"
                });

                featureLayer.bindPopup(buildPopup(feature), {
                    maxWidth: 320
                });
            }
        });

        targetGroup.addLayer(layer);
    }

    function insertSouthRoute(overlays) {
        if (
            !overlays ||
            !Object.prototype.hasOwnProperty.call(overlays, ROUTE_NAME) ||
            !Object.prototype.hasOwnProperty.call(overlays, PLACES_NAME) ||
            Object.prototype.hasOwnProperty.call(overlays, SOUTH_ROUTE_NAME)
        ) {
            return overlays;
        }

        const southRouteLayer = L.layerGroup();
        const ordered = {};

        for (const [name, layer] of Object.entries(overlays)) {
            ordered[name] = layer;

            if (name === PLACES_NAME) {
                ordered[SOUTH_ROUTE_NAME] = southRouteLayer;
            }
        }

        loadSouthRoute(southRouteLayer).catch((error) => {
            console.error("Impossibile caricare il percorso Marcon da sud.", error);
        });

        return ordered;
    }

    mapExtensions.registerExtension({
        overlays: insertSouthRoute
    });
})();
