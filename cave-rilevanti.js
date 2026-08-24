(() => {
    "use strict";

    if (!window.NNMRCN_MAP || !window.L?.geoJSON) {
        return;
    }

    const mapExtensions = window.NNMRCN_MAP;
    const PLACES_NAME = "Luoghi rilevanti lungo il percorso";
    const LANDSCAPES_URL = "./luoghi-significativi.geojson";

    const CAVE_INFO = Object.freeze({
        "Cave del Praello": {
            nome: "Cave del Praello",
            descrizione: "Cave del Praello lungo la parte meridionale del percorso.",
            municipalUrl: "https://www.comune.marcon.ve.it/vivere-il-comune/luoghi/cave-del-praello/",
            municipalLabel: "Scheda del luogo — Comune di Marcon",
            wikipediaUrl: "https://it.wikipedia.org/wiki/Marcon"
        },
        "Cave di Gaggio nord": {
            nome: "Cave di Gaggio Nord",
            descrizione: "Area delle cave di Gaggio Nord, comprendente l’oasi naturalistica.",
            municipalUrl: "https://www.comune.marcon.ve.it/vivere-il-comune/luoghi/oasi-cave-di-gaggio-nord/",
            municipalLabel: "Scheda del luogo — Comune di Marcon",
            wikipediaUrl: "https://it.wikipedia.org/wiki/Gaggio_(Marcon)"
        }
    });

    function areaStyle() {
        return {
            color: "#9b3f18",
            weight: 3,
            opacity: 1,
            fillColor: "#e27a36",
            fillOpacity: 0.30
        };
    }

    function appendLink(container, href, text) {
        const link = document.createElement("a");
        link.href = href;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        link.textContent = text;
        container.appendChild(link);
    }

    function buildPopup(info) {
        const root = document.createElement("div");
        root.className = "popup-luogo-rilevante";

        const title = document.createElement("strong");
        title.textContent = info.nome;

        const description = document.createElement("p");
        description.textContent = info.descrizione;

        const source = document.createElement("p");
        source.className = "popup-luogo-fonte-geometria";
        source.textContent = "Perimetro identico a quello del livello Cave.";

        const links = document.createElement("div");
        links.className = "popup-luogo-links";
        appendLink(links, info.municipalUrl, info.municipalLabel);
        appendLink(links, info.wikipediaUrl, "Wikipedia");

        root.append(title, description, source, links);
        return root;
    }

    async function addRelevantQuarries(targetGroup) {
        const data = await mapExtensions.loadGeoJSON(LANDSCAPES_URL);
        const features = (data.features || []).filter(
            (feature) => CAVE_INFO[feature.properties?.nome]
        );

        const layer = L.geoJSON(
            {
                type: "FeatureCollection",
                features
            },
            {
                style: areaStyle,
                onEachFeature(feature, featureLayer) {
                    const info = CAVE_INFO[feature.properties?.nome];
                    if (!info) {
                        return;
                    }

                    featureLayer.bindTooltip(info.nome, {
                        sticky: true,
                        direction: "top"
                    });
                    featureLayer.bindPopup(buildPopup(info), {
                        maxWidth: 340
                    });
                    featureLayer.on("mouseover", () => {
                        featureLayer.setStyle({
                            weight: 5,
                            fillOpacity: 0.42
                        });
                        featureLayer.bringToFront();
                    });
                    featureLayer.on("mouseout", () => {
                        featureLayer.setStyle(areaStyle());
                    });
                }
            }
        );

        targetGroup.addLayer(layer);
    }

    function enhanceRelevantPlaces(control) {
        const entry = control?._layers?.find(
            (item) => item.name === PLACES_NAME
        );
        const targetGroup = entry?.layer;

        if (!targetGroup || targetGroup.__nnmrcnExactQuarries) {
            return;
        }

        targetGroup.__nnmrcnExactQuarries = true;
        addRelevantQuarries(targetGroup).catch((error) => {
            console.error(
                "Impossibile aggiungere le cave ai luoghi rilevanti.",
                error
            );
        });
    }

    mapExtensions.registerExtension({
        control: enhanceRelevantPlaces
    });
})();
