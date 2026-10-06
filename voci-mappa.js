(() => {
    "use strict";

    const api = window.NNMRCN_API;
    const mapExtensions = window.NNMRCN_MAP;

    if (!api || !mapExtensions || !window.L?.layerGroup) {
        return;
    }

    const layer = L.layerGroup();
    let entriesPromise = null;

    function entryFeature(entry) {
        return {
            type: "Feature",
            properties: {
                id: entry.id,
                nome: entry.name,
                categoria: entry.category,
                descrizione: entry.description,
                source_url: entry.sourceUrl,
                source_label: entry.sourceLabel
            },
            geometry: {
                type: "Point",
                coordinates: [entry.lon, entry.lat]
            }
        };
    }

    function markerStyle(category) {
        const colors = {
            edificio: "#8f3d22",
            monumento: "#7a4c14",
            infrastruttura: "#3f4f5e",
            paesaggio: "#23714d",
            corso_d_acqua: "#006e8a",
            cava: "#9b3f18",
            percorso: "#a34d2f",
            luogo: "#171717"
        };

        return {
            radius: 8,
            color: colors[category] || colors.luogo,
            weight: 2,
            fillColor: "#f4f1e8",
            fillOpacity: 0.92
        };
    }

    function popupContent(entry) {
        const root = document.createElement("div");
        const title = document.createElement("strong");

        root.className = "popup-luogo-rilevante";
        title.textContent = entry.name;
        root.appendChild(title);

        if (entry.description) {
            const description = document.createElement("p");
            description.textContent = entry.description;
            root.appendChild(description);
        }

        if (entry.sourceUrl) {
            const links = document.createElement("div");
            const link = document.createElement("a");

            links.className = "popup-luogo-links";
            link.href = entry.sourceUrl;
            link.target = "_blank";
            link.rel = "noopener noreferrer";
            link.textContent = entry.sourceLabel || "Fonte esterna";
            links.appendChild(link);
            root.appendChild(links);
        }

        return root;
    }

    function renderEntries(entries) {
        layer.clearLayers();

        entries.forEach((entry) => {
            if (!Number.isFinite(entry.lat) || !Number.isFinite(entry.lon)) {
                return;
            }

            const feature = entryFeature(entry);
            const marker = L.circleMarker(
                [entry.lat, entry.lon],
                markerStyle(entry.category)
            );

            marker.feature = feature;
            marker.bindTooltip(entry.name, {
                sticky: true,
                direction: "top"
            });
            marker.bindPopup(popupContent(entry), {
                maxWidth: 340
            });
            marker.addTo(layer);
        });
    }

    async function load() {
        if (!entriesPromise) {
            entriesPromise = api.request("/api/public/map-entries")
                .then((data) => {
                    const entries = Array.isArray(data?.entries)
                        ? data.entries
                        : [];

                    renderEntries(entries);
                    return entries;
                })
                .catch((error) => {
                    entriesPromise = null;
                    throw error;
                });
        }

        return entriesPromise;
    }

    window.NNMRCN_MAP_ENTRIES = Object.freeze({
        layer,
        load,
        entryFeature
    });
})();
