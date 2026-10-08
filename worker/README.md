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
visibilità della location. Le nuove location partono nascoste e diventano
visibili soltanto dopo una scelta esplicita dell’utente; le preferenze già
salvate non vengono modificate. Aggiunge inoltre, senza cancellare dati, i campi per
il consenso e la pubblicazione nell’archivio. La stessa modifica è disponibile
come migrazione in `worker/migrations/0001_public_archive.sql`.

La tabella delle memorie degli abitanti è definita nello schema ed è disponibile
come migrazione non distruttiva in `worker/migrations/0002_memories.sql`. Il
Worker la crea anche automaticamente al primo utilizzo. Per mantenere allineata
la cronologia D1, dalla cartella `worker/` applica le migrazioni pendenti:

```sh
npx wrangler d1 migrations apply nnmrcn-rete --remote
```

Le voci enciclopediche e la relativa cronologia sono definite nella migrazione
`0003_wiki_entries.sql`; le fotografie inserite nelle voci sono aggiunte dalla
migrazione non distruttiva `0004_wiki_images.sql`. Anche queste tabelle vengono
create automaticamente dal Worker al primo utilizzo.

Le sessioni dedicate allo spazio «Messaggio per il sindaco» sono definite nella
migrazione `0005_mayor_access.sql`. Sono archiviate separatamente dalle sessioni
delle location e il Worker crea automaticamente le tabelle al primo accesso.

La schermata di benvenuto delle location usa il campo aggiunto dalla migrazione
non distruttiva `0006_location_welcome.sql`. Le sessioni delle location durano
un anno e, durante l'uso del sito, vengono rinnovate al massimo una volta al
giorno. Il pulsante «Esci» le revoca immediatamente.

La migrazione non distruttiva `0007_location_visibility_opt_in.sql` applica
alle nuove location la visibilità iniziale nascosta anche nei database creati
con una versione precedente dello schema.

La migrazione `0008_location_privacy.sql` aggiunge il marcatore usato per la
minimizzazione geografica. Al primo accesso successivo al deploy, il Worker
rimuove i numeri civici già presenti, sposta ogni coordinata di circa 250–400
metri e sostituisce definitivamente i valori esatti. Un job programmato ogni
notte elimina inoltre i messaggi di contatto e le richieste di codice più vecchi
di 30 giorni.

La migrazione `0010_map_entries.sql` aggiunge l’archivio delle voci pubbliche
della mappa. Il Worker crea automaticamente la tabella al primo caricamento
dell’elenco o all’inserimento di una voce dal pannello amministrativo.

La migrazione `0012_narrative_steps.sql` aggiunge le tappe amministrabili di
«Esplora la poesia». Al primo accesso il Worker importa una sola volta le 13
tappe storiche; da quel momento ordine, versi, spiegazioni, coordinate, fonti e
stato di pubblicazione vengono letti dal database e gestiti dal pannello.

La migrazione `0013_cms_content_foundation.sql` crea la fondazione comune per
pagine e blocchi, poesia editoriale, menu, tour, impostazioni, fonti, livelli
cartografici, revisioni, permalink e documenti legali. Le revisioni sono
append-only, il percorso di un permalink non è riscrivibile e una versione
legale pubblicata non può essere modificata o eliminata. Il primo health check
dopo il deploy installa in modo idempotente queste strutture e restituisce
`"contentSchema": 1`.

Al primo accesso a una pagina pubblica, il Worker importa una sola volta in
`site_pages` e `page_blocks` i 60 blocchi editoriali di Progetto, Autore, Logo,
Spazio pubblico, Archivio, Memorie, Taccuino, Spazio personale e Accesso. Gli
identificativi rimangono stabili e gli inserimenti usano `INSERT OR IGNORE`,
quindi un contenuto già presente in D1 non viene sovrascritto da un deploy.
L'endpoint pubblico è `GET /api/public/pages/:slug` e restituisce soltanto
pagine con stato `published`. Ogni file HTML conserva la copia originaria e la
usa automaticamente se il Worker non è raggiungibile.

