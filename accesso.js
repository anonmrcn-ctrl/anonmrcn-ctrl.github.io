(() => {
    "use strict";

    const ACCESS_KEY = "nnmrcn_mayor_access";
    const SESSION_KEY = "nnmrcn_mayor_session";

    const verification = document.getElementById("accessoVerifica");
    const denied = document.getElementById("accessoNegato");
    const passwordSection = document.getElementById("accessoPassword");
    const form = document.getElementById("accessoSindacoForm");
    const passwordInput = document.getElementById("accessoSindacoPassword");
    const formMessage = document.getElementById("accessoSindacoMessaggio");
    const article = document.getElementById("messaggioSindaco");
    const articleTitle = document.getElementById("messaggioSindacoTitolo");
    const articleBody = document.getElementById("messaggioSindacoCorpo");
    const logoutButton = document.getElementById("accessoSindacoEsci");

    function sessionGet(key) {
        try {
            return sessionStorage.getItem(key) || "";
        } catch (_) {
            return "";
        }
    }

    function sessionSet(key, value) {
        try {
            sessionStorage.setItem(key, value);
        } catch (_) {}
    }

    function sessionRemove(key) {
        try {
            sessionStorage.removeItem(key);
        } catch (_) {}
    }

    function readQrAccess() {
        const url = new URL(window.location.href);
        const accessToken = String(url.searchParams.get("chiave") || "").trim();

        if (!accessToken) {
            return sessionGet(ACCESS_KEY);
        }

        sessionSet(ACCESS_KEY, accessToken);
        url.searchParams.delete("chiave");
        const cleanUrl = `${url.pathname}${url.search}${url.hash}`;
        history.replaceState(null, "", cleanUrl);

        return accessToken;
    }

    function showOnly(element) {
        for (const section of [verification, denied, passwordSection, article]) {
            section.hidden = section !== element;
        }
    }

    function renderBody(value) {
        articleBody.replaceChildren();

        const text = String(value || "").trim();

        if (!text) {
            return;
        }

        for (const paragraph of text.split(/\n{2,}/u)) {
            const element = document.createElement("p");
            element.textContent = paragraph;
            articleBody.append(element);
        }
    }

    async function loadMessage(sessionToken) {
        try {
            const data = await window.NNMRCN_API.request("/api/mayor/message", {
                headers: {
                    Authorization: `Bearer ${sessionToken}`
                }
            });

            articleTitle.textContent = data.title || "Messaggio per il sindaco";
            renderBody(data.body);
            showOnly(article);
            return true;
        } catch (error) {
            if (error.status === 401) {
                sessionRemove(SESSION_KEY);
                return false;
            }

            verification.textContent = "Impossibile caricare lo spazio riservato. Riprova.";
            showOnly(verification);
            return false;
        }
    }

    async function verifyAccess(accessToken) {
        try {
            await window.NNMRCN_API.request("/api/mayor/access", {
                method: "POST",
                body: JSON.stringify({ accessToken })
            });
            showOnly(passwordSection);
            passwordInput.focus();
            return true;
        } catch (_) {
            sessionRemove(ACCESS_KEY);
            showOnly(denied);
            return false;
        }
    }

    async function initialise() {
        const accessToken = readQrAccess();
        const sessionToken = sessionGet(SESSION_KEY);

        if (sessionToken && await loadMessage(sessionToken)) {
            return;
        }

        if (!accessToken) {
            showOnly(denied);
            return;
        }

        await verifyAccess(accessToken);
    }

    form.addEventListener("submit", async (event) => {
        event.preventDefault();

        const accessToken = sessionGet(ACCESS_KEY);
        const password = passwordInput.value;
        const submitButton = form.querySelector("button[type='submit']");

        submitButton.disabled = true;
        formMessage.textContent = "Verifica in corso…";

        try {
            const data = await window.NNMRCN_API.request("/api/mayor/login", {
                method: "POST",
                body: JSON.stringify({ accessToken, password })
            });

            sessionSet(SESSION_KEY, data.token);
            passwordInput.value = "";
            formMessage.textContent = "";
            await loadMessage(data.token);
        } catch (error) {
            formMessage.textContent = error.status === 401
                ? "Password non riconosciuta."
                : "Accesso non disponibile. Riprova.";
            passwordInput.select();
        } finally {
            submitButton.disabled = false;
        }
    });

    logoutButton.addEventListener("click", async () => {
        const sessionToken = sessionGet(SESSION_KEY);
        sessionRemove(SESSION_KEY);

        if (sessionToken) {
            await window.NNMRCN_API.request("/api/mayor/logout", {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${sessionToken}`
                }
            }).catch(() => {});
        }

        if (sessionGet(ACCESS_KEY)) {
            showOnly(passwordSection);
            passwordInput.focus();
        } else {
            showOnly(denied);
        }
    });

    initialise();
})();
