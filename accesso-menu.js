(() => {
    "use strict";

    const apiClient = window.NNMRCN_API;
    const notifications = window.NNMRCN_NOTIFICHE;
    const SESSION_KEY = "nnmrcn_session";

    const elements = {
        loginForm: document.getElementById("loginForm"),
        loginPassword: document.getElementById("loginPassword"),
        loginButton: document.getElementById("loginButton"),
        loginMessage: document.getElementById("loginMessage"),
        loginLoggedOut: document.getElementById("loginLoggedOut"),
        loginLoggedIn: document.getElementById("loginLoggedIn"),
        loginLocation: document.getElementById("loginLocation"),
        logoutButton: document.getElementById("logoutButton"),
        postaButton: document.getElementById("postaButton"),
        locationPushButton: document.getElementById("locationPushButton"),
        locationPushStatus: document.getElementById("locationPushStatus"),
        locationVisibilityToggle: document.getElementById(
            "locationVisibilityToggle"
        ),
        locationVisibilityStatus: document.getElementById(
            "locationVisibilityStatus"
        )
    };

    if (
        !apiClient ||
        !notifications ||
        Object.values(elements).some((element) => !element)
    ) {
        return;
    }

    let sessionToken = sessionStorage.getItem(SESSION_KEY) || "";
    let sessionLocation = null;

    const pushNotifications = notifications.create({
        button: elements.locationPushButton,
        status: elements.locationPushStatus,
        request: api,
        identity: () => sessionLocation
            ? `location-${sessionLocation.id}`
            : ""
    });

    elements.loginForm.addEventListener("submit", handleLogin);
    elements.logoutButton.addEventListener("click", handleLogout);
    elements.locationVisibilityToggle.addEventListener(
        "click",
        toggleLocationVisibility
    );
    elements.postaButton.addEventListener("click", () => {
        window.location.assign("./progetto.html#postaSection");
    });

    restoreSession();

    async function api(path, options = {}) {
        const headers = new Headers(options.headers || {});

        if (sessionToken) {
            headers.set("Authorization", `Bearer ${sessionToken}`);
        }

        try {
            return await apiClient.request(path, {
                ...options,
                headers
            });
        } catch (error) {
            if (error.status === 401) {
                clearSession();
            }

            throw error;
        }
    }

    async function handleLogin(event) {
        event.preventDefault();

        if (!apiClient.baseUrl) {
            elements.loginMessage.textContent =
                "Il sistema di accesso non è ancora collegato al server.";
            return;
        }

        elements.loginButton.disabled = true;
        elements.loginMessage.textContent = "Verifica in corso…";

        try {
            const data = await api("/api/login", {
                method: "POST",
                body: JSON.stringify({
                    password: elements.loginPassword.value
                })
            });

            sessionToken = data.token;
            sessionStorage.setItem(SESSION_KEY, sessionToken);
            elements.loginPassword.value = "";
            setLoggedIn(data.location);
        } catch (error) {
            elements.loginMessage.textContent =
                error.status === 401
                    ? "Password non riconosciuta."
                    : "Non è stato possibile accedere. Riprova.";
        } finally {
            elements.loginButton.disabled = false;
        }
    }

    async function handleLogout() {
        try {
            if (sessionToken && apiClient.baseUrl) {
                await api("/api/logout", {
                    method: "POST"
                });
            }
        } catch (_) {
            // La sessione locale viene comunque rimossa.
        }

        clearSession();
    }

    async function toggleLocationVisibility() {
        if (!sessionLocation) {
            return;
        }

        const nextVisible = sessionLocation.visible === false;
        elements.locationVisibilityToggle.disabled = true;
        elements.locationVisibilityStatus.textContent = "Aggiornamento…";

        try {
            const data = await api("/api/location/preferences", {
                method: "PATCH",
                body: JSON.stringify({ visible: nextVisible })
            });

            sessionLocation = data.location;
            syncLocationVisibility();
            elements.locationVisibilityStatus.textContent = nextVisible
                ? "La location è di nuovo visibile sulla mappa."
                : "La location è nascosta dalla mappa.";
        } catch (error) {
            elements.locationVisibilityStatus.textContent =
                error.message || "Non è stato possibile aggiornare la visibilità.";
        } finally {
            elements.locationVisibilityToggle.disabled = false;
        }
    }

    async function restoreSession() {
        if (!sessionToken || !apiClient.baseUrl) {
            return;
        }

        try {
            const data = await api("/api/session");
            setLoggedIn(data.location);
        } catch (_) {
            clearSession();
        }
    }

    function setLoggedIn(location) {
        sessionLocation = location;
        elements.loginLocation.textContent = location.username || location.address;
        elements.loginLoggedOut.hidden = true;
        elements.loginLoggedIn.hidden = false;
        elements.loginMessage.textContent = "";
        elements.locationVisibilityStatus.textContent = "";
        syncLocationVisibility();

        pushNotifications.sync().catch((error) => {
            console.error("Impossibile controllare le notifiche.", error);
        });
    }

    function syncLocationVisibility() {
        const hidden = sessionLocation?.visible === false;
        elements.locationVisibilityToggle.textContent = hidden
            ? "Mostra la mia location sulla mappa"
            : "Nascondi la mia location sulla mappa";
        elements.locationVisibilityToggle.setAttribute(
            "aria-pressed",
            String(hidden)
        );
    }

    function clearSession() {
        sessionToken = "";
        sessionLocation = null;
        sessionStorage.removeItem(SESSION_KEY);
        elements.loginLoggedOut.hidden = false;
        elements.loginLoggedIn.hidden = true;
        elements.loginLocation.textContent = "";
        elements.locationVisibilityToggle.setAttribute("aria-pressed", "false");
        elements.locationVisibilityStatus.textContent = "";
        pushNotifications.reset();
    }
})();