La stessa inizializzazione importa «Il Gajo tra i Praelli» in `poem_works`,
`poem_sections` e `poem_lines`: 4 canti, 121 versi e i metadati necessari a
ricostruire strofe, rientri e 165 righe metriche. L'endpoint
`GET /api/public/poems/il-gajo-tra-i-praelli` restituisce soltanto l'opera
pubblicata. `index.html` conserva l'intera poesia come ripiego; numerazione e
collegamenti territoriali vengono applicati dopo D1 o dopo l'attivazione del
ripiego, mantenendo invariati gli ancoraggi `#I`–`#IV` e i numeri di rigo.

Il menu globale viene inizializzato in `navigation_items` con quattro voci
principali, il collegamento al sostegno e quello amministrativo. L'endpoint
`GET /api/public/navigation` restituisce in ordine soltanto record `published`
con visibilità `public`. Le dieci pagine che mostrano il menu conservano le
stesse destinazioni nell'HTML e le usano se l'API non è disponibile.

Introduzione e cinque schermate del benvenuto vengono importate in
`site_settings` e `onboarding_steps` e lette da
`GET /api/public/onboarding/welcome`. Il client conserva la stessa sequenza in
`sessione.js` come ripiego, senza cambiare sessioni o stato di completamento.

I cataloghi cartografici storici sono inizializzati in `map_layers` e
`map_features`. `GET /api/public/map-layers/:slug` restituisce soltanto livello
ed elementi pubblicati in forma GeoJSON. I sette elementi già ritirati restano
`archived` e le quattro raccolte locali, già vuote dal 6 ottobre 2026, sono il
ripiego: il deploy non reintroduce geometrie eliminate. Le voci correnti in
`map_entries` non vengono modificate.

Il catalogo `sources` deduplica per URL le 17 fonti del percorso e importa i
richiami già presenti nelle Voci, nei luoghi e nei metadati cartografici.
`content_source_links` conserva ordine e contesto senza riscrivere i token o i
campi originari. `GET /api/public/sources?contentType=…&contentId=…` risponde
solo se il contenuto richiesto è pubblico.

Le quattro impostazioni `site.*` contengono soltanto identità e metadati
editoriali delle pagine e dei manifesti. L'endpoint
`GET /api/public/settings/site` esclude bozze, valori privati e chiavi tecniche;
URL del Worker, analytics e opzioni PWA operative non vengono importati in D1.

Dopo tutte le importazioni, `content_revisions_v1` crea la revisione iniziale
di ogni pagina, blocco, opera, canto, verso, voce di navigazione, schermata del
tour, impostazione, livello, geometria, fonte e tappa narrativa. Le revisioni
sono append-only e l'inizializzazione non le rigenera né le aggiorna ai deploy
successivi.

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

## 2. Pubblicazione automatica GitHub → Cloudflare

Il workflow `.github/workflows/deploy-cloudflare-worker.yml` pubblica il Worker
`nnmrcn-rete` a ogni modifica della cartella `worker/` sul branch `main`. Può
anche essere avviato manualmente dalla scheda **Actions** di GitHub. Il binding
D1 `DB`, l'origine consentita di GitHub Pages e i log sono definiti in
`wrangler.jsonc`.

La configurazione iniziale richiede due Secrets nel repository GitHub. Apri
**Settings** → **Secrets and variables** → **Actions** →
**New repository secret** e aggiungi:

- `CLOUDFLARE_API_TOKEN`: un token Cloudflare con il modello
  **Edit Cloudflare Workers**, limitato al solo account del progetto;
- `CLOUDFLARE_ACCOUNT_ID`: l'identificativo dell'account, copiabile da
  **Workers & Pages** → **Account Details**.

Il token non deve essere inserito nei file del repository né condiviso in
chat. Se i Secrets mancano, il workflow termina senza pubblicare e mostra un
avviso; dopo averli aggiunti, apri **Actions** →
**Pubblica il Worker Cloudflare** → **Run workflow** per il primo deploy.
Quelli successivi saranno automatici.

Il workflow distribuisce il codice ma non applica automaticamente l'intera
cronologia delle migrazioni D1, perché le installazioni esistenti potrebbero
averne già applicate alcune manualmente. Il Worker aggiorna in modo idempotente
lo schema necessario al primo accesso; le migrazioni esplicite restano
disponibili per la manutenzione controllata descritta nella sezione precedente.

Riferimenti ufficiali:

