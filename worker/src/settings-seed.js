function page(title, description = "") {
    return Object.freeze({ title, description });
}

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
        value: Object.freeze({
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
        })
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
