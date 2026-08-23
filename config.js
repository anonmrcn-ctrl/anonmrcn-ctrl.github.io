/*
 * Inserire qui l'URL pubblico del Cloudflare Worker dopo il deploy.
 * Esempio:
 * window.NNMRCN_API_BASE = "https://nnmrcn-rete.nome-account.workers.dev";
 */
window.NNMRCN_API_BASE = "";

/*
 * Rende disponibile la mappa Leaflet ai livelli pubblici.
 * accesso.js crea la mappa dopo questo file: intercettiamo L.map
 * e poi carichiamo paesaggi.js appena l'istanza è disponibile.
 */
if (window.L && typeof L.map === "function") {
    const creaMappaLeaflet = L.map.bind(L);

    L.map = function(...args) {
        const instance = creaMappaLeaflet(...args);
        window.NNMRCN_MAP = instance;
        return instance;
    };
}

(function caricaPaesaggiQuandoPronto() {
    if (!window.NNMRCN_MAP) {
        window.setTimeout(caricaPaesaggiQuandoPronto, 50);
        return;
    }

    if (document.querySelector('script[data-nnmrcn-paesaggi]')) {
        return;
    }

    const script = document.createElement("script");
    script.src = "./paesaggi.js?v=20260823-2";
    script.dataset.nnmrcnPaesaggi = "true";
    document.body.appendChild(script);
})();
