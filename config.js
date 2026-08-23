/*
 * Inserire qui l'URL pubblico del Cloudflare Worker dopo il deploy.
 * Esempio:
 * window.NNMRCN_API_BASE = "https://nnmrcn-rete.nome-account.workers.dev";
 */
window.NNMRCN_API_BASE = "";

/*
 * Rende disponibile la mappa Leaflet anche ai livelli pubblici
 * caricati separatamente da accesso.js.
 */
if (window.L && typeof L.map === "function") {
    const creaMappaLeaflet = L.map.bind(L);

    L.map = function(...args) {
        const instance = creaMappaLeaflet(...args);
        window.NNMRCN_MAP = instance;
        return instance;
    };
}

window.addEventListener("load", () => {
    const script = document.createElement("script");
    script.src = "./paesaggi.js";
    document.body.appendChild(script);
});
