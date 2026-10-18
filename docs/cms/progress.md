# Roadmap complessiva CMS e SEO

Aggiornata il 18 ottobre 2026. Questa è la roadmap unica di anonMrcn: integra
amministrazione dei contenuti, permanenza degli URL, indicizzazione, prestazioni,
crescita editoriale, usabilità amministrativa e privacy. Si procede dalla prima
riga incompleta e una riga diventa completa soltanto quando schema,
compatibilità, test e documentazione sono presenti nel repository. Le
misurazioni e le correzioni trasversali che non modificano dati possono
affiancare il primo passaggio tecnico incompleto, ma non sostituirlo.

**Stato complessivo:** i punti 1–12 sono stati completati il 12 ottobre 2026.
Il 17 ottobre 2026 è stata aperta l'estensione 13 per l'autonomia visuale
no-code; le unità 13.1–13.11 sono complete e la prima unità da eseguire è la 13.12.
L'esportazione dei primi dati
Search Console dal 9 novembre e i rapporti trimestrali successivi appartengono
alla manutenzione ordinaria e non riaprono le unità concluse.

## Passaggi principali

| N. | Passaggio | Stato | Prova nel repository |
|---:|---|---|---|
| 1 | Confine contenuti/software | Completo | `01-confine-contenuti-software.md`, `content-inventory.json`, `scripts/check-content-boundary.mjs` |
| 2 | Centralizzazione in D1 | Completo | Tutte le unità 2.1–2.12 sono importate, esposte e coperte da test; il primo punto incompleto è il 3 |
| 3 | Pannello editoriale e controllo SEO | Completo | Le unità 3.1–3.7 sono amministrabili con validazione, anteprima, controllo di concorrenza e revisioni; il primo punto strutturale incompleto è il 5 |
| 4 | Bozze, anteprima, cronologia e indicizzazione | Completo | Stati editoriali, anteprima protetta con `noindex`, confronto, ripristino append-only ed esclusione delle bozze dalle API pubbliche sono coperti da codice e test |
| 5 | Permalink, QR e pagine indicizzabili | Completo | `generate-public-pages.mjs` pubblica 5 Voci e 2 luoghi D1 come HTML autonomo; manifest, sitemap, alias D1, test e sincronizzazione periodica conservano ID, URL storici e QR |
| 6 | Media e documenti in R2, immagini SEO | Completo | Le unità 6.1–6.4 coprono originali, varianti responsive e sociali, metadati accessibili e documenti privati. Test, deploy e verifiche live di Worker, R2, pannello e protezione degli endpoint sono registrati in `06-media-r2.md` |
| 7 | Sostituzione del token amministrativo | Completo | PR #16 e i run Worker `38068531893`, Pages `38068531244` e SEO `38068532070` pubblicano identità WebAuthn, sessioni di 8 ore e disattivazione automatica del token dopo la prima passkey. L'11 ottobre 2026 lo stato pubblico restituisce `configured: true`, una richiesta amministrativa con il solo header legacy restituisce `401` e l'amministratore conferma l'accesso con la passkey personale. La seconda passkey resta raccomandata ma non vincolante; l'unico recupero disponibile è quello infrastrutturale documentato |
| 8 | Esportazione, manutenzione e diagnostica CMS/SEO | Completo | Le unità 8.1–8.4 forniscono backup e ripristino verificabili di D1/R2, diagnostica CMS/SEO, manuale senza codice e cadenza di manutenzione. PR #18, 115 test, i run Worker `38091623182`, SEO `38091623204` e Pages `38091622784` e le risposte live sono registrati in `08-maintenance-diagnostics.md` |
| 9 | Prestazioni e Core Web Vitals | Completo | Baseline, interventi, dieci audit conformi su `main` e verifiche HTTP del sito e del Worker sono registrati in `docs/performance/baseline-2026-10-11.md`; il primo punto incompleto è il 10 |
| 10 | Programma editoriale e monitoraggio organico | Completo | Programma, collegamenti contestuali, proprietà Search Console, sitemap, finestra iniziale e validatore dei rapporti aggregati sono completi; PR #28 e i run SEO `38272655867`, Pages `38272655643` e prestazioni `38272655858` sono riusciti. Il primo export reale è manutenzione operativa programmata dal 9 novembre 2026 |
| 11 | Amministrazione più user friendly | Completo | Navigazione per attività, feedback comprensibili, protezione delle modifiche e audit Chrome a 375/1440 px sono documentati in `11-admin-usability.md`; i run SEO `38154750211` e prestazioni/UX `38154750212` sono riusciti |
| 12 | Rafforzamento della privacy | Completo | Inventario, retention, telemetria opt-in, librerie locali, informativa v2, esportazione e cancellazione self-service sono verificati localmente, in CI e sui servizi pubblicati; PR #26 e prove ripetibili sono registrate nell'unità 12.4 |
| 13 | Autonomia visuale no-code | In corso | Le unità 13.1–13.11 forniscono inventario, schema e renderer sicuri, componenti specializzati, canvas, ispettore responsive, gestione pagine, libreria, studio grafico, comportamenti dichiarativi e pubblicazione atomica. Bozza e snapshot pubblico sono separati; preflight SEO/accessibilità/privacy/link/media/prestazioni, anteprima autenticata `noindex`, confronto, undo/redo e recupero append-only impediscono che un errore modifichi il sito pubblico. Le prove sono nei documenti `13-1-*`–`13-11-*` e la prima unità eseguibile è 13.12 |

