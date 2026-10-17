# Punto 13 — autonomia visuale no-code

Aggiornato il 17 ottobre 2026. Questa roadmap estende il CMS già pubblicato:
non riapre né sostituisce i punti 1–12, che restano la base tecnica e le
garanzie da preservare.

## Obiettivo

L'amministratore deve poter costruire e modificare il sito senza intervenire
su HTML, CSS, JavaScript, SQL o file del repository. L'interfaccia deve
permettere di:

- creare una pagina vuota o partire da un modello;
- comporla interamente con blocchi visuali, anche annidati;
- riordinare, duplicare, salvare e riutilizzare blocchi e sezioni;
- modificare contenuti, layout e grafica per smartphone, tablet e desktop;
- configurare le funzioni ammesse tramite proprietà comprensibili;
- gestire slug, metadati, menu, bozze, pubblicazione e cronologia;
- archiviare, recuperare ed eliminare pagine senza produrre URL morti;
- cambiare il sistema grafico globale senza modificare il codice.

«Zero programmazione» descrive il flusso editoriale ordinario. Nuovi tipi di
blocco o nuove integrazioni tecniche continueranno a richiedere sviluppo e
test, ma dopo la loro registrazione saranno configurabili visualmente. Il CMS
non esporrà campi per HTML, CSS o JavaScript arbitrario: la personalizzazione
massima verrà ottenuta con proprietà dichiarative validate, temi e componenti
versionati.

## Principi non negoziabili

1. URL, QR, frammenti, query compatibili e ID pubblici esistenti restano validi.
2. D1 conserva struttura e metadati; R2 conserva media e documenti.
3. Ogni modifica usa bozza, anteprima protetta, revisione append-only e
   pubblicazione esplicita.
4. L'archiviazione è il primo livello di eliminazione. La cancellazione
   definitiva richiede analisi di link, QR, alias, dati collegati e una
   destinazione valida per gli URL precedenti.
5. Bozze, anteprime e pannello restano `noindex` e fuori dalla sitemap.
6. Il renderer accetta soltanto blocchi e proprietà registrati, sanitizzati e
   coperti da test.
7. Accessibilità, privacy, SEO e budget prestazionali sono vincoli del builder,
   non controlli facoltativi finali.
8. Il sito corrente e i ripieghi statici restano disponibili finché la
   migrazione di una tipologia non è completa e verificata in produzione.

## Catalogo minimo dei blocchi

- **Struttura:** pagina, sezione, contenitore, pila, riga, colonne, griglia,
  separatore e spazio.
- **Contenuto:** titolo, testo formattato, elenco, citazione, immagine,
  galleria, didascalia, collegamento e pulsante.
- **Navigazione:** menu, indice, breadcrumb, elenco di collegamenti e ancora.
- **Progetto:** poesia, Voci, luoghi, mappa, fonti, Memorie e contenuti
  editoriali collegati.
- **Globali:** intestazione, piè di pagina, avviso e sezione riutilizzabile.
- **Funzionali:** raccolta, filtro, modulo già autorizzato e sorgente dati
  prevalidata; mai script arbitrario.

Il registro può crescere, ma ogni nuovo tipo deve dichiarare schema delle
proprietà, limiti di annidamento, resa semantica, variante responsive,
accessibilità, privacy, SEO, migrazione e test.

## Ordine vincolante

| Unità | Risultato | Stato | Dipendenza |
|---:|---|---|---|
| 13.0 | Roadmap, guardrail e controllo automatico | Completa | Punti 1–12 |
| 13.1 | Inventario visuale e contratto dei blocchi | Da iniziare | 13.0 |
| 13.2 | Schema D1 per pagine, alberi e temi | Da iniziare | 13.1 |
| 13.3 | Registro dei blocchi e renderer pubblico sicuro | Da iniziare | 13.2 |
| 13.4 | Migrazione dei componenti specializzati | Da iniziare | 13.3 |
| 13.5 | Canvas visuale a blocchi | Da iniziare | 13.4 |
| 13.6 | Ispettore visuale e anteprima responsive | Da iniziare | 13.5 |
| 13.7 | Gestione completa delle pagine | Da iniziare | 13.6 |
| 13.8 | Modelli, sezioni riutilizzabili e parti globali | Da iniziare | 13.7 |
| 13.9 | Studio grafico globale | Da iniziare | 13.8 |
| 13.10 | Comportamenti e collegamenti senza codice | Da iniziare | 13.9 |
| 13.11 | Pubblicazione, qualità e recupero | Da iniziare | 13.10 |
| 13.12 | Migrazione finale e audit di indipendenza | Da iniziare | 13.11 |

I criteri dettagliati e lo stato eseguibile sono in
`docs/cms/no-code-roadmap.json`. Dopo ogni unità completa si aggiornano insieme
il file JSON, questa tabella e `docs/cms/progress.md`.

## Criterio finale

La roadmap è conclusa soltanto quando una prova end-to-end dimostra che, da
smartphone e desktop, l'amministratore può creare una pagina, costruirla a
blocchi, personalizzarne grafica e comportamento, controllarne SEO e
accessibilità, pubblicarla, inserirla nella navigazione, archiviarla,
recuperarla ed eliminarla in sicurezza senza modificare codice o usare il
repository.
