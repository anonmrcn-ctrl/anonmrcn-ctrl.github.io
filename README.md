# nnMrcn

Sito GitHub Pages del progetto nnMrcn.

## Frontend

- `index.html` — poesia
- `autore.html` — autore
- `progetto.html` — progetto, confronto 1975–oggi, percorso narrativo, mappa e accesso
- `spazio-pubblico.html` — luoghi e testi condivisi pubblicamente
- `voci.html` — spazio predisposto per le voci dedicate al territorio
- `spazio-personale.html` — profilo, visibilità, destinatari, messaggi e notifiche della location
- `archivio.html` — archivio anonimo dei messaggi pubblicati con doppio consenso
- `memorie.html` — mappa dei ricordi degli abitanti e invio di testo, fotografie o audio
- `taccuino.html` — raccolta personale locale con mappa ed esportazione GeoJSON/JSON
- `admin.html` — moderazione, riepilogo, ricerca ed esportazione dei messaggi
- `style.css` — stili comuni del sito
- `spazi.css` — spazi pubblico e personale
- `messaggistica.css` — selezione dei destinatari e messaggi dello spazio personale
- `percorsi.css` — controlli della mappa, percorsi e schede dei luoghi
- `site.js` — comportamento comune del menu e pannello delle impostazioni
- `accesso-menu.js` — accesso e stato della sessione condivisi nel menu
- `tema.js` — tema, lettura e preferenze tecniche della mappa
- `poesia-metrica.js` — riferimenti condivisi alle righe della poesia
- `api.js` — richieste HTTP condivise verso il backend
- `mappa.js` — dati geografici condivisi ed estensioni della mappa
- `progetto.js` — mappa, paesaggi, percorso narrativo e accesso
- `spazio-personale.js` — profilo, rete, messaggistica e posta della location
- `archivio.js` — caricamento, ricerca e paginazione dell’archivio pubblico
- `memorie.js` — mappa pubblica, invio, consenso e ritiro delle memorie
- `taccuino.js` — salvataggio locale condiviso tra le pagine
- `taccuino-pagina.js` — visualizzazione ed esportazione del taccuino
- `analytics.js` — attivazione facoltativa di Cloudflare Web Analytics
- `percorsi.js` — percorsi, luoghi rilevanti e livelli paesaggistici
- `marcon-da-sud.js` — percorso aggiuntivo Marcon da sud
- `cave-rilevanti.js` — cave integrate tra i luoghi rilevanti
- `fiumi-wikipedia.js` — informazioni e collegamenti sui corsi d’acqua
- `admin.js` — interfaccia amministratore
- `config.js` — URL del backend
- `memorie.css` e `taccuino.css` — stili delle nuove sezioni
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

Cloudflare Web Analytics viene caricato soltanto quando
`NNMRCN_ANALYTICS_TOKEN` contiene il token pubblico assegnato al sito. Il valore
si imposta in `config.js`; con il campo vuoto non viene eseguita alcuna richiesta
di analisi.

Le locations private, le password e i secret non devono essere salvati nel repository pubblico.
