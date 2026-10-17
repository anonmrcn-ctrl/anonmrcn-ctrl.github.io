# 13.5 — canvas visuale a blocchi

Completata il 17 ottobre 2026. Il pannello amministrativo comprende ora
«Componi la pagina a blocchi»: una vista responsive della gerarchia D1 che non
mostra HTML, CSS, JavaScript, SQL, ID tecnici modificabili o proprietà
`technical.*`.

## Operazioni visuali

L'amministratore sceglie una delle nove pagine e può:

- aggiungere uno dei tipi sicuri del registro dalla palette in linguaggio
  comprensibile;
- selezionare un blocco e spostarlo prima o dopo i fratelli;
- annidarlo nel blocco precedente o riportarlo al livello superiore;
- duplicare un intero sottoalbero, incluse le proprietà autorizzate;
- rimuovere un sottoalbero dalla copia di lavoro;
- annullare fino a 30 operazioni prima del salvataggio.

Il trascinamento riordina i blocchi allo stesso livello con il mouse. Gli stessi
spostamenti sono disponibili tramite pulsanti da almeno 44 px, utilizzabili con
tocco e tastiera; `Alt` + frecce è una scorciatoia aggiuntiva. La struttura usa
ruoli `tree`/`treeitem`, stato di selezione, focus visibile ed etichette testuali.
Su smartphone barra degli strumenti, azioni e salvataggio passano a una sola
colonna. Se si lascia la pagina con modifiche non salvate compare un avviso.

## Salvataggio e recuperabilità

Le API autenticate sono:

- `GET /api/admin/cms/visual-pages`, che restituisce pagine, gerarchia e palette
  ma non valori tecnici;
- `PATCH /api/admin/cms/visual-pages/:pageId`, che salva l'intera struttura con
  controllo di concorrenza tramite `expectedUpdatedAt`.

Il Worker accetta al massimo 400 nodi, una sola radice immutabile, posizioni
consecutive e soltanto tipi, profondità e annidamenti del registro v1. Gli ID
esistenti non cambiano; quelli nuovi sono generati lato Worker. La duplicazione
copia proprietà tipizzate già validate, comprese le associazioni sicure degli
adattatori, senza accettare proprietà dal browser.

Ogni modifica D1 avviene in una transazione. Prima del primo cambiamento viene
salvata la baseline completa e dopo ogni salvataggio viene aggiunta una
revisione `visual_tree` con nodi e proprietà. Rimozione e sostituzione restano
quindi distinguibili e recuperabili nelle unità di pubblicazione e ripristino.
Un aggiornamento basato su una versione superata restituisce `409` senza
sovrascrivere il lavoro più recente.

## Compatibilità

La composizione modifica soltanto l'albero visuale. `site_pages`, `page_blocks`,
contenuti specializzati, permalink, QR, alias, geometrie, media R2 e pagine HTML
statiche non vengono riscritti. Il renderer pubblico continua a controllare
stato, proprietà e contenuto; bozze e aree private mantengono le esclusioni SEO
già definite.

## Prove ripetibili

```sh
node --test worker/tests/visual-builder-canvas.test.mjs
node --test worker/tests/visual-builder-renderer.test.mjs
node scripts/check-no-code-roadmap.mjs
node --test worker/tests/*.test.mjs
npx --yes wrangler@4 deploy --dry-run
```

I test provano autorizzazione, assenza delle proprietà tecniche, aggiunta,
spostamento, annidamento, duplicazione con proprietà, rimozione, baseline,
revisione, rendering successivo, conflitto di concorrenza e rifiuto di radici,
tipi e gerarchie non valide. Le verifiche statiche coprono selezione, focus,
trascinamento, azioni equivalenti, annullamento, avviso di uscita e layout
mobile.
