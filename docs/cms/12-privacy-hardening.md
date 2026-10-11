# Rafforzamento della privacy

Aggiornato l'11 ottobre 2026. Questo documento è il registro verificabile del
punto 12. L'inventario leggibile dalle macchine è `privacy.config.json` e il
controllo è `node scripts/check-privacy.mjs`.

## 12.1 — Inventario e audit iniziale

L'audit segue il dato dalla raccolta alla cancellazione, non soltanto la pagina
informativa. Copre D1, R2, sessioni, cache, sitemap, log, credenziali, notifiche
push e servizi esterni. Non contiene valori reali, token, endpoint push,
indirizzi, coordinate o chiavi.

| Dato | Necessità e minimizzazione | Conservazione | Esposizione |
|---|---|---|---|
| Account/location | Accesso pseudonimo; niente civico, coordinate spostate, credenziali hash | Fino a cancellazione o fine progetto | La location nasce nascosta |
| Sessioni location | In D1 soltanto hash, ID e scadenza | Fino a 365 giorni, revoca al logout | Mai pubbliche |
| Messaggi | Corrispondenza; mittente nascosto per impostazione predefinita | Account/progetto | Pubblici solo con doppio consenso e moderazione |
| Contatti e richieste di accesso | Risposta e prevenzione abusi; IP soltanto come HMAC | 30 giorni | Mai pubblici |
| Memorie e media | Contributo volontario; nome facoltativo, token di ritiro hash | Fino a ritiro/progetto | Soltanto dopo approvazione |
| Push | Endpoint e chiavi strettamente tecnici | Disattivazione, account o risposta 404/410 | Mai pubblici |
| Passkey amministrative | Chiave pubblica e contatori; nessun dato biometrico | Fino a revoca; sessioni 8 ore | Mai pubblici |
| Documenti amministrativi | Metadati D1, byte R2 | Fino a cancellazione amministrativa | Download autenticato `no-store` |

### Superfici già protette

- `accesso.html`, `admin.html`, `spazio-personale.html` e `taccuino.html` sono
  `noindex` e assenti dalla sitemap.
- Bozze, anteprime, documenti e credenziali non hanno URL pubblici indicizzabili.
- Il log generale conserva metodo, solo percorso senza query e messaggio
  d'errore; non registra body, cookie, header Authorization o token.
- Le richieste di contatto scadute vengono eliminate automaticamente dopo 30
  giorni; le sessioni amministrative scadono dopo otto ore.
- La diagnostica e il backup CMS escludono dati operativi personali,
  autenticazione e segreti.

### Rilievi da correggere nelle unità successive

1. **PRIV-TELEMETRY-1:** non avviare GoatCounter prima di un consenso esplicito
   e non caricare telemetria nelle pagine personali o amministrative.
2. **PRIV-EXTERNAL-1:** servire Leaflet e PMTiles dallo stesso sito, senza una
   richiesta preliminare del browser a unpkg.
3. **PRIV-RIGHTS-1:** rendere disponibili esportazione e cancellazione
   autenticata dallo Spazio personale, mantenendo solo un ID tombstone non
   ricollegabile quando è necessario preservare i riferimenti storici.

Questi rilievi impediscono di dichiarare completo il punto 12, ma non il suo
inventario iniziale: ogni rilievo ha un'unità, una prova automatica prevista e
un criterio di chiusura esplicito.

## 12.2 — Minimizzazione e retention

Il job periodico ora elimina le righe scadute di `sessions` e
`mayor_sessions`; `purgeExpiredAdminAuth` continua a eliminare sfide e sessioni
amministrative scadute. Per le Memorie, l'HMAC pseudonimo dell'IP viene
svuotato dopo la finestra antiabuso di 24 ore. Restano invariati contributo,
stato, media R2, consenso e hash del token di ritiro, quindi la persona può
ancora controllare o rimuovere ciò che ha inviato.

`privacy-retention.test.mjs` prepara contemporaneamente record scaduti e
validi, esegue il vero handler `scheduled` e prova che soltanto i primi siano
eliminati o minimizzati. La pulizia dell'HMAC viene eseguita anche prima di una
nuova Memoria, così la garanzia non dipende esclusivamente dal cron.

## Servizi esterni

| Servizio | Scopo | Controllo previsto |
|---|---|---|
| GitHub Pages | Hosting statico | Nessun dato applicativo nel repository o nella sitemap |
| Cloudflare Worker, D1 e R2 | API e archiviazione | CORS ristretto, cache private `no-store`, segreti nell'ambiente |
| GoatCounter | Conteggi aggregati | Opt-in, nessuna query, nessun uso su pagine private |
| unpkg | Librerie cartografiche | Da eliminare tramite copie locali verificate |
| Esri | Tile richieste quando la mappa è usata | Documentare e caricare solo con la funzionalità cartografica |
| Google Search Console | Indicizzazione e dati SEO aggregati | Esportazioni locali con soglia minima, senza pixel sul sito |

## Prove ripetibili

```bash
node scripts/check-privacy.mjs
node scripts/check-content-boundary.mjs
node scripts/check-seo.mjs
node --test worker/tests/*.test.mjs
```

La configurazione non dichiara la conformità legale in astratto: rende
controllabili classi di dato, finalità, retention, destinazioni e problemi
aperti. Ogni correzione successiva deve eliminare il relativo rilievo dal file
soltanto dopo che il test ne verifica l'effettiva applicazione.
