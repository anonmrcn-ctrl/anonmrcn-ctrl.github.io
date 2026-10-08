# CMS — 1. Confine tra contenuti e software

Questo documento stabilisce quali parti di anonMrcn devono poter essere gestite
dal pannello amministrativo e quali devono restare nel codice. È il contratto
di riferimento per le migrazioni successive: un elemento classificato come
contenuto non deve richiedere un commit Git per essere modificato o pubblicato.

## Regola di classificazione

È **contenuto** tutto ciò che descrive il progetto o il territorio e che può
cambiare senza modificare il funzionamento del sito: testi, versi, immagini,
fonti, coordinate, geometrie, ordine, visibilità, collegamenti e impostazioni
editoriali.

È **software** tutto ciò che determina come il sito funziona o protegge i dati:
componenti dell'interfaccia, rendering, validazione, autenticazione, permessi,
API, limiti tecnici, confronto cartografico, notifiche, accessibilità e grafica.

Le etichette operative generiche come «Salva», «Annulla» ed errori di
validazione restano software. I nomi propri delle sezioni, i testi introduttivi
e le voci del menu sono contenuti.

## Contenuti già amministrabili

| Area | Sorgente attuale | Stato |
|---|---|---|
| Luoghi e schede QR | `map_entries`, `map_entry_images` in D1 | Già gestibili dall'admin: testo, categoria, coordinate, fonte e banner |
| Voci di approfondimento | `wiki_entries`, revisioni e immagini in D1 | Già gestibili nell'editor delle Voci |
| Memorie degli abitanti | `memories` in D1 | Invio pubblico e moderazione amministrativa già presenti |
| Messaggi e archivio pubblico | `messages` in D1 | Flusso, consensi e moderazione già presenti |
| Profili delle location | `locations` e `poems` in D1 | Dati dinamici, ma amministrazione ancora tecnica |
| Messaggio per il sindaco | `mayor_message` in D1 | Dinamico, con accesso riservato |

Questi archivi non devono essere duplicati nel futuro CMS. Le nuove sezioni
amministrative devono riusare le API e gli identificativi già esistenti.

## Contenuti da estrarre dal codice

| Area editoriale | Dove si trova ora | Destinazione prevista | Priorità |
|---|---|---|---|
| Poesia e struttura dei canti | `poem_works`, `poem_sections` e `poem_lines` in D1, con ripiego in `index.html` | Poesia, sezioni e righe con identificativi stabili | Migrata |
| Percorso «Esplora la poesia» | `narrative_steps` in D1, con ripiego locale in `progetto.js` | Tappe ordinate, coordinate, versi, fonti e stato | Migrato e amministrabile |
| Presentazione del progetto | `site_pages` e `page_blocks` in D1, con ripiego in `progetto.html` | Pagina composta da blocchi | Migrata |
| Biografia e contatti editoriali | Testi in `site_pages` e `page_blocks`, ripiego in `autore.html`; recapiti ancora statici | Pagina composta da blocchi e impostazioni di contatto | Testi migrati; recapiti da migrare |
| Significato del logo | `site_pages` e `page_blocks` in D1, con ripiego in `logo.html` | Pagina composta da blocchi | Migrata |
| Testi di Spazio pubblico, Archivio, Memorie e Taccuino | `site_pages` e `page_blocks` in D1, con ripiego nei rispettivi file HTML | Pagine e testi introduttivi | Migrati |
| Tour e schermata di benvenuto | `sessione.js` (`WELCOME_FEATURES` e testi introduttivi) | Sequenza ordinata di schermate | Media |
| Menu, collegamenti e invito alla condivisione | menu ripetuto nei file HTML | Impostazioni globali e voci ordinate | Alta |
| Percorsi, livelli e geometrie | GeoJSON, `percorsi.js`, `marcon-da-sud.js`, `cave-rilevanti.js`, `fiumi-wikipedia.js` | Livelli cartografici, elementi e geometrie | Alta |
| Fonti e bibliografia | `progetto.js`, Voci e collegamenti sparsi | Archivio fonti riutilizzabile | Alta |
| Avvisi e testi di servizio specifici del progetto | HTML e JavaScript delle singole sezioni | Impostazioni o blocchi della pagina pertinente | Bassa |
| Informativa sulla privacy | `privacy.html` | Documento legale versionato con pubblicazione protetta | Bassa e protetta |
| Metadati del sito | titoli, descrizioni e manifesti nei file HTML/JSON | Impostazioni globali con valori predefiniti nel codice | Media |

