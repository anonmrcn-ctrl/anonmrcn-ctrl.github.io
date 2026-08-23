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

        return "Paesaggio significativo";
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

            const fascia = L.geoJSON(data, {
                style: {
                    color: "#7fc2d6",
                    weight: 12,
                    opacity: 0.22,
                    lineCap: "round",
                    lineJoin: "round"
                },
                onEachFeature(feature, layer) {
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
            });

            const linea = L.geoJSON(data, {
                interactive: false,
                style: {
                    color: "#d7f1f7",
                    weight: 3,
                    opacity: 0.95,
                    lineCap: "round",
                    lineJoin: "round"
                }
            });

            fascia.addTo(paesaggi);
            linea.addTo(paesaggi);

            window.NNMRCN_PAESAGGI_LAYER = paesaggi;
        })
        .catch((error) => {
            console.error(error);
        });
})();
