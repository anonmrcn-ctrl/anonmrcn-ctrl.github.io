# Unità 14.1 — anteprima fedele dello stato di lavoro

Completata il 18 ottobre 2026.

## Risultato

L'anteprima del builder non dipende più dall'ultimo salvataggio D1. Il comando
«Aggiorna anteprima fedele» resta disponibile quando il canvas o l'ispettore
contengono modifiche e invia al Worker una rappresentazione temporanea dello
stato di lavoro. Il Worker:

- richiede la sessione amministrativa e la versione corrente della pagina;
- valida albero, tipi, gerarchie, proprietà e relazioni dichiarative;
- conserva le proprietà tecniche già associate ai blocchi, senza esporle al
  browser;
- usa lo stesso renderer sicuro della pagina pubblica;
- non esegue scritture in D1 e non modifica la versione pubblicata;
- restituisce `Cache-Control: no-store`, `X-Robots-Tag: noindex, nofollow` e
  metadati `noindex,nofollow`.

L'HTML server rimane visibile passando tra smartphone, tablet e desktop. Una
nuova modifica invalida automaticamente quella resa e riporta alla preview
locale finché l'amministratore non la aggiorna. Errori di validazione o
concorrenza vengono mostrati senza cancellare il lavoro nel browser.

## Prove ripetibili

```bash
node --test worker/tests/visual-publication.test.mjs
node scripts/check-visual-media-roadmap.mjs
node scripts/admin-ui.e2e.mjs
```

Il test Worker modifica un titolo e aggiunge un blocco temporaneo, verifica che
entrambi siano presenti nell'HTML di anteprima e poi rilegge D1 e l'endpoint
pubblico per dimostrare che non sono stati salvati o pubblicati. L'audit
Playwright compila l'ispettore senza salvare, controlla il corpo della richiesta
POST, la resa server e la sua permanenza nel cambio di dispositivo.

La suite completa e la build Worker restano i controlli di chiusura comuni
registrati in `progress.md`.