- [GitHub Actions per Cloudflare Workers](https://developers.cloudflare.com/workers/ci-cd/external-cicd/github-actions/)
- [Secrets di repository in GitHub Actions](https://docs.github.com/en/actions/how-tos/write-workflows/choose-what-workflows-do/use-secrets)
- [Creazione di un API token Cloudflare](https://developers.cloudflare.com/fundamentals/api/get-started/create-token/)

## 3. Configura i due segreti

Nel Worker apri **Settings** → **Variables and Secrets** → **Add**.

Crea due variabili di tipo **Secret**, copiando i valori esistenti dal file
privato `nnmrcn_worker_secrets_20260823.txt`:

- `ADMIN_TOKEN`;
- `PASSWORD_PEPPER`.

Non generare un nuovo `PASSWORD_PEPPER`: deve corrispondere alle location già
inserite nel database. Non pubblicare questi valori su GitHub.

Salva e seleziona **Deploy**.

## 4. Collegamento tra GitHub Pages e Worker

Il Worker del progetto è pubblicato a questo indirizzo:

```text
https://nnmrcn-rete.anonmrcn.workers.dev
```

Lo stesso indirizzo è configurato nel file `config.js`, senza barra finale:

```js
window.NNMRCN_API_BASE = "https://nnmrcn-rete.anonmrcn.workers.dev";
```

Verifica il Worker aprendo:

```text
https://nnmrcn-rete.anonmrcn.workers.dev/api/health
```

Deve comparire una risposta JSON con `"ok": true`. A quel punto completa
l’accesso dal menu del sito con uno dei codici privati delle 20 location.

### Registro dei permalink

`GET /api/public/permalinks/resolve?path=%2Fluogo.html%3Fluogo%3D1`
risolve un URL già pubblicato nel relativo contenuto D1. Il parametro `path`
deve iniziare con `/` e va codificato quando contiene query o frammenti. Il
registro include i link QR dei luoghi, ma non conserva mai chiavi o password
dei QR di accesso.

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

Le richieste di codice inviate dalla pagina del progetto richiedono un consenso
privacy esplicito e compaiono tra i messaggi diretti con username, email, zona
generica e, se selezionato, un collegamento al punto già approssimato. Non viene
salvato il numero civico né il punto esatto. La richiesta viene eliminata entro
30 giorni. Al momento della registrazione la location è nascosta per
impostazione predefinita; l’utente può mostrarla o nasconderla dal menu.

Nello stesso pannello è presente la moderazione delle memorie. Ogni contributo
parte nello stato `pending` e compare in `memorie.html` soltanto dopo
**Approva e pubblica**. Può contenere testo, un punto geografico e un solo
allegato JPEG, PNG, WebP, MP3, OGG, WebM o M4A, limitato a 900 KB. Le fotografie
vengono ridimensionate nel browser prima dell’invio.

Il consenso alla pubblicazione è obbligatorio. Dopo l’invio il browser conserva
un codice di ritiro con cui l’autore può controllare lo stato e cancellare la
memoria anche se è già pubblicata. Il codice non viene inviato all’admin e non
compare negli endpoint pubblici.

La sezione **Elenco dei luoghi** del pannello amministrativo consente inoltre
di scegliere un punto su una cartina, indicare nome, categoria, descrizione ed
eventuale fonte, pubblicare immediatamente una nuova voce e successivamente
modificarla, spostarla o eliminarla dalla mappa e dall’elenco testuale. Ogni
luogo può avere una fotografia facoltativa: il browser la riduce prima
dell’invio e il Worker la conserva separatamente dai dati testuali per usarla
come banner nella mini-spiegazione collegata al QR.

## Accesso speciale dal QR

La pagina `accesso.html` non è collegata dai menu e richiede uno dei token
contenuti nei QR prima di mostrare il campo della password. Il QR ordinario
accetta le password delle location e porta allo spazio personale; il QR del
sindaco accetta soltanto la password speciale e apre il relativo messaggio.
La password speciale genera una sessione dedicata e non autorizza gli endpoint
delle location, la mappa o lo spazio personale. Nel repository sono conservate
soltanto impronte SHA-256 di credenziali casuali ad alta entropia; i QR e la
password speciale in chiaro devono restare nei materiali privati consegnati.

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
