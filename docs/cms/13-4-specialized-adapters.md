# 13.4 — migrazione dei componenti specializzati

Completata il 17 ottobre 2026. I componenti specifici di anonMrcn sono ora
tipi del registro visuale con sorgenti D1 prevalidate. Il sito HTML corrente
rimane il percorso pubblico principale e conserva interazioni, URL, ancore,
query e ripieghi durante la transizione.

## Blocchi e dati

L'inizializzazione `visual_specialized_blocks_v1` aggiunge una sola volta 12
nodi con ID stabili agli alberi importati, senza modificare i 60 blocchi
editoriali precedenti, `page_blocks` o le revisioni:

| Blocco | Sorgente autorizzata | Esposizione |
|---|---|---|
| poesia | opera, canti e versi D1 pubblicati | testo, ancore dei versi e rientri |
| percorso | tappe narrative pubblicate | testo, fonte e collegamento sicuro |
| mappa | livelli e numero di geometrie pubblicate | riepilogo accessibile e link alla mappa interattiva corrente |
| Voci | schede wiki pubblicate | URL permanente `/voci/<slug>.html` |
| luoghi | schede cartografiche | URL permanente `/luoghi/<id>.html` |
| fonti | sole fonti pubblicate | titolo, autore e URL filtrata |
| Memorie | sole Memorie approvate con consenso | testo e attribuzione facoltativa |
| archivio | soli messaggi pubblici con doppio consenso | testo, senza identità o posizione |
| modulo Memorie | adattatore preautorizzato | link al modulo completo con mappa, media, consenso e moderazione |
| taccuino | funzione locale | link al taccuino corrente, dati sul dispositivo |
| spazio personale | funzione autenticata | link all'accesso corrente |
| accesso | funzione protetta | link alla verifica QR e al login corrente |

`technical.binding/adapter` identifica la sorgente, ma è di sola lettura e non
viene mai reso nell'HTML. Se la tabella storica dei messaggi non esiste ancora,
l'archivio produce in sicurezza una lista vuota: non crea dati fittizi e non
impedisce l'apertura delle altre pagine.

## Compatibilità e sicurezza

I componenti con un comportamento browser già consolidato dichiarano
`data-static-fallback` e collegano l'interfaccia completa esistente. In
particolare il blocco mappa di Memorie conserva `#memorieMap`, il modulo conserva
`#memoriaFormTitolo` e la mappa del progetto conserva `#map`. Voci e luoghi
usano gli URL autonomi canonici già inclusi nel sistema dei permalink. Nessun
file statico, QR, alias, frammento, query o geometria viene rimosso o riscritto.

Ogni valore proveniente da D1 è codificato come testo. I link accettano solo
HTTPS e destinazioni locali ammesse; `javascript:` diventa `#`. Il Worker non
emette markup memorizzato, stili, script o gestori di evento. Bozze wiki, tappe
non pubblicate, Memorie non approvate e messaggi privi di entrambi i consensi
non raggiungono l'output. Accesso, spazio personale e taccuino conservano
`noindex,nofollow` senza canonical o dati strutturati.

## Prove ripetibili

```sh
node --test worker/tests/visual-builder-adapters.test.mjs
node --test worker/tests/visual-builder-renderer.test.mjs
node scripts/check-no-code-roadmap.mjs
node --test worker/tests/*.test.mjs
npx --yes wrangler@4 deploy --dry-run
```

I test provano inizializzazione idempotente e ID stabili, conservazione dei
blocchi precedenti, lettura di tutti i componenti, filtri di pubblicazione e
consenso, assenza sicura della tabella storica, neutralizzazione di markup e
URL pericolosi, ancore dei ripieghi e `noindex` delle aree personali.
