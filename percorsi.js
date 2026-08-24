(() => {
    "use strict";

    if (!window.L?.control?.layers) {
        console.error("Leaflet non è disponibile: percorsi e paesaggi non caricati.");
        return;
    }

    const ROUTE_NAME = "Proposta di percorso ciclo-turistico";
    const RIVERS_NAME = "Fiumi";
    const QUARRIES_NAME = "Cave";
    const MUNICIPAL_PAGE_URL =
        "https://www.comune.marcon.ve.it/vivere-il-comune/territorio/cosa-fare-e-vedere/";
    const MUNICIPAL_LINK_TEXT = "Cosa fare e vedere";
    const originalLayersFactory = L.control.layers;

    function buildRoutePopup(feature) {
        const root = document.createElement("div");
        root.className = "popup-percorso";

        const title = document.createElement("strong");
        title.textContent = feature.properties?.nome || ROUTE_NAME;
        root.appendChild(title);

        const description = feature.properties?.descrizione;
        if (description) {
            const paragraph = document.createElement("p");
            const linkIndex = description.indexOf(MUNICIPAL_LINK_TEXT);

            if (linkIndex === -1) {
                paragraph.textContent = description;
            } else {
                paragraph.append(
                    document.createTextNode(description.slice(0, linkIndex))
                );

                const link = document.createElement("a");
                link.href = MUNICIPAL_PAGE_URL;
                link.textContent = MUNICIPAL_LINK_TEXT;
                link.target = "_blank";
                link.rel = "noopener noreferrer";
                link.title = "Apri la pagina Cosa fare e vedere del Comune di Marcon";
                paragraph.appendChild(link);

                paragraph.append(
                    document.createTextNode(
                        description.slice(linkIndex + MUNICIPAL_LINK_TEXT.length)
                    )
                );
            }

            root.appendChild(paragraph);
        }

        return root;
    }

    async function loadRouteLayer() {
        const response = await fetch("./percorsi.geojson", {
            cache: "no-store"
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();

        return L.geoJSON(data, {
            style: {
                color: "#a34d2f",
                weight: 5,
                opacity: 0.95,
                dashArray: "11 7",
                lineCap: "round",
                lineJoin: "round"
            },
            onEachFeature(feature, layer) {
                const name = feature.properties?.nome || ROUTE_NAME;

                layer.bindTooltip(name, {
                    sticky: true,
                    direction: "top"
                });

                layer.bindPopup(buildRoutePopup(feature), {
                    maxWidth: 320
                });
            }
        });
    }

    function splitLandscapeLayer(landscapeLayer) {
        const riversLayer = L.layerGroup();
        const quarriesLayer = L.layerGroup();
        const targetMap = landscapeLayer?._map || null;

        function destinationFor(featureLayer) {
            return featureLayer?.feature?.properties?.categoria === "cava"
                ? quarriesLayer
                : riversLayer;
        }

        function distribute(layer) {
            if (!layer) {
                return;
            }

            if (layer.feature) {
                destinationFor(layer).addLayer(layer);
                return;
            }

            if (typeof layer.eachLayer === "function") {
                layer.eachLayer(distribute);
            }
        }

        if (typeof landscapeLayer.eachLayer === "function") {
            landscapeLayer.eachLayer(distribute);
        }

        const originalAddLayer = landscapeLayer.addLayer.bind(landscapeLayer);
        landscapeLayer.addLayer = function (layer) {
            const result = originalAddLayer(layer);
            distribute(layer);
            return result;
        };

        if (targetMap) {
            targetMap.removeLayer(landscapeLayer);
            riversLayer.addTo(targetMap);
            quarriesLayer.addTo(targetMap);
        }

        return {
            riversLayer,
            quarriesLayer
        };
    }

    function insertHeadingBefore(list, labelText, className, headingText) {
        if (list.querySelector(`.${className}`)) {
            return true;
        }

        const label = [...list.querySelectorAll("label")].find(
            (item) => item.textContent.trim() === labelText
        );

        if (!label) {
            return false;
        }

        const heading = document.createElement("div");
        heading.className = `livello-categoria ${className}`;
        heading.textContent = headingText;
        label.before(heading);
        return true;
    }

    function addCategoryHeadings(control) {
        let attempts = 0;

        function tryInsert() {
            attempts += 1;

            const container = control.getContainer?.();
            const list = container?.querySelector(
                ".leaflet-control-layers-overlays"
            );

            if (!list) {
                if (attempts < 60) {
                    requestAnimationFrame(tryInsert);
                }
                return;
            }

            const landscapesReady = insertHeadingBefore(
                list,
                RIVERS_NAME,
                "livello-categoria-paesaggi",
                "Paesaggi significativi"
            );

            const routeReady = insertHeadingBefore(
                list,
                ROUTE_NAME,
                "livello-categoria-percorsi",
                "Percorsi"
            );

            if ((!landscapesReady || !routeReady) && attempts < 60) {
                requestAnimationFrame(tryInsert);
            }
        }

        requestAnimationFrame(tryInsert);
    }

    function enhanceLandscapeControl(control) {
        if (control.__nnmrcnPercorsi) {
            return;
        }

        control.__nnmrcnPercorsi = true;
        addCategoryHeadings(control);

        loadRouteLayer()
            .then((routeLayer) => {
                control.addOverlay(routeLayer, ROUTE_NAME);
                addCategoryHeadings(control);
            })
            .catch((error) => {
                console.error(
                    "Impossibile caricare la proposta di percorso ciclo-turistico.",
                    error
                );
            });
    }

    L.control.layers = function (baseLayers, overlays, options) {
        let normalizedOverlays = overlays;
        let isLandscapeControl = false;

        if (
            overlays &&
            Object.prototype.hasOwnProperty.call(
                overlays,
                "Paesaggi significativi"
            )
        ) {
            const landscapeLayer = overlays["Paesaggi significativi"];
            const { riversLayer, quarriesLayer } = splitLandscapeLayer(
                landscapeLayer
            );

            normalizedOverlays = {
                [RIVERS_NAME]: riversLayer,
                [QUARRIES_NAME]: quarriesLayer
            };
            isLandscapeControl = true;
        }

        const control = originalLayersFactory.call(
            L.control,
            baseLayers,
            normalizedOverlays,
            options
        );

        if (isLandscapeControl) {
            enhanceLandscapeControl(control);
        }

        return control;
    };
})();
