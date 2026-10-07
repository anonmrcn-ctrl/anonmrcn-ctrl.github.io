const SOURCES = Object.freeze({
    marcon: { terms: ["Marcon"], url: "https://it.wikipedia.org/wiki/Marcon" },
    gaggio: {
        terms: ["Gaggio", "Gajo", "Via Alta"],
        url: "https://it.wikipedia.org/wiki/Gaggio_(Marcon)"
    },
    praello: {
        terms: ["Praello", "Praelli"],
        url: "https://www.comune.marcon.ve.it/vivere-il-comune/luoghi/frazione-praello/"
    },
    colmello: {
        terms: ["Colmello"],
        url: "https://www.comune.marcon.ve.it/vivere-il-comune/luoghi/frazione-colmello/"
    },
    pojanon: {
        terms: ["Pojanon", "Povegliano"],
        url: "https://it.wikipedia.org/wiki/Marcon#Origini_del_nome"
    },
    zero: { terms: ["Zero"], url: "https://it.wikipedia.org/wiki/Zero_(fiume)" },
    dese: { terms: ["Dese"], url: "https://it.wikipedia.org/wiki/Dese_(fiume)" },
    sile: { terms: ["Sile"], url: "https://it.wikipedia.org/wiki/Sile" },
    zuccarello: {
        terms: ["Zuccarello"],
        url: "https://www.comune.marcon.ve.it/vivere-il-comune/luoghi/frazione-zuccarello/"
    },
    fossaStorta: {
        terms: ["Fossa Storta"],
        url: "https://it.wikipedia.org/wiki/Marcon#Geografia_fisica"
    },
    a57: {
        terms: ["Tangenziale di Mestre", "A57"],
        url: "https://it.wikipedia.org/wiki/Autostrada_A57_(Italia)"
    },
    a27: {
        terms: ["autostrada A27 d’Alemagna", "A27 d’Alemagna", "A27"],
        url: "https://it.wikipedia.org/wiki/Autostrada_A27_(Italia)"
    },
    a4: {
        terms: ["Autostrada Serenissima", "A4"],
        url: "https://it.wikipedia.org/wiki/Autostrada_A4_(Italia)"
    },
    mogliano: {
        terms: ["Mogliano Veneto", "Mazzocco"],
        url: "https://it.wikipedia.org/wiki/Mogliano_Veneto"
    },
    bonisiolo: {
        terms: ["Bonisiolo"],
        url: "https://it.wikipedia.org/wiki/Bonisiolo"
    },
    casale: {
        terms: ["Casale sul Sile"],
        url: "https://it.wikipedia.org/wiki/Casale_sul_Sile"
    },
    grigolettoPasqualato: {
        terms: ["via Grigoletto e via Pasqualato", "Grigoletto", "Pasqualato"],
        url: "https://it.wikipedia.org/wiki/Giuseppe_Grigoletto_e_Savino_Pasqualato"
    }
});

