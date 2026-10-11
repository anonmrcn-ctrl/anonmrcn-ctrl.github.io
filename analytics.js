(() => {
    "use strict";

    const token = String(window.NNMRCN_ANALYTICS_TOKEN || "").trim();
    const consentKey = "nnmrcn_telemetry_consent_v1";
    const protectedPaths = new Set([
        "/accesso.html",
        "/admin.html",
        "/spazio-personale.html",
        "/taccuino.html"
    ]);
    const localHosts = new Set(["localhost", "127.0.0.1"]);
    const parameters = new URLSearchParams(window.location.search);
    const isEmbeddedPreview =
        parameters.has("onboarding-preview") ||
        parameters.has("poesia-mini");

    let loaded = false;

    function consentAllowed() {
        try {
            return window.localStorage.getItem(consentKey) === "allow";
        } catch (_) {
            return false;
        }
    }

    function load() {
        if (
            loaded ||
            !token ||
            !consentAllowed() ||
            protectedPaths.has(window.location.pathname) ||
            isEmbeddedPreview ||
            localHosts.has(window.location.hostname)
        ) {
            return;
        }
        loaded = true;

        const beacon = document.createElement("script");
        beacon.defer = true;
        beacon.src = "https://static.cloudflareinsights.com/beacon.min.js";
        beacon.dataset.cfBeacon = JSON.stringify({ token });
        document.head.appendChild(beacon);
    }

    window.addEventListener("nnmrcn:telemetryconsent", (event) => {
        if (event.detail?.allowed) load();
    });
    load();
})();
