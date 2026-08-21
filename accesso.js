(() => {
    "use strict";

    const API_BASE = String(window.NNMRCN_API_BASE || "").replace(/\/+$/, "");
    const SESSION_KEY = "nnmrcn_session";

    const menuButton = document.getElementById("menuButton");
    const menuClose = document.getElementById("menuClose");
    const menuPrincipale = document.getElementById("menuPrincipale");
    const menuOverlay = document.getElementById("menuOverlay");

    const loginForm = document.getElementById("loginForm");
    const loginPassword = document.getElementById("loginPassword");
    const loginButton = document.getElementById("loginButton");
    const loginMessage = document.getElementById("loginMessage");
    const loginLoggedOut = document.getElementById("loginLoggedOut");
    const loginLoggedIn = document.getElementById("loginLoggedIn");
    const loginLocation = document.getElementById("loginLocation");
    const logoutButton = document.getElementById("logoutButton");

    const postaButton = document.getElementById("postaButton");
    const postaSection = document.getElementById("postaSection");
    const postaLista = document.getElementById("postaLista");
    const postaRefresh = document.getElementById("postaRefresh");

    const poesiaOverlay = document.getElementById("poesiaOverlay");
    const poesiaClose = document.getElementById("poesiaClose");
    const poesiaDialogo = document.getElementById("poesiaDialogo");
    const poesiaTesto = document.getElementById("poesiaTesto");

    const messaggioOverlay = document.getElementById("messaggioOverlay");
    const messaggioClose = document.getElementById("messaggioClose");
    const messaggioTitolo = document.getElementById("messaggioTitolo");
    const messaggioForm = document.getElementById("messaggioForm");
    const messaggioTesto = document.getElementById("messaggioTesto");
    const messaggioContatore = document.getElementById("messaggioContatore");
    const messaggioInvia = document.getElementById("messaggioInvia");
    const messaggioStatus = document.getElementById("messaggioStatus");

    let sessionToken = sessionStorage.getItem(SESSION_KEY) || "";
    let sessionLocation = null;
    let locations = [];
    let currentRecipient = null;

    function apriMenu() {
        menuPrincipale.classList.add("aperto");
        menuOverlay.classList.add("aperto");
        menuButton.setAttribute("aria-expanded", "true");
        document.body.classList.add("menu-aperto");
    }

    function chiudiMenu() {
        menuPrincipale.classList.remove("aperto");
        menuOverlay.classList.remove("aperto");
        menuButton.setAttribute("aria-expanded", "false");
        document.body.classList.remove("menu-aperto");
    }

    menuButton.addEventListener("click", apriMenu);
    menuClose.addEventListener("click", chiudiMenu);
    menuOverlay.addEventListener("click", chiudiMenu);

    function apiConfigured() {
        return Boolean(API_BASE);
    }

    async function api(path, options = {}) {
        if (!apiConfigured()) {
            const error = new Error("API_NOT_CONFIGURED");
            error.code = "API_NOT_CONFIGURED";
            throw error;
        }

        const headers = new Headers(options.headers || {});
        headers.set("Accept", "application/json");

        if (options.body && !headers.has("Content-Type")) {
            headers.set("Content-Type", "application/json");
        }

        if (sessionToken) {
            headers.set("Authorization", `Bearer ${sessionToken}`);
        }

        const response = await fetch(`${API_BASE}${path}`, {
            ...options,
            headers
        });

        let data = null;
        try {
            data = await response.json();
        } catch (_) {
            data = null;
        }

        if (response.status === 401) {
            clearSession();
        }

        if (!response.ok) {
            const error = new Error(data?.error || "Errore di rete.");
            error.status = response.status;
            throw error;
        }

        return data;
    }

    function clearSession() {
        sessionToken = "";
        sessionLocation = null;
        locations = [];
        sessionStorage.removeItem(SESSION_KEY);
        locationsLayer.clearLayers();
        loginLoggedOut.hidden = false;
        loginLoggedIn.hidden = true;
        postaSection.hidden = true;
        postaLista.innerHTML = "<p>Nessun messaggio.</p>";
        loginLocation.textContent = "";
    }

    function setLoggedIn(location) {
        sessionLocation = location;
        loginLocation.textContent = location.address;
        loginLoggedOut.hidden = true;
        loginLoggedIn.hidden = false;
        loginMessage.textContent = "";
    }

    loginForm.addEventListener("submit", async (event) => {
        event.preventDefault();

        if (!apiConfigured()) {
            loginMessage.textContent = "Il sistema di accesso è pronto ma non è ancora collegato al server.";
            return;
        }

        loginButton.disabled = true;
        loginMessage.textContent = "Verifica in corso…";

        try {
            const data = await api("/api/login", {
                method: "POST",
                body: JSON.stringify({
                    password: loginPassword.value
                })
            });

            sessionToken = data.token;
            sessionStorage.setItem(SESSION_KEY, sessionToken);
            loginPassword.value = "";
            setLoggedIn(data.location);

            await caricaRete();
        } catch (error) {
            loginMessage.textContent =
                error.status === 401
                    ? "Password non riconosciuta."
                    : "Non è stato possibile accedere. Riprova.";
        } finally {
            loginButton.disabled = false;
        }
    });

    logoutButton.addEventListener("click", async () => {
        try {
            if (sessionToken && apiConfigured()) {
                await api("/api/logout", {
                    method: "POST"
                });
            }
        } catch (_) {
        }

        clearSession();
    });

    postaButton.addEventListener("click", async () => {
        postaSection.hidden = !postaSection.hidden;

        if (!postaSection.hidden) {
            await caricaPosta();
            postaSection.scrollIntoView({
                behavior: "smooth",
                block: "start"
            });
        }
    });

    postaRefresh.addEventListener("click", caricaPosta);

    async function restoreSession() {
        if (!sessionToken || !apiConfigured()) {
            if (!apiConfigured()) {
                loginMessage.textContent = "Il sistema di accesso è pronto ma non è ancora collegato al server.";
            }
            return;
        }

        try {
            const data = await api("/api/session");
            setLoggedIn(data.location);
            await caricaRete();
        } catch (_) {
            clearSession();
        }
    }

    async function caricaRete() {
        const data = await api("/api/locations");
        locations = data.locations || [];
        renderLocations();
        await caricaPosta();
    }

    async function caricaPosta() {
        if (!sessionToken || !apiConfigured()) {
            return;
        }

        postaLista.innerHTML = "<p>Caricamento…</p>";

        try {
            const data = await api("/api/messages");
            const messages = data.messages || [];

            if (!messages.length) {
                postaLista.innerHTML = "<p>Nessun messaggio.</p>";
                return;
            }

            postaLista.replaceChildren();

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
                postaLista.appendChild(article);

                if (message.status === "approved") {
                    api(`/api/messages/${message.id}`, {
                        method: "PATCH",
                        body: JSON.stringify({ action: "read" })
                    }).catch(() => {});
                }
            });
        } catch (_) {
            postaLista.innerHTML = "<p>Non è stato possibile caricare i messaggi.</p>";
        }
    }

    const map = L.map("map", {
        scrollWheelZoom: true
    }).setView(
        [45.5515, 12.3278],
        13
    );

    const satelliteUrl =
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";

    const satelliteOptions = {
        maxZoom: 19,
        attribution:
            "Tiles &copy; Esri — Sources: Esri, Maxar, Earthstar Geographics, and the GIS User Community"
    };

    const oggi = L.layerGroup([
        L.tileLayer(satelliteUrl, satelliteOptions)
    ]);

    const anno1975 = L.layerGroup([
        L.tileLayer(satelliteUrl, satelliteOptions),
        L.imageOverlay(
            "./marcon_1975_web.webp",
            [
                [45.5314854758, 12.2633666786],
                [45.5670779946, 12.3922261726]
            ],
            { opacity: 1 }
        )
    ]);

    oggi.addTo(map);

    L.control.layers(
        {
            "Oggi": oggi,
            "1975": anno1975
        },
        null,
        {
            collapsed: false
        }
    ).addTo(map);

    const locationsLayer = L.layerGroup().addTo(map);

    function renderLocations() {
        locationsLayer.clearLayers();

        locations.forEach((location) => {
            const isOwn = Number(location.id) === Number(sessionLocation?.id);

            let marker;

            if (isOwn) {
                marker = L.circleMarker(
                    [location.lat, location.lon],
                    {
                        radius: 9,
                        color: "#171717",
                        weight: 2,
                        fillColor: "#f4f1e8",
                        fillOpacity: 1
                    }
                );
            } else {
                marker = L.marker([
                    location.lat,
                    location.lon
                ]);
            }

            marker.addTo(locationsLayer);

            const actions = [];

            if (location.hasPoem) {
                actions.push(`
                    <button
                        type="button"
                        class="mostra-poesia"
                        data-location-id="${location.id}"
                    >
                        Mostra poesia ${escapeHtml(location.address)}
                    </button>
                `);
            }

            if (!isOwn) {
                actions.push(`
                    <button
                        type="button"
                        class="mostra-poesia invia-messaggio"
                        data-location-id="${location.id}"
                    >
                        Invia un messaggio
                    </button>
                `);
            }

            marker.bindPopup(`
                <div class="popup-luogo">
                    <strong>${escapeHtml(location.address)}</strong>
                    ${isOwn ? '<p class="location-propria">La tua location</p>' : ""}
                    <div class="popup-azioni">
                        ${actions.join("")}
                    </div>
                </div>
            `);
        });
    }

    map.on("popupopen", (event) => {
        const popup = event.popup.getElement();

        popup?.querySelector(".mostra-poesia:not(.invia-messaggio)")
            ?.addEventListener("click", async (clickEvent) => {
                const id = Number(clickEvent.currentTarget.dataset.locationId);
                const location = locations.find((item) => Number(item.id) === id);

                if (!location) {
                    return;
                }

                map.closePopup();
                await apriPoesia(location);
            });

        popup?.querySelector(".invia-messaggio")
            ?.addEventListener("click", (clickEvent) => {
                const id = Number(clickEvent.currentTarget.dataset.locationId);
                const location = locations.find((item) => Number(item.id) === id);

                if (!location) {
                    return;
                }

                map.closePopup();
                apriMessaggio(location);
            });
    });

    async function apriPoesia(location) {
        poesiaDialogo.setAttribute(
            "aria-label",
            `Poesia di ${location.address}`
        );

        poesiaTesto.innerHTML = `
            <main class="poesia">
                <p>Caricamento…</p>
            </main>
        `;

        poesiaOverlay.hidden = false;
        poesiaOverlay.scrollTop = 0;
        document.body.classList.add("poesia-aperta");

        try {
            const data = await api(`/api/poems/${location.id}`);
            poesiaTesto.innerHTML = data.html;
        } catch (_) {
            poesiaTesto.innerHTML = `
                <main class="poesia">
                    <p>Non è stato possibile caricare la poesia.</p>
                </main>
            `;
        }

        poesiaClose.focus();
    }

    function chiudiPoesia() {
        poesiaOverlay.hidden = true;
        document.body.classList.remove("poesia-aperta");
    }

    poesiaClose.addEventListener("click", chiudiPoesia);

    function apriMessaggio(location) {
        currentRecipient = location;
        messaggioTitolo.textContent = `Invia un messaggio a ${location.address}`;
        messaggioForm.reset();
        messaggioTesto.value = "";
        messaggioContatore.textContent = "0 / 1500";
        messaggioStatus.textContent = "";
        messaggioOverlay.hidden = false;
        document.body.classList.add("poesia-aperta");
        messaggioTesto.focus();
    }

    function chiudiMessaggio() {
        messaggioOverlay.hidden = true;
        currentRecipient = null;
        document.body.classList.remove("poesia-aperta");
    }

    messaggioClose.addEventListener("click", chiudiMessaggio);

    messaggioTesto.addEventListener("input", () => {
        messaggioContatore.textContent =
            `${messaggioTesto.value.length} / 1500`;
    });

    messaggioForm.addEventListener("submit", async (event) => {
        event.preventDefault();

        if (!currentRecipient) {
            return;
        }

        const text = messaggioTesto.value.trim();

        if (!text) {
            messaggioStatus.textContent = "Scrivi un messaggio.";
            return;
        }

        const revealSender =
            new FormData(messaggioForm).get("mittente") === "location";

        const deliveryType =
            new FormData(messaggioForm).get("consegna") === "physical"
                ? "physical"
                : "online";

        messaggioInvia.disabled = true;
        messaggioStatus.textContent = "Invio in corso…";

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

            messaggioStatus.textContent =
                deliveryType === "physical"
                    ? "Richiesta inviata. La lettera verrà consegnata dopo la verifica."
                    : "Messaggio inviato. Sarà visibile al destinatario dopo la verifica.";

            messaggioTesto.value = "";
            messaggioContatore.textContent = "0 / 1500";
        } catch (error) {
            if (error.status === 429) {
                messaggioStatus.textContent =
                    "Hai inviato troppi messaggi in poco tempo. Riprova più tardi.";
            } else {
                messaggioStatus.textContent =
                    "Non è stato possibile inviare il messaggio.";
            }
        } finally {
            messaggioInvia.disabled = false;
        }
    });

    document.addEventListener("keydown", (event) => {
        if (event.key !== "Escape") {
            return;
        }

        if (!messaggioOverlay.hidden) {
            chiudiMessaggio();
        } else if (!poesiaOverlay.hidden) {
            chiudiPoesia();
        } else {
            chiudiMenu();
        }
    });

    function escapeHtml(value) {
        return String(value)
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll('"', "&quot;")
            .replaceAll("'", "&#039;");
    }

    restoreSession();
})();
