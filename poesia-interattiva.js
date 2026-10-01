(() => {
    "use strict";

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

        linkToponyms(line, group);
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

        if (window.matchMedia("(max-width: 900px)").matches) {
            panel.style.removeProperty("top");
            panel.style.removeProperty("left");
            return;
        }

        const gap = 18;
        const edge = 16;
        const lineBounds = activeTrigger.getBoundingClientRect();
        const panelBounds = panel.getBoundingClientRect();
        const poemBounds = poem.getBoundingClientRect();
        const left = Math.max(
            edge,
            Math.min(
                poemBounds.left - panelBounds.width - gap,
                window.innerWidth - panelBounds.width - edge
            )
        );
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
