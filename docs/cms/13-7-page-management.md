# 13.7 — gestione completa delle pagine

Completata il 18 ottobre 2026. Il pannello visuale permette ora di creare una
pagina vuota, duplicare una pagina esistente, modificarne titolo, descrizione,
slug, navigazione e stato editoriale, archiviarla, recuperarla e richiederne la
cancellazione definitiva senza usare codice o intervenire nel repository.

## Creazione e ciclo di vita

`POST /api/admin/cms/visual-pages` crea in D1 una pagina in bozza con ID, albero
e nodi generati dal Worker. Registra subito canonical, permalink attivo,
baseline di pagina e albero e, se richiesto, una voce di menu ancora in bozza.
La partenza può essere vuota oppure una copia completa di un albero esistente:
i nuovi blocchi ricevono ID distinti, mentre contenuti e proprietà consentite
vengono copiati senza cambiare la sorgente.

`PATCH /api/admin/cms/visual-page-lifecycle/:pageId` gestisce rinomina, slug,
descrizione SEO, bozza, pubblicazione, archiviazione e recupero. Il cambio di
slug trasforma l'URL precedente in un redirect e registra il nuovo permalink
attivo. Menu, pagina e albero cambiano stato insieme; il salvataggio usa la
versione più recente tra pagina e albero per impedire sovrascritture anche dopo
una modifica del canvas o dell'ispettore. Ogni transizione aggiunge revisioni
append-only della pagina e dell'albero.

## Eliminazione senza collegamenti morti

`GET /api/admin/cms/visual-page-dependencies/:pageId` mostra prima di eliminare:

- permalink e alias che verranno conservati;
- collegamenti di navigazione;
- riferimenti provenienti da altri alberi visuali;
- fonti e dati collegati;
- sezioni riutilizzabili dipendenti dall'albero.

La cancellazione definitiva è disponibile soltanto per pagine create dal
builder e già archiviate. Richiede una frase di conferma esatta e un permalink
attivo di destinazione appartenente a un altro contenuto. Riferimenti, fonti o
sezioni riutilizzabili bloccano l'operazione finché non vengono riassegnati. Le
pagine storiche possono essere archiviate ma non eliminate dal builder.

Quando i controlli sono superati, `DELETE /api/admin/cms/visual-pages/:pageId`
rimuove soltanto lo stato corrente della pagina e dell'albero. Tutti i
permalink, inclusi vecchi slug e alias usati da QR o link entranti, rimangono in
D1 come redirect verso la destinazione scelta; le revisioni restano
immutabili e disponibili per audit. Le bozze e le pagine archiviate continuano
a essere escluse dall'endpoint pubblico e quindi dall'indicizzazione.

## Prove ripetibili

```sh
node --test worker/tests/visual-page-management.test.mjs
node --test worker/tests/visual-builder-canvas.test.mjs
node --test worker/tests/visual-builder-inspector.test.mjs
node scripts/check-no-code-roadmap.mjs
node --test worker/tests/*.test.mjs
(cd worker && npx --yes wrangler@4 deploy --dry-run)
```

Le prove coprono autorizzazione, creazione vuota, duplicazione con nuovi ID,
rinomina, canonical, descrizione SEO, navigazione opzionale, pubblicazione,
archiviazione, recupero, concorrenza dopo modifiche del canvas, analisi delle
dipendenze, blocco dei dati collegati, conferma esplicita, destinazione valida,
redirect di tutti gli URL e permanenza delle revisioni dopo la cancellazione.
