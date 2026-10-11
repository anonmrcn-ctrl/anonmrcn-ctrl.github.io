(() => {
    "use strict";

    const ADMIN_SESSION_KEY = "nnmrcn_admin_session";
    const search = document.getElementById("vociRicerca");
    let loading = null;

    function loadEditor() {
        if (loading) return loading;

        loading = new Promise((resolve, reject) => {
            const script = document.createElement("script");
            script.src = "./voci.js?v=20261011-performance1";
            script.onload = resolve;
            script.onerror = reject;
            document.body.appendChild(script);
        });
        return loading;
    }

    function needsImmediateEditor() {
        return Boolean(location.hash) || Boolean(
            sessionStorage.getItem(ADMIN_SESSION_KEY)
        );
    }

    if (needsImmediateEditor()) {
        loadEditor();
        return;
    }

    for (const eventName of ["focus", "pointerdown", "keydown"]) {
        search?.addEventListener(eventName, loadEditor, { once: true });
    }
    window.addEventListener("hashchange", loadEditor, { once: true });
})();
