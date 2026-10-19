# Punto 14 — anteprima, media, audio e video nel builder visuale

Aggiornato il 18 ottobre 2026. Questa estensione nasce da tre problemi
riscontrati nell'uso reale del CMS a blocchi:

- l'anteprima non rappresenta le modifiche correnti della pagina;
- dall'ispettore dei blocchi non è possibile scegliere o caricare media;
- il catalogo dei blocchi non comprende audio e video configurabili senza codice.

Il punto 13 resta completo nel perimetro verificato dal relativo audit. Il
punto 14 registra e risolve separatamente le regressioni e l'ampliamento
emersi dopo la chiusura, senza retrocedere le unità 13.0–13.12.

## Obiettivo

L'amministratore deve poter vedere fedelmente una modifica prima di
pubblicarla e aggiungere immagini, gallerie, audio e video usando soltanto il builder
visuale. Il flusso deve riutilizzare il catalogo D1 e lo storage R2 esistenti,
senza richiedere URL tecnici, chiavi R2, HTML o JavaScript.

## Diagnosi iniziale verificata

- L'anteprima locale corrente è una rappresentazione semplificata e non usa
  il renderer completo. L'anteprima server, invece, viene richiesta soltanto
  quando la pagina non contiene modifiche locali e legge lo snapshot già
  salvato. Di conseguenza una pagina modificata può non mostrare il risultato
  effettivo che si sta preparando.
- Il contratto dei blocchi comprende `image` e `gallery`, ma l'ispettore non
  espone un selettore per `assetId` né un collegamento operativo alla libreria
  media R2. I blocchi possono quindi esistere nel modello senza essere
  compilabili interamente dall'interfaccia.
- Il registro e il renderer non comprendono ancora blocchi `audio` e `video`.

Questa diagnosi è il punto di partenza; i test di regressione dell'unità 14.1
devono riprodurre i problemi prima di correggerli.

## Principi non negoziabili

1. L'anteprima deve usare lo stato di lavoro corrente e non pubblicare né
   rendere indicizzabile una bozza.
2. Il builder riusa catalogo, permessi, varianti e retention dei media D1/R2
   già esistenti; non crea un secondo archivio parallelo.
3. L'amministratore sceglie, carica, sostituisce e scollega un media senza
   conoscere URL o identificativi tecnici.
4. Nessun media referenziato da pagine, revisioni, QR, alias o pubblicazioni
   può essere cancellato producendo contenuti mancanti.
5. Immagini, audio e video richiedono metadati accessibili pertinenti; gli errori
   devono essere spiegati prima della pubblicazione.
6. Audio e video non avviano riproduzione o tracciamento senza una scelta
   esplicita. Embed di terze parti e script arbitrari restano esclusi dai
   blocchi base.
7. Anteprima, bozze, pannello e media non pubblicati restano autenticati,
   `noindex`, fuori dalla sitemap e non memorizzabili in cache pubblica.
8. Ogni unità conserva URL, ID, revisioni, ripieghi, privacy, accessibilità,
   SEO e budget prestazionali definiti nei punti precedenti.

## Ordine vincolante

| Unità | Risultato | Stato | Dipendenza |
|---:|---|---|---|
| 14.0 | Roadmap, diagnosi e controllo automatico | Completa | Punto 13 |
| 14.1 | Anteprima fedele delle modifiche correnti | Completa | 14.0 |
| 14.2 | Selettore della libreria media nei blocchi | Completa | 14.1 |
| 14.3 | Caricamento e gestione media dal builder | Completa | 14.2 |
| 14.4 | Blocco audio accessibile e responsive | Completa | 14.3 |
| 14.5 | Blocco video accessibile e responsive | Completa | 14.4 |
| 14.6 | Pubblicazione, diagnostica e audit end-to-end | Completo | 14.5 |

I criteri eseguibili e lo stato corrente sono in
`docs/cms/visual-media-roadmap.json`. Dopo ogni unità si aggiornano insieme il
file JSON, questa tabella e `docs/cms/progress.md`.

## Criteri delle unità

### 14.1 — Anteprima fedele

L'anteprima autenticata deve renderizzare l'albero e le proprietà correnti,
comprese le modifiche non ancora pubblicate, usando lo stesso renderer sicuro
del sito. Deve funzionare nelle viste smartphone, tablet e desktop e mostrare
errori comprensibili senza perdere il lavoro. Salvataggio della bozza e
pubblicazione restano azioni distinte.

Completata il 18 ottobre 2026. Il browser invia al Worker l'albero, le
proprietà e i metadati correnti con una richiesta autenticata, senza salvarli;
il Worker li valida e li rende in memoria con lo stesso renderer sicuro del
sito. La risposta imposta `no-store`, `X-Robots-Tag: noindex, nofollow` e
metadati `noindex,nofollow`. La prova automatica copre una proprietà modificata
e un blocco appena aggiunto, verifica che D1 e la pagina pubblica restino
immutati e controlla nel browser che il pulsante funzioni anche con modifiche
non salvate e nelle viste responsive. Dettagli e comandi ripetibili sono in
`14-1-live-preview.md`.

### 14.2 — Selezione dei media

L'ispettore di `image` e `gallery` deve aprire la libreria esistente, consentire
ricerca, filtro, selezione, sostituzione, riordino e rimozione e mostrare
miniatura e metadati. Testo alternativo, didascalia, credito e punto focale
devono essere gestibili nello stesso flusso con validazione contestuale.

