function item(id, menuKey, position, label, href) {
    return Object.freeze({
        id,
        menuKey,
        position,
        label,
        href,
        visibility: "public"
    });
}

export const NAVIGATION_SEEDS = Object.freeze([
    item("nav-main-poem", "main", 1, "La poesia", "./index.html"),
    item("nav-main-author", "main", 2, "L’autore", "./autore.html"),
    item("nav-main-project", "main", 3, "Il progetto", "./progetto.html"),
    item(
        "nav-main-public-space",
        "main",
        4,
        "Spazio pubblico",
        "./spazio-pubblico.html"
    ),
    item(
        "nav-support-project",
        "support",
        1,
        "Sostieni il progetto",
        "https://www.produzionidalbasso.com/project/fondi-necessari-per-portare-avanti-anonmrcn/"
    ),
    item("nav-utility-admin", "utility", 1, "admin space", "./admin.html")
]);