## Traguardi SEO trasversali

| Codice | Traguardo | Stato | Dipendenza e criterio |
|---:|---|---|---|
| SEO-0 | Fondazione tecnica | Completo | `robots.txt`, sitemap, canonical, metadati sociali, JSON-LD, `noindex`, `seo.config.json` e `check-seo.mjs` sono pubblicati; `docs/seo/deployment-verification.md` registra workflow riusciti, health del Worker e risposte HTTP 200 |
| SEO-1 | Baseline di indicizzazione | Completo | La proprietà URL-prefix è stata verificata l'11 ottobre 2026, la sitemap è stata inviata e `organic-monitoring.json` fissa una finestra reale di 28 giorni dal 12 ottobre all'8 novembre; l'export dal 9 novembre è esercizio operativo e non viene sostituito da valori simulati |
| SEO-2 | Autonomia dei metadati | Completo | Il punto 3.7 gestisce title, descrizione e immagine sociale con valori predefiniti, unicità, anteprima autenticata, stati e revisioni |
| SEO-3 | Contenuti autonomi e indicizzabili | Completo | Punto 5: `public-content-manifest.json` censisce ogni pagina pubblicata, i percorsi `/voci/<slug>.html` e `/luoghi/<id>.html` hanno HTML, canonical e JSON-LD; alias storici e aggiornamento automatico sono provati |
| SEO-4 | Media ottimizzati | Completo | Le unità 6.1–6.3 catalogano originali, testo alternativo e dimensioni, generano varianti responsive e sociali e pubblicano metadati Open Graph/Twitter coerenti; test e verifica live sono registrati in `06-media-r2.md` |
| SEO-5 | Esperienza e prestazioni | Completo nel perimetro misurabile | Le dieci combinazioni su `main` rispettano LCP ≤ 2,5 s, CLS ≤ 0,1 e TBT ≤ 200 ms nel run `38112468792`; l'INP al 75º percentile resta correttamente in attesa di un campione Search Console/CrUX sufficiente, senza aggiungere telemetria individuale |
| SEO-6 | Crescita editoriale verificabile | Completo | Programma e collegamenti contestuali sono pubblicati; configurazione, soglia di aggregazione, divieto di dati granulari, validatore e cadenza trimestrale sono verificati. Il primo rapporto sarà compilato dal 9 novembre con soli dati reali |

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
10. Avviare il punto 13 senza modificare gli esiti dei punti 1–12: inventariare
    prima l'interfaccia corrente, poi introdurre modello, renderer, canvas,
    gestione pagine e personalizzazione grafica nell'ordine definito in
    `13-no-code-visual-builder.md`.

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
node scripts/check-no-code-roadmap.mjs
node scripts/check-visual-inventory.mjs
node --test scripts/visual-inventory.test.mjs
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
| 6.1 | Originali e catalogo R2 | Completo | `0015_media_assets_r2.sql`, binding `MEDIA`, migrazione verificata prima della rimozione del blob D1, ripiego compatibile, versioni `current`/`retained`, cancellazione delle Memorie e `media-r2.test.mjs`; il nuovo tentativo del run `37996881926` ha creato il bucket UE e pubblicato il Worker, poi health e doppia lettura hanno provato migrazione D1→R2 senza cambiare URL o byte (`06-media-r2.md`) |
| 6.2 | Varianti responsive e dimensioni | Completo | Le nuove immagini producono varianti `small` e `medium`; il Worker verifica byte e dimensioni, cataloga ogni oggetto R2 e serve l'originale come ripiego. Il run `38044904768`, le intestazioni pubbliche 1600×599, il ripiego binario e la pagina HTML rigenerata provano API, `srcset`, `sizes`, `width` e `height`; 95 test coprono catalogo e selezione (`06-media-r2.md`) |
| 6.3 | Immagini sociali | Completo | La prima fotografia pubblicata è la scelta predefinita amministrabile tramite l’ordine della Voce; i nuovi upload creano la variante `social` 1200:630. I run `38045514506`, `38045514346`, `38045514514`, `38045948833` e `38045948910`, 99 test e la pagina live provano sincronizzazione di URL, alt, tipo e dimensioni tra Open Graph, Twitter e API, senza esporre bozze (`06-media-r2.md`) |
| 6.4 | Documenti e verifica finale | Completo | `0016_cms_documents_r2.sql` e il pannello gestiscono PDF, testo, Markdown, ODT e DOCX privati: R2 obbligatorio, metadati e checksum in D1, download autenticato `no-store`, sostituzione con versione precedente conservata, cancellazione completa, descrizione e verifica di accessibilità. I run `38066734695`, `38066734264` e `38066734691`, 105 test e le risposte live provano schema 3, binding R2, protezione e assenza di una rotta pubblica (`06-media-r2.md`) |

