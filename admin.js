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

    let adminToken = sessionStorage.getItem(TOKEN_KEY) || "";
    let loadedMessages = [];
    let memoryObjectUrls = [];

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
