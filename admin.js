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

    let adminToken = sessionStorage.getItem(TOKEN_KEY) || "";
    let loadedMessages = [];

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
        } catch (_) {
            [
                countPending,
                countDelivery,
                countPublishable,
                countPublic,
                countContacts
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
    search.addEventListener("input", renderCurrentMessages);
    exportCsv.addEventListener("click", () => downloadExport("csv"));
    exportJson.addEventListener("click", () => downloadExport("json"));

    document.querySelectorAll("[data-admin-filter]").forEach((button) => {
        button.addEventListener("click", () => {
            filter.value = button.dataset.adminFilter;
            loadMessages();
        });
    });

    if (adminToken) {
        loadMessages();
    } else if (!api.baseUrl) {
        statusText.textContent =
            "Backend non ancora collegato in config.js.";
    }
})();
