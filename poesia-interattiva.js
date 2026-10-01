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
    let activeLine = null;
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

        line.classList.add("verso-interattivo");
        line.tabIndex = 0;
        line.setAttribute("role", "button");
        line.setAttribute("aria-haspopup", "dialog");
        line.setAttribute("aria-controls", panel.id);
        line.setAttribute("aria-expanded", "false");
        line.setAttribute(
            "aria-label",
            `${line.textContent.trim()}. Apri mappa e spiegazione: ${labels}`
        );
        line.addEventListener("click", () => togglePanel(line, group));
        line.addEventListener("keydown", (event) => {
            if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                togglePanel(line, group);
            }
        });
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
            activeLine?.contains(event.target)
        ) {
            return;
        }

        closePanel(false);
    });

    function togglePanel(line, group) {
        if (activeLine === line && !panel.hidden) {
            closePanel(true);
            return;
        }

        openPanel(line, group);
    }

    function openPanel(line, group) {
        if (activeLine) {
            activeLine.setAttribute("aria-expanded", "false");
            activeLine.classList.remove("verso-interattivo-attivo");
        }

        activeLine = line;
        activeGroup = group;
        activeLine.setAttribute("aria-expanded", "true");
        activeLine.classList.add("verso-interattivo-attivo");
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
        if (!activeLine || panel.hidden) {
            return;
        }

        if (window.matchMedia("(max-width: 900px)").matches) {
            panel.style.removeProperty("top");
            panel.style.removeProperty("left");
            return;
        }

        const gap = 18;
        const edge = 16;
        const lineBounds = activeLine.getBoundingClientRect();
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

        const previousLine = activeLine;

        panel.hidden = true;
        activeLine?.setAttribute("aria-expanded", "false");
        activeLine?.classList.remove("verso-interattivo-attivo");
        activeLine = null;
        activeGroup = [];
        activeNarrativeIndex = -1;
        frame.removeAttribute("src");

        if (restoreFocus) {
            previousLine?.focus();
        }
    }
})();
