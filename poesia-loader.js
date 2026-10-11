(() => {
    "use strict";

    const poem = document.querySelector("main.poesia");
    let loading = null;
    let timer = null;

    function loadInteractions() {
        if (loading) return loading;

        if (timer) {
            window.clearTimeout(timer);
            timer = null;
        }

        loading = new Promise((resolve, reject) => {
            const script = document.createElement("script");
            script.src = "./poesia-interattiva.js?v=20261011-performance1";
            script.onload = resolve;
            script.onerror = reject;
            document.body.appendChild(script);
        });
        return loading;
    }

    if (!poem) return;

    for (const eventName of ["pointerover", "pointerdown", "focusin"]) {
        poem.addEventListener(eventName, loadInteractions, { once: true });
    }

    timer = window.setTimeout(loadInteractions, 8000);
})();
