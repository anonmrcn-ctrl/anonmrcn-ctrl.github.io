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

## Unità successive

- **8.2 — Verifica e ripristino:** validazione preventiva dell'archivio,
  ripristino controllato di D1 e R2 e procedura infrastrutturale completa.
- **8.3 — Diagnostica CMS/SEO:** API, build statica, sitemap, canonical,
  collegamenti, immagini e stato dell'ultima pubblicazione.
- **8.4 — Manuale e manutenzione:** flussi senza codice, controlli periodici,
  gestione degli errori e prova sul servizio pubblicato.
