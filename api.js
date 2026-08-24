(() => {
    "use strict";

    const baseUrl = String(window.NNMRCN_API_BASE || "").replace(/\/+$/, "");

    async function request(path, options = {}) {
        if (!baseUrl) {
            const error = new Error("API_NOT_CONFIGURED");
            error.code = "API_NOT_CONFIGURED";
            throw error;
        }

        const headers = new Headers(options.headers || {});
        headers.set("Accept", "application/json");

        if (options.body && !headers.has("Content-Type")) {
            headers.set("Content-Type", "application/json");
        }

        const response = await fetch(`${baseUrl}${path}`, {
            ...options,
            headers
        });

        const data = await response.json().catch(() => null);

        if (!response.ok) {
            const error = new Error(data?.error || "Errore di rete.");
            error.status = response.status;
            throw error;
        }

        return data;
    }

    window.NNMRCN_API = Object.freeze({ baseUrl, request });
})();
