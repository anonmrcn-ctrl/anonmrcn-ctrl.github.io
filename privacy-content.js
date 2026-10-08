(() => {
    "use strict";

    const api = window.NNMRCN_API;
    const target = document.getElementById("privacyDocumento");
    const title = document.querySelector("[data-legal-title]");
    const effectiveDate = document.querySelector("[data-legal-effective-date]");

    if (!api || !target || !title || !effectiveDate) {
        return;
    }

    loadPrivacy();

    async function loadPrivacy() {
        try {
            const data = await api.request("/api/public/legal/privacy");
            const legalDocument = data?.document;
            const version = legalDocument?.version;

            if (
                typeof legalDocument?.title !== "string" ||
                typeof version?.bodyHtml !== "string" ||
                !/^[0-9a-f]{64}$/u.test(version?.checksum || "") ||
                await sha256(version.bodyHtml) !== version.checksum
            ) {
                throw new Error("Versione privacy non valida.");
            }

            title.textContent = legalDocument.title;
            effectiveDate.textContent =
                `Ultimo aggiornamento: ${formatDate(version.effectiveDate)}`;
            target.innerHTML = version.bodyHtml;
            document.documentElement.dataset.legalDocumentSource = "d1";
            document.documentElement.dataset.legalDocumentChecksum =
                version.checksum;
            dispatchReady("d1", version.checksum);
        } catch (_) {
            document.documentElement.dataset.legalDocumentSource = "fallback";
            dispatchReady("fallback", "");
        }
    }

    async function sha256(value) {
        if (!window.crypto?.subtle) {
            throw new Error("Verifica checksum non disponibile.");
        }

        const bytes = new TextEncoder().encode(value);
        const digest = await window.crypto.subtle.digest("SHA-256", bytes);

        return Array.from(new Uint8Array(digest), (byte) =>
            byte.toString(16).padStart(2, "0")
        ).join("");
    }

    function formatDate(value) {
        const match = /^(\d{4})-(\d{2})-(\d{2})$/u.exec(value || "");
        const months = [
            "gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno",
            "luglio", "agosto", "settembre", "ottobre", "novembre", "dicembre"
        ];

        if (!match || !months[Number(match[2]) - 1]) {
            throw new Error("Data privacy non valida.");
        }

        return `${Number(match[3])} ${months[Number(match[2]) - 1]} ${match[1]}`;
    }

    function dispatchReady(source, checksum) {
        window.dispatchEvent(new CustomEvent("nnmrcn:legal-document-ready", {
            detail: { slug: "privacy", source, checksum }
        }));
    }
})();
