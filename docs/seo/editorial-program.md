# Programma editoriale territoriale

Il programma traduce il punto 10 in attività verificabili senza inventare nuovi
contenuti storici e senza introdurre tracciamento. La fonte operativa è
`editorial-program.json`: cluster, pagine già pubblicate, collegamenti
contestuali e scadenze possono essere controllati automaticamente.

## Metodo

Ogni attività parte da un cluster territoriale, non da una parola chiave
isolata. Prima della pubblicazione, le affermazioni sono trattate in tre modi:

- **fonte**: il fatto verificabile ha un richiamo identificabile nel testo;
- **testimonianza**: il ricordo è presentato come esperienza situata, con
  consenso e limiti espliciti, mai come prova generale;
- **interpretazione**: la lettura editoriale è dichiarata e separata dai fatti.

Un'attività che richiede una categoria non è pronta finché quella verifica non
è conclusa. Le bozze rimangono fuori da API pubbliche, sitemap e rapporti.

## Calendario

| Data | Cluster | Attività | Obiettivo |
|---|---|---|---|
| 23 ottobre 2026 | Gaggio e zone umide | Audit | Fonti, date, collegamenti e immagini delle Cave di Gaggio |
| 6 novembre 2026 | Acque e bonifiche | Revisione | Dati e interpretazioni nella Voce sullo Zero |
| 20 novembre 2026 | Insediamenti e toponimi | Revisione | Fonti e possibile raccolta consapevole per San Giorgio |
| 4 dicembre 2026 | Insediamenti e toponimi | Audit collegamenti | Voce, luoghi e permalink di Strada Bassa |
| 15 gennaio 2027 | Acque e bonifiche | Nuova bozza | Scaletta documentata sul Dese |
| 12 febbraio 2027 | Insediamenti e toponimi | Nuova bozza | Scaletta documentata su Praello |

Le date organizzano il lavoro, non autorizzano la pubblicazione automatica. Le
bozze nuove richiedono comunque revisione, fonti sufficienti, anteprima e
pubblicazione esplicita dal CMS.

## Criterio di collegamento

Ogni Voce pubblicata appartiene ad almeno un cluster e ha almeno un rapporto
editoriale con un'altra Voce. Il rapporto produce un collegamento contestuale
nelle pagine autonome; l'indice generale resta un ulteriore percorso di
scoperta ma non è usato per mascherare Voci isolate.

## Privacy

Il programma conserva soltanto informazioni sul lavoro editoriale. Non
registra autori delle ricerche, visitatori, indirizzi IP, identificativi dei
dispositivi o termini riconducibili a singole persone. Le testimonianze seguono
consenso, minimizzazione e possibilità di ritiro già previste dal CMS. Per la
misurazione organica si usano esclusivamente dati aggregati di Search Console o
CrUX; token, QR riservati, bozze e URL privati sono esclusi.

## Verifica

Da eseguire dalla radice:

```bash
node scripts/check-editorial-program.mjs
```

Il controllo blocca cluster sconosciuti, Voci non coperte, relazioni mancanti,
calendario non ordinato, categorie probatorie diverse dalle tre previste e
riferimenti a URL pubblici non censiti.
