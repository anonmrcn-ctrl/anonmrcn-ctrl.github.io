(() => {
    "use strict";

    const button = document.getElementById("menuButton");
    const closeButton = document.getElementById("menuClose");
    const menu = document.getElementById("menuPrincipale");
    const overlay = document.getElementById("menuOverlay");

    const projectIntro = document.querySelector(
        ".pagina-progetto .progetto-intro"
    );

    if (projectIntro) {
        const linkParagraph = document.createElement("p");
        linkParagraph.className = "progetto-link-esterno";

        const link = document.createElement("a");
        link.href = "https://www.comune.marcon.ve.it/vivere-il-comune/territorio/cosa-fare-e-vedere/";
        link.textContent = "cosa fare e vedere";

        linkParagraph.appendChild(link);
        projectIntro.insertAdjacentElement("afterend", linkParagraph);
    }

    if (!button || !closeButton || !menu || !overlay) {
        return;
    }

    function openMenu() {
        menu.classList.add("aperto");
        overlay.classList.add("aperto");
        button.setAttribute("aria-expanded", "true");
        document.body.classList.add("menu-aperto");
    }

    function closeMenu() {
        menu.classList.remove("aperto");
        overlay.classList.remove("aperto");
        button.setAttribute("aria-expanded", "false");
        document.body.classList.remove("menu-aperto");
    }

    button.addEventListener("click", openMenu);
    closeButton.addEventListener("click", closeMenu);
    overlay.addEventListener("click", closeMenu);

    document.addEventListener("keydown", (event) => {
        if (event.key === "Escape") {
            closeMenu();
        }
    });
})();
