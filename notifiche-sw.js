"use strict";

self.addEventListener("push", (event) => {
    let notification = {};

    if (event.data) {
        try {
            notification = event.data.json();
        } catch (_) {
            notification = { body: "Hai ricevuto un nuovo avviso." };
        }
    }

    event.waitUntil(
        self.registration.showNotification(
            notification.title || "nnMrcn",
            {
                body: notification.body || "Hai ricevuto un nuovo avviso.",
                icon: new URL("./logo.webp", self.registration.scope).href,
                tag: notification.tag || "nnmrcn-notifica",
                data: {
                    url: localNotificationUrl(notification.url)
                }
            }
        )
    );
});

self.addEventListener("notificationclick", (event) => {
    event.notification.close();

    const destination = localNotificationUrl(event.notification.data?.url);

    event.waitUntil((async () => {
        const clients = await self.clients.matchAll({
            type: "window",
            includeUncontrolled: true
        });

        for (const client of clients) {
            if (new URL(client.url).pathname !== new URL(destination).pathname) {
                continue;
            }

            return client.focus();
        }

        return self.clients.openWindow(destination);
    })());
});

function localNotificationUrl(value) {
    const fallback = new URL("./progetto.html", self.registration.scope);

    try {
        const url = new URL(value || fallback, self.registration.scope);
        return url.origin === self.location.origin
            ? url.href
            : fallback.href;
    } catch (_) {
        return fallback.href;
    }
}
