# Manuale dell'amministratore di anonMrcn

Questo manuale descrive le operazioni ordinarie senza richiedere modifiche al
codice. Il pannello è disponibile all'indirizzo
`https://anonmrcn-ctrl.github.io/admin.html`.

## 1. Accesso e uscita

1. Aprire il pannello sul dispositivo che conserva la passkey.
2. Premere «Accedi con passkey» e confermare con il metodo proposto dal
   dispositivo.
3. Al termine del lavoro premere «Esci» nella sezione «Sessione
   amministrativa».

La sessione dura al massimo otto ore ed è conservata soltanto nella scheda del
browser. Il vecchio token non consente più l'accesso. Se l'unica passkey viene
persa, non esiste un recupero via email: occorre usare la procedura
infrastrutturale descritta in `07-admin-passkeys.md`.

## 2. Regola generale prima di modificare

- Usare **bozza** finché testo, fonti, immagini e metadati non sono pronti.
- Aprire l'anteprima autenticata e controllare il risultato prima di
  pubblicare.
- Non cambiare gli identificativi o i percorsi permanenti per correggere un
  titolo: titolo, slug e URL hanno funzioni differenti.
- Se il pannello segnala un conflitto, non insistere: ricaricare, confrontare le
  modifiche e applicarle alla versione più recente.

Ogni salvataggio crea una revisione. «Cronologia e ripristino» consente di
confrontare due versioni e di ripristinarne una senza cancellare la storia.

## 3. Pagine, poesia, menu e benvenuto

Nelle sezioni corrispondenti:

1. scegliere la pagina o l'elemento;
2. modificare soltanto i campi mostrati;
3. impostare lo stato editoriale;
4. premere il pulsante di salvataggio;
5. verificare il messaggio di conferma e poi l'anteprima.

Ordine, ancore, identificativi e collegamenti tecnici vengono conservati dal
sistema. «Ricarica senza salvare» scarta quanto scritto dopo l'ultimo
caricamento.

## 4. Mappa, luoghi e geometrie

I livelli stabiliscono gruppo, nome, descrizione e stile; le geometrie sono i
singoli punti, percorsi o poligoni. Prima di pubblicare una geometria verificare:

- livello corretto;
- titolo e descrizione comprensibili;
- coordinate o GeoJSON validi;
- fonti collegate;
- assenza di informazioni personali non necessarie.

Gli elementi storici archiviati non vanno ripubblicati per errore. Gli URL dei
luoghi e i QR dipendono dagli identificativi: non crearne di nuovi per sostituire
una scheda esistente.

## 5. Fonti e metadati SEO

Per ogni affermazione storica usare «Fonti» e distinguere documento,
testimonianza e interpretazione. Prima di pubblicare controllare che URL, autore,
titolo e data siano corretti.

In «Metadati SEO e anteprima sociale»:

- il title deve identificare la pagina senza duplicare quello di un'altra;
- la descrizione deve riassumere il contenuto reale;
- l'immagine sociale deve essere HTTPS, pertinente e accompagnata da testo
  alternativo nel relativo contenuto;
- una bozza o pagina privata non deve essere resa indicizzabile.

Canonical, sitemap e dati strutturati sono generati dal sistema e non vanno
inseriti manualmente nei testi.

## 6. Permalink e QR

Un permalink pubblicato non si rinomina e non si elimina. Se cambia il percorso
preferito, mantenere quello precedente come reindirizzamento verso un percorso
già registrato. Dopo ogni modifica aprire sia l'URL preferito sia almeno un URL
storico o QR noto.

Non inserire nei permalink token, password o parametri segreti. I frammenti e le
query storiche già registrati devono continuare a funzionare.

## 7. Fotografie, media e documenti

Per le immagini compilare sempre testo alternativo e, quando serve, didascalia.
Il sistema conserva l'originale in R2 e genera le varianti responsive e sociali.
Dopo la pubblicazione controllare l'immagine nella pagina e nell'anteprima
sociale.

I documenti sono privati e scaricabili soltanto durante una sessione
amministrativa. Prima del caricamento:

- scegliere un titolo riconoscibile;
- descrivere contenuto e finalità;
- indicare se accessibilità, testo ricercabile e lingua sono stati verificati;
- evitare dati personali non necessari.

