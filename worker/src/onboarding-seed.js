function step(id, position, title, body, details, preview, alt, markers) {
    return Object.freeze({
        id,
        tourKey: "welcome",
        position,
        title,
        body,
        action: Object.freeze({ details, preview, alt, markers })
    });
}

export const WELCOME_INTRO_SEED = Object.freeze({
    title: "Benvenuto nel sito anonMrcn",
    subtitle: "Un progetto artistico dedicato alla città di Marcon."
});

export const WELCOME_STEP_SEEDS = Object.freeze([
    step(
        "welcome-poetry",
        1,
        "La poesia, punto di partenza",
        "Leggi i quattro canti e apri i passaggi collegati ai luoghi. Gli approfondimenti seguono la poesia senza interromperne il ritmo.",
        [
            "Indice rapido dei quattro canti",
            "Versi collegati alla mappa e agli approfondimenti",
            "Contenuti salvabili nel taccuino"
        ],
        "./index.html?onboarding-preview=1#I",
        "Schermata della poesia con indicazioni sull’indice dei canti, sui versi interattivi e sui comandi del sito.",
        [
            { label: "Indice dei canti", x: "37%", y: "90%" },
            { label: "Versi interattivi", x: "38%", y: "38%", tone: "yellow" },
            { label: "Menu e impostazioni", x: "69%", y: "12%" }
        ]
    ),
    step(
        "welcome-map",
        2,
        "La mappa di Marcon",
        "Esplora i luoghi della poesia e del territorio, confronta la situazione attuale con il 1975 e attiva percorsi, fiumi, cave e altri livelli.",
        [
            "Confronto tra oggi e la mappa storica del 1975",
            "Livelli territoriali e percorsi",
            "Guida narrativa collegata ai versi"
        ],
        "./progetto.html?onboarding-preview=1#map",
        "Schermata della mappa con indicazioni sul confronto storico, sui livelli e sulla guida narrativa.",
        [
            { label: "Oggi / 1975", x: "11%", y: "18%", tone: "yellow" },
            { label: "Livelli della mappa", x: "68%", y: "17%" },
            { label: "Esplora la poesia", x: "56%", y: "79%", tone: "red" }
        ]
    ),
    step(
        "welcome-public-space",
        3,
        "Uno spazio pubblico condiviso",
        "La parte collettiva raccoglie memorie degli abitanti, messaggi resi pubblici con consenso e voci dedicate ai luoghi e alla storia di Marcon.",
        [
            "Memorie: ricordi, immagini e suoni",
            "Archivio: messaggi pubblicati con consenso",
            "Voci: schede territoriali collegate tra loro"
        ],
        "./spazio-pubblico.html?onboarding-preview=1",
        "Schermata dello spazio pubblico con indicazioni sulle sezioni Memorie, Archivio e Voci.",
        [
            { label: "Memorie", x: "13%", y: "61%" },
            { label: "Archivio", x: "42%", y: "61%", tone: "yellow" },
            { label: "Voci", x: "70%", y: "61%" }
        ]
    ),
    step(
        "welcome-private-space",
        4,
        "Accesso, messaggi e taccuino",
        "La password consegnata con la poesia sblocca le locations e lo spazio personale: da qui puoi scrivere ad altre locations e conservare ciò che incontri.",
        [
            "Messaggi online o destinati alla consegna fisica",
            "Visibilità della propria location controllabile",
            "Taccuino salvato soltanto sul dispositivo"
        ],
        "./index.html?onboarding-preview=1&onboarding-menu=1",
        "Menu del sito aperto con indicazioni sull’accesso alle locations, sullo spazio privato e sulle impostazioni.",
        [
            { label: "Spazio privato", x: "47%", y: "38%" },
            { label: "Accesso alle locations", x: "48%", y: "69%", tone: "yellow" },
            { label: "Controlli e privacy", x: "70%", y: "12%", tone: "red" }
        ]
    ),
    step(
        "welcome-support",
        5,
        "Sostieni il progetto",
        "Basta una condivisione: fai conoscere anonMrcn a chi vive, ha vissuto o attraversa Marcon.",
        [
            "Condividi il sito con una persona interessata a Marcon",
            "Aiuta nuove memorie e testimonianze a raggiungere il progetto"
        ],
        "./index.html?onboarding-preview=1&onboarding-menu=1",
        "Menu del sito aperto con l’indicazione per sostenere e condividere il progetto anonMrcn.",
        [
            { label: "Basta una condivisione", x: "48%", y: "17%", tone: "yellow" }
        ]
    )
]);
