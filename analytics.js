(() => {
    "use strict";

    const token = String(window.NNMRCN_ANALYTICS_TOKEN || "").trim();
    const localHosts = new Set(["localhost", "127.0.0.1"]);

    if (!token || localHosts.has(window.location.hostname)) {
        return;
    }

    const beacon = document.createElement("script");
    beacon.defer = true;
    beacon.src = "https://static.cloudflareinsights.com/beacon.min.js";
    beacon.dataset.cfBeacon = JSON.stringify({ token });
    document.head.appendChild(beacon);
})();
