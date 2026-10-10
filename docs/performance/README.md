# Prestazioni e Core Web Vitals

Questa cartella raccoglie la prova ripetibile del punto 9. L'audit copre le
cinque tipologie pubbliche definite nella roadmap — homepage, mappa, indice
delle Voci, scheda di un luogo e Memorie — sia con profilo mobile sia desktop.

## Che cosa misura il controllo

`performance-budget.json` è l'unica fonte per percorsi e soglie. Il workflow
`check-performance.yml` avvia il ramo corrente in un server locale isolato,
esegue Lighthouse sulle dieci combinazioni e conserva i rapporti JSON per 30
giorni. `scripts/check-performance.mjs` verifica:

- LCP non superiore a 2,5 secondi;
- CLS non superiore a 0,1;
- Total Blocking Time non superiore a 200 ms come segnale di laboratorio sulla
  disponibilità del thread principale;
- punteggio prestazioni almeno 90 e trasferimento iniziale non superiore a 1
  MiB;
- budget statici per HTML, JavaScript, CSS e insieme delle risorse locali
  direttamente referenziate.

Lighthouse non produce l'INP reale: l'INP della roadmap è una misura al 75º
percentile raccolta sul campo. Finché Search Console/CrUX non dispone di un
campione sufficiente, il TBT e i test delle interazioni proteggono dalle
regressioni di laboratorio, ma non vengono presentati come sostituti dell'INP.

## Esecuzione locale

Il controllo senza Chrome è sempre disponibile:

```bash
node scripts/check-performance.mjs
```

In CI, dopo la produzione dei rapporti:

```bash
node scripts/check-performance.mjs performance-reports
```

Ogni rapporto è nominato `<tipologia>.<profilo>.json`; l'assenza anche di una
sola delle dieci combinazioni rende il controllo non valido.