## Punto 7 — ordine vincolante

| Ordine | Unità | Stato | Criterio e prova |
|---:|---|---|---|
| 7.1 | Identità, passkey e sessioni | Completa e verificata sul servizio pubblicato | La migrazione `0017`, il modulo `admin-auth.js` e il pannello sostituiscono l’uso ordinario di `ADMIN_TOKEN` con WebAuthn e sessioni hash di otto ore. `admin-auth.test.mjs` usa firme P-256 reali e prova origine, verifica utente, contatore, replay, sessione, seconda passkey e rifiuto del token condiviso; PR #16, i tre run riusciti e le risposte live sono registrati in `07-admin-passkeys.md` |
| 7.2 | Attivazione e prova di produzione | Completa | L'11 ottobre 2026 `/api/admin/auth/status` ha restituito `200`, `configured: true`, `no-store` e `nosniff`; `/api/admin/summary` con il solo header legacy ha restituito `401`, mentre l'amministratore ha confermato l'accesso con la passkey personale. Non essendo disponibile un secondo autenticatore, una credenziale ulteriore resta raccomandata ma non blocca il punto: la perdita dell'unica passkey richiede il recupero infrastrutturale descritto in `07-admin-passkeys.md` |

Il punto 8 è ora eseguibile. La procedura completa del punto 7, incluse privacy,
retention e recupero senza modificare contenuti o media, è in
`07-admin-passkeys.md`.

## Punto 8 — ordine vincolante

| Ordine | Unità | Stato | Criterio e prova |
|---:|---|---|---|
| 8.1 | Backup dei contenuti CMS e dei media | Completa | `GET /api/admin/maintenance/export`, il pulsante «Scarica backup CMS» e `cms-maintenance.test.mjs` producono e verificano un archivio JSON versionato di D1 e R2. Oggetti mancanti o incoerenti bloccano il download; autenticazione, sessioni e dati personali operativi restano esclusi secondo `08-maintenance-diagnostics.md` |
| 8.2 | Verifica e ripristino | Completa | Il pannello valida formato, tabelle, SHA-256 e corrispondenza D1/R2, richiede una frase legata al checksum e una conferma ulteriore, copia i media sotto nuove chiavi e sostituisce D1 in transazione. `cms-maintenance.test.mjs` prova rifiuto, ripristino, conservazione degli oggetti precedenti e ricreazione dei trigger; `08-maintenance-diagnostics.md` separa il recupero CMS dal backup infrastrutturale cifrato |
| 8.3 | Diagnostica CMS/SEO | Completa | `GET /api/admin/maintenance/diagnostics`, il pulsante nel pannello e `runCmsDiagnostics` controllano relazioni D1, catalogo R2, health, allineamento D1/manifest, sitemap/robots, pagine, canonical, link, immagini e stato della pubblicazione senza esporre dati privati; test deterministici simulano l'intero sito pubblico |
| 8.4 | Manuale e manutenzione | Completa | `manuale-amministratore.md` è collegato dal pannello e descrive tutti i flussi ordinari senza codice, cadenze e gestione degli errori. PR #18 ha conservato cinque commit; Worker, SEO e Pages sono riusciti e le verifiche live provano controlli visibili, `noindex`, passkey attiva ed endpoint protetti con `401`, `no-store` e `nosniff` |

## Punto 9 — ordine vincolante

