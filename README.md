# nnMrcn

Sito GitHub Pages del progetto nnMrcn.

## Frontend

- `index.html` — poesia
- `autore.html` — autore
- `progetto.html` — progetto, mappa, percorsi, accesso e messaggi
- `admin.html` — area di moderazione non linkata pubblicamente
- `style.css` — stili comuni del sito
- `messaggistica.css` — selezione dei destinatari e messaggi sulla mappa
- `percorsi.css` — controlli della mappa, percorsi e schede dei luoghi
- `site.js` — comportamento comune del menu
- `api.js` — richieste HTTP condivise verso il backend
- `mappa.js` — dati geografici condivisi ed estensioni della mappa
- `progetto.js` — mappa, paesaggi, login e messaggistica
- `percorsi.js` — percorsi, luoghi rilevanti e livelli paesaggistici
- `marcon-da-sud.js` — percorso aggiuntivo Marcon da sud
- `cave-rilevanti.js` — cave integrate tra i luoghi rilevanti
- `fiumi-wikipedia.js` — informazioni e collegamenti sui corsi d’acqua
- `admin.js` — interfaccia amministratore
- `config.js` — URL del backend
- `pmtiles-overzoom.js` — visualizzazione delle mappe storiche oltre lo zoom nativo
- `logo.webp` — logo ottimizzato senza perdita di qualità
- `logo.PNG` — versione originale del logo
- `luoghi-significativi.geojson` — geometrie pubbliche della mappa
- `luoghi-rilevanti.geojson` — luoghi lungo i percorsi cicloturistici
- `percorsi.geojson` — proposta di percorso ciclo-turistico
- `marcon-da-sud.geojson` — geometria del percorso Marcon da sud
- `mappe/marcon_1975.pmtiles` — ortofoto storica usata nella mappa interattiva
- `marcon_1975_web.webp` — copia dell’ortofoto storica

## Backend

Il backend Cloudflare Worker è nella cartella `worker/`.
Le istruzioni di configurazione sono in `worker/README.md`.

Le locations private, le password e i secret non devono essere salvati nel repository pubblico.
