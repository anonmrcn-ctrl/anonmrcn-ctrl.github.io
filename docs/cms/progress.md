# Roadmap complessiva CMS e SEO

Aggiornata il 9 ottobre 2026. Questa è la roadmap unica di anonMrcn: integra
amministrazione dei contenuti, permanenza degli URL, indicizzazione, prestazioni,
crescita editoriale, usabilità amministrativa e privacy. Si procede dalla prima
riga incompleta e una riga diventa completa soltanto quando schema,
compatibilità, test e documentazione sono presenti nel repository. Le
misurazioni e le correzioni trasversali che non modificano dati possono
affiancare il primo passaggio tecnico incompleto, ma non sostituirlo.

## Passaggi principali

| N. | Passaggio | Stato | Prova nel repository |
|---:|---|---|---|
| 1 | Confine contenuti/software | Completo | `01-confine-contenuti-software.md`, `content-inventory.json`, `scripts/check-content-boundary.mjs` |
| 2 | Centralizzazione in D1 | Completo | Tutte le unità 2.1–2.12 sono importate, esposte e coperte da test; il primo punto incompleto è il 3 |
| 3 | Pannello editoriale e controllo SEO | Completo | Le unità 3.1–3.7 sono amministrabili con validazione, anteprima, controllo di concorrenza e revisioni; il primo punto strutturale incompleto è il 5 |
| 4 | Bozze, anteprima, cronologia e indicizzazione | Completo | Stati editoriali, anteprima protetta con `noindex`, confronto, ripristino append-only ed esclusione delle bozze dalle API pubbliche sono coperti da codice e test |
| 5 | Permalink, QR e pagine indicizzabili | Completo | `generate-public-pages.mjs` pubblica 5 Voci e 2 luoghi D1 come HTML autonomo; manifest, sitemap, alias D1, test e sincronizzazione periodica conservano ID, URL storici e QR |
| 6 | Media e documenti in R2, immagini SEO | In corso — blocco esterno | L'unità 6.1 è completa e testata nel repository, ma Cloudflare rifiuta la creazione del bucket finché R2 non viene abilitato nell'account (`10042`, run `37996881926`); restano pubblicazione, varianti, immagini sociali e documenti (`06-media-r2.md`) |
| 7 | Sostituzione del token amministrativo | Da iniziare | L’accesso continua a usare `ADMIN_TOKEN` |
| 8 | Esportazione, manutenzione e diagnostica CMS/SEO | Da iniziare | Gli strumenti esistenti non coprono l’intero CMS né indicizzazione, link, sitemap e pubblicazione statica |
| 9 | Prestazioni e Core Web Vitals | Da iniziare | Non esiste ancora una baseline distinta per homepage, mappa, Voci, luoghi e Memorie |
| 10 | Programma editoriale e monitoraggio organico | Da iniziare | Cluster territoriali e fonti sono definiti, ma non esiste ancora un ciclo editoriale misurato |
| 11 | Amministrazione più user friendly | Da iniziare | Il pannello copre le funzioni CMS, ma richiede una revisione completa di linguaggio, navigazione, gerarchia, feedback, errori, responsive e accessibilità |
| 12 | Rafforzamento della privacy | Da iniziare | Esistono informativa, filtri e strumenti rispettosi della privacy; manca un audit complessivo con minimizzazione, retention, consenso, sicurezza dei metadati e diagnostica verificabile |

## Traguardi SEO trasversali

| Codice | Traguardo | Stato | Dipendenza e criterio |
|---:|---|---|---|
| SEO-0 | Fondazione tecnica | Completo | `robots.txt`, sitemap, canonical, metadati sociali, JSON-LD, `noindex`, `seo.config.json` e `check-seo.mjs` sono pubblicati; `docs/seo/deployment-verification.md` registra workflow riusciti, health del Worker e risposte HTTP 200 |
| SEO-1 | Baseline di indicizzazione | In attesa di accesso | `docs/seo/search-console-baseline.md` definisce proprietà, invio sitemap e misure aggregate senza tracciamento; verifica della proprietà e dati reali richiedono accesso a Google Search Console |
| SEO-2 | Autonomia dei metadati | Completo | Il punto 3.7 gestisce title, descrizione e immagine sociale con valori predefiniti, unicità, anteprima autenticata, stati e revisioni |
| SEO-3 | Contenuti autonomi e indicizzabili | Completo | Punto 5: `public-content-manifest.json` censisce ogni pagina pubblicata, i percorsi `/voci/<slug>.html` e `/luoghi/<id>.html` hanno HTML, canonical e JSON-LD; alias storici e aggiornamento automatico sono provati |
| SEO-4 | Media ottimizzati | In corso — blocco esterno | Punto 6: originali e testo alternativo sono catalogati nel codice; la verifica pubblica attende l'abilitazione R2, poi restano dimensioni, varianti responsive e immagine sociale |
| SEO-5 | Esperienza e prestazioni | Da iniziare | Punto 9: LCP ≤ 2,5 s, INP ≤ 200 ms e CLS ≤ 0,1 al 75º percentile per i modelli principali |
| SEO-6 | Crescita editoriale verificabile | Da iniziare | Punto 10: pubblicazione basata sulle fonti e valutazione trimestrale rispetto alla baseline, senza obiettivi di traffico arbitrari |

