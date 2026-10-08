function permalink(id, path, targetType, targetId) {
    return Object.freeze({ id, path, targetType, targetId });
}

export const STATIC_PERMALINK_SEEDS = Object.freeze([
    permalink("permalink-home-root", "/", "poem_work", "poem-il-gajo-tra-i-praelli"),
    permalink("permalink-home-html", "/index.html", "poem_work", "poem-il-gajo-tra-i-praelli"),
    permalink("permalink-project", "/progetto.html", "site_page", "page-progetto"),
    permalink("permalink-project-map", "/progetto.html#map", "page_anchor", "progetto-map"),
    permalink("permalink-project-access", "/progetto.html#accessoLocations", "page_anchor", "progetto-accesso-locations"),
    permalink("permalink-project-request", "/progetto.html#richiestaCodiceForm", "page_anchor", "progetto-richiesta-codice"),
    permalink("permalink-author", "/autore.html", "site_page", "page-autore"),
    permalink("permalink-author-contacts", "/autore.html#contattiTitolo", "page_anchor", "autore-contatti"),
    permalink("permalink-logo", "/logo.html", "site_page", "page-logo"),
    permalink("permalink-public-space", "/spazio-pubblico.html", "site_page", "page-spazio-pubblico"),
    permalink("permalink-archive", "/archivio.html", "site_page", "page-archivio"),
    permalink("permalink-memories", "/memorie.html", "site_page", "page-memorie"),
    permalink("permalink-notebook", "/taccuino.html", "site_page", "page-taccuino"),
    permalink("permalink-notebook-access", "/taccuino.html#accessoLocations", "page_anchor", "taccuino-accesso-locations"),
    permalink("permalink-personal-space", "/spazio-personale.html", "site_page", "page-spazio-personale"),
    permalink("permalink-personal-space-access", "/spazio-personale.html#accessoLocations", "page_anchor", "spazio-personale-accesso-locations"),
    permalink("permalink-personal-space-messages", "/spazio-personale.html#messaggi", "page_anchor", "spazio-personale-messaggi"),
    permalink("permalink-access", "/accesso.html", "site_page", "page-accesso"),
    permalink("permalink-wiki", "/voci.html", "wiki_collection", "wiki"),
    permalink("permalink-wiki-editor", "/voci.html#editor", "page_anchor", "voci-editor"),
    permalink("permalink-place", "/luogo.html", "map_entry_route", "map-entry"),
    permalink("permalink-privacy", "/privacy.html", "legal_document_route", "privacy"),
    permalink("permalink-admin", "/admin.html", "software_route", "admin")
]);

export const POEM_SECTION_PERMALINK_SEEDS = Object.freeze([
    ["I", "poem-gajo-canto-i"],
    ["II", "poem-gajo-canto-ii"],
    ["III", "poem-gajo-canto-iii"],
    ["IV", "poem-gajo-canto-iv"]
].flatMap(([anchor, targetId]) => [
    permalink(
        `permalink-poem-root-${anchor.toLowerCase()}`,
        `/#${anchor}`,
        "poem_section",
        targetId
    ),
    permalink(
        `permalink-poem-html-${anchor.toLowerCase()}`,
        `/index.html#${anchor}`,
        "poem_section",
        targetId
    )
]));
