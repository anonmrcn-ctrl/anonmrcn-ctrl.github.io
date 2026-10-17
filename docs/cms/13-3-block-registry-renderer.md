# 13.3 — registro dei blocchi e renderer pubblico sicuro

Completato il 17 ottobre 2026. Il renderer visuale è disponibile in parallelo
al sito corrente: non sostituisce ancora i documenti HTML né i relativi
ripieghi statici.

## Registro eseguibile

`worker/src/visual-builder-renderer.js` pubblica il registro v1 dei 40 tipi di
blocco. Per ogni tipo fissa categoria, insiemi di proprietà ammessi e resa
semantica. Un test confronta tipo per tipo il registro con
`docs/cms/block-contract.json`; Worker, migrazione e documentazione non possono
quindi divergere senza far fallire la suite.

Il renderer verifica prima dell'output:

- un'unica radice `page-root`;
- ID, tipo, posizione, genitore, profondità massima e numero di figli;
- categorie annidabili e insiemi di proprietà ammessi dal tipo;
- assenza di nodi orfani, ciclici o irraggiungibili;
- stato `published` sia della pagina sia dell'albero.

Le proprietà `technical.*` servono al software ma non raggiungono mai l'HTML.

## Resa sicura

Titoli, testo, liste, citazioni, immagini, gallerie, pulsanti, collegamenti,
contenitori, colonne, griglie e separatori producono elementi semantici. Tutto
il testo è codificato come testo, non interpretato come markup. I link accettano
soltanto HTTPS, percorsi locali, frammenti, telefono ed email; URL come
`javascript:` diventano `#`. Il renderer non produce campi `style`, gestori di
evento o script.

Le immagini possono usare solo un asset D1 corrente già autorizzato come
fotografia pubblica di una Voce o di un luogo. La URL servita rimane un endpoint
del Worker; documenti privati e media delle Memorie non diventano pubblici. Se
l'asset manca, compare un ripiego testuale accessibile.

I componenti specializzati sono già registrati, ma in questa unità usano una
resa semantica neutra. Gli adattatori per poesia, mappa, Voci, luoghi, fonti,
Memorie e moduli appartengono alla 13.4.

## Endpoint e SEO

`GET /api/public/visual-pages/:slug` restituisce soltanto un albero pubblicato:

- HTML semantico già sanitizzato;
- versione del registro;
- title, description, canonical e direttiva robots;
- dati strutturati `WebPage` per le pagine indicizzabili.

`accesso`, `spazio-personale` e `taccuino` mantengono `noindex,nofollow`, senza
canonical o dati strutturati. Il nuovo endpoint è JSON con `no-store` e non è
incluso nella sitemap. Le pagine pubbliche continuano a usare i renderer e i
ripieghi precedenti finché la migrazione dei componenti non è completa.

## Prove ripetibili

```sh
node --test worker/tests/visual-builder-renderer.test.mjs
node --test worker/tests/*.test.mjs
node scripts/check-seo.mjs
npx --yes wrangler@4 deploy --dry-run
```
