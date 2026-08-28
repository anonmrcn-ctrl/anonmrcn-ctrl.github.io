(() => {
    "use strict";

    const api = window.NNMRCN_API;
    const settingsManager = window.NNMRCN_SETTINGS;
    const toggle = document.getElementById("richiestaCodiceToggle");
    const form = document.getElementById("richiestaCodiceForm");
    const username = document.getElementById("richiestaUsername");
    const address = document.getElementById("richiestaIndirizzo");
    const email = document.getElementById("richiestaEmail");
    const website = document.getElementById("richiestaSito");
    const submit = document.getElementById("richiestaCodiceInvia");
    const status = document.getElementById("richiestaCodiceStatus");
    const mapToggle = document.getElementById("richiestaMappaToggle");
    const mapClear = document.getElementById("richiestaMappaRimuovi");
    const mapPanel = document.getElementById("richiestaLocationPanel");
    const mapElement = document.getElementById("richiestaLocationMappa");
    const mapStatus = document.getElementById("richiestaMappaStatus");
    const latitude = document.getElementById("richiestaLatitudine");
    const longitude = document.getElementById("richiestaLongitudine");

    if (
        !api ||
        !toggle ||
        !form ||
        !username ||
        !address ||
        !email ||
        !submit ||
        !status ||
        !mapToggle ||
        !mapClear ||
        !mapPanel ||
        !mapElement ||
        !mapStatus ||
        !latitude ||
        !longitude
    ) {
        return;
    }

    let pickerMap = null;
    let pickerMarker = null;

    toggle.addEventListener("click", (event) => {
        event.preventDefault();
        form.hidden = !form.hidden;
        toggle.setAttribute("aria-expanded", String(!form.hidden));

        if (!form.hidden) {
            username.focus();
        }
    });

    mapToggle.addEventListener("click", () => {
        mapPanel.hidden = !mapPanel.hidden;
        mapToggle.setAttribute("aria-expanded", String(!mapPanel.hidden));
        mapToggle.textContent = mapPanel.hidden
            ? "Seleziona un punto dalla mappa"
            : "Nascondi la mappa";

        if (mapPanel.hidden) {
            return;
        }

        initializeMap();
        window.requestAnimationFrame(() => pickerMap?.invalidateSize());
        mapPanel.scrollIntoView({
            behavior: settingsManager?.scrollBehavior?.() || "smooth",
            block: "nearest"
        });
    });

    mapClear.addEventListener("click", () => clearSelectedPoint(true));
    username.addEventListener("input", validateIdentity);
    address.addEventListener("input", validateIdentity);

    form.addEventListener("submit", async (event) => {
        event.preventDefault();

        validateIdentity();

        if (!form.reportValidity()) {
            return;
        }

        submit.disabled = true;
        status.textContent = "Invio in corso…";

        try {
            await api.request("/api/access-request", {
                method: "POST",
                body: JSON.stringify({
                    username: username.value.trim(),
                    address: address.value.trim(),
                    email: email.value.trim(),
                    lat: latitude.value || null,
                    lon: longitude.value || null,
                    website: website?.value || ""
                })
            });

            form.reset();
            clearSelectedPoint(false);
            status.textContent = "Richiesta di codice inviata all’admin.";
        } catch (error) {
            status.textContent =
                error.code === "API_NOT_CONFIGURED"
                    ? "Invio temporaneamente non disponibile."
                    : error.message || "Non è stato possibile inviare la richiesta.";
        } finally {
            submit.disabled = false;
        }
    });

    function initializeMap() {
        if (pickerMap || typeof window.L === "undefined") {
            if (!pickerMap && typeof window.L === "undefined") {
                mapStatus.textContent = "La mappa non è momentaneamente disponibile.";
            }
            return;
        }

        const lightMap = settingsManager?.isLightMapEnabled?.() || false;

        pickerMap = window.L.map(mapElement, {
            scrollWheelZoom: true,
            fadeAnimation: !lightMap,
            markerZoomAnimation: !lightMap,
            zoomAnimation: !lightMap
        }).setView([45.5515, 12.3278], 14);

        window.L.tileLayer(
            "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
            {
                maxZoom: 19,
                keepBuffer: lightMap ? 1 : 2,
                updateWhenIdle: lightMap,
                attribution: "&copy; OpenStreetMap contributors"
            }
        ).addTo(pickerMap);

        pickerMap.on("click", (event) => {
            setSelectedPoint(event.latlng.lat, event.latlng.lng);
        });
    }

    function setSelectedPoint(lat, lon) {
        latitude.value = Number(lat).toFixed(6);
        longitude.value = Number(lon).toFixed(6);

        if (pickerMarker) {
            pickerMarker.setLatLng([lat, lon]);
        } else {
            pickerMarker = window.L.circleMarker(
                [lat, lon],
                {
                    radius: 9,
                    color: "#171717",
                    weight: 2,
                    fillColor: "#f4f1e8",
                    fillOpacity: 1
                }
            ).addTo(pickerMap);
        }

        mapClear.hidden = false;
        mapStatus.textContent =
            `Punto selezionato: ${latitude.value}, ${longitude.value}`;
        validateIdentity();
    }

    function clearSelectedPoint(announce) {
        latitude.value = "";
        longitude.value = "";

        if (pickerMarker && pickerMap) {
            pickerMap.removeLayer(pickerMarker);
            pickerMarker = null;
        }

        mapClear.hidden = true;
        mapStatus.textContent = announce
            ? "Punto rimosso."
            : "Nessun punto selezionato.";
        validateIdentity();
    }

    function hasLocation() {
        return Boolean(
            address.value.trim() ||
            (latitude.value && longitude.value)
        );
    }

    function validateIdentity() {
        const valid = Boolean(username.value.trim() || hasLocation());
        username.setCustomValidity(
            valid
                ? ""
                : "Inserisci almeno lo username oppure la tua location."
        );
        return valid;
    }
})();