Completata il 18 ottobre 2026. L'ispettore apre una finestra accessibile con
ricerca, filtro per origine, miniature, metadati e comandi a pulsante per
selezionare, sostituire, rimuovere e riordinare. Le immagini usano riferimenti
`asset` reali al catalogo corrente D1/R2; la galleria conserva l'ordine come
righe normalizzate, non come URL o JSON opaco. Il blocco immagine gestisce
anche alt, didascalia, credito e punto focale. Il Worker esclude asset ritirati,
varianti tecniche e documenti, e rifiuta gallerie con media privi di testo
alternativo. Prove e comandi sono in `14-2-media-picker.md`.

### 14.3 — Caricamento dal builder

Il builder deve caricare file ammessi in R2, registrarli nel catalogo D1,
mostrare avanzamento ed errori e collegare il risultato al blocco senza un
passaggio tecnico separato. Tipo, dimensione, checksum, quota, varianti,
annullamento e gestione sicura degli oggetti orfani devono essere verificati.

Completata il 19 ottobre 2026. La libreria accetta JPEG, PNG e WebP fino a 8
MB, richiede il testo alternativo, genera varianti responsive e mostra
avanzamento, annullamento ed errori accessibili. Il Worker ricontrolla firma,
dimensioni, metadati, quota e integrità, calcola SHA-256, scrive nel bucket R2
privato e registra gli oggetti nello stesso catalogo `media_assets`. Il media
viene collegato al blocco corrente senza URL o identificativi; finché non
compare in uno snapshot pubblicato richiede autenticazione, `no-store` e
`noindex`. Dettagli e prove sono in `14-3-media-upload.md`.

### 14.4 — Audio no-code

Il registro deve introdurre un blocco `audio` con sorgente dal catalogo,
copertina opzionale, titolo, descrizione, trascrizione, controlli e
precaricamento dichiarativo. La resa deve essere responsive, supportare
richieste HTTP Range e formati esplicitamente ammessi, non avviare autoplay e
fornire una trascrizione accessibile. I dati strutturati pertinenti sono
prodotti soltanto per pagine pubblicate e indicizzabili con metadati completi.

Completata il 19 ottobre 2026. Il catalogo, il renderer e l'ispettore includono
il blocco `audio`; la libreria protetta permette scelta e upload nello stesso
catalogo D1/R2 con titolo, descrizione, copertina e trascrizione. La resa usa
controlli nativi responsive senza autoplay e supporta HTTP Range sia in
anteprima autenticata sia, dopo la pubblicazione, con cache pubblica. La
migrazione conserva nodi e proprietà precedenti; test dedicati coprono firme e
formati ammessi, privacy, intervalli validi e non validi, audit di
pubblicazione e `AudioObject` limitato alle pagine indicizzabili. Dettagli e
comandi ripetibili sono in `14-4-audio-block.md`.

### 14.5 — Video no-code

Il registro deve introdurre un blocco `video` con sorgente dal catalogo,
poster, titolo, descrizione o trascrizione, tracce di sottotitoli, controlli,
precaricamento e opzioni dichiarative validate. La resa deve essere responsive,
supportare richieste HTTP Range e formati esplicitamente ammessi, non usare
autoplay sonoro e rispettare reduced motion. I dati strutturati `VideoObject`
sono prodotti soltanto per pagine pubblicate e indicizzabili quando i
metadati obbligatori sono presenti.

Completata il 19 ottobre 2026. Il catalogo, il renderer e l'ispettore includono
il blocco `video`; lo stesso flusso protetto consente upload e scelta di MP4 o
WebM, immagine poster e sottotitoli WebVTT. La resa usa controlli nativi,
`playsinline`, poster e traccia `captions`, senza autoplay o servizi esterni.
Range HTTP, privacy prima della pubblicazione, migrazione D1 conservativa e
`VideoObject` limitato alle pagine indicizzabili sono coperti dai test.
Dettagli e comandi ripetibili sono in `14-5-video-block.md`.

### 14.6 — Prova completa

Un test da smartphone e desktop deve modificare una bozza, verificarla in
anteprima, scegliere e caricare immagini, creare una galleria, aggiungere un
audio con trascrizione e un video con poster e sottotitoli, pubblicare e
controllare la pagina autonoma.
L'audit deve coprire ripristino, riferimenti R2, canonical, sitemap,
accessibilità, privacy, prestazioni e assenza di bozze o media privati dagli
indici pubblici.

Completata il 19 ottobre 2026. La diagnostica amministrativa ora ricostruisce
le bozze, verifica riferimenti e metadati di immagini, gallerie, audio e video
e applica un controllo vincolante agli snapshot pubblicati. L’audit Playwright
percorre selezione e anteprima di tutti i media sia a 375 px sia a 1440 px; la
suite Worker copre upload, D1/R2, Range, pubblicazione atomica, revisioni e
ripristino. Contratto, matrice delle prove e comandi sono in
`14-6-visual-media-final-audit.md`.

## Criterio finale

Il punto 14 è completo soltanto quando l'intero percorso anteprima → media →
audio → video → pubblicazione è eseguibile dall'interfaccia a blocchi, senza
codice e senza manipolare identificativi tecnici, ed è provato da test
automatici, build, verifica browser e verifica dei servizi pubblicati.
