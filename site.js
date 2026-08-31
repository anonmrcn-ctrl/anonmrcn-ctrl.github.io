(() => {
    "use strict";

    const button = document.getElementById("menuButton");
    const closeButton = document.getElementById("menuClose");
    const menu = document.getElementById("menuPrincipale");
    const overlay = document.getElementById("menuOverlay");
    const accessShortcut = document.getElementById("accessoPasswordLink");
    const passwordInput = document.getElementById("loginPassword");
    const accessSection = document.getElementById("accessoLocations");
    const installSection = document.getElementById("installazioneApp");
    const installButton = document.getElementById("installaAppButton");
    const installInstructions = document.getElementById(
        "installazioneIstruzioni"
    );
    const loginLoggedIn = document.getElementById("loginLoggedIn");
    const locationVisibilityToggle = document.getElementById(
        "locationVisibilityToggle"
    );
    const locationVisibilityStatus = document.getElementById(
        "locationVisibilityStatus"
    );
    const menuContent = menu?.querySelector(".menu-contenuto");
    const themeManager = window.NNMRCN_THEME;
    const settingsManager = window.NNMRCN_SETTINGS;

    if (!button || !closeButton || !menu || !overlay) {
        return;
    }

    let keepAccessVisible = false;
    let previouslyFocusedElement = null;
    let settingsPreviouslyFocusedElement = null;

    const settingsButton = document.createElement("button");
    const settingsOverlay = document.createElement("div");
    const settingsPanel = document.createElement("section");
    const fixedControls = document.createElement("div");

    fixedControls.className = "controlli-fissi";
    fixedControls.setAttribute("role", "group");
    fixedControls.setAttribute("aria-label", "Comandi del sito");

    settingsButton.type = "button";
    settingsButton.className = "impostazioni-button";
    settingsButton.setAttribute("aria-label", "Apri le impostazioni");
    settingsButton.setAttribute("aria-expanded", "false");
    settingsButton.setAttribute("aria-controls", "impostazioniPanel");

    settingsOverlay.className = "impostazioni-overlay";

    settingsPanel.className = "impostazioni-pannello";
    settingsPanel.id = "impostazioniPanel";
    settingsPanel.setAttribute("role", "dialog");
    settingsPanel.setAttribute("aria-modal", "true");
    settingsPanel.setAttribute("aria-labelledby", "impostazioniTitolo");
    settingsPanel.setAttribute("aria-hidden", "true");
    settingsPanel.setAttribute("inert", "");
    settingsPanel.innerHTML = `
        <button class="impostazioni-close" type="button" aria-label="Chiudi le impostazioni">×</button>
        <h2 id="impostazioniTitolo">Impostazioni</h2>
        <section class="impostazioni-gruppo" aria-labelledby="impostazioniTemaTitolo">
            <h3 id="impostazioniTemaTitolo">Aspetto</h3>
            <div class="impostazioni-scelte impostazioni-scelte-3" role="group" aria-label="Tema del sito">
                <button type="button" data-theme-preference="system">Automatico</button>
                <button type="button" data-theme-preference="light">Chiaro</button>
                <button type="button" data-theme-preference="dark">Scuro</button>
            </div>
            <p>La modalità automatica segue le impostazioni del dispositivo.</p>
        </section>
        <section class="impostazioni-gruppo" aria-labelledby="impostazioniLetturaTitolo">
            <h3 id="impostazioniLetturaTitolo">Lettura</h3>
            <p class="impostazioni-etichetta">Dimensione del testo</p>
            <div class="impostazioni-scelte impostazioni-scelte-3" role="group" aria-label="Dimensione del testo">
                <button type="button" data-setting-name="textSize" data-setting-value="normal">Normale</button>
                <button type="button" data-setting-name="textSize" data-setting-value="large">Grande</button>
                <button type="button" data-setting-name="textSize" data-setting-value="xlarge">Molto grande</button>
            </div>
            <p class="impostazioni-etichetta">Movimenti e animazioni</p>
            <div class="impostazioni-scelte impostazioni-scelte-3" role="group" aria-label="Movimenti e animazioni">
                <button type="button" data-setting-name="motion" data-setting-value="system">Automatici</button>
                <button type="button" data-setting-name="motion" data-setting-value="reduce">Ridotti</button>
                <button type="button" data-setting-name="motion" data-setting-value="full">Completi</button>
            </div>
            <p>“Automatici” segue la preferenza di movimento del dispositivo.</p>
        </section>
        <section class="impostazioni-gruppo" aria-labelledby="impostazioniMappaTitolo">
            <h3 id="impostazioniMappaTitolo">Mappa</h3>
            <p class="impostazioni-etichetta">All’apertura mostra</p>
            <div class="impostazioni-scelte impostazioni-scelte-4" role="group" aria-label="Avvio della mappa">
                <button type="button" data-setting-name="mapStartup" data-setting-value="empty">Vuota</button>
                <button type="button" data-setting-name="mapStartup" data-setting-value="today">Oggi</button>
                <button type="button" data-setting-name="mapStartup" data-setting-value="1975">1975</button>
                <button type="button" data-setting-name="mapStartup" data-setting-value="last">Ultima</button>
            </div>
            <p class="impostazioni-etichetta">Caricamento</p>
            <div class="impostazioni-scelte impostazioni-scelte-2" role="group" aria-label="Modalità di caricamento della mappa">
                <button type="button" data-setting-name="mapLite" data-setting-value="off">Normale</button>
                <button type="button" data-setting-name="mapLite" data-setting-value="on">Leggera</button>
            </div>
            <p>La modalità leggera riduce le animazioni e carica i livelli tematici solo quando vengono richiesti. Le modifiche alla mappa valgono dalla prossima apertura.</p>
        </section>
        <section class="impostazioni-gruppo" aria-labelledby="impostazioniPrivacyTitolo">
            <h3 id="impostazioniPrivacyTitolo">Privacy e dati locali</h3>
            <p id="impostazioniLocationStato">Accedi dal MENU per gestire la visibilità della tua location.</p>
            <button class="impostazioni-azione" id="impostazioniLocationButton" type="button" hidden></button>
            <p id="impostazioniDatiStato">Il taccuino non contiene elementi.</p>
            <div class="impostazioni-azioni-locali">
                <button class="impostazioni-azione" id="impostazioniSvuotaTaccuino" type="button">Svuota il taccuino</button>
                <button class="impostazioni-azione" id="impostazioniRipristina" type="button">Ripristina le preferenze</button>
            </div>
            <p class="impostazioni-esito" id="impostazioniEsito" aria-live="polite"></p>
        </section>
    `;

    if (installSection) {
        const installTitle = document.createElement("h3");

        installTitle.textContent = "Applicazione";
        installSection.prepend(installTitle);
        settingsPanel.appendChild(installSection);
    }

    fixedControls.append(settingsButton, button);
    document.body.append(fixedControls, settingsOverlay, settingsPanel);

    const settingsClose = settingsPanel.querySelector(".impostazioni-close");
    const themeButtons = Array.from(settingsPanel.querySelectorAll(
        "[data-theme-preference]"
    ));
    const settingButtons = Array.from(settingsPanel.querySelectorAll(
        "[data-setting-name][data-setting-value]"
    ));
    const settingsLocationButton = settingsPanel.querySelector(
        "#impostazioniLocationButton"
    );
    const settingsLocationStatus = settingsPanel.querySelector(
        "#impostazioniLocationStato"
    );
    const localDataStatus = settingsPanel.querySelector(
        "#impostazioniDatiStato"
    );
    const clearNotebookButton = settingsPanel.querySelector(
        "#impostazioniSvuotaTaccuino"
    );
    const resetPreferencesButton = settingsPanel.querySelector(
        "#impostazioniRipristina"
    );
    const settingsOutcome = settingsPanel.querySelector(
        "#impostazioniEsito"
    );

    function syncThemeButtons() {
        const preference = themeManager?.getPreference?.() || "system";

        themeButtons.forEach((themeButton) => {
            const active = themeButton.dataset.themePreference === preference;

            themeButton.setAttribute("aria-pressed", String(active));
        });
    }

    function syncSettingButtons() {
        settingButtons.forEach((settingButton) => {
            const active = settingsManager?.get?.(
                settingButton.dataset.settingName
            ) === settingButton.dataset.settingValue;

            settingButton.setAttribute("aria-pressed", String(active));
        });
    }

    function notebookItemCount() {
        const notebook = window.NNMRCN_TACCUINO;

        if (notebook?.list) {
            return notebook.list().length;
        }

        try {
            const stored = JSON.parse(
                localStorage.getItem("nnmrcn_taccuino_v1") || "[]"
            );
            return Array.isArray(stored) ? stored.length : 0;
        } catch (_) {
            return 0;
        }
    }

    function syncLocalDataStatus() {
        const count = notebookItemCount();

        localDataStatus.textContent = count === 1
            ? "Il taccuino contiene 1 elemento salvato in questo browser."
            : `Il taccuino contiene ${count} elementi salvati in questo browser.`;
        clearNotebookButton.disabled = count === 0;
    }

    function syncLocationSettings() {
        const loggedIn = Boolean(
            loginLoggedIn &&
            !loginLoggedIn.hidden &&
            locationVisibilityToggle
        );

        settingsLocationButton.hidden = !loggedIn;

        if (!loggedIn) {
            settingsLocationStatus.textContent =
                "Accedi dal MENU per gestire la visibilità della tua location.";
            return;
        }

        const hidden = locationVisibilityToggle.getAttribute(
            "aria-pressed"
        ) === "true";

        settingsLocationButton.textContent =
            locationVisibilityToggle.textContent.trim();
        settingsLocationButton.disabled = locationVisibilityToggle.disabled;
        settingsLocationButton.setAttribute("aria-pressed", String(hidden));
        settingsLocationStatus.textContent =
            locationVisibilityStatus?.textContent.trim() ||
            (hidden
                ? "La tua location non è visibile sulla mappa pubblica."
                : "La tua location è visibile sulla mappa pubblica.");
    }

    function syncPersonalSpaceLink() {
        if (!menuContent) {
            return;
        }

        const loggedIn = Boolean(loginLoggedIn && !loginLoggedIn.hidden);
        let link = menuContent.querySelector("[data-spazio-personale-link]");
        let error = menuContent.querySelector(
            "[data-spazio-personale-errore]"
        );

        if (!link) {
            link = document.createElement("a");
            link.href = "./spazio-personale.html";
            link.textContent = "Spazio privato";
            link.dataset.spazioPersonaleLink = "";

            const publicLink = menuContent.querySelector(
                "[data-spazio-pubblico-link]"
            );

            if (publicLink) {
                publicLink.insertAdjacentElement("afterend", link);
            } else {
                menuContent.appendChild(link);
            }

            link.addEventListener("click", (event) => {
                if (loginLoggedIn && !loginLoggedIn.hidden) {
                    return;
                }

                event.preventDefault();

                const currentError = menuContent.querySelector(
                    "[data-spazio-personale-errore]"
                );

                if (currentError) {
                    currentError.hidden = false;
                    link.setAttribute(
                        "aria-describedby",
                        currentError.id
                    );
                }
            });
        }

        if (!error) {
            error = document.createElement("p");
            error.id = "spazioPersonaleErrore";
            error.className = "login-message";
            error.dataset.spazioPersonaleErrore = "";
            error.setAttribute("role", "alert");
            error.textContent =
                "Accesso richiesto: completa prima l’accesso con la password della poesia.";
            error.hidden = true;
            link.insertAdjacentElement("afterend", error);
        }

        link.dataset.accesso = loggedIn ? "completato" : "richiesto";

        if (loggedIn) {
            error.hidden = true;
            link.removeAttribute("aria-describedby");
        }

        const personalSpacePage = document.body.classList.contains(
            "pagina-spazio-personale"
        );
        const personalAreaPage = personalSpacePage ||
            document.body.classList.contains("pagina-taccuino");

        link.classList.toggle("voce-attiva", personalAreaPage);

        if (personalAreaPage) {
            link.setAttribute(
                "aria-current",
                personalSpacePage ? "page" : "location"
            );
        } else {
            link.removeAttribute("aria-current");
        }
    }

    function syncAllSettings() {
        syncThemeButtons();
        syncSettingButtons();
        syncLocationSettings();
        syncLocalDataStatus();
        syncPersonalSpaceLink();
    }

    function openSettings() {
        if (menu.classList.contains("aperto")) {
            closeMenu();
        }

        settingsPreviouslyFocusedElement = document.activeElement;
        settingsPanel.removeAttribute("inert");
        settingsPanel.setAttribute("aria-hidden", "false");
        settingsPanel.classList.add("aperto");
        settingsOverlay.classList.add("aperto");
        settingsButton.setAttribute("aria-expanded", "true");
        document.body.classList.add("impostazioni-aperte");
        settingsOutcome.textContent = "";
        syncAllSettings();
        settingsClose.focus({ preventScroll: true });
    }

    function closeSettings() {
        const wasOpen = settingsPanel.classList.contains("aperto");

        settingsPanel.classList.remove("aperto");
        settingsOverlay.classList.remove("aperto");
        settingsPanel.setAttribute("aria-hidden", "true");
        settingsPanel.setAttribute("inert", "");
        settingsButton.setAttribute("aria-expanded", "false");
        document.body.classList.remove("impostazioni-aperte");

        if (wasOpen && settingsPreviouslyFocusedElement?.focus) {
            settingsPreviouslyFocusedElement.focus({ preventScroll: true });
        }
    }

    settingsButton.addEventListener("click", openSettings);
    settingsClose.addEventListener("click", closeSettings);
    settingsOverlay.addEventListener("click", closeSettings);

    themeButtons.forEach((themeButton) => {
        themeButton.addEventListener("click", () => {
            themeManager?.setPreference?.(
                themeButton.dataset.themePreference
            );
            syncThemeButtons();
        });
    });

    settingButtons.forEach((settingButton) => {
        settingButton.addEventListener("click", () => {
            settingsManager?.set?.(
                settingButton.dataset.settingName,
                settingButton.dataset.settingValue
            );
            syncSettingButtons();
        });
    });

    settingsLocationButton.addEventListener("click", () => {
        if (!locationVisibilityToggle || loginLoggedIn?.hidden) {
            return;
        }

        locationVisibilityToggle.click();
        window.setTimeout(syncLocationSettings, 0);
    });

    clearNotebookButton.addEventListener("click", () => {
        const count = notebookItemCount();

        if (
            count === 0 ||
            !window.confirm(
                `Vuoi rimuovere ${count === 1 ? "l’elemento" : `tutti i ${count} elementi`} dal taccuino?`
            )
        ) {
            return;
        }

        window.NNMRCN_TACCUINO?.clear?.();

        if (!window.NNMRCN_TACCUINO) {
            try {
                localStorage.removeItem("nnmrcn_taccuino_v1");
            } catch (_) {
                // Il dato non è accessibile in questo browser.
            }
        }

        syncLocalDataStatus();
        settingsOutcome.textContent = "Il taccuino è stato svuotato.";
    });

    resetPreferencesButton.addEventListener("click", () => {
        if (!window.confirm(
            "Vuoi ripristinare tema, lettura e preferenze della mappa? Il taccuino e l’accesso non verranno cancellati."
        )) {
            return;
        }

        themeManager?.reset?.();
        settingsManager?.reset?.();
        syncAllSettings();
        settingsOutcome.textContent = "Le preferenze sono state ripristinate.";
    });

    window.addEventListener("nnmrcn:themechange", syncThemeButtons);
    window.addEventListener("nnmrcn:settingschange", syncSettingButtons);
    document.addEventListener("nnmrcn:taccuinochange", syncLocalDataStatus);
    document.addEventListener("nnmrcn:sessionchange", syncPersonalSpaceLink);

    if (loginLoggedIn && locationVisibilityToggle) {
        const locationObserver = new MutationObserver(() => {
            syncLocationSettings();
            syncPersonalSpaceLink();
        });

        locationObserver.observe(loginLoggedIn, {
            attributes: true,
            attributeFilter: ["hidden"]
        });
        locationObserver.observe(locationVisibilityToggle, {
            attributes: true,
            attributeFilter: ["aria-pressed", "disabled"],
            childList: true,
            subtree: true
        });

        if (locationVisibilityStatus) {
            locationObserver.observe(locationVisibilityStatus, {
                childList: true,
                characterData: true,
                subtree: true
            });
        }
    }

    syncAllSettings();

    menu.setAttribute("aria-hidden", "true");
    menu.setAttribute("inert", "");

    function fitMenuToViewport() {
        const visualViewport = window.visualViewport;

        if (visualViewport) {
            const visibleBottom =
                visualViewport.height + Math.max(visualViewport.offsetTop || 0, 0);

            menu.style.setProperty(
                "--menu-visible-height",
                `${Math.round(visibleBottom)}px`
            );
        }

        if (keepAccessVisible && menu.classList.contains("aperto")) {
            (accessSection || passwordInput).scrollIntoView({
                block: "center",
                inline: "nearest"
            });
        }
    }

    function openMenu() {
        previouslyFocusedElement = document.activeElement;
        menu.removeAttribute("inert");
        menu.setAttribute("aria-hidden", "false");
        menu.classList.add("aperto");
        overlay.classList.add("aperto");
        button.setAttribute("aria-expanded", "true");
        document.body.classList.add("menu-aperto");
        fitMenuToViewport();
        closeButton.focus({ preventScroll: true });
    }

    function closeMenu() {
        const wasOpen = menu.classList.contains("aperto");

        keepAccessVisible = false;
        menu.classList.remove("aperto");
        overlay.classList.remove("aperto");
        menu.setAttribute("aria-hidden", "true");
        menu.setAttribute("inert", "");
        button.setAttribute("aria-expanded", "false");
        document.body.classList.remove("menu-aperto");

        if (wasOpen && previouslyFocusedElement?.focus) {
            previouslyFocusedElement.focus({ preventScroll: true });
        }
    }

    button.addEventListener("click", openMenu);
    closeButton.addEventListener("click", closeMenu);
    overlay.addEventListener("click", closeMenu);

    if (window.visualViewport) {
        window.visualViewport.addEventListener("resize", fitMenuToViewport);
        window.visualViewport.addEventListener("scroll", fitMenuToViewport);
        fitMenuToViewport();
    }

    if (passwordInput) {
        passwordInput.addEventListener("focus", () => {
            keepAccessVisible = true;
            fitMenuToViewport();
        });

        passwordInput.addEventListener("blur", () => {
            keepAccessVisible = false;
        });
    }

    if (accessShortcut && passwordInput) {
        accessShortcut.addEventListener("click", (event) => {
            event.preventDefault();
            openMenu();
            keepAccessVisible = true;
            passwordInput.focus({ preventScroll: true });
            fitMenuToViewport();
            window.setTimeout(fitMenuToViewport, 350);
        });
    }

    document.addEventListener("keydown", (event) => {
        if (event.key !== "Escape") {
            return;
        }

        if (settingsPanel.classList.contains("aperto")) {
            closeSettings();
        } else if (menu.classList.contains("aperto")) {
            closeMenu();
        }
    });

    menu.addEventListener("keydown", (event) => {
        if (event.key !== "Tab" || !menu.classList.contains("aperto")) {
            return;
        }

        const focusableElements = Array.from(menu.querySelectorAll(
            "a[href], button:not([disabled]), input:not([disabled]), " +
            "select:not([disabled]), textarea:not([disabled]), " +
            '[tabindex]:not([tabindex="-1"])'
        ));

        if (!focusableElements.length) {
            event.preventDefault();
            closeButton.focus();
            return;
        }

        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        if (event.shiftKey && document.activeElement === firstElement) {
            event.preventDefault();
            lastElement.focus();
        } else if (!event.shiftKey && document.activeElement === lastElement) {
            event.preventDefault();
            firstElement.focus();
        }
    });

    settingsPanel.addEventListener("keydown", (event) => {
        if (event.key !== "Tab" || !settingsPanel.classList.contains("aperto")) {
            return;
        }

        const focusableElements = Array.from(settingsPanel.querySelectorAll(
            "button:not([disabled]), input:not([disabled]), " +
            "select:not([disabled]), textarea:not([disabled]), " +
            'a[href], [tabindex]:not([tabindex="-1"])'
        ));

        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        if (!firstElement || !lastElement) {
            return;
        }

        if (event.shiftKey && document.activeElement === firstElement) {
            event.preventDefault();
            lastElement.focus();
        } else if (!event.shiftKey && document.activeElement === lastElement) {
            event.preventDefault();
            firstElement.focus();
        }
    });

    if (!installSection || !installButton || !installInstructions) {
        return;
    }

    let deferredInstallPrompt = null;
    const standaloneDisplay = typeof window.matchMedia === "function"
        ? window.matchMedia("(display-mode: standalone)")
        : null;

    function isStandalone() {
        return standaloneDisplay?.matches || navigator.standalone === true;
    }

    function showInstructions() {
        const userAgent = navigator.userAgent || "";
        const appleMobile =
            /iPad|iPhone|iPod/u.test(userAgent) ||
            (
                navigator.platform === "MacIntel" &&
                Number(navigator.maxTouchPoints || 0) > 1
            );

        if (appleMobile) {
            installInstructions.textContent =
                "Apri Condividi, scegli «Aggiungi alla schermata Home», " +
                "attiva «Apri come app web» e tocca «Aggiungi».";
        } else if (/Android/u.test(userAgent)) {
            installInstructions.textContent =
                "Apri il menu del browser e scegli «Installa app» oppure " +
                "«Aggiungi alla schermata Home».";
        } else if (
            /Macintosh/u.test(userAgent) &&
            /Safari/u.test(userAgent) &&
            !/Chrome|Chromium|Edg/u.test(userAgent)
        ) {
            installInstructions.textContent =
                "In Safari apri il menu «File» e scegli «Aggiungi al Dock».";
        } else {
            installInstructions.textContent =
                "Apri il menu del browser e scegli «Installa app» oppure " +
                "«Installa pagina come app».";
        }

        installInstructions.hidden = false;
    }

    function hideInstallButton() {
        deferredInstallPrompt = null;
        installSection.hidden = true;
        installInstructions.hidden = true;
    }

    if (isStandalone()) {
        hideInstallButton();
    }

    window.addEventListener("beforeinstallprompt", (event) => {
        event.preventDefault();
        deferredInstallPrompt = event;
        installSection.hidden = false;
        installInstructions.hidden = true;
    });

    window.addEventListener("appinstalled", hideInstallButton);

    standaloneDisplay?.addEventListener?.("change", (event) => {
        if (event.matches) {
            hideInstallButton();
        }
    });

    installButton.addEventListener("click", async () => {
        if (!deferredInstallPrompt) {
            showInstructions();
            return;
        }

        installButton.disabled = true;

        try {
            const prompt = deferredInstallPrompt;
            const result = await prompt.prompt();
            const choice = result?.outcome
                ? result
                : await prompt.userChoice;

            deferredInstallPrompt = null;

            if (choice?.outcome === "accepted") {
                hideInstallButton();
            } else {
                installInstructions.textContent = "Installazione annullata.";
                installInstructions.hidden = false;
            }
        } catch (_) {
            deferredInstallPrompt = null;
            showInstructions();
        } finally {
            installButton.disabled = false;
        }
    });
})();
