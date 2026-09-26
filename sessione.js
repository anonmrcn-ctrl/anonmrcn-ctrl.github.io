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

    function showWelcome(complete) {
        if (welcomeDialog) {
            welcomeDialog.button.focus();
            return;
        }

        const previousFocus = document.activeElement;
        const overlay = document.createElement("div");
        const dialog = document.createElement("section");
        const title = document.createElement("h1");
        const content = document.createElement("div");
        const status = document.createElement("p");
        const button = document.createElement("button");

        overlay.className = "benvenuto-overlay";
        dialog.className = "benvenuto-dialogo";
        dialog.setAttribute("role", "dialog");
        dialog.setAttribute("aria-modal", "true");
        dialog.setAttribute("aria-labelledby", "benvenutoTitolo");

        title.id = "benvenutoTitolo";
        title.textContent = "Benvenuto";
        content.className = "benvenuto-contenuto";
        content.setAttribute("data-benvenuto-contenuto", "");
        status.className = "benvenuto-stato";
        status.setAttribute("aria-live", "polite");
        button.type = "button";
        button.className = "benvenuto-continua";
        button.textContent = "Continua";

        dialog.append(title, content, status, button);
        overlay.append(dialog);
        document.body.append(overlay);
        document.body.classList.add("benvenuto-aperto");

        const close = () => {
            overlay.remove();
            document.body.classList.remove("benvenuto-aperto");
            welcomeDialog = null;

            if (previousFocus instanceof HTMLElement) {
                previousFocus.focus();
            }
        };

        button.addEventListener("click", async () => {
            button.disabled = true;
            status.textContent = "Salvataggio…";

            try {
                await complete();
                close();
            } catch (_) {
                status.textContent =
                    "Non è stato possibile continuare. Riprova.";
                button.disabled = false;
                button.focus();
            }
        });

        dialog.addEventListener("keydown", (event) => {
            if (event.key === "Tab") {
                event.preventDefault();
                button.focus();
            }
        });

        welcomeDialog = { overlay, button };
        button.focus();
    }

    window.NNMRCN_SESSION = Object.freeze({
        read,
        write,
        clear,
        showWelcome
    });
})();
