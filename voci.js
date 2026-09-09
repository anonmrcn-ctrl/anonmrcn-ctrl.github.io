(() => {
    "use strict";

    const api = window.NNMRCN_API;
    const ADMIN_TOKEN_KEY = "nnmrcn_admin_token";

    const elements = {
        search: document.getElementById("vociRicerca"),
        publicStatus: document.getElementById("vociStato"),
        publicIndex: document.getElementById("vociIndice"),
        article: document.getElementById("voceArticolo"),
        admin: document.getElementById("vociAdmin"),
        adminStatus: document.getElementById("vociAdminStato"),
        adminIndex: document.getElementById("vociAdminIndice"),
        newButton: document.getElementById("vociNuova"),
        form: document.getElementById("vociEditorForm"),
        id: document.getElementById("vociEditorId"),
        title: document.getElementById("vociEditorTitolo"),
        slug: document.getElementById("vociEditorSlug"),
        summary: document.getElementById("vociEditorSommario"),
        body: document.getElementById("vociEditorTesto"),
        bodyCounter: document.getElementById("vociEditorContatore"),
        state: document.getElementById("vociEditorStato"),
        previewButton: document.getElementById("vociAnteprimaButton"),
        saveButton: document.getElementById("vociSalvaButton"),
        preview: document.getElementById("vociAnteprima")
    };

    if (!api || Object.values(elements).some((element) => !element)) {
        return;
    }

    let publicEntries = [];
    let adminEntries = [];
    let slugEdited = false;

    elements.search.addEventListener("input", renderPublicIndex);
    elements.newButton.addEventListener("click", resetEditor);
    elements.title.addEventListener("input", syncGeneratedSlug);
    elements.slug.addEventListener("input", () => {
        slugEdited = true;
    });
    elements.body.addEventListener("input", updateBodyCounter);
    elements.previewButton.addEventListener("click", showEditorPreview);
    elements.form.addEventListener("submit", saveEntry);
    elements.article.addEventListener("click", handleInternalLink);
    elements.preview.addEventListener("click", handleInternalLink);
    window.addEventListener("hashchange", loadEntryFromHash);

    document.querySelectorAll("[data-wiki-insert], [data-wiki-before]")
        .forEach((button) => {
            button.addEventListener("click", () => applyFormatting(button));
        });

    updateBodyCounter();
    loadPublicEntries();

    if (sessionStorage.getItem(ADMIN_TOKEN_KEY)) {
        loadAdminEntries();
    }

    async function publicRequest(path) {
        return api.request(path);
    }

    async function adminRequest(path, options = {}) {
        const token = sessionStorage.getItem(ADMIN_TOKEN_KEY) || "";
        const headers = new Headers(options.headers || {});
        headers.set("X-Admin-Token", token);

        return api.request(path, {
            ...options,
            headers
        });
    }

    async function loadPublicEntries() {
        elements.publicStatus.textContent = "Caricamento…";

        try {
            const data = await publicRequest("/api/public/wiki");
            publicEntries = Array.isArray(data.entries) ? data.entries : [];
            renderPublicIndex();
            elements.publicStatus.textContent = publicEntries.length
                ? `${publicEntries.length} ${publicEntries.length === 1 ? "voce pubblicata" : "voci pubblicate"}.`
                : "Nessuna voce è stata ancora pubblicata.";
            loadEntryFromHash();
        } catch (error) {
            elements.publicStatus.textContent =
                error.message || "Non è stato possibile caricare le voci.";
        }
    }

    function renderPublicIndex() {
        const query = elements.search.value
            .trim()
            .toLocaleLowerCase("it");
        const visibleEntries = query
            ? publicEntries.filter((entry) =>
                [entry.title, entry.summary].some((value) =>
                    String(value || "")
                        .toLocaleLowerCase("it")
                        .includes(query)
                )
            )
            : publicEntries;

        elements.publicIndex.replaceChildren();

        if (!visibleEntries.length && publicEntries.length) {
            const empty = document.createElement("p");
            empty.textContent = "Nessuna voce corrisponde alla ricerca.";
            elements.publicIndex.appendChild(empty);
            return;
        }

        visibleEntries.forEach((entry) => {
            const link = document.createElement("a");
            const title = document.createElement("span");

            link.href = `#${entry.slug}`;
            link.dataset.wikiSlug = entry.slug;
            title.textContent = entry.title;
            link.appendChild(title);

            if (entry.summary) {
                const summary = document.createElement("small");
                summary.textContent = entry.summary;
                link.appendChild(summary);
            }

            elements.publicIndex.appendChild(link);
        });
    }

    function loadEntryFromHash() {
        const slug = decodeURIComponent(location.hash.slice(1));

        if (!slug || slug === "editor") {
            return;
        }

        loadPublicEntry(slug);
    }

    async function loadPublicEntry(slug) {
        if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
            return;
        }

        elements.publicStatus.textContent = "Caricamento della voce…";

        try {
            const data = await publicRequest(
                `/api/public/wiki/${encodeURIComponent(slug)}`
            );
            renderEntry(data.entry, elements.article, true);
            elements.article.hidden = false;
            elements.publicStatus.textContent = "";
            elements.article.focus({ preventScroll: true });
            elements.article.scrollIntoView({ behavior: "smooth", block: "start" });
        } catch (error) {
            elements.publicStatus.textContent = error.status === 404
                ? "La voce richiesta non esiste o non è pubblicata."
                : error.message || "Non è stato possibile caricare la voce.";
        }
    }

    function handleInternalLink(event) {
        const link = event.target.closest("[data-wiki-slug]");

        if (!link) {
            return;
        }

        event.preventDefault();
        location.hash = link.dataset.wikiSlug;
    }

    async function loadAdminEntries(selectId = 0) {
        try {
            const data = await adminRequest("/api/admin/wiki");
            adminEntries = Array.isArray(data.entries) ? data.entries : [];
            elements.admin.hidden = false;
            renderAdminIndex();

            if (selectId) {
                const selected = adminEntries.find((entry) =>
                    Number(entry.id) === Number(selectId)
                );

                if (selected) {
                    fillEditor(selected);
                }
            }

            if (location.hash === "#editor") {
                elements.admin.scrollIntoView({ block: "start" });
            }
        } catch (error) {
            if (error.status === 401) {
                sessionStorage.removeItem(ADMIN_TOKEN_KEY);
                elements.admin.hidden = true;
                return;
            }

            elements.admin.hidden = false;
            elements.adminStatus.textContent =
                error.message || "Non è stato possibile aprire l’editor.";
        }
    }

    function renderAdminIndex() {
        const selectedId = Number(elements.id.value || 0);
        elements.adminIndex.replaceChildren();

        if (!adminEntries.length) {
            const empty = document.createElement("p");
            empty.textContent = "Non ci sono ancora voci.";
            elements.adminIndex.appendChild(empty);
            return;
        }

        adminEntries.forEach((entry) => {
            const button = document.createElement("button");
            const title = document.createElement("span");
            const meta = document.createElement("small");

            button.type = "button";
            button.setAttribute(
                "aria-current",
                String(Number(entry.id) === selectedId)
            );
            title.textContent = entry.title;
            meta.textContent = `${entry.status === "published" ? "Pubblicata" : "Bozza"} · revisione ${entry.revisionNumber || 1}`;
            button.append(title, meta);
            button.addEventListener("click", () => fillEditor(entry));
            elements.adminIndex.appendChild(button);
        });
    }

    function fillEditor(entry) {
        elements.id.value = String(entry.id);
        elements.title.value = entry.title || "";
        elements.slug.value = entry.slug || "";
        elements.summary.value = entry.summary || "";
        elements.body.value = entry.body || "";
        elements.state.value = entry.status || "draft";
        elements.preview.hidden = true;
        elements.adminStatus.textContent = `Modifica della revisione ${entry.revisionNumber || 1}.`;
        slugEdited = true;
        updateBodyCounter();
        renderAdminIndex();
        elements.title.focus({ preventScroll: true });
    }

    function resetEditor() {
        elements.form.reset();
        elements.id.value = "";
        elements.state.value = "draft";
        elements.preview.hidden = true;
        elements.adminStatus.textContent = "Nuova voce.";
        slugEdited = false;
        updateBodyCounter();
        renderAdminIndex();
        elements.title.focus();
    }

    function syncGeneratedSlug() {
        if (!slugEdited || !elements.slug.value) {
            elements.slug.value = slugify(elements.title.value);
        }
    }

    function slugify(value) {
        return String(value || "")
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-+|-+$/g, "")
            .slice(0, 160);
    }

    function updateBodyCounter() {
        elements.bodyCounter.textContent =
            `${elements.body.value.length.toLocaleString("it-IT")} / 50.000`;
    }

    function applyFormatting(button) {
        const textarea = elements.body;
        const insertion = button.dataset.wikiInsert;
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;

        if (insertion !== undefined) {
            textarea.setRangeText(insertion, start, end, "end");
        } else {
            const before = button.dataset.wikiBefore || "";
            const after = button.dataset.wikiAfter || "";
            const selected = textarea.value.slice(start, end) ||
                button.dataset.wikiPlaceholder || "";
            const replacement = `${before}${selected}${after}`;

            textarea.setRangeText(replacement, start, end, "select");
            textarea.selectionStart = start + before.length;
            textarea.selectionEnd = start + before.length + selected.length;
        }

        textarea.focus();
        updateBodyCounter();
    }

    function editorEntry() {
        return {
            id: Number(elements.id.value || 0),
            title: elements.title.value.trim(),
            slug: elements.slug.value.trim().toLowerCase(),
            summary: elements.summary.value.trim(),
            body: elements.body.value.trim(),
            status: elements.state.value
        };
    }

    function showEditorPreview() {
        const entry = editorEntry();

        if (!elements.form.reportValidity()) {
            return;
        }

        renderEntry(entry, elements.preview, false);
        elements.preview.hidden = false;
        elements.preview.scrollIntoView({ behavior: "smooth", block: "start" });
    }

    async function saveEntry(event) {
        event.preventDefault();

        if (!elements.form.reportValidity()) {
            return;
        }

        const entry = editorEntry();
        const updating = entry.id > 0;
        const path = updating
            ? `/api/admin/wiki/${entry.id}`
            : "/api/admin/wiki";

        elements.saveButton.disabled = true;
        elements.adminStatus.textContent = "Salvataggio…";

        try {
            const data = await adminRequest(path, {
                method: updating ? "PATCH" : "POST",
                body: JSON.stringify({
                    title: entry.title,
                    slug: entry.slug,
                    summary: entry.summary,
                    body: entry.body,
                    status: entry.status
                })
            });

            elements.adminStatus.textContent = data.entry.status === "published"
                ? "Voce salvata e pubblicata."
                : "Bozza salvata.";
            await Promise.all([
                loadAdminEntries(data.entry.id),
                loadPublicEntries()
            ]);
        } catch (error) {
            elements.adminStatus.textContent =
                error.message || "Non è stato possibile salvare la voce.";
        } finally {
            elements.saveButton.disabled = false;
        }
    }

    function renderEntry(entry, container, showMetadata) {
        const title = document.createElement("h1");
        title.textContent = entry.title || "Senza titolo";
        container.replaceChildren(title);

        if (entry.summary) {
            const summary = document.createElement("p");
            summary.className = "voce-sommario";
            appendInlineMarkup(summary, entry.summary);
            container.appendChild(summary);
        }

        const body = document.createElement("div");
        body.className = "voce-corpo";
        appendBodyMarkup(body, entry.body || "");
        container.appendChild(body);

        if (showMetadata && entry.updatedAt) {
            const metadata = document.createElement("p");
            metadata.className = "voce-metadati";
            metadata.textContent = `Ultima modifica: ${new Intl.DateTimeFormat("it-IT", {
                dateStyle: "long",
                timeStyle: "short"
            }).format(new Date(entry.updatedAt))}`;
            container.appendChild(metadata);
        }
    }

    function appendBodyMarkup(container, source) {
        const lines = String(source || "").split(/\r?\n/);
        let paragraphLines = [];
        let currentList = null;

        const flushParagraph = () => {
            if (!paragraphLines.length) {
                return;
            }

            const paragraph = document.createElement("p");
            appendInlineMarkup(paragraph, paragraphLines.join(" "));
            container.appendChild(paragraph);
            paragraphLines = [];
        };

        lines.forEach((line) => {
            const trimmed = line.trim();
            const heading = /^(#{2,3})\s+(.+)$/.exec(trimmed);
            const listItem = /^[-*]\s+(.+)$/.exec(trimmed);

            if (!trimmed) {
                flushParagraph();
                currentList = null;
                return;
            }

            if (heading) {
                flushParagraph();
                currentList = null;
                const element = document.createElement(
                    heading[1].length === 2 ? "h2" : "h3"
                );
                appendInlineMarkup(element, heading[2]);
                container.appendChild(element);
                return;
            }

            if (listItem) {
                flushParagraph();

                if (!currentList) {
                    currentList = document.createElement("ul");
                    container.appendChild(currentList);
                }

                const item = document.createElement("li");
                appendInlineMarkup(item, listItem[1]);
                currentList.appendChild(item);
                return;
            }

            currentList = null;
            paragraphLines.push(trimmed);
        });

        flushParagraph();
    }

    function appendInlineMarkup(container, source) {
        const pattern = /(\*\*[^*\n]+\*\*|\*[^*\n]+\*|\[\[[^\]\n]+\]\]|\[[^\]\n]+\]\(https?:\/\/[^)\s]+\))/g;
        let cursor = 0;

        for (const match of String(source || "").matchAll(pattern)) {
            container.appendChild(document.createTextNode(
                source.slice(cursor, match.index)
            ));
            container.appendChild(inlineToken(match[0]));
            cursor = match.index + match[0].length;
        }

        container.appendChild(document.createTextNode(source.slice(cursor)));
    }

    function inlineToken(token) {
        if (token.startsWith("**")) {
            const strong = document.createElement("strong");
            strong.textContent = token.slice(2, -2);
            return strong;
        }

        if (token.startsWith("*")) {
            const emphasis = document.createElement("em");
            emphasis.textContent = token.slice(1, -1);
            return emphasis;
        }

        if (token.startsWith("[[")) {
            const [rawSlug, label] = token.slice(2, -2).split("|", 2);
            const slug = slugify(rawSlug);

            if (!slug) {
                return document.createTextNode(label || rawSlug);
            }

            const link = document.createElement("a");
            link.href = `#${slug}`;
            link.dataset.wikiSlug = slug;
            link.textContent = label || rawSlug;
            return link;
        }

        const external = /^\[([^\]]+)\]\((https?:\/\/[^)]+)\)$/.exec(token);

        if (external) {
            const link = document.createElement("a");
            link.href = external[2];
            link.target = "_blank";
            link.rel = "noopener noreferrer";
            link.textContent = external[1];
            return link;
        }

        return document.createTextNode(token);
    }
})();
