(() => {
    "use strict";

    const STORAGE_KEY = "nnmrcn_taccuino_v1";
    const MAX_ITEMS = 150;
    let memoryFallback = [];
    let volatileStorage = false;

    function read() {
        if (volatileStorage) {
            return memoryFallback.slice();
        }

        try {
            const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
            return Array.isArray(parsed) ? parsed.map(normalizeStoredItem).filter(Boolean) : [];
        } catch (_) {
            volatileStorage = true;
            return memoryFallback.slice();
        }
    }

    function write(items) {
        const normalized = items
            .map(normalizeStoredItem)
            .filter(Boolean)
            .slice(0, MAX_ITEMS);

        memoryFallback = normalized;

        if (!volatileStorage) {
            try {
                localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
            } catch (_) {
                volatileStorage = true;
                // In navigazione privata il taccuino rimane disponibile fino
                // alla chiusura della pagina anche se localStorage è bloccato.
            }
        }

        document.dispatchEvent(new CustomEvent("nnmrcn:taccuinochange", {
            detail: { count: normalized.length }
        }));
        updateCounters(normalized.length);
        return normalized;
    }

    function normalizeStoredItem(value) {
        if (!value || typeof value !== "object") {
            return null;
        }

        const title = String(value.title || "").trim().slice(0, 160);

        if (!title) {
            return null;
        }

        const type = String(value.type || "elemento").trim().slice(0, 30);
        const lat = finiteCoordinate(value.lat, -90, 90);
        const lon = finiteCoordinate(value.lon, -180, 180);
        const id = String(value.id || itemIdentifier({
            type,
            title,
            lat,
            lon
        })).slice(0, 240);

        return {
            id,
            type,
            title,
            text: String(value.text || "").trim().slice(0, 1200),
            url: safeLocalUrl(value.url),
            lat,
            lon,
            savedAt: Number.isFinite(Number(value.savedAt))
                ? Number(value.savedAt)
                : Date.now()
        };
    }

    function finiteCoordinate(value, minimum, maximum) {
        if (value === null || value === undefined || value === "") {
            return null;
        }

        const number = Number(value);
        return Number.isFinite(number) && number >= minimum && number <= maximum
            ? number
            : null;
    }

    function safeLocalUrl(value) {
        try {
            const url = new URL(String(value || window.location.href), window.location.href);
            return url.origin === window.location.origin
                ? `${url.pathname}${url.search}${url.hash}`
                : `${window.location.pathname}${window.location.search}`;
        } catch (_) {
            return `${window.location.pathname}${window.location.search}`;
        }
    }

    function itemIdentifier(item) {
        const coordinate = item.lat !== null && item.lon !== null
            ? `${Number(item.lat).toFixed(5)}:${Number(item.lon).toFixed(5)}`
            : "senza-coordinate";
        const label = String(item.title || "elemento")
            .normalize("NFKD")
            .replace(/[^a-z0-9]+/giu, "-")
            .replace(/^-|-$/gu, "")
            .slice(0, 80);

        return `${item.type || "elemento"}:${label}:${coordinate}`;
    }

    function has(id) {
        return read().some((item) => item.id === String(id));
    }

    function save(item) {
        const normalized = normalizeStoredItem({
            ...item,
            savedAt: Date.now()
        });

        if (!normalized) {
            return false;
        }

        const items = read().filter((entry) => entry.id !== normalized.id);
        items.unshift(normalized);
        write(items);
        return true;
    }

    function remove(id) {
        const items = read();
        const next = items.filter((item) => item.id !== String(id));

        if (next.length === items.length) {
            return false;
        }

        write(next);
        return true;
    }

    function clear() {
        write([]);
    }

    function toggle(item) {
        const normalized = normalizeStoredItem(item);

        if (!normalized) {
            return false;
        }

        if (has(normalized.id)) {
            remove(normalized.id);
            return false;
        }

        save(normalized);
        return true;
    }

    function createButton(item, options = {}) {
        const normalized = normalizeStoredItem(item);
        const button = document.createElement("button");
        button.type = "button";
        button.className = options.className || "taccuino-salva";

        if (!normalized) {
            button.disabled = true;
            button.textContent = "Non disponibile";
            return button;
        }

        button.dataset.taccuinoId = normalized.id;

        button.addEventListener("click", () => {
            toggle(normalized);
        });
        syncButton(button, has(normalized.id));
        return button;
    }

    function syncButton(button, saved) {
        button.textContent = saved
            ? "Rimuovi dal taccuino"
            : "Salva nel taccuino";
        button.setAttribute("aria-pressed", String(saved));
    }

    function syncButtons() {
        const savedIds = new Set(read().map((item) => item.id));

        document.querySelectorAll("[data-taccuino-id]").forEach((button) => {
            syncButton(button, savedIds.has(button.dataset.taccuinoId));
        });
    }

    function updateCounters(count = read().length) {
        document.querySelectorAll("[data-taccuino-count]").forEach((element) => {
            element.textContent = String(count);
        });
    }

    window.NNMRCN_TACCUINO = Object.freeze({
        list: read,
        has,
        save,
        remove,
        clear,
        toggle,
        createButton,
        itemIdentifier
    });

    document.addEventListener("nnmrcn:taccuinochange", syncButtons);

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", () => updateCounters());
    } else {
        updateCounters();
    }
})();