La sostituzione conserva la versione precedente; la cancellazione elimina
metadati e versioni R2 del documento selezionato.

## 8. Backup ordinario

Eseguire «Scarica backup CMS»:

- almeno una volta al mese;
- prima di modifiche numerose;
- prima di un ripristino;
- dopo una pubblicazione particolarmente importante.

Il download termina soltanto se D1 e R2 sono coerenti. Il file contiene bozze e
documenti privati: conservarlo cifrato, non inviarlo per email e non caricarlo
su GitHub o altri spazi pubblici. Annotare la data e mantenere almeno l'ultimo
backup verificato e quello precedente.

Messaggi, contatti, indirizzi, credenziali e sessioni sono esclusi. Il loro
backup completo richiede l'accesso Cloudflare ed è descritto in
`08-maintenance-diagnostics.md`.

## 9. Verifica e ripristino

1. Scaricare prima un backup dello stato corrente.
2. Aprire «Verifica o ripristina un backup».
3. Scegliere il file e premere «Verifica backup».
4. Controllare data, numero di righe D1 e oggetti R2 mostrati.
5. Procedere soltanto se il file e la data sono quelli attesi.
6. Copiare esattamente la frase `RIPRISTINA …` indicata dal pannello.
7. Confermare la finestra finale e attendere senza chiudere la pagina.
8. Ricaricare il pannello, eseguire la diagnostica e controllare manualmente le
   pagine modificate.

Il ripristino sostituisce il contenuto CMS in D1 ma conserva i vecchi oggetti R2
come rete di sicurezza. Non usare il ripristino per annullare una singola
modifica: per quello è preferibile la cronologia delle revisioni.

## 10. Diagnostica

Premere «Esegui diagnostica». Gli esiti significano:

- **superato**: il controllo non ha trovato incoerenze;
- **avviso**: il sistema funziona, ma una parte eccede il controllo rapido o
  richiede valutazione;
- **errore**: non pubblicare altre modifiche finché la causa non è risolta.

La diagnostica controlla D1, R2, Worker, manifest, sitemap, robots, pagine,
canonical, collegamenti e immagini. Non visualizza contenuti privati. In caso di
errore salvare il testo del controllo e la data, senza copiare token o contenuti
riservati.

## 11. Calendario di manutenzione

| Frequenza | Operazione |
|---|---|
| Dopo ogni pubblicazione | Aprire la pagina, controllare canonical e immagine, poi eseguire la diagnostica |
| Settimanale | Eseguire la diagnostica e risolvere errori o link non riconosciuti |
| Mensile | Scaricare e conservare un nuovo backup CMS verificato |
| Trimestrale | Provare un ripristino in ambiente non produttivo e rivedere accessi, retention e servizi esterni |
| Annuale | Riesaminare informativa privacy, fonti, contenuti obsoleti e procedure di recupero |

## 12. Segnalazioni che richiedono cautela

| Messaggio | Azione |
|---|---|
| Sessione scaduta | Accedere nuovamente con la passkey; non usare il vecchio token |
| Conflitto di modifica | Ricaricare e confrontare prima di salvare |
| Oggetto R2 mancante o checksum errato | Non ripristinare né pubblicare; conservare il rapporto diagnostico |
| Manifest non allineato a D1 | Attendere o controllare la pubblicazione automatica delle pagine |
| Canonical, sitemap o pagina in errore | Non cambiare URL o QR; correggere la pubblicazione mantenendo i percorsi |
| Passkey perduta | Usare soltanto il recupero Cloudflare documentato; non cancellare altre tabelle |

## 13. Privacy essenziale

- Raccogliere solo ciò che serve alla funzione richiesta.
- Non copiare dati privati in titoli, URL, sitemap, metadati sociali o
  diagnostica.
- Non pubblicare una Memoria o un messaggio senza i consensi previsti.
- Non trasferire backup e documenti privati a servizi pubblicitari o strumenti
  di analisi.
- Usare Search Console e dati aggregati per il monitoraggio SEO.
- Uscire dal pannello sui dispositivi condivisi e non condividere la passkey.