L'inventario macchina leggibile in `content-inventory.json` assegna a ogni area
un identificativo, le sorgenti e la futura entità amministrabile.

## Elementi che restano software

- motore Leaflet, caricamento PMTiles e confronto 1975–oggi;
- apertura dei popup, geolocalizzazione, salvataggio locale e taccuino;
- componenti HTML, editor a blocchi e anteprime;
- login, sessioni, ruoli, token, passkey o Cloudflare Access;
- API, query D1, binding Cloudflare e distribuzione GitHub Actions;
- validazione, sanitizzazione, limiti di dimensione e frequenza;
- consensi, minimizzazione delle coordinate e regole di conservazione;
- notifiche push, service worker e comportamento offline;
- accessibilità, tema, impaginazione, tipografia e responsive design;
- logica di versionamento, bozze, pubblicazione, archiviazione e ripristino;
- diagnostica, esportazione, backup e controllo dei collegamenti.

I valori tecnici indispensabili al primo avvio possono avere un valore
predefinito nel repository, ma il valore editoriale attivo deve provenire dal
CMS quando la relativa area sarà migrata.

## Regole per gli identificativi

1. Ogni pagina, blocco, tappa, fonte, livello e risorsa multimediale riceve un
   identificativo interno immutabile.
2. Titoli e slug possono cambiare senza cambiare l'identificativo.
3. Gli URL già stampati o trasformati in QR non vengono riutilizzati per un
   altro contenuto.
4. Un contenuto collegato pubblicamente viene archiviato o reindirizzato, non
   eliminato definitivamente.
5. Le relazioni usano identificativi, non confronti sul titolo. L'abbinamento
   automatico attuale tra nome del luogo e voce resta soltanto una compatibilità
   temporanea.

## Proprietà e pubblicazione

| Tipo | Chi può modificarlo | Pubblicazione |
|---|---|---|
| Contenuto editoriale ordinario | Amministratore | Bozza, anteprima, pubblicazione |
| Contributo degli abitanti | Autore per l'invio; amministratore per la moderazione | Solo dopo approvazione e consenso |
| Impostazione globale | Amministratore | Conferma esplicita e anteprima dell'effetto |
| Documento legale | Amministratore autorizzato | Nuova versione datata, senza sovrascrivere la precedente |
| Software | Sviluppatore tramite Git | Test e distribuzione |

## Ordine di migrazione risultante

1. Fondazioni D1 comuni: pagine, blocchi, impostazioni, fonti e revisioni.
2. Percorso poetico e relativa bibliografia.
3. Testi delle pagine e menu globale.
4. Livelli cartografici, percorsi e geometrie.
5. Tour iniziale, metadati e contenuti di servizio.
6. Documento privacy protetto.

La prima migrazione deve conservare integralmente i contenuti correnti e
prevedere un valore locale di ripiego: il sito pubblico non deve diventare
vuoto se l'API del CMS è temporaneamente irraggiungibile.

La fondazione comune è definita dalla migrazione
`worker/migrations/0013_cms_content_foundation.sql`. L’archivio poetico
editoriale usa `poem_works` per non confondersi con la tabella storica `poems`,
che contiene le poesie private associate alle location e non deve essere
duplicata né reinterpretata.

## Criterio di completamento del passaggio 1

Il passaggio è concluso quando ogni contenuto attuale appartiene a una riga
dell'inventario, ogni area ha una destinazione futura e nessun dato già gestito
da D1 viene duplicato. Qualsiasi nuovo testo specifico di anonMrcn dovrà essere
aggiunto all'inventario oppure dichiarato esplicitamente come microtesto
software.
