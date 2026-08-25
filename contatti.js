(() => {
    "use strict";

    const api = window.NNMRCN_API;
    const toggle = document.getElementById("contattoToggle");
    const form = document.getElementById("contattoForm");
    const name = document.getElementById("contattoNome");
    const email = document.getElementById("contattoEmail");
    const message = document.getElementById("contattoTesto");
    const website = document.getElementById("contattoSito");
    const submit = document.getElementById("contattoInvia");
    const status = document.getElementById("contattoStatus");

    if (!api || !toggle || !form || !message || !submit || !status) {
        return;
    }

    const isCodeRequest = form.dataset.contactPurpose === "code-request";

    toggle.addEventListener("click", (event) => {
        event.preventDefault();
        form.hidden = !form.hidden;
        toggle.setAttribute("aria-expanded", String(!form.hidden));

        if (!form.hidden) {
            (isCodeRequest && email ? email : message).focus();
        }
    });

    form.addEventListener("submit", async (event) => {
        event.preventDefault();

        if (!form.reportValidity()) {
            return;
        }

        const text = message.value.trim();

        if (!text) {
            status.textContent = "Scrivi un messaggio prima di inviarlo.";
            message.focus();
            return;
        }

        submit.disabled = true;
        status.textContent = "Invio in corso…";

        try {
            await api.request("/api/contact", {
                method: "POST",
                body: JSON.stringify({
                    name: name?.value.trim() || "",
                    email: email?.value.trim() || "",
                    text,
                    website: website?.value || ""
                })
            });

            form.reset();
            status.textContent = isCodeRequest
                ? "Richiesta di codice inviata all’admin."
                : "Messaggio inviato all’autore.";
        } catch (error) {
            status.textContent =
                error.code === "API_NOT_CONFIGURED"
                    ? "Invio temporaneamente non disponibile."
                    : error.message || "Non è stato possibile inviare il messaggio.";
        } finally {
            submit.disabled = false;
        }
    });
})();
