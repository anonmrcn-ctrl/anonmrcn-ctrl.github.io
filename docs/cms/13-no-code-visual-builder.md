# Punto 13 — autonomia visuale no-code

Aggiornato il 18 ottobre 2026. Questa roadmap estende il CMS già pubblicato:
non riapre né sostituisce i punti 1–12, che restano la base tecnica e le
garanzie da preservare.

## Obiettivo

L'amministratore deve poter costruire e modificare il sito senza intervenire
su HTML, CSS, JavaScript, SQL o file del repository. L'interfaccia deve
permettere di:

- creare una pagina vuota o partire da un modello;
- comporla interamente con blocchi visuali, anche annidati;
- riordinare, duplicare, salvare e riutilizzare blocchi e sezioni;
- modificare contenuti, layout e grafica per smartphone, tablet e desktop;
- configurare le funzioni ammesse tramite proprietà comprensibili;
- gestire slug, metadati, menu, bozze, pubblicazione e cronologia;
- archiviare, recuperare ed eliminare pagine senza produrre URL morti;
- cambiare il sistema grafico globale senza modificare il codice.

«Zero programmazione» descrive il flusso editoriale ordinario. Nuovi tipi di
blocco o nuove integrazioni tecniche continueranno a richiedere sviluppo e
test, ma dopo la loro registrazione saranno configurabili visualmente. Il CMS
non esporrà campi per HTML, CSS o JavaScript arbitrario: la personalizzazione
massima verrà ottenuta con proprietà dichiarative validate, temi e componenti
versionati.

## Principi non negoziabili

1. URL, QR, frammenti, query compatibili e ID pubblici esistenti restano validi.
2. D1 conserva struttura e metadati; R2 conserva media e documenti.
3. Ogni modifica usa bozza, anteprima protetta, revisione append-only e
   pubblicazione esplicita.
4. L'archiviazione è il primo livello di eliminazione. La cancellazione
   definitiva richiede analisi di link, QR, alias, dati collegati e una
   destinazione valida per gli URL precedenti.
5. Bozze, anteprime e pannello restano `noindex` e fuori dalla sitemap.
6. Il renderer accetta soltanto blocchi e proprietà registrati, sanitizzati e
   coperti da test.
7. Accessibilità, privacy, SEO e budget prestazionali sono vincoli del builder,
   non controlli facoltativi finali.
8. Il sito corrente e i ripieghi statici restano disponibili finché la
   migrazione di una tipologia non è completa e verificata in produzione.

## Catalogo minimo dei blocchi

- **Struttura:** pagina, sezione, contenitore, pila, riga, colonne, griglia,
  separatore e spazio.
- **Contenuto:** titolo, testo formattato, elenco, citazione, immagine,
  galleria, didascalia, collegamento e pulsante.
- **Navigazione:** menu, indice, breadcrumb, elenco di collegamenti e ancora.
- **Progetto:** poesia, Voci, luoghi, mappa, fonti, Memorie e contenuti
  editoriali collegati.
- **Globali:** intestazione, piè di pagina, avviso e sezione riutilizzabile.
- **Funzionali:** raccolta, filtro, modulo già autorizzato e sorgente dati
  prevalidata; mai script arbitrario.

Il registro può crescere, ma ogni nuovo tipo deve dichiarare schema delle
proprietà, limiti di annidamento, resa semantica, variante responsive,
accessibilità, privacy, SEO, migrazione e test.

## Ordine vincolante

| Unità | Risultato | Stato | Dipendenza |
|---:|---|---|---|
| 13.0 | Roadmap, guardrail e controllo automatico | Completa | Punti 1–12 |
| 13.1 | Inventario visuale e contratto dei blocchi | Completa | 13.0 |
| 13.2 | Schema D1 per pagine, alberi e temi | Completa | 13.1 |
| 13.3 | Registro dei blocchi e renderer pubblico sicuro | Completa | 13.2 |
| 13.4 | Migrazione dei componenti specializzati | Completa | 13.3 |
| 13.5 | Canvas visuale a blocchi | Completa | 13.4 |
| 13.6 | Ispettore visuale e anteprima responsive | Completa | 13.5 |
| 13.7 | Gestione completa delle pagine | Completa | 13.6 |
| 13.8 | Modelli, sezioni riutilizzabili e parti globali | Completa | 13.7 |
| 13.9 | Studio grafico globale | Completa | 13.8 |
| 13.10 | Comportamenti e collegamenti senza codice | Completa | 13.9 |
| 13.11 | Pubblicazione, qualità e recupero | Completa | 13.10 |
| 13.12 | Migrazione finale e audit di indipendenza | Completa | 13.11 |

I criteri dettagliati e lo stato eseguibile sono in
`docs/cms/no-code-roadmap.json`. Dopo ogni unità completa si aggiornano insieme
il file JSON, questa tabella e `docs/cms/progress.md`.

La prova dell'unità 13.1 è in `13-1-visual-inventory-contract.md`; inventario,
contratto e validatore sono rispettivamente in `visual-component-inventory.json`,
`block-contract.json` e `scripts/check-visual-inventory.mjs`.

