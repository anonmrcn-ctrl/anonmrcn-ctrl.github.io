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

    let adminToken = sessionStorage.getItem(TOKEN_KEY) || "";

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

            render(data.messages || []);
            panel.hidden = false;
            statusText.textContent = "";
            await loadContactMessages();
            await pushNotifications.sync();
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

                await loadContactMessages();
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

            article.append(
                title,
                type,
                sender,
                state,
                date,
                text,
                actions
            );

            list.appendChild(article);
        });
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

    if (adminToken) {
        loadMessages();
    } else if (!api.baseUrl) {
        statusText.textContent =
            "Backend non ancora collegato in config.js.";
    }
})();
