# Backend della rete nnMrcn

Il sito resta pubblicato su GitHub Pages. Un Cloudflare Worker separato gestisce
accessi, location private, messaggi, lettere fisiche e moderazione tramite il
database D1 `nnmrcn-rete`.

## 1. Prepara il database D1

Apri Cloudflare → **Storage & databases** → **D1 SQL Database** e seleziona
`nnmrcn-rete`. Il suo identificativo è già configurato in `wrangler.jsonc`.

Apri **Console** ed esegui innanzitutto il contenuto di `worker/schema.sql`.
Il Worker aggiunge automaticamente alle installazioni esistenti i campi
`username` e `is_visible`, usati per il nome pubblico e per la preferenza di
visibilità della location. Aggiunge inoltre, senza cancellare dati, i campi per
il consenso e la pubblicazione nell’archivio. La stessa modifica è disponibile
come migrazione in `worker/migrations/0001_public_archive.sql`.

La tabella delle memorie degli abitanti è definita nello schema ed è disponibile
come migrazione non distruttiva in `worker/migrations/0002_memories.sql`. Il
Worker la crea anche automaticamente al primo utilizzo. Per mantenere allineata
la cronologia D1, dalla cartella `worker/` applica le migrazioni pendenti:

```sh
npx wrangler d1 migrations apply nnmrcn-rete --remote
```

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

Deve comparire una risposta JSON con `"ok": true`. A quel punto completa
l’accesso dal menu del sito con uno dei codici privati delle 20 location.

## 5. Modera i messaggi

L'area riservata è:

```text
https://anonmrcn-ctrl.github.io/admin.html
```

Per accedere usa il valore di `ADMIN_TOKEN`.

I messaggi online entrano nello stato `pending` e diventano visibili al
destinatario solo dopo l'approvazione. Le lettere fisiche entrano nello stato
`pending_delivery` e possono essere segnate come consegnate. Ogni location può
inviare al massimo cinque messaggi ogni ora dallo spazio personale.

La pubblicazione nell’archivio richiede tre passaggi separati: consenso del
mittente durante l’invio, consenso del destinatario dalla propria posta e
conferma finale dell’amministratore. L’endpoint pubblico restituisce soltanto
testo e date, senza indirizzi o coordinate. Il destinatario può revocare il
consenso anche dopo la pubblicazione: il messaggio viene rimosso immediatamente
dall’archivio.

Il pannello amministrativo mostra i conteggi delle attività da gestire, consente
la ricerca nella vista corrente e permette di esportare fino a 5.000 messaggi in
CSV o JSON. I campi CSV che potrebbero essere interpretati come formule vengono
neutralizzati durante l’esportazione.

L’esportazione JSON può essere conservata come copia manuale dei messaggi. D1
mantiene inoltre automaticamente la cronologia Time Travel. Per ottenere il
bookmark corrente, dalla cartella `worker/` esegui:

```sh
npx wrangler d1 time-travel info nnmrcn-rete
```

Un ripristino sovrascrive il database e va eseguito soltanto dopo aver verificato
il bookmark o il timestamp desiderato:

```sh
npx wrangler d1 time-travel restore nnmrcn-rete --bookmark=BOOKMARK
```

La procedura e i limiti di conservazione aggiornati sono descritti nella
[documentazione ufficiale di D1](https://developers.cloudflare.com/d1/reference/time-travel/).

Le richieste di codice inviate dalla pagina del progetto compaiono tra i
messaggi diretti con username, indirizzo e, se selezionato, un collegamento al
punto sulla mappa. Al momento della registrazione la location è visibile per
impostazione predefinita; l’utente può nasconderla o mostrarla dal menu.

Nello stesso pannello è presente la moderazione delle memorie. Ogni contributo
parte nello stato `pending` e compare in `memorie.html` soltanto dopo
**Approva e pubblica**. Può contenere testo, un punto geografico e un solo
allegato JPEG, PNG, WebP, MP3, OGG, WebM o M4A, limitato a 900 KB. Le fotografie
vengono ridimensionate nel browser prima dell’invio.

Il consenso alla pubblicazione è obbligatorio. Dopo l’invio il browser conserva
un codice di ritiro con cui l’autore può controllare lo stato e cancellare la
memoria anche se è già pubblicata. Il codice non viene inviato all’admin e non
compare negli endpoint pubblici.

## 6. Attiva le notifiche push

Nella pagina `admin.html`, dopo l'accesso, seleziona **Attiva notifiche** per
ricevere un avviso quando arriva un messaggio da moderare o una lettera da
gestire. Nello spazio personale, ogni location può attivare lo stesso pulsante
per ricevere una notifica quando un messaggio viene approvato.

Il Worker crea automaticamente le tabelle necessarie e le chiavi VAPID. La
chiave privata viene conservata cifrata nel database D1 mediante il segreto
`PASSWORD_PEPPER` già esistente: non occorre aggiungere segreti, dipendenze o
servizi esterni. Il contenuto dei messaggi non compare nelle notifiche.

Le notifiche amministratore segnalano anche l’arrivo di una nuova memoria da
controllare; testo, coordinate e allegati non compaiono nella notifica.

Su iPhone e iPad occorre prima aggiungere il sito alla schermata Home tramite
**Condividi** → **Aggiungi alla schermata Home**, aprirlo dalla Home e solo
allora attivare le notifiche. Su ogni dispositivo e browser il consenso deve
essere accordato separatamente.

## File da non pubblicare

- `nnmrcn_seed_private*.sql`;
- `nnmrcn_password_hash_update*.sql`;
- `nnmrcn_worker_secrets*.txt`;
- `nnmrcn_location_codes*.txt`;
- `password_locations_nnmrcn*.txt`.

Il file `.gitignore` alla radice del repository esclude questi file.
