# Unità 13.12 — migrazione finale e audit di indipendenza

Completata il 18 ottobre 2026. Questa unità chiude il punto 13 senza rimuovere
URL, QR, query, frammenti, identificativi, contenuti o ripieghi dei punti 1–12.

## Migrazione pubblica

Le nove pagine ordinarie `accesso`, `archivio`, `autore`, `logo`, `memorie`,
`progetto`, `spazio-personale`, `spazio-pubblico` e `taccuino` caricano per prima
la pubblicazione visuale. I blocchi già presenti aggiornano gli elementi
storici tramite gli ID CMS; i nuovi blocchi sicuri vengono aggiunti senza
duplicare adattatori o funzioni specializzate. Se lo snapshot visuale non è
disponibile il client prova l'API pagine precedente e infine conserva l'HTML
statico.

`GET /api/public/visual-pages` elenca soltanto pagine pubblicate e indicizzabili.
`scripts/generate-public-pages.mjs` usa l'elenco per creare per ogni nuova pagina
del builder un file HTML autonomo con canonical, JSON-LD, tema validato e
contenuto già renderizzato. Lo stesso passaggio aggiorna manifest e sitemap e
rimuove soltanto file visuali generati diventati obsoleti; le pagine storiche e
le aree `noindex` non possono essere sovrascritte. Il workflow
`sync-public-pages.yml` ripete la sincronizzazione dopo le pubblicazioni D1.

## Percorso amministrativo senza codice

Il pannello include un percorso guidato accessibile in sei passaggi:

1. scegliere, creare o duplicare una pagina;
2. inserire e ordinare blocchi;
3. personalizzare contenuto e grafica nell'ispettore;
4. controllare smartphone, tablet e desktop;
5. eseguire preflight e pubblicazione esplicita;
6. confrontare o recuperare una revisione.

Il completamento del tour resta soltanto nel dispositivo. Il manuale
amministratore descrive anche navigazione, archiviazione, recupero, analisi
delle dipendenze e cancellazione definitiva protetta. La diagnostica segnala
alberi o snapshot incoerenti e differenze tra pagine visuali pubblicate,
manifest e sitemap.

## Prove end-to-end e guardrail

I test `visual-page-management`, `visual-builder-canvas`,
`visual-builder-inspector` e `visual-publication` coprono insieme creazione da
modello, composizione e riordino, personalizzazione responsive, preflight,
pubblicazione, canonical, alias, navigazione, archiviazione, recupero,
revisioni append-only e cancellazione. La cancellazione è rifiutata finché QR,
alias, collegamenti entranti o dati collegati non dispongono di una destinazione
valida. Le bozze, le anteprime e il pannello restano `noindex` e fuori dalla
sitemap.

`scripts/admin-ui.e2e.mjs` percorre tutti i sei passaggi a 375 × 812 e
1440 × 1000 pixel, controllando overflow, etichette, focus e bersagli tattili.
Il workflow `check-performance.yml` lo esegue con Chrome insieme all'audit
privacy e a Lighthouse mobile/desktop; conserva schermate e rapporti come
artefatti. `scripts/check-no-code-independence.mjs` rende ripetibile l'audit
strutturale su migrazione, tour, generazione statica, manuale e diagnostica.

## Esito locale ripetibile

Eseguito il 18 ottobre 2026 sul commit dell'unità:

```text
node scripts/check-no-code-roadmap.mjs       OK — 13 unità, nessuna aperta
node scripts/check-no-code-independence.mjs  OK — 9 pagine e 6 passi guidati
node scripts/check-visual-inventory.mjs      OK — 21 pagine, 40 tipi di blocco
node scripts/check-content-boundary.mjs      OK — 18 aree
node scripts/check-seo.mjs                   OK — 9 pagine e 7 pagine D1 autonome
node scripts/check-privacy.mjs               OK — nessun rilievo aperto
node scripts/check-performance.mjs           OK — budget statici conformi
node --test scripts/*.test.mjs               OK — 33/33
node --test worker/tests/*.test.mjs           OK — 151/151
npx wrangler@4 deploy --dry-run              OK — 688,22 KiB; gzip 132,49 KiB
```

Il browser locale non è incluso nel conteggio perché il binario Chromium non
era disponibile nell'ambiente di esecuzione. La prova browser effettiva è una
condizione del workflow di pull request: l'unità viene integrata soltanto dopo
il suo esito positivo, senza sostituirlo con un risultato simulato.
