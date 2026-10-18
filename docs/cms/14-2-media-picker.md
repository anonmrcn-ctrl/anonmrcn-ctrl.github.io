# Unità 14.2 — selettore visuale della libreria media

Completata il 18 ottobre 2026.

## Risultato

I blocchi `image` e `gallery` possono essere compilati dal pannello senza
conoscere `assetId`, chiavi R2 o URL. Il nuovo endpoint autenticato
`GET /api/admin/cms/visual-media` espone esclusivamente originali immagine
`current` delle Voci e dei luoghi, con nome, miniatura, dimensioni, alt e
didascalia. Non restituisce chiavi oggetto, documenti, versioni trattenute o
varianti tecniche.

La finestra del builder offre:

- ricerca per nome, testo alternativo o didascalia;
- filtro per origine;
- miniature e metadati leggibili;
- selezione o sostituzione per il blocco immagine;
- selezione multipla, riordino con pulsanti e rimozione per la galleria;
- compilazione nello stesso ispettore di alt, didascalia, credito e punto
  focale dell'immagine.

Tutti i comandi sono pulsanti nativi utilizzabili con mouse, tastiera e tocco.
La finestra è responsive e mantiene la selezione nel browser finché non viene
applicata.

## Integrità e accessibilità

Il Worker non accetta gli identificativi inviati dal browser sulla fiducia:
verifica che ogni riferimento punti a un originale immagine corrente del
catalogo ammesso. Per una galleria richiede inoltre un testo alternativo già
presente nel catalogo. I riferimenti vengono salvati nella colonna
`asset_id`, protetta dalla chiave esterna D1; ordine e revisioni restano parte
dello snapshot visuale. Il renderer condiviso produce una galleria semantica
nell'ordine scelto e usa i metadati del catalogo.

## Prove ripetibili

```bash
node --test worker/tests/visual-media-picker.test.mjs
node --test worker/tests/visual-builder-inspector.test.mjs
node scripts/check-visual-media-roadmap.mjs
node scripts/admin-ui.e2e.mjs
```

Il test API prova autenticazione, esclusione di versioni trattenute e varianti,
assenza di chiavi R2, salvataggio tipizzato di immagine e galleria, ordine e
rifiuto dei metadati accessibili mancanti. L'audit Playwright apre la libreria,
cerca un'immagine, la seleziona e verifica la compilazione automatica dell'alt.
