# Registro di avanzamento del CMS

Aggiornato il 9 ottobre 2026. Questo registro stabilisce l’ordine di lavoro: si
procede dalla prima riga incompleta e una riga diventa completa soltanto quando
schema, compatibilità, test e documentazione sono presenti nel repository.

## Passaggi principali

| N. | Passaggio | Stato | Prova nel repository |
|---:|---|---|---|
| 1 | Confine contenuti/software | Completo | `01-confine-contenuti-software.md`, `content-inventory.json`, `scripts/check-content-boundary.mjs` |
| 2 | Centralizzazione in D1 | Completo | Tutte le unità 2.1–2.12 sono importate, esposte e coperte da test; il primo punto incompleto è il 3 |
| 3 | Ampliamento del pannello | In corso | Pagine, poesia, menu, benvenuto, cartografia, fonti e impostazioni editoriali sono gestibili; il primo sottopunto incompleto è 3.6 |
| 4 | Bozze, anteprima e cronologia | Da iniziare | La tabella append-only `content_revisions` è predisposta, ma flussi e interfaccia non sono ancora realizzati |
| 5 | Permanenza di QR e collegamenti | Da iniziare | La tabella `permalinks` è predisposta; migrazione e risoluzione degli URL storici non sono ancora realizzate |
| 6 | Media e documenti in R2 | Da iniziare | Nessun dato è stato ancora trasferito |
| 7 | Sostituzione del token amministrativo | Da iniziare | L’accesso continua a usare `ADMIN_TOKEN` |
| 8 | Esportazione, manutenzione, manuale e diagnostica | Da iniziare | Gli strumenti esistenti non coprono ancora l’intero CMS |

## Punto 2 — ordine vincolante

| Ordine | Unità | Stato | Criterio e prova |
|---:|---|---|---|
| 2.1 | Fondazione D1 comune | Completo | `0013_cms_content_foundation.sql`, `cms-schema.js` e `cms-schema.test.mjs`; l’health check installa e verifica lo schema |
| 2.2 | Percorso «Esplora la poesia» | Completo | `0012_narrative_steps.sql`, API pubblica e amministrativa, ripiego locale, test di inizializzazione e conservazione delle tappe pubblicate |
| 2.3 | Pagine e blocchi | Completo | `page-seed.js` importa idempotentemente 9 pagine e 60 blocchi; `GET /api/public/pages/:slug`, `page-content.js` e `pages.test.mjs` provano sorgente D1, soli contenuti pubblicati, ID stabili e ripiego statico |
| 2.4 | Poesia, canti e versi | Completo | `poem-seed.js` importa 1 opera, 4 canti e 121 versi; `GET /api/public/poems/:slug`, `poem-content.js` e `poem.test.mjs` conservano 165 righe metriche, ancore, rientri, classi, collegamenti territoriali e ripiego HTML |
| 2.5 | Menu e collegamenti globali | Completo | `navigation-seed.js` importa 6 collegamenti; `GET /api/public/navigation`, `navigation-content.js` e `navigation.test.mjs` conservano etichette, ordine, destinazioni, visibilità, stato attivo, collegamento privato e ripiego su 10 pagine |
| 2.6 | Tour e benvenuto | Completo | `onboarding-seed.js` importa introduzione e 5 schermate; `GET /api/public/onboarding/welcome`, `onboarding-content.js` e `onboarding.test.mjs` provano ordine, testi, URL, indicatori, filtro di pubblicazione e ripiego statico su tutte le 12 pagine che usano la sessione, senza cambiare `nnmrcn_session` né il completamento già salvato |
| 2.7 | Livelli, percorsi e geometrie | Completo | `map-seed.js` importa 4 livelli con ID stabili e conserva 7 elementi dismessi come `archived`; `GET /api/public/map-layers/:slug`, `map-content.js` e `map-content.test.mjs` provano filtro di pubblicazione e ripiego GeoJSON. Le quattro raccolte azzerate il 6 ottobre 2026 restano intenzionalmente vuote: la migrazione non ripubblica geometrie ritirate e non modifica gli ID dei `map_entries` attivi |
| 2.8 | Fonti e bibliografia | Completo | `source-seed.js` registra le 17 fonti del percorso con ID stabili; l’inizializzazione deduplica per URL anche richiami delle Voci, fonti dei luoghi e collegamenti cartografici in `sources`/`content_source_links`. `GET /api/public/sources`, `sources.test.mjs` e le copie di compatibilità provano ordine, termini, etichette, autori, date, richiami ripetuti e filtro dei contenuti pubblicati senza modificare i campi originari |
| 2.9 | Impostazioni e metadati | Completo | `settings-seed.js` importa identità, titoli e descrizioni di 14 pagine e i campi editoriali dei 2 manifesti; `GET /api/public/settings/site`, `site-metadata.js` e `settings.test.mjs` provano pubblicazione, ripiego e corrispondenza integrale. URL del Worker, token analytics, colori, icone, scope, avvio e comportamento restano nel codice |
| 2.10 | Revisioni iniziali | Completo | `initializeContentRevisions` crea una revisione 1 per pagine, blocchi, opera, canti, versi, navigazione, tour, impostazioni, livelli, geometrie, fonti e tappe narrative. `revisions.test.mjs` prova copertura completa, figli annidati, stati pubblicato/archiviato, idempotenza e immutabilità dopo modifiche ai record correnti |
| 2.11 | Permalink esistenti | Completo | `permalink-seed.js` e `initializePermalinks` registrano pagine, ancore della poesia, collegamenti alle Voci, tappe narrative e i due URL pubblici di ogni luogo con ID stabili. `GET /api/public/permalinks/resolve` e `permalinks.test.mjs` provano risoluzione esatta di query e frammenti, idempotenza, immutabilità dei percorsi ed esclusione dei segreti dei QR di accesso |
| 2.12 | Informativa privacy | Completo | `legal-seed.js` importa integralmente la versione del 3 ottobre 2026 con checksum SHA-256; `GET /api/public/legal/privacy`, `privacy-content.js` e `legal.test.mjs` provano versione corrente pubblicata, checksum, ripiego HTML e blocco di aggiornamento o cancellazione |