| Ordine | Unità | Stato | Criterio e prova |
|---:|---|---|---|
| 9.1 | Baseline e budget ripetibili | Completa | `performance-budget.json`, controllo statico e workflow producono cinque tipologie × due profili; prima misura, ambiente, soglie e dieci rapporti finali sono registrati in `docs/performance/baseline-2026-10-11.md` |
| 9.2 | Stabilità visiva e caricamento iniziale | Completa | Script differiti, connessioni selettive, CSS Leaflet locale, dimensioni delle immagini e ripiego HTML dell'indice Voci sono coperti da `performance-loading.test.mjs`; la matrice finale rispetta LCP e CLS in tutte le combinazioni |
| 9.3 | Reattività di mappa e contenuti interattivi | Completa | Memorie attiva la cartografia su richiesta e Voci carica l'editor soltanto quando serve. Il run `38111289096` rispetta TBT ≤ 200 ms in tutte le combinazioni; INP resta distinto e in attesa del campione sul campo |
| 9.4 | Verifica pubblicata e monitoraggio | Completa | Su `main` i run Performance `38112468792`, SEO `38112468591`, Pages `38112468441` e Worker `38112468711` sono riusciti. Le risposte pubbliche `200` provano i loader differiti, l'indice Voci statico, l'attivazione esplicita di Memorie e l'health D1/R2; misure e intestazioni sono in `docs/performance/baseline-2026-10-11.md` |

## Punto 10 — ordine vincolante

| Ordine | Unità | Stato | Criterio e prova |
|---:|---|---|---|
| 10.1 | Cluster, calendario e prove editoriali | Completa | `editorial-program.json` e `docs/seo/editorial-program.md` organizzano sei attività in tre cluster, distinguono fonte, testimonianza e interpretazione e applicano consenso e minimizzazione. `check-editorial-program.mjs` verifica copertura delle cinque Voci, calendario, URL e relazioni senza usare dati personali |
| 10.2 | Collegamenti contestuali pubblicati | Completa | `generate-public-pages.mjs` rende la rete definita dal programma come navigazione «Approfondisci nel territorio» nelle cinque Voci autonome. Il controllo editoriale legge l'HTML generato e impedisce Voci prive di relazioni o collegamenti non pubblicati, senza cambiare canonical, sitemap o permalink |
| 10.3 | Rapporto organico trimestrale | Completa | `organic-monitoring.json`, `docs/seo/organic-monitoring.md` e `check-organic-report.mjs` verificano proprietà e sitemap, finestra iniziale di 28 giorni, confronto corrente/baseline, soglia minima di aggregazione e rifiuto di query, URL e identificativi. La raccolta dal 12 ottobre all'8 novembre e l'export dal 9 novembre sono manutenzione operativa; nessun dato viene inventato per chiudere lo sviluppo. PR #28 supera 144 test e i controlli post-merge SEO `38272655867`, Pages `38272655643` e prestazioni `38272655858`; la configurazione pubblica espone `implementationStatus: complete` |

## Punto 11 — ordine vincolante

| Ordine | Unità | Stato | Criterio e prova |
|---:|---|---|---|
| 11.1 | Gerarchia e navigazione per attività | Completa | `admin.html` presenta dopo l'accesso un indice con otto attività espresse in linguaggio non tecnico e destinazioni stabili. `style.css` garantisce target tattili, stato focus e una colonna su smartphone; `admin-ux.test.mjs` verifica collegamenti, ID univoci, titoli associati, responsive e `noindex`. Il controllo completo dell'11 ottobre 2026 supera 130 test, tutti i controlli statici e la build Worker dry-run |
| 11.2 | Feedback, salvataggi ed errori | Completa | `admin.js` assegna stati accessibili a tutte le regioni live, rende comprensibili sessione scaduta, conflitto, limiti e indisponibilità, segnala i moduli modificati e avvisa prima di abbandonarli. Una nuova autenticazione conserva i campi non salvati invece di ricaricare automaticamente i dati; `admin-ux.test.mjs` verifica queste garanzie e la suite completa supera 132 test |
| 11.3 | Audit end-to-end accessibile e responsive | Completa | `admin-ui.e2e.mjs` prova con Chrome smartphone e desktop, assenza di overflow, etichette, target da 44 px, tastiera e ciclo di feedback senza dati di produzione. Il run `38154750212` è riuscito e conserva le schermate nell'artefatto `11708057414`; 133 test locali, controlli statici, build Worker dry-run e run SEO `38154750211` sono verdi. La verifica della stessa versione pubblicata resta registrata prima di avanzare al punto 12 |

## Punto 12 — ordine vincolante

