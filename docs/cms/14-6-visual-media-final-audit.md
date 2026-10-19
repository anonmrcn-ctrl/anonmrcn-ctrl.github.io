# 14.6 — Audit finale di anteprima e media visuali

Completata il 19 ottobre 2026. Questa verifica chiude il punto 14 senza
riaprire i punti 1–13 e senza introdurre un archivio alternativo a D1/R2.

## Percorso verificato

L’audit browser esegue lo stesso percorso a 375 × 812 px e a 1440 × 1000 px:

1. modifica un titolo e richiede l’anteprima server della bozza non salvata;
2. sceglie un’immagine e compone una galleria dalla libreria;
3. collega un audio, un video, il poster e i sottotitoli tramite controlli
   visuali, senza mostrare `assetId`, chiavi R2 o URL tecnici;
4. richiede una seconda anteprima e controlla che tutti i riferimenti correnti
   siano arrivati al renderer prima del salvataggio;
5. conserva schermate mobile e desktop come artefatti della CI.

I test Worker completano il percorso con upload D1/R2, varianti responsive,
privacy dei media non pubblicati, HTTP Range, preflight, pubblicazione atomica,
revisioni e ripristino. I test del generatore pubblico coprono HTML autonomo,
canonical e sitemap; i controlli SEO impediscono l’indicizzazione di pannello,
bozze e anteprime.

## Diagnostica amministrativa

`GET /api/admin/maintenance/diagnostics` aggiunge due controlli aggregati:

- **Anteprima e media nel builder** ricostruisce ogni bozza e conta immagini,
  gallerie, audio e video, segnalando come avviso i campi ancora incompleti;
- **Media nelle pagine pubblicate** blocca l’esito positivo se una
  pubblicazione contiene riferimenti assenti o conservati, tipi errati, testo
  alternativo mancante, trascrizione assente, poster o WebVTT mancanti.

Il rapporto restituisce soltanto conteggi e descrizioni operative: non espone
contenuti privati, identificativi, chiavi R2 o nomi degli oggetti. Il controllo
R2 esistente continua a confrontare dimensioni e presenza di ogni oggetto.

## Garanzie finali

- anteprime e media non pubblicati richiedono autenticazione, inviano
  `Cache-Control: no-store` e `X-Robots-Tag: noindex, nofollow`;
- audio e video sono nativi, senza autoplay, iframe, servizi esterni o
  telemetria implicita;
- video richiede poster e sottotitoli WebVTT; audio richiede la trascrizione;
- i media pubblici sono raggiungibili soltanto se referenziati dallo snapshot
  pubblicato e supportano richieste Range valide e risposta 416 per intervalli
  impossibili;
- revisioni e ripristino restano append-only e non cambiano la versione
  pubblica finché la nuova bozza non viene pubblicata;
- canonical e sitemap includono soltanto pagine pubblicate e indicizzabili.

## Verifica ripetibile

```sh
node scripts/check-visual-media-roadmap.mjs
node scripts/check-content-boundary.mjs
node scripts/check-seo.mjs
node scripts/check-no-code-roadmap.mjs
node --test scripts/*.test.mjs
node --test worker/tests/*.test.mjs
node scripts/check-performance.mjs
node scripts/admin-ui.e2e.mjs
cd worker && npx wrangler deploy --dry-run --outdir /tmp/nnmrcn-worker-build
```

La workflow «Controlla prestazioni» esegue l’audit browser con Chrome e
conserva quattro schermate dedicate al builder media, oltre ai rapporti
Lighthouse. Le verifiche pubblicate conclusive sono registrate nel rapporto di
esecuzione e nel registro generale dopo l’integrazione su `main`.

Nella verifica locale conclusiva risultano superati 35 test degli script e 168
test Worker. Il dry-run Wrangler produce 738,08 KiB (142,66 KiB compressi) con
i soli binding D1, R2 e origine consentita previsti. Il browser locale non può
avviarsi nel contenitore ristretto (`socket: Operation not permitted`): per
questo la prova Chrome resta un controllo obbligatorio della PR e non viene
sostituita da un esito simulato.
