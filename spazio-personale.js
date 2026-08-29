(() => {
    "use strict";

    const apiClient = window.NNMRCN_API;
    const settingsManager = window.NNMRCN_SETTINGS;
    const SESSION_KEY = "nnmrcn_session";
    const MAX_BATCH_RECIPIENTS = 5;
    const MAX_MESSAGE_LENGTH = 1500;

    const elements = {
        content: document.querySelector("[data-spazio-personale-contenuto]"),
        identity: document.getElementById("spazioPersonaleIdentita"),
        map: document.getElementById("spazioPersonaleMap"),
        newMessage: document.getElementById("nuovoMessaggioButton"),
        recipientPanel: document.getElementById("destinatariPanel"),
        recipientList: document.getElementById("destinatariLista"),
        recipientCount: document.getElementById("destinatariConteggio"),
        recipientInstructions: document.getElementById("destinatariIstruzioni"),
        recipientClear: document.getElementById("destinatariPulisci"),
        recipientCancel: document.getElementById("destinatariAnnulla"),
        recipientContinue: document.getElementById("destinatariContinua"),
        inbox: document.getElementById("postaLista"),
        inboxRefresh: document.getElementById("postaRefresh"),
        messageOverlay: document.getElementById("messaggioOverlay"),
        messageClose: document.getElementById("messaggioClose"),
        messageTitle: document.getElementById("messaggioTitolo"),
        messageRecipients: document.getElementById("messaggioDestinatari"),
        messageForm: document.getElementById("messaggioForm"),
        messageText: document.getElementById("messaggioTesto"),
        messageCounter: document.getElementById("messaggioContatore"),
        messageSend: document.getElementById("messaggioInvia"),
        messageStatus: document.getElementById("messaggioStatus"),
        archiveConsent: document.getElementById("messaggioArchivio"),
        archiveConsentLabel: document.getElementById("messaggioArchivioLabel")
    };

    if (!apiClient || !window.L || !elements.content || !elements.map) {
        return;
    }

    let sessionToken = sessionStorage.getItem(SESSION_KEY) || "";
    let sessionLocation = null;
    let locations = [];
    let selectedRecipientIds = new Set();
    let currentRecipients = [];
    let map = null;
    let locationsLayer = null;

    bindInterface();

    document.addEventListener("nnmrcn:sessionchange", (event) => {
        sessionToken = sessionStorage.getItem(SESSION_KEY) || "";

        if (!event.detail?.authenticated) {
            lockSpace();
            return;
        }

        unlockSpace(event.detail.location);
    });

    function bindInterface() {
        elements.newMessage.addEventListener("click", toggleRecipientPanel);
        elements.recipientClear.addEventListener("click", clearRecipientSelection);
        elements.recipientCancel.addEventListener("click", closeRecipientPanel);
        elements.recipientContinue.addEventListener("click", continueToMessage);
        elements.inboxRefresh.addEventListener("click", loadInbox);
        elements.messageClose.addEventListener("click", closeMessage);
        elements.messageText.addEventListener("input", updateMessageCounter);
        elements.messageForm.addEventListener("change", syncArchiveConsent);
        elements.messageForm.addEventListener("submit", sendMessage);

        document.addEventListener("keydown", (event) => {
            if (event.key === "Escape" && !elements.messageOverlay.hidden) {
                closeMessage();
            }
        });
    }

    async function api(path, options = {}) {
        const headers = new Headers(options.headers || {});

        if (sessionToken) {
            headers.set("Authorization", `Bearer ${sessionToken}`);
        }

        try {
            return await apiClient.request(path, { ...options, headers });
        } catch (error) {
            if (error.status === 401) {
                sessionStorage.removeItem(SESSION_KEY);
                document.dispatchEvent(new CustomEvent("nnmrcn:sessioninvalid"));
                lockSpace();
            }

            throw error;
        }
    }

    async function unlockSpace(location) {
        sessionLocation = location;
        elements.identity.textContent = `Accesso riconosciuto: ${location.username || location.address}`;
        ensureMap();
        map.invalidateSize({ pan: false });
        await loadNetwork();
    }

    function lockSpace() {
        sessionToken = "";
        sessionLocation = null;
        locations = [];
        selectedRecipientIds.clear();
        currentRecipients = [];
        locationsLayer?.clearLayers();
        elements.recipientPanel.hidden = true;
        elements.newMessage.setAttribute("aria-expanded", "false");
        elements.messageOverlay.hidden = true;
        document.body.classList.remove("poesia-aperta");
        showMessage(elements.inbox, "Completa l’accesso per leggere i messaggi.");
    }

    function ensureMap() {
        if (map) {
            return;
        }

        const lightMap = settingsManager?.isLightMapEnabled?.() || false;
        map = L.map(elements.map, {
            fadeAnimation: !lightMap,
            markerZoomAnimation: !lightMap,
            zoomAnimation: !lightMap
        }).setView([45.5515, 12.3278], 13);

        L.tileLayer(
            "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
            {
                maxZoom: 19,
                keepBuffer: lightMap ? 1 : 2,
                updateWhenIdle: lightMap,
                attribution: "Tiles &copy; Esri — Sources: Esri, Maxar, Earthstar Geographics, and the GIS User Community"
            }
        ).addTo(map);

        locationsLayer = L.layerGroup().addTo(map);
    }

    async function loadNetwork() {
        if (!sessionToken) {
            return;
        }

        elements.newMessage.disabled = true;

        try {
            const data = await api("/api/locations");
            locations = data.locations || [];
            selectedRecipientIds.clear();
            renderRecipientList();
            updateRecipientSelectionUi();
            renderLocations();
            await loadInbox();
        } catch (error) {
            if (error.status !== 401) {
                showMessage(elements.inbox, "Non è stato possibile caricare lo Spazio personale.");
            }
        } finally {
            elements.newMessage.disabled = false;
        }
    }

    function recipientLocations() {
        return locations.filter(
            (location) =>
                Number(location.id) !== Number(sessionLocation?.id) &&
                selectedRecipientIds.has(Number(location.id))
        );
    }

    function availableRecipients() {
        return locations.filter(
            (location) => Number(location.id) !== Number(sessionLocation?.id)
        );
    }

    function renderRecipientList() {
        elements.recipientList.replaceChildren();
        const recipients = availableRecipients();

        if (!recipients.length) {
            showMessage(elements.recipientList, "Non ci sono ancora altre locations.");
            return;
        }

        recipients.forEach((location) => {
            const id = Number(location.id);
            const label = document.createElement("label");
            const checkbox = document.createElement("input");
            const text = document.createElement("span");

            label.className = "destinatario-opzione";
            checkbox.type = "checkbox";
            checkbox.value = String(id);
            checkbox.checked = selectedRecipientIds.has(id);
            checkbox.disabled = !checkbox.checked && selectedRecipientIds.size >= MAX_BATCH_RECIPIENTS;
            text.textContent = location.address;

            if (checkbox.checked) {
                label.classList.add("selezionato");
            }

            checkbox.addEventListener("change", () => {
                toggleRecipient(id, checkbox.checked);
            });

            label.append(checkbox, text);
            elements.recipientList.appendChild(label);
        });
    }

    function renderLocations() {
        locationsLayer.clearLayers();
        const visiblePoints = [];

        locations.forEach((location) => {
            if (!Number.isFinite(location.lat) || !Number.isFinite(location.lon)) {
                return;
            }

            const id = Number(location.id);
            const own = id === Number(sessionLocation?.id);
            const selected = selectedRecipientIds.has(id);
            const marker = L.circleMarker([location.lat, location.lon], {
                radius: own ? 9 : selected ? 11 : 8,
                color: "#171717",
                weight: selected ? 3 : 2,
                fillColor: selected ? "#171717" : "#f4f1e8",
                fillOpacity: selected ? 0.95 : 0.85
            });

            marker.bindTooltip(
                own ? `${location.address} — la tua location` : location.address,
                { direction: "top", offset: [0, -8] }
            );

            if (!own) {
                marker.on("click", () => {
                    if (elements.recipientPanel.hidden) {
                        openRecipientPanel();
                    }
                    toggleRecipient(id, !selectedRecipientIds.has(id));
                });
            }

            marker.addTo(locationsLayer);
            visiblePoints.push([location.lat, location.lon]);
        });

        if (visiblePoints.length > 1) {
            map.fitBounds(visiblePoints, {
                padding: [35, 35],
                maxZoom: 15,
                animate: !settingsManager?.shouldReduceMotion?.()
            });
        } else if (visiblePoints.length === 1) {
            map.setView(visiblePoints[0], 15, { animate: false });
        }
    }

    function toggleRecipient(id, checked) {
        if (checked) {
            if (selectedRecipientIds.size >= MAX_BATCH_RECIPIENTS) {
                updateRecipientSelectionUi(`Puoi scegliere al massimo ${MAX_BATCH_RECIPIENTS} destinatari.`);
                renderRecipientList();
                return;
            }
            selectedRecipientIds.add(id);
        } else {
            selectedRecipientIds.delete(id);
        }

        renderRecipientList();
        updateRecipientSelectionUi();
        renderLocations();
    }

    function updateRecipientSelectionUi(message = "") {
        const count = selectedRecipientIds.size;
        elements.recipientCount.textContent = count === 0
            ? "Nessun destinatario selezionato"
            : count === 1
                ? "1 destinatario selezionato"
                : `${count} destinatari selezionati`;
        elements.recipientContinue.disabled = count === 0;
        elements.recipientClear.disabled = count === 0;
        elements.recipientInstructions.textContent = message ||
            `Scegli fino a ${MAX_BATCH_RECIPIENTS} destinatari dall’elenco o dalla mappa.`;
    }

    function toggleRecipientPanel() {
        if (elements.recipientPanel.hidden) {
            openRecipientPanel();
        } else {
            closeRecipientPanel();
        }
    }

    function openRecipientPanel() {
        selectedRecipientIds.clear();
        renderRecipientList();
        updateRecipientSelectionUi();
        renderLocations();
        elements.recipientPanel.hidden = false;
        elements.newMessage.setAttribute("aria-expanded", "true");
    }

    function closeRecipientPanel() {
        selectedRecipientIds.clear();
        elements.recipientPanel.hidden = true;
        elements.newMessage.setAttribute("aria-expanded", "false");
        renderRecipientList();
        updateRecipientSelectionUi();
        renderLocations();
    }

    function clearRecipientSelection() {
        selectedRecipientIds.clear();
        renderRecipientList();
        updateRecipientSelectionUi();
        renderLocations();
    }

    function continueToMessage() {
        const recipients = recipientLocations();

        if (!recipients.length) {
            updateRecipientSelectionUi("Scegli almeno un destinatario.");
            return;
        }

        currentRecipients = recipients;
        elements.recipientPanel.hidden = true;
        elements.newMessage.setAttribute("aria-expanded", "false");
        openMessageComposer();
    }

    function openMessageComposer() {
        updateMessageRecipientSummary();
        elements.messageForm.reset();
        elements.messageStatus.textContent = "";
        updateMessageCounter();
        syncArchiveConsent();
        elements.messageOverlay.hidden = false;
        document.body.classList.add("poesia-aperta");
        elements.messageText.focus();
    }

    function closeMessage() {
        elements.messageOverlay.hidden = true;
        currentRecipients = [];
        selectedRecipientIds.clear();
        renderRecipientList();
        updateRecipientSelectionUi();
        renderLocations();
        document.body.classList.remove("poesia-aperta");
    }

    function updateMessageCounter() {
        elements.messageCounter.textContent = `${elements.messageText.value.length} / ${MAX_MESSAGE_LENGTH}`;
    }

    function syncArchiveConsent() {
        const physical = new FormData(elements.messageForm).get("consegna") === "physical";
        elements.archiveConsentLabel.hidden = physical;
        elements.archiveConsent.disabled = physical;

        if (physical) {
            elements.archiveConsent.checked = false;
        }
    }

    async function sendMessage(event) {
        event.preventDefault();

        const text = elements.messageText.value.trim();

        if (!currentRecipients.length || !text) {
            elements.messageStatus.textContent = !text
                ? "Scrivi un messaggio."
                : "Scegli almeno un destinatario.";
            return;
        }

        const formData = new FormData(elements.messageForm);
        const deliveryType = formData.get("consegna") === "physical" ? "physical" : "online";
        const revealSender = formData.get("mittente") === "location";
        const publicConsent = deliveryType === "online" && formData.get("archivioPubblico") === "on";
        const originalRecipients = [...currentRecipients];
        const failed = [];
        let sent = 0;
        let rateLimited = false;

        elements.messageSend.disabled = true;
        elements.messageStatus.textContent = "Invio in corso…";

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
                sent += 1;
            } catch (error) {
                failed.push(recipient);

                if (error.status === 429) {
                    rateLimited = true;
                    failed.push(...originalRecipients.slice(index + 1));
                    break;
                }
            }
        }

        if (!failed.length && sent === originalRecipients.length) {
            elements.messageStatus.textContent = deliveryType === "physical"
                ? sent === 1
                    ? "Richiesta inviata. La lettera verrà consegnata dopo la verifica."
                    : `Richieste inviate a ${sent} locations. Le lettere verranno consegnate dopo la verifica.`
                : sent === 1
                    ? "Messaggio inviato. Sarà visibile dopo la verifica."
                    : `Messaggio inviato a ${sent} locations. Sarà visibile dopo la verifica.`;
            elements.messageText.value = "";
            updateMessageCounter();
        } else {
            currentRecipients = failed;
            selectedRecipientIds = new Set(
                failed.map((location) => Number(location.id))
            );
            updateMessageRecipientSummary();

            if (sent) {
                elements.messageStatus.textContent = rateLimited
                    ? `${sent} invii completati. Per i restanti ${failed.length} hai raggiunto il limite temporaneo: il testo resta qui per poter riprovare più tardi.`
                    : `${sent} invii completati; ${failed.length} non sono andati a buon fine. Il testo resta qui per riprovare.`;
            } else {
                elements.messageStatus.textContent = rateLimited
                    ? "Hai raggiunto il limite temporaneo di invio. Riprova più tardi."
                    : "Non è stato possibile inviare il messaggio.";
            }
        }

        elements.messageSend.disabled = false;
    }

    function updateMessageRecipientSummary() {
        const count = currentRecipients.length;

        elements.messageTitle.textContent = count === 1
            ? `Invia un messaggio a ${currentRecipients[0].address}`
            : `Invia un messaggio a ${count} locations`;
        elements.messageRecipients.textContent = count === 1
            ? `Destinatario: ${currentRecipients[0].address}`
            : `Destinatari (${count}): ${currentRecipients
                .map((location) => location.address)
                .join(", ")}`;
    }

    async function loadInbox() {
        if (!sessionToken) {
            return;
        }

        showMessage(elements.inbox, "Caricamento…");
        elements.inboxRefresh.disabled = true;

        try {
            const data = await api("/api/messages");
            renderInbox(data.messages || []);
        } catch (error) {
            if (error.status !== 401) {
                showMessage(elements.inbox, "Non è stato possibile caricare i messaggi.");
            }
        } finally {
            elements.inboxRefresh.disabled = false;
        }
    }

    function renderInbox(messages) {
        elements.inbox.replaceChildren();

        if (!messages.length) {
            showMessage(elements.inbox, "Nessun messaggio.");
            return;
        }

        messages.forEach((message) => {
            const article = document.createElement("article");
            const title = document.createElement("h3");
            const body = document.createElement("p");
            const meta = document.createElement("div");

            article.className = "messaggio-ricevuto";
            title.textContent = message.senderAddress
                ? `Da ${message.senderAddress}`
                : "Da un’altra location";
            body.textContent = message.text;
            meta.className = "messaggio-meta";
            meta.textContent = new Date(message.createdAt).toLocaleString("it-IT");
            article.append(title, body, meta);

            if (message.senderPublicConsent) {
                article.appendChild(createArchiveConsentControl(message));
            }

            elements.inbox.appendChild(article);

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
                description.textContent = error.message || "Non è stato possibile aggiornare il consenso.";
                button.disabled = false;
            }
        });

        section.append(description, button);
        return section;
    }

    function showMessage(container, message) {
        const paragraph = document.createElement("p");
        paragraph.textContent = message;
        container.replaceChildren(paragraph);
    }
})();