export const NARRATIVE_STEP_SEEDS = Object.freeze([
    {
        key: "gaggio",
        position: 1,
        verse: "v. 2 — «Il Gajo tra i Praelli»",
        label: "Gaggio",
        title: "Il Gajo",
        titleUrl: SOURCES.gaggio.url,
        lat: 45.55191,
        lon: 12.31671,
        zoom: 16,
        sources: [SOURCES.gaggio],
        text: "Il toponimo «Gaggio» deriva dal termine longobardo per «boscaglia». Infatti questo territorio, fino ai primi decenni del Novecento, era ricoperto da un fitto bosco. Nella poesia il «Gajo» è da considerarsi come questa ancestrale boscaglia andata perduta."
    },
    {
        key: "praello",
        position: 2,
        verse: "v. 2 — «Il Gajo tra i Praelli»",
        label: "Praello",
        title: "I Praelli",
        titleUrl: SOURCES.praello.url,
        lat: 45.53656,
        lon: 12.32324,
        zoom: 16,
        sources: [SOURCES.praello, SOURCES.gaggio],
        text: "Invece, «Praello» è un termine veneto, diminutivo di «prà», ossia prato. Nella poesia il «Gajo» è «tra i Praelli»: il bosco sta tra i piccoli prati."
    },
    {
        key: "via-alta",
        position: 3,
        verse: "v. 27 — «all’altezza di Via Alta»",
        label: "Via Alta",
        title: "Via Alta",
        titleUrl: SOURCES.gaggio.url,
        lat: 45.556404,
        lon: 12.291392,
        zoom: 15,
        sources: [SOURCES.gaggio, SOURCES.marcon],
        text: "Via Alta è una delle strade storiche di Marcon, un tempo associata alla «Via Bassa», oggi Via Monte Grappa. Quest’ultima aveva la nomea di diventare impraticabile alla minima pioggia, a differenza di Via Alta."
    },
    {
        key: "via-fornace",
        position: 4,
        verse: "v. 31 — «via Fornace»",
        label: "Via Fornace",
        title: "Via Fornace",
        titleUrl: "",
        lat: 45.565121,
        lon: 12.323637,
        zoom: 17,
        sources: [SOURCES.a57],
        text: "Il toponimo deriva dalla presenza di una vera e propria fornace, risalente all’inizio del secolo scorso ed oggi in disuso, alla fine della via. L’ho inserita all’interno della poesia poiché è una di quelle strade che è stata visibilmente tagliata dalla costruzione della A57 (Tangenziale di Mestre). In particolare, si può visibilmente notare come la fornace sia stata divisa dalle sue cave, oggi divenute area protetta."
    },
    {
        key: "via-bosco-berizzi",
        position: 5,
        verse: "v. 31 — «via Bosco Berizzi»",
        label: "Via Bosco Berizzi",
        title: "Via Bosco Berizzi",
        titleUrl: "",
        lat: 45.538066,
        lon: 12.301308,
        zoom: 17,
        sources: [SOURCES.dese, SOURCES.marcon, SOURCES.praello],
        text: "Il toponimo si riferisce ad un antico proprietario terriero, Berizzi, che aveva, alla fine dell’Ottocento, acquistato delle terre ricoperte di boschi tra Dese e Marcon, esattamente dove ora si trova la via. È stata scelta poiché evidentemente divisa dalla ferrovia; è inoltre ricavabile dalla mappa del 1975 che era qui presente un passaggio a livello per Praello, oggi non più attivo."
    },
    {
        key: "colmello",
        position: 6,
        verse: "v. 46 — «fra il Colmello e il Pojanon»",
        label: "Colmello",
        title: "Colmello",
        titleUrl: SOURCES.colmello.url,
        lat: 45.55898,
        lon: 12.27717,
        zoom: 16,
        sources: [SOURCES.colmello],
        text: "Il Colmello è una delle frazioni più piccole del comune, quella più a occidente del territorio. Il toponimo deriva da un vecchio termine veneto che in passato indicava una suddivisione amministrativa del territorio. Probabilmente la località era chiamata così fino agli anni Sessanta del secolo scorso."
    },
    {
        key: "pojanon",
        position: 7,
        verse: "v. 46 — «fra il Colmello e il Pojanon»",
        label: "Pojanon",
        title: "Pojanon",
        titleUrl: SOURCES.pojanon.url,
        lat: 45.56197,
        lon: 12.34999,
        zoom: 16,
        sources: [SOURCES.pojanon, SOURCES.gaggio, SOURCES.marcon],
        text: "Pojanon è una località minore del comune, all’estremo est del territorio. Il suo nome deriva da Povegliano, una sede abbaziale tardo-antica soppressa nel 1432 dal vescovo di Treviso, poiché ormai quasi abbandonata. I fedeli rimasti furono accomunati, insieme a quelli di Gaggio, alla parrocchia di Marcon."
    },
    {
        key: "zero",
        position: 8,
        verse: "v. 62 — «Zero!»",
        label: "Zero",
        title: "Lo Zero",
        titleUrl: SOURCES.zero.url,
        lat: 45.56687,
        lon: 12.29865,
        zoom: 16,
        sources: [
            SOURCES.zero,
            SOURCES.marcon,
            SOURCES.colmello,
            SOURCES.dese,
            SOURCES.zuccarello,
            SOURCES.sile
        ],
        text: "Lo Zero è uno dei fiumi più importanti per il territorio di Marcon: almeno un quarto del suo corso è all’interno del territorio comunale, dall’ingresso nella frazione di Colmello alla foce nel Dese, in località Zuccarello. Il toponimo deriverebbe dal nome personale di un colono romano a cui erano affidate le terre circostanti. Originariamente sfociava nel Sile, ma dal 1532 il tratto finale fu modificato artificialmente, portando all’attuale situazione. Nella poesia il protagonista confonde un altro personaggio con lo Zero, poiché ai suoi occhi sono molto simili."
    },
    {
        key: "via-della-costituzione",
        position: 9,
        verse: "v. 119 — «via della Costituzione»",
        label: "Via della Costituzione",
        title: "Via della Costituzione",
        titleUrl: "",
        lat: 45.5481,
        lon: 12.2971,
        zoom: 16,
        sources: [SOURCES.marcon],
        text: "Via di recente costruzione, nella poesia è comparata alle ginocchia del personaggio. Le ginocchia sono quella parte del corpo che ci consente di correre, azione che poi il protagonista compie. Via della Costituzione è la rappresentazione delle ginocchia di Marcon: ciò che gli consente di correre."
    },
    {
        key: "fossa-storta",
        position: 10,
        verse: "v. 139 — «Zero, Fossa Storta»",
        label: "Fossa Storta",
        title: "Fossa Storta",
        titleUrl: SOURCES.fossaStorta.url,
        lat: 45.536454,
        lon: 12.333278,
        zoom: 16,
        sources: [SOURCES.fossaStorta, SOURCES.dese],
        text: "Corso d’acqua minore il cui nome deriva dalla tortuosità del suo percorso, evidentissima nell’ultimo tratto prima della foce nel Dese. Questo canale presenta un elevato tasso di inquinamento, con alte concentrazioni di fosfati, legato al fatto che gran parte del suo bacino è urbanizzato."
    },
    {
        key: "a57",
        position: 11,
        verse: "v. 141 — «A57, A27, A4»",
        label: "A57",
        title: "A57 — Tangenziale di Mestre",
        titleUrl: SOURCES.a57.url,
        lat: 45.557929,
        lon: 12.316476,
        zoom: 15,
        sources: [SOURCES.a57, SOURCES.gaggio, SOURCES.marcon],
        text: "La Tangenziale di Mestre, censita come autostrada A57 dal 2009, fu costruita, all’interno del territorio comunale, tra il 1970 e il 1972. La sua costruzione ha diviso via Pialoi, via Alta e via Trento-Trieste — cesure risolte con la costruzione di cavalcavia —, via Perosi — risolta con un sottopasso —, via Venier e l’asse via Fornace/via Matteotti. Inoltre divide informalmente le frazioni di Gaggio e Marcon."
    },
    {
        key: "a27",
        position: 12,
        verse: "v. 141 — «A57, A27, A4»",
        label: "A27",
        title: "A27 — Autostrada d’Alemagna",
        titleUrl: SOURCES.a27.url,
        lat: 45.565509,
        lon: 12.274594,
        zoom: 15,
        sources: [SOURCES.a27, SOURCES.marcon, SOURCES.mogliano, SOURCES.bonisiolo],
        text: "Il tratto dell’autostrada A27 d’Alemagna che attraversa il territorio di Marcon fu aperto nel 1972. La sua costruzione ha diviso via Mazzocco e via Bonisiolo — cesure risolte con la costruzione di cavalcavia —, via Torni, via Cortellazzo e via Bonfadini — quest’ultima risolta con un sottopasso. Inoltre divide informalmente il comune di Marcon da quello di Mogliano Veneto."
    },
    {
        key: "a4",
        position: 13,
        verse: "v. 141 — «A57, A27, A4»",
        label: "A4",
        title: "A4 — Autostrada Serenissima",
        titleUrl: SOURCES.a4.url,
        lat: 45.5735,
        lon: 12.3348,
        zoom: 15,
        sources: [
            SOURCES.a4,
            SOURCES.marcon,
            SOURCES.bonisiolo,
            SOURCES.grigolettoPasqualato,
            SOURCES.casale,
            SOURCES.mogliano
        ],
        text: "Il tratto dell’A4 che attraversa il comune di Marcon fu inaugurato nel 2006. La sua costruzione ha diviso una strada privata tra Bonisiolo e Marcon, via Grigoletto e via Pasqualato — cesura risolta con un cavalcavia — e via Prati — risolta con un sottopasso. Inoltre divide informalmente il comune di Marcon da quelli di Casale sul Sile e Mogliano Veneto."
    }
]);
