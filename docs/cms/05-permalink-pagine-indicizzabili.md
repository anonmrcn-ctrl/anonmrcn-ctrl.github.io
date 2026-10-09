# Punto 5 — Permalink, QR e pagine indicizzabili

Completato il 9 ottobre 2026.

## Risultato

Ogni Voce e luogo restituito dalle API pubbliche D1 ha ora una pagina HTML
autonoma, leggibile e indicizzabile senza eseguire JavaScript. Al momento del
completamento l’inventario comprende 5 Voci e 2 luoghi.

| Contenuto | URL preferito | URL storico conservato |
|---|---|---|
| Voce | `/voci/<slug>.html` | `/voci.html#<slug>` |
| Luogo | `/luoghi/<id>.html` | `/luogo.html?luogo=<id>` |
| Luogo sulla mappa | pagina autonoma come collegamento principale | `/progetto.html?luogo=<id>#map` resta operativo |

Gli URL preferiti usano lo slug editoriale della Voce e l’ID numerico stabile
del luogo. I QR già distribuiti non cambiano: l’URL storico continua ad aprire
la scheda dinamica e il registro D1 lo associa allo stesso `target_id`, indicando
anche l’URL preferito come destinazione.

## Generazione e pubblicazione

`scripts/generate-public-pages.mjs` legge soltanto le API pubbliche:

- elenca le Voci pubblicate e ne recupera testo, fonti e immagini;
- elenca i luoghi pubblici con ID, descrizione, coordinate e immagine;
- genera file HTML completi in `voci/` e `luoghi/`;
- aggiorna `public-content-manifest.json` e `sitemap.xml`;
- rimuove dalle sole cartelle generate una pagina che non compare più nelle API
  pubbliche.

La workflow `sync-public-pages.yml` esegue la sincronizzazione ogni sei ore e
può essere avviata manualmente dopo una pubblicazione editoriale. Prima del
commit verifica metadati, collegamenti, renderer e sitemap. Un errore di rete o
di validazione interrompe il job prima di modificare il sito pubblicato.

## SEO, accessibilità e privacy

Ogni pagina generata contiene un solo `h1`, testo principale server-readable,
description, canonical, Open Graph, immagine sociale, JSON-LD (`Article` o
`Place`) e data di aggiornamento. I collegamenti fra Voci e quelli provenienti
dalla mappa usano gli URL preferiti.

Il renderer accetta soltanto URL `http` o `https`, tratta il contenuto editoriale
come testo non eseguibile e ha un test specifico contro l’iniezione di HTML e
JavaScript. Le pagine non caricano strumenti di analytics. Bozze, anteprime,
token e contenuti amministrativi non possono entrare nel manifest o nella
sitemap perché la generazione interroga esclusivamente gli endpoint pubblici.

## Permanenza in D1

Il Worker sincronizza i permalink durante l’inizializzazione e dopo la creazione
o modifica di Voci e luoghi:

- il canonical corrente è `active`;
- gli URL storici sono `redirect` verso il canonical, senza cambiare `path` o
  `target_id`;
- un vecchio canonical resta registrato e diventa alias se cambia lo slug;
- i permalink di una Voce tornata in bozza diventano `gone` e non espongono il
  contenuto;
- il deep link della mappa resta attivo perché conserva una funzione diversa
  dalla pagina autonoma.

Le API pubbliche aggiungono `preferredUrl` e `legacyUrl` senza rimuovere o
rinominare campi esistenti.

## Verifiche ripetibili

```bash
node scripts/generate-public-pages.mjs
node scripts/check-content-boundary.mjs
node scripts/check-seo.mjs
node --test scripts/public-pages.test.mjs worker/tests/*.test.mjs
```

`permalinks.test.mjs` prova canonical, alias, destinazioni, ID, idempotenza e
cambio slug. `public-pages.test.mjs` prova HTML senza JavaScript, escaping e
collegamenti preferiti. `check-seo.mjs` confronta manifest, file, canonical,
sitemap, title, description, JSON-LD, immagini e link interni.