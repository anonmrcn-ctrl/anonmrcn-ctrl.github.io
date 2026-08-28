(() => {
    "use strict";

    const apiClient = window.NNMRCN_API;
    const mapExtensions = window.NNMRCN_MAP;
    const notebook = window.NNMRCN_TACCUINO;
    const SESSION_KEY = "nnmrcn_session";
    const MAX_MESSAGE_LENGTH = 1500;
    const MAX_BATCH_RECIPIENTS = 5;
    const MOBILE_COMPARISON_QUERY = "(max-width: 700px)";
    const NARRATIVE_STEPS = Object.freeze([
        {
            verse: "v. 2 — «Il Gajo tra i Praelli»",
            label: "Gaggio",
            title: "Il Gajo",
            lat: 45.55191,
            lon: 12.31671,
            zoom: 16,
            text:
                "Il toponimo «Gaggio» deriva dal termine longobardo per «boscaglia». Infatti questo territorio, fino ai primi decenni del Novecento, era ricoperto da un fitto bosco. Nella poesia il «Gajo» è da considerarsi come questa ancestrale boscaglia andata perduta."
        },
        {
            verse: "v. 2 — «Il Gajo tra i Praelli»",
            label: "Praello",
            title: "I Praelli",
            lat: 45.53656,
            lon: 12.32324,
            zoom: 16,
            text:
                "Invece, «Praello» è un termine veneto, diminutivo di «prà», ossia prato. Nella poesia il «Gajo» è «tra i Praelli»: il bosco sta tra i piccoli prati."
        },
        {
            verse: "v. 22 — «all’altezza di Via Alta»",
            label: "Via Alta",
            title: "Via Alta",
            lat: 45.556404,
            lon: 12.291392,
            zoom: 15,
            text:
                "Via Alta è una delle strade storiche di Marcon, un tempo associata alla «Via Bassa», oggi Via Monte Grappa. Quest’ultima aveva la nomea di diventare impraticabile alla minima pioggia, a differenza di Via Alta."
        },
        {
            verse: "v. 24 — «via Fornace»",
            label: "Via Fornace",
            title: "Via Fornace",
            lat: 45.565121,
            lon: 12.323637,
            zoom: 17,
            text:
                "Il toponimo deriva dalla presenza di una vera e propria fornace, risalente all’inizio del secolo scorso ed oggi in disuso, alla fine della via. L’ho inserita all’interno della poesia poiché è una di quelle strade che è stata visibilmente tagliata dalla costruzione della A57 (Tangenziale di Mestre). In particolare, si può visibilmente notare come la fornace sia stata divisa dalle sue cave, oggi divenute area protetta."
        },
        {
            verse: "v. 24 — «via Bosco Berizzi»",
            label: "Via Bosco Berizzi",
            title: "Via Bosco Berizzi",
            lat: 45.538066,
            lon: 12.301308,
            zoom: 17,
            text:
                "Il toponimo si riferisce ad un antico proprietario terriero, Berizzi, che aveva, alla fine dell’Ottocento, acquistato delle terre ricoperte di boschi tra Dese e Marcon, esattamente dove ora si trova la via. È stata scelta poiché evidentemente divisa dalla ferrovia; è inoltre ricavabile dalla mappa del 1975 che era qui presente un passaggio a livello per Praello, oggi non più attivo."
        }
    ]);

    const elements = {
        loginForm: document.getElementById("loginForm"),
        loginPassword: document.getElementById("loginPassword"),
        loginButton: document.getElementById("loginButton"),
        loginMessage: document.getElementById("loginMessage"),
        loginLoggedOut: document.getElementById("loginLoggedOut"),
        loginLoggedIn: document.getElementById("loginLoggedIn"),
        loginLocation: document.getElementById("loginLocation"),
        logoutButton: document.getElementById("logoutButton"),
        postaButton: document.getElementById("postaButton"),
        locationPushButton: document.getElementById("locationPushButton"),
        locationPushStatus: document.getElementById("locationPushStatus"),
        locationVisibilityToggle: document.getElementById(
            "locationVisibilityToggle"
        ),
        locationVisibilityStatus: document.getElementById(
            "locationVisibilityStatus"
        ),
        postaSection: document.getElementById("postaSection"),
        postaLista: document.getElementById("postaLista"),
        postaRefresh: document.getElementById("postaRefresh"),
        messaggisticaMappa: document.getElementById("messaggisticaMappa"),
        nuovoMessaggioButton: document.getElementById("nuovoMessaggioButton"),
        destinatariPanel: document.getElementById("destinatariPanel"),
        destinatariLista: document.getElementById("destinatariLista"),
        destinatariConteggio: document.getElementById("destinatariConteggio"),
        destinatariIstruzioni: document.getElementById("destinatariIstruzioni"),
        selezioneMappaButton: document.getElementById("selezioneMappaButton"),
        destinatariPulisci: document.getElementById("destinatariPulisci"),
        destinatariAnnulla: document.getElementById("destinatariAnnulla"),
        destinatariContinua: document.getElementById("destinatariContinua"),
        map: document.getElementById("map"),
        poesiaOverlay: document.getElementById("poesiaOverlay"),
        poesiaClose: document.getElementById("poesiaClose"),
        poesiaDialogo: document.getElementById("poesiaDialogo"),
        poesiaTesto: document.getElementById("poesiaTesto"),
        messaggioOverlay: document.getElementById("messaggioOverlay"),
        messaggioClose: document.getElementById("messaggioClose"),
        messaggioTitolo: document.getElementById("messaggioTitolo"),
        messaggioDestinatari: document.getElementById("messaggioDestinatari"),
        messaggioForm: document.getElementById("messaggioForm"),
        messaggioTesto: document.getElementById("messaggioTesto"),
        messaggioContatore: document.getElementById("messaggioContatore"),
        messaggioInvia: document.getElementById("messaggioInvia"),
        messaggioStatus: document.getElementById("messaggioStatus"),
        messaggioArchivio: document.getElementById("messaggioArchivio"),
        messaggioArchivioLabel: document.getElementById("messaggioArchivioLabel"),
        mappaGuida: document.getElementById("mappaGuida"),
        mappaGuidaClose: document.getElementById("mappaGuidaClose"),
        confrontoMappaButton: document.getElementById("confrontoMappaButton"),
        confrontoMappaPanel: document.getElementById("confrontoMappaPanel"),
        confrontoMappaRange: document.getElementById("confrontoMappaRange"),
        confrontoMappaDivisore: document.getElementById("confrontoMappaDivisore"),
        geolocalizzaButton: document.getElementById("geolocalizzaButton"),
        legendaMappaButton: document.getElementById("legendaMappaButton"),
        legendaMappa: document.getElementById("legendaMappa"),
        elencoMappaButton: document.getElementById("elencoMappaButton"),
        elencoMappa: document.getElementById("elencoMappa"),
        elencoMappaLista: document.getElementById("elencoMappaLista"),
        mappaStrumentiStatus: document.getElementById("mappaStrumentiStatus"),
        esploraPoesiaButton: document.getElementById("esploraPoesiaButton"),
        percorsoNarrativo: document.getElementById("percorsoNarrativo"),
        percorsoNarrativoClose: document.getElementById("percorsoNarrativoClose"),
        percorsoNarrativoLinea: document.getElementById("percorsoNarrativoLinea"),
        percorsoNarrativoVerso: document.getElementById("percorsoNarrativoVerso"),
        percorsoNarrativoTitolo: document.getElementById("percorsoNarrativoTitolo"),
        percorsoNarrativoTesto: document.getElementById("percorsoNarrativoTesto"),
        percorsoNarrativoSalva: document.getElementById("percorsoNarrativoSalva"),
        percorsoNarrativoIndietro: document.getElementById("percorsoNarrativoIndietro"),
        percorsoNarrativoAvanti: document.getElementById("percorsoNarrativoAvanti")
    };

    let sessionToken = sessionStorage.getItem(SESSION_KEY) || "";
    let sessionLocation = null;
    let locations = [];
    let currentRecipients = [];
    let selectedRecipientIds = new Set();
    let mapRecipientSelectionMode = false;
    let todayLayer = null;
    let year1975Layer = null;
    let historical1975Layer = null;
    let comparisonActive = false;
    let userPositionLayer = null;
    let mapListLoaded = false;
    let narrativeStepIndex = 0;
    let narrativeMarker = null;
    let comparisonFrame = 0;
    let comparisonRetryTimers = [];
    const mobileComparisonMedia = window.matchMedia(MOBILE_COMPARISON_QUERY);

    const pushNotifications = window.NNMRCN_NOTIFICHE.create({
        button: elements.locationPushButton,
        status: elements.locationPushStatus,
        request: api,
        identity: () => sessionLocation
            ? `location-${sessionLocation.id}`
            : ""
    });

    const map = createMap();
    window.__nnmrcnMap = map;
    const locationsLayer = L.layerGroup().addTo(map);

    loadLandscapes();
    bindInterface();
    restoreSession();
    applyRequestedMapView();

    function createMap() {
        const instance = L.map("map", {
            scrollWheelZoom: true
        }).setView([45.5515, 12.3278], 13);

        instance.createPane("historicalRaster");
        instance.getPane("historicalRaster").style.zIndex = "250";
        instance.getPane("historicalRaster").style.pointerEvents = "none";
        instance.getPane("historicalRaster").style.willChange = "clip-path";

        const satelliteUrl =
            "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";

        const satelliteOptions = {
            maxZoom: 19,
            attribution:
                "Tiles &copy; Esri — Sources: Esri, Maxar, Earthstar Geographics, and the GIS User Community"
        };

        todayLayer = L.layerGroup([
            L.tileLayer(satelliteUrl, satelliteOptions)
        ]);

        const year1975Layers = [
            L.tileLayer(satelliteUrl, satelliteOptions)
        ];

        if (
            window.pmtiles?.PMTiles &&
            typeof window.pmtiles.leafletRasterLayer === "function"
        ) {
            const archive1975 = new window.pmtiles.PMTiles(
                new URL(
                    "./mappe/marcon_1975.pmtiles",
                    window.location.href
                ).href
            );

            historical1975Layer = window.pmtiles.leafletRasterLayer(
                archive1975,
                {
                    pane: "historicalRaster",
                    opacity: 1,
                    noWrap: true,
                    attribution: "Aerofototeca Veneta — 1975"
                }
            );

            historical1975Layer.on("tileerror", (event) => {
                console.error(
                    "Impossibile caricare una tessera della mappa del 1975.",
                    event.error || event
                );
            });

            historical1975Layer.on("add load tileload", () => {
                if (comparisonActive) {
                    scheduleComparisonPositionUpdate();
                }
            });

            year1975Layers.push(historical1975Layer);
        } else {
            console.error("PMTiles non è disponibile: il livello 1975 non può essere caricato.");
        }

        year1975Layer = L.layerGroup(year1975Layers);

        todayLayer.addTo(instance);

        L.control.layers(
            {
                "Oggi": todayLayer,
                "1975": year1975Layer
            },
            null,
            {
                collapsed: false
            }
        ).addTo(instance);

        instance.on("baselayerchange", () => {
            if (comparisonActive) {
                setComparisonMode(false);
            }
        });

        instance.on("popupopen", addPopupNotebookControl);

        instance.on("move zoom resize viewreset", () => {
            if (comparisonActive) {
                scheduleComparisonPositionUpdate({ retry: false });
            }
        });

        if (typeof ResizeObserver === "function") {
            const mapResizeObserver = new ResizeObserver(() => {
                if (!comparisonActive) {
                    return;
                }

                instance.invalidateSize({ pan: false });
                scheduleComparisonPositionUpdate();
            });

            mapResizeObserver.observe(elements.map);
        }

        window.visualViewport?.addEventListener?.("resize", () => {
            if (!comparisonActive) {
                return;
            }

            instance.invalidateSize({ pan: false });
            scheduleComparisonPositionUpdate();
        });

        return instance;
    }

    function usesMobileComparison() {
        return mobileComparisonMedia.matches;
    }

    function clearHistoricalClip() {
        const historicalContainer = historical1975Layer?.getContainer?.();

        if (!historicalContainer) {
            return;
        }

        historicalContainer.style.clip = "";
        historicalContainer.style.clipPath = "";
        historicalContainer.style.webkitClipPath = "";
    }

    function comparisonStatusText() {
        return usesMobileComparison()
            ? "Confronto attivo: sposta il cursore per sovrapporre il 1975 alla mappa attuale."
            : "Confronto attivo: 1975 a sinistra, oggi a destra.";
    }

    function setComparisonMode(enabled) {
        if (enabled && !historical1975Layer) {
            elements.mappaStrumentiStatus.textContent =
                "Il confronto non è disponibile perché la mappa del 1975 non è stata caricata.";
            return;
        }

        comparisonActive = enabled;
        elements.confrontoMappaButton.setAttribute(
            "aria-pressed",
            String(enabled)
        );
        elements.confrontoMappaButton.textContent = enabled
            ? "Chiudi il confronto"
            : "Confronta 1975–oggi";
        elements.confrontoMappaPanel.hidden = !enabled;
        elements.confrontoMappaDivisore.hidden =
            !enabled || usesMobileComparison();

        if (enabled) {
            if (year1975Layer && map.hasLayer(year1975Layer)) {
                map.removeLayer(year1975Layer);
            }

            if (todayLayer && !map.hasLayer(todayLayer)) {
                todayLayer.addTo(map);
            }

            if (!map.hasLayer(historical1975Layer)) {
                historical1975Layer.addTo(map);
            }

            historical1975Layer.redraw?.();
            map.invalidateSize({ pan: false });
            scheduleComparisonPositionUpdate();
            elements.mappaStrumentiStatus.textContent =
                comparisonStatusText();
            return;
        }

        clearHistoricalClip();
        historical1975Layer?.setOpacity?.(1);

        if (
            historical1975Layer &&
            map.hasLayer(historical1975Layer) &&
            (!year1975Layer || !map.hasLayer(year1975Layer))
        ) {
            map.removeLayer(historical1975Layer);
        }

        cancelComparisonPositionUpdates();
        delete elements.confrontoMappaPanel.dataset.mode;

        elements.mappaStrumentiStatus.textContent = "";
    }

    function cancelComparisonPositionUpdates() {
        if (comparisonFrame) {
            window.cancelAnimationFrame(comparisonFrame);
            comparisonFrame = 0;
        }

        comparisonRetryTimers.forEach((timer) => window.clearTimeout(timer));
        comparisonRetryTimers = [];
    }

    function scheduleComparisonPositionUpdate({ retry = true } = {}) {
        if (!comparisonActive) {
            return;
        }

        if (comparisonFrame) {
            window.cancelAnimationFrame(comparisonFrame);
        }

        comparisonFrame = window.requestAnimationFrame(() => {
            comparisonFrame = 0;
            updateComparisonPosition();
        });

        if (!retry) {
            return;
        }

        comparisonRetryTimers.forEach((timer) => window.clearTimeout(timer));
        comparisonRetryTimers = [80, 250, 700].map((delay) =>
            window.setTimeout(() => {
                if (comparisonActive) {
                    updateComparisonPosition();
                }
            }, delay)
        );
    }

    function updateComparisonPosition() {
        const position = Number(elements.confrontoMappaRange.value);
        const historicalContainer = historical1975Layer?.getContainer?.();
        const mobileComparison = usesMobileComparison();

        elements.confrontoMappaDivisore.style.left = `${position}%`;
        elements.confrontoMappaDivisore.hidden = mobileComparison;
        elements.confrontoMappaPanel.dataset.mode = mobileComparison
            ? "opacity"
            : "split";
        elements.confrontoMappaRange.setAttribute(
            "aria-valuetext",
            `${position}% mappa del 1975 e ${100 - position}% mappa attuale`
        );

        if (mobileComparison) {
            clearHistoricalClip();
            historical1975Layer?.setOpacity?.(position / 100);
            return;
        }

        historical1975Layer?.setOpacity?.(1);

        if (!historicalContainer) {
            return;
        }

        const mapSize = map.getSize();
        const dividerX = (mapSize.x * position) / 100;
        const northWest = map.containerPointToLayerPoint([0, 0]);
        const southEast = map.containerPointToLayerPoint([
            dividerX,
            mapSize.y
        ]);

        const clipRectangle =
            `rect(${northWest.y}px, ${southEast.x}px, ` +
            `${southEast.y}px, ${northWest.x}px)`;
        const clipPolygon =
            `polygon(${northWest.x}px ${northWest.y}px, ` +
            `${southEast.x}px ${northWest.y}px, ` +
            `${southEast.x}px ${southEast.y}px, ` +
            `${northWest.x}px ${southEast.y}px)`;

        // `clip` resta il fallback per WebView meno recenti; `clip-path`
        // rende stabile il confronto durante pinch-zoom e rotazione su mobile.
        historicalContainer.style.clip = clipRectangle;
        historicalContainer.style.clipPath = clipPolygon;
        historicalContainer.style.webkitClipPath = clipPolygon;
    }

    function toggleMapPanel(button, panel) {
        const willOpen = panel.hidden;

        [
            [elements.legendaMappaButton, elements.legendaMappa],
            [elements.elencoMappaButton, elements.elencoMappa]
        ].forEach(([otherButton, otherPanel]) => {
            const open = willOpen && otherPanel === panel;
            otherPanel.hidden = !open;
            otherButton.setAttribute("aria-expanded", String(open));
        });
    }

    function updateComparisonFromTouch(event) {
        const touch = event.touches?.[0];

        if (!touch) {
            return;
        }

        const bounds = elements.confrontoMappaRange.getBoundingClientRect();

        if (!bounds.width) {
            return;
        }

        event.preventDefault();
        const percentage = Math.round(
            ((touch.clientX - bounds.left) / bounds.width) * 100
        );
        elements.confrontoMappaRange.value = String(
            Math.min(100, Math.max(0, percentage))
        );
        scheduleComparisonPositionUpdate({ retry: false });
    }

    function handleComparisonLayoutChange() {
        if (!comparisonActive) {
            return;
        }

        elements.mappaStrumentiStatus.textContent = comparisonStatusText();
        map.invalidateSize({ pan: false });
        scheduleComparisonPositionUpdate();
    }

    function restoreMapGuidePreference() {
        try {
            elements.mappaGuida.hidden =
                localStorage.getItem("nnmrcn_map_guide_dismissed") === "1";
        } catch (_) {
            elements.mappaGuida.hidden = false;
        }
    }

    function dismissMapGuide() {
        elements.mappaGuida.hidden = true;

        try {
            localStorage.setItem("nnmrcn_map_guide_dismissed", "1");
        } catch (_) {
            // La guida resta chiusa per la sessione corrente.
        }
    }

    function buildNarrativeTimeline() {
        elements.percorsoNarrativoLinea.replaceChildren();

        NARRATIVE_STEPS.forEach((step, index) => {
            const button = document.createElement("button");
            const point = document.createElement("span");
            const label = document.createElement("span");
            const verse = document.createElement("small");

            button.type = "button";
            button.className = "percorso-narrativo-punto";
            button.setAttribute(
                "aria-label",
                `${step.verse}: ${step.label}`
            );
            point.className = "percorso-narrativo-nodo";
            point.setAttribute("aria-hidden", "true");
            label.textContent = step.label;
            verse.textContent = index < 2 ? "v. 2" : "v. 22";
            button.append(point, label, verse);
            button.addEventListener("click", () => showNarrativeStep(index));
            elements.percorsoNarrativoLinea.appendChild(button);
        });
    }

    function openNarrativeJourney() {
        dismissMapGuide();
        elements.legendaMappa.hidden = true;
        elements.elencoMappa.hidden = true;
        elements.legendaMappaButton.setAttribute("aria-expanded", "false");
        elements.elencoMappaButton.setAttribute("aria-expanded", "false");
        elements.percorsoNarrativo.hidden = false;
        elements.esploraPoesiaButton.setAttribute("aria-pressed", "true");
        elements.esploraPoesiaButton.textContent = "Chiudi l’esplorazione";
        showNarrativeStep(0);
    }

    function closeNarrativeJourney() {
        elements.percorsoNarrativo.hidden = true;
        elements.esploraPoesiaButton.setAttribute("aria-pressed", "false");
        elements.esploraPoesiaButton.textContent = "Esplora la poesia";

        if (narrativeMarker) {
            map.removeLayer(narrativeMarker);
            narrativeMarker = null;
        }
    }

    function showNarrativeStep(index) {
        const boundedIndex = Math.min(
            Math.max(Number(index) || 0, 0),
            NARRATIVE_STEPS.length - 1
        );
        const step = NARRATIVE_STEPS[boundedIndex];

        narrativeStepIndex = boundedIndex;
        elements.percorsoNarrativoVerso.textContent = step.verse;
        elements.percorsoNarrativoTitolo.textContent = step.title;
        elements.percorsoNarrativoTesto.textContent = step.text;
        elements.percorsoNarrativoIndietro.disabled = boundedIndex === 0;
        elements.percorsoNarrativoAvanti.textContent =
            boundedIndex === NARRATIVE_STEPS.length - 1
                ? "Fine"
                : "Successivo";
        syncNarrativeNotebookButton(step, boundedIndex);

        elements.percorsoNarrativoLinea
            .querySelectorAll("button")
            .forEach((button, buttonIndex) => {
                const active = buttonIndex === boundedIndex;
                button.classList.toggle("attivo", active);

                if (active) {
                    button.setAttribute("aria-current", "step");
                } else {
                    button.removeAttribute("aria-current");
                }
            });

        if (narrativeMarker) {
            map.removeLayer(narrativeMarker);
        }

        narrativeMarker = L.circleMarker([step.lat, step.lon], {
            radius: 10,
            color: "#171717",
            weight: 3,
            fillColor: "#f4f1e8",
            fillOpacity: 1
        })
            .bindTooltip(step.label, {
                permanent: true,
                direction: "top",
                offset: [0, -9]
            })
            .addTo(map);

        map.flyTo([step.lat, step.lon], step.zoom, {
            animate: !window.matchMedia("(prefers-reduced-motion: reduce)").matches,
            duration: 1.1
        });
        elements.map.scrollIntoView({
            behavior: "smooth",
            block: "center"
        });
    }

    function narrativeNotebookItem(step, index) {
        return {
            id: `verso:${index}:${step.label.toLocaleLowerCase("it")}`,
            type: "verso",
            title: `${step.verse} — ${step.label}`,
            text: step.text,
            lat: step.lat,
            lon: step.lon,
            url:
                `/progetto.html?narrative=${index}&lat=${step.lat}` +
                `&lon=${step.lon}&zoom=${step.zoom}`
        };
    }

    function syncNarrativeNotebookButton(step, index) {
        if (!elements.percorsoNarrativoSalva || !notebook) {
            if (elements.percorsoNarrativoSalva) {
                elements.percorsoNarrativoSalva.hidden = true;
            }
            return;
        }

        const item = narrativeNotebookItem(step, index);
        const saved = notebook.has(item.id);
        elements.percorsoNarrativoSalva.hidden = false;
        elements.percorsoNarrativoSalva.textContent = saved
            ? "Rimuovi dal taccuino"
            : "Salva nel taccuino";
        elements.percorsoNarrativoSalva.setAttribute(
            "aria-pressed",
            String(saved)
        );
    }

    function toggleNarrativeNotebookItem() {
        if (!notebook) {
            return;
        }

        const step = NARRATIVE_STEPS[narrativeStepIndex];
        notebook.toggle(narrativeNotebookItem(step, narrativeStepIndex));
        syncNarrativeNotebookButton(step, narrativeStepIndex);
    }

    function addPopupNotebookControl(event) {
        if (!notebook) {
            return;
        }

        const popup = event.popup;
        let attempts = 0;

        const mountButton = () => {
            const popupElement = popup.getElement?.();
            const content = popupElement?.querySelector(
                ".leaflet-popup-content"
            );

            if (!content) {
                return false;
            }

            if (content.querySelector(".taccuino-popup-azione")) {
                return true;
            }

            const plainText = content.textContent.replace(/\s+/gu, " ").trim();

            if (!plainText || plainText === "Sei qui") {
                return true;
            }

            const properties = popup._source?.feature?.properties || {};
            const heading = content.querySelector("h2, h3, strong");
            const title = String(
                properties.nome || heading?.textContent || plainText.slice(0, 80)
            ).trim();
            const latLng = popup.getLatLng?.();
            const route = properties.categoria === "percorso" ||
                content.querySelector(".popup-percorso");
            const item = {
                id: notebook.itemIdentifier({
                    type: route ? "percorso" : "luogo",
                    title,
                    lat: latLng?.lat,
                    lon: latLng?.lng
                }),
                type: route ? "percorso" : "luogo",
                title,
                text: plainText.slice(0, 1000),
                lat: latLng?.lat,
                lon: latLng?.lng,
                url: latLng
                    ? `/progetto.html?lat=${latLng.lat.toFixed(6)}` +
                        `&lon=${latLng.lng.toFixed(6)}&zoom=16`
                    : "/progetto.html"
            };
            const button = notebook.createButton(item, {
                className: "taccuino-salva taccuino-popup-azione"
            });
            content.appendChild(button);
            popup.update();
            return true;
        };

        const mountWhenReady = () => {
            if (mountButton() || attempts >= 5) {
                return;
            }

            attempts += 1;
            window.setTimeout(mountWhenReady, attempts * 30);
        };

        window.requestAnimationFrame(mountWhenReady);
    }

    function applyRequestedMapView() {
        const parameters = new URLSearchParams(window.location.search);
        const narrative = Number(parameters.get("narrative"));
        const lat = Number(parameters.get("lat"));
        const lon = Number(parameters.get("lon"));
        const zoom = Number(parameters.get("zoom"));

        if (
            parameters.has("narrative") &&
            Number.isInteger(narrative) &&
            narrative >= 0 &&
            narrative < NARRATIVE_STEPS.length
        ) {
            window.setTimeout(() => {
                openNarrativeJourney();
                showNarrativeStep(narrative);
            }, 120);
            return;
        }

        if (
            parameters.has("lat") &&
            parameters.has("lon") &&
            Number.isFinite(lat) &&
            Number.isFinite(lon) &&
            lat >= -90 &&
            lat <= 90 &&
            lon >= -180 &&
            lon <= 180
        ) {
            map.setView(
                [lat, lon],
                Number.isFinite(zoom)
                    ? Math.min(Math.max(zoom, 10), 19)
                    : 16
            );
        }
    }

    function locateVisitor() {
        if (!navigator.geolocation) {
            elements.mappaStrumentiStatus.textContent =
                "La geolocalizzazione non è disponibile in questo browser.";
            return;
        }

        elements.geolocalizzaButton.disabled = true;
        elements.mappaStrumentiStatus.textContent = "Ricerca della posizione…";

        const handleLocationFound = (event) => {
            map.off("locationerror", handleLocationError);

            if (userPositionLayer) {
                map.removeLayer(userPositionLayer);
            }

            userPositionLayer = L.layerGroup([
                L.circle(event.latlng, {
                    radius: Math.max(Number(event.accuracy || 0), 10),
                    color: "#171717",
                    weight: 1,
                    fillColor: "#f4f1e8",
                    fillOpacity: 0.18,
                    interactive: false
                }),
                L.circleMarker(event.latlng, {
                    radius: 7,
                    color: "#171717",
                    weight: 2,
                    fillColor: "#f4f1e8",
                    fillOpacity: 1
                }).bindPopup("Sei qui")
            ]).addTo(map);

            map.setView(event.latlng, Math.max(map.getZoom(), 16));
            elements.mappaStrumentiStatus.textContent =
                "Posizione trovata. L’area chiara indica la precisione stimata.";
            elements.geolocalizzaButton.disabled = false;
        };

        const handleLocationError = () => {
            map.off("locationfound", handleLocationFound);
            elements.mappaStrumentiStatus.textContent =
                "Non è stato possibile ottenere la posizione. Controlla il permesso del browser.";
            elements.geolocalizzaButton.disabled = false;
        };

        map.once("locationfound", handleLocationFound);
        map.once("locationerror", handleLocationError);

        map.locate({
            enableHighAccuracy: true,
            setView: false,
            timeout: 12000,
            maximumAge: 30000
        });
    }

    async function loadMapTextList() {
        const sources = [
            "./luoghi-rilevanti.geojson",
            "./luoghi-significativi.geojson",
            "./percorsi.geojson",
            "./marcon-da-sud.geojson"
        ];

        try {
            const collections = await Promise.all(
                sources.map((source) => mapExtensions.loadGeoJSON(source))
            );
            const features = collections
                .flatMap((collection) => collection.features || [])
                .filter((feature) => feature?.properties?.nome)
                .sort((left, right) =>
                    String(left.properties.nome).localeCompare(
                        String(right.properties.nome),
                        "it"
                    )
                );

            elements.elencoMappaLista.replaceChildren();

            features.forEach((feature) => {
                const article = document.createElement("article");
                const title = document.createElement("h3");
                const category = document.createElement("p");
                const button = document.createElement("button");

                title.textContent = feature.properties.nome;
                category.textContent = mapFeatureCategory(feature);
                button.type = "button";
                button.textContent = "Mostra sulla mappa";
                button.addEventListener("click", () => {
                    focusMapFeature(feature);
                    elements.mappaStrumentiStatus.textContent =
                        `Mostro ${feature.properties.nome}.`;
                });

                article.append(title, category, button);
                elements.elencoMappaLista.appendChild(article);
            });

            mapListLoaded = true;
        } catch (error) {
            console.error("Impossibile creare l’elenco testuale della mappa.", error);
            showMessage(
                elements.elencoMappaLista,
                "Non è stato possibile caricare l’elenco dei luoghi."
            );
        }
    }

    function mapFeatureCategory(feature) {
        const category = feature.properties?.categoria;

        if (category === "corso_d_acqua") {
            return "Corso d’acqua";
        }

        if (category === "cava") {
            return "Cava";
        }

        if (category === "percorso") {
            return "Percorso";
        }

        return feature.geometry?.type === "Point"
            ? "Luogo rilevante"
            : "Paesaggio significativo";
    }

    function focusMapFeature(feature) {
        const coordinates = feature.geometry?.coordinates;

        if (
            feature.geometry?.type === "Point" &&
            Array.isArray(coordinates) &&
            Number.isFinite(coordinates[0]) &&
            Number.isFinite(coordinates[1])
        ) {
            map.setView([coordinates[1], coordinates[0]], 16);
        } else {
            const bounds = L.geoJSON(feature).getBounds();

            if (bounds.isValid()) {
                map.fitBounds(bounds, {
                    padding: [30, 30],
                    maxZoom: 16
                });
            }
        }

        elements.map.scrollIntoView({
            behavior: "smooth",
            block: "center"
        });
    }

    async function loadLandscapes() {
        const landscapeLayer = L.layerGroup();

        L.control.layers(
            null,
            {
                "Paesaggi significativi": landscapeLayer
            },
            {
                collapsed: true
            }
        ).addTo(map);

        try {
            const data = await mapExtensions.loadGeoJSON(
                "./luoghi-significativi.geojson"
            );

            L.geoJSON(data, {
                style: landscapeMainStyle,
                onEachFeature: bindLandscapeFeature
            }).addTo(landscapeLayer);

            L.geoJSON(data, {
                interactive: false,
                style: landscapeDetailStyle
            }).addTo(landscapeLayer);
        } catch (error) {
            console.error("Impossibile caricare i paesaggi significativi.", error);
        }
    }

    function landscapeMainStyle(feature) {
        if (feature.properties?.categoria === "cava") {
            return {
                color: "#006e8a",
                weight: 3,
                opacity: 1,
                fillColor: "#2cc8ef",
                fillOpacity: 0.35
            };
        }

        return {
            color: "#00b8ff",
            weight: 8,
            opacity: 0.95,
            lineCap: "round",
            lineJoin: "round"
        };
    }

    function landscapeDetailStyle(feature) {
        if (feature.properties?.categoria === "cava") {
            return {
                color: "#dff8ff",
                weight: 1.5,
                opacity: 1,
                fill: false
            };
        }

        return {
            color: "#e8fbff",
            weight: 2,
            opacity: 1,
            lineCap: "round",
            lineJoin: "round"
        };
    }

    function bindLandscapeFeature(feature, layer) {
        const name = feature.properties?.nome;

        if (name) {
            layer.bindTooltip(name, {
                sticky: true,
                direction: "top"
            });
        }

        mapExtensions.enhanceFeature(feature, layer);

        layer.on("add", () => {
            requestAnimationFrame(() => {
                const path = layer.getElement();

                if (!path) {
                    return;
                }

                path.removeAttribute("tabindex");
                path.setAttribute("focusable", "false");
            });
        });
    }

    function bindInterface() {
        elements.loginForm.addEventListener("submit", handleLogin);
        elements.logoutButton.addEventListener("click", handleLogout);
        elements.locationVisibilityToggle.addEventListener(
            "click",
            toggleLocationVisibility
        );
        elements.postaButton.addEventListener("click", toggleInbox);
        elements.postaRefresh.addEventListener("click", loadInbox);
        elements.nuovoMessaggioButton.addEventListener("click", toggleRecipientPanel);
        elements.selezioneMappaButton.addEventListener("click", toggleMapRecipientSelection);
        elements.destinatariPulisci.addEventListener("click", clearRecipientSelection);
        elements.destinatariAnnulla.addEventListener("click", () => closeRecipientPanel(true));
        elements.destinatariContinua.addEventListener("click", continueToMessage);
        elements.poesiaClose.addEventListener("click", closePoem);
        elements.messaggioClose.addEventListener("click", closeMessage);
        elements.messaggioTesto.addEventListener("input", updateMessageCounter);
        elements.messaggioForm.addEventListener(
            "change",
            syncArchiveConsentAvailability
        );
        elements.messaggioForm.addEventListener("submit", sendMessage);
        elements.mappaGuidaClose.addEventListener("click", dismissMapGuide);
        elements.confrontoMappaButton.addEventListener(
            "click",
            () => setComparisonMode(!comparisonActive)
        );
        elements.confrontoMappaRange.addEventListener(
            "input",
            () => scheduleComparisonPositionUpdate({ retry: false })
        );
        elements.confrontoMappaRange.addEventListener(
            "change",
            () => scheduleComparisonPositionUpdate()
        );
        elements.confrontoMappaRange.addEventListener(
            "touchstart",
            updateComparisonFromTouch,
            { passive: false }
        );
        elements.confrontoMappaRange.addEventListener(
            "touchmove",
            updateComparisonFromTouch,
            { passive: false }
        );
        if (typeof mobileComparisonMedia.addEventListener === "function") {
            mobileComparisonMedia.addEventListener(
                "change",
                handleComparisonLayoutChange
            );
        } else {
            mobileComparisonMedia.addListener?.(handleComparisonLayoutChange);
        }
        elements.geolocalizzaButton.addEventListener("click", locateVisitor);
        elements.legendaMappaButton.addEventListener("click", () => {
            toggleMapPanel(elements.legendaMappaButton, elements.legendaMappa);
        });
        elements.elencoMappaButton.addEventListener("click", async () => {
            toggleMapPanel(elements.elencoMappaButton, elements.elencoMappa);

            if (!elements.elencoMappa.hidden && !mapListLoaded) {
                await loadMapTextList();
            }
        });
        elements.esploraPoesiaButton.addEventListener("click", () => {
            if (elements.percorsoNarrativo.hidden) {
                openNarrativeJourney();
            } else {
                closeNarrativeJourney();
            }
        });
        elements.percorsoNarrativoClose.addEventListener(
            "click",
            closeNarrativeJourney
        );
        elements.percorsoNarrativoIndietro.addEventListener("click", () => {
            showNarrativeStep(narrativeStepIndex - 1);
        });
        elements.percorsoNarrativoSalva?.addEventListener(
            "click",
            toggleNarrativeNotebookItem
        );
        document.addEventListener("nnmrcn:taccuinochange", () => {
            if (!elements.percorsoNarrativo.hidden) {
                syncNarrativeNotebookButton(
                    NARRATIVE_STEPS[narrativeStepIndex],
                    narrativeStepIndex
                );
            }
        });
        elements.percorsoNarrativoAvanti.addEventListener("click", () => {
            if (narrativeStepIndex === NARRATIVE_STEPS.length - 1) {
                closeNarrativeJourney();
            } else {
                showNarrativeStep(narrativeStepIndex + 1);
            }
        });

        restoreMapGuidePreference();
        syncArchiveConsentAvailability();
        buildNarrativeTimeline();

        document.addEventListener("keydown", (event) => {
            if (event.key !== "Escape") {
                return;
            }

            if (!elements.messaggioOverlay.hidden) {
                closeMessage();
            } else if (!elements.poesiaOverlay.hidden) {
                closePoem();
            } else if (!elements.percorsoNarrativo.hidden) {
                closeNarrativeJourney();
            } else if (!elements.destinatariPanel.hidden) {
                closeRecipientPanel(true);
            }
        });
    }

    function apiConfigured() {
        return Boolean(apiClient.baseUrl);
    }

    async function api(path, options = {}) {
        const headers = new Headers(options.headers || {});

        if (sessionToken) {
            headers.set("Authorization", `Bearer ${sessionToken}`);
        }

        try {
            return await apiClient.request(path, {
                ...options,
                headers
            });
        } catch (error) {
            if (error.status === 401) {
                clearSession();
            }

            throw error;
        }
    }

    function showMessage(container, message) {
        const paragraph = document.createElement("p");
        paragraph.textContent = message;
        container.replaceChildren(paragraph);
    }

    function showPoemMessage(message) {
        const poem = document.createElement("main");
        poem.className = "poesia";
        showMessage(poem, message);
        elements.poesiaTesto.replaceChildren(poem);
    }

    async function handleLogin(event) {
        event.preventDefault();

        if (!apiConfigured()) {
            elements.loginMessage.textContent =
                "Il sistema di accesso è pronto ma non è ancora collegato al server.";
            return;
        }

        elements.loginButton.disabled = true;
        elements.loginMessage.textContent = "Verifica in corso…";

        try {
            const data = await api("/api/login", {
                method: "POST",
                body: JSON.stringify({
                    password: elements.loginPassword.value
                })
            });

            sessionToken = data.token;
            sessionStorage.setItem(SESSION_KEY, sessionToken);
            elements.loginPassword.value = "";

            setLoggedIn(data.location);
            await loadNetwork();
        } catch (error) {
            elements.loginMessage.textContent =
                error.status === 401
                    ? "Password non riconosciuta."
                    : "Non è stato possibile accedere. Riprova.";
        } finally {
            elements.loginButton.disabled = false;
        }
    }

    async function handleLogout() {
        try {
            if (sessionToken && apiConfigured()) {
                await api("/api/logout", {
                    method: "POST"
                });
            }
        } catch (_) {
            // La sessione locale viene comunque rimossa.
        }

        clearSession();
    }

    async function toggleLocationVisibility() {
        if (!sessionLocation) {
            return;
        }

        const nextVisible = sessionLocation.visible === false;
        elements.locationVisibilityToggle.disabled = true;
        elements.locationVisibilityStatus.textContent = "Aggiornamento…";

        try {
            const data = await api("/api/location/preferences", {
                method: "PATCH",
                body: JSON.stringify({ visible: nextVisible })
            });

            sessionLocation = data.location;
            syncLocationVisibility();
            await loadNetwork();
            elements.locationVisibilityStatus.textContent = nextVisible
                ? "La location è di nuovo visibile sulla mappa."
                : "La location è nascosta dalla mappa.";
        } catch (error) {
            elements.locationVisibilityStatus.textContent =
                error.message || "Non è stato possibile aggiornare la visibilità.";
        } finally {
            elements.locationVisibilityToggle.disabled = false;
        }
    }

    async function restoreSession() {
        if (!apiConfigured()) {
            elements.loginMessage.textContent =
                "Il sistema di accesso è pronto ma non è ancora collegato al server.";
            return;
        }

        if (!sessionToken) {
            return;
        }

        try {
            const data = await api("/api/session");
            setLoggedIn(data.location);
            await loadNetwork();

            if (window.location.hash === "#postaSection") {
                elements.postaSection.hidden = false;
                elements.postaSection.scrollIntoView({
                    behavior: "smooth",
                    block: "start"
                });
            }
        } catch (_) {
            clearSession();
        }
    }

    function setLoggedIn(location) {
        sessionLocation = location;
        elements.loginLocation.textContent = location.username || location.address;
        elements.loginLoggedOut.hidden = true;
        elements.loginLoggedIn.hidden = false;
        elements.messaggisticaMappa.hidden = false;
        elements.loginMessage.textContent = "";
        elements.locationVisibilityStatus.textContent = "";
        syncLocationVisibility();

        pushNotifications.sync().catch((error) => {
            console.error("Impossibile controllare le notifiche.", error);
        });
    }

    function syncLocationVisibility() {
        const hidden = sessionLocation?.visible === false;
        elements.locationVisibilityToggle.textContent = hidden
            ? "Mostra la mia location sulla mappa"
            : "Nascondi la mia location sulla mappa";
        elements.locationVisibilityToggle.setAttribute(
            "aria-pressed",
            String(hidden)
        );
    }

    function clearSession() {
        sessionToken = "";
        sessionLocation = null;
        locations = [];
        currentRecipients = [];
        selectedRecipientIds.clear();
        mapRecipientSelectionMode = false;

        sessionStorage.removeItem(SESSION_KEY);
        locationsLayer.clearLayers();

        elements.loginLoggedOut.hidden = false;
        elements.loginLoggedIn.hidden = true;
        elements.loginLocation.textContent = "";
        elements.locationVisibilityToggle.setAttribute("aria-pressed", "false");
        elements.locationVisibilityStatus.textContent = "";
        elements.postaSection.hidden = true;
        elements.messaggisticaMappa.hidden = true;
        elements.destinatariPanel.hidden = true;
        elements.nuovoMessaggioButton.setAttribute("aria-expanded", "false");
        elements.map.classList.remove("selezione-destinatari-attiva");
        pushNotifications.reset();
        showMessage(elements.postaLista, "Nessun messaggio.");
    }

    async function loadNetwork() {
        const data = await api("/api/locations");
        locations = data.locations || [];
        selectedRecipientIds.clear();
        renderRecipientList();
        updateRecipientSelectionUi();
        renderLocations();
        await loadInbox();
    }

    function renderLocations() {
        locationsLayer.clearLayers();

        locations.forEach((location) => {
            const isOwn = Number(location.id) === Number(sessionLocation?.id);

            if (location.visible === false) {
                return;
            }

            if (mapRecipientSelectionMode) {
                const marker = isOwn
                    ? createOwnLocationMarker(location)
                    : createRecipientSelectionMarker(location);

                marker.bindTooltip(
                    isOwn ? `${location.address} — la tua location` : location.address,
                    {
                        direction: "top",
                        offset: [0, -8]
                    }
                );

                if (!isOwn) {
                    marker.on("click", () => toggleRecipient(location.id));
                }

                marker.addTo(locationsLayer);
                return;
            }

            const marker = isOwn
                ? createOwnLocationMarker(location)
                : L.marker([location.lat, location.lon]);

            marker.bindPopup(createLocationPopup(location, isOwn));
            marker.addTo(locationsLayer);
        });
    }

    function createOwnLocationMarker(location) {
        return L.circleMarker(
            [location.lat, location.lon],
            {
                radius: 9,
                color: "#171717",
                weight: 2,
                fillColor: "#f4f1e8",
                fillOpacity: 1
            }
        );
    }

    function createRecipientSelectionMarker(location) {
        const selected = selectedRecipientIds.has(Number(location.id));

        return L.circleMarker(
            [location.lat, location.lon],
            {
                radius: selected ? 11 : 8,
                color: "#171717",
                weight: selected ? 3 : 2,
                fillColor: selected ? "#171717" : "#f4f1e8",
                fillOpacity: selected ? 0.95 : 0.8
            }
        );
    }

    function createLocationPopup(location, isOwn) {
        const root = document.createElement("div");
        root.className = "popup-luogo";

        const title = document.createElement("strong");
        title.textContent = location.address;
        root.appendChild(title);

        if (isOwn) {
            const ownLabel = document.createElement("p");
            ownLabel.className = "location-propria";
            ownLabel.textContent = "La tua location";
            root.appendChild(ownLabel);
        }

        const actions = document.createElement("div");
        actions.className = "popup-azioni";

        if (location.hasPoem) {
            actions.appendChild(
                createPopupButton(
                    `Mostra poesia ${location.address}`,
                    () => {
                        map.closePopup();
                        openPoem(location);
                    }
                )
            );
        }

        if (!isOwn) {
            const messageButton = createPopupButton(
                "Invia un messaggio",
                () => {
                    map.closePopup();
                    openMessage(location);
                }
            );
            messageButton.classList.add("invia-messaggio");
            actions.appendChild(messageButton);
        }

        root.appendChild(actions);
        return root;
    }

    function createPopupButton(label, onClick) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "mostra-poesia";
        button.textContent = label;
        button.addEventListener("click", onClick);
        return button;
    }

    function toggleRecipientPanel() {
        if (!sessionLocation || !locations.length) {
            return;
        }

        if (!elements.destinatariPanel.hidden) {
            closeRecipientPanel(true);
            return;
        }

        selectedRecipientIds.clear();
        setMapRecipientSelectionMode(false);
        renderRecipientList();
        updateRecipientSelectionUi();
        elements.destinatariPanel.hidden = false;
        elements.nuovoMessaggioButton.setAttribute("aria-expanded", "true");
    }

    function closeRecipientPanel(clearSelection) {
        elements.destinatariPanel.hidden = true;
        elements.nuovoMessaggioButton.setAttribute("aria-expanded", "false");
        setMapRecipientSelectionMode(false);

        if (clearSelection) {
            selectedRecipientIds.clear();
            renderRecipientList();
            updateRecipientSelectionUi();
        }
    }

    function renderRecipientList() {
        elements.destinatariLista.replaceChildren();

        const recipients = locations.filter(
            (location) => Number(location.id) !== Number(sessionLocation?.id)
        );

        recipients.forEach((location) => {
            const id = Number(location.id);
            const label = document.createElement("label");
            label.className = "destinatario-opzione";

            const checkbox = document.createElement("input");
            checkbox.type = "checkbox";
            checkbox.value = String(id);
            checkbox.checked = selectedRecipientIds.has(id);
            checkbox.disabled =
                !checkbox.checked &&
                selectedRecipientIds.size >= MAX_BATCH_RECIPIENTS;

            const text = document.createElement("span");
            text.textContent = location.address;

            if (checkbox.checked) {
                label.classList.add("selezionato");
            }

            checkbox.addEventListener("change", () => {
                if (checkbox.checked) {
                    addRecipient(id);
                } else {
                    removeRecipient(id);
                }
            });

            label.append(checkbox, text);
            elements.destinatariLista.appendChild(label);
        });
    }

    function addRecipient(id) {
        if (selectedRecipientIds.has(id)) {
            return;
        }

        if (selectedRecipientIds.size >= MAX_BATCH_RECIPIENTS) {
            updateRecipientSelectionUi(
                `Puoi selezionare al massimo ${MAX_BATCH_RECIPIENTS} destinatari per volta.`
            );
            renderRecipientList();
            return;
        }

        selectedRecipientIds.add(id);
        refreshRecipientSelection();
    }

    function removeRecipient(id) {
        selectedRecipientIds.delete(id);
        refreshRecipientSelection();
    }

    function toggleRecipient(id) {
        const numericId = Number(id);

        if (selectedRecipientIds.has(numericId)) {
            selectedRecipientIds.delete(numericId);
        } else if (selectedRecipientIds.size < MAX_BATCH_RECIPIENTS) {
            selectedRecipientIds.add(numericId);
        } else {
            updateRecipientSelectionUi(
                `Puoi selezionare al massimo ${MAX_BATCH_RECIPIENTS} destinatari per volta.`
            );
            return;
        }

        refreshRecipientSelection();
    }

    function refreshRecipientSelection() {
        renderRecipientList();
        updateRecipientSelectionUi();

        if (mapRecipientSelectionMode) {
            renderLocations();
        }
    }

    function updateRecipientSelectionUi(message = "") {
        const count = selectedRecipientIds.size;
        elements.destinatariConteggio.textContent =
            count === 0
                ? "Nessun destinatario selezionato"
                : count === 1
                    ? "1 destinatario selezionato"
                    : `${count} destinatari selezionati`;

        elements.destinatariContinua.disabled = count === 0;
        elements.destinatariPulisci.disabled = count === 0;
        elements.destinatariIstruzioni.textContent =
            message ||
            (mapRecipientSelectionMode
                ? "Seleziona o deseleziona le location cliccando direttamente sulla mappa."
                : `Scegli fino a ${MAX_BATCH_RECIPIENTS} destinatari dall’elenco oppure dalla mappa.`);
    }

    function clearRecipientSelection() {
        selectedRecipientIds.clear();
        refreshRecipientSelection();
    }

    function toggleMapRecipientSelection() {
        setMapRecipientSelectionMode(!mapRecipientSelectionMode);

        if (mapRecipientSelectionMode) {
            elements.map.scrollIntoView({
                behavior: "smooth",
                block: "center"
            });
        }
    }

    function setMapRecipientSelectionMode(enabled) {
        const changed = mapRecipientSelectionMode !== enabled;
        mapRecipientSelectionMode = enabled;
        elements.map.classList.toggle("selezione-destinatari-attiva", enabled);
        elements.selezioneMappaButton.textContent = enabled
            ? "Fine selezione dalla mappa"
            : "Seleziona dalla mappa";
        elements.selezioneMappaButton.setAttribute("aria-pressed", String(enabled));
        updateRecipientSelectionUi();

        if (changed && locations.length) {
            renderLocations();
        }
    }

    function selectedRecipientLocations() {
        return locations.filter((location) =>
            selectedRecipientIds.has(Number(location.id))
        );
    }

    function continueToMessage() {
        const recipients = selectedRecipientLocations();

        if (!recipients.length) {
            updateRecipientSelectionUi("Seleziona almeno un destinatario.");
            return;
        }

        closeRecipientPanel(false);
        openMessageComposer(recipients);
    }

    async function openPoem(location) {
        elements.poesiaDialogo.setAttribute(
            "aria-label",
            `Poesia di ${location.address}`
        );

        showPoemMessage("Caricamento…");

        elements.poesiaOverlay.hidden = false;
        elements.poesiaOverlay.scrollTop = 0;
        document.body.classList.add("poesia-aperta");

        try {
            const data = await api(`/api/poems/${location.id}`);
            elements.poesiaTesto.innerHTML = data.html;
        } catch (_) {
            showPoemMessage("Non è stato possibile caricare la poesia.");
        }

        elements.poesiaClose.focus();
    }

    function closePoem() {
        elements.poesiaOverlay.hidden = true;
        document.body.classList.remove("poesia-aperta");
    }

    async function toggleInbox() {
        elements.postaSection.hidden = !elements.postaSection.hidden;

        if (elements.postaSection.hidden) {
            return;
        }

        document.getElementById("menuClose")?.click();
        await loadInbox();
        elements.postaSection.scrollIntoView({
            behavior: "smooth",
            block: "start"
        });
    }

    async function loadInbox() {
        if (!sessionToken || !apiConfigured()) {
            return;
        }

        showMessage(elements.postaLista, "Caricamento…");

        try {
            const data = await api("/api/messages");
            renderInbox(data.messages || []);
        } catch (_) {
            showMessage(
                elements.postaLista,
                "Non è stato possibile caricare i messaggi."
            );
        }
    }

    function renderInbox(messages) {
        elements.postaLista.replaceChildren();

        if (!messages.length) {
            showMessage(elements.postaLista, "Nessun messaggio.");
            return;
        }

        messages.forEach((message) => {
            const article = document.createElement("article");
            article.className = "messaggio-ricevuto";

            const title = document.createElement("h3");
            title.textContent = message.senderAddress
                ? `Da ${message.senderAddress}`
                : "Da un’altra location";

            const body = document.createElement("p");
            body.textContent = message.text;

            const meta = document.createElement("div");
            meta.className = "messaggio-meta";
            meta.textContent = new Date(message.createdAt).toLocaleString("it-IT");

            article.append(title, body, meta);

            if (message.senderPublicConsent) {
                article.appendChild(createArchiveConsentControl(message));
            }

            elements.postaLista.appendChild(article);

            if (message.status === "approved") {
                api(`/api/messages/${message.id}`, {
                    method: "PATCH",
                    body: JSON.stringify({ action: "read" })
                }).catch(() => {});
            }
        });
    }

    function createArchiveConsentControl(message) {
        const section = document.createElement("div");
        const description = document.createElement("p");
        const button = document.createElement("button");

        section.className = "messaggio-archivio-controllo";
        description.className = "messaggio-meta";
        description.textContent = message.isPublic
            ? "Questo messaggio è pubblicato anonimamente nell’archivio."
            : message.recipientPublicConsent
                ? "Hai autorizzato la pubblicazione. L’admin deve ancora confermarla."
                : "Il mittente propone la pubblicazione anonima nell’archivio.";

        button.type = "button";
        button.className = "messaggio-archivio-button";
        button.textContent = message.recipientPublicConsent
            ? "Revoca autorizzazione"
            : "Autorizza pubblicazione";
        button.addEventListener("click", async () => {
            button.disabled = true;
            description.textContent = "Aggiornamento…";

            try {
                await api(`/api/messages/${message.id}`, {
                    method: "PATCH",
                    body: JSON.stringify({
                        action: message.recipientPublicConsent
                            ? "revoke_public"
                            : "allow_public"
                    })
                });
                await loadInbox();
            } catch (error) {
                description.textContent =
                    error.message || "Non è stato possibile aggiornare il consenso.";
                button.disabled = false;
            }
        });

        section.append(description, button);
        return section;
    }

    function openMessage(location) {
        selectedRecipientIds = new Set([Number(location.id)]);
        openMessageComposer([location]);
    }

    function openMessageComposer(recipients) {
        currentRecipients = recipients.slice(0, MAX_BATCH_RECIPIENTS);
        selectedRecipientIds = new Set(
            currentRecipients.map((location) => Number(location.id))
        );
        updateMessageRecipientSummary();

        elements.messaggioForm.reset();
        elements.messaggioTesto.value = "";
        elements.messaggioStatus.textContent = "";
        syncArchiveConsentAvailability();
        updateMessageCounter();

        elements.messaggioOverlay.hidden = false;
        document.body.classList.add("poesia-aperta");
        elements.messaggioTesto.focus();
    }

    function updateMessageRecipientSummary() {
        const count = currentRecipients.length;

        if (count === 1) {
            elements.messaggioTitolo.textContent =
                `Invia un messaggio a ${currentRecipients[0].address}`;
            elements.messaggioDestinatari.textContent =
                `Destinatario: ${currentRecipients[0].address}`;
            return;
        }

        elements.messaggioTitolo.textContent =
            `Invia un messaggio a ${count} locations`;
        elements.messaggioDestinatari.textContent =
            `Destinatari (${count}): ${currentRecipients
                .map((location) => location.address)
                .join(", ")}`;
    }

    function closeMessage() {
        elements.messaggioOverlay.hidden = true;
        currentRecipients = [];
        selectedRecipientIds.clear();
        renderRecipientList();
        updateRecipientSelectionUi();
        document.body.classList.remove("poesia-aperta");
    }

    function updateMessageCounter() {
        elements.messaggioContatore.textContent =
            `${elements.messaggioTesto.value.length} / ${MAX_MESSAGE_LENGTH}`;
    }

    function syncArchiveConsentAvailability() {
        const delivery = new FormData(elements.messaggioForm).get("consegna");
        const physical = delivery === "physical";

        elements.messaggioArchivioLabel.hidden = physical;
        elements.messaggioArchivio.disabled = physical;

        if (physical) {
            elements.messaggioArchivio.checked = false;
        }
    }

    async function sendMessage(event) {
        event.preventDefault();

        if (!currentRecipients.length) {
            elements.messaggioStatus.textContent = "Seleziona almeno un destinatario.";
            return;
        }

        const text = elements.messaggioTesto.value.trim();

        if (!text) {
            elements.messaggioStatus.textContent = "Scrivi un messaggio.";
            return;
        }

        const formData = new FormData(elements.messaggioForm);
        const revealSender = formData.get("mittente") === "location";
        const deliveryType =
            formData.get("consegna") === "physical"
                ? "physical"
                : "online";
        const publicConsent =
            deliveryType === "online" &&
            formData.get("archivioPubblico") === "on";

        const originalRecipients = [...currentRecipients];
        const failedRecipients = [];
        let sentCount = 0;
        let rateLimited = false;

        elements.messaggioInvia.disabled = true;
        elements.messaggioStatus.textContent =
            originalRecipients.length === 1
                ? "Invio in corso…"
                : `Invio a ${originalRecipients.length} destinatari…`;

        for (let index = 0; index < originalRecipients.length; index += 1) {
            const recipient = originalRecipients[index];

            try {
                await api("/api/messages", {
                    method: "POST",
                    body: JSON.stringify({
                        recipientId: recipient.id,
                        text,
                        revealSender,
                        deliveryType,
                        publicConsent
                    })
                });
                sentCount += 1;
            } catch (error) {
                failedRecipients.push(recipient);

                if (error.status === 429) {
                    rateLimited = true;
                    failedRecipients.push(...originalRecipients.slice(index + 1));
                    break;
                }
            }
        }

        if (!failedRecipients.length) {
            elements.messaggioStatus.textContent = successMessage(
                deliveryType,
                sentCount
            );
            elements.messaggioTesto.value = "";
            updateMessageCounter();
        } else {
            currentRecipients = failedRecipients;
            selectedRecipientIds = new Set(
                failedRecipients.map((location) => Number(location.id))
            );
            updateMessageRecipientSummary();

            if (sentCount > 0) {
                elements.messaggioStatus.textContent = rateLimited
                    ? `${sentCount} invii completati. Per i restanti ${failedRecipients.length} hai raggiunto il limite temporaneo: il testo resta qui per poter riprovare più tardi.`
                    : `${sentCount} invii completati; ${failedRecipients.length} non sono andati a buon fine. Il testo resta qui per riprovare.`;
            } else {
                elements.messaggioStatus.textContent = rateLimited
                    ? "Hai raggiunto il limite temporaneo di invio. Riprova più tardi."
                    : "Non è stato possibile inviare il messaggio.";
            }
        }

        elements.messaggioInvia.disabled = false;
    }

    function successMessage(deliveryType, count) {
        const plural = count !== 1;

        if (deliveryType === "physical") {
            return plural
                ? `Richieste inviate a ${count} locations. Le lettere verranno consegnate dopo la verifica.`
                : "Richiesta inviata. La lettera verrà consegnata dopo la verifica.";
        }

        return plural
            ? `Messaggio inviato a ${count} locations. Sarà visibile ai destinatari dopo la verifica.`
            : "Messaggio inviato. Sarà visibile al destinatario dopo la verifica.";
    }
})();
