# 13.6 — ispettore visuale e anteprima responsive

Completata il 17 ottobre 2026. Il canvas espone ora un ispettore generato dal
contratto del blocco selezionato e un'anteprima immediata per smartphone,
tablet e desktop. Il flusso ordinario non mostra né accetta HTML, CSS,
JavaScript, SQL, binding o identificativi tecnici modificabili.

## Proprietà disponibili

Lo schema `VISUAL_INSPECTOR_SCHEMAS` deriva le proprietà modificabili dagli
insiemi autorizzati nel registro v1. In base al tipo di blocco, il pannello
presenta campi comprensibili per contenuto, collegamenti, allineamento,
larghezza, spaziatura, carattere, dimensione, colore del testo, sfondo, bordo,
angoli e visibilità per ciascun breakpoint. I valori grafici sono token
enumerati: non esiste un campo CSS libero.

L'anteprima viene costruita con elementi DOM e `textContent`, usa la stessa
mappatura di attributi del renderer pubblico e permette di confrontare 360 px,
tablet e larghezza desktop. La modifica di un controllo aggiorna subito la
vista; i blocchi appena aggiunti richiedono prima il salvataggio strutturale,
così ricevono un ID generato dal Worker.

## Validazione e sicurezza

L'endpoint autenticato
`PATCH /api/admin/cms/visual-properties/:pageId/:nodeId` applica un controllo
di concorrenza con `expectedUpdatedAt` e valida nuovamente ogni valore sul
server. Vengono rifiutati:

- proprietà non previste dallo schema del blocco;
- opzioni fuori catalogo e URL non HTTPS/locali/email/telefono/ancora;
- testo oltre i limiti dichiarati o immagini senza testo alternativo;
- un blocco nascosto contemporaneamente su smartphone, tablet e desktop;
- combinazioni di testo e sfondo con contrasto inferiore a 4,5:1.

Il salvataggio sostituisce soltanto le proprietà appartenenti allo schema
visuale del nodo. Binding, sicurezza, riferimenti tecnici, contenuti degli
altri nodi, URL, QR, alias, geometrie e media restano invariati. La baseline è
conservata prima della prima modifica e ogni salvataggio aggiunge una revisione
`visual_tree` completa e append-only.

Il renderer pubblico emette soltanto attributi `data-visual-*` presi da liste
consentite. Non genera attributi `style`, non interpreta codice e continua a
esporre soltanto alberi pubblicati; pagine private, bozze e pannello mantengono
le esclusioni SEO esistenti.

## Prove ripetibili

```sh
node --test worker/tests/visual-builder-inspector.test.mjs
node --test worker/tests/visual-builder-canvas.test.mjs
node --test worker/tests/visual-builder-renderer.test.mjs
node scripts/check-no-code-roadmap.mjs
node --test worker/tests/*.test.mjs
npx --yes wrangler@4 deploy --dry-run
```

Le prove verificano schema esposto, assenza delle proprietà tecniche,
persistenza tipizzata, revisione, controllo di concorrenza, resa pubblica senza
stili arbitrari, rifiuto di URL e valori non validi, contrasto, visibilità,
testo alternativo, campi generati dal contratto e tre modalità responsive.
