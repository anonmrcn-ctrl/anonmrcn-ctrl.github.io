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

Una seconda passkey, preferibilmente su un dispositivo differente, riduce il
rischio di perdere l'accesso ma non è necessaria al funzionamento del sistema.
L'amministratore non dispone attualmente di un secondo autenticatore e accetta
quindi la singola credenziale come limite operativo documentato. La chiave
privata non è esportata dall'applicazione. Se l'unica passkey viene persa, il
recupero è deliberatamente un'operazione infrastrutturale: con accesso
autorizzato a Cloudflare si esportano per prova le tabelle amministrative, si
eliminano esclusivamente sessioni, sfide, credenziali e identità
amministrative, quindi si ripete il bootstrap con `ADMIN_TOKEN`. Contenuti,
media, URL e dati degli utenti non vengono toccati.

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

La PR #16 ha pubblicato il codice il 10 ottobre 2026 conservando tre commit
distinti. I run Worker `38068531893`, Pages `38068531244` e controllo SEO
`38068532070` sono riusciti. Le verifiche pubbliche confermano:

- `/api/health` restituisce `contentSchema: 4` e `mediaStorage: "r2"`;
- prima dell'attivazione `/api/admin/auth/status` restituiva `200`,
  `configured: false`, `Cache-Control: no-store` e `nosniff`;
- `/api/admin/summary` senza sessione e il bootstrap con un valore non valido
  restituiscono `401` e non espongono dati;
- `admin.html` resta `noindex, nofollow`, mostra «Accedi con passkey» e la
  procedura iniziale con etichette accessibili;
- gli script live del pannello e delle Voci usano `nnmrcn_admin_session` e
  `Authorization: Bearer`, senza la precedente chiave di archiviazione del
  token.

L'11 ottobre 2026 l'attivazione personale è stata completata. La verifica
pubblica ha restituito `configured: true` sullo stato autenticazione e `401` da
`/api/admin/summary` quando è stato inviato il solo header `X-Admin-Token`; le
risposte hanno conservato `Cache-Control: no-store` e `nosniff`.
L'amministratore ha inoltre confermato l'accesso riuscito con la passkey.

Non è disponibile un secondo autenticatore. L'aggiunta di una seconda passkey
resta pertanto una raccomandazione di continuità, non un requisito bloccante:
l'assenza è registrata esplicitamente e il recupero infrastrutturale rimane
l'unica procedura in caso di perdita della credenziale. Il punto 7 è completo
perché il token condiviso non consente più l'accesso ordinario, la passkey
personale è attiva e le pagine amministrative restano escluse
dall'indicizzazione.
