# 13.9 — studio grafico globale

Completata il 18 ottobre 2026. Il pannello include uno studio grafico no-code
per nominare, duplicare, modificare, confrontare, pubblicare e ripristinare
temi globali. L'amministratore non inserisce CSS: ogni scelta corrisponde a un
token tipizzato e con limiti fissati dal Worker.

## Controlli disponibili

Lo schema `VISUAL_THEME_TOKEN_SCHEMA` espone tredici controlli nei gruppi D1
già predisposti:

- palette per testo, sfondo, accento e testo secondario;
- carattere del testo e dei titoli, senza font esterni;
- scala tipografica e spaziatura base;
- superficie dei pannelli, arrotondamento e ombra;
- durata del movimento e rispetto obbligatorio di `prefers-reduced-motion`.

Colori, caratteri, misure, ombre e intervalli numerici vengono accettati solo
da cataloghi o formati controllati. Il server blocca contrasto testo/sfondo e
testo secondario/sfondo inferiore a 4,5:1 e non permette di disattivare il
movimento ridotto. Non è possibile aggiungere URL di font, fogli di stile,
script o valori CSS liberi; il numero fisso dei token mantiene prevedibile il
peso della risposta pubblica.

## Confronto, impatto e ripristino

Ogni tema è nominabile e duplicabile a partire da qualunque tema conservato.
La modifica produce una bozza e una revisione `visual_theme` append-only. Il
pannello aggiorna l'anteprima del canvas mentre cambiano i controlli, ma il
pulsante di pubblicazione resta disabilitato finché non viene eseguito il
confronto con il tema attivo.

Il confronto mostra i token cambiati e tutte le pagine interessate. La
pubblicazione assegna il tema a ogni `visual_page_trees` in un'unica
transazione e aggiunge una revisione a ogni albero. I temi precedenti non
vengono eliminati: selezionarne uno, confrontarlo e pubblicarlo di nuovo
costituisce un ripristino verificabile senza riscrivere la cronologia.

`GET /api/public/visual-pages/:slug` restituisce il tema pubblicato come
struttura di token sicuri insieme alla resa della pagina. Non genera attributi
`style` o codice arbitrario; i ripieghi statici restano invariati fino alla
migrazione finale.

## API protette

- `GET/POST /api/admin/cms/visual-themes`;
- `PATCH /api/admin/cms/visual-themes/:id`;
- `GET /api/admin/cms/visual-themes/:id/compare?other=:id`;
- `PATCH /api/admin/cms/visual-themes/:id/publish`.

## Prove ripetibili

```sh
node --test worker/tests/visual-theme-studio.test.mjs
node --test worker/tests/visual-builder-renderer.test.mjs
node scripts/check-performance.mjs
node scripts/check-no-code-roadmap.mjs
node --test worker/tests/*.test.mjs
(cd worker && npx --yes wrangler@4 deploy --dry-run)
```

Le prove coprono schema completo, duplicazione, salvataggio, rifiuto di
contrasto e movimento non sicuri, confronto, impatto su tutte le pagine,
pubblicazione, risposta pubblica, ripristino del tema precedente, revisioni e
controlli responsive del pannello.
