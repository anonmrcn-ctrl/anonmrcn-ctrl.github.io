(() => {
    "use strict";

    const STORAGE_KEY = "nnmrcn_theme";
    const SETTINGS_KEYS = Object.freeze({
        textSize: "nnmrcn_text_size",
        motion: "nnmrcn_motion",
        mapStartup: "nnmrcn_map_startup",
        mapLite: "nnmrcn_map_lite"
    });
    const SETTINGS_DEFAULTS = Object.freeze({
        textSize: "normal",
        motion: "system",
        mapStartup: "empty",
        mapLite: "off"
    });
    const SETTINGS_VALUES = Object.freeze({
        textSize: Object.freeze(["normal", "large", "xlarge"]),
        motion: Object.freeze(["system", "reduce", "full"]),
        mapStartup: Object.freeze(["empty", "today", "1975", "last"]),
        mapLite: Object.freeze(["off", "on"])
    });
    const RESETTABLE_LOCAL_KEYS = Object.freeze([
        "nnmrcn_map_state_v1",
        "nnmrcn_map_guide_dismissed"
    ]);
    const DARK_COLOR = "#151513";
    const LIGHT_COLOR = "#f4f1e8";
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const motionMedia = window.matchMedia("(prefers-reduced-motion: reduce)");

    let preference = "system";
    const technicalPreferences = { ...SETTINGS_DEFAULTS };

    try {
        const storedPreference = localStorage.getItem(STORAGE_KEY);

        if (["system", "light", "dark"].includes(storedPreference)) {
            preference = storedPreference;
        }
    } catch (_) {
        // Il tema resta valido per la sessione corrente.
    }

    Object.entries(SETTINGS_KEYS).forEach(([name, storageKey]) => {
        try {
            const storedValue = localStorage.getItem(storageKey);

            if (SETTINGS_VALUES[name].includes(storedValue)) {
                technicalPreferences[name] = storedValue;
            }
        } catch (_) {
            // Le preferenze restano valide per la sessione corrente.
        }
    });

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

    function resetTheme() {
        preference = "system";

        try {
            localStorage.removeItem(STORAGE_KEY);
        } catch (_) {
            // Il tema resta valido per la sessione corrente.
        }

        applyTheme();
    }

    function applyTechnicalPreferences(announce = true) {
        const root = document.documentElement;

        root.dataset.textSize = technicalPreferences.textSize;
        root.dataset.motion = technicalPreferences.motion;
        root.dataset.mapStartup = technicalPreferences.mapStartup;
        root.dataset.mapLite = technicalPreferences.mapLite;

        if (announce) {
            window.dispatchEvent(new CustomEvent("nnmrcn:settingschange", {
                detail: { ...technicalPreferences }
            }));
        }
    }

    function setTechnicalPreference(name, value) {
        if (!SETTINGS_VALUES[name]?.includes(value)) {
            return;
        }

        technicalPreferences[name] = value;

        try {
            localStorage.setItem(SETTINGS_KEYS[name], value);
        } catch (_) {
            // La preferenza resta valida per la sessione corrente.
        }

        applyTechnicalPreferences();
    }

    function resetTechnicalPreferences() {
        Object.assign(technicalPreferences, SETTINGS_DEFAULTS);

        try {
            Object.values(SETTINGS_KEYS).forEach((storageKey) => {
                localStorage.removeItem(storageKey);
            });
            RESETTABLE_LOCAL_KEYS.forEach((storageKey) => {
                localStorage.removeItem(storageKey);
            });
        } catch (_) {
            // Le preferenze restano ripristinate per la sessione corrente.
        }

        applyTechnicalPreferences();
    }

    function shouldReduceMotion() {
        if (technicalPreferences.motion === "reduce") {
            return true;
        }

        if (technicalPreferences.motion === "full") {
            return false;
        }

        return motionMedia.matches;
    }

    function isLightMapEnabled() {
        return technicalPreferences.mapLite === "on";
    }

    media.addEventListener?.("change", () => {
        if (preference === "system") {
            applyTheme();
        }
    });

    motionMedia.addEventListener?.("change", () => {
        if (technicalPreferences.motion === "system") {
            window.dispatchEvent(new CustomEvent("nnmrcn:settingschange", {
                detail: { ...technicalPreferences }
            }));
        }
    });

    window.NNMRCN_THEME = Object.freeze({
        getPreference: () => preference,
        getResolved: resolveTheme,
        setPreference,
        reset: resetTheme
    });

    window.NNMRCN_SETTINGS = Object.freeze({
        get: (name) => technicalPreferences[name],
        getAll: () => ({ ...technicalPreferences }),
        set: setTechnicalPreference,
        reset: resetTechnicalPreferences,
        shouldReduceMotion,
        isLightMapEnabled,
        scrollBehavior: () => shouldReduceMotion() ? "auto" : "smooth"
    });

    applyTheme(false);
    applyTechnicalPreferences(false);
})();
