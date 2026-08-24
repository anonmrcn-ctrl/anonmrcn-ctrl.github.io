(() => {
    "use strict";

    if (!window.L?.Path?.prototype?.bindTooltip) {
        return;
    }

    const WIKIPEDIA_LINKS = Object.freeze({
        "Lo Zero": "https://it.wikipedia.org/wiki/Zero_(fiume)",
        "Fossa Storta": "https://it.wikipedia.org/wiki/Fossa_Storta",
        "Il Dese": "https://it.wikipedia.org/wiki/Dese_(fiume)"
    });

    const originalBindTooltip = L.Path.prototype.bindTooltip;

    function buildRiverPopup(name, url) {
        const root = document.createElement("div");
        root.className = "popup-fiume";

        const title = document.createElement("strong");
        title.textContent = name;

        const link = document.createElement("a");
        link.href = url;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        link.textContent = "Apri su Wikipedia";

        root.append(title, link);
        return root;
    }

    L.Path.prototype.bindTooltip = function (...args) {
        const result = originalBindTooltip.apply(this, args);
        const properties = this.feature?.properties;
        const name = properties?.nome;
        const wikipediaUrl = WIKIPEDIA_LINKS[name];

        if (
            properties?.categoria === "corso_d_acqua" &&
            wikipediaUrl &&
            !this.getPopup?.()
        ) {
            this.bindPopup(buildRiverPopup(name, wikipediaUrl), {
                maxWidth: 260
            });
        }

        return result;
    };
})();
