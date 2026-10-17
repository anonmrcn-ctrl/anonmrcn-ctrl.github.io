(() => {
    "use strict";

    const api = window.NNMRCN_API;
    const SESSION_KEY = "nnmrcn_admin_session";
    const pageSelect = document.getElementById("adminVisualPageSelect");
    const paletteSelect = document.getElementById("adminVisualPalette");
    const addButton = document.getElementById("adminVisualAdd");
    const undoButton = document.getElementById("adminVisualUndo");
    const canvas = document.getElementById("adminVisualCanvas");
    const saveButton = document.getElementById("adminVisualSave");
    const reloadButton = document.getElementById("adminVisualReload");
    const status = document.getElementById("adminVisualStatus");

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
    let nodes = [];
    let selectedKey = "";
    let undoStack = [];
    let dirty = false;
    let draggedKey = "";
    let lastPageId = "";

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
            nodes: nodes.map((node) => ({ ...node })),
            selectedKey
        };
    }

    function remember() {
        undoStack.push(snapshot());
        if (undoStack.length > 30) undoStack.shift();
        dirty = true;
    }

    function restore(snapshotValue) {
        nodes = snapshotValue.nodes.map((node) => ({ ...node }));
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
            const pageId = preferredId || pageSelect.value || lastPageId;
            pageSelect.replaceChildren(...pages.map((page) => {
                const option = document.createElement("option");
                option.value = page.id;
                option.textContent = page.title;
                return option;
            }));
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

    function showSelectedPage() {
        const page = selectedPage();
        lastPageId = page?.id || "";
        nodes = (page?.nodes || []).map((node) => ({ ...node, copyOf: null }));
        selectedKey = nodes.find((node) => node.root)?.key || nodes[0]?.key || "";
        undoStack = [];
        dirty = false;
        renderCanvas();
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
            const index = pages.findIndex((candidate) => candidate.id === page.id);
            pages[index] = data.page;
            showSelectedPage();
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

    pageSelect.addEventListener("change", () => {
        if (dirty && !window.confirm("Abbandonare le modifiche non salvate del canvas?")) {
            pageSelect.value = lastPageId;
            return;
        }
        showSelectedPage();
    });
    addButton.addEventListener("click", addBlock);
    undoButton.addEventListener("click", () => {
        const previous = undoStack.pop();
        if (!previous) return;
        restore(previous);
        status.textContent = "Ultima modifica annullata.";
    });
    saveButton.addEventListener("click", save);
    reloadButton.addEventListener("click", () => {
        if (!dirty || window.confirm("Ricaricare e perdere le modifiche non salvate?")) {
            load(pageSelect.value);
        }
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
        if (!dirty) return;
        event.preventDefault();
        event.returnValue = "";
    });

    window.NNMRCN_VISUAL_BUILDER = Object.freeze({ load });
})();