La prova dell'unità 13.2 è in `13-2-visual-d1-schema.md`; la migrazione
append-only, lo schema runtime e i test sono in `worker/migrations/0019_*`,
`worker/src/visual-builder-storage.js` e
`worker/tests/visual-builder-storage.test.mjs`.

La prova dell'unità 13.3 è in `13-3-block-registry-renderer.md`; registro,
renderer, endpoint pubblico parallelo e test di sanitizzazione sono in
`worker/src/visual-builder-renderer.js` e
`worker/tests/visual-builder-renderer.test.mjs`.

La prova dell'unità 13.4 è in `13-4-specialized-adapters.md`; inizializzazione
idempotente, adattatori D1, resa sicura e prove dei ripieghi statici sono in
`worker/src/visual-builder-adapters.js`,
`worker/src/visual-builder-renderer.js` e
`worker/tests/visual-builder-adapters.test.mjs`.

La prova dell'unità 13.5 è in `13-5-visual-canvas.md`; API strutturale,
interfaccia a blocchi, cronologia e test delle operazioni sono in
`worker/src/visual-builder-admin.js`, `admin-visual-builder.js` e
`worker/tests/visual-builder-canvas.test.mjs`.

La prova dell'unità 13.6 è in `13-6-visual-inspector-preview.md`; schema
dell'ispettore, validazione server, anteprima responsive e test sono in
`worker/src/visual-builder-inspector.js`, `admin-visual-builder.js` e
`worker/tests/visual-builder-inspector.test.mjs`.

La prova dell'unità 13.7 è in `13-7-page-management.md`; creazione,
duplicazione, ciclo di vita, analisi delle dipendenze, redirect e cancellazione
protetta sono in `worker/src/visual-page-management.js`,
`admin-visual-builder.js` e
`worker/tests/visual-page-management.test.mjs`.

La prova dell'unità 13.8 è in `13-8-reusable-library-global-parts.md`;
libreria, collegamenti normalizzati, analisi dell'impatto, sincronizzazione e
scollegamento sono in `worker/src/visual-section-library.js`, nella migrazione
`0020_visual_reusable_instances.sql` e in
`worker/tests/visual-section-library.test.mjs`.

La prova dell'unità 13.9 è in `13-9-global-visual-studio.md`; schema dei token,
validazione, confronto, pubblicazione globale e ripristino sono in
`worker/src/visual-theme-studio.js`, `admin-visual-builder.js` e
`worker/tests/visual-theme-studio.test.mjs`.

La prova dell'unità 13.10 è in `13-10-behaviors-links.md`; registro dei
comportamenti, controlli generati, sorgenti D1 prevalidate, renderer e runtime
locale dei filtri sono in `worker/src/visual-builder-behaviors.js`,
`worker/src/visual-builder-inspector.js`, `worker/src/visual-builder-adapters.js`,
`worker/src/visual-builder-renderer.js`, `visual-behaviors.js` e
`worker/tests/visual-builder-behaviors.test.mjs`.

La prova dell'unità 13.11 è in `13-11-publication-quality-recovery.md`;
snapshot pubblico separato, preflight, anteprima autenticata, confronto,
pubblicazione atomica e recupero append-only sono in
`worker/src/visual-publication.js`, nella migrazione
`0021_visual_publications.sql`, in `admin-visual-builder.js` e in
`worker/tests/visual-publication.test.mjs`.

La prova dell'unità 13.12 è in `13-12-final-migration-independence-audit.md`.
Le nove pagine ordinarie storiche leggono prima lo snapshot visuale e conservano
il contenuto HTML come ultimo ripiego; le nuove pagine pubblicate dal builder
ottengono automaticamente HTML autonomo, canonical, JSON-LD, manifest e
sitemap. Tour guidato, manuale, diagnostica e audit automatico coprono l'intero
percorso senza richiedere codice o accesso al repository.

## Criterio finale

La roadmap è conclusa soltanto quando una prova end-to-end dimostra che, da
smartphone e desktop, l'amministratore può creare una pagina, costruirla a
blocchi, personalizzarne grafica e comportamento, controllarne SEO e
accessibilità, pubblicarla, inserirla nella navigazione, archiviarla,
recuperarla ed eliminarla in sicurezza senza modificare codice o usare il
repository.

Il criterio è soddisfatto dall'insieme dei test del ciclo di vita visuale,
dell'ispettore, della pubblicazione e dell'interfaccia responsive elencati
nell'audit 13.12. Il flusso conserva permalink e redirect prima di permettere
la cancellazione definitiva e non include bozze o anteprime nella sitemap.

## Estensione successiva

I problemi riscontrati dopo la chiusura riguardo l'anteprima delle modifiche,
l'inserimento dei media e l'aggiunta di audio e video non retrocedono le unità 13 già
verificate. Sono tracciati, ordinati e sottoposti a nuovi criteri end-to-end nel
punto 14: `14-visual-preview-media-audio-video.md`.
