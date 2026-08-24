(() => {
    "use strict";

    if (!window.L?.control?.layers) {
        console.error("Leaflet non è disponibile: percorsi non caricati.");
        return;
    }

    const ROUTE_NAME = "Proposta di percorso ciclo-turistico";
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

    function addCategoryHeading(control) {
        let attempts = 0;

        function tryInsert() {
            attempts += 1;

            const container = control.getContainer?.();
            const list = container?.querySelector(
                ".leaflet-control-layers-overlays"
            );

            if (!list) {
                if (attempts < 40) {
                    requestAnimationFrame(tryInsert);
                }
                return;
            }

            const routeLabel = [...list.querySelectorAll("label")].find(
                (label) => label.textContent.trim() === ROUTE_NAME
            );

            if (!routeLabel) {
                if (attempts < 40) {
                    requestAnimationFrame(tryInsert);
                }
                return;
            }

            if (!list.querySelector(".livello-categoria-percorsi")) {
                const heading = document.createElement("div");
                heading.className = "livello-categoria livello-categoria-percorsi";
                heading.textContent = "Percorsi";
                routeLabel.before(heading);
            }
        }

        requestAnimationFrame(tryInsert);
    }

    function enhanceLandscapeControl(control) {
        if (control.__nnmrcnPercorsi) {
            return;
        }

        control.__nnmrcnPercorsi = true;

        loadRouteLayer()
            .then((routeLayer) => {
                control.addOverlay(routeLayer, ROUTE_NAME);
                addCategoryHeading(control);
            })
            .catch((error) => {
                console.error(
                    "Impossibile caricare la proposta di percorso ciclo-turistico.",
                    error
                );
            });
    }

    L.control.layers = function (baseLayers, overlays, options) {
        const control = originalLayersFactory.call(
            L.control,
            baseLayers,
            overlays,
            options
        );

        if (
            overlays &&
            Object.prototype.hasOwnProperty.call(
                overlays,
                "Paesaggi significativi"
            )
        ) {
            enhanceLandscapeControl(control);
        }

        return control;
    };
})();
