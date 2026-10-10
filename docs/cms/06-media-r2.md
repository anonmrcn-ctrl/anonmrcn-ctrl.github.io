# Punto 6 — Media e documenti in R2

## Unità 6.1 — Originali e catalogo

La prima unità del punto 6 sposta fuori da D1 gli originali delle fotografie
delle Voci, delle immagini dei luoghi e degli allegati delle Memorie. Il bucket
R2 `nnmrcn-media-eu` resta privato e usa la giurisdizione UE: il browser
continua a usare gli stessi endpoint del Worker e le stesse verifiche di
pubblicazione o autorizzazione. Nessun URL pubblico, ID, QR o riferimento
incorporato nei contenuti cambia.

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

## Pubblicazione verificata

Il 9 ottobre 2026 il codice dell'unità è stato integrato tramite PR #6. Il
primo deploy (`37957506177`) ha mostrato un difetto del provisioning automatico:
Wrangler ha creato la risorsa ma ha tentato di ereditare un binding `MEDIA` non
presente nella versione precedente (`10057`). La PR #7 ha quindi sostituito il
binding implicito con il bucket nominato `nnmrcn-media-eu`, la giurisdizione
`eu` e una creazione idempotente prima del deploy.

Il primo tentativo del deploy `37996881926` ha raggiunto l'API R2 e si è fermato
con il codice Cloudflare `10042`, perché R2 non era ancora abilitato
nell'account. Dopo l'attivazione, il 10 ottobre 2026 è stato rieseguito soltanto
il job fallito dello stesso run. Il nuovo tentativo ha completato la creazione
o il rilevamento di `nnmrcn-media-eu` in giurisdizione UE, il deploy del Worker
con binding `MEDIA` e la verifica del servizio.

Le prove pubbliche successive sono ripetibili senza credenziali:

1. `GET https://nnmrcn-rete.anonmrcn.workers.dev/api/health` restituisce `200`
   e `"mediaStorage":"r2"`;
2. la prima lettura della fotografia già esistente
   `4d3c17cd-2668-41e1-ad51-d7f466f3c260` restituisce 104.360 byte con
   `X-Media-Storage: d1`, eseguendo la migrazione compatibile;
3. la seconda lettura dello stesso URL restituisce gli stessi 104.360 byte con
   `X-Media-Storage: r2`;
4. il confronto binario delle due risposte è identico.

L'unità 6.1 è quindi completa anche sul servizio pubblicato. URL, ID e contenuto
del media precedente sono rimasti invariati; le unità 6.2–6.4 possono ora usare
il catalogo R2 attivo.

## Unità 6.2 — Dimensioni e varianti responsive

Per ogni nuova fotografia, il browser prepara l'originale ottimizzato e fino a
due varianti con chiavi stabili `small` e `medium`, limitate rispettivamente a
480 e 960 pixel sul lato maggiore. Il Worker non si fida dei metadati inviati:
controlla la firma JPEG, PNG o WebP, legge larghezza e altezza dai byte, verifica
che le varianti non superino l'originale e che ne conservino il rapporto. Ogni
oggetto viene scritto e riletto da R2 prima che il catalogo D1 diventi corrente.

Le API pubbliche continuano a esporre l'URL originale invariato e aggiungono
soltanto campi compatibili: dimensioni, sorgenti disponibili e `sizes`. Le
varianti usano lo stesso endpoint con `?variant=small` o `?variant=medium`;
se il catalogo o l'oggetto richiesto manca, il Worker restituisce l'originale.
Voci, luoghi, Memorie e pagine HTML generate applicano `srcset`, `sizes`,
`width` e `height`, riducendo byte trasferiti e spostamenti di layout.

Gli originali storici non vengono ricodificati né sostituiti. Alla prima
lettura il Worker ricava e registra le dimensioni reali; finché non vengono
caricate varianti, l'API pubblica propone il solo originale. Questo ripiego
preserva byte, URL, checksum e qualità dei dati già pubblicati senza creare
copie non verificabili.

La prova automatica `media-r2.test.mjs` usa immagini con dimensioni note,
controlla tre record correnti (`small`, `medium`, `original`), legge la variante
piccola, verifica le intestazioni dimensionali e richiede una chiave sconosciuta
per provare il ripiego. Lo stesso test controlla che i tre frontend e il
generatore statico applichino gli attributi responsive.

La PR #9 ha pubblicato l'unità il 10 ottobre 2026 conservando separati i commit
6.1 e 6.2. Il run Worker `38044904768` è riuscito insieme al controllo SEO
`38044904844`. Sul servizio pubblico, l'originale storico
`4d3c17cd-2668-41e1-ad51-d7f466f3c260` restituisce `X-Media-Storage: r2`,
`X-Media-Variant: original`, `X-Media-Width: 1600` e
`X-Media-Height: 599`. La richiesta dello stesso URL con `?variant=small`, per
il quale non esiste una copia storica, restituisce gli stessi 104.360 byte e
dichiara correttamente il ripiego `original`.

`GET /api/public/wiki/cave-di-gaggio-nord` espone le stesse dimensioni e la
sorgente disponibile. Una nuova esecuzione di `generate-public-pages.mjs` ha
quindi scritto nella pagina autonoma `voci/cave-di-gaggio-nord.html` gli
attributi `srcset`, `sizes`, `width="1600"` e `height="599"`. Le varianti
effettive dei nuovi caricamenti restano provate senza modificare contenuti
editoriali reali dal test che legge separatamente `small`, `medium` e
`original` da R2.

## Unità ancora da completare

| Ordine | Unità | Stato |
|---:|---|---|
| 6.1 | Originali, catalogo, migrazione compatibile e cancellazione privata | Completo e verificato sul Worker pubblicato |
| 6.2 | Metadati dimensionali e varianti responsive | Completo e verificato sul Worker e sulla pagina generata |
| 6.3 | Selezione e generazione delle immagini sociali | Da iniziare |
| 6.4 | Documenti in R2, gestione amministrativa e verifica finale | Da iniziare |

Il punto 6 e SEO-4 restano quindi **in corso** finché tutte le unità non sono
complete e verificate sul servizio pubblicato.
