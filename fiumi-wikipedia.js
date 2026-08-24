(() => {
    "use strict";

    if (!window.L?.Path?.prototype?.bindTooltip) {
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

    const originalBindTooltip = L.Path.prototype.bindTooltip;

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

    L.Path.prototype.bindTooltip = function (...args) {
        const result = originalBindTooltip.apply(this, args);
        const properties = this.feature?.properties;
        const name = properties?.nome;
        const info = RIVER_INFO[name];

        if (
            properties?.categoria === "corso_d_acqua" &&
            info &&
            !this.getPopup?.()
        ) {
            this.bindPopup(buildRiverPopup(name, info), {
                maxWidth: 280
            });
        }

        return result;
    };
})();
