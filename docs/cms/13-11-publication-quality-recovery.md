# 13.11 — Pubblicazione, qualità e recupero

Aggiornato il 18 ottobre 2026.

## Risultato

La bozza visuale modificabile non è più la sorgente letta direttamente
dall'endpoint pubblico. `visual_tree_publications` conserva la fotografia
pubblicata corrente, mentre `content_revisions` mantiene tutte le versioni
append-only. Salvare struttura o proprietà porta l'albero in bozza senza
cambiare la fotografia visibile; soltanto la pubblicazione esplicita sostituisce
lo snapshot pubblico nella stessa transazione D1.

Questo elimina la finestra in cui un salvataggio parziale poteva diventare
visibile prima dei controlli. Le pagine già pubblicate sono inizializzate in
modo idempotente dalla loro fotografia corrente, senza cambiare URL, ID,
contenuti o revisioni esistenti.

## Flusso amministrativo no-code

La sezione «Controlla, confronta e pubblica» offre:

- preflight con errori e avvisi riferiti al blocco interessato;
- anteprima autenticata, `no-store` e sempre `noindex,nofollow`;
- confronto con l'ultima fotografia pubblica (aggiunti, rimossi, modificati);
- pubblicazione atomica con controllo di concorrenza;
- elenco delle revisioni complete e ripristino come nuova bozza;
- undo e redo locali prima del salvataggio del canvas.

Il ripristino non modifica lo snapshot pubblico e non riscrive una revisione
precedente: crea una nuova revisione in bozza, che deve essere controllata e
pubblicata esplicitamente.

## Controlli preventivi

`worker/src/visual-publication.js` verifica prima della pubblicazione:

- struttura, annidamento e proprietà registrate dal renderer;
- titolo e descrizione SEO;
- testo alternativo e disponibilità dei media R2 referenziati;
- sicurezza di collegamenti, ancore, filtri e riferimenti pagina;
- consenso obbligatorio, assenza di servizi esterni e telemetria disattivata;
- dimensione dello snapshot e complessità dell'albero.

Un errore blocca la transazione e restituisce categoria, messaggio e, quando
disponibile, ID del blocco. Gli avvisi non nascondono il rischio ma consentono
la pubblicazione quando non compromettono sicurezza o integrità.

## API e persistenza

- `GET /api/admin/cms/visual-publication/:pageId`
- `GET /api/admin/cms/visual-preview/:pageId`
- `PATCH /api/admin/cms/visual-publication/:pageId/publish`
- `POST /api/admin/cms/visual-publication/:pageId/restore/:revision`
- `GET /api/public/visual-pages/:slug` legge soltanto lo snapshot pubblicato

La migrazione append-only è
`worker/migrations/0021_visual_publications.sql`. La nuova tabella è inclusa
anche nello schema runtime, nello schema completo e nei backup CMS privi di
credenziali e dati personali operativi.

## Prove ripetibili

`worker/tests/visual-publication.test.mjs` prova che:

1. una bozza con collegamento non sicuro è indicata per blocco, viene rifiutata
   e lascia identico l'HTML pubblico;
2. l'anteprima autenticata mostra la bozza con `noindex,nofollow`;
3. una versione valida diventa pubblica soltanto con l'azione atomica;
4. il checksum SHA-256 e il numero di revisione identificano la pubblicazione;
5. il ripristino aggiunge una nuova revisione in bozza, mantiene intatta la
   cronologia e non cambia il sito pubblico;
6. il pannello espone preflight, anteprima, confronto, redo e recupero.

Verifica completa:

```bash
node scripts/check-no-code-roadmap.mjs
node scripts/check-content-boundary.mjs
node scripts/check-seo.mjs
node scripts/check-privacy.mjs
node scripts/check-performance.mjs
node --test scripts/*.test.mjs worker/tests/*.test.mjs
cd worker && npx wrangler deploy --dry-run
```

Esito del 18 ottobre 2026: tutti i validatori sono riusciti, la suite completa
ha superato **180 test su 180** e il dry-run Wrangler ha prodotto un Worker da
683,49 KiB (131,43 KiB gzip) con binding D1 e R2 riconosciuti.
