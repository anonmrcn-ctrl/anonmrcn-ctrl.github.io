# Backend rete nnMrcn

Questo backend gestisce:

- login con una password diversa per ogni location;
- sessioni temporanee;
- sblocco delle locations sulla mappa;
- poesie associate alle locations;
- invio di messaggi online;
- richieste di consegna fisica;
- moderazione amministratore.

## File privati

I seguenti file NON devono essere caricati su GitHub:

- `nnmrcn_seed_private.sql`
- `nnmrcn_worker_secrets.txt`
- `password_locations_nnmrcn.txt`

## Configurazione Cloudflare

1. Crea un database D1 chiamato `nnmrcn-rete`.
2. Copia il suo `database_id` in `worker/wrangler.jsonc`.
3. Esegui `worker/schema.sql` sul database.
4. Esegui poi `nnmrcn_seed_private.sql` sullo stesso database.
5. Imposta due secret del Worker:
   - `ADMIN_TOKEN`
   - `PASSWORD_PEPPER`
6. Pubblica il Worker.
7. Inserisci l'URL del Worker in `config.js`.

Esempio con Wrangler, dalla radice del repository:

```bash
npx wrangler d1 execute nnmrcn-rete --remote --file=worker/schema.sql --config=worker/wrangler.jsonc
npx wrangler d1 execute nnmrcn-rete --remote --file=nnmrcn_seed_private.sql --config=worker/wrangler.jsonc

cd worker
npx wrangler secret put ADMIN_TOKEN
npx wrangler secret put PASSWORD_PEPPER
npx wrangler deploy
```

La pagina amministratore è `admin.html`. Non è linkata nel menu pubblico e richiede `ADMIN_TOKEN`.

## Moderazione

I messaggi online entrano nello stato `pending` e diventano visibili al destinatario solo dopo `Approva`.

Le lettere fisiche entrano nello stato `pending_delivery` e restano nell'area amministratore finché non vengono segnate come consegnate.

Ogni location può inviare al massimo 5 messaggi ogni ora.