| Ordine | Unità | Stato | Criterio e prova |
|---:|---|---|---|
| 12.1 | Inventario e audit iniziale | Completa | `privacy.config.json`, `12-privacy-hardening.md` e `check-privacy.mjs` censiscono otto classi di dati, cinque servizi esterni, retention, esposizione e quattro rilievi risolti senza includere valori reali o segreti. Il controllo prova anche `noindex`, assenza dalla sitemap, log senza query e retention dei contatti |
| 12.2 | Minimizzazione e retention | Completa | Il job periodico elimina sessioni location, sindaco e amministrative scadute; gli HMAC antiabuso delle Memorie vengono svuotati dopo 24 ore anche prima di un nuovo invio. `privacy-retention.test.mjs` distingue record scaduti e attivi senza alterare contributi, media o token di ritiro |
| 12.3 | Consenso, telemetria e servizi esterni | Completa | `privacy-telemetry.js` rende le statistiche opt-in e revocabili, limita GoatCounter al solo percorso e condivide il consenso con l'analytics Cloudflare facoltativo. Le aree protette non caricano telemetria; Leaflet e PMTiles sono serviti da `vendor/` con licenze e SHA-256 verificati |
| 12.4 | Esportazione, cancellazione e verifica finale | Completa | `GET /api/account/export`, `DELETE /api/account`, la migrazione `0018`, la sezione «I tuoi dati» e l’informativa privacy v2 implementano export `no-store`, cancellazione atomica e tombstone anonimo che preserva l’ID. `account-privacy.test.mjs` e 143 test provano assenza di dati di terzi, revoca delle sessioni, esclusione dalle API, schema 5 e versioni legali append-only. PR #26 è pubblicata: i run PR SEO `38180368046` e prestazioni/UX `38180368040` sono verdi e l'artefatto privacy `11717349270` conserva le schermate; su `main` sono riusciti Pages `38180583326`, Worker `38180583580`, SEO `38180583575` e prestazioni `38180583593`. Le verifiche live restituiscono pagina e controlli `200`, health `privacyVersion: 2026-10-12`, `contentSchema: 5`, `mediaStorage: r2`, informativa D1 v2 e `401` con `Cache-Control: no-store` per l'export senza sessione |

## Punti 4–12 — criteri di completamento

| Punto | Criterio vincolante |
|---:|---|
| 4 | Ogni contenuto supportato ha bozza, anteprima autenticata con `noindex`, pubblicazione, archiviazione, cronologia e ripristino; una bozza non compare in sitemap né API pubbliche |
| 5 | Completo — Ogni Voce e luogo pubblicato restituisce title, `h1` e testo principale anche senza JavaScript; gli URL storici e i QR si risolvono verso l’ID stabile; canonical, collegamenti interni e sitemap usano l’URL preferito. Prove e procedura sono in `05-permalink-pagine-indicizzabili.md` |
| 6 | R2 conserva gli originali e produce varianti responsive; D1 conserva metadati, testo alternativo, didascalia e relazione; rimozione e sostituzione rispettano revisioni e contenuti pubblicati |
| 7 | Il pannello usa identità personale forte; anteprime e operazioni editoriali non sono raggiungibili tramite un token condiviso e le pagine amministrative restano `noindex` |
| 8 | Esportazione e ripristino coprono D1 e media; diagnostica controlla API, build statica, sitemap, URL canonici, link interni, immagini mancanti e stato dell’ultima pubblicazione; il manuale descrive il flusso senza codice |
| 9 | Le cinque tipologie principali sono misurate su mobile e desktop; superano le soglie Core Web Vitals oppure ogni scostamento ha causa, intervento e nuova misurazione documentati |
| 10 | Completo — Esiste un calendario basato sui cluster territoriali, ogni affermazione storica distingue fonte, testimonianza e interpretazione, nessuna Voce resta isolata; proprietà, sitemap, finestra, aggregazione e validatore rendono ripetibile il confronto trimestrale con la baseline reale |
| 11 | Il pannello usa linguaggio comprensibile, percorsi brevi, gerarchia coerente, salvataggi e conflitti spiegati, feedback accessibili, anteprime utili e interazioni complete su tastiera, smartphone e desktop; i test coprono i flussi principali senza richiedere conoscenze tecniche |
| 12 | Raccolta e conservazione dei dati sono minimizzate e motivate; retention, consenso, cancellazione, esportazione, log, metadati, servizi esterni, cookie e credenziali sono verificati e documentati; nessun contenuto privato, bozza o segreto raggiunge pagine, sitemap, telemetria o cache pubbliche |
| 13 | L'amministratore crea, compone, personalizza, pubblica, archivia, recupera ed elimina in sicurezza una pagina da smartphone e desktop usando soltanto blocchi e controlli visuali, senza codice e senza perdere URL, QR, SEO, privacy, accessibilità, prestazioni o cronologia |
