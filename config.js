/*
 * Inserire qui l'URL pubblico del Cloudflare Worker dopo il deploy.
 * Esempio:
 * window.NNMRCN_API_BASE = "https://nnmrcn-rete.nome-account.workers.dev";
 */
window.NNMRCN_API_BASE = "";

/*
 * Evita il grande rettangolo di focus che alcuni browser mobili
 * disegnano attorno alle geometrie SVG di Leaflet.
 * I tooltip con i nomi restano attivi.
 */
const stileFocusPaesaggi = document.createElement("style");
stileFocusPaesaggi.textContent = `
    .pagina-progetto #map .leaflet-interactive,
    .pagina-progetto #map .leaflet-interactive:focus,
    .pagina-progetto #map .leaflet-interactive:focus-visible,
    .pagina-progetto #map .leaflet-overlay-pane svg,
    .pagina-progetto #map .leaflet-overlay-pane svg:focus,
    .pagina-progetto #map .leaflet-overlay-pane svg:focus-visible {
        outline: none !important;
        box-shadow: none !important;
        -webkit-tap-highlight-color: transparent !important;
    }
`;
document.head.appendChild(stileFocusPaesaggi);

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
    script.src = "./paesaggi.js?v=20260823-7";
    script.dataset.nnmrcnPaesaggi = "true";
    document.body.appendChild(script);
})();
