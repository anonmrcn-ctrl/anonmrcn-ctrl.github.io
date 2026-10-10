(() => {
    "use strict";

    const api = window.NNMRCN_API;
    const elements = {
        status: document.getElementById("luogoSchedaStato"),
        card: document.getElementById("luogoScheda"),
        banner: document.getElementById("luogoSchedaBanner"),
        image: document.getElementById("luogoSchedaImmagine"),
        category: document.getElementById("luogoSchedaCategoria"),
        title: document.getElementById("luogoSchedaTitolo"),
        text: document.getElementById("luogoSchedaTesto"),
        expand: document.getElementById("luogoSchedaEspandi"),
        map: document.getElementById("luogoSchedaMappa")
    };

    if (!api || Object.values(elements).some((element) => !element)) {
        return;
    }

    const categoryLabels = Object.freeze({
        luogo: "Luogo",
        edificio: "Edificio",
        monumento: "Monumento",
        infrastruttura: "Infrastruttura",
        paesaggio: "Paesaggio",
        corso_d_acqua: "Corso d’acqua",
        cava: "Cava",
        percorso: "Percorso"
    });

    loadPlace();

    async function loadPlace() {
        const placeId = Number(
            new URLSearchParams(window.location.search).get("luogo")
        );

        if (!Number.isInteger(placeId) || placeId <= 0) {
            showError("Il collegamento a questo luogo non è valido.");
            return;
        }

        try {
            const [mapData, wikiData] = await Promise.all([
                api.request("/api/public/map-entries"),
                api.request("/api/public/wiki").catch(() => ({ entries: [] }))
            ]);
            const entry = (mapData.entries || []).find(
                (candidate) => Number(candidate.id) === placeId
            );

            if (!entry) {
                showError("Questo luogo non esiste o non è più pubblicato.");
                return;
            }

            const wikiEntry = (wikiData.entries || []).find(
                (candidate) => normalizedTitle(candidate.title) ===
                    normalizedTitle(entry.name)
            );

            renderPlace(entry, wikiEntry);
        } catch (error) {
            showError(
                error.message || "Non è stato possibile caricare la spiegazione."
            );
        }
    }

    function renderPlace(entry, wikiEntry) {
        elements.category.textContent = categoryLabels[entry.category] || "Luogo";
        elements.title.textContent = entry.name;
        elements.text.textContent = entry.description ||
            "La spiegazione di questo luogo non è ancora disponibile.";
        elements.map.href = mapEntryUrl(entry.id);

        if (entry.imageUrl) {
            elements.image.alt = `Fotografia di ${entry.name}`;
            elements.image.src = `${api.baseUrl}${entry.imageUrl}`;
            elements.image.srcset = (entry.imageSources || []).map((source) =>
                `${api.baseUrl}${source.url} ${source.width}w`
            ).join(", ");
            elements.image.sizes = entry.imageSizes || "(max-width: 640px) 100vw, 960px";
            if (entry.imageWidth && entry.imageHeight) {
                elements.image.width = entry.imageWidth;
                elements.image.height = entry.imageHeight;
            }
            elements.image.addEventListener("error", () => {
                elements.banner.hidden = true;
            }, { once: true });
            elements.banner.hidden = false;
        } else {
            elements.banner.hidden = true;
            elements.image.removeAttribute("src");
            elements.image.removeAttribute("srcset");
        }

        const expandUrl = wikiEntry
            ? wikiEntryUrl(wikiEntry.slug)
            : internalWikiUrl(entry.sourceUrl);

        if (expandUrl) {
            elements.expand.href = expandUrl;
            elements.expand.hidden = false;
        } else {
            elements.expand.hidden = true;
        }

        document.title = `${entry.name} — nnMrcn`;
        elements.status.hidden = true;
        elements.card.hidden = false;
        elements.title.focus?.({ preventScroll: true });
    }

    function mapEntryUrl(entryId) {
        const url = new URL("./progetto.html", document.baseURI);

        url.searchParams.set("luogo", String(entryId));
        url.hash = "map";
        return url.href;
    }

    function wikiEntryUrl(slug) {
        return new URL(
            `./voci/${encodeURIComponent(String(slug))}.html`,
            document.baseURI
        ).href;
    }

    function internalWikiUrl(value) {
        if (!value) {
            return "";
        }

        try {
            const url = new URL(value, document.baseURI);
            const expected = new URL("./voci.html", document.baseURI);

            if (
                url.origin === expected.origin &&
                url.pathname === expected.pathname &&
                url.hash.length > 1
            ) {
                return wikiEntryUrl(decodeURIComponent(url.hash.slice(1)));
            }

            return "";
        } catch (_) {
            return "";
        }
    }

    function normalizedTitle(value) {
        return String(value || "")
            .replace(/[«»“”"']/g, "")
            .replace(/\s+/g, " ")
            .trim()
            .toLocaleLowerCase("it");
    }

    function showError(message) {
        elements.card.hidden = true;
        elements.status.hidden = false;
        elements.status.textContent = message;
    }
})();
