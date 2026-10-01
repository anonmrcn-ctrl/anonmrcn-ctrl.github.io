(() => {
    "use strict";

    const poem = document.querySelector("main.poesia");
    const metricLines = window.NNMRCN_POEM_METRIC?.lines;

    if (!poem || !metricLines) {
        return;
    }

    const places = [
        { key: "gaggio", label: "Gaggio" },
        { key: "praello", label: "Praello" },
        { key: "viaAlta", label: "Via Alta" },
        { key: "viaFornace", label: "Via Fornace" },
        { key: "viaBoscoBerizzi", label: "Via Bosco Berizzi" },
        { key: "colmello", label: "Colmello" },
        { key: "pojanon", label: "Pojanon" },
        { key: "zero", label: "Zero" },
        { key: "viaCostituzione", label: "Via della Costituzione" },
        { key: "fossaStorta", label: "Fossa Storta" },
        { key: "a57", label: "A57" },
        { key: "a27", label: "A27" },
        { key: "a4", label: "A4" }
    ];
    const groups = new Map();

    places.forEach((place, narrativeIndex) => {
        const lineNumber = Number(metricLines[place.key]);

        if (!Number.isInteger(lineNumber)) {
            return;
        }

        const group = groups.get(lineNumber) || [];
        group.push({ ...place, narrativeIndex });
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
    let activeTrigger = null;
    let activeGroup = [];
    let activeNarrativeIndex = -1;

    panel.id = "versoMappaScheda";
    panel.className = "verso-mappa-scheda";
    panel.hidden = true;
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-modal", "false");
    panel.setAttribute("aria-labelledby", "versoMappaTitolo");

    header.className = "verso-mappa-intestazione";
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
    panel.append(header, tabs, frameWrap, fullMapLink);
    document.body.append(panel);

    poem.querySelectorAll(".verso-linea[data-rigo-poesia]").forEach((line) => {
        const lineNumber = Number(line.dataset.rigoPoesia);
        const group = groups.get(lineNumber);

        if (!group) {
            return;
        }

        const labels = group.map((place) => place.label).join(", ");
        const link = document.createElement("a");

        link.className = "verso-mappa-link";
        link.href = `./progetto.html?narrative=${group[0].narrativeIndex}`;
        link.textContent = "poesia–mappa";
        link.setAttribute("aria-haspopup", "dialog");
        link.setAttribute("aria-controls", panel.id);
        link.setAttribute("aria-expanded", "false");
        link.setAttribute(
            "aria-label",
            `Apri mappa e spiegazione del verso: ${labels}`
        );
        link.addEventListener("click", (event) => {
            event.preventDefault();
            togglePanel(link, group);
        });
        line.append(" ", link);
    });

    closeButton.addEventListener("click", () => closePanel(true));
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

        if (window.matchMedia("(max-width: 900px)").matches) {
            panel.style.removeProperty("top");
            panel.style.removeProperty("left");
            return;
        }

        const gap = 18;
        const edge = 16;
        const lineBounds = activeTrigger.getBoundingClientRect();
        const panelBounds = panel.getBoundingClientRect();
        const roomOnRight = window.innerWidth - lineBounds.right - gap;
        const left = roomOnRight >= panelBounds.width + edge
            ? lineBounds.right + gap
            : Math.max(edge, lineBounds.left - panelBounds.width - gap);
        const top = Math.min(
            Math.max(edge, lineBounds.top - 36),
            Math.max(edge, window.innerHeight - panelBounds.height - edge)
        );

        panel.style.left = `${left}px`;
        panel.style.top = `${top}px`;
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

        if (restoreFocus) {
            previousTrigger?.focus();
        }
    }
})();
