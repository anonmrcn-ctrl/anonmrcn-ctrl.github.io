# Punto 8 — Esportazione, manutenzione e diagnostica

## 8.1 — Backup dei contenuti CMS e dei media

Il pannello amministrativo offre «Scarica backup CMS». L'endpoint autenticato
`GET /api/admin/maintenance/export` produce un archivio JSON versionato che
contiene:

- le tabelle D1 dei contenuti, delle revisioni, delle fonti, degli URL
  permanenti e dei documenti;
- tutti gli oggetti R2 catalogati in `media_assets`, codificati in base64;
- dimensione e SHA-256 di ogni oggetto;
- un SHA-256 dell'intero contenuto logico dell'archivio.

L'esportazione fallisce se un oggetto R2 manca, se dimensione o checksum non
corrispondono a D1, se gli oggetti sono più di 512 o se superano complessivamente
48 MiB. Un file parziale non viene presentato come backup valido.

### Confine di privacy

L'archivio è deliberatamente limitato al CMS. Non include passkey, chiavi
pubbliche, sessioni, sfide, password, profili territoriali, messaggi, contatti,
indirizzi o hash usati per consenso, revoca e limitazione degli abusi. Questi
dati operativi e personali non devono lasciare Cloudflare implicitamente
attraverso un download dal browser. Il backup infrastrutturale completo e la
relativa procedura di ripristino sono una distinta unità del punto 8.

Il file contiene comunque contenuti non ancora pubblicati e documenti privati:
va conservato in uno spazio cifrato e non deve essere allegato a issue, commit,
workflow o servizi pubblici.

### Verifiche ripetibili

```bash
node --check worker/src/cms-maintenance.js
node --check worker/src/index.js
node --check admin.js
node --test worker/tests/cms-maintenance.test.mjs
node scripts/check-content-boundary.mjs
node scripts/check-seo.mjs
```

I test provano autorizzazione, intestazioni `no-store`, formato e checksum,
presenza di D1 e R2, esclusione dei dati personali e rifiuto di un catalogo D1
che riferisce un oggetto R2 mancante.

## 8.2 — Verifica e ripristino controllato

Nel pannello, «Verifica o ripristina un backup» accetta esclusivamente il
formato `nnmrcn-cms-backup` versione 1. La verifica precede sempre il ripristino
e controlla:

- checksum complessivo, elenco esatto delle tabelle e compatibilità delle
  colonne;
- unicità, base64, dimensione, tipo e SHA-256 di ogni oggetto R2;
- corrispondenza biunivoca fra catalogo `media_assets` e oggetti inclusi;
- limiti di righe, numero di oggetti e dimensione totale;
- assenza dei media delle Memorie, che appartengono ai dati personali
  operativi esclusi dal backup CMS.

Soltanto un file valido produce una frase `RIPRISTINA …`, che deve essere
ricopiata prima di una seconda conferma esplicita del browser. Il Worker carica
i media sotto nuove chiavi R2, ne verifica la dimensione e solo dopo sostituisce
le tabelle CMS in una transazione D1. Le protezioni append-only vengono rimosse
soltanto dentro la transazione e ricreate prima del commit. Se D1 fallisce, le
nuove copie R2 vengono eliminate; se riesce, gli oggetti precedenti restano
intatti per consentire il recupero. URL, ID, revisioni, canonical e checksum
sono ripristinati dal file senza rigenerarli.

Il ripristino dal pannello riguarda il perimetro CMS. Un'esportazione completa
dell'istanza D1, che comprende dati operativi e personali, deve essere eseguita
soltanto da un amministratore Cloudflare e conservata cifrata:

```bash
cd worker
npx --yes wrangler@4 d1 export nnmrcn-rete --remote \
  --output ../nnmrcn-d1-completo.sql
```

Il file SQL completo non va caricato nel repository né nei workflow. Prima di
un recupero infrastrutturale si crea una nuova istanza D1, si importa lì il file
con `wrangler d1 execute --remote --file`, si verificano contenuti e accessi e
solo dopo si cambia il binding: non si importa alla cieca sul database di
produzione.

Le verifiche automatiche di 8.2 simulano un contenuto modificato dopo il
backup, rifiutano una conferma errata, ripristinano D1 e R2, conservano i vecchi
oggetti e provano che i cinque trigger di immutabilità siano ancora presenti.

## 8.3 — Diagnostica CMS e SEO

Il pulsante «Esegui diagnostica» chiama l'endpoint autenticato
`GET /api/admin/maintenance/diagnostics`. Il rapporto non contiene testi,
indirizzi, nomi dei file privati, chiavi R2 o credenziali e controlla:

- `PRAGMA foreign_key_check` e presenza/dimensione in R2 di ogni media
  catalogato in D1;
- health del Worker, versione dello schema e binding R2;
- corrispondenza fra Voci e luoghi pubblicati in D1 e
  `public-content-manifest.json`, inclusi ID, slug e data di aggiornamento;
- sitemap, collegamento da `robots.txt` ed esclusione delle aree private;
- risposta HTTP, title, `h1`, canonical e robots delle pagine indicizzabili;
- compatibilità dei collegamenti interni con sitemap, permalink e pagine
  private note;
- disponibilità di immagini HTML, varianti responsive e immagini sociali;
- data HTTP del manifest e aggiornamento più recente dei contenuti generati.

Il rapporto distingue `pass`, `warn` e `fail`. Per restare entro i limiti di
subrequest del Worker analizza al massimo 40 pagine e 20 immagini per esecuzione;
un superamento produce un errore o un avviso esplicito, non un falso esito
positivo. Il controllo locale `scripts/check-seo.mjs` resta complementare:
valida anche i file sorgente prima della pubblicazione.

## 8.4 — Manuale e manutenzione

`manuale-amministratore.md`, collegato direttamente dal pannello, descrive in
linguaggio operativo accesso, bozze, anteprima, revisioni, contenuti, fonti,
SEO, permalink, QR, media, documenti, backup, ripristino, diagnostica, errori e
privacy. Include una cadenza settimanale, mensile, trimestrale e annuale e non
richiede di modificare file o eseguire codice per le operazioni ordinarie.

L'unità diventa completa dopo la pubblicazione e la verifica del link al
manuale, del pannello, dell'endpoint diagnostico e delle intestazioni private
del Worker. Le prove di pubblicazione vengono registrate qui senza riportare
sessioni o contenuti riservati.

## Verifica della pubblicazione

La PR #18 è stata integrata l'11 ottobre 2026 con un merge commit, conservando
i cinque commit distinti delle unità 7.2 e 8.1–8.4. Sono riusciti:

- Worker Cloudflare `38091623182`;
- controllo SEO e contenuti `38091623204`;
- GitHub Pages `38091622784`.

Le verifiche sul servizio pubblicato hanno confermato:

- `/api/health` restituisce `ok: true`, schema contenuti 4 e storage `r2`;
- `/api/admin/auth/status` restituisce `configured: true`, `no-store` e
  `nosniff`;
- esportazione e diagnostica senza sessione restituiscono `401`, `no-store` e
  `nosniff`, senza esporre dati;
- `admin.html` conserva `noindex, nofollow` e contiene backup, verifica,
  ripristino, diagnostica e collegamento al manuale;
- la pagina usa la versione aggiornata `admin.js?v=20261011-maintenance1`.

La suite completa conta 115 test superati; `check-content-boundary.mjs`,
`check-seo.mjs` e il dry-run Wrangler sono riusciti. L'esecuzione di una
diagnostica autenticata completa richiede intenzionalmente la passkey nel
browser dell'amministratore; l'endpoint pubblicato non accetta il vecchio token.
