# Registro di avanzamento del CMS

Aggiornato l’8 ottobre 2026. Questo registro stabilisce l’ordine di lavoro: si
procede dalla prima riga incompleta e una riga diventa completa soltanto quando
schema, compatibilità, test e documentazione sono presenti nel repository.

## Passaggi principali

| N. | Passaggio | Stato | Prova nel repository |
|---:|---|---|---|
| 1 | Confine contenuti/software | Completo | `01-confine-contenuti-software.md`, `content-inventory.json`, `scripts/check-content-boundary.mjs` |
| 2 | Centralizzazione in D1 | In corso | Fondazione comune, percorso poetico e blocchi delle pagine completati; il primo punto incompleto è 2.4 |
| 3 | Ampliamento del pannello | Da iniziare | Si avvia soltanto dopo il completamento del punto 2 |
| 4 | Bozze, anteprima e cronologia | Da iniziare | La tabella append-only `content_revisions` è predisposta, ma flussi e interfaccia non sono ancora realizzati |
| 5 | Permanenza di QR e collegamenti | Da iniziare | La tabella `permalinks` è predisposta; migrazione e risoluzione degli URL storici non sono ancora realizzate |
| 6 | Media e documenti in R2 | Da iniziare | Nessun dato è stato ancora trasferito |
| 7 | Sostituzione del token amministrativo | Da iniziare | L’accesso continua a usare `ADMIN_TOKEN` |
| 8 | Esportazione, manutenzione, manuale e diagnostica | Da iniziare | Gli strumenti esistenti non coprono ancora l’intero CMS |

## Punto 2 — ordine vincolante

| Ordine | Unità | Stato | Criterio e prova |
|---:|---|---|---|
| 2.1 | Fondazione D1 comune | Completo | `0013_cms_content_foundation.sql`, `cms-schema.js` e `cms-schema.test.mjs`; l’health check installa e verifica lo schema |
| 2.2 | Percorso «Esplora la poesia» | Completo | `0012_narrative_steps.sql`, API pubblica e amministrativa, ripiego locale, test di inizializzazione e conservazione delle tappe pubblicate |
| 2.3 | Pagine e blocchi | Completo | `page-seed.js` importa idempotentemente 9 pagine e 60 blocchi; `GET /api/public/pages/:slug`, `page-content.js` e `pages.test.mjs` provano sorgente D1, soli contenuti pubblicati, ID stabili e ripiego statico |
| 2.4 | Poesia, canti e versi | Da iniziare | Migrare senza cambiare riferimenti metrici, ordine o resa |
| 2.5 | Menu e collegamenti globali | Da iniziare | Migrare etichette, ordine, destinazioni e visibilità senza cambiare gli URL |
| 2.6 | Tour e benvenuto | Da iniziare | Migrare tutte le schermate e mantenere lo stato locale già salvato |
| 2.7 | Livelli, percorsi e geometrie | Da iniziare | Importare GeoJSON e dati JavaScript mantenendo identificativi e ripiego locale |
| 2.8 | Fonti e bibliografia | Da iniziare | Deduplicare senza perdere citazioni, etichette o collegamenti esistenti |
| 2.9 | Impostazioni e metadati | Da iniziare | Migrare soltanto valori editoriali, lasciando nel codice le impostazioni tecniche |
| 2.10 | Revisioni iniziali | Da iniziare | Creare una prima fotografia immutabile per ogni contenuto importato |
| 2.11 | Permalink esistenti | Da iniziare | Registrare URL e destinazioni già pubblicati prima di qualsiasi cambio di slug |
| 2.12 | Informativa privacy | Da iniziare | Importare la versione del 3 ottobre 2026 con checksum e divieto di sovrascrittura |

## Verifiche ripetibili

Da eseguire dalla radice del repository:

```bash
node scripts/check-content-boundary.mjs
node --test worker/tests/*.test.mjs
```

La prima verifica controlla che tutte le aree inventariate esistano e abbiano
una destinazione. La seconda applica sia lo schema completo sia le migrazioni a
SQLite, verifica le relazioni, prova che revisioni, permalink e versioni legali
pubblicate non possano essere riscritti e controlla importazione, pubblicazione
e ripiego dei blocchi delle pagine.

I file statici rimangono disponibili come ripiego finché la relativa unità del
punto 2 non è completa. Non vanno eliminati durante una migrazione parziale.
