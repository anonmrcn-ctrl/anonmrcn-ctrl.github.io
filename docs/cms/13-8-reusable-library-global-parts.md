# 13.8 — modelli, sezioni riutilizzabili e parti globali

Completata il 18 ottobre 2026. Il pannello visuale comprende una libreria per
salvare, duplicare, inserire, aggiornare, pubblicare e scollegare blocchi e
parti globali senza modificare codice. Le pagine esistenti restano inoltre
disponibili nel selettore di creazione come modelli completi e non vengono
alterate quando se ne crea una copia.

## Libreria visuale

Dal canvas si seleziona un blocco interno e lo si salva con un nome. Il Worker
crea un albero D1 autonomo in `visual_reusable_sections`, copia nodi e proprietà
con nuovi ID e registra la prima revisione. La libreria accetta sezioni
ordinarie e i blocchi registrati `global-header`, `menu`, `global-footer` e
`global-notice`: si costruiscono e personalizzano con lo stesso canvas e lo
stesso ispettore tipizzato già validato nelle unità 13.5–13.6.

Ogni elemento può essere duplicato come nuova bozza. L'inserimento offre due
scelte esplicite:

- **collegata**, per ricevere le future pubblicazioni della parte comune;
- **copia indipendente**, per partire dal modello e poi modificarlo senza
  dipendenze.

Una copia collegata può essere scollegata in qualsiasi momento: nodi,
proprietà, ID locali e contenuti restano nella pagina, mentre viene rimosso
soltanto il legame con la libreria.

## Impatto e pubblicazione

I collegamenti sono record normalizzati in `visual_reusable_instances`,
aggiunti in modo append-only dalla migrazione `0020`. Il pannello non abilita
«Pubblica e sincronizza» finché l'amministratore non ha richiesto l'analisi
dell'impatto, che elenca pagina, stato e numero di inserimenti interessati.

La pubblicazione avviene in un'unica transazione D1: aggiorna la parte di
libreria, sostituisce soltanto i sottoalberi collegati, conserva posizione e ID
della radice di ciascuna istanza e aggiunge revisioni append-only agli alberi
coinvolti. Le copie indipendenti e quelle scollegate non vengono toccate. Una
pagina pubblicata non può ricevere una parte ancora in bozza; l'eliminazione di
una pagina con istanze collegate resta bloccata fino allo scollegamento.

Il modello non introduce HTML, CSS o JavaScript arbitrario. Annidamento,
proprietà, accessibilità, media, riferimenti, stati e resa pubblica continuano
a passare dal registro sicuro dei blocchi. Bozze e libreria restano protette,
fuori dalla sitemap e non indicizzabili.

## API protette

- `GET/POST /api/admin/cms/visual-sections`;
- `PATCH /api/admin/cms/visual-sections/:id`;
- `POST /api/admin/cms/visual-sections/:id/duplicate`;
- `POST /api/admin/cms/visual-sections/:id/insert`;
- `GET /api/admin/cms/visual-sections/:id/impact`;
- `PATCH /api/admin/cms/visual-sections/:id/publish`;
- `DELETE /api/admin/cms/visual-section-links/:pageId/:nodeId`.

## Prove ripetibili

```sh
node --test worker/tests/visual-section-library.test.mjs
node --test worker/tests/visual-builder-storage.test.mjs
node --test worker/tests/visual-page-management.test.mjs
node scripts/check-no-code-roadmap.mjs
node --test worker/tests/*.test.mjs
(cd worker && npx --yes wrangler@4 deploy --dry-run)
```

Le prove coprono autorizzazione, migrazione append-only, nuovo schema runtime,
salvataggio, duplicazione, blocco bozza/pagina pubblicata, inserimento collegato
e indipendente, analisi dell'impatto, sincronizzazione atomica, conservazione
dell'ID locale, scollegamento non distruttivo, cronologia e controlli UI.
