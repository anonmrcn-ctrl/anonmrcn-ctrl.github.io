# Monitoraggio organico trimestrale

Il rapporto misura se le pagine vengono trovate e comprese senza profilare le
persone. La configurazione verificabile è `organic-monitoring.json`; il
controllo è `scripts/check-organic-report.mjs`.

## Fonti ammesse

- Google Search Console per indicizzazione, impressioni, clic, CTR e posizione
  media;
- Chrome UX Report per eventuali Core Web Vitals aggregati, soltanto quando il
  campione pubblico è sufficiente.

Non vengono installati pixel, cookie pubblicitari o analytics individuali. I
dati sono esportati solo a livello complessivo e per i tre cluster di
`editorial-program.json`. Query singole, URL singoli, combinazioni pagina-query,
identificativi, indirizzi IP, token e parametri QR non entrano nel rapporto.

## Procedura trimestrale

1. usare un periodo di almeno 28 giorni e lo stesso intervallo della baseline;
2. copiare soltanto i totali aggregati e i totali per cluster;
3. omettere un cluster sotto 20 impressioni, indicandolo fra i gruppi esclusi;
4. registrare per ogni metrica valore corrente, baseline e differenza;
5. eseguire il controllo automatico prima di conservare il file;
6. annotare decisioni editoriali, non dati relativi a singole persone.

Il confronto non impone obiettivi di traffico arbitrari: serve a individuare
pagine non indicizzate, cluster poco comprensibili e temi da consolidare con
fonti e collegamenti migliori.

## Struttura di un rapporto

Salvare i rapporti come `docs/seo/reports/AAAA-QN.json`:

```json
{
  "version": 1,
  "period": { "label": "AAAA-QN", "start": "AAAA-MM-GG", "end": "AAAA-MM-GG" },
  "sources": ["Google Search Console"],
  "baseline": { "label": "baseline", "start": "AAAA-MM-GG", "end": "AAAA-MM-GG" },
  "overall": {
    "indexedPages": { "current": 0, "baseline": 0, "delta": 0 },
    "impressions": { "current": 0, "baseline": 0, "delta": 0 },
    "clicks": { "current": 0, "baseline": 0, "delta": 0 },
    "ctr": { "current": 0, "baseline": 0, "delta": 0 },
    "averagePosition": { "current": 0, "baseline": 0, "delta": 0 }
  },
  "clusters": [],
  "excludedGroups": [],
  "editorialDecisions": []
}
```

Ogni elemento di `clusters` usa un `id` presente nel programma editoriale e lo
stesso oggetto `metrics` di `overall`. Un cluster con meno di 20 impressioni
non può essere salvato: va riportato soltanto in `excludedGroups` tramite il
suo ID, senza valore numerico.

## Raccolta dati in corso

La proprietà URL-prefix è stata verificata l'11 ottobre 2026 e la sitemap è
stata inviata a Google Search Console. Il rapporto iniziale resta
intenzionalmente privo di valori numerici finché Search Console non avrà
raccolto un intervallo reale sufficientemente rappresentativo: non vengono
simulati clic, impressioni, CTR o posizione media. Dopo almeno 28 giorni
completi, esportare i dati e compilare il template seguendo questa procedura.
