(() => {
    "use strict";

    if (!window.L || !window.pmtiles) {
        console.error("Leaflet o PMTiles non sono disponibili.");
        return;
    }

    const archivio1975 = new pmtiles.PMTiles("./mappe/marcon_1975.pmtiles");
    const imageOverlayOriginale = L.imageOverlay.bind(L);

    L.imageOverlay = function (imageUrl, bounds, options = {}) {
        const usaArchivio1975 =
            typeof imageUrl === "string" &&
            imageUrl.includes("marcon_1975_web.webp");

        if (!usaArchivio1975) {
            return imageOverlayOriginale(imageUrl, bounds, options);
        }

        return pmtiles.leafletRasterLayer(
            archivio1975,
            {
                minZoom: 12,
                maxZoom: 17,
                opacity: options.opacity ?? 1,
                pane: options.pane || "tilePane",
                noWrap: true,
                attribution: "Aerofototeca Veneta — 1975"
            }
        );
    };
})();
