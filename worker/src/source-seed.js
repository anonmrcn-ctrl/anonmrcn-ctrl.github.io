function source(id, title, url) {
    return Object.freeze({
        id,
        sourceType: "web",
        title,
        author: "",
        publicationDate: "",
        url,
        note: ""
    });
}

export const SHARED_SOURCE_SEEDS = Object.freeze([
    source("source-marcon-wikipedia", "Marcon", "https://it.wikipedia.org/wiki/Marcon"),
    source("source-gaggio-wikipedia", "Gaggio", "https://it.wikipedia.org/wiki/Gaggio_(Marcon)"),
    source("source-praello-comune", "Praello", "https://www.comune.marcon.ve.it/vivere-il-comune/luoghi/frazione-praello/"),
    source("source-colmello-comune", "Colmello", "https://www.comune.marcon.ve.it/vivere-il-comune/luoghi/frazione-colmello/"),
    source("source-pojanon-wikipedia", "Pojanon", "https://it.wikipedia.org/wiki/Marcon#Origini_del_nome"),
    source("source-zero-wikipedia", "Zero", "https://it.wikipedia.org/wiki/Zero_(fiume)"),
    source("source-dese-wikipedia", "Dese", "https://it.wikipedia.org/wiki/Dese_(fiume)"),
    source("source-sile-wikipedia", "Sile", "https://it.wikipedia.org/wiki/Sile"),
    source("source-zuccarello-comune", "Zuccarello", "https://www.comune.marcon.ve.it/vivere-il-comune/luoghi/frazione-zuccarello/"),
    source("source-fossa-storta-wikipedia", "Fossa Storta", "https://it.wikipedia.org/wiki/Marcon#Geografia_fisica"),
    source("source-a57-wikipedia", "Tangenziale di Mestre — A57", "https://it.wikipedia.org/wiki/Autostrada_A57_(Italia)"),
    source("source-a27-wikipedia", "Autostrada A27 d’Alemagna", "https://it.wikipedia.org/wiki/Autostrada_A27_(Italia)"),
    source("source-a4-wikipedia", "Autostrada Serenissima — A4", "https://it.wikipedia.org/wiki/Autostrada_A4_(Italia)"),
    source("source-mogliano-wikipedia", "Mogliano Veneto", "https://it.wikipedia.org/wiki/Mogliano_Veneto"),
    source("source-bonisiolo-wikipedia", "Bonisiolo", "https://it.wikipedia.org/wiki/Bonisiolo"),
    source("source-casale-sul-sile-wikipedia", "Casale sul Sile", "https://it.wikipedia.org/wiki/Casale_sul_Sile"),
    source("source-grigoletto-pasqualato-wikipedia", "Giuseppe Grigoletto e Savino Pasqualato", "https://it.wikipedia.org/wiki/Giuseppe_Grigoletto_e_Savino_Pasqualato")
]);

export const SHARED_SOURCE_IDS_BY_URL = Object.freeze(
    Object.fromEntries(SHARED_SOURCE_SEEDS.map((item) => [item.url, item.id]))
);