## Sequenza vincolante complessiva

1. Pubblicare e verificare SEO-0; avviare SEO-1 appena la sitemap è online.
2. Completare il punto 3.7, senza riaprire le unità CMS 3.1–3.6.
3. Conservare le garanzie del punto 4 prima di esporre nuovi URL pubblici.
4. Completare il punto 5 prima di sostituire gli attuali `voci.html#slug` e
   `luogo.html?luogo=ID`; i vecchi QR devono continuare a risolversi.
5. Eseguire migrazione e ottimizzazione dei media nel punto 6; soltanto dopo
   fissare la baseline prestazionale definitiva del punto 9.
6. Completare autenticazione e diagnostica nei punti 7–8.
7. Avviare il programma editoriale continuativo del punto 10 quando pagine,
   fonti, URL e media sono amministrabili senza commit manuali.
8. Applicare durante ogni unità i criteri di usabilità e privacy; completare il
   punto 11 con una revisione end-to-end del pannello ormai funzionalmente stabile.
9. Chiudere il punto 12 con un audit finale documentato dopo autenticazione,
   esportazione, retention e diagnostica, senza rimandare correzioni urgenti.

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
node scripts/check-seo.mjs
node --test worker/tests/*.test.mjs
```

La prima verifica controlla che tutte le aree inventariate esistano e abbiano
una destinazione. La seconda controlla title, descrizioni, canonical, direttive
robots, sitemap, JSON-LD, immagini e collegamenti interni. La terza applica sia
lo schema completo sia le migrazioni a SQLite, verifica le relazioni, prova che
revisioni, permalink e versioni legali pubblicate non possano essere riscritti
e controlla importazione, pubblicazione e ripiego dei contenuti.

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
| 3.6 | Documenti legali e permalink | Completo | `GET/POST/PATCH /api/admin/cms/legal`, la pubblicazione esplicita e `GET/POST/PATCH /api/admin/cms/permalinks` alimentano due moduli protetti. `admin-legal-permalinks.test.mjs` prova bozze, checksum e data di concorrenza, pubblicazione immutabile, vecchie versioni intatte, nuovi percorsi, reindirizzamenti solo verso URL registrati, esclusione dei segreti e impossibilità di cambiare o cancellare i percorsi |
| 3.7 | Metadati SEO e anteprima | Completo | Il modulo «Metadati SEO e anteprima sociale» modifica title, descrizione, immagine HTTPS e stato del gruppo `site.metadata.pages`. Il Worker preserva le personalizzazioni durante l’aggiunta dei valori predefiniti, rifiuta duplicati tra pagine indicizzabili e registra revisioni; `site-metadata.js` applica soltanto valori pubblicati senza toccare canonical, robots o JSON-LD. `settings.test.mjs`, `admin-sources-settings.test.mjs` e `check-seo.mjs` coprono migrazione, ripiego, `noindex`, anteprima e unicità |

## Punto 4 — ordine vincolante

| Ordine | Unità | Stato | Criterio e prova |
|---:|---|---|---|
| 4.1 | Stato bozza uniforme | Completo | Pagine, poesia, menu, tour, cartografia, fonti, impostazioni e documenti legali usano stati editoriali espliciti. `0014_source_publication_state.sql`, i selettori nel pannello e `admin-sources-settings.test.mjs` provano migrazione conservativa delle fonti, transizioni con concorrenza, revisioni con stato coerente ed esclusione di fonti e impostazioni in bozza dalle API pubbliche |
| 4.2 | Anteprima autenticata | Completo | `GET /api/admin/cms/preview` restituisce soltanto con autorizzazione l’ultima fotografia append-only di ogni entità. Il modulo «Anteprima autenticata» rende pagine e poesia, mostra gli altri snapshot e isola l’HTML legale in un iframe sandbox con CSP; i test provano che la bozza resta esclusa dall’API pubblica e non esiste una pagina di anteprima indicizzabile |
| 4.3 | Cronologia revisioni | Completo | `GET /api/admin/cms/revisions` espone la storia di una singola entità soltanto all’amministratore; il pannello confronta due snapshot e `POST /api/admin/cms/revisions/:tipo/:id/:numero/restore` instrada la fotografia scelta nei validatori degli editor, creando una nuova revisione senza riscrivere le precedenti. `admin-sources-settings.test.mjs` prova autorizzazione, ordine, stato, ripristino e immutabilità della storia |

## Punto 6 — ordine vincolante

| Ordine | Unità | Stato | Criterio e prova |
|---:|---|---|---|
| 6.1 | Originali e catalogo R2 | Codice completo; pubblicazione bloccata | `0015_media_assets_r2.sql`, binding `MEDIA`, migrazione verificata prima della rimozione del blob D1, ripiego compatibile, versioni `current`/`retained`, cancellazione delle Memorie e `media-r2.test.mjs`; il run `37996881926` prova il blocco Cloudflare `10042`, dettagli in `06-media-r2.md` |
| 6.2 | Varianti responsive e dimensioni | Da iniziare | Generazione deterministica, larghezza e altezza note, `srcset`/`sizes` sulle pagine pubbliche e ripiego all'originale |
| 6.3 | Immagini sociali | Da iniziare | Scelta amministrabile o predefinita, variante idonea e sincronizzazione dei metadati Open Graph/Twitter senza esporre bozze |
| 6.4 | Documenti e verifica finale | Da iniziare | Upload e download R2 protetti, metadati D1, sostituzione/rimozione, accessibilità, esportazione e prova sul Worker pubblicato |

## Punti 4–12 — criteri di completamento

| Punto | Criterio vincolante |
|---:|---|
| 4 | Ogni contenuto supportato ha bozza, anteprima autenticata con `noindex`, pubblicazione, archiviazione, cronologia e ripristino; una bozza non compare in sitemap né API pubbliche |
| 5 | Completo — Ogni Voce e luogo pubblicato restituisce title, `h1` e testo principale anche senza JavaScript; gli URL storici e i QR si risolvono verso l’ID stabile; canonical, collegamenti interni e sitemap usano l’URL preferito. Prove e procedura sono in `05-permalink-pagine-indicizzabili.md` |
| 6 | R2 conserva gli originali e produce varianti responsive; D1 conserva metadati, testo alternativo, didascalia e relazione; rimozione e sostituzione rispettano revisioni e contenuti pubblicati |
| 7 | Il pannello usa identità personale forte; anteprime e operazioni editoriali non sono raggiungibili tramite un token condiviso e le pagine amministrative restano `noindex` |
| 8 | Esportazione e ripristino coprono D1 e media; diagnostica controlla API, build statica, sitemap, URL canonici, link interni, immagini mancanti e stato dell’ultima pubblicazione; il manuale descrive il flusso senza codice |
| 9 | Le cinque tipologie principali sono misurate su mobile e desktop; superano le soglie Core Web Vitals oppure ogni scostamento ha causa, intervento e nuova misurazione documentati |
| 10 | Esiste un calendario basato sui cluster territoriali, ogni affermazione storica distingue fonte, testimonianza e interpretazione, nessuna Voce resta isolata e il rapporto trimestrale confronta indicizzazione e query con la baseline |
| 11 | Il pannello usa linguaggio comprensibile, percorsi brevi, gerarchia coerente, salvataggi e conflitti spiegati, feedback accessibili, anteprime utili e interazioni complete su tastiera, smartphone e desktop; i test coprono i flussi principali senza richiedere conoscenze tecniche |
| 12 | Raccolta e conservazione dei dati sono minimizzate e motivate; retention, consenso, cancellazione, esportazione, log, metadati, servizi esterni, cookie e credenziali sono verificati e documentati; nessun contenuto privato, bozza o segreto raggiunge pagine, sitemap, telemetria o cache pubbliche |
