(() => {
    "use strict";

    const map = window.NNMRCN_MAP;

    if (!map || !window.L) {
        return;
    }

    function escapeHtml(value) {
        return String(value)
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll('"', "&quot;")
            .replaceAll("'", "&#039;");
    }

    function labelCategoria(categoria) {
        if (categoria === "corso_d_acqua") {
            return "Corso d’acqua";
        }

        if (categoria === "cava") {
            return "Area di cava";
        }

        return "Paesaggio significativo";
    }

    function stilePrincipale(feature) {
        const categoria = feature.properties?.categoria;

        if (categoria === "cava") {
            return {
                color: "#5aaec8",
                weight: 3,
                opacity: 1,
                fillColor: "#7fc2d6",
                fillOpacity: 0.32
            };
        }

        return {
            color: "#4fa9c5",
            weight: 15,
            opacity: 0.58,
            lineCap: "round",
            lineJoin: "round"
        };
    }

    function stileDettaglio(feature) {
        const categoria = feature.properties?.categoria;

        if (categoria === "cava") {
            return {
                color: "#e5f7fb",
                weight: 2,
                opacity: 1,
                fill: false
            };
        }

        return {
            color: "#e5f7fb",
            weight: 4,
            opacity: 1,
            lineCap: "round",
            lineJoin: "round"
        };
    }

    function collegaInterazione(feature, layer) {
        const nome = feature.properties?.nome || "Paesaggio";
        const categoria = labelCategoria(feature.properties?.categoria);

        layer.bindTooltip(nome, {
            sticky: true,
            direction: "top"
        });

        layer.bindPopup(`
            <div class="popup-luogo popup-paesaggio">
                <strong>${escapeHtml(nome)}</strong>
                <span>${escapeHtml(categoria)}</span>
            </div>
        `);
    }

    fetch("./luoghi-significativi.geojson?v=20260823-2", {
        cache: "no-store"
    })
        .then((response) => {
            if (!response.ok) {
                throw new Error("Impossibile caricare i paesaggi significativi.");
            }

            return response.json();
        })
        .then((data) => {
            const paesaggi = L.layerGroup().addTo(map);

            const principale = L.geoJSON(data, {
                style: stilePrincipale,
                onEachFeature: collegaInterazione
            });

            const dettaglio = L.geoJSON(data, {
                interactive: false,
                style: stileDettaglio
            });

            principale.addTo(paesaggi);
            dettaglio.addTo(paesaggi);

            if (map.createPane && !window.NNMRCN_PAESAGGI_READY) {
                window.NNMRCN_PAESAGGI_READY = true;
            }

            window.NNMRCN_PAESAGGI_LAYER = paesaggi;
        })
        .catch((error) => {
            console.error("nnMrcn paesaggi:", error);
        });
})();
