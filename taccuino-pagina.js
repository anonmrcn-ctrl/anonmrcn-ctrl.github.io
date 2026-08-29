(() => {
    "use strict";

    const notebook = window.NNMRCN_TACCUINO;
    const settingsManager = window.NNMRCN_SETTINGS;
    const elements = {
        map: document.getElementById("taccuinoMap"),
        list: document.getElementById("taccuinoLista"),
        status: document.getElementById("taccuinoStatus"),
        exportGeojson: document.getElementById("taccuinoEsportaGeojson"),
        exportJson: document.getElementById("taccuinoEsportaJson"),
        clear: document.getElementById("taccuinoSvuota")
    };

    if (!notebook || !elements.map || !window.L) {
        return;
    }

    let started = false;

    document.addEventListener("nnmrcn:sessionchange", (event) => {
        if (event.detail?.authenticated) {
            start();
        }
    });

    if (!elements.map.closest("[data-spazio-personale-contenuto]")?.hidden) {
        start();
    }

    function start() {
        if (started) {
            return;
        }

        started = true;

        const lightMap = settingsManager?.isLightMapEnabled?.() || false;
    const reduceMotion = Boolean(
        settingsManager?.shouldReduceMotion?.() || lightMap
    );
    const map = L.map(elements.map, {
        fadeAnimation: !lightMap,
        markerZoomAnimation: !lightMap,
        zoomAnimation: !lightMap
    }).setView([45.5515, 12.3278], 13);
    const markersLayer = L.layerGroup().addTo(map);
    const markers = new Map();

    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        keepBuffer: lightMap ? 1 : 2,
        updateWhenIdle: lightMap,
        attribution: "&copy; OpenStreetMap contributors"
    }).addTo(map);

    elements.exportGeojson.addEventListener("click", exportGeojson);
    elements.exportJson.addEventListener("click", exportJson);
    elements.clear.addEventListener("click", clearNotebook);
    document.addEventListener("nnmrcn:taccuinochange", render);
        render();

    function render() {
        const items = notebook.list();
        const coordinateItems = items.filter(
            (item) => Number.isFinite(item.lat) && Number.isFinite(item.lon)
        );

        markersLayer.clearLayers();
        markers.clear();
        elements.list.replaceChildren();

        coordinateItems.forEach((item) => {
            const marker = L.circleMarker([item.lat, item.lon], {
                radius: 7,
                color: "#171717",
                weight: 2,
                fillColor: "#f4f1e8",
                fillOpacity: 0.95
            }).addTo(markersLayer);
            marker.bindPopup(buildPopup(item));
            markers.set(item.id, marker);
        });

        items.forEach((item) => {
            elements.list.appendChild(buildCard(item));
        });

        if (!items.length) {
            const empty = document.createElement("p");
            empty.textContent =
                "Il taccuino è vuoto. Usa «Salva nel taccuino» mentre esplori il sito.";
            elements.list.appendChild(empty);
            elements.status.textContent = "Nessun elemento salvato";
        } else {
            elements.status.textContent =
                `${items.length} ${items.length === 1 ? "elemento salvato" : "elementi salvati"}`;
        }

        elements.exportGeojson.disabled = !coordinateItems.length;
        elements.exportJson.disabled = !items.length;
        elements.clear.disabled = !items.length;

        if (coordinateItems.length) {
            const bounds = L.latLngBounds(
                coordinateItems.map((item) => [item.lat, item.lon])
            );
            map.fitBounds(bounds, {
                animate: !reduceMotion,
                padding: [35, 35],
                maxZoom: 16
            });
        }
    }

    function buildPopup(item) {
        const container = document.createElement("article");
        container.className = "taccuino-popup";
        const title = document.createElement("h3");
        title.textContent = item.title;
        const link = document.createElement("a");
        link.href = item.url;
        link.textContent = "Apri nel sito";
        container.append(title, link);
        return container;
    }

    function buildCard(item) {
        const article = document.createElement("article");
        article.className = "taccuino-card";
        const type = document.createElement("p");
        type.className = "taccuino-card-tipo";
        type.textContent = typeLabel(item.type);
        const title = document.createElement("h3");
        title.textContent = item.title;
        const text = document.createElement("p");
        text.textContent = item.text || "Nessuna nota testuale.";
        const date = document.createElement("p");
        date.className = "taccuino-card-data";
        date.textContent = `Salvato il ${new Date(item.savedAt).toLocaleDateString("it-IT")}`;
        const actions = document.createElement("div");
        actions.className = "taccuino-card-azioni";
        const open = document.createElement("a");
        open.href = item.url;
        open.textContent = "Apri";
        const remove = document.createElement("button");
        remove.type = "button";
        remove.textContent = "Rimuovi";
        remove.addEventListener("click", () => notebook.remove(item.id));

        actions.appendChild(open);

        if (markers.has(item.id)) {
            const locate = document.createElement("button");
            locate.type = "button";
            locate.textContent = "Mostra sulla mappa";
            locate.addEventListener("click", () => {
                const marker = markers.get(item.id);
                map.setView(marker.getLatLng(), 16, {
                    animate: !reduceMotion
                });
                marker.openPopup();
                elements.map.scrollIntoView({
                    behavior: settingsManager?.scrollBehavior?.() || "smooth",
                    block: "center"
                });
            });
            actions.appendChild(locate);
        }

        actions.appendChild(remove);
        article.append(type, title, text, date, actions);
        return article;
    }

    function typeLabel(type) {
        return {
            luogo: "Luogo",
            percorso: "Percorso",
            verso: "Verso della poesia",
            memoria: "Memoria",
            messaggio: "Messaggio"
        }[type] || "Elemento";
    }

    function exportGeojson() {
        const features = notebook.list()
            .filter((item) => Number.isFinite(item.lat) && Number.isFinite(item.lon))
            .map((item) => ({
                type: "Feature",
                geometry: {
                    type: "Point",
                    coordinates: [item.lon, item.lat]
                },
                properties: {
                    id: item.id,
                    tipo: item.type,
                    titolo: item.title,
                    testo: item.text,
                    collegamento: new URL(item.url, window.location.href).href,
                    salvatoIl: new Date(item.savedAt).toISOString()
                }
            }));

        download(
            JSON.stringify({ type: "FeatureCollection", features }, null, 2),
            "application/geo+json",
            `taccuino-nnmrcn-${dateStamp()}.geojson`
        );
    }

    function exportJson() {
        download(
            JSON.stringify(notebook.list(), null, 2),
            "application/json",
            `taccuino-nnmrcn-${dateStamp()}.json`
        );
    }

    function download(content, type, fileName) {
        const blob = new Blob([content], { type });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    }

    function dateStamp() {
        return new Date().toISOString().slice(0, 10);
    }

    function clearNotebook() {
        if (window.confirm("Vuoi rimuovere tutti gli elementi dal taccuino?")) {
            notebook.clear();
        }
    }
    }
})();
