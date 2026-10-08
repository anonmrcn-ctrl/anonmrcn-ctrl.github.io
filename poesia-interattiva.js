(async () => {
    "use strict";

    await Promise.resolve(
        window.NNMRCN_POEM_RENDERED || window.NNMRCN_POEM_READY
    );

    const poem = document.querySelector("main.poesia");
    const metricLines = window.NNMRCN_POEM_METRIC?.lines;

    if (!poem || !metricLines) {
        return;
    }

    const places = [
        "Gaggio",
        "Praello",
        "Via Alta",
        "Via Fornace",
        "Via Bosco Berizzi",
        "Colmello",
        "Pojanon",
        "Zero",
        "Via della Costituzione",
        "Fossa Storta",
        "A57",
        "A27",
        "A4"
    ];
    const targets = [
        { lineKey: "gaggio", term: "Gajo", narrativeIndex: 0 },
        { lineKey: "praello", term: "Praelli", narrativeIndex: 1 },
        { lineKey: "viaAlta", term: "via Alta", narrativeIndex: 2 },
        { lineKey: "viaFornace", term: "via Fornace", narrativeIndex: 3 },
        {
            lineKey: "viaBoscoBerizzi",
            term: "via Bosco Berizzi",
            narrativeIndex: 4
        },
        { lineKey: "colmello", term: "Colmello", narrativeIndex: 5 },
        { lineKey: "pojanon", term: "Pojanon", narrativeIndex: 6 },
        { lineKey: "zero", term: "Zero", narrativeIndex: 7 },
        {
            lineKey: "viaCostituzione",
            term: "via della Costituzione",
            narrativeIndex: 8
        },
        {
            lineKey: "fossaStorta",
            term: "Zero",
            narrativeIndex: 7
        },
        {
            lineKey: "fossaStorta",
            term: "Fossa Storta",
            narrativeIndex: 9
        },
        { lineKey: "a57", term: "A57", narrativeIndex: 10 },
        { lineKey: "a27", term: "A27", narrativeIndex: 11 },
        { lineKey: "a4", term: "A4", narrativeIndex: 12 }
    ];
    const groups = new Map();

    targets.forEach((target) => {
        const lineNumber = Number(metricLines[target.lineKey]);

        if (!Number.isInteger(lineNumber)) {
            return;
        }

        const group = groups.get(lineNumber) || [];
        group.push({
            ...target,
            label: places[target.narrativeIndex]
        });
        groups.set(lineNumber, group);
    });

    const panel = document.createElement("aside");
    const header = document.createElement("header");
    const heading = document.createElement("h2");
    const closeButton = document.createElement("button");
    const tabs = document.createElement("div");
    const frameWrap = document.createElement("div");
    const status = document.createElement("p");
    const frame = document.createElement("iframe");
    const fullMapLink = document.createElement("a");
    const resizeHandle = document.createElement("button");
    let activeTrigger = null;
    let activeGroup = [];
    let activeNarrativeIndex = -1;
    let poemOffset = 0;
    let manualPanelGeometry = false;
    let panelGesture = null;

    panel.id = "versoMappaScheda";
    panel.className = "verso-mappa-scheda";
    panel.hidden = true;
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-modal", "false");
    panel.setAttribute("aria-labelledby", "versoMappaTitolo");

    header.className = "verso-mappa-intestazione";
    header.tabIndex = 0;
    header.setAttribute("aria-label", "Sposta la finestra della mappa");
    header.title = "Trascina per spostare la finestra";
    heading.id = "versoMappaTitolo";
    heading.textContent = "Il verso nel territorio";
    closeButton.type = "button";
    closeButton.className = "verso-mappa-chiudi";
    closeButton.setAttribute("aria-label", "Chiudi mappa e spiegazione");
    closeButton.textContent = "×";
    header.append(heading, closeButton);

    tabs.className = "verso-mappa-luoghi";
    tabs.setAttribute("role", "tablist");
    tabs.setAttribute("aria-label", "Luoghi citati nel verso");

    frameWrap.className = "verso-mappa-frame-contenitore";
    status.className = "verso-mappa-stato";
    status.textContent = "Caricamento della mappa…";
    status.setAttribute("aria-live", "polite");
    frame.className = "verso-mappa-frame";
    frame.title = "Mappa e spiegazione del verso";
    frame.loading = "eager";
    frameWrap.append(status, frame);

    fullMapLink.className = "verso-mappa-apri";
    fullMapLink.textContent = "Apri nella mappa completa";
    resizeHandle.type = "button";
    resizeHandle.className = "verso-mappa-ridimensiona";
    resizeHandle.setAttribute("aria-label", "Ridimensiona la finestra");
    resizeHandle.title = "Trascina per ridimensionare la finestra";
    panel.append(header, tabs, frameWrap, fullMapLink, resizeHandle);
    document.body.append(panel);

    poem.querySelectorAll(".verso-linea[data-rigo-poesia]").forEach((line) => {
        const lineNumber = Number(line.dataset.rigoPoesia);
        const group = groups.get(lineNumber);

        if (!group) {
            return;
        }

        linkToponyms(line, group);
    });

    closeButton.addEventListener("click", () => closePanel(true));
    header.addEventListener("pointerdown", startPanelMove);
    header.addEventListener("keydown", movePanelWithKeyboard);
    resizeHandle.addEventListener("pointerdown", startPanelResize);
    resizeHandle.addEventListener("keydown", resizePanelWithKeyboard);
    window.addEventListener("pointermove", updatePanelGesture, {
        passive: false
    });
    window.addEventListener("pointerup", finishPanelGesture);
    window.addEventListener("pointercancel", finishPanelGesture);
    frame.addEventListener("load", () => {
        status.hidden = true;
    });
    window.addEventListener("resize", positionPanel, { passive: true });
    window.addEventListener("scroll", positionPanel, { passive: true });
    document.addEventListener("keydown", (event) => {
        if (event.key === "Escape" && !panel.hidden) {
            event.preventDefault();
            closePanel(true);
        }
    });
    document.addEventListener("click", (event) => {
        if (
            panel.hidden ||
            panel.contains(event.target) ||
            activeTrigger?.contains(event.target)
        ) {
            return;
        }

        closePanel(false);
    });

    function linkToponyms(line, group) {
        const text = line.textContent;
        const occurrences = group
            .map((place) => ({
                ...place,
                start: text.indexOf(place.term)
            }))
            .filter((place) => place.start >= 0)
            .sort((first, second) => first.start - second.start);
        const fragment = document.createDocumentFragment();
        let cursor = 0;

        occurrences.forEach((place) => {
            const end = place.start + place.term.length;
            const link = document.createElement("a");

            fragment.append(text.slice(cursor, place.start));
            link.className = "verso-mappa-link";
            link.href = `./progetto.html?narrative=${place.narrativeIndex}`;
            link.textContent = text.slice(place.start, end);
            link.setAttribute("aria-haspopup", "dialog");
            link.setAttribute("aria-controls", panel.id);
            link.setAttribute("aria-expanded", "false");
            link.setAttribute(
                "aria-label",
                `${place.term}. Apri mappa e spiegazione: ${place.label}`
            );
            link.addEventListener("click", (event) => {
                event.preventDefault();
                togglePanel(link, [place]);
            });
            fragment.append(link);
            cursor = end;
        });

        fragment.append(text.slice(cursor));
        line.replaceChildren(fragment);
    }

    function togglePanel(trigger, group) {
        if (activeTrigger === trigger && !panel.hidden) {
            closePanel(true);
            return;
        }

        openPanel(trigger, group);
    }

    function openPanel(trigger, group) {
        if (activeTrigger) {
            activeTrigger.setAttribute("aria-expanded", "false");
            activeTrigger.classList.remove("verso-mappa-link-attivo");
        }

        activeTrigger = trigger;
        activeGroup = group;
        activeTrigger.setAttribute("aria-expanded", "true");
        activeTrigger.classList.add("verso-mappa-link-attivo");
        renderTabs();
        selectPlace(group[0].narrativeIndex);
        panel.hidden = false;
        window.requestAnimationFrame(positionPanel);
    }

    function renderTabs() {
        tabs.replaceChildren();
        tabs.hidden = activeGroup.length < 2;

        activeGroup.forEach((place) => {
            const button = document.createElement("button");

            button.type = "button";
            button.setAttribute("role", "tab");
            button.dataset.narrativeIndex = String(place.narrativeIndex);
            button.textContent = place.label;
            button.addEventListener("click", () => {
                selectPlace(place.narrativeIndex);
            });
            tabs.append(button);
        });
    }

    function selectPlace(narrativeIndex) {
        const place = activeGroup.find(
            (item) => item.narrativeIndex === narrativeIndex
        );

        if (!place) {
            return;
        }

        activeNarrativeIndex = narrativeIndex;
        status.hidden = false;
        frame.title = `Mappa e spiegazione: ${place.label}`;
        frame.src =
            `./progetto.html?poesia-mini=1&narrative=${narrativeIndex}`;
        fullMapLink.href = `./progetto.html?narrative=${narrativeIndex}`;
        fullMapLink.textContent = `Apri ${place.label} nella mappa completa`;

        tabs.querySelectorAll("[role='tab']").forEach((button) => {
            const selected =
                Number(button.dataset.narrativeIndex) === activeNarrativeIndex;
            button.setAttribute("aria-selected", String(selected));
            button.tabIndex = selected ? 0 : -1;
        });
    }

    function positionPanel() {
        if (!activeTrigger || panel.hidden) {
            return;
        }

        if (window.matchMedia("(max-width: 1250px)").matches) {
            manualPanelGeometry = false;
            panel.style.removeProperty("width");
            panel.style.removeProperty("height");
            resetPoemPosition();
            panel.style.removeProperty("top");
            panel.style.removeProperty("left");
            return;
        }

        if (manualPanelGeometry) {
            resetPoemPosition();
            keepPanelInsideViewport();
            return;
        }

        const gap = 18;
        const edge = 16;
        const lineBounds = activeTrigger.getBoundingClientRect();
        const panelBounds = panel.getBoundingClientRect();
        const poemBounds = poem.getBoundingClientRect();
        const poemLeft = poemBounds.left - poemOffset;
        const poemRight = poemLeft + poemBounds.width;
        const left = edge;
        const overlap = left + panelBounds.width + gap - poemLeft;
        const roomOnRight = window.innerWidth - edge - poemRight;
        const nextOffset = Math.max(
            0,
            Math.min(overlap, roomOnRight)
        );
        const top = Math.min(
            Math.max(edge, lineBounds.top - 36),
            Math.max(edge, window.innerHeight - panelBounds.height - edge)
        );

        poemOffset = nextOffset;
        poem.style.transform = nextOffset
            ? `translateX(${nextOffset}px)`
            : "";
        panel.style.left = `${left}px`;
        panel.style.top = `${top}px`;
    }

    function startPanelMove(event) {
        if (
            event.button !== 0 ||
            event.target.closest("button, a") ||
            window.matchMedia("(max-width: 1250px)").matches
        ) {
            return;
        }

        startPanelGesture("move", event);
    }

    function startPanelResize(event) {
        if (
            event.button !== 0 ||
            window.matchMedia("(max-width: 1250px)").matches
        ) {
            return;
        }

        event.stopPropagation();
        startPanelGesture("resize", event);
    }

    function startPanelGesture(type, event) {
        const bounds = panel.getBoundingClientRect();

        event.preventDefault();
        manualPanelGeometry = true;
        resetPoemPosition();
        panel.style.left = `${bounds.left}px`;
        panel.style.top = `${bounds.top}px`;
        panel.style.width = `${bounds.width}px`;
        panel.style.height = `${bounds.height}px`;
        panelGesture = {
            type,
            pointerId: event.pointerId,
            startX: event.clientX,
            startY: event.clientY,
            left: bounds.left,
            top: bounds.top,
            width: bounds.width,
            height: bounds.height
        };
        event.currentTarget.setPointerCapture?.(event.pointerId);
        document.body.classList.add("verso-mappa-gesto-attivo");
    }

    function updatePanelGesture(event) {
        if (!panelGesture || event.pointerId !== panelGesture.pointerId) {
            return;
        }

        event.preventDefault();
        const deltaX = event.clientX - panelGesture.startX;
        const deltaY = event.clientY - panelGesture.startY;
        const edge = 8;

        if (panelGesture.type === "move") {
            const left = clamp(
                panelGesture.left + deltaX,
                edge,
                window.innerWidth - panelGesture.width - edge
            );
            const top = clamp(
                panelGesture.top + deltaY,
                edge,
                window.innerHeight - panelGesture.height - edge
            );

            panel.style.left = `${left}px`;
            panel.style.top = `${top}px`;
            return;
        }

        const width = clamp(
            panelGesture.width + deltaX,
            256,
            window.innerWidth - panelGesture.left - edge
        );
        const height = clamp(
            panelGesture.height + deltaY,
            320,
            window.innerHeight - panelGesture.top - edge
        );

        panel.style.width = `${width}px`;
        panel.style.height = `${height}px`;
    }

    function finishPanelGesture(event) {
        if (!panelGesture || event.pointerId !== panelGesture.pointerId) {
            return;
        }

        panelGesture = null;
        document.body.classList.remove("verso-mappa-gesto-attivo");
    }

    function movePanelWithKeyboard(event) {
        if (
            event.target !== header ||
            window.matchMedia("(max-width: 1250px)").matches
        ) {
            return;
        }

        const movement = arrowMovement(event);

        if (!movement) {
            return;
        }

        event.preventDefault();
        prepareManualGeometry();
        const bounds = panel.getBoundingClientRect();
        const edge = 8;
        const step = event.shiftKey ? 48 : 16;

        panel.style.left = `${clamp(
            bounds.left + movement.x * step,
            edge,
            window.innerWidth - bounds.width - edge
        )}px`;
        panel.style.top = `${clamp(
            bounds.top + movement.y * step,
            edge,
            window.innerHeight - bounds.height - edge
        )}px`;
    }

    function resizePanelWithKeyboard(event) {
        if (window.matchMedia("(max-width: 1250px)").matches) {
            return;
        }

        const movement = arrowMovement(event);

        if (!movement) {
            return;
        }

        event.preventDefault();
        prepareManualGeometry();
        const bounds = panel.getBoundingClientRect();
        const edge = 8;
        const step = event.shiftKey ? 48 : 16;

        panel.style.width = `${clamp(
            bounds.width + movement.x * step,
            256,
            window.innerWidth - bounds.left - edge
        )}px`;
        panel.style.height = `${clamp(
            bounds.height + movement.y * step,
            320,
            window.innerHeight - bounds.top - edge
        )}px`;
    }

    function prepareManualGeometry() {
        const bounds = panel.getBoundingClientRect();

        manualPanelGeometry = true;
        resetPoemPosition();
        panel.style.left = `${bounds.left}px`;
        panel.style.top = `${bounds.top}px`;
        panel.style.width = `${bounds.width}px`;
        panel.style.height = `${bounds.height}px`;
    }

    function keepPanelInsideViewport() {
        const bounds = panel.getBoundingClientRect();
        const edge = 8;
        const width = Math.min(bounds.width, window.innerWidth - edge * 2);
        const height = Math.min(bounds.height, window.innerHeight - edge * 2);

        panel.style.width = `${width}px`;
        panel.style.height = `${height}px`;
        panel.style.left = `${clamp(
            bounds.left,
            edge,
            window.innerWidth - width - edge
        )}px`;
        panel.style.top = `${clamp(
            bounds.top,
            edge,
            window.innerHeight - height - edge
        )}px`;
    }

    function arrowMovement(event) {
        const movements = {
            ArrowLeft: { x: -1, y: 0 },
            ArrowRight: { x: 1, y: 0 },
            ArrowUp: { x: 0, y: -1 },
            ArrowDown: { x: 0, y: 1 }
        };

        return movements[event.key] || null;
    }

    function clamp(value, minimum, maximum) {
        return Math.min(Math.max(value, minimum), Math.max(minimum, maximum));
    }

    function resetPoemPosition() {
        poemOffset = 0;
        poem.style.removeProperty("transform");
    }

    function closePanel(restoreFocus) {
        if (panel.hidden) {
            return;
        }

        const previousTrigger = activeTrigger;

        panel.hidden = true;
        activeTrigger?.setAttribute("aria-expanded", "false");
        activeTrigger?.classList.remove("verso-mappa-link-attivo");
        activeTrigger = null;
        activeGroup = [];
        activeNarrativeIndex = -1;
        frame.removeAttribute("src");
        resetPoemPosition();

        if (restoreFocus) {
            previousTrigger?.focus();
        }
    }
})();
