# anonMrcn

Sito GitHub Pages del progetto anonMrcn.

## Frontend

- `index.html` — poesia
- `autore.html` — autore
- `progetto.html` — progetto, confronto 1975–oggi, percorso narrativo, mappa e accesso
- `spazio-pubblico.html` — luoghi e testi condivisi pubblicamente
- `voci.html` — indice pubblico ed editor amministrativo delle voci, con fotografie, fonti numerate, tabelle e collegamenti automatici
- `spazio-personale.html` — profilo, visibilità, destinatari, messaggi e notifiche della location
- `archivio.html` — archivio anonimo dei messaggi pubblicati con doppio consenso
- `memorie.html` — mappa dei ricordi degli abitanti e invio di testo, fotografie o audio
- `taccuino.html` — raccolta personale locale con mappa ed esportazione GeoJSON/JSON
- `admin.html` — moderazione, riepilogo, ricerca ed esportazione dei messaggi
- `accesso.html` — ingresso riservato dal QR e spazio «Messaggio per il sindaco»
- `style.css` — stili comuni del sito
- `spazi.css` — spazi pubblico e personale
- `voci.css` e `voci.js` — visualizzazione, formattazione e modifica delle voci
- `messaggistica.css` — selezione dei destinatari e messaggi dello spazio personale
- `percorsi.css` — controlli della mappa, percorsi e schede dei luoghi
- `site.js` — comportamento comune del menu e pannello delle impostazioni
- `accesso-menu.js` — accesso e stato della sessione condivisi nel menu
- `tema.js` — tema, lettura e preferenze tecniche della mappa
- `poesia-metrica.js` — riferimenti condivisi alle righe della poesia
- `api.js` — richieste HTTP condivise verso il backend
- `accesso.js` e `accesso.css` — verifica del QR, accesso speciale e pagina riservata
- `mappa.js` — dati geografici condivisi ed estensioni della mappa
- `progetto.js` — mappa, paesaggi, percorso narrativo e accesso
- `spazio-personale.js` — profilo, rete, messaggistica e posta della location
- `archivio.js` — caricamento, ricerca e paginazione dell’archivio pubblico
- `memorie.js` — mappa pubblica, invio, consenso e ritiro delle memorie
- `taccuino.js` — salvataggio locale condiviso tra le pagine
- `taccuino-pagina.js` — visualizzazione ed esportazione del taccuino
- `analytics.js` — attivazione facoltativa di Cloudflare Web Analytics
- `goatcounter.js` — copia locale dello script di conteggio visite GoatCounter
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

Le pagine pubbliche caricano localmente `goatcounter.js` e inviano il conteggio
a `anonmrcn.goatcounter.com`. Lo script esclude localhost e le anteprime caricate
negli iframe del tour; la pagina amministrativa e la pagina di accesso con token
non lo includono. I parametri URL non vengono inviati al contatore.

La richiesta di accesso richiede il consenso alla `privacy.html`. Indirizzi e
coordinate vengono minimizzati prima della memorizzazione permanente; i moduli
di contatto e le richieste di token vengono cancellati automaticamente entro 30
giorni dal Worker.

Le locations private, le password e i secret non devono essere salvati nel repository pubblico.

## Evoluzione verso il CMS

La separazione vincolante tra contenuti amministrabili e software è descritta in
[`docs/cms/01-confine-contenuti-software.md`](docs/cms/01-confine-contenuti-software.md).
L'inventario corrispondente, usato come base per schema e migrazioni, è in
[`docs/cms/content-inventory.json`](docs/cms/content-inventory.json).
Lo stato verificabile degli otto passaggi e il primo sottopunto da riprendere
sono registrati in [`docs/cms/progress.md`](docs/cms/progress.md).

I testi editoriali di nove pagine sono importati una sola volta in D1 come
60 blocchi con identificativi stabili. Le pagine leggono la versione pubblicata
da `GET /api/public/pages/:slug` e mantengono nel proprio HTML la stessa copia,
così restano leggibili anche se il Worker non è raggiungibile.

Anche «Il Gajo tra i Praelli» usa D1 come sorgente pubblicata: 4 canti e
121 versi conservano ordine, strofe, rientri e i 165 riferimenti di rigo. La
copia completa in `index.html` rimane il ripiego e viene usata prima di avviare
numerazione e collegamenti interattivi se l'API non risponde.

Il menu comune usa sei record `navigation_items` per le quattro destinazioni
principali, il sostegno al progetto e l'accesso amministrativo. Dieci pagine
applicano etichette, ordine e URL pubblicati da D1, conservando localmente lo
stesso menu come ripiego.

Il benvenuto usa una voce pubblica in `site_settings` e cinque record ordinati
in `onboarding_steps`. Le dodici pagine che possono mostrarlo attendono il
contenuto pubblicato da `GET /api/public/onboarding/welcome`; se il Worker non
risponde mantengono testi, anteprime e indicatori incorporati in `sessione.js`.
La chiave `nnmrcn_session` e lo stato di completamento associato alla location
restano invariati.

I quattro cataloghi cartografici storici sono registrati in `map_layers`; i
metadati di percorsi, fiumi e cave ritirati sono conservati in `map_features`
con stato `archived`. I relativi GeoJSON erano già stati azzerati il 6 ottobre
2026 e restano vuoti, così la migrazione non ripubblica geometrie rimosse. Il
motore può leggere `GET /api/public/map-layers/:slug` e usa gli stessi file
GeoJSON locali se il Worker non è disponibile. Le voci attive continuano a
usare i propri ID esistenti in `map_entries`.

Le fonti sono inoltre indicizzate una sola volta in `sources` e collegate ai
contenuti tramite `content_source_links`. I 17 URL del percorso poetico hanno
ID stabili; il primo avvio raccoglie e deduplica anche i token `[fonte:…]`
delle Voci, le fonti dei luoghi e i collegamenti dei livelli cartografici. I
token, le etichette e i campi preesistenti restano al loro posto come copia di
compatibilità. `GET /api/public/sources` restituisce le fonti soltanto per un
contenuto pubblico identificato da `contentType` e `contentId`.

Identità, titoli e descrizioni delle quattordici pagine e i campi editoriali
dei due manifesti sono pubblicati in `site_settings`. Le pagine applicano
`GET /api/public/settings/site` e mantengono i propri metadati HTML come
ripiego. URL del Worker, token analytics, colori, icone, scope, pagine di avvio
e altre opzioni operative restano intenzionalmente in `config.js`, HTML e
manifesti perché sono configurazione software.

Al termine dell'importazione il Worker crea in `content_revisions` la revisione
1 di ogni oggetto editoriale, inclusi blocchi, canti, versi e geometrie. Le
fotografie includono anche le strutture annidate necessarie a ricostruire pagine,
opera poetica e livelli; sono append-only e non cambiano se il record corrente
viene modificato in seguito.

Il pannello amministrativo gestisce inoltre titolo, descrizione, stato D1 e
testi dei blocchi delle nove pagine. Ogni salvataggio rifiuta una copia ormai
superata e aggiunge revisioni append-only della pagina e dei soli blocchi
modificati; ID, ordine e parti interattive restano invariati.

L'inventario si controlla con:

```bash
node scripts/check-content-boundary.mjs
```
