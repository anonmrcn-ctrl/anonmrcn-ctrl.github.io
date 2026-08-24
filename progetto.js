(() => {
    "use strict";

    const apiClient = window.NNMRCN_API;
    const SESSION_KEY = "nnmrcn_session";
    const MAX_MESSAGE_LENGTH = 1500;

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
        postaSection: document.getElementById("postaSection"),
        postaLista: document.getElementById("postaLista"),
        postaRefresh: document.getElementById("postaRefresh"),
        poesiaOverlay: document.getElementById("poesiaOverlay"),
        poesiaClose: document.getElementById("poesiaClose"),
        poesiaDialogo: document.getElementById("poesiaDialogo"),
        poesiaTesto: document.getElementById("poesiaTesto"),
        messaggioOverlay: document.getElementById("messaggioOverlay"),
        messaggioClose: document.getElementById("messaggioClose"),
        messaggioTitolo: document.getElementById("messaggioTitolo"),
        messaggioForm: document.getElementById("messaggioForm"),
        messaggioTesto: document.getElementById("messaggioTesto"),
        messaggioContatore: document.getElementById("messaggioContatore"),
        messaggioInvia: document.getElementById("messaggioInvia"),
        messaggioStatus: document.getElementById("messaggioStatus")
    };

    let sessionToken = sessionStorage.getItem(SESSION_KEY) || "";
    let sessionLocation = null;
    let locations = [];
    let currentRecipient = null;

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
            const response = await fetch("./luoghi-significativi.geojson", {
                cache: "no-store"
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const data = await response.json();

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
        } catch (_) {
            clearSession();
        }
    }

    function setLoggedIn(location) {
        sessionLocation = location;
        elements.loginLocation.textContent = location.address;
        elements.loginLoggedOut.hidden = true;
        elements.loginLoggedIn.hidden = false;
        elements.loginMessage.textContent = "";
    }

    function clearSession() {
        sessionToken = "";
        sessionLocation = null;
        locations = [];
        currentRecipient = null;

        sessionStorage.removeItem(SESSION_KEY);
        locationsLayer.clearLayers();

        elements.loginLoggedOut.hidden = false;
        elements.loginLoggedIn.hidden = true;
        elements.loginLocation.textContent = "";
        elements.postaSection.hidden = true;
        showMessage(elements.postaLista, "Nessun messaggio.");
    }

    async function loadNetwork() {
        const data = await api("/api/locations");
        locations = data.locations || [];
        renderLocations();
        await loadInbox();
    }

    function renderLocations() {
        locationsLayer.clearLayers();

        locations.forEach((location) => {
            const isOwn = Number(location.id) === Number(sessionLocation?.id);
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
        currentRecipient = location;
        elements.messaggioTitolo.textContent =
            `Invia un messaggio a ${location.address}`;
        elements.messaggioForm.reset();
        elements.messaggioTesto.value = "";
        elements.messaggioStatus.textContent = "";
        updateMessageCounter();

        elements.messaggioOverlay.hidden = false;
        document.body.classList.add("poesia-aperta");
        elements.messaggioTesto.focus();
    }

    function closeMessage() {
        elements.messaggioOverlay.hidden = true;
        currentRecipient = null;
        document.body.classList.remove("poesia-aperta");
    }

    function updateMessageCounter() {
        elements.messaggioContatore.textContent =
            `${elements.messaggioTesto.value.length} / ${MAX_MESSAGE_LENGTH}`;
    }

    async function sendMessage(event) {
        event.preventDefault();

        if (!currentRecipient) {
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

        elements.messaggioInvia.disabled = true;
        elements.messaggioStatus.textContent = "Invio in corso…";

        try {
            await api("/api/messages", {
                method: "POST",
                body: JSON.stringify({
                    recipientId: currentRecipient.id,
                    text,
                    revealSender,
                    deliveryType
                })
            });

            elements.messaggioStatus.textContent =
                deliveryType === "physical"
                    ? "Richiesta inviata. La lettera verrà consegnata dopo la verifica."
                    : "Messaggio inviato. Sarà visibile al destinatario dopo la verifica.";

            elements.messaggioTesto.value = "";
            updateMessageCounter();
        } catch (error) {
            elements.messaggioStatus.textContent =
                error.status === 429
                    ? "Hai inviato troppi messaggi in poco tempo. Riprova più tardi."
                    : "Non è stato possibile inviare il messaggio.";
        } finally {
            elements.messaggioInvia.disabled = false;
        }
    }
})();
