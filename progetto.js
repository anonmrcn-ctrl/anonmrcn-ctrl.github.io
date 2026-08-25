(() => {
    "use strict";

    const apiClient = window.NNMRCN_API;
    const mapExtensions = window.NNMRCN_MAP;
    const SESSION_KEY = "nnmrcn_session";
    const MAX_MESSAGE_LENGTH = 1500;
    const MAX_BATCH_RECIPIENTS = 5;

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
        messaggioStatus: document.getElementById("messaggioStatus")
    };

    let sessionToken = sessionStorage.getItem(SESSION_KEY) || "";
    let sessionLocation = null;
    let locations = [];
    let currentRecipients = [];
    let selectedRecipientIds = new Set();
    let mapRecipientSelectionMode = false;

    const pushNotifications = window.NNMRCN_NOTIFICHE.create({
        button: elements.locationPushButton,
        status: elements.locationPushStatus,
        request: api,
        identity: () => sessionLocation
            ? `location-${sessionLocation.id}`
            : ""
    });

    const map = createMap();
    const locationsLayer = L.layerGroup().addTo(map);

    loadLandscapes();
    bindInterface();
    restoreSession();

    function createMap() {
        const instance = L.map("map", {
            scrollWheelZoom: true
        }).setView([45.5515, 12.3278], 13);

        instance.createPane("historicalRaster");
        instance.getPane("historicalRaster").style.zIndex = "250";
        instance.getPane("historicalRaster").style.pointerEvents = "none";

        const satelliteUrl =
            "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";

        const satelliteOptions = {
            maxZoom: 19,
            attribution:
                "Tiles &copy; Esri — Sources: Esri, Maxar, Earthstar Geographics, and the GIS User Community"
        };

        const today = L.layerGroup([
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

            const historical1975 = window.pmtiles.leafletRasterLayer(
                archive1975,
                {
                    pane: "historicalRaster",
                    opacity: 1,
                    noWrap: true,
                    attribution: "Aerofototeca Veneta — 1975"
                }
            );

            historical1975.on("tileerror", (event) => {
                console.error(
                    "Impossibile caricare una tessera della mappa del 1975.",
                    event.error || event
                );
            });

            year1975Layers.push(historical1975);
        } else {
            console.error("PMTiles non è disponibile: il livello 1975 non può essere caricato.");
        }

        const year1975 = L.layerGroup(year1975Layers);

        today.addTo(instance);

        L.control.layers(
            {
                "Oggi": today,
                "1975": year1975
            },
            null,
            {
                collapsed: false
            }
        ).addTo(instance);

        return instance;
    }

    async function loadLandscapes() {
        const landscapeLayer = L.layerGroup().addTo(map);

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
        elements.messaggioForm.addEventListener("submit", sendMessage);

        document.addEventListener("keydown", (event) => {
            if (event.key !== "Escape") {
                return;
            }

            if (!elements.messaggioOverlay.hidden) {
                closeMessage();
            } else if (!elements.poesiaOverlay.hidden) {
                closePoem();
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
        elements.loginLocation.textContent = location.address;
        elements.loginLoggedOut.hidden = true;
        elements.loginLoggedIn.hidden = false;
        elements.messaggisticaMappa.hidden = false;
        elements.loginMessage.textContent = "";

        pushNotifications.sync().catch((error) => {
            console.error("Impossibile controllare le notifiche.", error);
        });
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
            elements.postaLista.appendChild(article);

            if (message.status === "approved") {
                api(`/api/messages/${message.id}`, {
                    method: "PATCH",
                    body: JSON.stringify({ action: "read" })
                }).catch(() => {});
            }
        });
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
                        deliveryType
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
