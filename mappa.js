(() => {
    "use strict";

    const requests = new Map();
    const extensions = [];
    const SHARED_ROUTE_MAPS = Object.freeze({
        "Proposta di percorso ciclo-turistico":
            "https://www.google.com/maps/d/viewer?mid=1PWXQp0S-adpXSgptsQ3P2M6-0ZknzLQ&ll=45.54686084234527%2C12.32669999999998&z=13",
        "Marcon da sud":
            "https://www.google.com/maps/d/viewer?mid=1EUiKbigNCJ2wfTDtj2iaTgOdZIX-oE4&ll=45.54272096882251%2C12.296092999999999&z=15"
    });

    function loadGeoJSON(url) {
        const cached = requests.get(url);

        if (cached) {
            return cached;
        }

        const request = fetch(url).then((response) => {
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            return response.json();
        });

        requests.set(url, request);
        request.catch(() => {
            if (requests.get(url) === request) {
                requests.delete(url);
            }
        });

        return request;
    }

    function routeCoordinates(feature) {
        const geometry = feature?.geometry;
        let coordinates = [];

        if (geometry?.type === "LineString") {
            coordinates = geometry.coordinates || [];
        } else if (geometry?.type === "MultiLineString") {
            coordinates = (geometry.coordinates || []).flat();
        }

        return coordinates.filter(
            (coordinate) =>
                Array.isArray(coordinate) &&
                Number.isFinite(coordinate[0]) &&
                Number.isFinite(coordinate[1])
        );
    }

    function coordinateLabel(coordinate) {
        return coordinate[1].toFixed(6) + "," + coordinate[0].toFixed(6);
    }

    function routeWaypoints(coordinates) {
        const distances = [0];
        let totalDistance = 0;

        for (let index = 1; index < coordinates.length; index += 1) {
            const previous = coordinates[index - 1];
            const current = coordinates[index];
            const longitudeScale = Math.cos(
                ((previous[1] + current[1]) * Math.PI) / 360
            );

            totalDistance += Math.hypot(
                (current[0] - previous[0]) * longitudeScale,
                current[1] - previous[1]
            );
            distances.push(totalDistance);
        }

        if (!totalDistance) {
            return [];
        }

        const waypoints = [];
        let coordinateIndex = 1;

        for (let index = 1; index <= 3; index += 1) {
            const targetDistance = (totalDistance * index) / 4;

            while (
                coordinateIndex < coordinates.length - 1 &&
                distances[coordinateIndex] < targetDistance
            ) {
                coordinateIndex += 1;
            }

            if (coordinateIndex >= coordinates.length - 1) {
                continue;
            }

            const waypoint = coordinateLabel(coordinates[coordinateIndex]);

            if (!waypoints.includes(waypoint)) {
                waypoints.push(waypoint);
            }
        }

        return waypoints;
    }

    function buildGoogleMapsUrl(coordinates) {
        const url = new URL("https://www.google.com/maps/dir/");
        const waypoints = routeWaypoints(coordinates);

        url.searchParams.set("api", "1");
        url.searchParams.set("origin", coordinateLabel(coordinates[0]));
        url.searchParams.set(
            "destination",
            coordinateLabel(coordinates[coordinates.length - 1])
        );
        url.searchParams.set("travelmode", "bicycling");

        if (waypoints.length) {
            url.searchParams.set("waypoints", waypoints.join("|"));
        }

        return url.toString();
    }

    function escapeXml(value) {
        return String(value)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&apos;");
    }

    function buildGpx(coordinates, name, description) {
        const points = coordinates.map(
            ([longitude, latitude]) =>
                '      <trkpt lat="' +
                latitude +
                '" lon="' +
                longitude +
                '"></trkpt>'
        );
        const lines = [
            '<?xml version="1.0" encoding="UTF-8"?>',
            '<gpx version="1.1" creator="NNMRCN" xmlns="http://www.topografix.com/GPX/1/1">',
            "  <trk>",
            "    <name>" + escapeXml(name) + "</name>"
        ];

        if (description) {
            lines.push("    <desc>" + escapeXml(description) + "</desc>");
        }

        lines.push("    <trkseg>", ...points, "    </trkseg>", "  </trk>", "</gpx>");

        return lines.join("\n");
    }

    function buildKml(coordinates, name, description) {
        const points = coordinates
            .map(([longitude, latitude]) => longitude + "," + latitude + ",0")
            .join(" ");
        const lines = [
            '<?xml version="1.0" encoding="UTF-8"?>',
            '<kml xmlns="http://www.opengis.net/kml/2.2">',
            "  <Document>",
            "    <name>" + escapeXml(name) + "</name>",
            "    <Placemark>",
            "      <name>" + escapeXml(name) + "</name>"
        ];

        if (description) {
            lines.push(
                "      <description>" + escapeXml(description) + "</description>"
            );
        }

        lines.push(
            "      <LineString>",
            "        <tessellate>1</tessellate>",
            "        <coordinates>" + points + "</coordinates>",
            "      </LineString>",
            "    </Placemark>",
            "  </Document>",
            "</kml>"
        );

        return lines.join("\n");
    }

    function routeFileName(name) {
        return (
            name
                .normalize("NFD")
                .replace(/[\u0300-\u036f]/g, "")
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, "-")
                .replace(/^-+|-+$/g, "") || "percorso"
        );
    }

    function appendDownloadAction(container, label, fileName, type, content) {
        const button = document.createElement("button");

        button.type = "button";
        button.className = "popup-percorso-esporta";
        button.textContent = label;
        button.addEventListener("click", () => {
            const file = new Blob([content], { type });
            const objectUrl = URL.createObjectURL(file);
            const link = document.createElement("a");

            link.href = objectUrl;
            link.download = fileName;
            document.body.appendChild(link);
            link.click();
            link.remove();

            window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
        });

        container.appendChild(button);
    }

    function createRouteActions(feature, options = {}) {
        const coordinates = routeCoordinates(feature);

        if (coordinates.length < 2) {
            return null;
        }

        const properties = feature.properties || {};
        const name = options.name || properties.nome || "Percorso";
        const description =
            options.description ?? properties.descrizione ?? "";
        const fileName = routeFileName(name);
        const actions = document.createElement("div");
        const mapsLink = document.createElement("a");

        actions.className = "popup-percorso-azioni";
        mapsLink.href =
            options.mapsUrl ||
            properties.google_maps_url ||
            SHARED_ROUTE_MAPS[name] ||
            buildGoogleMapsUrl(coordinates);
        mapsLink.target = "_blank";
        mapsLink.rel = "noopener noreferrer";
        mapsLink.textContent = "Apri in Google Maps";
        actions.appendChild(mapsLink);

        appendDownloadAction(
            actions,
            "Scarica GPX",
            fileName + ".gpx",
            "application/gpx+xml;charset=utf-8",
            buildGpx(coordinates, name, description)
        );
        appendDownloadAction(
            actions,
            "Scarica KML",
            fileName + ".kml",
            "application/vnd.google-earth.kml+xml;charset=utf-8",
            buildKml(coordinates, name, description)
        );

        return actions;
    }

    function registerExtension(extension) {
        extensions.push(extension);
    }

    function extendOverlays(overlays) {
        return extensions.reduce(
            (current, extension) =>
                typeof extension.overlays === "function"
                    ? extension.overlays(current)
                    : current,
            overlays
        );
    }

    function enhanceControl(control) {
        extensions.forEach((extension) => extension.control?.(control));
    }

    function enhanceFeature(feature, layer) {
        extensions.forEach((extension) => extension.feature?.(feature, layer));
    }

    window.NNMRCN_MAP = Object.freeze({
        loadGeoJSON,
        createRouteActions,
        registerExtension,
        extendOverlays,
        enhanceControl,
        enhanceFeature
    });
})();
