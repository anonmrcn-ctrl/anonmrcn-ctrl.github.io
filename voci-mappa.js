(() => {
    "use strict";

    const api = window.NNMRCN_API;
    const mapExtensions = window.NNMRCN_MAP;

    if (!api || !mapExtensions || !window.L?.layerGroup) {
        return;
    }

    const layer = L.layerGroup();
    const markersById = new Map();
    let entriesPromise = null;

    function entryUrl(entryId) {
        const url = new URL("./progetto.html", document.baseURI);

        url.searchParams.set("luogo", String(entryId));
        url.hash = "map";
        return url.href;
    }

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
            description.className = "popup-luogo-descrizione";
            description.textContent = entry.description;
            root.appendChild(description);
        }

        const links = document.createElement("div");
        const directLink = document.createElement("a");

        links.className = "popup-luogo-links";
        directLink.href = entryUrl(entry.id);
        directLink.textContent = "Collegamento diretto a questo luogo";
        links.appendChild(directLink);

        if (entry.sourceUrl) {
            const link = document.createElement("a");

            link.href = entry.sourceUrl;
            link.target = "_blank";
            link.rel = "noopener noreferrer";
            link.textContent = entry.sourceLabel || "Fonte esterna";
            links.appendChild(link);
        }

        root.appendChild(links);

        return root;
    }

    function renderEntries(entries) {
        layer.clearLayers();
        markersById.clear();

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
                minWidth: 200,
                maxWidth: 280,
                autoPanPadding: [24, 24]
            });
            marker.addTo(layer);
            markersById.set(Number(entry.id), marker);
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

    async function open(entryId, map) {
        const id = Number(entryId);

        if (!Number.isInteger(id) || id <= 0 || !map) {
            return false;
        }

        await load();

        const marker = markersById.get(id);

        if (!marker) {
            return false;
        }

        if (!map.hasLayer(layer)) {
            layer.addTo(map);
        }

        map.setView(marker.getLatLng(), Math.max(map.getZoom(), 16), {
            animate: false
        });

        window.requestAnimationFrame(() => marker.openPopup());
        return true;
    }

    window.NNMRCN_MAP_ENTRIES = Object.freeze({
        layer,
        load,
        open,
        entryUrl,
        entryFeature
    });
})();
