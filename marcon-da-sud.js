(() => {
    "use strict";

    if (!window.L?.control?.layers) {
        return;
    }

    const ROUTE_NAME = "Proposta di percorso ciclo-turistico";
    const PLACES_NAME = "Luoghi rilevanti lungo il percorso";
    const SOUTH_ROUTE_NAME = "Marcon da sud";
    const SOUTH_ROUTE_URL = "./marcon-da-sud.geojson";
    const previousLayersFactory = L.control.layers;

    function buildPopup(feature) {
        const root = document.createElement("div");
        root.className = "popup-percorso";

        const title = document.createElement("strong");
        title.textContent = feature.properties?.nome || SOUTH_ROUTE_NAME;
        root.appendChild(title);

        return root;
    }

    async function loadSouthRoute(targetGroup) {
        const response = await fetch(SOUTH_ROUTE_URL, {
            cache: "no-store"
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();
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

    L.control.layers = function (baseLayers, overlays, options) {
        return previousLayersFactory.call(
            L.control,
            baseLayers,
            insertSouthRoute(overlays),
            options
        );
    };
})();
