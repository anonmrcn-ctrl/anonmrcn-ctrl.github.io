# Unità 14.5 — blocco video accessibile e responsive

Completata il 19 ottobre 2026.

## Risultato

Il builder comprende un blocco `video` configurabile senza codice. Dalla
libreria protetta l'amministratore può scegliere o caricare MP4 e WebM fino a
48 MB, scegliere un'immagine poster e caricare sottotitoli italiani WebVTT
fino a 512 KB. Titolo, descrizione, trascrizione facoltativa, precaricamento e
ripetizione sono controlli visuali; il pannello non mostra identificativi,
chiavi R2 o URL tecnici.

Il renderer produce un elemento HTML `video` nativo, responsive, con controlli,
`playsinline`, poster e traccia `captions`. Non esiste un'opzione autoplay e
non vengono caricati player, script o telemetria di terze parti. Il controllo
di pubblicazione richiede sorgente, poster, sottotitoli, titolo e descrizione.
`VideoObject` viene prodotto soltanto per pagine pubblicate e indicizzabili con
tutti questi metadati.

## Storage, privacy e compatibilità

Video, sottotitoli, immagini e audio condividono il catalogo `media_assets` e
il bucket R2 esistenti. La migrazione `0023_visual_video_block.sql` amplia in
modo conservativo il vincolo D1 e mantiene nodi audio, proprietà e chiavi
esterne. Il percorso runtime è idempotente per installazioni non ancora
aggiornate.

Video e sottotitoli non pubblicati restano autenticati, `no-store` e
`noindex`. Dopo la pubblicazione il video supporta richieste HTTP Range
(`206`/`416`) e cache immutabile; i sottotitoli sono serviti come `text/vtt`
soltanto quando referenziati da uno snapshot pubblicato.

## Prove ripetibili

```bash
node --test worker/tests/visual-video.test.mjs
node scripts/check-visual-media-roadmap.mjs
node --test scripts/*.test.mjs
node --test worker/tests/*.test.mjs
(cd worker && npx --yes wrangler@4 deploy --dry-run)
```
