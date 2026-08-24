# nnMrcn

Sito GitHub Pages del progetto nnMrcn.

## Frontend

- `index.html` — poesia
- `autore.html` — autore
- `progetto.html` — progetto, mappa, accesso e messaggi
- `admin.html` — area di moderazione non linkata pubblicamente
- `style.css` — tutti gli stili del sito
- `site.js` — comportamento comune del menu
- `api.js` — richieste HTTP condivise verso il backend
- `progetto.js` — mappa, paesaggi, login e messaggistica
- `admin.js` — interfaccia amministratore
- `config.js` — URL del backend
- `pmtiles-overzoom.js` — visualizzazione delle mappe storiche oltre lo zoom nativo
- `logo.webp` — logo ottimizzato senza perdita di qualità
- `logo.PNG` — versione originale del logo
- `luoghi-significativi.geojson` — geometrie pubbliche della mappa
- `mappe/marcon_1975.pmtiles` — ortofoto storica usata nella mappa interattiva
- `marcon_1975_web.webp` — copia dell’ortofoto storica

## Backend

Il backend Cloudflare Worker è nella cartella `worker/`.
Le istruzioni di configurazione sono in `worker/README.md`.

Le locations private, le password e i secret non devono essere salvati nel repository pubblico.
