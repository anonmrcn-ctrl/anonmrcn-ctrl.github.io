(() => {
    "use strict";

    const api = window.NNMRCN_API;
    const SESSION_KEY = "nnmrcn_admin_session";
    const pageSelect = document.getElementById("adminVisualPageSelect");
    const paletteSelect = document.getElementById("adminVisualPalette");
    const addButton = document.getElementById("adminVisualAdd");
    const undoButton = document.getElementById("adminVisualUndo");
    const canvas = document.getElementById("adminVisualCanvas");
    const inspectorForm = document.getElementById("adminVisualInspectorForm");
    const inspectorFields = document.getElementById("adminVisualInspectorFields");
    const inspectorSave = document.getElementById("adminVisualInspectorSave");
    const preview = document.getElementById("adminVisualPreview");
    const previewDevice = document.getElementById("adminVisualPreviewDevice");
    const warnings = document.getElementById("adminVisualWarnings");
    const saveButton = document.getElementById("adminVisualSave");
    const reloadButton = document.getElementById("adminVisualReload");
    const status = document.getElementById("adminVisualStatus");
    const createForm = document.getElementById("adminVisualCreateForm");
    const createTitle = document.getElementById("adminVisualCreateTitle");
    const createSlug = document.getElementById("adminVisualCreateSlug");
    const createDescription = document.getElementById("adminVisualCreateDescription");
    const createTemplate = document.getElementById("adminVisualCreateTemplate");
    const createNavigation = document.getElementById("adminVisualCreateNavigation");
    const lifecycleForm = document.getElementById("adminVisualLifecycleForm");
    const lifecycleTitle = document.getElementById("adminVisualLifecycleTitle");
    const lifecycleSlug = document.getElementById("adminVisualLifecycleSlug");
    const lifecycleDescription = document.getElementById("adminVisualLifecycleDescription");
    const lifecycleStatus = document.getElementById("adminVisualLifecycleStatus");
    const lifecycleNavigation = document.getElementById("adminVisualLifecycleNavigation");
    const canonical = document.getElementById("adminVisualCanonical");
    const duplicateButton = document.getElementById("adminVisualDuplicate");
    const analyzeDelete = document.getElementById("adminVisualAnalyzeDelete");
    const dependencies = document.getElementById("adminVisualDependencies");
    const deleteRedirect = document.getElementById("adminVisualDeleteRedirect");
    const deleteConfirmation = document.getElementById("adminVisualDeleteConfirmation");
    const deleteButton = document.getElementById("adminVisualDelete");

    const CATEGORY_CHILDREN = Object.freeze({
        root: ["structure", "content", "navigation", "project", "global", "functional", "personal", "legal"],
        structure: ["structure", "content", "navigation", "project", "functional", "personal", "legal"],
        content: [],
        navigation: ["content", "navigation"],
        project: ["structure", "content", "navigation", "functional"],
        global: ["structure", "content", "navigation", "functional", "legal"],
        functional: ["content", "functional"],
        personal: ["structure", "content", "functional"],
        legal: ["content", "navigation"]
    });

    let pages = [];
    let palette = [];
    let inspectorSchemas = {};
    let nodes = [];
    let selectedKey = "";
    let undoStack = [];
    let dirty = false;
    let propertyDirty = new Set();
    let draggedKey = "";
    let lastPageId = "";
    let activeDevice = "phone";

    async function request(path, options = {}) {
        const session = sessionStorage.getItem(SESSION_KEY) || "";
        const headers = new Headers(options.headers || {});
        headers.set("Authorization", `Bearer ${session}`);
        return await api.request(path, { ...options, headers });
    }

    function selectedPage() {
        return pages.find((page) => page.id === pageSelect.value) || null;
    }

    function nodeByKey(key) {
        return nodes.find((node) => node.key === key) || null;
    }

    function category(type) {
        if (type === "page-root") return "root";
        return palette.find((item) => item.type === type)?.category || "content";
    }

    function accepts(parent, child) {
        return Boolean(parent && child &&
            CATEGORY_CHILDREN[category(parent.type)]?.includes(category(child.type)));
    }

    function childrenOf(parentKey) {
        return nodes
            .filter((node) => node.parentKey === parentKey)
            .sort((left, right) => left.position - right.position);
    }

    function normalizePositions() {
        for (const parentKey of new Set(nodes.map((node) => node.parentKey))) {
            childrenOf(parentKey).forEach((node, index) => {
                node.position = index + 1;
            });
        }
    }

    function snapshot() {
        return {
            nodes: nodes.map((node) => ({
                ...node,
                values: { ...(node.values || {}) }
            })),
            selectedKey
        };
    }

    function remember() {
        undoStack.push(snapshot());
        if (undoStack.length > 30) undoStack.shift();
        dirty = true;
    }

    function restore(snapshotValue) {
        nodes = snapshotValue.nodes.map((node) => ({
            ...node,
            values: { ...(node.values || {}) }
        }));
        selectedKey = snapshotValue.selectedKey;
        dirty = true;
        renderCanvas(true);
    }

    function temporaryKey() {
        const value = typeof crypto.randomUUID === "function"
            ? crypto.randomUUID()
            : `${Date.now()}-${Math.floor(Math.random() * 1000000)}`;
        return `new-${value}`.toLocaleLowerCase("it");
    }

    function currentLabel(type) {
        return palette.find((item) => item.type === type)?.label || type;
    }

    function renderCanvas(focusSelected = false) {
        canvas.replaceChildren();
        const root = nodes.find((node) => node.root || node.parentKey === null);
        if (!root) {
            canvas.textContent = "Struttura non disponibile.";
            return;
        }
        const tree = document.createElement("ol");
        tree.className = "admin-visual-tree";
        tree.setAttribute("role", "tree");
        tree.setAttribute("aria-label", "Struttura dei blocchi della pagina");
        tree.appendChild(renderNode(root, 1));
        canvas.appendChild(tree);
        undoButton.disabled = undoStack.length === 0;
        saveButton.disabled = !dirty;
        if (focusSelected) {
            canvas.querySelector(`[data-visual-select="${CSS.escape(selectedKey)}"]`)?.focus();
        }
        renderInspector();
        renderPreview();
    }

    function renderNode(node, level) {
        const item = document.createElement("li");
        item.className = "admin-visual-node";
        item.dataset.visualNode = node.key;
        item.setAttribute("role", "treeitem");
        item.setAttribute("aria-level", String(level));
        item.setAttribute("aria-selected", String(node.key === selectedKey));
        item.draggable = !node.root;

        const card = document.createElement("div");
        card.className = "admin-visual-card";
        if (node.key === selectedKey) card.classList.add("is-selected");
        const select = document.createElement("button");
        select.type = "button";
        select.className = "admin-visual-select";
        select.dataset.visualSelect = node.key;
        select.setAttribute("aria-pressed", String(node.key === selectedKey));
        select.textContent = node.root
            ? `Pagina: ${node.label}`
            : `${node.label || currentLabel(node.type)} · ${currentLabel(node.type)}`;
        card.appendChild(select);

        if (!node.root && node.key === selectedKey) {
            const actions = document.createElement("div");
            actions.className = "admin-visual-actions";
            for (const [action, label] of [
                ["up", "Sposta su"],
                ["down", "Sposta giù"],
                ["indent", "Annida nel precedente"],
                ["outdent", "Porta fuori"],
                ["duplicate", "Duplica"],
                ["remove", "Rimuovi"]
            ]) {
                const button = document.createElement("button");
                button.type = "button";
                button.dataset.visualAction = action;
                button.dataset.visualKey = node.key;
                button.textContent = label;
                actions.appendChild(button);
            }
            card.appendChild(actions);
        }
        item.appendChild(card);
        const childNodes = childrenOf(node.key);
        if (childNodes.length) {
            const group = document.createElement("ol");
            group.setAttribute("role", "group");
            for (const child of childNodes) group.appendChild(renderNode(child, level + 1));
            item.appendChild(group);
        }
        return item;
    }

    function applyAction(action, key) {
        const node = nodeByKey(key);
        if (!node || node.root) return;
        const siblings = childrenOf(node.parentKey);
        const index = siblings.findIndex((candidate) => candidate.key === key);
        if (action === "up" && index > 0) {
            remember();
            const other = siblings[index - 1];
            [node.position, other.position] = [other.position, node.position];
        } else if (action === "down" && index < siblings.length - 1) {
            remember();
            const other = siblings[index + 1];
            [node.position, other.position] = [other.position, node.position];
        } else if (action === "indent" && index > 0 && accepts(siblings[index - 1], node)) {
            remember();
            node.parentKey = siblings[index - 1].key;
            node.position = childrenOf(node.parentKey).length;
        } else if (action === "outdent") {
            const parent = nodeByKey(node.parentKey);
            const grandparent = parent && nodeByKey(parent.parentKey);
            if (parent && !parent.root && accepts(grandparent, node)) {
                remember();
                node.parentKey = parent.parentKey;
                node.position = parent.position + 0.5;
            } else {
                status.textContent = "Questo blocco è già al livello più esterno consentito.";
                return;
            }
        } else if (action === "duplicate") {
            remember();
            duplicateSubtree(node);
        } else if (action === "remove") {
            remember();
            const removed = new Set([node.key]);
            let changed = true;
            while (changed) {
                changed = false;
                for (const candidate of nodes) {
                    if (removed.has(candidate.parentKey) && !removed.has(candidate.key)) {
                        removed.add(candidate.key);
                        changed = true;
                    }
                }
            }
            nodes = nodes.filter((candidate) => !removed.has(candidate.key));
            selectedKey = node.parentKey;
        } else {
            status.textContent = "Lo spostamento non è consentito in questa posizione.";
            return;
        }
        normalizePositions();
        status.textContent = "Modifica pronta. Salva quando hai terminato.";
        renderCanvas(true);
    }

    function duplicateSubtree(source) {
        const subtree = [];
        const collect = (node) => {
            subtree.push(node);
            for (const child of childrenOf(node.key)) collect(child);
        };
        collect(source);
        const keyMap = new Map(subtree.map((node) => [node.key, temporaryKey()]));
        for (const node of subtree) {
            const duplicate = {
                ...node,
                key: keyMap.get(node.key),
                parentKey: node.key === source.key
                    ? source.parentKey
                    : keyMap.get(node.parentKey),
                position: node.key === source.key ? source.position + 0.5 : node.position,
                label: `${node.label || currentLabel(node.type)} (copia)`,
                copyOf: node.key.startsWith("new-") ? node.copyOf || null : node.key,
                values: { ...(node.values || {}) },
                root: false
            };
            nodes.push(duplicate);
        }
        selectedKey = keyMap.get(source.key);
    }

    function addBlock() {
        const type = paletteSelect.value;
        if (!type) return;
        const selected = nodeByKey(selectedKey);
        const root = nodes.find((node) => node.root);
        const draft = { type };
        let parent = root;
        if (selected && accepts(selected, draft)) parent = selected;
        else if (selected) {
            const candidate = nodeByKey(selected.parentKey);
            if (accepts(candidate, draft)) parent = candidate;
        }
        remember();
        const node = {
            key: temporaryKey(),
            parentKey: parent.key,
            position: childrenOf(parent.key).length + 1,
            type,
            label: currentLabel(type),
            copyOf: null,
            values: defaultValues(type),
            root: false
        };
        nodes.push(node);
        selectedKey = node.key;
        normalizePositions();
        status.textContent = `${currentLabel(type)} aggiunto. Puoi spostarlo o annullare.`;
        renderCanvas(true);
    }

    async function load(preferredId = "") {
        if (!sessionStorage.getItem(SESSION_KEY)) return;
        status.textContent = "Caricamento del canvas…";
        try {
            const data = await request("/api/admin/cms/visual-pages");
            pages = data.pages || [];
            palette = data.palette || [];
            inspectorSchemas = data.inspectorSchemas || {};
            const pageId = preferredId || pageSelect.value || lastPageId;
            pageSelect.replaceChildren(...pages.map((page) => {
                const option = document.createElement("option");
                option.value = page.id;
                option.textContent = page.title;
                return option;
            }));
            createTemplate.replaceChildren(
                Object.assign(document.createElement("option"), {
                    value: "", textContent: "Pagina vuota"
                }),
                ...pages.map((page) => Object.assign(document.createElement("option"), {
                    value: page.id,
                    textContent: `Duplica: ${page.title}`
                }))
            );
            paletteSelect.replaceChildren(...palette.map((item) => {
                const option = document.createElement("option");
                option.value = item.type;
                option.textContent = item.label;
                return option;
            }));
            if (pages.some((page) => page.id === pageId)) pageSelect.value = pageId;
            showSelectedPage();
            status.textContent = pages.length ? "" : "Nessuna pagina visuale disponibile.";
        } catch (error) {
            status.textContent = error.message || "Non è stato possibile caricare il canvas.";
        }
    }

    function showSelectedPage(preferredKey = "") {
        const page = selectedPage();
        lastPageId = page?.id || "";
        nodes = (page?.nodes || []).map((node) => ({
            ...node,
            values: { ...(node.values || {}) },
            copyOf: null
        }));
        selectedKey = nodes.some((node) => node.key === preferredKey)
            ? preferredKey
            : nodes.find((node) => node.root)?.key || nodes[0]?.key || "";
        undoStack = [];
        dirty = false;
        propertyDirty = new Set();
        renderLifecycle(page);
        renderCanvas();
    }

    function renderLifecycle(page) {
        const enabled = Boolean(page);
        for (const control of lifecycleForm.elements) control.disabled = !enabled;
        analyzeDelete.disabled = !enabled;
        deleteButton.disabled = true;
        dependencies.replaceChildren();
        deleteRedirect.value = "";
        deleteConfirmation.value = "";
        if (!page) {
            lifecycleForm.reset();
            canonical.textContent = "";
            return;
        }
        lifecycleTitle.value = page.title || "";
        lifecycleSlug.value = page.slug || "";
        lifecycleDescription.value = page.description || "";
        lifecycleStatus.value = page.status || "draft";
        lifecycleNavigation.checked = Boolean(page.inNavigation);
        canonical.textContent = `URL permanente: ${page.canonicalPath}`;
        deleteConfirmation.placeholder = `ELIMINA ${page.slug}`;
    }

    async function createPage(event) {
        event.preventDefault();
        status.textContent = "Creazione della pagina in bozza…";
        try {
            const data = await request("/api/admin/cms/visual-pages", {
                method: "POST",
                body: JSON.stringify({
                    title: createTitle.value,
                    slug: createSlug.value,
                    description: createDescription.value,
                    sourcePageId: createTemplate.value || null,
                    includeInNavigation: createNavigation.checked
                })
            });
            createForm.reset();
            await load(data.page.id);
            status.textContent = "Pagina creata in bozza con URL e ID stabili.";
        } catch (error) {
            status.textContent = error.message || "Non è stato possibile creare la pagina.";
        }
    }

    async function saveLifecycle(event) {
        event.preventDefault();
        const page = selectedPage();
        if (!page) return;
        status.textContent = "Salvataggio delle impostazioni…";
        try {
            const data = await request(
                `/api/admin/cms/visual-page-lifecycle/${encodeURIComponent(page.id)}`,
                {
                    method: "PATCH",
                    body: JSON.stringify({
                        expectedUpdatedAt: page.updatedAt,
                        title: lifecycleTitle.value,
                        slug: lifecycleSlug.value,
                        description: lifecycleDescription.value,
                        status: lifecycleStatus.value,
                        includeInNavigation: lifecycleNavigation.checked
                    })
                }
            );
            await load(data.page.id);
            status.textContent = data.page.status === "archived"
                ? "Pagina archiviata: resta recuperabile e gli URL sono conservati."
                : "Impostazioni salvate e revisione registrata.";
        } catch (error) {
            status.textContent = error.message || "Non è stato possibile salvare le impostazioni.";
        }
    }

    function prepareDuplicate() {
        const page = selectedPage();
        if (!page) return;
        createTemplate.value = page.id;
        createTitle.value = `${page.title} (copia)`;
        createSlug.value = `${page.slug}-copia`;
        createDescription.value = page.description || "";
        createNavigation.checked = false;
        createForm.closest("details").open = true;
        createTitle.focus();
        status.textContent = "Copia pronta: scegli titolo e indirizzo, poi crea la bozza.";
    }

    async function analyzeDeletion() {
        const page = selectedPage();
        if (!page) return;
        status.textContent = "Controllo di URL e dati collegati…";
        try {
            const data = await request(
                `/api/admin/cms/visual-page-dependencies/${encodeURIComponent(page.id)}`
            );
            const lines = [
                `${data.permalinks.length} URL o alias da reindirizzare`,
                `${data.navigation.length} collegamenti di menu`,
                `${data.pageReferences.length} riferimenti da altre pagine`,
                `${data.sourceLinks.length} collegamenti a fonti`,
                `${data.reusableSections.length} sezioni riutilizzabili`
            ];
            const list = document.createElement("ul");
            for (const line of lines) {
                const item = document.createElement("li");
                item.textContent = line;
                list.appendChild(item);
            }
            dependencies.replaceChildren(list);
            deleteButton.disabled = data.hardDeleteBlocked;
            status.textContent = data.hardDeleteBlocked
                ? "Cancellazione bloccata: archivia o riassegna prima le dipendenze indicate."
                : "Controllo superato. Indica destinazione e conferma per eliminare.";
        } catch (error) {
            status.textContent = error.message || "Controllo delle dipendenze non riuscito.";
        }
    }

    async function deletePage() {
        const page = selectedPage();
        if (!page || !window.confirm("Eliminare definitivamente la pagina archiviata?")) return;
        status.textContent = "Cancellazione protetta in corso…";
        try {
            const data = await request(
                `/api/admin/cms/visual-pages/${encodeURIComponent(page.id)}`,
                {
                    method: "DELETE",
                    body: JSON.stringify({
                        redirectPath: deleteRedirect.value,
                        confirmation: deleteConfirmation.value
                    })
                }
            );
            await load();
            status.textContent = `Pagina eliminata; ${data.preservedPermalinks} URL conservati con reindirizzamento.`;
        } catch (error) {
            status.textContent = error.message || "La pagina non può essere eliminata.";
        }
    }

    async function save() {
        const page = selectedPage();
        if (!page || !dirty) return;
        saveButton.disabled = true;
        reloadButton.disabled = true;
        status.textContent = "Salvataggio della struttura…";
        try {
            const data = await request(
                `/api/admin/cms/visual-pages/${encodeURIComponent(page.id)}`,
                {
                    method: "PATCH",
                    body: JSON.stringify({
                        expectedUpdatedAt: page.updatedAt,
                        nodes: nodes.map((node) => ({
                            key: node.key,
                            parentKey: node.parentKey,
                            position: node.position,
                            type: node.type,
                            label: node.label,
                            copyOf: node.copyOf || null
                        }))
                    })
                }
            );
            const selectedBeforeSave = selectedKey;
            const index = pages.findIndex((candidate) => candidate.id === page.id);
            pages[index] = data.page;
            showSelectedPage(data.keyMap?.[selectedBeforeSave] || selectedBeforeSave);
            status.textContent = data.unchanged
                ? "Nessuna modifica da salvare."
                : "Struttura salvata e revisione registrata.";
        } catch (error) {
            status.textContent = error.message || "Non è stato possibile salvare la struttura.";
            saveButton.disabled = false;
        } finally {
            reloadButton.disabled = false;
        }
    }

    function defaultValues(type) {
        return Object.fromEntries((inspectorSchemas[type] || []).map((field) => [
            field.key,
            field.propertyName === "visibility" ? "visible" : ""
        ]));
    }

    function renderInspector() {
        inspectorFields.replaceChildren();
        const node = nodeByKey(selectedKey);
        const schema = inspectorSchemas[node?.type] || [];
        inspectorSave.disabled = !node || node.key.startsWith("new-") || dirty ||
            !propertyDirty.has(node.key);
        if (!node) {
            inspectorFields.textContent = "Seleziona un blocco.";
            return;
        }
        for (const field of schema) {
            const label = document.createElement("label");
            const caption = document.createElement("span");
            const control = field.control === "textarea"
                ? document.createElement("textarea")
                : field.control === "select"
                    ? document.createElement("select")
                    : document.createElement("input");
            const id = `adminVisualField-${field.key}`;
            caption.textContent = field.label;
            label.htmlFor = id;
            control.id = id;
            control.name = field.key;
            control.dataset.visualField = field.key;
            control.maxLength = field.maxLength;
            if (control instanceof HTMLInputElement) {
                control.type = field.control === "url" ? "url" : "text";
            }
            if (control instanceof HTMLTextAreaElement) control.rows = 4;
            if (control instanceof HTMLSelectElement) {
                if (field.propertyName !== "visibility") {
                    const empty = document.createElement("option");
                    empty.value = "";
                    empty.textContent = "Predefinito";
                    control.appendChild(empty);
                }
                for (const item of field.options || []) {
                    const option = document.createElement("option");
                    option.value = item.value;
                    option.textContent = item.label;
                    control.appendChild(option);
                }
            }
            control.value = node.values?.[field.key] ||
                (field.propertyName === "visibility" ? "visible" : "");
            if (field.required) control.required = true;
            label.append(caption, control);
            inspectorFields.appendChild(label);
        }
    }

    function renderPreview() {
        preview.replaceChildren();
        preview.dataset.device = activeDevice;
        const root = nodes.find((node) => node.root);
        if (root) preview.appendChild(previewNode(root));
        const labels = {
            phone: "Anteprima smartphone, 360 px",
            tablet: "Anteprima tablet, 768 px",
            desktop: "Anteprima desktop, larghezza disponibile"
        };
        previewDevice.textContent = labels[activeDevice];
        renderWarnings();
    }

    function previewNode(node) {
        const element = document.createElement(node.root ? "main" :
            node.type === "heading" ? "h2" :
                node.type === "rich-text" ? "p" :
                    node.type === "quote" ? "blockquote" : "section");
        element.className = "visual-block admin-visual-preview-block";
        element.dataset.previewType = node.type;
        applyPreviewAttributes(element, node.values || {});
        const title = String(node.values?.title || "").trim();
        const text = String(node.values?.text || "").trim();
        const items = String(node.values?.items || "").split(/\r?\n/u).filter(Boolean);
        if (node.type === "heading") {
            element.textContent = title || node.label;
        } else if (["rich-text", "quote"].includes(node.type)) {
            element.textContent = text || node.label;
        } else {
            if (title) {
                const heading = document.createElement(node.root ? "h1" : "h3");
                heading.textContent = title;
                element.appendChild(heading);
            }
            if (text) {
                const paragraph = document.createElement("p");
                paragraph.textContent = text;
                element.appendChild(paragraph);
            }
            if (items.length) {
                const list = document.createElement("ul");
                for (const item of items) {
                    const entry = document.createElement("li");
                    entry.textContent = item;
                    list.appendChild(entry);
                }
                element.appendChild(list);
            }
            if (!title && !text && !items.length && !node.root) {
                const placeholder = document.createElement("span");
                placeholder.textContent = node.label || currentLabel(node.type);
                element.appendChild(placeholder);
            }
            for (const child of childrenOf(node.key)) element.appendChild(previewNode(child));
        }
        return element;
    }

    function applyPreviewAttributes(element, values) {
        const mapping = {
            alignment: "visualAlign", width: "visualWidth",
            spaceTop: "visualSpaceTop", spaceBottom: "visualSpaceBottom",
            fontFamily: "visualFont", fontSize: "visualSize",
            textColor: "visualColor", background: "visualBackground",
            border: "visualBorder", radius: "visualRadius",
            visibilityPhone: "visualPhone", visibilityTablet: "visualTablet",
            visibilityDesktop: "visualDesktop"
        };
        for (const [key, dataName] of Object.entries(mapping)) {
            if (values[key]) element.dataset[dataName] = values[key];
        }
    }

    function currentWarnings() {
        const node = nodeByKey(selectedKey);
        if (!node) return [];
        const values = node.values || {};
        const messages = [];
        if (["visibilityPhone", "visibilityTablet", "visibilityDesktop"].every(
            (key) => values[key] === "hidden"
        )) messages.push("Il blocco non può essere nascosto su tutti i dispositivi.");
        const colorOptions = (inspectorSchemas[node.type] || [])
            .flatMap((field) => field.options || [])
            .filter((item) => item.color);
        const color = (name, fallback) =>
            colorOptions.find((item) => item.value === name)?.color || fallback;
        const ratio = contrastRatio(
            color(values.textColor, "#191919"),
            color(values.background, "#f4f1e8")
        );
        if (ratio < 4.5) messages.push(
            `Contrasto insufficiente (${ratio.toFixed(2)}:1): scegli colori più leggibili.`
        );
        if (node.type === "image" && !String(values.alt || "").trim()) {
            messages.push("Aggiungi il testo alternativo prima di salvare l'immagine.");
        }
        return messages;
    }

    function renderWarnings() {
        warnings.replaceChildren();
        for (const message of currentWarnings()) {
            const item = document.createElement("li");
            item.textContent = message;
            warnings.appendChild(item);
        }
        const node = nodeByKey(selectedKey);
        inspectorSave.disabled = currentWarnings().length > 0 || dirty ||
            !node || node.key.startsWith("new-") || !propertyDirty.has(node.key);
    }

    function contrastRatio(first, second) {
        const luminance = (hex) => {
            const channels = hex.match(/[a-f0-9]{2}/giu).map((value) => parseInt(value, 16) / 255);
            const linear = channels.map((value) => value <= 0.03928
                ? value / 12.92
                : ((value + 0.055) / 1.055) ** 2.4);
            return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
        };
        const values = [luminance(first), luminance(second)].sort((a, b) => b - a);
        return (values[0] + 0.05) / (values[1] + 0.05);
    }

    async function saveInspector(event) {
        event.preventDefault();
        const page = selectedPage();
        const node = nodeByKey(selectedKey);
        if (!page || !node) return;
        if (dirty || node.key.startsWith("new-")) {
            status.textContent = "Salva prima la struttura, poi le proprietà del nuovo blocco.";
            return;
        }
        if (currentWarnings().length) {
            status.textContent = currentWarnings()[0];
            return;
        }
        inspectorSave.disabled = true;
        status.textContent = "Salvataggio delle proprietà…";
        try {
            const data = await request(
                `/api/admin/cms/visual-properties/${encodeURIComponent(page.id)}/${encodeURIComponent(node.key)}`,
                {
                    method: "PATCH",
                    body: JSON.stringify({
                        expectedUpdatedAt: page.updatedAt,
                        values: node.values || {}
                    })
                }
            );
            const index = pages.findIndex((candidate) => candidate.id === page.id);
            pages[index] = data.page;
            showSelectedPage(node.key);
            status.textContent = "Proprietà salvate e revisione registrata.";
        } catch (error) {
            status.textContent = error.message || "Non è stato possibile salvare le proprietà.";
            inspectorSave.disabled = false;
        }
    }

    pageSelect.addEventListener("change", () => {
        if ((dirty || propertyDirty.size) &&
            !window.confirm("Abbandonare le modifiche non salvate del canvas?")) {
            pageSelect.value = lastPageId;
            return;
        }
        showSelectedPage();
    });
    createForm.addEventListener("submit", createPage);
    lifecycleForm.addEventListener("submit", saveLifecycle);
    duplicateButton.addEventListener("click", prepareDuplicate);
    analyzeDelete.addEventListener("click", analyzeDeletion);
    deleteButton.addEventListener("click", deletePage);
    addButton.addEventListener("click", addBlock);
    undoButton.addEventListener("click", () => {
        const previous = undoStack.pop();
        if (!previous) return;
        restore(previous);
        status.textContent = "Ultima modifica annullata.";
    });
    saveButton.addEventListener("click", save);
    reloadButton.addEventListener("click", () => {
        if ((!dirty && !propertyDirty.size) ||
            window.confirm("Ricaricare e perdere le modifiche non salvate?")) {
            load(pageSelect.value);
        }
    });
    inspectorForm.addEventListener("submit", saveInspector);
    inspectorFields.addEventListener("input", (event) => {
        const control = event.target.closest("[data-visual-field]");
        const node = nodeByKey(selectedKey);
        if (!control || !node) return;
        node.values = { ...(node.values || {}), [control.dataset.visualField]: control.value };
        propertyDirty.add(node.key);
        renderPreview();
        inspectorSave.disabled = currentWarnings().length > 0 || dirty ||
            node.key.startsWith("new-");
        status.textContent = currentWarnings()[0] ||
            "Proprietà modificate. Controlla l'anteprima e salva.";
    });
    document.querySelectorAll("[data-visual-device]").forEach((button) => {
        button.addEventListener("click", () => {
            activeDevice = button.dataset.visualDevice;
            document.querySelectorAll("[data-visual-device]").forEach((candidate) => {
                candidate.setAttribute("aria-pressed", String(candidate === button));
            });
            renderPreview();
        });
    });
    canvas.addEventListener("click", (event) => {
        const selection = event.target.closest("[data-visual-select]");
        if (selection) {
            selectedKey = selection.dataset.visualSelect;
            renderCanvas(true);
            return;
        }
        const action = event.target.closest("[data-visual-action]");
        if (action) applyAction(action.dataset.visualAction, action.dataset.visualKey);
    });
    canvas.addEventListener("keydown", (event) => {
        const selection = event.target.closest("[data-visual-select]");
        if (!selection || !event.altKey) return;
        const action = {
            ArrowUp: "up",
            ArrowDown: "down",
            ArrowRight: "indent",
            ArrowLeft: "outdent"
        }[event.key];
        if (!action) return;
        event.preventDefault();
        applyAction(action, selection.dataset.visualSelect);
    });
    canvas.addEventListener("dragstart", (event) => {
        const item = event.target.closest("[data-visual-node]");
        if (!item || nodeByKey(item.dataset.visualNode)?.root) return;
        draggedKey = item.dataset.visualNode;
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/plain", draggedKey);
        item.classList.add("is-dragging");
    });
    canvas.addEventListener("dragover", (event) => {
        const target = nodeByKey(event.target.closest("[data-visual-node]")?.dataset.visualNode);
        const dragged = nodeByKey(draggedKey);
        if (target && dragged && target.key !== dragged.key &&
            target.parentKey === dragged.parentKey) {
            event.preventDefault();
            event.dataTransfer.dropEffect = "move";
        }
    });
    canvas.addEventListener("drop", (event) => {
        const target = nodeByKey(event.target.closest("[data-visual-node]")?.dataset.visualNode);
        const dragged = nodeByKey(draggedKey);
        if (!target || !dragged || target.key === dragged.key ||
            target.parentKey !== dragged.parentKey) return;
        event.preventDefault();
        remember();
        const siblings = childrenOf(dragged.parentKey).filter((node) => node.key !== dragged.key);
        siblings.splice(siblings.findIndex((node) => node.key === target.key), 0, dragged);
        siblings.forEach((node, index) => { node.position = index + 1; });
        selectedKey = dragged.key;
        status.textContent = "Blocco spostato. Puoi annullare o salvare.";
        renderCanvas(true);
    });
    canvas.addEventListener("dragend", () => {
        draggedKey = "";
        canvas.querySelectorAll(".is-dragging").forEach((item) => {
            item.classList.remove("is-dragging");
        });
    });
    window.addEventListener("beforeunload", (event) => {
        if (!dirty && !propertyDirty.size) return;
        event.preventDefault();
        event.returnValue = "";
    });

    window.NNMRCN_VISUAL_BUILDER = Object.freeze({ load });
})();
