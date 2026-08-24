# Backend della rete nnMrcn

Il sito resta pubblicato su GitHub Pages. Un Cloudflare Worker separato gestisce
accessi, location private, messaggi, lettere fisiche e moderazione tramite il
database D1 `nnmrcn-rete`.

## 1. Prepara il database D1

Apri Cloudflare → **Storage & databases** → **D1 SQL Database** e seleziona
`nnmrcn-rete`. Il suo identificativo è già configurato in `wrangler.jsonc`.

Apri **Console** ed esegui innanzitutto il contenuto di `worker/schema.sql`.

Se le location non sono ancora presenti, esegui successivamente il contenuto del
file privato `nnmrcn_seed_private_d1_20260823.sql` aggiornato. Contiene le 20
location, ma cancella prima messaggi, sessioni e location esistenti: usalo
soltanto per il primo caricamento o quando desideri ripartire da zero.

Se le location sono già presenti, usa invece il file privato
`nnmrcn_password_hash_update_20260824.sql`: aggiorna esclusivamente gli hash
delle password, senza cancellare messaggi, sessioni o location.

Per verificare le location, esegui nella Console:

```sql
SELECT COUNT(*) AS numero_location FROM locations;
```

Il risultato atteso è `20`.

## 2. Collega il Worker a GitHub

Apri Cloudflare → **Workers & Pages** → **Create application** e collega il
repository `anonmrcn-ctrl/anonmrcn-ctrl.github.io`. Imposta:

- nome Worker: `nnmrcn-rete`;
- branch: `main`;
- root directory: `worker`;
- build command: nessuno;
- deploy command: `npx wrangler deploy`.

Se `nnmrcn-rete` esiste già, aprilo e configura la connessione da
**Settings** → **Builds** anziché creare un secondo Worker.

Il binding D1 `DB`, l'origine consentita di GitHub Pages e i log sono definiti
in `wrangler.jsonc`.

## 3. Configura i due segreti

Nel Worker apri **Settings** → **Variables and Secrets** → **Add**.

Crea due variabili di tipo **Secret**, copiando i valori esistenti dal file
privato `nnmrcn_worker_secrets_20260823.txt`:

- `ADMIN_TOKEN`;
- `PASSWORD_PEPPER`.

Non generare un nuovo `PASSWORD_PEPPER`: deve corrispondere alle location già
inserite nel database. Non pubblicare questi valori su GitHub.

Salva e seleziona **Deploy**.

## 4. Collega GitHub Pages al Worker

Copia l'indirizzo pubblico del Worker, che avrà questa forma:

```text
https://nnmrcn-rete.TUO-SOTTODOMINIO.workers.dev
```

Inseriscilo nel file `config.js`, senza barra finale:

```js
window.NNMRCN_API_BASE = "https://nnmrcn-rete.TUO-SOTTODOMINIO.workers.dev";
```

Verifica il Worker aprendo:

```text
https://nnmrcn-rete.TUO-SOTTODOMINIO.workers.dev/api/health
```

Deve comparire una risposta JSON con `"ok": true`. A quel punto accedi alla
pagina `progetto.html` con uno dei codici privati delle 20 location.

## 5. Modera i messaggi

L'area riservata è:

```text
https://anonmrcn-ctrl.github.io/admin.html
```

Per accedere usa il valore di `ADMIN_TOKEN`.

I messaggi online entrano nello stato `pending` e diventano visibili al
destinatario solo dopo l'approvazione. Le lettere fisiche entrano nello stato
`pending_delivery` e possono essere segnate come consegnate. Ogni location può
inviare al massimo cinque messaggi ogni ora.

## File da non pubblicare

- `nnmrcn_seed_private*.sql`;
- `nnmrcn_password_hash_update*.sql`;
- `nnmrcn_worker_secrets*.txt`;
- `nnmrcn_location_codes*.txt`;
- `password_locations_nnmrcn*.txt`.

Il file `.gitignore` alla radice del repository esclude questi file.
