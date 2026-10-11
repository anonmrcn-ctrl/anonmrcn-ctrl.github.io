# Audit di usabilità del pannello

Verifica eseguita l'11 ottobre 2026 sul pannello amministrativo dopo la
stabilizzazione delle funzioni CMS. L'obiettivo è rendere brevi e comprensibili
i percorsi senza modificare contenuti, URL, identificativi o autorizzazioni.

## Percorsi coperti

- ingresso con passkey e ripresa di una sessione scaduta;
- scelta dell'attività tramite l'indice del pannello;
- modifica, stato non salvato, attesa, conferma ed errore di concorrenza;
- anteprima e cronologia senza pubblicazione involontaria;
- gestione di contenuti, SEO, mappe, documenti, messaggi e strumenti;
- uscita dal pannello e avviso prima di abbandonare modifiche non salvate.

Gli endpoint e la conservazione di revisioni sono provati dalla suite Worker.
Il test browser non invia dati e non richiede una passkey: apre l'involucro
autenticato con risposte locali controllate, così non legge né altera contenuti
reali.

## Prove automatiche

`scripts/admin-ux.test.mjs` controlla struttura, titoli associati, destinazioni,
`noindex`, stati accessibili, messaggi di errore e protezione dei moduli.
`scripts/admin-ui.e2e.mjs` usa un browser reale e verifica:

- viewport smartphone 375 × 812 e desktop 1440 × 1000;
- assenza di scorrimento orizzontale;
- etichetta programmatica per input, select e textarea visibili;
- pulsanti visibili alti almeno 44 pixel;
- accesso da tastiera e attivazione dell'indice con Invio;
- ciclo modifica non salvata, `aria-busy`, successo e ripristino dello stato;
- schermate dell'indice conservate per 30 giorni come artefatto CI.

Comandi ripetibili, con il server locale già avviato sulla porta 8000:

```bash
node --test scripts/admin-ux.test.mjs
node scripts/admin-ui.e2e.mjs
```

Nel CI Playwright è fissato alla versione 1.55.0 e usa Chrome del runner. La
suite funzionale completa copre inoltre i salvataggi reali simulati contro D1 e
R2, gli errori di autorizzazione, i conflitti di versione e le revisioni.

## Esito e limiti

I controlli strutturali e la suite funzionale sono verdi. Il run PR
`38154750212` ha superato il test browser con Chrome e tutte le dieci misure
Lighthouse; le schermate mobile e desktop sono nell'artefatto
`admin-ui-reports` con ID `11708057414` e digest
`sha256:2045e812faac9ac507bf6d09ec6b1e2d8232f85e44318f7f27fb17b69c0b2d0e`.
Anche il run SEO `38154750211` è riuscito.

Nel contenitore di sviluppo la libreria browser è disponibile ma il binario
Chromium non è installato e la rete protetta ne impedisce il download; perciò
la prova browser è correttamente demandata al runner Chrome, mentre 133 test,
controlli statici e build Worker dry-run vengono eseguiti localmente.

Una passkey o un contenuto di produzione non vengono copiati nel test. La
verifica pubblicata deve inoltre confermare caricamento e impaginazione della
stessa versione; l'accesso con la passkey personale resta una prova manuale
dell'amministratore, non un segreto da trasferire al CI.
