# 13.2 — schema D1 per pagine, alberi e temi

Completato il 17 ottobre 2026. La migrazione `0019_visual_builder_schema.sql`
aggiunge il modello visuale senza modificare o rimuovere le tabelle correnti.
Il sito pubblico continua quindi a leggere `site_pages` e `page_blocks` finché
il renderer della 13.3 non sarà completo e verificato.

## Modello normalizzato

| Tabella | Responsabilità |
|---|---|
| `visual_themes` | identità, stato e pubblicazione dei temi |
| `visual_theme_tokens` | palette, tipografia, scala, spaziatura, superfici, bordi, ombre e movimento per breakpoint |
| `visual_trees` | versione del modello e stato editoriale di ogni albero |
| `visual_page_trees` | collegamento uno-a-uno tra pagina esistente, albero e tema |
| `visual_nodes` | gerarchia, ordine e tipo registrato dei blocchi |
| `visual_node_properties` | proprietà tipizzate di contenuto, presentazione, comportamento e configurazione tecnica |
| `visual_reusable_sections` | identità e ciclo editoriale delle sezioni riutilizzabili |

Non esiste una colonna JSON per lo stato corrente dell'albero. Testo, numeri,
booleani, colori, misure, URL, raccolte e riferimenti sono distinti da
`value_kind` e da colonne incompatibili tra loro. Le immagini puntano al loro
ID in `media_assets`, le pagine al loro ID in `site_pages`; i breakpoint sono
limitati a `all`, `phone`, `tablet` e `desktop`.

Un vincolo composito impedisce a un nodo di usare un genitore appartenente a
un altro albero. Indici univoci garantiscono una sola radice e una sola
posizione tra fratelli. I 40 tipi e gli 11 insiemi di proprietà coincidono con
il contratto v1 della 13.1; HTML, CSS, JavaScript e SQL non sono valori del
modello.

## Importazione compatibile

`initializeVisualBuilderContent` importa una sola volta le 9 pagine e i 60
blocchi preesistenti:

- conserva gli ID dei 60 blocchi e l'ordine corrente;
- crea una radice stabile per ogni pagina, per un totale di 69 nodi;
- normalizza titolo, descrizione e testi in 78 proprietà tipizzate;
- associa ogni pagina al tema `theme-default`, che mantiene la resa CSS
  corrente come ripiego;
- registra `visual_builder_v1` soltanto al termine della transazione.

L'importazione rifiuta un tipo o una proprietà precedente non mappati invece
di perdere dati in silenzio. Una seconda esecuzione non duplica né sovrascrive
i record.

## Conservazione e rollback

La migrazione è append-only: non contiene `ALTER`, `DROP`, `UPDATE` o `DELETE`.
I test confrontano integralmente `site_pages`, `page_blocks` e
`content_revisions` prima e dopo l'importazione. Un rollback del Worker torna
quindi a usare le strutture precedenti e i ripieghi statici, lasciando le nuove
tabelle inattive ma intatte. Non è previsto un rollback distruttivo dello
schema.

Le sette tabelle sono incluse nell'esportazione e nel ripristino CMS; l'ordine
di backup rispetta temi, alberi, nodi, proprietà e riferimenti R2. Dopo il
deploy, `/api/health` rende verificabile l'installazione con
`"visualBuilderSchema": 1`.

## Prove ripetibili

```sh
node --test worker/tests/visual-builder-storage.test.mjs
node --test worker/tests/cms-schema.test.mjs
node --test worker/tests/cms-maintenance.test.mjs
node --test worker/tests/*.test.mjs
npx --yes wrangler@4 deploy --dry-run
```
