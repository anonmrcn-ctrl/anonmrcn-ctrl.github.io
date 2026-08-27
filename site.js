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

    if (!button || !closeButton || !menu || !overlay) {
        return;
    }

    let keepAccessVisible = false;
    let previouslyFocusedElement = null;

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
        if (event.key === "Escape" && menu.classList.contains("aperto")) {
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
