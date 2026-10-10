# Punto 7 — Identità amministrativa e passkey

## Obiettivo

Il pannello non usa più un segreto condiviso come credenziale ordinaria. Ogni
accesso viene firmato da una passkey WebAuthn associata a un’identità personale
e richiede la verifica dell’utente sul dispositivo. Le pagine amministrative e
le anteprime restano `noindex, nofollow` e nessuna modifica riguarda URL, QR,
identificativi o contenuti pubblici.

## Flusso di accesso

1. Se D1 non contiene ancora credenziali, il pannello mostra «Configura la prima
   passkey». Il token `ADMIN_TOKEN` autorizza soltanto questa registrazione.
2. Il Worker emette una sfida casuale valida cinque minuti. Browser e
   autenticatore la legano all’origine `https://anonmrcn-ctrl.github.io`, al
   relying party `anonmrcn-ctrl.github.io` e alla presenza e verifica
dell’utente. La credenziale residente consente all’accesso pubblico di non
elencare gli identificativi delle passkey registrate.
3. D1 conserva nome dell’identità, ID e chiave pubblica della passkey,
   contatore, trasporti e date. Impronta, volto, PIN, chiave privata e dati
   biometrici restano nel dispositivo.
4. La registrazione o l’accesso riuscito crea una sessione casuale di otto ore.
   Il browser la conserva in `sessionStorage`; D1 conserva solo SHA-256 del
   token. Uscita e scadenza la revocano.
5. Dal momento in cui esiste una passkey, `X-Admin-Token` viene rifiutato per
   anteprime, contenuti, media, documenti, esportazioni e ogni altra rotta
   amministrativa. Una sessione autenticata può aggiungere una seconda passkey.

Le sfide sono monouso. Il Worker verifica tipo e origine dei dati client, hash
del relying party, flag di presenza e verifica, algoritmo ECDSA P-256, firma e
contatore. Il job programmato elimina sfide usate o scadute e sessioni scadute.
Tutte le risposte di autenticazione usano `Cache-Control: no-store` e
`X-Content-Type-Options: nosniff`.

## Schema e API

La migrazione `0017_admin_passkeys.sql` e lo schema idempotente definiscono:

- `admin_identities`, per il nome personale e le date;
- `admin_credentials`, per le sole chiavi pubbliche WebAuthn;
- `admin_auth_challenges`, per le sfide brevi e monouso;
- `admin_sessions`, per hash e scadenza delle sessioni.

Gli endpoint `/api/admin/auth/*` coprono stato iniziale, bootstrap, opzioni e
verifica di accesso, sessione, uscita, elenco e aggiunta di passkey. Non esiste
un endpoint pubblico per questi dati e nessuna tabella entra in esportazioni,
sitemap, telemetria o cache pubbliche.

## Recupero e continuità

Subito dopo il primo accesso va aggiunta una seconda passkey, preferibilmente su
un dispositivo differente. La chiave privata non è esportata dall’applicazione.
Se tutte le passkey vengono perse, il recupero è deliberatamente un’operazione
infrastrutturale: con accesso autorizzato a Cloudflare si esportano per prova le
tabelle amministrative, si eliminano esclusivamente sessioni, sfide,
credenziali e identità amministrative, quindi si ripete il bootstrap con
`ADMIN_TOKEN`. Contenuti, media, URL e dati degli utenti non vengono toccati.

## Verifiche ripetibili

Dalla radice del repository:

```bash
node --check worker/src/admin-auth.js
node --check worker/src/index.js
node --check admin.js
node --check voci.js
node --test worker/tests/admin-auth.test.mjs worker/tests/cms-schema.test.mjs
node scripts/check-content-boundary.mjs
node scripts/check-seo.mjs
(cd worker && npx --yes wrangler@4 deploy --dry-run --outdir /tmp/nnmrcn-worker-dry-run)
```

I test generano una coppia ECDSA P-256 reale, costruiscono registrazione e
asserzione WebAuthn, verificano disattivazione del token condiviso, origine,
firma, contatore, sfida monouso, hash della sessione e aggiunta di una seconda
passkey. Controllano inoltre che il frontend non conservi più il token e che la
pagina rimanga esclusa dall’indicizzazione.

## Attivazione pubblica

Il codice può essere verificato automaticamente; la prima passkey deve invece
essere creata dall’amministratore con un gesto e la verifica locale del proprio
dispositivo. Finché `/api/admin/auth/status` restituisce `configured: false`, il
token rimane disponibile unicamente come credenziale di bootstrap e il punto 7
non è dichiarato completo. Dopo la registrazione, la verifica pubblica richiede:

1. `configured: true` sullo stato autenticazione;
2. accesso riuscito con passkey e sessione;
3. risposta `401` di una rotta amministrativa chiamata con il solo vecchio
   token;
4. aggiunta di una seconda passkey e uscita riuscita.
