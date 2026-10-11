(() => {
    "use strict";

    const STORAGE_KEY = "nnmrcn_telemetry_consent_v1";
    const ALLOW = "allow";
    const DENY = "deny";
    const PROTECTED_PATHS = new Set([
        "/accesso.html",
        "/admin.html",
        "/spazio-personale.html",
        "/taccuino.html"
    ]);
    let goatCounterLoaded = false;

    if (PROTECTED_PATHS.has(window.location.pathname)) {
        return;
    }

    function readChoice() {
        try {
            const choice = window.localStorage.getItem(STORAGE_KEY);
            return choice === ALLOW || choice === DENY ? choice : "";
        } catch (_) {
            return "";
        }
    }

    function saveChoice(choice) {
        try {
            window.localStorage.setItem(STORAGE_KEY, choice);
        } catch (_) {
            return false;
        }
        window.dispatchEvent(new CustomEvent("nnmrcn:telemetryconsent", {
            detail: { allowed: choice === ALLOW }
        }));
        return true;
    }

    function loadGoatCounter() {
        if (goatCounterLoaded || readChoice() !== ALLOW) {
            return;
        }
        goatCounterLoaded = true;
        window.goatcounter = {
            ...(window.goatcounter || {}),
            no_events: true,
            path: () => window.location.pathname,
            referrer: () => "",
            title: () => ""
        };
        const script = document.createElement("script");
        script.async = true;
        script.src = "./goatcounter.js?v=20261011-privacy2";
        script.dataset.goatcounter = "https://anonmrcn.goatcounter.com/count";
        script.dataset.goatcounterSettings = JSON.stringify({ no_events: true });
        document.head.appendChild(script);
    }

    function closePanel() {
        document.getElementById("privacyTelemetryPanel")?.remove();
        document.getElementById("privacyTelemetryOpen")?.focus();
    }

    function choose(choice) {
        saveChoice(choice);
        if (choice === DENY && window.goatcounter) {
            window.goatcounter.filter = () => "consent revoked";
        }
        closePanel();
        if (choice === ALLOW) {
            loadGoatCounter();
        }
        updateButtonLabel();
    }

    function updateButtonLabel() {
        const button = document.getElementById("privacyTelemetryOpen");
        if (!button) return;
        button.textContent = readChoice() === ALLOW
            ? "Statistiche consentite"
            : "Privacy e statistiche";
    }

    function openPanel() {
        if (document.getElementById("privacyTelemetryPanel")) {
            return;
        }
        const panel = document.createElement("section");
        panel.className = "privacy-telemetry-panel";
        panel.id = "privacyTelemetryPanel";
        panel.setAttribute("role", "dialog");
        panel.setAttribute("aria-modal", "true");
        panel.setAttribute("aria-labelledby", "privacyTelemetryTitle");
        panel.innerHTML = `
            <h2 id="privacyTelemetryTitle">Statistiche rispettose della privacy</h2>
            <p>Il sito funziona senza statistiche. Se acconsenti, invia a GoatCounter soltanto il percorso della pagina, senza query, referrer, titolo o eventi di clic.</p>
            <p>La scelta resta su questo dispositivo e puoi cambiarla in qualsiasi momento. <a href="./privacy.html">Leggi l’informativa</a>.</p>
            <div class="privacy-telemetry-actions">
                <button type="button" data-telemetry-choice="deny">Solo necessari</button>
                <button type="button" data-telemetry-choice="allow">Consenti statistiche aggregate</button>
            </div>
        `;
        panel.querySelector('[data-telemetry-choice="deny"]')
            .addEventListener("click", () => choose(DENY));
        panel.querySelector('[data-telemetry-choice="allow"]')
            .addEventListener("click", () => choose(ALLOW));
        document.body.appendChild(panel);
        panel.querySelector("button")?.focus();
    }

    function mountControls() {
        const button = document.createElement("button");
        button.className = "privacy-telemetry-open";
        button.id = "privacyTelemetryOpen";
        button.type = "button";
        button.addEventListener("click", openPanel);
        document.body.appendChild(button);
        updateButtonLabel();

        if (!readChoice()) {
            openPanel();
        } else {
            loadGoatCounter();
        }
    }

    window.NNMRCN_PRIVACY_TELEMETRY = Object.freeze({
        key: STORAGE_KEY,
        allowed: () => readChoice() === ALLOW
    });

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", mountControls, { once: true });
    } else {
        mountControls();
    }
})();