## Verifiche ripetibili

Da eseguire dalla radice del repository:

```bash
node scripts/check-content-boundary.mjs
node --test worker/tests/*.test.mjs
```

La prima verifica controlla che tutte le aree inventariate esistano e abbiano
una destinazione. La seconda applica sia lo schema completo sia le migrazioni a
SQLite, verifica le relazioni, prova che revisioni, permalink e versioni legali
pubblicate non possano essere riscritti e controlla importazione, pubblicazione
e ripiego dei blocchi delle pagine, della poesia, della navigazione, del tour e
della cartografia.

I file statici rimangono disponibili come ripiego finché la relativa unità del
punto 2 non è completa. Non vanno eliminati durante una migrazione parziale.

## Punto 3 — ordine vincolante

| Ordine | Unità | Stato | Criterio e prova |
|---:|---|---|---|
| 3.1 | Pagine e blocchi | Completo | `GET /api/admin/cms/pages`, `PATCH /api/admin/cms/pages/:id` e il modulo «Pagine e blocchi» modificano testi, descrizione e pubblicazione. `admin-pages.test.mjs` prova autorizzazione, ID e ordine invariati, controllo di concorrenza, revisione append-only e ripiego pubblico |
| 3.2 | Poesia, canti e versi | Completo | `GET/PATCH /api/admin/cms/poem` e il modulo «Poesia, canti e versi» gestiscono titolo, sottotitolo, stato D1, testo e rientri. `admin-poem.test.mjs` prova 4 canti, 121 versi, ancore I–IV, 165 righe metriche, concorrenza e revisioni append-only senza esporre metadati strutturali alla scrittura |
| 3.3 | Menu e benvenuto | Completo | `GET/PATCH /api/admin/cms/navigation` e `/api/admin/cms/onboarding` alimentano due moduli protetti. I test di navigazione e onboarding provano etichette, URL, visibilità, stato, introduzione, cinque schermate, controllo di concorrenza e revisioni, preservando ID, ordine, indicatori e ripieghi |
| 3.4 | Livelli e geometrie | Completo | `GET/PATCH /api/admin/cms/map-layers`, `POST/PATCH /api/admin/cms/map-features` e due editor protetti gestiscono metadati, stile, stato e GeoJSON con concorrenza e revisioni append-only. `admin-map-layers.test.mjs` prova autorizzazione, validazione, nuovi ID stabili, filtro pubblico e assenza di cancellazione; i sette record storici restano `archived`, con geometria nulla, anche quando si modifica un livello o si pubblica una nuova feature |
| 3.5 | Fonti e impostazioni | Completo | `GET/POST/PATCH /api/admin/cms/sources`, `GET/PATCH /api/admin/cms/settings` e due editor protetti gestiscono schede bibliografiche e soli gruppi `site.*`. `admin-sources-settings.test.mjs` prova autorizzazione, nuovi ID stabili, associazioni immutate, HTTPS, concorrenza, revisioni append-only, struttura dei metadati e propagazione pubblica; URL del Worker e configurazione tecnica non sono esposti |
| 3.6 | Documenti legali e permalink | Da iniziare | Preparare nuove versioni legali e controllare gli URL permanenti senza riscrivere record protetti |
