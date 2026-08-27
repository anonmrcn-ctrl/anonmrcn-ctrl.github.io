(() => {
    "use strict";

    const poem = document.querySelector("main.poesia");

    if (!poem || poem.dataset.versiNumerati === "true") {
        return;
    }

    const verses = [];

    poem.querySelectorAll(".canto p").forEach((paragraph) => {
        Array.from(paragraph.childNodes).forEach((node) => {
            if (node.nodeType === Node.TEXT_NODE) {
                if (!node.textContent.trim()) {
                    return;
                }

                const line = document.createElement("span");
                line.className = "verso-linea";
                node.replaceWith(line);
                line.appendChild(node);
                verses.push(line);
                return;
            }

            if (
                node.nodeType === Node.ELEMENT_NODE &&
                node.tagName === "SPAN"
            ) {
                node.classList.add("verso-linea");
                verses.push(node);
            }
        });
    });

    verses.forEach((verse, index) => {
        const number = index + 1;

        if (number % 5 === 0) {
            verse.dataset.numeroVerso = String(number);
        }
    });

    poem.dataset.versiNumerati = "true";
    poem.dataset.totaleVersi = String(verses.length);
})();
