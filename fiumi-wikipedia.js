(() => {
    "use strict";

    if (!window.NNMRCN_MAP) {
        return;
    }

    const RIVER_INFO = Object.freeze({
        "Lo Zero": {
            wikipediaUrl: "https://it.wikipedia.org/wiki/Zero_(fiume)",
            length: "12,9 km"
        },
        "Fossa Storta": {
            wikipediaUrl: "https://it.wikipedia.org/wiki/Fossa_Storta",
            length: "7,3 km"
        },
        "Il Dese": {
            wikipediaUrl: "https://it.wikipedia.org/wiki/Dese_(fiume)",
            length: "6,2 km"
        }
    });

    function buildRiverPopup(name, info) {
        const root = document.createElement("div");
        root.className = "popup-fiume";

        const title = document.createElement("strong");
        title.textContent = name;

        const length = document.createElement("p");
        length.textContent = `Lunghezza nel Comune di Marcon: ${info.length}`;

        const link = document.createElement("a");
        link.href = info.wikipediaUrl;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        link.textContent = "Apri su Wikipedia";

        root.append(title, length, link);
        return root;
    }

    function enhanceRiver(feature, layer) {
        const properties = feature?.properties;
        const name = properties?.nome;
        const info = RIVER_INFO[name];

        if (
            properties?.categoria === "corso_d_acqua" &&
            info &&
            !layer.getPopup?.()
        ) {
            layer.bindPopup(buildRiverPopup(name, info), {
                maxWidth: 280
            });
        }
    }

    window.NNMRCN_MAP.registerExtension({
        feature: enhanceRiver
    });
})();
