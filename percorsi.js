(() => {
    "use strict";

    if (!window.L?.control?.layers || !window.NNMRCN_MAP) {
        console.error("Leaflet non è disponibile: percorsi e paesaggi non caricati.");
        return;
    }

    const mapExtensions = window.NNMRCN_MAP;
    const ROUTE_NAME = "Proposta di percorso ciclo-turistico";
    const SOUTH_ROUTE_NAME = "Marcon da sud";
    const PLACES_NAME = "Luoghi rilevanti lungo il percorso";
    const RIVERS_NAME = "Fiumi";
    const QUARRIES_NAME = "Cave";
    const MUNICIPAL_PAGE_URL =
        "https://www.comune.marcon.ve.it/vivere-il-comune/territorio/cosa-fare-e-vedere/";
    const MUNICIPAL_LINK_TEXT = "Cosa fare e vedere";
    const OVERPASS_URL = "https://overpass-api.de/api/interpreter";
    const originalLayersFactory = L.control.layers;

    function appendExternalLink(container, href, text) {
        if (!href) {
            return;
        }

        const link = document.createElement("a");
        link.href = href;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        link.textContent = text;
        container.appendChild(link);
    }

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
                paragraph.appendChild(link);

                paragraph.append(
                    document.createTextNode(
                        description.slice(linkIndex + MUNICIPAL_LINK_TEXT.length)
                    )
                );
            }

            root.appendChild(paragraph);
        }

        const actions = mapExtensions.createRouteActions(feature);
        if (actions) {
            root.appendChild(actions);
        }

        return root;
    }

    function buildPlacePopup(feature, geometrySource = "Posizione cartografica") {
        const properties = feature.properties || {};
        const root = document.createElement("div");
        root.className = "popup-luogo-rilevante";

        const title = document.createElement("strong");
        title.textContent = properties.nome || "Luogo rilevante";
        root.appendChild(title);

        if (properties.descrizione) {
            const description = document.createElement("p");
            description.textContent = properties.descrizione;
            root.appendChild(description);
        }

        const source = document.createElement("p");
        source.className = "popup-luogo-fonte-geometria";
        source.textContent = geometrySource;
        root.appendChild(source);

        const links = document.createElement("div");
        links.className = "popup-luogo-links";

        appendExternalLink(
            links,
            properties.municipal_url || MUNICIPAL_PAGE_URL,
            properties.municipal_url === MUNICIPAL_PAGE_URL
                ? "Cosa fare e vedere — Comune di Marcon"
                : "Scheda del luogo — Comune di Marcon"
        );

        if (properties.wikipedia_url) {
            appendExternalLink(links, properties.wikipedia_url, "Wikipedia");
        }

        root.appendChild(links);
        return root;
    }

    function bindRelevantPlace(layer, feature, geometrySource) {
        const name = feature.properties?.nome || "Luogo rilevante";

        layer.bindTooltip(name, {
            sticky: true,
            direction: "top"
        });

        layer.bindPopup(buildPlacePopup(feature, geometrySource), {
            maxWidth: 340
        });

        if (layer instanceof L.Polygon) {
            layer.on("mouseover", () => {
                layer.setStyle({
                    weight: 5,
                    fillOpacity: 0.42
                });

                if (typeof layer.bringToFront === "function") {
                    layer.bringToFront();
                }
            });

            layer.on("mouseout", () => {
                layer.setStyle(relevantAreaStyle());
            });
        }

        return layer;
    }

    function relevantAreaStyle() {
        return {
            color: "#9b3f18",
            weight: 3,
            opacity: 1,
            fillColor: "#e27a36",
            fillOpacity: 0.30
        };
    }

    function relevantPointStyle(feature) {
        const isLocality = feature.properties?.tipo === "localita";

        return {
            radius: isLocality ? 6 : 8,
            color: "#8a3414",
            weight: 3,
            opacity: 1,
            fillColor: isLocality ? "#f4f1e8" : "#e27a36",
            fillOpacity: isLocality ? 0.92 : 0.9
        };
    }

    function createFallbackPlaceLayer(feature) {
        const coordinates = feature.geometry?.coordinates;

        if (!Array.isArray(coordinates) || coordinates.length < 2) {
            return null;
        }

        const [lon, lat] = coordinates;
        const marker = L.circleMarker([lat, lon], relevantPointStyle(feature));

        return bindRelevantPlace(
            marker,
            feature,
            feature.properties?.tipo === "localita"
                ? "Toponimo puntuale: la località non ha un perimetro amministrativo autonomo."
                : "Posizione puntuale verificata."
        );
    }

    function createExactOsmLayer(element, feature) {
        if (
            element?.type === "way" &&
            Array.isArray(element.geometry) &&
            element.geometry.length >= 3
        ) {
            const latlngs = element.geometry
                .filter(
                    (point) =>
                        Number.isFinite(point?.lat) &&
                        Number.isFinite(point?.lon)
                )
                .map((point) => [point.lat, point.lon]);

            if (latlngs.length >= 3) {
                return bindRelevantPlace(
                    L.polygon(latlngs, relevantAreaStyle()),
                    feature,
                    "Perimetro cartografico OpenStreetMap."
                );
            }
        }

        const center = element?.center;
        const lat = Number(center?.lat ?? element?.lat);
        const lon = Number(center?.lon ?? element?.lon);

        if (Number.isFinite(lat) && Number.isFinite(lon)) {
            return bindRelevantPlace(
                L.circleMarker([lat, lon], relevantPointStyle(feature)),
                feature,
                "Posizione cartografica OpenStreetMap."
            );
        }

        return null;
    }

    function haversineMeters(aLat, aLon, bLat, bLon) {
        const toRadians = (degrees) => (degrees * Math.PI) / 180;
        const earthRadius = 6371000;
        const dLat = toRadians(bLat - aLat);
        const dLon = toRadians(bLon - aLon);
        const lat1 = toRadians(aLat);
        const lat2 = toRadians(bLat);
        const h =
            Math.sin(dLat / 2) ** 2 +
            Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;

        return 2 * earthRadius * Math.asin(Math.sqrt(h));
    }

    function elementCenter(element) {
        if (Number.isFinite(element?.lat) && Number.isFinite(element?.lon)) {
            return { lat: element.lat, lon: element.lon };
        }

        if (
            Number.isFinite(element?.center?.lat) &&
            Number.isFinite(element?.center?.lon)
        ) {
            return element.center;
        }

        if (Array.isArray(element?.geometry) && element.geometry.length) {
            const valid = element.geometry.filter(
                (point) =>
                    Number.isFinite(point?.lat) &&
                    Number.isFinite(point?.lon)
            );

            if (valid.length) {
                return {
                    lat:
                        valid.reduce((sum, point) => sum + point.lat, 0) /
                        valid.length,
                    lon:
                        valid.reduce((sum, point) => sum + point.lon, 0) /
                        valid.length
                };
            }
        }

        return null;
    }

    function matchesLookup(element, kind) {
        const tags = element?.tags || {};

        if (kind === "church") {
            return (
                tags.building === "church" ||
                tags.amenity === "place_of_worship"
            );
        }

        if (kind === "place_of_worship") {
            return tags.amenity === "place_of_worship";
        }

        if (kind === "wayside_shrine") {
            return tags.historic === "wayside_shrine";
        }

        if (kind === "pumping_station") {
            return (
                ["pumping_station", "water_works"].includes(tags.man_made) ||
                Boolean(tags.pumping_station) ||
                tags.waterway === "pumping_station"
            );
        }

        return false;
    }

    function buildOverpassQuery(features) {
        const clauses = [];

        for (const feature of features) {
            const properties = feature.properties || {};

            if (Number.isInteger(Number(properties.osm_way))) {
                clauses.push(`way(${Number(properties.osm_way)});`);
            }

            const lookup = properties.osm_lookup;
            const coordinates = feature.geometry?.coordinates;

            if (!lookup || !Array.isArray(coordinates)) {
                continue;
            }

            const [lon, lat] = coordinates;
            const radius = Number(lookup.radius) || 100;

            if (lookup.kind === "church") {
                clauses.push(
                    `nwr(around:${radius},${lat},${lon})["building"="church"];`
                );
                clauses.push(
                    `nwr(around:${radius},${lat},${lon})["amenity"="place_of_worship"];`
                );
            } else if (lookup.kind === "place_of_worship") {
                clauses.push(
                    `nwr(around:${radius},${lat},${lon})["amenity"="place_of_worship"];`
                );
            } else if (lookup.kind === "wayside_shrine") {
                clauses.push(
                    `nwr(around:${radius},${lat},${lon})["historic"="wayside_shrine"];`
                );
            } else if (lookup.kind === "pumping_station") {
                clauses.push(
                    `nwr(around:${radius},${lat},${lon})["man_made"~"pumping_station|water_works"];`
                );
                clauses.push(
                    `nwr(around:${radius},${lat},${lon})["waterway"="pumping_station"];`
                );
            }
        }

        return clauses.length
            ? `[out:json][timeout:20];(${clauses.join("")});out center geom tags;`
            : "";
    }

    async function fetchOsmGeometry(features) {
        const query = buildOverpassQuery(features);

        if (!query) {
            return [];
        }

        const response = await fetch(OVERPASS_URL, {
            method: "POST",
            headers: {
                "Content-Type":
                    "application/x-www-form-urlencoded;charset=UTF-8"
            },
            body: `data=${encodeURIComponent(query)}`
        });

        if (!response.ok) {
            throw new Error(`Overpass HTTP ${response.status}`);
        }

        const data = await response.json();
        return data.elements || [];
    }

    function findBestOsmElement(feature, elements) {
        const properties = feature.properties || {};
        const exactWayId = Number(properties.osm_way);

        if (Number.isInteger(exactWayId)) {
            return (
                elements.find(
                    (element) =>
                        element.type === "way" &&
                        Number(element.id) === exactWayId
                ) || null
            );
        }

        const lookup = properties.osm_lookup;
        const coordinates = feature.geometry?.coordinates;

        if (!lookup || !Array.isArray(coordinates)) {
            return null;
        }

        const [lon, lat] = coordinates;
        const radius = Number(lookup.radius) || 100;
        let best = null;
        let bestDistance = Infinity;

        for (const element of elements) {
            if (!matchesLookup(element, lookup.kind)) {
                continue;
            }

            const center = elementCenter(element);
            if (!center) {
                continue;
            }

            const distance = haversineMeters(
                lat,
                lon,
                center.lat,
                center.lon
            );

            if (distance <= radius && distance < bestDistance) {
                best = element;
                bestDistance = distance;
            }
        }

        return best;
    }

    async function loadRelevantPlacesLayer() {
        const data = await mapExtensions.loadGeoJSON("./luoghi-rilevanti.geojson");
        const features = data.features || [];
        const layerGroup = L.layerGroup();
        const fallbackLayers = new Map();

        for (const feature of features) {
            const layer = createFallbackPlaceLayer(feature);
            if (!layer) {
                continue;
            }

            layer.addTo(layerGroup);
            fallbackLayers.set(feature, layer);
        }

        layerGroup.once("add", () => {
            fetchOsmGeometry(features)
                .then((elements) => {
                    let usedOsmGeometry = false;

                    for (const feature of features) {
                        const element = findBestOsmElement(feature, elements);
                        if (!element) {
                            continue;
                        }

                        const exactLayer = createExactOsmLayer(element, feature);
                        if (!exactLayer) {
                            continue;
                        }

                        const fallback = fallbackLayers.get(feature);
                        if (fallback) {
                            layerGroup.removeLayer(fallback);
                        }

                        exactLayer.addTo(layerGroup);
                        usedOsmGeometry = true;
                    }

                    if (
                        usedOsmGeometry &&
                        window.__nnmrcnMap?.attributionControl
                    ) {
                        window.__nnmrcnMap.attributionControl.addAttribution(
                            '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap contributors</a>'
                        );
                    }
                })
                .catch((error) => {
                    console.warn(
                        "Perimetri OpenStreetMap non disponibili: uso le posizioni locali.",
                        error
                    );
                });
        });

        return layerGroup;
    }

    async function loadRouteLayer() {
        const data = await mapExtensions.loadGeoJSON("./percorsi.geojson");

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
                    maxWidth: 320,
                    maxHeight: 320
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
            window.__nnmrcnMap = targetMap;
            targetMap.removeLayer(landscapeLayer);
            riversLayer.addTo(targetMap);
            quarriesLayer.addTo(targetMap);
        }

        return { riversLayer, quarriesLayer };
    }

    function findLabel(list, text) {
        return (
            [...list.querySelectorAll("label")].find(
                (label) =>
                    label.dataset.routeName === text ||
                    label.textContent.trim() === text
            ) || null
        );
    }

    function closeRouteMenus(list, excludedMenu = null) {
        for (const menu of list.querySelectorAll(".percorso-livello-menu")) {
            if (menu === excludedMenu) {
                continue;
            }

            const button = menu.querySelector(".percorso-livello-pulsante");
            const panel = menu.querySelector(".percorso-livello-pannello");

            if (!button || !panel) {
                continue;
            }

            button.setAttribute("aria-expanded", "false");
            panel.hidden = true;
        }
    }

    function addRouteMenu(list, name, geojsonUrl) {
        const label = findLabel(list, name);

        if (!label) {
            return false;
        }

        if (label.dataset.routeMenu === "ready") {
            return true;
        }

        const row = document.createElement("div");
        const menu = document.createElement("div");
        const button = document.createElement("button");
        const panel = document.createElement("div");

        row.className = "percorso-livello-riga";
        menu.className = "percorso-livello-menu";
        button.className = "percorso-livello-pulsante";
        button.type = "button";
        button.textContent = "⋯";
        button.setAttribute("aria-label", "Azioni per " + name);
        button.setAttribute("aria-expanded", "false");
        button.setAttribute("aria-haspopup", "true");
        panel.className = "percorso-livello-pannello";
        panel.hidden = true;
        label.dataset.routeName = name;
        label.dataset.routeMenu = "ready";

        label.replaceWith(row);
        row.append(label, menu);
        menu.append(button, panel);

        button.addEventListener("click", async (event) => {
            event.preventDefault();
            event.stopPropagation();

            const shouldOpen = panel.hidden;

            closeRouteMenus(list, shouldOpen ? menu : null);

            if (!shouldOpen) {
                return;
            }

            panel.hidden = false;
            button.setAttribute("aria-expanded", "true");

            if (panel.dataset.loaded === "true") {
                return;
            }

            panel.textContent = "Caricamento…";

            try {
                const data = await mapExtensions.loadGeoJSON(geojsonUrl);
                const feature = (data.features || []).find(
                    (candidate) => candidate.properties?.nome === name
                );
                const actions = feature
                    ? mapExtensions.createRouteActions(feature)
                    : null;

                if (!actions) {
                    throw new Error("Percorso non disponibile.");
                }

                panel.replaceChildren(actions);
                panel.dataset.loaded = "true";
            } catch (error) {
                panel.textContent = "Impossibile caricare il percorso.";
                console.error("Impossibile aprire il menu del percorso.", error);
            }
        });

        panel.addEventListener("click", (event) => {
            event.stopPropagation();
        });

        if (list.dataset.routeMenusEvents !== "ready") {
            document.addEventListener("click", () => closeRouteMenus(list));
            list.addEventListener("keydown", (event) => {
                if (event.key === "Escape") {
                    closeRouteMenus(list);
                }
            });
            list.dataset.routeMenusEvents = "ready";
        }

        return true;
    }

    function addHeading(list, beforeText, className, headingText) {
        if (list.querySelector(`.${className}`)) {
            return true;
        }

        const label = findLabel(list, beforeText);
        if (!label) {
            return false;
        }

        const heading = document.createElement("div");
        heading.className = `livello-categoria ${className}`;
        heading.textContent = headingText;
        label.before(heading);
        return true;
    }

    function organizeControl(control) {
        let attempts = 0;

        function apply() {
            attempts += 1;

            const list = control
                .getContainer?.()
                ?.querySelector(".leaflet-control-layers-overlays");

            if (!list) {
                if (attempts < 60) {
                    requestAnimationFrame(apply);
                }
                return;
            }

            const routesReady = addHeading(
                list,
                ROUTE_NAME,
                "livello-categoria-percorsi",
                "Percorsi"
            );

            const landscapeReady = addHeading(
                list,
                RIVERS_NAME,
                "livello-categoria-zone-paesaggistiche",
                "Zone paesaggistiche"
            );

            const placesLabel = findLabel(list, PLACES_NAME);
            if (placesLabel) {
                placesLabel.classList.add("livello-sottolivello");
            }

            const cycleRouteMenuReady = addRouteMenu(
                list,
                ROUTE_NAME,
                "./percorsi.geojson"
            );
            const southRouteMenuReady = addRouteMenu(
                list,
                SOUTH_ROUTE_NAME,
                "./marcon-da-sud.geojson"
            );

            if (
                (!routesReady ||
                    !landscapeReady ||
                    !placesLabel ||
                    !cycleRouteMenuReady ||
                    !southRouteMenuReady) &&
                attempts < 60
            ) {
                requestAnimationFrame(apply);
            }
        }

        requestAnimationFrame(apply);
    }

    function populateAsyncGroup(group, loader, errorMessage) {
        let started = false;
        const load = () => {
            if (started) {
                return;
            }

            started = true;
            loader()
                .then((layer) => group.addLayer(layer))
                .catch((error) => console.error(errorMessage, error));
        };

        if (window.NNMRCN_SETTINGS?.isLightMapEnabled?.()) {
            group.once("add", load);
        } else {
            load();
        }
    }

    L.control.layers = function (baseLayers, overlays, options) {
        let normalizedOverlays = overlays;
        let shouldOrganize = false;

        if (
            overlays &&
            Object.prototype.hasOwnProperty.call(
                overlays,
                "Paesaggi significativi"
            )
        ) {
            const landscapeLayer = overlays["Paesaggi significativi"];
            const { riversLayer, quarriesLayer } =
                splitLandscapeLayer(landscapeLayer);
            const routeLayer = L.layerGroup();
            const relevantPlacesLayer = L.layerGroup();

            normalizedOverlays = {
                [ROUTE_NAME]: routeLayer,
                [PLACES_NAME]: relevantPlacesLayer,
                [RIVERS_NAME]: riversLayer,
                [QUARRIES_NAME]: quarriesLayer
            };

            populateAsyncGroup(
                routeLayer,
                loadRouteLayer,
                "Impossibile caricare la proposta di percorso ciclo-turistico."
            );
            populateAsyncGroup(
                relevantPlacesLayer,
                loadRelevantPlacesLayer,
                "Impossibile caricare i luoghi rilevanti lungo il percorso."
            );

            shouldOrganize = true;
        }

        const control = originalLayersFactory.call(
            L.control,
            baseLayers,
            mapExtensions.extendOverlays(normalizedOverlays),
            options
        );

        mapExtensions.enhanceControl(control);

        if (shouldOrganize) {
            organizeControl(control);
        }

        return control;
    };
})();
