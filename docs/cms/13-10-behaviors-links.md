# 13.10 — comportamenti e collegamenti senza codice

Completata il 18 ottobre 2026. L'ispettore visuale configura collegamenti,
ancore, menu, indici, breadcrumb, raccolte, filtri e il modulo autorizzato
tramite controlli dichiarativi. Nessun campo accetta HTML, CSS, JavaScript,
SQL, endpoint, token o segreti.

## Collegamenti e navigazione

- sezioni e titoli accettano un'ancora breve, univoca nella pagina e validata;
- i pulsanti accettano soltanto destinazioni HTTPS, locali, email, telefono o
  frammento e una scelta esplicita fra stessa o nuova finestra;
- le nuove finestre ricevono sempre `noopener noreferrer` e i collegamenti
  esterni sono riconoscibili nell'output;
- gli elenchi di collegamenti usano righe `Etichetta | destinazione`, con
  etichetta e URL convalidati separatamente;
- menu, indice e breadcrumb scelgono solo sorgenti interne registrate.

Il contratto dei blocchi passa alla versione 2 e l'ispettore alla versione 2.
Le pagine e le sezioni create o modificate registrano la nuova versione senza
riscrivere gli alberi precedenti o i loro identificativi.

## Raccolte, filtri e moduli

Le raccolte possono leggere esclusivamente pagine, Voci, luoghi, fonti o
Memorie già pubblicate; per le Memorie la query richiede anche approvazione e
consenso. Aspetto e limite sono scelti da cataloghi chiusi. Il renderer
produce elementi semantici già sanitizzati e conserva soltanto testo utile al
filtro, senza serializzare record privati o configurazioni tecniche.

Il filtro seleziona visualmente un blocco raccolta della stessa pagina. Il
Worker verifica che destinazione e sorgente coincidano; il runtime
`visual-behaviors.js` applica la ricerca locale agli elementi già pubblicati e
non esegue richieste di rete. Il modulo disponibile è soltanto quello per le
Memorie già autorizzato: informativa pubblicata e consenso esplicito sono
obbligatori.

Per raccolte, filtri e moduli i soli valori ammessi sono:

- servizio esterno: `none`;
- telemetria: `off`.

Queste scelte vengono validate anche dal Worker. Non esiste un campo per
aggiungere fornitori, endpoint o codice; una futura integrazione richiederà
sviluppo, consenso verificato e aggiornamento del registro.

## Sicurezza e compatibilità

Il renderer continua a produrre solo HTML semantico e attributi `data-*`
escapati. Le sorgenti interrogano tabelle D1 esistenti con query fisse, limiti
massimi e soli stati pubblici. Il runtime dei filtri non usa `fetch`, cookie,
storage o telemetria. URL, QR, alias, frammenti precedenti, ripieghi statici,
canonical e dati R2 non vengono modificati.

## Prove ripetibili

```sh
node scripts/check-visual-inventory.mjs
node scripts/check-no-code-roadmap.mjs
node --test worker/tests/visual-builder-behaviors.test.mjs
node --test worker/tests/visual-builder-inspector.test.mjs
node --test worker/tests/visual-builder-renderer.test.mjs
node --test worker/tests/*.test.mjs
(cd worker && npx wrangler deploy --dry-run)
```

Le prove coprono valori predefiniti rispettosi della privacy, rifiuto di
sorgenti e telemetria non ammesse, consenso obbligatorio, URL pericolosi,
ancore duplicate, relazione filtro-raccolta, output sanitizzato, nuova
finestra sicura, resa delle raccolte, runtime locale e assenza di codice o
endpoint configurabili.
