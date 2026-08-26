(() => {
    "use strict";

    const api = window.NNMRCN_API;
    const list = document.getElementById("archivioLista");
    const status = document.getElementById("archivioStatus");
    const search = document.getElementById("archivioRicerca");
    const loadMore = document.getElementById("archivioAltro");

    let messages = [];
    let nextCursor = null;
    let loading = false;

    async function loadMessages({ append = false } = {}) {
        if (loading) {
            return;
        }

        if (!api.baseUrl) {
            status.textContent = "L’archivio non è ancora collegato al server.";
            return;
        }

        loading = true;
        loadMore.disabled = true;
        status.textContent = append ? "Caricamento…" : "Caricamento dell’archivio…";

        try {
            const cursor = append && nextCursor
                ? `&before=${encodeURIComponent(nextCursor)}`
                : "";
            const data = await api.request(`/api/public/messages?limit=50${cursor}`);

            messages = append
                ? messages.concat(data.messages || [])
                : data.messages || [];
            nextCursor = data.nextCursor || null;
            renderMessages();
        } catch (_) {
            status.textContent = "Non è stato possibile caricare l’archivio.";
        } finally {
            loading = false;
            loadMore.disabled = false;
        }
    }

    function renderMessages() {
        const query = search.value.trim().toLocaleLowerCase("it");
        const visible = query
            ? messages.filter((message) =>
                String(message.text || "").toLocaleLowerCase("it").includes(query)
            )
            : messages;

        list.replaceChildren();

        visible.forEach((message) => {
            const article = document.createElement("article");
            const title = document.createElement("h2");
            const body = document.createElement("p");
            const date = document.createElement("time");

            title.textContent = "Messaggio anonimo";
            body.textContent = message.text;
            date.dateTime = new Date(message.publishedAt).toISOString();
            date.textContent = new Date(message.publishedAt).toLocaleDateString(
                "it-IT",
                { day: "numeric", month: "long", year: "numeric" }
            );

            article.append(title, body, date);
            list.appendChild(article);
        });

        if (!messages.length) {
            status.textContent = "Nessun messaggio è stato pubblicato finora.";
        } else if (!visible.length) {
            status.textContent = "Nessun messaggio corrisponde alla ricerca.";
        } else {
            status.textContent = `${visible.length} ${visible.length === 1 ? "messaggio" : "messaggi"}`;
        }

        loadMore.hidden = !nextCursor || Boolean(query);
    }

    search.addEventListener("input", renderMessages);
    loadMore.addEventListener("click", () => loadMessages({ append: true }));
    loadMessages();
})();
