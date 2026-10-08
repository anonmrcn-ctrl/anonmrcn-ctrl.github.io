(() => {
    "use strict";

    const api = window.NNMRCN_API;
    const menu = document.getElementById("menuPrincipale");
    const mainContainer = menu?.querySelector(".menu-contenuto");
    const staticMainIds = [
        "nav-main-poem",
        "nav-main-author",
        "nav-main-project",
        "nav-main-public-space"
    ];
    const mainElements = new Map(
        Array.from(mainContainer?.querySelectorAll(":scope > a") || [])
            .slice(0, staticMainIds.length)
            .map((element, index) => {
                const id = staticMainIds[index];
                element.dataset.cmsNavigationItem = id;
                return [id, element];
            })
    );

    if (!api || !menu || !mainContainer) {
        return;
    }

    loadNavigation();

    async function loadNavigation() {
        try {
            const data = await api.request("/api/public/navigation");
            applyMainNavigation(data?.menus?.main || []);
            applySingleton(".menu-donazioni", data?.menus?.support?.[0]);
            applySingleton(".menu-admin-link", data?.menus?.utility?.[0]);
            finish("d1");
        } catch (_) {
            finish("fallback");
        }
    }

    function applyMainNavigation(items) {
        if (!Array.isArray(items) || !items.length) {
            throw new Error("NAVIGATION_CONTENT_INVALID");
        }

        for (const element of mainElements.values()) {
            element.hidden = true;
        }

        const boundary = mainContainer.querySelector(
            "[data-spazio-personale-link], [data-spazio-personale-errore]"
        );

        for (const item of items) {
            if (!validItem(item)) {
                continue;
            }

            let element = mainElements.get(item.id);

            if (!element) {
                element = document.createElement("a");
                element.dataset.cmsNavigationItem = item.id;
                mainElements.set(item.id, element);
            }

            element.href = item.href;
            element.textContent = item.label;
            element.hidden = false;
            mainContainer.insertBefore(element, boundary);
        }
    }

    function applySingleton(selector, item) {
        const element = menu.querySelector(selector);

        if (!element || !validItem(item)) {
            return;
        }

        element.dataset.cmsNavigationItem = item.id;
        element.href = item.href;
        element.textContent = item.label;
    }

    function validItem(item) {
        return item &&
            typeof item.id === "string" &&
            typeof item.label === "string" &&
            typeof item.href === "string";
    }

    function finish(source) {
        document.documentElement.dataset.cmsNavigationSource = source;
        window.dispatchEvent(new CustomEvent("nnmrcn:navigation-ready", {
            detail: { source }
        }));
    }
})();
