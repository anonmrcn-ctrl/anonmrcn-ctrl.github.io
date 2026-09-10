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
        wikiLinkButton: document.getElementById("vociAltraVoceButton"),
        wikiLinkPanel: document.getElementById("vociAltraVocePannello"),
        wikiLinkTarget: document.getElementById("vociAltraVoceDestinazione"),
        wikiLinkLabel: document.getElementById("vociAltraVoceTesto"),
        wikiLinkInsert: document.getElementById("vociAltraVoceInserisci"),
        wikiLinkCancel: document.getElementById("vociAltraVoceAnnulla"),
        sourceButton: document.getElementById("vociFonteButton"),
        sourcePanel: document.getElementById("vociFontePannello"),
        sourceTitle: document.getElementById("vociFonteTitolo"),
        sourceAuthor: document.getElementById("vociFonteAutore"),
        sourceDate: document.getElementById("vociFonteData"),
        sourceUrl: document.getElementById("vociFonteUrl"),
        sourceInsert: document.getElementById("vociFonteInserisci"),
        sourceCancel: document.getElementById("vociFonteAnnulla"),
        sourceReuse: document.getElementById("vociFontiRiuso"),
        sourceReuseList: document.getElementById("vociFontiRiusoElenco"),
        photoButton: document.getElementById("vociFotoButton"),
        photoInput: document.getElementById("vociFotoInput"),
        photoSection: document.getElementById("vociFotoSezione"),
        photoList: document.getElementById("vociFotoElenco"),
        photoCounter: document.getElementById("vociFotoContatore"),
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
    let editorImages = [];
    let wikiLinkInsertionRange = { start: 0, end: 0 };
    let sourceInsertionRange = { start: 0, end: 0 };
    let slugEdited = false;
    const adminImageUrls = new Map();
    const MAX_IMAGES = 8;
    const MAX_IMAGE_BYTES = 700000;

    elements.search.addEventListener("input", renderPublicIndex);
    elements.newButton.addEventListener("click", resetEditor);
    elements.title.addEventListener("input", syncGeneratedSlug);
    elements.slug.addEventListener("input", () => {
        slugEdited = true;
    });
    elements.body.addEventListener("input", () => {
        updateBodyCounter();

        if (!elements.sourcePanel.hidden) {
            renderSourceReuseList();
        }
    });
    elements.wikiLinkButton.addEventListener("click", openWikiLinkPanel);
    elements.wikiLinkTarget.addEventListener("change", syncWikiLinkLabel);
    elements.wikiLinkInsert.addEventListener("click", insertWikiLink);
    elements.wikiLinkCancel.addEventListener("click", closeWikiLinkPanel);
    elements.wikiLinkPanel.addEventListener("keydown", (event) => {
        if (event.key === "Escape") {
            event.preventDefault();
            closeWikiLinkPanel();
            elements.wikiLinkButton.focus();
        } else if (event.key === "Enter") {
            event.preventDefault();
            insertWikiLink();
        }
    });
    elements.sourceButton.addEventListener("click", openSourcePanel);
    elements.sourceInsert.addEventListener("click", insertSource);
    elements.sourceCancel.addEventListener("click", closeSourcePanel);
    elements.sourcePanel.addEventListener("keydown", (event) => {
        if (event.key === "Escape") {
            event.preventDefault();
            closeSourcePanel();
            elements.sourceButton.focus();
        } else if (event.key === "Enter") {
            event.preventDefault();
            insertSource();
        }
    });
    elements.photoButton.addEventListener("click", () => {
        elements.photoInput.click();
    });
    elements.photoInput.addEventListener("change", addSelectedPhotos);
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

            const preview = publicSummaryPreview(entry.summary);

            if (preview) {
                const summary = document.createElement("small");
                summary.textContent = preview;
                link.appendChild(summary);
            }

            elements.publicIndex.appendChild(link);
        });
    }

    function publicSummaryPreview(value) {
        return String(value || "")
            .replace(/\[fonte:[^\]\n]+\]/gi, "")
            .replace(/\[foto:[0-9a-f-]{36}\]/gi, "")
            .replace(/\[\[([^\]\n|]+)\|([^\]\n]+)\]\]/g, "$2")
            .replace(/\[\[([^\]\n]+)\]\]/g, "$1")
            .replace(/\[\d+\]\(https?:\/\/[^)\s]+\)/gi, "")
            .replace(/\[([^\]\n]+)\]\(https?:\/\/[^)\s]+\)/gi, "$1")
            .replace(/\*\*([^*\n]+)\*\*/g, "$1")
            .replace(/\*([^*\n]+)\*/g, "$1")
            .replace(/^#{2,3}\s+/gm, "")
            .replace(/^[-*]\s+/gm, "")
            .replace(/\s+/g, " ")
            .trim();
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
        const headingLink = event.target.closest("[data-wiki-heading]");

        if (headingLink) {
            event.preventDefault();
            const heading = document.getElementById(
                headingLink.dataset.wikiHeading
            );

            if (heading) {
                heading.scrollIntoView({ block: "start" });
                heading.focus({ preventScroll: true });
            }

            return;
        }

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
        clearEditorImageUrls();
        closeWikiLinkPanel();
        closeSourcePanel();
        elements.id.value = String(entry.id);
        elements.title.value = entry.title || "";
        elements.slug.value = entry.slug || "";
        elements.summary.value = entry.summary || "";
        elements.body.value = entry.body || "";
        elements.state.value = entry.status || "draft";
        elements.preview.hidden = true;
        elements.adminStatus.textContent = `Modifica della revisione ${entry.revisionNumber || 1}.`;
        editorImages = (entry.images || []).map((image) => ({
            ...image,
            data: "",
            previewUrl: ""
        }));
        slugEdited = true;
        updateBodyCounter();
        renderPhotoManager();
        loadEditorImagePreviews();
        renderAdminIndex();
        elements.title.focus({ preventScroll: true });
    }

    function resetEditor() {
        clearEditorImageUrls();
        closeWikiLinkPanel();
        closeSourcePanel();
        elements.form.reset();
        elements.id.value = "";
        elements.state.value = "draft";
        elements.preview.hidden = true;
        elements.adminStatus.textContent = "Nuova voce.";
        editorImages = [];
        slugEdited = false;
        updateBodyCounter();
        renderPhotoManager();
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
        const insertion = toolbarValue(button.dataset.wikiInsert);
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;

        if (insertion !== undefined) {
            textarea.setRangeText(insertion, start, end, "end");
        } else {
            const before = toolbarValue(button.dataset.wikiBefore) || "";
            const after = toolbarValue(button.dataset.wikiAfter) || "";
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

    function toolbarValue(value) {
        return value === undefined ? undefined : value.replace(/\\n/g, "\n");
    }

    function openWikiLinkPanel() {
        if (!elements.wikiLinkPanel.hidden) {
            closeWikiLinkPanel();
            return;
        }

        wikiLinkInsertionRange = {
            start: elements.body.selectionStart,
            end: elements.body.selectionEnd
        };
        const selectedText = elements.body.value
            .slice(wikiLinkInsertionRange.start, wikiLinkInsertionRange.end)
            .trim();

        closeSourcePanel();
        elements.wikiLinkTarget.replaceChildren();
        const currentId = Number(elements.id.value || 0);
        const availableEntries = publicEntries.filter(
            (entry) => Number(entry.id) !== currentId
        );

        availableEntries.forEach((entry) => {
            const option = document.createElement("option");
            option.value = entry.slug;
            option.textContent = entry.title;
            elements.wikiLinkTarget.appendChild(option);
        });

        const matchingEntry = availableEntries.find((entry) =>
            entry.title.toLocaleLowerCase("it") ===
                selectedText.toLocaleLowerCase("it") ||
            entry.slug === slugify(selectedText)
        );

        if (matchingEntry) {
            elements.wikiLinkTarget.value = matchingEntry.slug;
        }

        if (!availableEntries.length) {
            const empty = document.createElement("option");
            empty.textContent = "Nessun’altra voce pubblicata";
            empty.value = "";
            elements.wikiLinkTarget.appendChild(empty);
        }

        elements.wikiLinkLabel.value = selectedText ||
            elements.wikiLinkTarget.selectedOptions[0]?.textContent || "";
        elements.wikiLinkInsert.disabled = !availableEntries.length;
        elements.wikiLinkPanel.hidden = false;
        elements.wikiLinkButton.setAttribute("aria-expanded", "true");
        elements.wikiLinkTarget.focus();
    }

    function syncWikiLinkLabel() {
        elements.wikiLinkLabel.value =
            elements.wikiLinkTarget.selectedOptions[0]?.textContent || "";
        elements.wikiLinkLabel.setCustomValidity("");
    }

    function closeWikiLinkPanel() {
        elements.wikiLinkPanel.hidden = true;
        elements.wikiLinkButton.setAttribute("aria-expanded", "false");
        elements.wikiLinkTarget.replaceChildren();
        elements.wikiLinkLabel.value = "";
        elements.wikiLinkLabel.setCustomValidity("");
    }

    function insertWikiLink() {
        const slug = elements.wikiLinkTarget.value;
        const label = elements.wikiLinkLabel.value.trim();
        elements.wikiLinkLabel.setCustomValidity("");

        if (!slug) {
            return;
        }

        if (!label) {
            elements.wikiLinkLabel.setCustomValidity(
                "Inserisci il testo visibile del collegamento."
            );
            elements.wikiLinkLabel.reportValidity();
            return;
        }

        if (/[\[\]|]/.test(label)) {
            elements.wikiLinkLabel.setCustomValidity(
                "Il testo non può contenere parentesi quadre o il carattere |."
            );
            elements.wikiLinkLabel.reportValidity();
            return;
        }

        elements.body.setRangeText(
            `[[${slug}|${label}]]`,
            wikiLinkInsertionRange.start,
            wikiLinkInsertionRange.end,
            "end"
        );
        closeWikiLinkPanel();
        elements.body.focus();
        updateBodyCounter();
        elements.adminStatus.textContent =
            `Collegamento inserito verso «${label}».`;
    }

    function openSourcePanel() {
        if (!elements.sourcePanel.hidden) {
            closeSourcePanel();
            return;
        }

        closeWikiLinkPanel();
        sourceInsertionRange = {
            start: elements.body.selectionEnd,
            end: elements.body.selectionEnd
        };
        elements.sourcePanel.hidden = false;
        elements.sourceButton.setAttribute("aria-expanded", "true");
        renderSourceReuseList();
        elements.sourceTitle.focus();
    }

    function closeSourcePanel() {
        elements.sourcePanel.hidden = true;
        elements.sourceButton.setAttribute("aria-expanded", "false");
        elements.sourceTitle.value = "";
        elements.sourceAuthor.value = "";
        elements.sourceDate.value = "";
        elements.sourceUrl.value = "";
        elements.sourceTitle.setCustomValidity("");
        elements.sourceUrl.setCustomValidity("");
    }

    function insertSource() {
        const title = elements.sourceTitle.value.trim();
        const author = elements.sourceAuthor.value.trim();
        const date = elements.sourceDate.value.trim();
        let url = elements.sourceUrl.value.trim();

        elements.sourceTitle.setCustomValidity("");
        elements.sourceUrl.setCustomValidity("");

        if (!title) {
            elements.sourceTitle.setCustomValidity("Inserisci il titolo della fonte.");
            elements.sourceTitle.reportValidity();
            return;
        }

        if (url && !/^https?:\/\//i.test(url)) {
            url = `https://${url}`;
        }

        if (url) {
            try {
                const parsed = new URL(url);

                if (!["http:", "https:"].includes(parsed.protocol)) {
                    throw new Error("protocol");
                }

                url = parsed.href;
            } catch (_) {
                elements.sourceUrl.setCustomValidity(
                    "Inserisci un collegamento web valido."
                );
                elements.sourceUrl.reportValidity();
                return;
            }
        }

        const token = `[fonte:${[url, title, author, date]
            .map((part) => encodeURIComponent(part))
            .join("|")}]`;
        insertSourceToken(
            token,
            "Fonte inserita. La numerazione e l’elenco finale saranno creati automaticamente."
        );
    }

    function insertSourceToken(token, message) {
        elements.body.setRangeText(
            token,
            sourceInsertionRange.start,
            sourceInsertionRange.end,
            "end"
        );
        closeSourcePanel();
        elements.body.focus();
        updateBodyCounter();
        elements.adminStatus.textContent = message;
    }

    function renderSourceReuseList() {
        const sources = sourceTokensInEditor();
        elements.sourceReuseList.replaceChildren();
        elements.sourceReuse.hidden = !sources.length;

        sources.forEach(({ token, source, occurrences }) => {
            const row = document.createElement("div");
            row.className = "voci-fonte-riuso-scheda";
            const description = document.createElement("div");
            const title = document.createElement("strong");
            title.textContent = source.title;
            description.appendChild(title);
            const details = [source.author, source.date]
                .filter(Boolean)
                .join(" · ");
            const metadata = document.createElement("small");
            metadata.textContent = [
                details,
                `${occurrences} ${occurrences === 1 ? "richiamo" : "richiami"}`
            ].filter(Boolean).join(" · ");
            description.appendChild(metadata);
            const reuseButton = document.createElement("button");
            reuseButton.type = "button";
            reuseButton.textContent = "Cita di nuovo";
            reuseButton.addEventListener("click", () => {
                insertSourceToken(
                    token,
                    `Nuovo richiamo inserito per «${source.title}».`
                );
            });
            row.append(description, reuseButton);
            elements.sourceReuseList.appendChild(row);
        });
    }

    function sourceTokensInEditor() {
        const sources = new Map();
        const pattern = /\[fonte:[^\]\n]+\]/g;

        for (const match of elements.body.value.matchAll(pattern)) {
            const source = parseSourceToken(match[0]);

            if (!source) {
                continue;
            }

            const key = JSON.stringify(source);
            const existing = sources.get(key);

            if (existing) {
                existing.occurrences += 1;
            } else {
                sources.set(key, {
                    token: match[0],
                    source,
                    occurrences: 1
                });
            }
        }

        return Array.from(sources.values());
    }

    async function addSelectedPhotos() {
        const files = Array.from(elements.photoInput.files || []);
        elements.photoInput.value = "";

        if (!files.length) {
            return;
        }

        if (editorImages.length + files.length > MAX_IMAGES) {
            elements.adminStatus.textContent =
                `Ogni voce può contenere al massimo ${MAX_IMAGES} fotografie.`;
            return;
        }

        elements.photoButton.disabled = true;
        elements.adminStatus.textContent = files.length === 1
            ? "Preparazione della fotografia…"
            : "Preparazione delle fotografie…";

        const photos = [];

        try {

            for (const file of files) {
                photos.push(await preparePhoto(file));
            }

            editorImages.push(...photos);
            insertPhotoTokens(photos.map((photo) => photo.id));
            renderPhotoManager();
            elements.adminStatus.textContent = files.length === 1
                ? "Fotografia inserita. Aggiungi il testo alternativo prima di salvare."
                : "Fotografie inserite. Aggiungi i testi alternativi prima di salvare.";

            const firstAlt = elements.photoList.querySelector(
                `[data-photo-id="${photos[0].id}"] input[data-photo-field="alt"]`
            );
            firstAlt?.focus();
        } catch (error) {
            photos.forEach((photo) => {
                if (photo.previewUrl) {
                    URL.revokeObjectURL(photo.previewUrl);
                }
            });
            elements.adminStatus.textContent =
                error.message || "Non è stato possibile preparare la fotografia.";
        } finally {
            elements.photoButton.disabled = editorImages.length >= MAX_IMAGES;
        }
    }

    async function preparePhoto(file) {
        if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
            throw new Error("Formato non supportato. Usa JPEG, PNG o WebP.");
        }

        let blob = await resizePhoto(file, 1600, 0.8);

        if (blob.size > MAX_IMAGE_BYTES) {
            blob = await resizePhoto(file, 1200, 0.66);
        }

        if (blob.size > MAX_IMAGE_BYTES) {
            blob = await resizePhoto(file, 900, 0.55);
        }

        if (!blob.size || blob.size > MAX_IMAGE_BYTES) {
            throw new Error("La fotografia resta troppo grande dopo la riduzione automatica.");
        }

        return {
            id: photoId(),
            name: file.name || "fotografia",
            type: blob.type,
            alt: "",
            caption: "",
            data: await blobToBase64(blob),
            previewUrl: URL.createObjectURL(blob),
            mediaUrl: "",
            adminMediaUrl: ""
        };
    }

    async function resizePhoto(file, maxDimension, quality) {
        const image = await loadPhoto(file);
        const scale = Math.min(
            1,
            maxDimension / Math.max(image.width, image.height)
        );
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(image.width * scale));
        canvas.height = Math.max(1, Math.round(image.height * scale));
        const context = canvas.getContext("2d", { alpha: true });

        if (!context) {
            throw new Error("Il browser non può elaborare questa fotografia.");
        }

        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        const webpSupported = canvas
            .toDataURL("image/webp", 0.1)
            .startsWith("data:image/webp");
        const outputType = webpSupported ? "image/webp" : "image/jpeg";
        const blob = await new Promise((resolve) => {
            canvas.toBlob(resolve, outputType, quality);
        });

        if (!blob) {
            throw new Error("Non è stato possibile preparare la fotografia.");
        }

        return blob;
    }

    function loadPhoto(file) {
        return new Promise((resolve, reject) => {
            const source = URL.createObjectURL(file);
            const image = new Image();

            image.onload = () => {
                URL.revokeObjectURL(source);
                resolve(image);
            };
            image.onerror = () => {
                URL.revokeObjectURL(source);
                reject(new Error("La fotografia selezionata non è leggibile."));
            };
            image.src = source;
        });
    }

    function blobToBase64(blob) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
                const value = String(reader.result || "");
                resolve(value.slice(value.indexOf(",") + 1));
            };
            reader.onerror = () => reject(
                new Error("Non è stato possibile leggere la fotografia.")
            );
            reader.readAsDataURL(blob);
        });
    }

    function photoId() {
        if (typeof crypto.randomUUID === "function") {
            return crypto.randomUUID();
        }

        const bytes = crypto.getRandomValues(new Uint8Array(16));
        bytes[6] = (bytes[6] & 0x0f) | 0x40;
        bytes[8] = (bytes[8] & 0x3f) | 0x80;
        const hex = Array.from(bytes, (byte) =>
            byte.toString(16).padStart(2, "0")
        ).join("");
        return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
    }

    function insertPhotoTokens(ids) {
        const token = ids.map((id) => `[foto:${id}]`).join("\n\n");
        const start = elements.body.selectionStart;
        const end = elements.body.selectionEnd;
        const before = start > 0 && elements.body.value[start - 1] !== "\n"
            ? "\n\n"
            : "";
        const after = end < elements.body.value.length && elements.body.value[end] !== "\n"
            ? "\n\n"
            : "";
        elements.body.setRangeText(`${before}${token}${after}`, start, end, "end");
        updateBodyCounter();
    }

    function renderPhotoManager() {
        elements.photoSection.hidden = !editorImages.length;
        elements.photoCounter.textContent = `${editorImages.length} / ${MAX_IMAGES}`;
        elements.photoButton.disabled = editorImages.length >= MAX_IMAGES;
        elements.photoList.replaceChildren();

        editorImages.forEach((photo) => {
            const card = document.createElement("article");
            card.className = "voci-foto-scheda";
            card.dataset.photoId = photo.id;

            const image = document.createElement("img");
            image.className = "voci-foto-immagine";
            image.alt = photo.alt || "Anteprima della fotografia";

            if (photo.previewUrl) {
                image.src = photo.previewUrl;
            }

            const fields = document.createElement("div");
            fields.className = "voci-foto-campi";
            const altLabel = document.createElement("label");
            altLabel.textContent = "Testo alternativo";
            const alt = document.createElement("input");
            alt.id = `voci-foto-alt-${photo.id}`;
            altLabel.htmlFor = alt.id;
            alt.type = "text";
            alt.required = true;
            alt.maxLength = 300;
            alt.value = photo.alt;
            alt.dataset.photoField = "alt";
            alt.addEventListener("input", () => {
                photo.alt = alt.value;
                image.alt = alt.value || "Anteprima della fotografia";
            });

            const captionLabel = document.createElement("label");
            captionLabel.textContent = "Didascalia (facoltativa)";
            const caption = document.createElement("input");
            caption.id = `voci-foto-caption-${photo.id}`;
            captionLabel.htmlFor = caption.id;
            caption.type = "text";
            caption.maxLength = 500;
            caption.value = photo.caption;
            caption.dataset.photoField = "caption";
            caption.addEventListener("input", () => {
                photo.caption = caption.value;
            });

            const actions = document.createElement("div");
            actions.className = "voci-foto-azioni";
            const insert = document.createElement("button");
            insert.type = "button";
            insert.textContent = "Inserisci nel testo";
            insert.addEventListener("click", () => insertPhotoTokens([photo.id]));
            const remove = document.createElement("button");
            remove.type = "button";
            remove.textContent = "Rimuovi";
            remove.addEventListener("click", () => removePhoto(photo.id));
            actions.append(insert, remove);
            fields.append(altLabel, alt, captionLabel, caption, actions);
            card.append(image, fields);
            elements.photoList.appendChild(card);
        });
    }

    function removePhoto(id) {
        const photo = editorImages.find((item) => item.id === id);

        if (photo?.previewUrl) {
            URL.revokeObjectURL(photo.previewUrl);
        }

        adminImageUrls.delete(id);
        editorImages = editorImages.filter((item) => item.id !== id);
        elements.body.value = elements.body.value
            .replace(new RegExp(`\\n?\\[foto:${id}\\]\\n?`, "g"), "\n")
            .replace(/\n{3,}/g, "\n\n")
            .trim();
        updateBodyCounter();
        renderPhotoManager();
    }

    async function loadEditorImagePreviews() {
        await Promise.all(editorImages.map(async (photo) => {
            if (photo.previewUrl || !photo.adminMediaUrl) {
                return;
            }

            try {
                const token = sessionStorage.getItem(ADMIN_TOKEN_KEY) || "";
                const response = await fetch(`${api.baseUrl}${photo.adminMediaUrl}`, {
                    headers: { "X-Admin-Token": token }
                });

                if (!response.ok) {
                    return;
                }

                const url = URL.createObjectURL(await response.blob());
                photo.previewUrl = url;
                adminImageUrls.set(photo.id, url);
            } catch (_) {
                // The editor stays usable if a thumbnail cannot be loaded.
            }
        }));

        renderPhotoManager();
    }

    function clearEditorImageUrls() {
        const urls = new Set([
            ...editorImages.map((photo) => photo.previewUrl),
            ...adminImageUrls.values()
        ]);

        urls.forEach((url) => {
            if (url) {
                URL.revokeObjectURL(url);
            }
        });
        adminImageUrls.clear();
    }

    function editorEntry() {
        const body = elements.body.value.trim();
        const images = editorImages
            .filter((photo) => body.includes(`[foto:${photo.id}]`))
            .map((photo) => ({
                id: photo.id,
                name: photo.name,
                type: photo.type,
                alt: photo.alt.trim(),
                caption: photo.caption.trim(),
                data: photo.data || ""
            }));

        return {
            id: Number(elements.id.value || 0),
            title: elements.title.value.trim(),
            slug: elements.slug.value.trim().toLowerCase(),
            summary: elements.summary.value.trim(),
            body,
            status: elements.state.value,
            images
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
                    status: entry.status,
                    images: entry.images
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
        const citations = createCitationContext(container.id || "voce");
        const title = document.createElement("h1");
        title.textContent = entry.title || "Senza titolo";
        container.replaceChildren(title);

        if (entry.summary) {
            const summary = document.createElement("p");
            summary.className = "voce-sommario";
            appendInlineMarkup(summary, entry.summary, citations);
            container.appendChild(summary);
        }

        const body = document.createElement("div");
        body.className = "voce-corpo";
        appendBodyMarkup(
            body,
            entry.body || "",
            entry.images || [],
            citations,
            container.id || "voce"
        );
        container.appendChild(body);

        if (citations.items.length) {
            appendReferences(container, citations);
        }

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

    function appendBodyMarkup(container, source, images, citations, scope) {
        const lines = String(source || "").split(/\r?\n/);
        const imagesById = new Map(images.map((image) => [image.id, image]));
        const headings = collectHeadings(lines, scope);
        const hasIndexMarker = lines.some(
            (line) => line.trim().toLocaleLowerCase("it") === "[indice]"
        );
        const headingsByLine = new Map(
            headings.map((heading) => [heading.lineIndex, heading])
        );

        if (!hasIndexMarker && headings.length >= 2) {
            container.appendChild(renderInternalIndex(headings));
        }

        let paragraphLines = [];
        let currentList = null;

        const flushParagraph = () => {
            if (!paragraphLines.length) {
                return;
            }

            const paragraph = document.createElement("p");
            appendInlineMarkup(paragraph, paragraphLines.join(" "), citations);
            container.appendChild(paragraph);
            paragraphLines = [];
        };

        lines.forEach((line, lineIndex) => {
            const trimmed = line.trim();
            const heading = /^(#{2,3})\s+(.+)$/.exec(trimmed);
            const listItem = /^[-*]\s+(.+)$/.exec(trimmed);
            const photo = /^\[foto:([0-9a-f-]{36})\]$/.exec(trimmed);
            const indexMarker = trimmed.toLocaleLowerCase("it") === "[indice]";

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
                const headingData = headingsByLine.get(lineIndex);

                if (headingData) {
                    element.id = headingData.id;
                    element.tabIndex = -1;
                }

                appendInlineMarkup(element, heading[2], citations);
                container.appendChild(element);
                return;
            }

            if (indexMarker) {
                flushParagraph();
                currentList = null;
                container.appendChild(renderInternalIndex(headings));
                return;
            }

            if (photo) {
                flushParagraph();
                currentList = null;
                const image = imagesById.get(photo[1]);

                if (image) {
                    container.appendChild(renderPhoto(image, citations));
                }

                return;
            }

            if (listItem) {
                flushParagraph();

                if (!currentList) {
                    currentList = document.createElement("ul");
                    container.appendChild(currentList);
                }

                const item = document.createElement("li");
                appendInlineMarkup(item, listItem[1], citations);
                currentList.appendChild(item);
                return;
            }

            currentList = null;
            paragraphLines.push(trimmed);
        });

        flushParagraph();
    }

    function collectHeadings(lines, scope) {
        const occurrences = new Map();
        const scopeSlug = slugify(scope) || "voce";

        return lines.flatMap((line, lineIndex) => {
            const heading = /^(#{2,3})\s+(.+)$/.exec(line.trim());

            if (!heading) {
                return [];
            }

            const title = publicSummaryPreview(heading[2]) || "Sezione";
            const base = slugify(title) || "sezione";
            const occurrence = (occurrences.get(base) || 0) + 1;
            occurrences.set(base, occurrence);

            return [{
                id: `${scopeSlug}-sezione-${base}${occurrence > 1 ? `-${occurrence}` : ""}`,
                level: heading[1].length,
                lineIndex,
                title
            }];
        });
    }

    function renderInternalIndex(headings) {
        const navigation = document.createElement("nav");
        navigation.className = "voce-indice-interno";
        navigation.setAttribute("aria-label", "Indice della voce");
        const title = document.createElement("p");
        title.className = "voce-indice-interno-titolo";
        title.textContent = "Indice";
        navigation.appendChild(title);

        if (!headings.length) {
            const empty = document.createElement("p");
            empty.className = "voce-indice-interno-vuoto";
            empty.textContent = "Nessuna sezione presente.";
            navigation.appendChild(empty);
            return navigation;
        }

        const list = document.createElement("ol");
        let currentSection = null;
        let subsectionList = null;

        headings.forEach((heading) => {
            const item = document.createElement("li");
            const link = document.createElement("button");
            link.type = "button";
            link.dataset.wikiHeading = heading.id;
            link.textContent = heading.title;
            item.appendChild(link);

            if (heading.level === 3 && currentSection) {
                if (!subsectionList) {
                    subsectionList = document.createElement("ol");
                    subsectionList.className = "voce-indice-interno-sottosezioni";
                    currentSection.appendChild(subsectionList);
                }

                subsectionList.appendChild(item);
                return;
            }

            list.appendChild(item);
            currentSection = heading.level === 2 ? item : null;
            subsectionList = null;
        });

        navigation.appendChild(list);
        return navigation;
    }

    function renderPhoto(photo, citations) {
        const figure = document.createElement("figure");
        figure.className = "voce-foto";
        const image = document.createElement("img");
        image.alt = photo.alt || "";
        image.loading = "lazy";
        image.decoding = "async";

        if (photo.previewUrl) {
            image.src = photo.previewUrl;
        } else if (photo.mediaUrl) {
            image.src = `${api.baseUrl}${photo.mediaUrl}`;
        }

        figure.appendChild(image);

        if (photo.caption) {
            const caption = document.createElement("figcaption");
            appendInlineMarkup(caption, photo.caption, citations);
            figure.appendChild(caption);
        }

        return figure;
    }

    function appendInlineMarkup(container, source, citations) {
        const pattern = /(\*\*[^*\n]+\*\*|\*[^*\n]+\*|\[fonte:[^\]\n]+\]|\[\[[^\]\n]+\]\]|\[[^\]\n]+\]\(https?:\/\/[^)\s]+\))/g;
        let cursor = 0;

        for (const match of String(source || "").matchAll(pattern)) {
            container.appendChild(document.createTextNode(
                source.slice(cursor, match.index)
            ));
            container.appendChild(inlineToken(match[0], citations));
            cursor = match.index + match[0].length;
        }

        container.appendChild(document.createTextNode(source.slice(cursor)));
    }

    function inlineToken(token, citations) {
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

        if (token.startsWith("[fonte:") && citations) {
            const source = parseSourceToken(token);

            if (source) {
                return renderSourceCall(source, citations);
            }
        }

        if (token.startsWith("[[")) {
            const [rawSlug, label] = token.slice(2, -2).split("|", 2);
            const linkText = label || rawSlug;
            const target = resolveWikiTarget(rawSlug, linkText);

            if (!target) {
                const missing = document.createElement("span");
                missing.className = "voce-collegamento-mancante";
                missing.textContent = linkText;
                missing.title = "Voce non ancora disponibile";
                return missing;
            }

            const link = document.createElement("a");
            link.href = `#${target.slug}`;
            link.dataset.wikiSlug = target.slug;
            link.textContent = linkText;
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

    function resolveWikiTarget(rawSlug, label) {
        const requestedSlug = slugify(rawSlug);
        const exactMatch = publicEntries.find(
            (entry) => entry.slug === requestedSlug
        );

        if (exactMatch) {
            return exactMatch;
        }

        const normalizedLabel = String(label || "")
            .trim()
            .toLocaleLowerCase("it");
        const labelSlug = slugify(label);

        return publicEntries.find((entry) =>
            entry.title.trim().toLocaleLowerCase("it") === normalizedLabel ||
            entry.slug === labelSlug
        ) || null;
    }

    function createCitationContext(scope) {
        return {
            scope: String(scope).replace(/[^a-z0-9-]+/gi, "-").toLowerCase(),
            items: [],
            byKey: new Map(),
            occurrences: 0
        };
    }

    function parseSourceToken(token) {
        const parts = token.slice(7, -1).split("|");

        if (parts.length !== 4) {
            return null;
        }

        let decoded;

        try {
            decoded = parts.map((part) => decodeURIComponent(part));
        } catch (_) {
            return null;
        }

        const [url, title, author, date] = decoded;

        if (!title) {
            return null;
        }

        if (url) {
            try {
                const parsed = new URL(url);

                if (!["http:", "https:"].includes(parsed.protocol)) {
                    return null;
                }
            } catch (_) {
                return null;
            }
        }

        return { url, title, author, date };
    }

    function renderSourceCall(source, citations) {
        const key = JSON.stringify(source);
        let reference = citations.byKey.get(key);

        if (!reference) {
            reference = {
                ...source,
                number: citations.items.length + 1,
                backlinks: []
            };
            citations.byKey.set(key, reference);
            citations.items.push(reference);
        }

        citations.occurrences += 1;
        const callId = `richiamo-${citations.scope}-${citations.occurrences}`;
        reference.backlinks.push(callId);

        const superscript = document.createElement("sup");
        superscript.className = "voce-richiamo-fonte";
        const link = document.createElement("a");
        link.id = callId;
        link.href = `#fonte-${citations.scope}-${reference.number}`;
        link.textContent = `[${reference.number}]`;
        link.setAttribute(
            "aria-label",
            `Fonte ${reference.number}: ${reference.title}`
        );
        superscript.appendChild(link);
        return superscript;
    }

    function appendReferences(container, citations) {
        const section = document.createElement("section");
        section.className = "voce-fonti";
        section.setAttribute("aria-labelledby", `fonti-${citations.scope}`);
        const title = document.createElement("h2");
        title.id = `fonti-${citations.scope}`;
        title.textContent = "Fonti";
        const list = document.createElement("ol");

        citations.items.forEach((source) => {
            const item = document.createElement("li");
            item.id = `fonte-${citations.scope}-${source.number}`;

            if (source.url) {
                const link = document.createElement("a");
                link.href = source.url;
                link.target = "_blank";
                link.rel = "noopener noreferrer";
                link.textContent = source.title;
                item.appendChild(link);
            } else {
                item.appendChild(document.createTextNode(source.title));
            }

            const details = [source.author, source.date].filter(Boolean);

            if (details.length) {
                const metadata = document.createElement("span");
                metadata.className = "voce-fonte-dettagli";
                metadata.textContent = ` — ${details.join(", ")}.`;
                item.appendChild(metadata);
            }

            source.backlinks.forEach((backlink, index) => {
                const back = document.createElement("a");
                back.className = "voce-fonte-ritorno";
                back.href = `#${backlink}`;
                back.textContent = "↑";
                back.setAttribute(
                    "aria-label",
                    `Torna al richiamo ${index + 1} della fonte ${source.number}`
                );
                item.appendChild(back);
            });

            list.appendChild(item);
        });

        section.append(title, list);
        container.appendChild(section);
    }
})();
