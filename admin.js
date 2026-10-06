(() => {
    "use strict";

    const api = window.NNMRCN_API;
    const TOKEN_KEY = "nnmrcn_admin_token";

    const form = document.getElementById("adminLoginForm");
    const tokenInput = document.getElementById("adminToken");
    const statusText = document.getElementById("adminStatus");
    const panel = document.getElementById("adminPanel");
    const list = document.getElementById("adminList");
    const contactList = document.getElementById("adminContactList");
    const memorySection = document.getElementById("adminMemorie");
    const memoryList = document.getElementById("adminMemoryList");
    const memoryFilter = document.getElementById("adminMemoryStatusFilter");
    const memoryRefresh = document.getElementById("adminMemoryRefresh");
    const filter = document.getElementById("adminStatusFilter");
    const refresh = document.getElementById("adminRefresh");
    const pushButton = document.getElementById("adminPushButton");
    const pushStatus = document.getElementById("adminPushStatus");
    const search = document.getElementById("adminSearch");
    const exportCsv = document.getElementById("adminExportCsv");
    const exportJson = document.getElementById("adminExportJson");
    const exportStatus = document.getElementById("adminExportStatus");
    const countPending = document.getElementById("adminCountPending");
    const countDelivery = document.getElementById("adminCountDelivery");
    const countPublishable = document.getElementById("adminCountPublishable");
    const countPublic = document.getElementById("adminCountPublic");
    const countContacts = document.getElementById("adminCountContacts");
    const countMemories = document.getElementById("adminCountMemories");
    const countPublicMemories = document.getElementById(
        "adminCountPublicMemories"
    );
    const welcomePreview = document.getElementById("adminWelcomePreview");
    const mapEntryForm = document.getElementById("adminMapEntryForm");
    const mapEntryName = document.getElementById("adminMapEntryName");
    const mapEntryCategory = document.getElementById("adminMapEntryCategory");
    const mapEntryDescription = document.getElementById(
        "adminMapEntryDescription"
    );
    const mapEntryLat = document.getElementById("adminMapEntryLat");
    const mapEntryLon = document.getElementById("adminMapEntryLon");
    const mapEntrySourceUrl = document.getElementById("adminMapEntrySourceUrl");
    const mapEntrySourceLabel = document.getElementById(
        "adminMapEntrySourceLabel"
    );
    const mapEntrySubmit = document.getElementById("adminMapEntrySubmit");
    const mapEntryCancel = document.getElementById("adminMapEntryCancel");
    const mapEntryStatus = document.getElementById("adminMapEntryStatus");
    const mapEntryList = document.getElementById("adminMapEntryList");

    let adminToken = sessionStorage.getItem(TOKEN_KEY) || "";
    let loadedMessages = [];
    let memoryObjectUrls = [];
    let mapEntryMap = null;
    let mapEntryMarker = null;
    let mapEntryResizeObserver = null;
    let editingMapEntryId = null;
    let wikiSlugsByTitle = new Map();

    const pushNotifications = window.NNMRCN_NOTIFICHE.create({
        button: pushButton,
        status: pushStatus,
        request,
        identity: () => adminToken ? "admin" : ""
    });

    async function request(path, options = {}) {
        const headers = new Headers(options.headers || {});
        headers.set("X-Admin-Token", adminToken);

        return api.request(path, {
            ...options,
            headers
        });
    }

    function showListMessage(message) {
        const paragraph = document.createElement("p");
        paragraph.textContent = message;
        list.replaceChildren(paragraph);
    }

    async function loadMessages() {
        showListMessage("Caricamento…");

        try {
            const data = await request(
                `/api/admin/messages?status=${encodeURIComponent(filter.value)}`
            );

            loadedMessages = data.messages || [];
            renderCurrentMessages();
            panel.hidden = false;
            statusText.textContent = "";
            await Promise.all([
                loadContactMessages(),
                loadMemories(),
                loadMapEntries(),
                loadSummary(),
                pushNotifications.sync()
            ]);
        } catch (error) {
            if (error.status === 401) {
                panel.hidden = true;
                statusText.textContent = "Token non valido.";
                sessionStorage.removeItem(TOKEN_KEY);
                adminToken = "";
                pushNotifications.reset();
            } else {
                showListMessage("Errore nel caricamento.");
            }
        }
    }

    function renderCurrentMessages() {
        const query = search.value.trim().toLocaleLowerCase("it");
        const visible = query
            ? loadedMessages.filter((message) => [
                message.text,
                message.senderAddress,
                message.recipientAddress,
                message.status,
                message.deliveryType
            ].some((value) =>
                String(value || "").toLocaleLowerCase("it").includes(query)
            ))
            : loadedMessages;

        render(visible);
    }

    async function loadSummary() {
        try {
            const data = await request("/api/admin/summary");
            countPending.textContent = String(data.pendingOnline || 0);
            countDelivery.textContent = String(data.pendingDelivery || 0);
            countPublishable.textContent = String(data.publishable || 0);
            countPublic.textContent = String(data.public || 0);
            countContacts.textContent = String(data.unreadContacts || 0);
            countMemories.textContent = String(data.pendingMemories || 0);
            countPublicMemories.textContent = String(data.publicMemories || 0);
        } catch (_) {
            [
                countPending,
                countDelivery,
                countPublishable,
                countPublic,
                countContacts,
                countMemories,
                countPublicMemories
            ].forEach((element) => {
                element.textContent = "–";
            });
        }
    }

    function showContactListMessage(message) {
        const paragraph = document.createElement("p");
        paragraph.textContent = message;
        contactList.replaceChildren(paragraph);
    }

    async function loadContactMessages() {
        showContactListMessage("Caricamento…");

        try {
            const data = await request("/api/admin/contact-messages");
            renderContactMessages(data.messages || []);
        } catch (_) {
            showContactListMessage(
                "I messaggi diretti non sono momentaneamente disponibili."
            );
        }
    }

    function renderContactMessages(messages) {
        contactList.replaceChildren();

        if (!messages.length) {
            showContactListMessage("Nessun messaggio diretto.");
            return;
        }

        messages.forEach((message) => {
            const article = document.createElement("article");
            article.className = "admin-message";

            if (message.status === "unread") {
                article.classList.add("admin-contatto-nuovo");
            }

            const title = document.createElement("h2");
            title.textContent = message.name || "Mittente anonimo";

            const reply = document.createElement("p");
            reply.className = "admin-meta";

            if (message.email) {
                reply.append("Rispondi a: ");

                const address = document.createElement("a");
                address.className = "admin-contatto-email";
                address.href = `mailto:${message.email}`;
                address.textContent = message.email;
                reply.appendChild(address);
            } else {
                reply.textContent = "Nessuna email indicata.";
            }

            const date = document.createElement("p");
            date.className = "admin-meta";
            date.textContent =
                new Date(message.createdAt).toLocaleString("it-IT");

            const text = document.createElement("p");
            text.className = "admin-contact-text";
            appendContactText(text, message.text);

            article.append(title, reply, date, text);

            if (message.status === "unread") {
                const actions = document.createElement("div");
                actions.className = "admin-actions";
                actions.appendChild(contactActionButton(message.id));
                article.appendChild(actions);
            }

            contactList.appendChild(article);
        });
    }

    function appendContactText(container, value) {
        String(value || "").split("\n").forEach((line, index) => {
            if (index > 0) {
                container.appendChild(document.createElement("br"));
            }

            if (line.startsWith("Mappa: https://")) {
                container.append("Mappa: ");

                const link = document.createElement("a");
                link.href = line.slice("Mappa: ".length);
                link.target = "_blank";
                link.rel = "noopener noreferrer";
                link.textContent = "apri il punto selezionato";
                container.appendChild(link);
                return;
            }

            container.append(line);
        });
    }

    function contactActionButton(id) {
        const button = document.createElement("button");
        button.className = "admin-action";
        button.type = "button";
        button.textContent = "Segna come letto";

        button.addEventListener("click", async () => {
            button.disabled = true;

            try {
                await request(`/api/admin/contact-messages/${id}`, {
                    method: "PATCH",
                    body: JSON.stringify({ action: "read" })
                });

                await Promise.all([
                    loadContactMessages(),
                    loadSummary()
                ]);
            } catch (_) {
                statusText.textContent =
                    "Non è stato possibile aggiornare il messaggio diretto.";
                button.disabled = false;
            }
        });

        return button;
    }

    function showMemoryListMessage(message) {
        const paragraph = document.createElement("p");
        paragraph.textContent = message;
        memoryList.replaceChildren(paragraph);
    }

    async function loadMemories() {
        showMemoryListMessage("Caricamento…");

        try {
            const data = await request(
                `/api/admin/memories?status=${encodeURIComponent(memoryFilter.value)}`
            );
            renderMemories(data.memories || []);
        } catch (_) {
            showMemoryListMessage(
                "Le memorie non sono momentaneamente disponibili."
            );
        }
    }

    function renderMemories(memories) {
        memoryObjectUrls.forEach((url) => URL.revokeObjectURL(url));
        memoryObjectUrls = [];
        memoryList.replaceChildren();

        if (!memories.length) {
            showMemoryListMessage("Nessuna memoria in questa sezione.");
            return;
        }

        memories.forEach((memory) => {
            const article = document.createElement("article");
            article.className = "admin-message admin-memory";
            const title = document.createElement("h2");
            title.textContent = memory.title;
            const author = document.createElement("p");
            author.className = "admin-meta";
            author.textContent = `Firma: ${memory.authorName || "anonima"}`;
            const state = document.createElement("p");
            state.className = "admin-meta";
            state.textContent = `Stato: ${memory.status}`;
            const date = document.createElement("p");
            date.className = "admin-meta";
            date.textContent = new Date(memory.createdAt).toLocaleString("it-IT");
            const location = document.createElement("p");
            location.className = "admin-meta";
            const locationLink = document.createElement("a");
            locationLink.href =
                `https://www.google.com/maps?q=${memory.lat},${memory.lon}`;
            locationLink.target = "_blank";
            locationLink.rel = "noopener noreferrer";
            locationLink.textContent = "Apri il punto sulla mappa";
            location.appendChild(locationLink);
            const text = document.createElement("p");
            text.className = "admin-contact-text";
            text.textContent = memory.text;

            article.append(title, author, state, date, location, text);

            if (memory.mediaUrl) {
                article.appendChild(memoryMediaButton(memory));
            }

            const actions = document.createElement("div");
            actions.className = "admin-actions";

            if (memory.status !== "approved") {
                actions.appendChild(
                    memoryActionButton(memory.id, "approve", "Approva e pubblica")
                );
            }

            if (memory.status !== "rejected") {
                actions.appendChild(
                    memoryActionButton(
                        memory.id,
                        "reject",
                        memory.status === "approved"
                            ? "Rimuovi dalla mappa"
                            : "Non approvare"
                    )
                );
            }

            article.appendChild(actions);
            memoryList.appendChild(article);
        });
    }

    function memoryMediaButton(memory) {
        const button = document.createElement("button");
        button.className = "admin-action admin-memory-media-button";
        button.type = "button";
        button.textContent = memory.mediaType.startsWith("image/")
            ? "Mostra fotografia"
            : "Carica registrazione";

        button.addEventListener("click", async () => {
            button.disabled = true;

            try {
                const response = await fetch(`${api.baseUrl}${memory.mediaUrl}`, {
                    headers: {
                        "X-Admin-Token": adminToken,
                        "Accept": memory.mediaType
                    }
                });

                if (!response.ok) {
                    throw new Error("Allegato non disponibile.");
                }

                const objectUrl = URL.createObjectURL(await response.blob());
                memoryObjectUrls.push(objectUrl);
                let media;

                if (memory.mediaType.startsWith("image/")) {
                    media = document.createElement("img");
                    media.alt = `Fotografia associata a «${memory.title}»`;
                } else {
                    media = document.createElement("audio");
                    media.controls = true;
                }

                media.className = "admin-memory-media";
                media.src = objectUrl;
                button.replaceWith(media);
            } catch (_) {
                button.disabled = false;
                button.textContent = "Allegato non disponibile";
            }
        });

        return button;
    }

    function memoryActionButton(id, action, label) {
        const button = document.createElement("button");
        button.className = "admin-action";
        button.type = "button";
        button.textContent = label;

        button.addEventListener("click", async () => {
            button.disabled = true;

            try {
                await request(`/api/admin/memories/${id}`, {
                    method: "PATCH",
                    body: JSON.stringify({ action })
                });
                await Promise.all([loadMemories(), loadSummary()]);
            } catch (_) {
                statusText.textContent =
                    "Non è stato possibile aggiornare la memoria.";
                button.disabled = false;
            }
        });

        return button;
    }

    function render(messages) {
        list.replaceChildren();

        if (!messages.length) {
            showListMessage("Nessun messaggio.");
            return;
        }

        messages.forEach((message) => {
            const article = document.createElement("article");
            article.className = "admin-message";

            const title = document.createElement("h2");
            title.textContent =
                `${message.senderAddress} → ${message.recipientAddress}`;

            const type = document.createElement("p");
            type.className = "admin-meta";
            type.textContent =
                message.deliveryType === "physical"
                    ? "Consegna: lettera fisica"
                    : "Consegna: online";

            const sender = document.createElement("p");
            sender.className = "admin-meta";
            sender.textContent =
                message.revealSender
                    ? "Il destinatario vedrà la location del mittente."
                    : "Il mittente resterà anonimo al destinatario.";

            const archive = document.createElement("p");
            archive.className = "admin-meta admin-archive-meta";
            archive.textContent = archiveStatusText(message);

            const state = document.createElement("p");
            state.className = "admin-meta";
            state.textContent = `Stato: ${message.status}`;

            const date = document.createElement("p");
            date.className = "admin-meta";
            date.textContent =
                new Date(message.createdAt).toLocaleString("it-IT");

            const text = document.createElement("p");
            text.textContent = message.text;

            const actions = document.createElement("div");
            actions.className = "admin-actions";

            if (
                message.deliveryType === "online" &&
                message.status === "pending"
            ) {
                actions.appendChild(
                    actionButton(message.id, "approve", "Approva")
                );
            }

            if (
                message.deliveryType === "physical" &&
                message.status === "pending_delivery"
            ) {
                actions.appendChild(
                    actionButton(message.id, "delivered", "Segna consegnata")
                );
            }

            if (
                ["pending", "pending_delivery"].includes(message.status)
            ) {
                actions.appendChild(
                    actionButton(message.id, "reject", "Rifiuta")
                );
            }

            if (
                message.deliveryType === "online" &&
                ["approved", "read"].includes(message.status) &&
                message.senderPublicConsent &&
                message.recipientPublicConsent &&
                !message.isPublic
            ) {
                actions.appendChild(
                    actionButton(message.id, "publish", "Pubblica nell’archivio")
                );
            }

            if (message.isPublic) {
                actions.appendChild(
                    actionButton(message.id, "unpublish", "Rimuovi dall’archivio")
                );
            }

            article.append(
                title,
                type,
                sender,
                archive,
                state,
                date,
                text,
                actions
            );

            list.appendChild(article);
        });
    }

    function archiveStatusText(message) {
        if (message.deliveryType !== "online") {
            return "Archivio pubblico: non previsto per la consegna fisica.";
        }

        if (message.isPublic) {
            return "Archivio pubblico: pubblicato.";
        }

        if (message.senderPublicConsent && message.recipientPublicConsent) {
            return "Archivio pubblico: entrambi i consensi ricevuti.";
        }

        if (message.senderPublicConsent) {
            return "Archivio pubblico: manca il consenso del destinatario.";
        }

        return "Archivio pubblico: il mittente non ha dato il consenso.";
    }

    function actionButton(id, action, label) {
        const button = document.createElement("button");
        button.className = "admin-action";
        button.type = "button";
        button.textContent = label;

        button.addEventListener("click", async () => {
            button.disabled = true;

            try {
                await request(`/api/admin/messages/${id}`, {
                    method: "PATCH",
                    body: JSON.stringify({ action })
                });

                await loadMessages();
            } catch (_) {
                statusText.textContent =
                    "Non è stato possibile aggiornare il messaggio.";
            } finally {
                button.disabled = false;
            }
        });

        return button;
    }

    async function downloadExport(format) {
        const button = format === "json" ? exportJson : exportCsv;
        const extension = format === "json" ? "json" : "csv";

        button.disabled = true;
        exportStatus.textContent = "Preparazione dell’esportazione…";

        try {
            const response = await fetch(
                `${api.baseUrl}/api/admin/export?format=${format}`,
                {
                    headers: {
                        "X-Admin-Token": adminToken,
                        "Accept": format === "json"
                            ? "application/json"
                            : "text/csv"
                    }
                }
            );

            if (!response.ok) {
                const error = await response.json().catch(() => null);
                throw new Error(error?.error || "Esportazione non riuscita.");
            }

            const blob = await response.blob();
            const objectUrl = URL.createObjectURL(blob);
            const link = document.createElement("a");
            const date = new Date().toISOString().slice(0, 10);

            link.href = objectUrl;
            link.download = `nnmrcn-messaggi-${date}.${extension}`;
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
            exportStatus.textContent = "Esportazione completata.";
        } catch (error) {
            exportStatus.textContent =
                error.message || "Non è stato possibile esportare i messaggi.";
        } finally {
            button.disabled = false;
        }
    }

    function ensureMapEntryPicker() {
        const mapContainer = document.getElementById("adminMapEntryMap");

        if (!window.L || !mapContainer) {
            return;
        }

        if (mapEntryMap) {
            refreshMapEntryPickerSize();
            return;
        }

        mapEntryMap = L.map("adminMapEntryMap", {
            scrollWheelZoom: true
        }).setView([45.5515, 12.3278], 13);

        L.tileLayer(
            "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
            {
                maxZoom: 19,
                attribution:
                    '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap contributors</a>'
            }
        ).addTo(mapEntryMap);

        mapEntryMap.on("click", (event) => {
            setMapEntryPosition(event.latlng.lat, event.latlng.lng, false);
        });

        if ("ResizeObserver" in window) {
            mapEntryResizeObserver = new ResizeObserver(() => {
                mapEntryMap.invalidateSize({ pan: false });
            });
            mapEntryResizeObserver.observe(mapContainer);
        }

        refreshMapEntryPickerSize();
    }

    function refreshMapEntryPickerSize() {
        if (!mapEntryMap) {
            return;
        }

        window.requestAnimationFrame(() => {
            window.requestAnimationFrame(() => {
                mapEntryMap.invalidateSize({ pan: false });
            });
        });
    }

    function setMapEntryPosition(lat, lon, recenter = true) {
        if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
            return;
        }

        mapEntryLat.value = lat.toFixed(6);
        mapEntryLon.value = lon.toFixed(6);

        if (!mapEntryMap) {
            return;
        }

        if (!mapEntryMarker) {
            mapEntryMarker = L.circleMarker([lat, lon], {
                radius: 9,
                color: "#171717",
                weight: 2,
                fillColor: "#f4f1e8",
                fillOpacity: 0.95
            }).addTo(mapEntryMap);
        } else {
            mapEntryMarker.setLatLng([lat, lon]);
        }

        if (recenter) {
            mapEntryMap.setView([lat, lon], Math.max(mapEntryMap.getZoom(), 15));
        }
    }

    function syncMapEntryPositionFromInputs() {
        setMapEntryPosition(
            Number(mapEntryLat.value),
            Number(mapEntryLon.value),
            true
        );
    }

    async function loadMapEntries() {
        ensureMapEntryPicker();
        mapEntryList.replaceChildren(document.createTextNode("Caricamento…"));

        try {
            const [data, wikiData] = await Promise.all([
                request("/api/admin/map-entries"),
                api.request("/api/public/wiki").catch(() => ({ entries: [] }))
            ]);
            wikiSlugsByTitle = new Map(
                (wikiData.entries || []).map((entry) => [
                    normalizedMapEntryTitle(entry.title),
                    entry.slug
                ])
            );
            renderMapEntries(data.entries || []);
        } catch (error) {
            mapEntryList.textContent =
                error.message || "Non è stato possibile caricare i luoghi.";
        }
    }

    function renderMapEntries(entries) {
        mapEntryList.replaceChildren();

        if (!entries.length) {
            const message = document.createElement("p");
            message.textContent = "L’elenco è vuoto.";
            mapEntryList.appendChild(message);
            return;
        }

        entries.forEach((entry) => {
            const article = document.createElement("article");
            const title = document.createElement("h3");
            const category = document.createElement("p");
            const description = document.createElement("p");
            const coordinates = document.createElement("p");
            const actions = document.createElement("div");
            const showButton = document.createElement("button");
            const openLink = document.createElement("a");
            const copyButton = document.createElement("button");
            const editButton = document.createElement("button");
            const deleteButton = document.createElement("button");

            article.className = "admin-message admin-map-entry";
            title.textContent = entry.name;
            category.className = "admin-meta";
            category.textContent = mapEntryCategoryLabel(entry.category);
            description.textContent = entry.description || "Nessuna descrizione.";
            coordinates.className = "admin-meta";
            coordinates.textContent = `${entry.lat.toFixed(6)}, ${entry.lon.toFixed(6)}`;
            actions.className = "admin-actions";
            showButton.type = "button";
            showButton.className = "admin-action";
            showButton.textContent = "Mostra nella cartina";
            showButton.addEventListener("click", () => {
                setMapEntryPosition(entry.lat, entry.lon, true);
                document.getElementById("adminMapEntryMap").scrollIntoView({
                    behavior: "smooth",
                    block: "center"
                });
            });

            openLink.className = "admin-action";
            openLink.href = mapEntryQrUrl(entry);
            openLink.target = "_blank";
            openLink.rel = "noopener noreferrer";
            openLink.textContent = "Apri link QR";

            copyButton.type = "button";
            copyButton.className = "admin-action";
            copyButton.textContent = "Copia link QR";
            copyButton.addEventListener("click", async () => {
                const originalText = copyButton.textContent;

                copyButton.disabled = true;

                try {
                    await copyText(mapEntryQrUrl(entry));
                    copyButton.textContent = "Link copiato";
                    mapEntryStatus.textContent =
                        `Link per il QR di «${entry.name}» copiato.`;
                } catch (_) {
                    mapEntryStatus.textContent =
                        "Non è stato possibile copiare il link. Aprilo e copialo dalla barra del browser.";
                } finally {
                    window.setTimeout(() => {
                        copyButton.textContent = originalText;
                        copyButton.disabled = false;
                    }, 1600);
                }
            });

            editButton.type = "button";
            editButton.className = "admin-action";
            editButton.textContent = "Modifica o sposta";
            editButton.addEventListener("click", () => {
                startMapEntryEdit(entry);
            });

            deleteButton.type = "button";
            deleteButton.className = "admin-action admin-action-danger";
            deleteButton.textContent = "Elimina";
            deleteButton.addEventListener("click", () => {
                deleteMapEntry(entry, deleteButton);
            });

            actions.append(
                showButton,
                openLink,
                copyButton,
                editButton,
                deleteButton
            );

            article.append(
                title,
                category,
                description,
                coordinates,
                actions
            );
            mapEntryList.appendChild(article);
        });
    }

    function normalizedMapEntryTitle(value) {
        return String(value || "")
            .replace(/[«»“”"']/g, "")
            .replace(/\s+/g, " ")
            .trim()
            .toLocaleLowerCase("it");
    }

    function mapEntryQrUrl(entry) {
        const wikiSlug = wikiSlugsByTitle.get(
            normalizedMapEntryTitle(entry.name)
        );

        if (wikiSlug) {
            const wikiUrl = new URL("./voci.html", document.baseURI);

            wikiUrl.hash = encodeURIComponent(wikiSlug);
            return wikiUrl.href;
        }

        const url = new URL("./progetto.html", document.baseURI);

        url.searchParams.set("luogo", String(entry.id));
        url.hash = "map";
        return url.href;
    }

    async function copyText(value) {
        if (navigator.clipboard?.writeText) {
            await navigator.clipboard.writeText(value);
            return;
        }

        const field = document.createElement("textarea");

        field.value = value;
        field.setAttribute("readonly", "");
        field.style.position = "fixed";
        field.style.opacity = "0";
        document.body.appendChild(field);
        field.select();

        const copied = document.execCommand("copy");
        field.remove();

        if (!copied) {
            throw new Error("Copia non disponibile.");
        }
    }

    function mapEntryCategoryLabel(category) {
        const labels = {
            luogo: "Luogo",
            edificio: "Edificio",
            monumento: "Monumento",
            infrastruttura: "Infrastruttura",
            paesaggio: "Paesaggio",
            corso_d_acqua: "Corso d’acqua",
            cava: "Cava",
            percorso: "Percorso"
        };

        return labels[category] || "Luogo";
    }

    function mapEntryInput() {
        return {
            name: mapEntryName.value,
            category: mapEntryCategory.value,
            description: mapEntryDescription.value,
            lat: Number(mapEntryLat.value),
            lon: Number(mapEntryLon.value),
            sourceUrl: mapEntrySourceUrl.value,
            sourceLabel: mapEntrySourceLabel.value
        };
    }

    function resetMapEntryForm() {
        editingMapEntryId = null;
        mapEntryForm.reset();
        mapEntryCategory.value = "luogo";
        mapEntryLat.value = "";
        mapEntryLon.value = "";
        mapEntrySubmit.textContent = "Aggiungi alla mappa";
        mapEntryCancel.hidden = true;

        if (mapEntryMarker && mapEntryMap) {
            mapEntryMap.removeLayer(mapEntryMarker);
            mapEntryMarker = null;
        }
    }

    function startMapEntryEdit(entry) {
        editingMapEntryId = entry.id;
        mapEntryName.value = entry.name;
        mapEntryCategory.value = entry.category;
        mapEntryDescription.value = entry.description || "";
        mapEntrySourceUrl.value = entry.sourceUrl || "";
        mapEntrySourceLabel.value = entry.sourceLabel || "";
        mapEntrySubmit.textContent = "Salva modifiche";
        mapEntryCancel.hidden = false;
        mapEntryStatus.textContent =
            `Modifica di «${entry.name}». Tocca la cartina per spostarla.`;
        setMapEntryPosition(entry.lat, entry.lon, true);
        mapEntryForm.scrollIntoView({ behavior: "smooth", block: "start" });
        refreshMapEntryPickerSize();
        mapEntryName.focus({ preventScroll: true });
    }

    async function saveMapEntry(event) {
        event.preventDefault();

        mapEntrySubmit.disabled = true;
        mapEntryCancel.disabled = true;
        mapEntryStatus.textContent = editingMapEntryId
            ? "Aggiornamento…"
            : "Salvataggio…";

        try {
            const entryId = editingMapEntryId;
            const path = entryId
                ? `/api/admin/map-entries/${entryId}`
                : "/api/admin/map-entries";

            await request(path, {
                method: entryId ? "PATCH" : "POST",
                body: JSON.stringify(mapEntryInput())
            });

            resetMapEntryForm();
            mapEntryStatus.textContent = entryId
                ? "Voce aggiornata. La nuova posizione è già pubblica."
                : "Voce aggiunta. È già visibile nella mappa pubblica.";
            await loadMapEntries();
            mapEntryName.focus();
        } catch (error) {
            mapEntryStatus.textContent =
                error.message || "Non è stato possibile salvare la voce.";
        } finally {
            mapEntrySubmit.disabled = false;
            mapEntryCancel.disabled = false;
        }
    }

    async function deleteMapEntry(entry, button) {
        const confirmed = window.confirm(
            `Eliminare definitivamente «${entry.name}» dalla mappa pubblica?`
        );

        if (!confirmed) {
            return;
        }

        button.disabled = true;
        mapEntryStatus.textContent = `Eliminazione di «${entry.name}»…`;

        try {
            await request(`/api/admin/map-entries/${entry.id}`, {
                method: "DELETE"
            });

            if (editingMapEntryId === entry.id) {
                resetMapEntryForm();
            }

            mapEntryStatus.textContent =
                `«${entry.name}» è stata eliminata dalla mappa pubblica.`;
            await loadMapEntries();
        } catch (error) {
            button.disabled = false;
            mapEntryStatus.textContent =
                error.message || "Non è stato possibile eliminare la voce.";
        }
    }

    form.addEventListener("submit", async (event) => {
        event.preventDefault();

        adminToken = tokenInput.value.trim();

        if (!adminToken) {
            return;
        }

        sessionStorage.setItem(TOKEN_KEY, adminToken);
        tokenInput.value = "";
        await loadMessages();
    });

    refresh.addEventListener("click", loadMessages);
    filter.addEventListener("change", loadMessages);
    memoryRefresh.addEventListener("click", loadMemories);
    memoryFilter.addEventListener("change", loadMemories);
    search.addEventListener("input", renderCurrentMessages);
    exportCsv.addEventListener("click", () => downloadExport("csv"));
    exportJson.addEventListener("click", () => downloadExport("json"));
    mapEntryForm.addEventListener("submit", saveMapEntry);
    mapEntryCancel.addEventListener("click", () => {
        resetMapEntryForm();
        mapEntryStatus.textContent = "Modifica annullata.";
        mapEntryName.focus();
    });
    mapEntryLat.addEventListener("change", syncMapEntryPositionFromInputs);
    mapEntryLon.addEventListener("change", syncMapEntryPositionFromInputs);
    welcomePreview.addEventListener("click", () => {
        window.NNMRCN_SESSION.showWelcome(
            () => Promise.resolve(),
            { preview: true }
        );
    });

    document.querySelectorAll("[data-admin-filter]").forEach((button) => {
        button.addEventListener("click", () => {
            filter.value = button.dataset.adminFilter;
            loadMessages();
        });
    });

    document.querySelectorAll("[data-admin-memory-filter]").forEach((button) => {
        button.addEventListener("click", () => {
            memoryFilter.value = button.dataset.adminMemoryFilter;
            loadMemories();
            memorySection.scrollIntoView({ behavior: "smooth", block: "start" });
        });
    });

    if (adminToken) {
        loadMessages();
    } else if (!api.baseUrl) {
        statusText.textContent =
            "Backend non ancora collegato in config.js.";
    }
})();
