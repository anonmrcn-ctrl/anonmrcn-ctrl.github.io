(() => {
    "use strict";

    const SESSION_KEY = "nnmrcn_session";
    let welcomeDialog = null;

    function read() {
        try {
            const persistentToken = localStorage.getItem(SESSION_KEY) || "";

            if (persistentToken) {
                return persistentToken;
            }

            const legacyToken = sessionStorage.getItem(SESSION_KEY) || "";

            if (legacyToken) {
                localStorage.setItem(SESSION_KEY, legacyToken);
                sessionStorage.removeItem(SESSION_KEY);
            }

            return legacyToken;
        } catch (_) {
            try {
                return sessionStorage.getItem(SESSION_KEY) || "";
            } catch (_) {
                return "";
            }
        }
    }

    function write(token) {
        const value = String(token || "").trim();

        if (!value) {
            clear();
            return;
        }

        try {
            localStorage.setItem(SESSION_KEY, value);
            sessionStorage.removeItem(SESSION_KEY);
        } catch (_) {
            try {
                sessionStorage.setItem(SESSION_KEY, value);
            } catch (_) {}
        }
    }

    function clear() {
        try {
            localStorage.removeItem(SESSION_KEY);
        } catch (_) {}

        try {
            sessionStorage.removeItem(SESSION_KEY);
        } catch (_) {}
    }

    const WELCOME_FEATURES = Object.freeze([
        {
            title: "La poesia, punto di partenza",
            description:
                "Leggi i quattro canti e apri i passaggi collegati ai luoghi. Gli approfondimenti seguono la poesia senza interromperne il ritmo.",
            details: [
                "Indice rapido dei quattro canti",
                "Versi collegati alla mappa e agli approfondimenti",
                "Contenuti salvabili nel taccuino"
            ],
            preview: "./index.html?onboarding-preview=1#I",
            alt:
                "Schermata della poesia con indicazioni sull’indice dei canti, sui versi interattivi e sui comandi del sito.",
            markers: [
                { label: "Indice dei canti", x: "37%", y: "90%" },
                { label: "Versi interattivi", x: "38%", y: "38%", tone: "yellow" },
                { label: "Menu e impostazioni", x: "69%", y: "12%" }
            ]
        },
        {
            title: "La mappa di Marcon",
            description:
                "Esplora i luoghi della poesia e del territorio, confronta la situazione attuale con il 1975 e attiva percorsi, fiumi, cave e altri livelli.",
            details: [
                "Confronto tra oggi e la mappa storica del 1975",
                "Livelli territoriali e percorsi",
                "Guida narrativa collegata ai versi"
            ],
            preview: "./progetto.html?onboarding-preview=1#map",
            alt:
                "Schermata della mappa con indicazioni sul confronto storico, sui livelli e sulla guida narrativa.",
            markers: [
                { label: "Oggi / 1975", x: "11%", y: "18%", tone: "yellow" },
                { label: "Livelli della mappa", x: "68%", y: "17%" },
                { label: "Esplora la poesia", x: "56%", y: "79%", tone: "red" }
            ]
        },
        {
            title: "Uno spazio pubblico condiviso",
            description:
                "La parte collettiva raccoglie memorie degli abitanti, messaggi resi pubblici con consenso e voci dedicate ai luoghi e alla storia di Marcon.",
            details: [
                "Memorie: ricordi, immagini e suoni",
                "Archivio: messaggi pubblicati con consenso",
                "Voci: schede territoriali collegate tra loro"
            ],
            preview: "./spazio-pubblico.html?onboarding-preview=1",
            alt:
                "Schermata dello spazio pubblico con indicazioni sulle sezioni Memorie, Archivio e Voci.",
            markers: [
                { label: "Memorie", x: "13%", y: "61%" },
                { label: "Archivio", x: "42%", y: "61%", tone: "yellow" },
                { label: "Voci", x: "70%", y: "61%" }
            ]
        },
        {
            title: "Accesso, messaggi e taccuino",
            description:
                "La password consegnata con la poesia sblocca le locations e lo spazio personale: da qui puoi scrivere ad altre locations e conservare ciò che incontri.",
            details: [
                "Messaggi online o destinati alla consegna fisica",
                "Visibilità della propria location controllabile",
                "Taccuino salvato soltanto sul dispositivo"
            ],
            preview:
                "./index.html?onboarding-preview=1&onboarding-menu=1",
            alt:
                "Menu del sito aperto con indicazioni sull’accesso alle locations, sullo spazio privato e sulle impostazioni.",
            markers: [
                { label: "Spazio privato", x: "47%", y: "38%" },
                { label: "Accesso alle locations", x: "48%", y: "69%", tone: "yellow" },
                { label: "Controlli e privacy", x: "70%", y: "12%", tone: "red" }
            ]
        },
        {
            title: "Sostieni il progetto",
            description:
                "Basta una condivisione: fai conoscere anonMrcn a chi vive, ha vissuto o attraversa Marcon.",
            details: [
                "Condividi il sito con una persona interessata a Marcon",
                "Aiuta nuove memorie e testimonianze a raggiungere il progetto"
            ],
            preview:
                "./index.html?onboarding-preview=1&onboarding-menu=1",
            alt:
                "Menu del sito aperto con l’indicazione per sostenere e condividere il progetto anonMrcn.",
            markers: [
                { label: "Basta una condivisione", x: "48%", y: "17%", tone: "yellow" }
            ]
        }
    ]);

    function showWelcome(complete, options = {}) {
        if (welcomeDialog) {
            welcomeDialog.focus();
            return;
        }

        const preview = options.preview === true;
        const cancelAccess = typeof options.cancel === "function"
            ? options.cancel
            : null;
        const previousFocus = document.activeElement;
        const overlay = document.createElement("div");
        const dialog = document.createElement("section");
        const intro = document.createElement("div");
        const logoLink = document.createElement("a");
        const logo = document.createElement("img");
        const title = document.createElement("h1");
        const subtitle = document.createElement("p");
        const actions = document.createElement("div");
        const status = document.createElement("p");
        const exploreButton = document.createElement("button");
        const discoverButton = document.createElement("button");
        const cancelButton = document.createElement("button");
        const tour = document.createElement("div");
        const tourHeader = document.createElement("header");
        const tourBrand = document.createElement("div");
        const tourLogoLink = document.createElement("a");
        const tourLogo = document.createElement("img");
        const tourName = document.createElement("span");
        const tourCounter = document.createElement("span");
        const tourMeta = document.createElement("div");
        const tourCancelButton = document.createElement("button");
        const scroller = document.createElement("div");
        const tourFooter = document.createElement("footer");
        const previousButton = document.createElement("button");
        const indicators = document.createElement("div");
        const nextButton = document.createElement("button");
        let activeIndex = 0;
        let scrollFrame = 0;

        overlay.className = "benvenuto-overlay";
        dialog.className = "benvenuto-dialogo";
        dialog.setAttribute("role", "dialog");
        dialog.setAttribute("aria-modal", "true");
        dialog.setAttribute("aria-labelledby", "benvenutoTitolo");

        intro.className = "benvenuto-pagina benvenuto-intro";
        logoLink.className = "benvenuto-logo-link";
        logoLink.href = "./logo.html";
        logoLink.setAttribute("aria-label", "Scopri il significato del logo");
        logo.className = "benvenuto-logo";
        logo.src = "./logo.webp?v=20261001-logo2";
        logo.alt = "Logo di anonMrcn";
        title.id = "benvenutoTitolo";
        title.textContent = "Benvenuto nel sito anonMrcn";
        subtitle.className = "benvenuto-sottotitolo";
        subtitle.textContent =
            "Un progetto artistico dedicato alla città di Marcon.";
        actions.className = "benvenuto-azioni";
        status.className = "benvenuto-stato";
        status.setAttribute("aria-live", "polite");
        exploreButton.type = "button";
        exploreButton.className =
            "benvenuto-azione benvenuto-azione-primaria";
        exploreButton.textContent = "Esplora il sito";
        discoverButton.type = "button";
        discoverButton.className = "benvenuto-azione";
        discoverButton.textContent = "Scopri le funzionalità";
        actions.append(exploreButton, discoverButton);
        logoLink.append(logo);
        intro.append(logoLink, title, subtitle, actions);

        if (cancelAccess) {
            cancelButton.type = "button";
            cancelButton.className = "benvenuto-annulla-accesso";
            cancelButton.textContent = "Annulla l’accesso";
            intro.append(cancelButton);
        }

        intro.append(status);

        tour.className = "benvenuto-pagina benvenuto-tour";
        tour.hidden = true;
        tourHeader.className = "benvenuto-tour-intestazione";
        tourBrand.className = "benvenuto-tour-marchio";
        tourLogoLink.className = "benvenuto-tour-logo-link";
        tourLogoLink.href = "./logo.html";
        tourLogoLink.setAttribute("aria-label", "Scopri il significato del logo");
        tourLogo.src = "./logo.webp?v=20261001-logo2";
        tourLogo.alt = "";
        tourName.textContent = "anonMrcn";
        tourCounter.className = "benvenuto-tour-contatore";
        tourCounter.setAttribute("aria-live", "polite");
        tourLogoLink.append(tourLogo);
        tourBrand.append(tourLogoLink, tourName);
        tourMeta.className = "benvenuto-tour-meta";
        tourMeta.append(tourCounter);

        if (cancelAccess) {
            tourCancelButton.type = "button";
            tourCancelButton.className = "benvenuto-tour-annulla";
            tourCancelButton.textContent = "Annulla l’accesso";
            tourMeta.append(tourCancelButton);
        }

        tourHeader.append(tourBrand, tourMeta);
        scroller.className = "benvenuto-tour-scroller";
        scroller.setAttribute("aria-label", "Funzionalità principali del sito");

        WELCOME_FEATURES.forEach((feature, index) => {
            const page = document.createElement("article");
            const figure = document.createElement("figure");
            const image = document.createElement("iframe");
            const text = document.createElement("div");
            const heading = document.createElement("h2");
            const description = document.createElement("p");
            const list = document.createElement("ul");

            page.className = "benvenuto-funzionalita";
            page.dataset.welcomeIndex = String(index);
            figure.className = "benvenuto-immagine";
            figure.setAttribute("role", "img");
            figure.setAttribute("aria-label", feature.alt);
            image.src = feature.preview;
            image.title = feature.alt;
            image.tabIndex = -1;
            image.setAttribute("aria-hidden", "true");
            image.loading = index === 0 ? "eager" : "lazy";
            figure.append(image);

            feature.markers.forEach((marker) => {
                const callout = document.createElement("span");

                callout.className = "benvenuto-indicazione";
                if (marker.tone === "yellow") {
                    callout.classList.add("benvenuto-indicazione-gialla");
                } else if (marker.tone === "red") {
                    callout.classList.add("benvenuto-indicazione-rossa");
                }
                callout.style.setProperty("--indicazione-x", marker.x);
                callout.style.setProperty("--indicazione-y", marker.y);
                callout.textContent = marker.label;
                figure.append(callout);
            });

            text.className = "benvenuto-funzionalita-testo";
            heading.textContent = feature.title;
            description.textContent = feature.description;
            feature.details.forEach((detail) => {
                const item = document.createElement("li");

                item.textContent = detail;
                list.append(item);
            });
            text.append(heading, description, list);
            page.append(figure, text);
            scroller.append(page);
        });

        tourFooter.className = "benvenuto-tour-piedipagina";
        previousButton.type = "button";
        previousButton.className = "benvenuto-azione";
        previousButton.textContent = "Indietro";
        indicators.className = "benvenuto-tour-indicatori";
        indicators.setAttribute("role", "group");
        indicators.setAttribute("aria-label", "Pagine del tour");
        WELCOME_FEATURES.forEach((feature, index) => {
            const indicator = document.createElement("button");

            indicator.type = "button";
            indicator.className = "benvenuto-tour-indicatore";
            indicator.setAttribute(
                "aria-label",
                `Vai a ${index + 1}: ${feature.title}`
            );
            indicator.addEventListener("click", () => goTo(index));
            indicators.append(indicator);
        });
        nextButton.type = "button";
        nextButton.className =
            "benvenuto-azione benvenuto-azione-primaria";
        tourFooter.append(previousButton, indicators, nextButton);
        tour.append(tourHeader, scroller, tourFooter);

        dialog.append(intro, tour);

        if (preview) {
            const previewLabel = document.createElement("span");
            const previewClose = document.createElement("button");

            previewLabel.className = "benvenuto-anteprima-etichetta";
            previewLabel.textContent = "Anteprima admin";
            previewClose.type = "button";
            previewClose.className = "benvenuto-anteprima-close";
            previewClose.setAttribute("aria-label", "Chiudi l’anteprima");
            previewClose.textContent = "×";
            previewClose.addEventListener("click", close);
            dialog.append(previewLabel, previewClose);
        }

        overlay.append(dialog);
        document.body.append(overlay);
        document.body.classList.add("benvenuto-aperto");

        function close() {
            window.cancelAnimationFrame(scrollFrame);
            overlay.remove();
            document.body.classList.remove("benvenuto-aperto");
            welcomeDialog = null;

            if (previousFocus instanceof HTMLElement) {
                previousFocus.focus();
            }
        }

        function focusableElements() {
            return Array.from(dialog.querySelectorAll(
                "button:not([disabled]), a[href], input:not([disabled]), [tabindex]:not([tabindex='-1'])"
            )).filter((element) => !element.closest("[hidden]"));
        }

        function updateTour() {
            const dots = Array.from(indicators.children);
            const last = activeIndex === WELCOME_FEATURES.length - 1;

            tourCounter.textContent =
                `${activeIndex + 1} di ${WELCOME_FEATURES.length}`;
            previousButton.disabled = activeIndex === 0;
            nextButton.textContent = last ? "Esplora il sito" : "Avanti";
            dots.forEach((dot, index) => {
                if (index === activeIndex) {
                    dot.setAttribute("aria-current", "step");
                } else {
                    dot.removeAttribute("aria-current");
                }
            });
        }

        function goTo(index) {
            activeIndex = Math.max(
                0,
                Math.min(WELCOME_FEATURES.length - 1, index)
            );
            scroller.scrollTo({
                left: activeIndex * scroller.clientWidth,
                behavior: "smooth"
            });
            updateTour();
        }

        async function completeAndClose(button) {
            const buttons = Array.from(dialog.querySelectorAll("button"));

            buttons.forEach((item) => {
                item.disabled = true;
            });
            status.textContent = preview ? "Chiusura anteprima…" : "Salvataggio…";

            try {
                await Promise.resolve(complete());
                close();
            } catch (_) {
                status.textContent =
                    "Non è stato possibile continuare. Riprova.";
                buttons.forEach((item) => {
                    item.disabled = false;
                });
                updateTour();
                button.focus();
            }
        }

        async function cancelAndClose(button) {
            const buttons = Array.from(dialog.querySelectorAll("button"));
            const originalLabel = button.textContent;

            buttons.forEach((item) => {
                item.disabled = true;
            });
            button.textContent = "Uscita in corso…";
            status.textContent = "Uscita in corso…";

            try {
                await Promise.resolve(cancelAccess());
                close();
            } catch (_) {
                status.textContent = "Non è stato possibile uscire. Riprova.";
                button.textContent = originalLabel;
                buttons.forEach((item) => {
                    item.disabled = false;
                });
                updateTour();
                button.focus();
            }
        }

        exploreButton.addEventListener("click", () => {
            completeAndClose(exploreButton);
        });

        discoverButton.addEventListener("click", () => {
            intro.hidden = true;
            tour.hidden = false;
            activeIndex = 0;
            scroller.scrollLeft = 0;
            updateTour();
            nextButton.focus();
        });

        if (cancelAccess) {
            cancelButton.addEventListener("click", () => {
                cancelAndClose(cancelButton);
            });
            tourCancelButton.addEventListener("click", () => {
                cancelAndClose(tourCancelButton);
            });
        }

        previousButton.addEventListener("click", () => {
            goTo(activeIndex - 1);
        });

        nextButton.addEventListener("click", () => {
            if (activeIndex === WELCOME_FEATURES.length - 1) {
                completeAndClose(nextButton);
            } else {
                goTo(activeIndex + 1);
            }
        });

        scroller.addEventListener("scroll", () => {
            window.cancelAnimationFrame(scrollFrame);
            scrollFrame = window.requestAnimationFrame(() => {
                if (!scroller.clientWidth) {
                    return;
                }

                const nextIndex = Math.round(
                    scroller.scrollLeft / scroller.clientWidth
                );

                if (nextIndex !== activeIndex) {
                    activeIndex = Math.max(
                        0,
                        Math.min(WELCOME_FEATURES.length - 1, nextIndex)
                    );
                    updateTour();
                }
            });
        }, { passive: true });

        dialog.addEventListener("keydown", (event) => {
            if (event.key === "Escape" && preview) {
                event.preventDefault();
                close();
                return;
            }

            if (event.key === "Tab") {
                const focusable = focusableElements();
                const first = focusable[0];
                const last = focusable[focusable.length - 1];

                if (!first || !last) {
                    return;
                }

                if (event.shiftKey && document.activeElement === first) {
                    event.preventDefault();
                    last.focus();
                } else if (!event.shiftKey && document.activeElement === last) {
                    event.preventDefault();
                    first.focus();
                }
            }
        });

        welcomeDialog = {
            overlay,
            focus: () => {
                const focusable = focusableElements();
                (focusable[0] || dialog).focus();
            }
        };
        updateTour();
        exploreButton.focus();
    }

    window.NNMRCN_SESSION = Object.freeze({
        read,
        write,
        clear,
        showWelcome
    });
})();
