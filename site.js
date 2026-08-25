(() => {
    "use strict";

    const button = document.getElementById("menuButton");
    const closeButton = document.getElementById("menuClose");
    const menu = document.getElementById("menuPrincipale");
    const overlay = document.getElementById("menuOverlay");
    const installSection = document.getElementById("installazioneApp");
    const installButton = document.getElementById("installaAppButton");
    const installInstructions = document.getElementById(
        "installazioneIstruzioni"
    );

    if (!button || !closeButton || !menu || !overlay) {
        return;
    }

    function openMenu() {
        menu.classList.add("aperto");
        overlay.classList.add("aperto");
        button.setAttribute("aria-expanded", "true");
        document.body.classList.add("menu-aperto");
    }

    function closeMenu() {
        menu.classList.remove("aperto");
        overlay.classList.remove("aperto");
        button.setAttribute("aria-expanded", "false");
        document.body.classList.remove("menu-aperto");
    }

    button.addEventListener("click", openMenu);
    closeButton.addEventListener("click", closeMenu);
    overlay.addEventListener("click", closeMenu);

    document.addEventListener("keydown", (event) => {
        if (event.key === "Escape") {
            closeMenu();
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
