function feature(id, position, title, description, properties) {
    return Object.freeze({
        id,
        position,
        title,
        description,
        geometry: null,
        properties: Object.freeze(properties),
        status: "archived"
    });
}

function layer(
    id,
    slug,
    title,
    description,
    layerType,
    position,
    sourcePath,
    style,
    features = []
) {
    return Object.freeze({
        id,
        slug,
        title,
        description,
        layerType,
        position,
        sourcePath,
        style: Object.freeze(style),
        status: "published",
        features: Object.freeze(features)
    });
}

const MUNICIPAL_PAGE_URL =
    "https://www.comune.marcon.ve.it/vivere-il-comune/territorio/cosa-fare-e-vedere/";

export const MAP_LAYER_SEEDS = Object.freeze([
    layer(
        "map-layer-cycle-routes",
        "percorsi",
        "Proposta di percorso ciclo-turistico",
        "",
        "lines",
        1,
        "./percorsi.geojson",
        {
            collectionName: "Percorsi",
            color: "#a34d2f",
            weight: 5,
            opacity: 0.95,
            dashArray: "11 7",
            municipalUrl: MUNICIPAL_PAGE_URL
        },
        [
            feature(
                "map-feature-cycle-route",
                1,
                "Proposta di percorso ciclo-turistico",
                "",
                {
                    nome: "Proposta di percorso ciclo-turistico",
                    municipal_url: MUNICIPAL_PAGE_URL,
                    google_maps_url:
                        "https://www.google.com/maps/d/viewer?mid=1rRQ8GtEBEuBSQFPSEg5-BExu_HPkIa0"
                }
            )
        ]
    ),
    layer(
        "map-layer-relevant-places",
        "luoghi-rilevanti",
        "Luoghi rilevanti lungo il percorso",
        "",
        "mixed",
        2,
        "./luoghi-rilevanti.geojson",
        {
            areaColor: "#9b3f18",
            areaFillColor: "#e27a36",
            areaFillOpacity: 0.3,
            pointColor: "#8a3414",
            municipalUrl: MUNICIPAL_PAGE_URL
        }
    ),
    layer(
        "map-layer-south-route",
        "marcon-da-sud",
        "Marcon da sud",
        "Percorso di esplorazione della parte meridionale del territorio comunale.",
        "lines",
        3,
        "./marcon-da-sud.geojson",
        {
            collectionName: "Marcon da sud",
            color: "#704f3b",
            weight: 5,
            opacity: 0.95,
            dashArray: "5 7"
        },
        [
            feature(
                "map-feature-south-route",
                1,
                "Marcon da sud",
                [
                    'Il percorso "Marcon da sud", di mia ideazione, non è da considerarsi un percorso turistico o paesaggistico, bensì una specie di esplorazione in quei luoghi che i marconesi solitamente non frequentano, pur essendo parte considerevole del territorio comunale.',
                    'Penso che questo percorso possa farci cambiare prospettiva sul nostro modo di vivere il territorio: particolarmente impattante è stato per me percorrere fino alla conclusione Via Istituto Santa Maria della Pietà, guardando la grande scritta rossa "Iperossetto": il centro commerciale non è altro che la bella faccia di questa zona industriale.',
                    "Consiglio di compiere questo percorso verso il tramonto, quando tutti gli stabilimenti sono chiusi e l'area diventa deserta, ma la luce ancora la illumina.",
                    "Attenzione: il percorso comporta un piccolo tragitto sulla sp40"
                ].join("\n\n"),
                {
                    nome: "Marcon da sud",
                    google_maps_url:
                        "https://www.google.com/maps/d/viewer?mid=1dBfUYDkPCE5Wo7s6toRX2JygRkW4m9I"
                }
            )
        ]
    ),
    layer(
        "map-layer-significant-landscapes",
        "luoghi-significativi",
        "Paesaggi significativi",
        "Corsi d’acqua e cave del territorio comunale.",
        "mixed",
        4,
        "./luoghi-significativi.geojson",
        {
            collectionName: "Paesaggi significativi",
            riverColor: "#00b8ff",
            quarryColor: "#006e8a",
            quarryFillColor: "#2cc8ef"
        },
        [
            feature(
                "map-feature-river-zero",
                1,
                "Lo Zero",
                "Lunghezza nel Comune di Marcon: 12,9 km",
                {
                    nome: "Lo Zero",
                    categoria: "corso_d_acqua",
                    length: "12,9 km",
                    wikipedia_url: "https://it.wikipedia.org/wiki/Zero_(fiume)"
                }
            ),
            feature(
                "map-feature-river-fossa-storta",
                2,
                "Fossa Storta",
                "Lunghezza nel Comune di Marcon: 7,3 km",
                {
                    nome: "Fossa Storta",
                    categoria: "corso_d_acqua",
                    length: "7,3 km",
                    wikipedia_url: "https://it.wikipedia.org/wiki/Fossa_Storta"
                }
            ),
            feature(
                "map-feature-river-dese",
                3,
                "Il Dese",
                "Lunghezza nel Comune di Marcon: 6,2 km",
                {
                    nome: "Il Dese",
                    categoria: "corso_d_acqua",
                    length: "6,2 km",
                    wikipedia_url: "https://it.wikipedia.org/wiki/Dese_(fiume)"
                }
            ),
            feature(
                "map-feature-quarry-praello",
                4,
                "Cave del Praello",
                "Cave del Praello lungo la parte meridionale del percorso.",
                {
                    nome: "Cave del Praello",
                    categoria: "cava",
                    municipal_url:
                        "https://www.comune.marcon.ve.it/vivere-il-comune/luoghi/cave-del-praello/",
                    wikipedia_url: "https://it.wikipedia.org/wiki/Marcon"
                }
            ),
            feature(
                "map-feature-quarry-gaggio-north",
                5,
                "Cave di Gaggio Nord",
                "Area delle cave di Gaggio Nord, comprendente l’oasi naturalistica.",
                {
                    nome: "Cave di Gaggio Nord",
                    categoria: "cava",
                    municipal_url:
                        "https://www.comune.marcon.ve.it/vivere-il-comune/luoghi/oasi-cave-di-gaggio-nord/",
                    wikipedia_url:
                        "https://it.wikipedia.org/wiki/Gaggio_(Marcon)"
                }
            )
        ]
    )
]);
