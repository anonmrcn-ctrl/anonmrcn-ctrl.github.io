(() => {
    "use strict";

    if (!window.L || !window.pmtiles?.leafletRasterLayer) {
        console.error("Leaflet o PMTiles non sono disponibili: overzoom 1975 non attivato.");
        return;
    }

    function mimeTypeFor(tileType) {
        if (tileType === 2) return "image/png";
        if (tileType === 3) return "image/jpeg";
        if (tileType === 4) return "image/webp";
        if (tileType === 5) return "image/avif";
        return "application/octet-stream";
    }

    window.pmtiles.leafletRasterLayer = function (source, options = {}) {
        let headerPromise;

        function getHeader() {
            if (!headerPromise) {
                headerPromise = source.getHeader().then((header) => {
                    if (header.tileType === 1 || header.tileType === 6) {
                        throw new Error("Il PMTiles contiene tessere vettoriali, non raster.");
                    }

                    console.info(
                        `Mappa 1975: zoom nativo ${header.minZoom}–${header.maxZoom}. ` +
                        "Overzoom raster reale attivo oltre il livello massimo."
                    );

                    return header;
                });
            }

            return headerPromise;
        }

        const OverzoomRasterLayer = L.GridLayer.extend({
            createTile(coord, done) {
                const tileSize = this.getTileSize();
                const canvas = document.createElement("canvas");
                const controller = new AbortController();
                const signal = controller.signal;

                canvas.width = tileSize.x;
                canvas.height = tileSize.y;
                canvas.cancel = () => controller.abort();

                (async () => {
                    const header = await getHeader();

                    if (coord.z < header.minZoom) {
                        done(undefined, canvas);
                        return;
                    }

                    let sourceZoom = Math.min(coord.z, header.maxZoom);
                    let response = null;
                    let scale = 1;
                    let sourceX = coord.x;
                    let sourceY = coord.y;

                    while (sourceZoom >= header.minZoom) {
                        scale = 2 ** (coord.z - sourceZoom);
                        sourceX = Math.floor(coord.x / scale);
                        sourceY = Math.floor(coord.y / scale);

                        response = await source.getZxy(
                            sourceZoom,
                            sourceX,
                            sourceY,
                            signal
                        );

                        if (response || coord.z <= header.maxZoom) {
                            break;
                        }

                        sourceZoom -= 1;
                    }

                    if (!response) {
                        done(undefined, canvas);
                        return;
                    }

                    const mimeType = mimeTypeFor(header.tileType);
                    const blob = new Blob([response.data], { type: mimeType });
                    const imageUrl = window.URL.createObjectURL(blob);

                    try {
                        const image = new Image();

                        await new Promise((resolve, reject) => {
                            image.onload = resolve;
                            image.onerror = () => reject(
                                new Error("Impossibile decodificare una tessera del PMTiles 1975.")
                            );
                            image.src = imageUrl;
                        });

                        if (signal.aborted) {
                            return;
                        }

                        const subX = coord.x - sourceX * scale;
                        const subY = coord.y - sourceY * scale;
                        const sourceWidth = image.naturalWidth / scale;
                        const sourceHeight = image.naturalHeight / scale;
                        const sourceLeft = subX * sourceWidth;
                        const sourceTop = subY * sourceHeight;

                        const context = canvas.getContext("2d");
                        context.imageSmoothingEnabled = true;
                        context.imageSmoothingQuality = "high";
                        context.drawImage(
                            image,
                            sourceLeft,
                            sourceTop,
                            sourceWidth,
                            sourceHeight,
                            0,
                            0,
                            canvas.width,
                            canvas.height
                        );

                        done(undefined, canvas);
                    } finally {
                        window.URL.revokeObjectURL(imageUrl);
                    }
                })().catch((error) => {
                    if (error?.name === "AbortError") {
                        return;
                    }

                    console.error("Errore nel rendering PMTiles 1975.", error);
                    done(error, canvas);
                });

                return canvas;
            },

            _removeTile(key) {
                const tile = this._tiles[key];

                if (!tile) {
                    return;
                }

                if (tile.el.cancel) {
                    tile.el.cancel();
                }

                L.DomUtil.remove(tile.el);
                delete this._tiles[key];

                this.fire("tileunload", {
                    tile: tile.el,
                    coords: this._keyToTileCoords(key)
                });
            }
        });

        return new OverzoomRasterLayer(options);
    };
})();
