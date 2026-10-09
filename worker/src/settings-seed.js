function page(title, description = "") {
    return Object.freeze({ title, description });
}

export const LEGACY_SITE_METADATA_PAGES_V1 = Object.freeze({
    accesso: page("Accesso — nnMrcn"),
    admin: page("Amministrazione — nnMrcn"),
    archivio: page(
        "Archivio — nnMrcn",
        "Archivio pubblico dei messaggi del progetto nnMrcn"
    ),
    autore: page(
        "L’autore — nnMrcn",
        "L'autore del progetto poetico dedicato a Marcon"
    ),
    index: page("nnMrcn", "Il Gajo tra i Praelli — poesia"),
    logo: page(
        "Il logo — nnMrcn",
        "Il significato del logo del progetto artistico anonMrcn"
    ),
    luogo: page(
        "Un luogo — nnMrcn",
        "Una breve spiegazione dedicata a un luogo di Marcon"
    ),
    memorie: page(
        "Memorie — nnMrcn",
        "Memorie degli abitanti legate ai luoghi di Marcon"
    ),
    privacy: page(
        "Privacy Policy — anonMrcn",
        "Informativa sulla privacy del progetto artistico anonMrcn"
    ),
    progetto: page(
        "Il progetto — nnMrcn",
        "Il progetto poetico nnMrcn, i luoghi di Marcon e la mappa storica del 1975"
    ),
    "spazio-personale": page(
        "Spazio personale — nnMrcn",
        "Spazio personale di nnMrcn: messaggi e taccuino"
    ),
    "spazio-pubblico": page(
        "Spazio pubblico — nnMrcn",
        "Spazio pubblico di nnMrcn: memorie, archivio e voci sul territorio"
    ),
    taccuino: page(
        "Taccuino — nnMrcn",
        "Taccuino personale dei luoghi e dei contenuti salvati su nnMrcn"
    ),
    voci: page(
        "Voci — nnMrcn",
        "Voci pubbliche di nnMrcn dedicate al territorio di Marcon"
    )
});

export const SITE_METADATA_PAGES = Object.freeze({
    accesso: page("Accesso — nnMrcn"),
    admin: page("Amministrazione — nnMrcn"),
    archivio: page(
        "Archivio dei messaggi — nnMrcn",
        "L’archivio anonimo dei messaggi pubblicati nel progetto nnMrcn con il consenso delle persone coinvolte."
    ),
    autore: page(
        "L’autore — nnMrcn",
        "L’autore di nnMrcn racconta il progetto artistico nato a Marcon per unire la comunità attraverso poesia, territorio e partecipazione."
    ),
    index: page(
        "Il Gajo tra i Praelli — nnMrcn",
        "Il Gajo tra i Praelli: una poesia interattiva su Marcon, Gaggio e un territorio trasformato dal paesaggio e dalle infrastrutture."
    ),
    logo: page(
        "Il logo di anonMrcn e il paesaggio di Marcon",
        "Il significato del logo di anonMrcn: prati, campi, infrastrutture e montagne nella forma stilizzata della mappa di Marcon."
    ),
    luogo: page(
        "Un luogo — nnMrcn",
        "Una breve spiegazione dedicata a un luogo di Marcon"
    ),
    memorie: page(
        "Memorie dei luoghi di Marcon — nnMrcn",
        "Ricordi, immagini e suoni degli abitanti legati ai luoghi di Marcon, raccolti in una mappa partecipativa e pubblicati dopo moderazione."
    ),
    privacy: page(
        "Informativa sulla privacy — anonMrcn",
        "Informativa sul trattamento dei dati personali nel progetto artistico e partecipativo anonMrcn."
    ),
    progetto: page(
        "Mappa poetica e storica di Marcon — nnMrcn",
        "Esplora i luoghi della poesia, la mappa storica di Marcon del 1975 e le trasformazioni del territorio attraverso il progetto nnMrcn."
    ),
    "spazio-personale": page(
        "Spazio personale — nnMrcn",
        "Spazio personale di nnMrcn: messaggi e taccuino"
    ),
    "spazio-pubblico": page(
        "Memorie, archivio e storia di Marcon — nnMrcn",
        "Lo spazio pubblico di nnMrcn raccoglie memorie, messaggi e voci dedicate ai luoghi, ai nomi e alla storia del territorio di Marcon."
    ),
    taccuino: page(
        "Taccuino — nnMrcn",
        "Taccuino personale dei luoghi e dei contenuti salvati su nnMrcn"
    ),
    voci: page(
        "Luoghi, toponimi e storia di Marcon — nnMrcn",
        "Voci documentate sui luoghi, i toponimi, il paesaggio e la storia di Marcon, con fonti, fotografie e collegamenti alla mappa."
    )
});

export const SITE_SETTINGS_SEEDS = Object.freeze([
    Object.freeze({
        key: "site.identity",
        value: Object.freeze({
            name: "anonMrcn",
            projectName: "nnMrcn"
        })
    }),
    Object.freeze({
        key: "site.metadata.pages",
        value: SITE_METADATA_PAGES
    }),
    Object.freeze({
        key: "site.manifest.public",
        value: Object.freeze({
            name: "anonMrcn",
            shortName: "anonMrcn",
            description: "Poesie, luoghi e messaggi del progetto nnMrcn."
        })
    }),
    Object.freeze({
        key: "site.manifest.admin",
        value: Object.freeze({
            name: "nnMrcn — Amministrazione",
            shortName: "nnMrcn Admin",
            description: "Moderazione dei messaggi del progetto nnMrcn."
        })
    })
]);
