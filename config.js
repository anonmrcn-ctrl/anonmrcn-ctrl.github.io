/*
 * Inserire qui l'URL pubblico del Cloudflare Worker dopo il deploy.
 * Esempio:
 * window.NNMRCN_API_BASE = "https://nnmrcn-rete.nome-account.workers.dev";
 */
window.NNMRCN_API_BASE = "";

/*
 * Su alcuni browser mobili il tocco su una geometria SVG di Leaflet
 * disegna un grande rettangolo di focus attorno al suo bounding box.
 * Eliminiamo solo quel contorno, lasciando intatti i tooltip con il nome.
 */
const stileFocusPaesaggi = document.createElement("style");
stileFocusPaesaggi.textContent = `
    .pagina-progetto .leaflet-interactive:focus,
    .pagina-progetto .leaflet-interactive:focus-visible,
    .pagina-progetto .leaflet-overlay-pane svg:focus,
    .pagina-progetto .leaflet-overlay-pane svg:focus-visible {
        outline: none !important;
    }
`;
document.head.appendChild(stileFocusPaesaggi);

/*
 * Rende disponibile la mappa Leaflet ai livelli pubblici.
 * accesso.js crea la mappa dopo questo file: intercettiamo L.map
 * e carichiamo lo script dei paesaggi non appena l'istanza esiste.
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
    script.src = "./paesaggi.js?v=20260823-6";
    script.dataset.nnmrcnPaesaggi = "true";
    document.body.appendChild(script);
})();
