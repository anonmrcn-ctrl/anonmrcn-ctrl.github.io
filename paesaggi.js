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
                color: "#7fc2d6",
                weight: 2,
                opacity: 0.9,
                fillColor: "#7fc2d6",
                fillOpacity: 0.18
            };
        }

        return {
            color: "#7fc2d6",
            weight: 12,
            opacity: 0.22,
            lineCap: "round",
            lineJoin: "round"
        };
    }

    function stileDettaglio(feature) {
        const categoria = feature.properties?.categoria;

        if (categoria === "cava") {
            return {
                color: "#d7f1f7",
                weight: 1.5,
                opacity: 0.95,
                fill: false
            };
        }

        return {
            color: "#d7f1f7",
            weight: 3,
            opacity: 0.95,
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

    fetch("./luoghi-significativi.geojson")
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

            window.NNMRCN_PAESAGGI_LAYER = paesaggi;
        })
        .catch((error) => {
            console.error(error);
        });
})();
