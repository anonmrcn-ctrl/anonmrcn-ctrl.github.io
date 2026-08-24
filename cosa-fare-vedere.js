(() => {
    "use strict";

    if (!window.L?.control?.layers) {
        console.error("Leaflet non è disponibile: aree comunali non caricate.");
        return;
    }

    const OVERLAY_NAME = "Aree e località citate";
    const CATEGORY_NAME = "Cosa fare e vedere";
    const MUNICIPAL_PAGE_URL =
        "https://www.comune.marcon.ve.it/vivere-il-comune/territorio/cosa-fare-e-vedere/";

    const WIKIPEDIA_LINKS = Object.freeze({
        "Colmello": {
            url: "https://it.wikipedia.org/wiki/Marcon#Origini_del_nome",
            label: "Wikipedia — Marcon"
        },
        "Parco dello Zero": {
            url: "https://it.wikipedia.org/wiki/Zero_(fiume)",
            label: "Wikipedia — Zero (fiume)"
        },
        "Ex campo di volo": {
            url: "https://it.wikipedia.org/wiki/Campo_di_volo_di_Marcon",
            label: "Wikipedia — Campo di volo di Marcon"
        },
        "Oasi Cave di Gaggio Nord": {
            url: "https://it.wikipedia.org/wiki/Gaggio_(Marcon)",
            label: "Wikipedia — Gaggio (Marcon)"
        },
        "Gaggio": {
            url: "https://it.wikipedia.org/wiki/Gaggio_(Marcon)",
            label: "Wikipedia — Gaggio (Marcon)"
        },
        "San Liberale": {
            url: "https://it.wikipedia.org/wiki/San_Liberale_(Marcon)",
            label: "Wikipedia — San Liberale (Marcon)"
        },
        "Poian": {
            url: "https://it.wikipedia.org/wiki/Marcon#Origini_del_nome",
            label: "Wikipedia — Marcon"
        },
        "Le Crete": {
            url: "https://it.wikipedia.org/wiki/Quarto_d%27Altino#Geografia_antropica",
            label: "Wikipedia — Quarto d’Altino"
        },
        "Zuccarello": {
            url: "https://it.wikipedia.org/wiki/Marcon#Origini_del_nome",
            label: "Wikipedia — Marcon"
        },
        "Praello": {
            url: "https://it.wikipedia.org/wiki/Marcon#Origini_del_nome",
            label: "Wikipedia — Marcon"
        }
    });

    const previousLayersFactory = L.control.layers;

    function appendExternalLink(container, href, text) {
        const link = document.createElement("a");
        link.href = href;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        link.textContent = text;
        container.appendChild(link);
    }

    function buildPopup(feature) {
        const properties = feature.properties || {};
        const root = document.createElement("div");
        root.className = "popup-area-comune";

        const title = document.createElement("strong");
        title.textContent = properties.nome || "Area citata";
        root.appendChild(title);

        if (properties.descrizione) {
            const description = document.createElement("p");
            description.textContent = properties.descrizione;
            root.appendChild(description);
        }

        if (properties.precisione) {
            const precision = document.createElement("p");
            precision.className = "popup-area-precisione";
            precision.textContent = properties.precisione;
            root.appendChild(precision);
        }

        const links = document.createElement("div");
        links.className = "popup-area-links";

        appendExternalLink(
            links,
            MUNICIPAL_PAGE_URL,
            "Cosa fare e vedere — Comune di Marcon"
        );

        const wikipedia = WIKIPEDIA_LINKS[properties.nome];
        if (wikipedia) {
            appendExternalLink(links, wikipedia.url, wikipedia.label);
        }

        root.appendChild(links);
        return root;
    }

    function createAreaLayer(data) {
        const layerGroup = L.layerGroup();

        for (const feature of data.features || []) {
            if (feature.geometry?.type !== "Point") {
                continue;
            }

            const [lon, lat] = feature.geometry.coordinates || [];
            const radius = Number(feature.properties?.raggio_m) || 250;

            if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
                continue;
            }

            const area = L.circle([lat, lon], {
                radius,
                color: "#6d5733",
                weight: 2,
                opacity: 0.95,
                fillColor: "#bda36a",
                fillOpacity: 0.12,
                dashArray: "6 5"
            });

            area.bindTooltip(feature.properties?.nome || "Area citata", {
                sticky: true,
                direction: "top"
            });

            area.bindPopup(buildPopup(feature), {
                maxWidth: 340
            });

            area.addTo(layerGroup);
        }

        return layerGroup;
    }

    async function loadAreasLayer() {
        const response = await fetch("./cosa-fare-vedere.geojson", {
            cache: "no-store"
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        return createAreaLayer(await response.json());
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
                if (attempts < 60) {
                    requestAnimationFrame(tryInsert);
                }
                return;
            }

            if (list.querySelector(".livello-categoria-cosa-fare-vedere")) {
                return;
            }

            const label = [...list.querySelectorAll("label")].find(
                (item) => item.textContent.trim() === OVERLAY_NAME
            );

            if (!label) {
                if (attempts < 60) {
                    requestAnimationFrame(tryInsert);
                }
                return;
            }

            const heading = document.createElement("div");
            heading.className =
                "livello-categoria livello-categoria-cosa-fare-vedere";
            heading.textContent = CATEGORY_NAME;
            label.before(heading);
        }

        requestAnimationFrame(tryInsert);
    }

    function enhanceLandscapeControl(control) {
        if (control.__nnmrcnCosaFareVedere) {
            return;
        }

        control.__nnmrcnCosaFareVedere = true;

        loadAreasLayer()
            .then((areasLayer) => {
                control.addOverlay(areasLayer, OVERLAY_NAME);
                addCategoryHeading(control);
            })
            .catch((error) => {
                console.error(
                    "Impossibile caricare le aree citate in Cosa fare e vedere.",
                    error
                );
            });
    }

    L.control.layers = function (baseLayers, overlays, options) {
        const isLandscapeControl = Boolean(
            overlays &&
            Object.prototype.hasOwnProperty.call(
                overlays,
                "Paesaggi significativi"
            )
        );

        const control = previousLayersFactory.call(
            L.control,
            baseLayers,
            overlays,
            options
        );

        if (isLandscapeControl) {
            enhanceLandscapeControl(control);
        }

        return control;
    };
})();
