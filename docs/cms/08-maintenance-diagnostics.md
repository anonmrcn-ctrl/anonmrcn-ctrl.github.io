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

## Unità successive

- **8.3 — Diagnostica CMS/SEO:** API, build statica, sitemap, canonical,
  collegamenti, immagini e stato dell'ultima pubblicazione.
- **8.4 — Manuale e manutenzione:** flussi senza codice, controlli periodici,
  gestione degli errori e prova sul servizio pubblicato.
