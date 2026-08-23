# nnMrcn

Sito GitHub Pages del progetto nnMrcn.

## Frontend

- `index.html` — poesia
- `autore.html` — autore
- `progetto.html` — progetto, mappa, accesso e messaggi
- `admin.html` — area di moderazione non linkata pubblicamente
- `style.css` — tutti gli stili del sito
- `site.js` — comportamento comune del menu
- `progetto.js` — mappa, paesaggi, login e messaggistica
- `admin.js` — interfaccia amministratore
- `config.js` — URL del backend
- `luoghi-significativi.geojson` — geometrie pubbliche della mappa
- `marcon_1975_web.webp` — ortofoto storica

## Backend

Il backend Cloudflare Worker è nella cartella `worker/`.
Le istruzioni di configurazione sono in `worker/README.md`.

Le locations private, le password e i secret non devono essere salvati nel repository pubblico.
