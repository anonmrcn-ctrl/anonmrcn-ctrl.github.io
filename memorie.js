(() => {
    "use strict";

    const api = window.NNMRCN_API;
    const notebook = window.NNMRCN_TACCUINO;
    const settingsManager = window.NNMRCN_SETTINGS;
    const SUBMISSIONS_KEY = "nnmrcn_memorie_inviate_v1";
    const MAX_MEDIA_BYTES = 900000;

    const elements = {
        map: document.getElementById("memorieMap"),
        mapStatus: document.getElementById("memorieMapStatus"),
        list: document.getElementById("memorieLista"),
        form: document.getElementById("memoriaForm"),
        title: document.getElementById("memoriaTitolo"),
        author: document.getElementById("memoriaAutore"),
        text: document.getElementById("memoriaTesto"),
        counter: document.getElementById("memoriaContatore"),
        selectPoint: document.getElementById("memoriaSelezionaPunto"),
        currentPosition: document.getElementById("memoriaPosizioneAttuale"),
        removePoint: document.getElementById("memoriaRimuoviPunto"),
        pointStatus: document.getElementById("memoriaPuntoStatus"),
        lat: document.getElementById("memoriaLat"),
        lon: document.getElementById("memoriaLon"),
        media: document.getElementById("memoriaMedia"),
        consent: document.getElementById("memoriaConsenso"),
        website: document.getElementById("memoriaSito"),
        submit: document.getElementById("memoriaInvia"),
        formStatus: document.getElementById("memoriaFormStatus"),
        ownSection: document.getElementById("memorieProprie"),
        ownList: document.getElementById("memorieProprieLista")
    };

    if (!elements.map || !window.L) {
        return;
    }

    const lightMap = settingsManager?.isLightMapEnabled?.() || false;
    const reduceMotion = Boolean(
        settingsManager?.shouldReduceMotion?.() || lightMap
    );
    const map = L.map(elements.map, {
        scrollWheelZoom: true,
        fadeAnimation: !lightMap,
        markerZoomAnimation: !lightMap,
        zoomAnimation: !lightMap
    }).setView([45.5515, 12.3278], 13);
    const memoriesLayer = L.layerGroup().addTo(map);
    const markers = new Map();
    let selectionMode = false;
    let selectedMarker = null;

    L.tileLayer(
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
        {
            maxZoom: 19,
            keepBuffer: lightMap ? 1 : 2,
            updateWhenIdle: lightMap,
            attribution:
                "Tiles &copy; Esri — Sources: Esri, Maxar, Earthstar Geographics, and the GIS User Community"
        }
    ).addTo(map);

    elements.text.addEventListener("input", updateCounter);
    elements.selectPoint.addEventListener("click", () => {
        setSelectionMode(!selectionMode);

        if (selectionMode) {
            elements.map.scrollIntoView({
                behavior: settingsManager?.scrollBehavior?.() || "smooth",
                block: "center"
            });
        }
    });
    elements.currentPosition.addEventListener("click", useCurrentPosition);
    elements.removePoint.addEventListener("click", clearSelectedPoint);
    elements.form.addEventListener("submit", submitMemory);
    map.on("click", handleMapClick);

    updateCounter();
    loadPublicMemories();
    loadOwnSubmissions();

    async function loadPublicMemories() {
        if (!api?.baseUrl) {
            elements.mapStatus.textContent = "La mappa non è ancora collegata al server.";
            return;
        }

        elements.mapStatus.textContent = "Caricamento…";

        try {
            const data = await api.request("/api/public/memories");
            renderPublicMemories(data.memories || []);
        } catch (_) {
            elements.mapStatus.textContent =
                "Non è stato possibile caricare le memorie.";
        }
    }

    function renderPublicMemories(memories) {
        memoriesLayer.clearLayers();
        markers.clear();
        elements.list.replaceChildren();

        memories.forEach((memory) => {
            const marker = L.circleMarker([memory.lat, memory.lon], {
                radius: 8,
                color: "#171717",
                weight: 2,
                fillColor: "#f4f1e8",
                fillOpacity: 0.95
            }).addTo(memoriesLayer);

            marker.bindPopup(buildMemoryPopup(memory), {
                maxWidth: 310,
                minWidth: 220
            });
            markers.set(Number(memory.id), marker);
            elements.list.appendChild(buildMemoryCard(memory));
        });

        if (!memories.length) {
            elements.mapStatus.textContent =
                "Non ci sono ancora memorie pubblicate.";
            const empty = document.createElement("p");
            empty.textContent = "La prima memoria può essere inviata dal modulo qui sotto.";
            elements.list.appendChild(empty);
            return;
        }

        elements.mapStatus.textContent =
            `${memories.length} ${memories.length === 1 ? "memoria" : "memorie"}`;

        const requestedId = Number(
            new URLSearchParams(window.location.search).get("memory")
        );

        if (markers.has(requestedId)) {
            window.setTimeout(() => focusMemory(requestedId), 100);
        }
    }

    function buildMemoryPopup(memory) {
        const container = document.createElement("article");
        container.className = "memoria-popup";
        const title = document.createElement("h3");
        title.textContent = memory.title;
        const text = document.createElement("p");
        text.textContent = memory.text;
        const meta = document.createElement("p");
        meta.className = "memoria-popup-meta";
        meta.textContent = memoryMeta(memory);

        container.append(title, text);
        appendMemoryMedia(container, memory);
        container.append(meta);

        if (notebook) {
            container.appendChild(notebook.createButton(notebookItem(memory)));
        }

        return container;
    }

    function buildMemoryCard(memory) {
        const article = document.createElement("article");
        article.className = "memoria-card";
        article.id = `memoria-${memory.id}`;
        const title = document.createElement("h3");
        title.textContent = memory.title;
        const text = document.createElement("p");
        text.textContent = memory.text;
        const meta = document.createElement("p");
        meta.className = "memoria-card-meta";
        meta.textContent = memoryMeta(memory);
        const actions = document.createElement("div");
        actions.className = "memoria-card-azioni";
        const show = document.createElement("button");
        show.type = "button";
        show.textContent = "Mostra sulla mappa";
        show.addEventListener("click", () => focusMemory(memory.id));

        article.append(title, text);
        appendMemoryMedia(article, memory);
        article.append(meta);
        actions.appendChild(show);

        if (notebook) {
            actions.appendChild(notebook.createButton(notebookItem(memory)));
        }

        article.appendChild(actions);
        return article;
    }

    function appendMemoryMedia(container, memory) {
        if (!memory.mediaType || !memory.mediaUrl) {
            return;
        }

        const source = `${api.baseUrl}${memory.mediaUrl}`;

        if (memory.mediaType.startsWith("image/")) {
            const image = document.createElement("img");
            image.src = source;
            image.alt = `Fotografia associata a «${memory.title}»`;
            image.loading = "lazy";
            container.appendChild(image);
            return;
        }

        if (memory.mediaType.startsWith("audio/")) {
            const audio = document.createElement("audio");
            audio.controls = true;
            audio.preload = "metadata";
            audio.src = source;
            audio.setAttribute(
                "aria-label",
                `Registrazione associata a «${memory.title}»`
            );
            container.appendChild(audio);
        }
    }

    function memoryMeta(memory) {
        const author = memory.authorName || "Anonimo";
        const date = new Date(memory.publishedAt || memory.createdAt)
            .toLocaleDateString("it-IT", {
                day: "numeric",
                month: "long",
                year: "numeric"
            });
        return `${author} — ${date}`;
    }

    function notebookItem(memory) {
        return {
            id: `memoria:${memory.id}`,
            type: "memoria",
            title: memory.title,
            text: memory.text,
            lat: memory.lat,
            lon: memory.lon,
            url: `/memorie.html?memory=${memory.id}`
        };
    }

    function focusMemory(id) {
        const marker = markers.get(Number(id));

        if (!marker) {
            return;
        }

        map.setView(marker.getLatLng(), 16, {
            animate: !reduceMotion
        });
        marker.openPopup();
        elements.map.scrollIntoView({
            behavior: settingsManager?.scrollBehavior?.() || "smooth",
            block: "center"
        });
    }

    function handleMapClick(event) {
        if (!selectionMode) {
            return;
        }

        setSelectedPoint(event.latlng.lat, event.latlng.lng);
        setSelectionMode(false);
    }

    function setSelectionMode(enabled) {
        selectionMode = enabled;
        elements.selectPoint.setAttribute("aria-pressed", String(enabled));
        elements.selectPoint.textContent = enabled
            ? "Tocca ora il luogo sulla mappa"
            : "Seleziona sulla mappa";
        elements.map.classList.toggle("selezione-attiva", enabled);
        elements.pointStatus.textContent = enabled
            ? "Tocca il punto preciso sulla mappa."
            : selectedMarker
                ? elements.pointStatus.textContent
                : "Nessun punto selezionato.";
    }

    function setSelectedPoint(lat, lon) {
        const roundedLat = Number(lat).toFixed(6);
        const roundedLon = Number(lon).toFixed(6);

        elements.lat.value = roundedLat;
        elements.lon.value = roundedLon;
        elements.pointStatus.textContent =
            `Punto selezionato: ${roundedLat}, ${roundedLon}.`;
        elements.removePoint.hidden = false;

        if (selectedMarker) {
            selectedMarker.setLatLng([lat, lon]);
        } else {
            selectedMarker = L.circleMarker([lat, lon], {
                radius: 10,
                color: "#171717",
                weight: 3,
                fillColor: "#3668ce",
                fillOpacity: 0.9
            }).addTo(map);
        }

        map.setView([lat, lon], Math.max(map.getZoom(), 16));
    }

    function clearSelectedPoint() {
        elements.lat.value = "";
        elements.lon.value = "";
        elements.pointStatus.textContent = "Nessun punto selezionato.";
        elements.removePoint.hidden = true;
        setSelectionMode(false);

        if (selectedMarker) {
            map.removeLayer(selectedMarker);
            selectedMarker = null;
        }
    }

    function useCurrentPosition() {
        if (!navigator.geolocation) {
            elements.pointStatus.textContent =
                "La geolocalizzazione non è disponibile in questo browser.";
            return;
        }

        elements.currentPosition.disabled = true;
        elements.pointStatus.textContent = "Ricerca della posizione…";

        navigator.geolocation.getCurrentPosition(
            (position) => {
                setSelectedPoint(
                    position.coords.latitude,
                    position.coords.longitude
                );
                elements.currentPosition.disabled = false;
            },
            () => {
                elements.pointStatus.textContent =
                    "Non è stato possibile ottenere la posizione.";
                elements.currentPosition.disabled = false;
            },
            {
                enableHighAccuracy: true,
                timeout: 12000,
                maximumAge: 30000
            }
        );
    }

    function updateCounter() {
        elements.counter.textContent = `${elements.text.value.length} / 3000`;
    }

    async function submitMemory(event) {
        event.preventDefault();

        if (!api?.baseUrl) {
            elements.formStatus.textContent =
                "Il modulo non è ancora collegato al server.";
            return;
        }

        if (!elements.lat.value || !elements.lon.value) {
            elements.formStatus.textContent =
                "Seleziona il luogo della memoria sulla mappa.";
            elements.selectPoint.focus();
            return;
        }

        elements.submit.disabled = true;
        elements.formStatus.textContent = "Preparazione del contributo…";

        try {
            const media = await prepareMedia(elements.media.files[0]);
            elements.formStatus.textContent = "Invio…";
            const data = await api.request("/api/memories", {
                method: "POST",
                body: JSON.stringify({
                    title: elements.title.value,
                    authorName: elements.author.value,
                    text: elements.text.value,
                    lat: Number(elements.lat.value),
                    lon: Number(elements.lon.value),
                    media,
                    consent: elements.consent.checked,
                    website: elements.website.value
                })
            });
            let withdrawalSaved = true;

            if (data.id && data.withdrawalToken) {
                withdrawalSaved = saveOwnSubmission({
                    id: data.id,
                    token: data.withdrawalToken,
                    title: elements.title.value.trim(),
                    status: data.status,
                    createdAt: Date.now()
                });
            }

            elements.form.reset();
            updateCounter();
            clearSelectedPoint();
            elements.formStatus.textContent = withdrawalSaved
                ? "Memoria inviata. Sarà pubblicata soltanto dopo il controllo dell’amministratore."
                : "Memoria inviata. Il browser non ha potuto conservare il codice di ritiro: " +
                    data.withdrawalToken;
            await loadOwnSubmissions();
        } catch (error) {
            elements.formStatus.textContent =
                error.message || "Non è stato possibile inviare la memoria.";
        } finally {
            elements.submit.disabled = false;
        }
    }

    async function prepareMedia(file) {
        if (!file) {
            return null;
        }

        let blob = file;
        let type = file.type === "audio/x-m4a" ? "audio/mp4" : file.type;

        if (type.startsWith("image/")) {
            blob = await resizeImage(file, 1600, 0.8);

            if (blob.size > MAX_MEDIA_BYTES) {
                blob = await resizeImage(file, 1200, 0.66);
            }

            type = blob.type;
        }

        const supported = [
            "image/jpeg",
            "image/png",
            "image/webp",
            "audio/mpeg",
            "audio/ogg",
            "audio/webm",
            "audio/mp4"
        ];

        if (!supported.includes(type)) {
            throw new Error("Formato dell’allegato non supportato.");
        }

        if (!blob.size || blob.size > MAX_MEDIA_BYTES) {
            throw new Error("L’allegato supera il limite di 900 KB.");
        }

        return {
            name: file.name || "allegato",
            type,
            data: await blobToBase64(blob)
        };
    }

    async function resizeImage(file, maxDimension, quality) {
        const image = await loadImage(file);
        const scale = Math.min(
            1,
            maxDimension / Math.max(image.width, image.height)
        );
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(image.width * scale));
        canvas.height = Math.max(1, Math.round(image.height * scale));
        const context = canvas.getContext("2d", { alpha: true });
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        const webpSupported = canvas
            .toDataURL("image/webp", 0.1)
            .startsWith("data:image/webp");
        const outputType = webpSupported ? "image/webp" : "image/jpeg";
        const blob = await new Promise((resolve) => {
            canvas.toBlob(resolve, outputType, quality);
        });

        if (!blob) {
            throw new Error("Non è stato possibile preparare la fotografia.");
        }

        return blob;
    }

    function loadImage(file) {
        return new Promise((resolve, reject) => {
            const source = URL.createObjectURL(file);
            const image = new Image();

            image.onload = () => {
                URL.revokeObjectURL(source);
                resolve(image);
            };
            image.onerror = () => {
                URL.revokeObjectURL(source);
                reject(new Error("La fotografia selezionata non è leggibile."));
            };
            image.src = source;
        });
    }

    function blobToBase64(blob) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
                const value = String(reader.result || "");
                resolve(value.slice(value.indexOf(",") + 1));
            };
            reader.onerror = () => reject(
                new Error("Non è stato possibile leggere l’allegato.")
            );
            reader.readAsDataURL(blob);
        });
    }

    function readOwnSubmissions() {
        try {
            const value = JSON.parse(localStorage.getItem(SUBMISSIONS_KEY) || "[]");
            return Array.isArray(value) ? value : [];
        } catch (_) {
            return [];
        }
    }

    function writeOwnSubmissions(submissions) {
        try {
            localStorage.setItem(SUBMISSIONS_KEY, JSON.stringify(submissions));
            return true;
        } catch (_) {
            return false;
        }
    }

    function saveOwnSubmission(submission) {
        const submissions = readOwnSubmissions()
            .filter((item) => Number(item.id) !== Number(submission.id));
        submissions.unshift(submission);
        return writeOwnSubmissions(submissions.slice(0, 50));
    }

    async function loadOwnSubmissions() {
        const submissions = readOwnSubmissions();
        elements.ownSection.hidden = !submissions.length;
        elements.ownList.replaceChildren();
        elements.ownList.className = "memorie-proprie-lista";

        if (!submissions.length || !api?.baseUrl) {
            return;
        }

        const statuses = await Promise.all(submissions.map(async (submission) => {
            try {
                const data = await api.request(
                    `/api/memories/${submission.id}/status`,
                    {
                        headers: {
                            "X-Memory-Token": submission.token
                        }
                    }
                );
                return { ...submission, ...data, available: true };
            } catch (error) {
                return {
                    ...submission,
                    available: false,
                    temporaryError: ![401, 404].includes(error.status)
                };
            }
        }));

        statuses.forEach((submission) => {
            elements.ownList.appendChild(buildOwnSubmissionCard(submission));
        });
    }

    function buildOwnSubmissionCard(submission) {
        const article = document.createElement("article");
        article.className = "memoria-propria-card";
        const title = document.createElement("h3");
        title.textContent = submission.title || `Memoria ${submission.id}`;
        const status = document.createElement("p");
        status.className = "memoria-propria-meta";
        status.textContent = submission.available
            ? `Stato: ${memoryStatusLabel(submission.status)}`
            : submission.temporaryError
                ? "Stato momentaneamente non verificabile."
                : "La memoria non è più disponibile sul server.";
        const actions = document.createElement("div");
        actions.className = "memoria-propria-azioni";
        const withdraw = document.createElement("button");
        withdraw.type = "button";
        withdraw.textContent = submission.available
            ? "Ritira e cancella"
            : submission.temporaryError
                ? "Riprova"
                : "Rimuovi da questo dispositivo";
        withdraw.addEventListener("click", () => {
            if (submission.temporaryError) {
                loadOwnSubmissions();
                return;
            }

            withdrawOwnSubmission(submission);
        });

        article.append(title, status);
        actions.appendChild(withdraw);

        if (submission.status === "approved") {
            const open = document.createElement("a");
            open.href = `./memorie.html?memory=${submission.id}`;
            open.textContent = "Apri la memoria pubblicata";
            actions.appendChild(open);
        }

        article.appendChild(actions);
        return article;
    }

    function memoryStatusLabel(status) {
        return {
            pending: "in attesa di controllo",
            approved: "pubblicata",
            rejected: "non approvata"
        }[status] || status;
    }

    async function withdrawOwnSubmission(submission) {
        const confirmed = window.confirm(
            submission.available
                ? "Vuoi ritirare e cancellare definitivamente questa memoria?"
                : "Vuoi eliminare il riferimento conservato su questo dispositivo?"
        );

        if (!confirmed) {
            return;
        }

        try {
            if (submission.available) {
                await api.request(`/api/memories/${submission.id}`, {
                    method: "DELETE",
                    headers: {
                        "X-Memory-Token": submission.token
                    }
                });
            }

            const remaining = readOwnSubmissions().filter(
                (item) => Number(item.id) !== Number(submission.id)
            );
            writeOwnSubmissions(remaining);
            await loadOwnSubmissions();
            await loadPublicMemories();
        } catch (error) {
            elements.formStatus.textContent =
                error.message || "Non è stato possibile ritirare la memoria.";
        }
    }
})();
