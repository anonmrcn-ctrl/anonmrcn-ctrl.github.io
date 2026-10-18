# Unità 14.3 — caricamento media dal builder

Completata il 19 ottobre 2026.

## Risultato

La libreria visuale permette di caricare JPEG, PNG e WebP fino a 8 MB, scrivere
testo alternativo e didascalia e collegare subito il risultato al blocco
`image` o `gallery`, senza esporre identificativi o URL tecnici. Il browser
genera le varianti `small` e `medium`, mostra avanzamento e annullamento e
mantiene il blocco precedente in caso di errore.

## Integrità e privacy

Il Worker verifica firma binaria, dimensioni, metadati, varianti e quota (250
originali e 256 MB), calcola SHA-256 e registra gli oggetti nello stesso
catalogo D1 `media_assets` e nello stesso bucket R2. Le scritture non concluse
sono compensate rimuovendo gli oggetti nuovi. Scollegare un media non cancella
catalogo o revisioni. Un asset non pubblicato restituisce `404` senza sessione;
in anteprima usa `private, no-store` e `X-Robots-Tag: noindex, nofollow`. Lo
stesso URL diventa pubblico soltanto quando compare in uno snapshot pubblicato.

## Prove ripetibili

```bash
node --test worker/tests/visual-media-upload.test.mjs
node --test worker/tests/visual-media-picker.test.mjs
node scripts/check-visual-media-roadmap.mjs
node scripts/admin-ui.e2e.mjs
(cd worker && npx --yes wrangler@4 deploy --dry-run)
```
