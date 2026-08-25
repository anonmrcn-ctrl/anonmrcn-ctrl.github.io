(() => {
    "use strict";

    const STORAGE_PREFIX = "nnmrcn_push_";
    const SERVICE_WORKER = "./notifiche-sw.js";

    function create({ button, status, request, identity }) {
        if (!button || !status || typeof request !== "function") {
            return { sync: async () => {}, reset: () => {} };
        }

        let enabled = false;
        let busy = false;

        function supported() {
            return Boolean(
                window.isSecureContext &&
                "serviceWorker" in navigator &&
                "PushManager" in window &&
                "Notification" in window
            );
        }

        function isAppleMobile() {
            return /iPad|iPhone|iPod/i.test(navigator.userAgent) ||
                (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
        }

        function isInstalled() {
            return window.matchMedia("(display-mode: standalone)").matches ||
                navigator.standalone === true;
        }

        function storageKey() {
            return `${STORAGE_PREFIX}${identity()}`;
        }

        function render() {
            if (isAppleMobile() && !isInstalled()) {
                button.disabled = true;
                button.textContent = "Aggiungi alla schermata Home";
                status.textContent =
                    "Su iPhone: Condividi → Aggiungi alla schermata Home, poi apri il sito dalla Home.";
                return;
            }

            if (!supported()) {
                button.disabled = true;
                button.textContent = "Notifiche non disponibili";
                status.textContent = "Questo browser non supporta le notifiche push.";
                return;
            }

            if (Notification.permission === "denied") {
                button.disabled = true;
                button.textContent = "Notifiche bloccate";
                status.textContent =
                    "Consenti le notifiche nelle impostazioni del browser o del telefono.";
                return;
            }

            button.disabled = busy;
            button.textContent = enabled
                ? "Disattiva notifiche"
                : "Attiva notifiche";
            button.setAttribute("aria-pressed", String(enabled));
        }

        async function sync() {
            enabled = false;

            if (!supported() || !identity()) {
                render();
                return;
            }

            try {
                const registration = await navigator.serviceWorker.getRegistration("./");
                const subscription = await registration?.pushManager.getSubscription();

                enabled = Boolean(
                    subscription &&
                    Notification.permission === "granted" &&
                    localStorage.getItem(storageKey()) === subscription.endpoint
                );

                if (enabled) {
                    status.textContent = "Notifiche attive su questo dispositivo.";
                }
            } catch (_) {
                enabled = false;
            }

            render();
        }

        function reset() {
            enabled = false;
            busy = false;
            status.textContent = "";
            render();
        }

        async function activate() {
            const permission = Notification.permission === "granted"
                ? "granted"
                : await Notification.requestPermission();

            if (permission !== "granted") {
                status.textContent = "Notifiche non autorizzate.";
                render();
                return;
            }

            const configuration = await request("/api/push/config");
            const registration = await navigator.serviceWorker.register(
                SERVICE_WORKER,
                { scope: "./" }
            );

            await navigator.serviceWorker.ready;

            let subscription = await registration.pushManager.getSubscription();
            const publicKey = decodeBase64Url(configuration.publicKey);

            if (
                subscription?.options?.applicationServerKey &&
                !sameBytes(
                    new Uint8Array(subscription.options.applicationServerKey),
                    publicKey
                )
            ) {
                await subscription.unsubscribe();
                subscription = null;
            }

            if (!subscription) {
                subscription = await registration.pushManager.subscribe({
                    userVisibleOnly: true,
                    applicationServerKey: publicKey
                });
            }

            await request("/api/push/subscribe", {
                method: "POST",
                body: JSON.stringify({ subscription: subscription.toJSON() })
            });

            localStorage.setItem(storageKey(), subscription.endpoint);
            enabled = true;
            status.textContent = "Notifiche attive su questo dispositivo.";
        }

        async function deactivate() {
            const registration = await navigator.serviceWorker.getRegistration("./");
            const subscription = await registration?.pushManager.getSubscription();

            if (subscription) {
                await request("/api/push/unsubscribe", {
                    method: "POST",
                    body: JSON.stringify({ endpoint: subscription.endpoint })
                });
            }

            localStorage.removeItem(storageKey());
            enabled = false;
            status.textContent = "Notifiche disattivate su questo dispositivo.";
        }

        button.addEventListener("click", async () => {
            if (
                busy ||
                !supported() ||
                !identity() ||
                (isAppleMobile() && !isInstalled())
            ) {
                return;
            }

            busy = true;
            render();

            try {
                if (enabled) {
                    await deactivate();
                } else {
                    await activate();
                }
            } catch (error) {
                status.textContent =
                    error?.message || "Impossibile configurare le notifiche.";
            } finally {
                busy = false;
                render();
            }
        });

        render();

        return { sync, reset };
    }

    function decodeBase64Url(value) {
        const normalized = String(value)
            .replaceAll("-", "+")
            .replaceAll("_", "/");
        const padded = normalized + "=".repeat((4 - normalized.length % 4) % 4);
        const binary = atob(padded);

        return Uint8Array.from(binary, (character) => character.charCodeAt(0));
    }

    function sameBytes(first, second) {
        return first.length === second.length &&
            first.every((value, index) => value === second[index]);
    }

    window.NNMRCN_NOTIFICHE = Object.freeze({ create });
})();
