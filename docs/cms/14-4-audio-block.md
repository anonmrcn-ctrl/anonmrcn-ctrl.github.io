# Unità 14.4 — blocco audio accessibile e responsive

Completata il 19 ottobre 2026.

## Risultato

Il builder comprende un blocco `audio` configurabile senza codice. Dalla
libreria protetta l'amministratore può scegliere o caricare MP3, Ogg, WebM,
M4A o WAV fino a 16 MB e aggiungere copertina, titolo, descrizione,
trascrizione, precaricamento e ripetizione. Il pannello conserva riferimenti
D1 tipizzati: non mostra `assetId`, chiavi R2 o URL tecnici.

La pagina usa l'elemento HTML `audio` nativo con controlli e larghezza
responsive. L'autoplay non è previsto dal contratto né prodotto dal renderer;
la trascrizione è sempre richiesta prima della pubblicazione. `AudioObject`
viene generato soltanto per una pagina pubblicata e indicizzabile con sorgente
e metadati completi.

## Storage, privacy e compatibilità

Audio e immagini condividono il catalogo `media_assets`, le quote e il bucket
R2 già esistenti. La migrazione `0022_visual_audio_block.sql` amplia il vincolo
dei tipi visuali ricreando insieme nodi e relazioni dipendenti; i test provano
che nodi, proprietà e chiavi esterne precedenti restano integri. All'avvio il
Worker esegue anche l'aggiornamento idempotente per ambienti esistenti.

Un audio non referenziato da una pubblicazione rimane autenticato, `no-store`
e `noindex`. Dopo la pubblicazione lo stesso URL supporta richieste HTTP Range
singole (`206`, `Content-Range`, `Accept-Ranges`) e cache immutabile; intervalli
non validi restituiscono `416`. Non vengono incorporati player esterni,
telemetria o tracciamento implicito.

## Prove ripetibili

```bash
node --test worker/tests/visual-audio.test.mjs
node scripts/check-visual-media-roadmap.mjs
node --test scripts/*.test.mjs
node --test worker/tests/*.test.mjs
(cd worker && npx --yes wrangler@4 deploy --dry-run)
```
