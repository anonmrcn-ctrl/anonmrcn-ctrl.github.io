function page(id, slug, title, description, blocks) {
    return Object.freeze({
        id,
        slug,
        title,
        description,
        blocks: Object.freeze(blocks.map(([blockId, type, text], index) =>
            Object.freeze({
                id: blockId,
                position: index + 1,
                type,
                content: Object.freeze({ text })
            })
        ))
    });
}

export const PAGE_SEEDS = Object.freeze([
    page(
        "page-progetto",
        "progetto",
        "Il progetto",
        "Mappa, luoghi, percorso poetico e rete delle location di anonMrcn.",
        [
            ["progetto-title", "heading", "Il progetto"],
            [
                "progetto-map-intro",
                "paragraph",
                "Questa mappa mostra i luoghi di cui parla la poesia, oltre a quelli importanti per la storia di Marcon. È possibile confrontare la mappa attuale con mappe storiche (per ora solo quella del 1975), ricavate da foto aeree consultabili presso l'aerofototeca del Veneto e da me personalmente georeferenziate. I luoghi e i materiali cartografici verranno aggiunti progressivamente."
            ],
            [
                "progetto-access-prefix",
                "paragraph",
                "Se hai ricevuto personalmente una poesia a casa tua, "
            ],
            [
                "progetto-access-link",
                "paragraph",
                "puoi accedere con la password che ti è stata fornita all'interno di essa"
            ],
            [
                "progetto-access-suffix",
                "paragraph",
                ". Questo accesso sbloccherà sulla mappa le diverse locations dove sono state distribuite le poesie e ti consentirà di spedire un messaggio, online o fisicamente, in una di queste location."
            ],
            [
                "progetto-request-prefix",
                "paragraph",
                "Non hai ricevuto la poesia ma vuoi comunque inviare messaggi? "
            ],
            [
                "progetto-request-link",
                "paragraph",
                "Richiedi un codice all'admin"
            ],
            [
                "progetto-map-guide-title",
                "heading",
                "Come esplorare la mappa"
            ],
            [
                "progetto-map-guide-compare",
                "paragraph",
                "Confronta il territorio attuale con quello del 1975."
            ],
            [
                "progetto-map-guide-places",
                "paragraph",
                "Il livello «Luoghi» è già attivo: tocca un elemento per leggerne informazioni e collegamenti."
            ],
            [
                "progetto-development-prefix",
                "callout",
                "Lo sviluppo di questa pagina non è ancora completato: mancano ancora da georeferenziare molte foto. Vuoi dare una mano al suo sviluppo? "
            ],
            [
                "progetto-development-link",
                "callout",
                "Contatta l’admin"
            ]
        ]
    ),
    page(
        "page-autore",
        "autore",
        "L’autore",
        "Presentazione e contatti dell’autore di anonMrcn.",
        [
            ["autore-title", "heading", "L’autore"],
            [
                "autore-bio-1",
                "paragraph",
                "Sono un ragazzo nato e vissuto a Marcon che ha deciso di iniziare a fare qualcosa per la propria città."
            ],
            [
                "autore-bio-2",
                "paragraph",
                "Ho deciso di farlo tramite la cosa che mi entusiasma di più: creare arte."
            ],
            [
                "autore-bio-3",
                "paragraph",
                "La mia speranza, tramite il mio lavoro, è quella di unire la comunità di Marcon in un modo nuovo ed inaspettato, ed allo stesso tempo di trasmettere messaggi in un modo non convenzionale rispetto ai tempi in cui viviamo."
            ],
            ["autore-signature", "paragraph", "-nnMrcn-"],
            ["autore-contacts-title", "heading", "Contatti"]
        ]
    ),
    page(
        "page-logo",
        "logo",
        "Il logo",
        "Significato dei colori e delle forme del logo di anonMrcn.",
        [
            ["logo-title", "heading", "Il logo"],
            ["logo-green-title", "heading", "Il verde"],
            [
                "logo-green-text",
                "paragraph",
                "Questo colore rappresenta i prati e i boschi che sono all’origine del nostro territorio comunale e che ancora ricoprono, in parte, il comune."
            ],
            ["logo-yellow-title", "heading", "Il giallo"],
            [
                "logo-yellow-text",
                "paragraph",
                "Questo colore rappresenta la parte antropizzata del paesaggio di Marcon: il campo agricolo."
            ],
            ["logo-shapes-title", "heading", "Le forme"],
            [
                "logo-shapes-text",
                "paragraph",
                "La forma del logo riprende la figura stilizzata della mappa di Marcon, divisa secondo le infrastrutture che l’attraversano: fiumi, autostrade e ferrovie."
            ],
            ["logo-white-title", "heading", "Il bianco"],
            [
                "logo-white-text",
                "paragraph",
                "Questo colore rappresenta le montagne che si stagliano lontane, ma sono sempre presenti all’orizzonte. Il bianco inonda il sito come l’immagine delle montagne inonda Marcon in una limpida giornata."
            ]
        ]
    ),
    page(
        "page-spazio-pubblico",
        "spazio-pubblico",
        "Spazio pubblico",
        "La parte collettiva del progetto anonMrcn.",
        [
            ["spazio-pubblico-title", "heading", "Spazio pubblico"],
            [
                "spazio-pubblico-lead",
                "paragraph",
                "La parte collettiva del progetto, accessibile a tutti."
            ],
            [
                "spazio-pubblico-development-prefix",
                "callout",
                "Questa pagina è ancora sperimentale e mancano ancora molte funzionalità e informazioni. Vuoi dare una mano al suo sviluppo? "
            ],
            [
                "spazio-pubblico-development-link",
                "callout",
                "Contatta l’admin"
            ],
            ["spazio-pubblico-memorie-title", "heading", "Memorie"],
            [
                "spazio-pubblico-memorie-text",
                "paragraph",
                "Ricordi, immagini e suoni legati ai luoghi di Marcon."
            ],
            ["spazio-pubblico-archivio-title", "heading", "Archivio"],
            [
                "spazio-pubblico-archivio-text",
                "paragraph",
                "I messaggi resi pubblici con il consenso delle persone coinvolte."
            ],
            ["spazio-pubblico-voci-title", "heading", "Voci"],
            [
                "spazio-pubblico-voci-text",
                "paragraph",
                "Schede dedicate ai luoghi, ai nomi e alla storia del territorio."
            ]
        ]
    ),
    page(
        "page-archivio",
        "archivio",
        "Archivio",
        "Archivio pubblico dei messaggi autorizzati.",
        [
            ["archivio-title", "heading", "Archivio"],
            [
                "archivio-intro",
                "paragraph",
                "Qui vengono raccolti anonimamente i messaggi che il mittente e il destinatario hanno autorizzato e che l’amministratore ha scelto di pubblicare."
            ]
        ]
    ),
    page(
        "page-memorie",
        "memorie",
        "Memorie",
        "Ricordi, immagini e suoni legati ai luoghi di Marcon.",
        [
            ["memorie-title", "heading", "Memorie"],
            [
                "memorie-intro",
                "paragraph",
                "Ricordi, immagini e suoni legati ai luoghi di Marcon. Ogni contributo compare soltanto dopo il controllo dell’amministratore."
            ]
        ]
    ),
    page(
        "page-taccuino",
        "taccuino",
        "Taccuino",
        "Raccolta personale locale dei contenuti salvati.",
        [
            ["taccuino-locked-title", "heading", "Taccuino personale"],
            [
                "taccuino-locked-text",
                "paragraph",
                "Il taccuino fa parte dello Spazio personale."
            ],
            ["taccuino-title", "heading", "Taccuino"],
            [
                "taccuino-intro",
                "paragraph",
                "Qui ritrovi luoghi, versi, memorie e messaggi salvati durante l’esplorazione. Il contenuto resta su questo dispositivo e non viene inviato al server."
            ],
            ["taccuino-map-title", "heading", "La mia mappa"],
            ["taccuino-items-title", "heading", "Elementi salvati"]
        ]
    ),
    page(
        "page-spazio-personale",
        "spazio-personale",
        "Spazio personale",
        "Messaggi e taccuino della location autenticata.",
        [
            ["spazio-personale-locked-title", "heading", "Spazio personale"],
            [
                "spazio-personale-locked-text",
                "paragraph",
                "Questa sezione compare dopo l’accesso con la password della poesia."
            ],
            ["spazio-personale-title", "heading", "Spazio personale"],
            ["spazio-personale-messages-title", "heading", "Messaggi"],
            [
                "spazio-personale-messages-text",
                "paragraph",
                "Scrivi alle altre locations e leggi i messaggi ricevuti."
            ],
            ["spazio-personale-notebook-title", "heading", "Taccuino"],
            [
                "spazio-personale-notebook-suffix",
                "paragraph",
                " elementi salvati in questo dispositivo."
            ]
        ]
    ),
    page(
        "page-accesso",
        "accesso",
        "Accesso",
        "Accesso riservato tramite il codice QR della poesia.",
        [
            ["accesso-brand", "paragraph", "nnMrcn"],
            ["accesso-title", "heading", "Accesso"],
            [
                "accesso-intro",
                "paragraph",
                "Inserisci la password stampata sul foglio, appena sopra il codice QR."
            ],
            ["accesso-denied-title", "heading", "Collegamento necessario"],
            [
                "accesso-denied-text",
                "paragraph",
                "Questa pagina può essere aperta soltanto dal codice QR presente sul foglio consegnato."
            ],
            ["accesso-password-title", "heading", "Password"]
        ]
    )
]);
