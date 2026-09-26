(() => {
    "use strict";

    const ACCESS_KEY = "nnmrcn_qr_access";
    const ACCESS_MODE_KEY = "nnmrcn_qr_mode";
    const LEGACY_MAYOR_ACCESS_KEY = "nnmrcn_mayor_access";
    const MAYOR_SESSION_KEY = "nnmrcn_mayor_session";
    const locationSession = window.NNMRCN_SESSION;

    const verification = document.getElementById("accessoVerifica");
    const denied = document.getElementById("accessoNegato");
    const passwordSection = document.getElementById("accessoPassword");
    const form = document.getElementById("accessoForm");
    const passwordInput = document.getElementById("accessoPasswordInput");
    const formMessage = document.getElementById("accessoMessaggio");
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
        const queryToken = String(url.searchParams.get("chiave") || "").trim();

        if (queryToken) {
            const mode = url.searchParams.get("tipo") === "location"
                ? "location"
                : "mayor";

            sessionSet(ACCESS_KEY, queryToken);
            sessionSet(ACCESS_MODE_KEY, mode);
            sessionRemove(LEGACY_MAYOR_ACCESS_KEY);
            url.searchParams.delete("chiave");
            url.searchParams.delete("tipo");
            history.replaceState(
                null,
                "",
                `${url.pathname}${url.search}${url.hash}`
            );

            return { accessToken: queryToken, mode };
        }

        const storedToken = sessionGet(ACCESS_KEY);
        const storedMode = sessionGet(ACCESS_MODE_KEY);

        if (storedToken && ["location", "mayor"].includes(storedMode)) {
            return {
                accessToken: storedToken,
                mode: storedMode
            };
        }

        const legacyMayorToken = sessionGet(LEGACY_MAYOR_ACCESS_KEY);

        if (legacyMayorToken) {
            sessionSet(ACCESS_KEY, legacyMayorToken);
            sessionSet(ACCESS_MODE_KEY, "mayor");
            sessionRemove(LEGACY_MAYOR_ACCESS_KEY);
            return {
                accessToken: legacyMayorToken,
                mode: "mayor"
            };
        }

        return {
            accessToken: "",
            mode: ""
        };
    }

    function clearQrAccess() {
        sessionRemove(ACCESS_KEY);
        sessionRemove(ACCESS_MODE_KEY);
        sessionRemove(LEGACY_MAYOR_ACCESS_KEY);
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

    async function loadMayorMessage(sessionToken) {
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
                sessionRemove(MAYOR_SESSION_KEY);
                return false;
            }

            verification.textContent =
                "Impossibile caricare lo spazio riservato. Riprova.";
            showOnly(verification);
            return false;
        }
    }

    async function restoreLocationSession(sessionToken) {
        try {
            await window.NNMRCN_API.request("/api/session", {
                headers: {
                    Authorization: `Bearer ${sessionToken}`
                }
            });
            window.location.replace("./spazio-personale.html");
            return true;
        } catch (_) {
            locationSession.clear();
            return false;
        }
    }

    async function verifyAccess(accessToken, mode) {
        const path = mode === "location"
            ? "/api/location/access"
            : "/api/mayor/access";

        try {
            await window.NNMRCN_API.request(path, {
                method: "POST",
                body: JSON.stringify({ accessToken })
            });
            showOnly(passwordSection);
            passwordInput.focus();
            return true;
        } catch (_) {
            clearQrAccess();
            showOnly(denied);
            return false;
        }
    }

    async function initialise() {
        const { accessToken, mode } = readQrAccess();

        if (mode === "mayor") {
            const sessionToken = sessionGet(MAYOR_SESSION_KEY);

            if (sessionToken && await loadMayorMessage(sessionToken)) {
                return;
            }
        }

        if (mode === "location") {
            const sessionToken = locationSession.read();

            if (sessionToken && await restoreLocationSession(sessionToken)) {
                return;
            }
        }

        if (!accessToken || !mode) {
            showOnly(denied);
            return;
        }

        await verifyAccess(accessToken, mode);
    }

    form.addEventListener("submit", async (event) => {
        event.preventDefault();

        const accessToken = sessionGet(ACCESS_KEY);
        const mode = sessionGet(ACCESS_MODE_KEY);
        const password = passwordInput.value;
        const submitButton = form.querySelector("button[type='submit']");

        submitButton.disabled = true;
        formMessage.textContent = "Verifica in corso…";

        try {
            if (mode === "location") {
                const data = await window.NNMRCN_API.request("/api/login", {
                    method: "POST",
                    body: JSON.stringify({ password })
                });

                locationSession.write(data.token);
                passwordInput.value = "";
                formMessage.textContent = "Accesso riconosciuto.";
                window.location.assign("./spazio-personale.html");
                return;
            }

            if (mode !== "mayor") {
                throw new Error("INVALID_ACCESS_MODE");
            }

            const data = await window.NNMRCN_API.request("/api/mayor/login", {
                method: "POST",
                body: JSON.stringify({ accessToken, password })
            });

            sessionSet(MAYOR_SESSION_KEY, data.token);
            passwordInput.value = "";
            formMessage.textContent = "";
            await loadMayorMessage(data.token);
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
        const sessionToken = sessionGet(MAYOR_SESSION_KEY);
        sessionRemove(MAYOR_SESSION_KEY);

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
