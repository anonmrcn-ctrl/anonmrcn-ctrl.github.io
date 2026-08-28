(() => {
    "use strict";

    const poem = document.querySelector("main.poesia");
    const metric = window.NNMRCN_POEM_METRIC;

    if (!poem || poem.dataset.versiNumerati === "true") {
        return;
    }

    const blankRowsBetweenStanzas = Number(
        metric?.blankRowsBetweenStanzas ?? 1
    );
    const paragraphs = Array.from(poem.querySelectorAll(".canto p"));
    let rowNumber = 0;

    paragraphs.forEach((paragraph, paragraphIndex) => {
        if (paragraphIndex > 0) {
            for (let index = 0; index < blankRowsBetweenStanzas; index += 1) {
                rowNumber += 1;

                if (rowNumber % 5 === 0) {
                    paragraphs[paragraphIndex - 1].dataset.numeroRigoVuoto =
                        String(rowNumber);
                }
            }
        }

        Array.from(paragraph.childNodes).forEach((node) => {
            if (node.nodeType === Node.TEXT_NODE) {
                if (!node.textContent.trim()) {
                    return;
                }

                const line = document.createElement("span");
                line.className = "verso-linea";
                node.replaceWith(line);
                line.appendChild(node);
                node = line;
            } else if (
                node.nodeType === Node.ELEMENT_NODE &&
                node.tagName === "SPAN"
            ) {
                node.classList.add("verso-linea");
            } else {
                return;
            }

            rowNumber += 1;

            if (rowNumber % 5 === 0) {
                node.dataset.numeroVerso = String(rowNumber);
            }
        });
    });

    poem.dataset.versiNumerati = "true";
    poem.dataset.totaleRighi = String(rowNumber);
})();
