# 13.1 — inventario visuale e contratto dei blocchi

Completato il 17 ottobre 2026. Questa unità descrive il sito corrente prima
della sua trasformazione: non sposta contenuti, non modifica URL e non abilita
ancora la resa pubblica dei nuovi blocchi.

## Copertura verificata

- 21 documenti HTML, raggruppati in 14 famiglie di pagina;
- 17 moduli riconoscibili del pannello di amministrazione;
- tutte le 18 aree del precedente inventario contenuti/software;
- componenti globali, pagine personali, moduli, mappa, poesia, luoghi, Voci,
  Memorie, fonti, navigazione e documenti legali.

La mappatura eseguibile è in `visual-component-inventory.json`. Ogni pagina,
modulo amministrativo e area di contenuto punta a uno o più tipi del registro,
senza dichiarare come contenuto modificabile la configurazione software.

## Confini di responsabilità

| Dominio | Modificabile dal builder | Contiene |
|---|---:|---|
| `content` | Sì | testi, media, dati e metadati editoriali |
| `presentation` | Sì | layout, tipografia, colori e varianti responsive validate |
| `behavior` | Sì | link, raccolte e interazioni dichiarative consentite |
| `technical` | No | binding, sicurezza, endpoint, segreti e adattatori software |

Il pannello non deve mai trasformare HTML, CSS, JavaScript, SQL, endpoint,
segreti o token in campi editoriali liberi.

## Contratto v1

`block-contract.json` definisce:

- nodo con ID stabile, tipo registrato, posizione, domini separati e figli;
- profondità massima 8 e massimo 200 figli per nodo;
- 40 tipi di blocco in dieci categorie;
- undici insiemi di proprietà, inclusi i binding tecnici di sola lettura;
- compatibilità con lo schema contenuti 5;
- rifiuto in scrittura di tipi o proprietà sconosciuti e ripiego statico in
  lettura;
- conservazione esplicita di URL, QR, frammenti, ID D1, revisioni, chiavi R2,
  SEO, binding esistenti e pagine statiche.

Il contratto è una specifica versionata. L'unità 13.2 lo traduce in uno schema
D1 append-only; l'unità 13.3 introduce il registro eseguibile e il renderer
pubblico sicuro.

## Prove ripetibili

```sh
node scripts/check-visual-inventory.mjs
node --test scripts/visual-inventory.test.mjs
node scripts/check-no-code-roadmap.mjs
```
