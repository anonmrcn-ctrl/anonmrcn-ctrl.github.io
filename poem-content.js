(() => {
    "use strict";

    const api = window.NNMRCN_API;
    const poemRoot = document.querySelector("main.poesia");
    const paragraphClasses = new Set([
        "",
        "isolato",
        "perche",
        "figura",
        "accelerazione",
        "parole",
        "non-tempo",
        "chi",
        "finale"
    ]);
    const indentClasses = [
        "",
        "rientro",
        "rientro-profondo",
        "rientro-massimo"
    ];

    window.NNMRCN_POEM_READY = loadPoem();

    async function loadPoem() {
        if (!api || !poemRoot) {
            return finish("fallback");
        }

        try {
            const data = await api.request(
                "/api/public/poems/il-gajo-tra-i-praelli"
            );
            const poem = data?.poem;

            if (!sameAsStaticPoem(poem)) {
                renderPoem(poem);
            }

            return finish("d1");
        } catch (_) {
            return finish("fallback");
        }
    }

    function sameAsStaticPoem(poem) {
        if (typeof poemRoot.querySelectorAll !== "function") {
            return false;
        }

        try {
            return JSON.stringify(poemShapeFromData(poem)) ===
                JSON.stringify(poemShapeFromDocument());
        } catch (_) {
            return false;
        }
    }

    function poemShapeFromData(poem) {
        if (!Array.isArray(poem?.sections) || !poem.sections.length) {
            throw new Error("POEM_CONTENT_INVALID");
        }

        return poem.sections.map((section) => {
            const paragraphs = [];
            let activeStanza = null;
            let paragraph = null;

            for (const line of section.lines || []) {
                const stanza = positiveInteger(line?.metadata?.stanza);

                if (stanza !== activeStanza) {
                    paragraph = {
                        className: String(line?.metadata?.paragraphClass || ""),
                        lines: []
                    };
                    paragraphs.push(paragraph);
                    activeStanza = stanza;
                }

                paragraph.lines.push({
                    text: String(line?.text || "").trim(),
                    indent: Number(line?.indent) || 0
                });
            }

            return {
                anchor: String(section.anchor || ""),
                title: String(section.title || "").trim(),
                paragraphs
            };
        });
    }

    function poemShapeFromDocument() {
        return [...poemRoot.querySelectorAll(":scope > section.canto")]
            .map((section) => ({
                anchor: section.id,
                title: section.querySelector(":scope > h2.numero")?.textContent?.trim() || "",
                paragraphs: [...section.querySelectorAll(":scope > p")]
                    .map((paragraph) => ({
                        className: paragraphClasses.has(paragraph.className)
                            ? paragraph.className
                            : "",
                        lines: [...paragraph.childNodes]
                            .filter((node) => node.textContent?.trim())
                            .map((node) => ({
                                text: node.textContent.trim(),
                                indent: node.nodeType === Node.ELEMENT_NODE
                                    ? indentClasses.findIndex((name) =>
                                        name && node.classList.contains(name)
                                    )
                                    : 0
                            }))
                    }))
            }));
    }

    function renderPoem(poem) {
        if (!Array.isArray(poem?.sections) || !poem.sections.length) {
            throw new Error("POEM_CONTENT_INVALID");
        }

        const fragment = document.createDocumentFragment();

        for (const sectionData of poem.sections) {
            if (!Array.isArray(sectionData?.lines) || !sectionData.lines.length) {
                throw new Error("POEM_SECTION_INVALID");
            }

            const section = document.createElement("section");
            const heading = document.createElement("h2");
            let activeStanza = null;
            let paragraph = null;

            section.className = "canto";
            section.id = validAnchor(sectionData.anchor)
                ? sectionData.anchor
                : `canto-${Number(sectionData.position) || 1}`;
            heading.className = "numero";
            heading.textContent = String(sectionData.title || "");
            section.append(heading);

            for (const lineData of sectionData.lines) {
                const stanza = positiveInteger(lineData?.metadata?.stanza);

                if (stanza !== activeStanza) {
                    paragraph = document.createElement("p");
                    const paragraphClass = String(
                        lineData?.metadata?.paragraphClass || ""
                    );

                    if (paragraphClasses.has(paragraphClass) && paragraphClass) {
                        paragraph.className = paragraphClass;
                    }
                    section.append(paragraph);
                    activeStanza = stanza;
                }

                const line = document.createElement("span");
                const indent = Number(lineData.indent);

                if (indentClasses[indent]) {
                    line.className = indentClasses[indent];
                }
                line.dataset.poemLine = String(lineData.id || "");
                line.textContent = String(lineData.text || "");
                paragraph.append(line);
            }

            fragment.append(section);
        }

        poemRoot.replaceChildren(fragment);
    }

    function positiveInteger(value) {
        const number = Number(value);
        return Number.isInteger(number) && number > 0 ? number : 1;
    }

    function validAnchor(value) {
        return typeof value === "string" &&
            /^[A-Za-z0-9_-]{1,80}$/u.test(value);
    }

    function finish(source) {
        document.documentElement.dataset.cmsPoemSource = source;
        window.dispatchEvent(new CustomEvent("nnmrcn:poem-content-ready", {
            detail: { slug: "il-gajo-tra-i-praelli", source }
        }));
        return { source };
    }
})();
