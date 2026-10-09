# Verifica della fondazione SEO

Verifica eseguita il 9 ottobre 2026 dopo l’integrazione della PR #1 nel branch
`main` (merge `7d5f8ef015ee659494e3ab08f74c6c52808b1542`).

| Controllo | Esito | Prova |
|---|---|---|
| Controllo SEO e contenuti | Superato | GitHub Actions `37953788303` |
| Pubblicazione Worker Cloudflare | Superata | GitHub Actions `37953788183` |
| Health Worker | HTTP 200 | `contentSchema: 2`, servizio `nnmrcn-rete` |
| `robots.txt` pubblico | HTTP 200 | `https://anonmrcn-ctrl.github.io/robots.txt` |
| `sitemap.xml` pubblica | HTTP 200 | `https://anonmrcn-ctrl.github.io/sitemap.xml` |
| Controllo locale | Superato | 9 pagine indicizzabili, 4 escluse, 9 title unici |

La fondazione non introduce cookie pubblicitari. Le pagine di accesso,
amministrazione, spazio personale e taccuino dichiarano `noindex` e non sono
incluse nella sitemap.