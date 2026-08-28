(() => {
    "use strict";

    const STORAGE_KEY = "nnmrcn_theme";
    const DARK_COLOR = "#151513";
    const LIGHT_COLOR = "#f4f1e8";
    const media = window.matchMedia("(prefers-color-scheme: dark)");

    let preference = "system";

    try {
        const storedPreference = localStorage.getItem(STORAGE_KEY);

        if (["system", "light", "dark"].includes(storedPreference)) {
            preference = storedPreference;
        }
    } catch (_) {
        // Il tema resta valido per la sessione corrente.
    }

    function resolveTheme() {
        if (preference === "system") {
            return media.matches ? "dark" : "light";
        }

        return preference;
    }

    function applyTheme(announce = true) {
        const resolved = resolveTheme();
        const root = document.documentElement;
        let themeColor = document.querySelector('meta[name="theme-color"]');

        root.dataset.theme = resolved;
        root.dataset.themePreference = preference;
        root.style.colorScheme = resolved;

        if (!themeColor) {
            themeColor = document.createElement("meta");
            themeColor.name = "theme-color";
            document.head.appendChild(themeColor);
        }

        themeColor.content = resolved === "dark" ? DARK_COLOR : LIGHT_COLOR;

        if (announce) {
            window.dispatchEvent(new CustomEvent("nnmrcn:themechange", {
                detail: { preference, resolved }
            }));
        }
    }

    function setPreference(nextPreference) {
        if (!["system", "light", "dark"].includes(nextPreference)) {
            return;
        }

        preference = nextPreference;

        try {
            localStorage.setItem(STORAGE_KEY, preference);
        } catch (_) {
            // Il tema resta valido per la sessione corrente.
        }

        applyTheme();
    }

    media.addEventListener?.("change", () => {
        if (preference === "system") {
            applyTheme();
        }
    });

    window.NNMRCN_THEME = Object.freeze({
        getPreference: () => preference,
        getResolved: resolveTheme,
        setPreference
    });

    applyTheme(false);
})();
