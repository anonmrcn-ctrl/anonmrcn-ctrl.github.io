# Punto 6 — Media e documenti in R2

## Unità 6.1 — Originali e catalogo

La prima unità del punto 6 sposta fuori da D1 gli originali delle fotografie
delle Voci, delle immagini dei luoghi e degli allegati delle Memorie. Il bucket
R2 resta privato: il browser continua a usare gli stessi endpoint del Worker e
le stesse verifiche di pubblicazione o autorizzazione. Nessun URL pubblico, ID,
QR o riferimento incorporato nei contenuti cambia.

La migrazione `0015_media_assets_r2.sql` aggiunge a D1 il catalogo
`media_assets`. Ogni record collega un proprietario stabile all'oggetto R2 e
conserva tipo, nome, dimensione, checksum SHA-256, variante, testo alternativo,
didascalia e stato. Il catalogo ammette già il proprietario `document`, che sarà
usato dall'unità 6.4 senza cambiare gli ID degli altri media. L'indice parziale
permette un solo originale `current` per proprietario; gli originali sostituiti
diventano `retained` e non sono più
serviti dalle API pubbliche.

Il flusso di scrittura è compatibile con i dati esistenti:

1. il Worker valida e salva temporaneamente il contenuto in D1 con lo stesso
   schema usato finora;
2. scrive i byte nel binding privato `MEDIA`, rilegge le proprietà dell'oggetto
   e verifica la dimensione;
3. registra il catalogo e svuota il blob D1 in una singola transazione;
4. se R2 non è disponibile o la verifica fallisce, conserva il blob D1 e
   continua a servirlo come ripiego.

I contenuti precedenti vengono migrati senza fermo in due modi: alla prima
lettura del relativo endpoint e, fino a 25 oggetti per esecuzione, dal job
programmato già esistente. La risposta espone `X-Media-Storage: r2` oppure
`d1`, mentre l'health check espone soltanto lo stato non sensibile del binding
con `mediaStorage`.

## Garanzie di privacy e conservazione

- Il bucket non ha un dominio pubblico: controllo di accesso, stato editoriale
  e cache restano responsabilità del Worker.
- La cancellazione tramite codice di ritiro di una Memoria elimina tutti i suoi
  oggetti R2, il catalogo e il record D1; se il binding non fosse disponibile,
  l'operazione fallisce invece di lasciare oggetti personali orfani.
- Una fotografia rimossa o sostituita non torna pubblica: il catalogo passa a
  `retained` e le letture selezionano esclusivamente la versione `current`.
- Testo alternativo e didascalia delle Voci restano in D1, vengono copiati nel
  catalogo e possono essere aggiornati senza duplicare i byte.
- Nomi file e checksum non vengono esposti in sitemap o telemetria; le risposte
  multimediali mantengono `nosniff` e la politica di cache già prevista dalla
  rispettiva area.

## Verifiche ripetibili dell'unità

Dalla radice del repository:

```bash
node --check worker/src/index.js
node --test worker/tests/media-r2.test.mjs worker/tests/cms-schema.test.mjs
(cd worker && npx --yes wrangler@4 deploy --dry-run --outdir /tmp/nnmrcn-worker-dry-run)
```

I test provano scrittura e lettura R2, sostituzione con versione trattenuta,
ripiego D1, testo alternativo e didascalia delle Voci, nonché cancellazione
integrale dell'allegato di una Memoria.

## Unità ancora da completare

| Ordine | Unità | Stato |
|---:|---|---|
| 6.1 | Originali, catalogo, migrazione compatibile e cancellazione privata | Completo nel repository; pubblicazione da verificare |
| 6.2 | Metadati dimensionali e varianti responsive | Da iniziare |
| 6.3 | Selezione e generazione delle immagini sociali | Da iniziare |
| 6.4 | Documenti in R2, gestione amministrativa e verifica finale | Da iniziare |

Il punto 6 e SEO-4 restano quindi **in corso** finché tutte le unità non sono
complete e verificate sul servizio pubblicato.
