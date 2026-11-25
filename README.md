# FloatForge — document racine

_Révision : 2026-11-25_

## Sommaire
1. [Ce qu'est le projet](#ce-quest-le-projet)
2. [Documents](#documents)
3. [Arborescence](#arborescence)
4. [Lancer le site](#lancer-le-site)

## Ce qu'est le projet
FloatForge est un site statique (hébergé sur GitHub Pages) qui calcule les contrats d'échange (trade up) CS2 : probabilités, float de sortie, coût, valeur espérée, médiane, meilleure et pire issue, un générateur de contrats filtré par critères (tags) et un wiki des skins. Les prix de plusieurs marchés sont agrégés toutes les heures par une GitHub Action. Site : https://slapy-code.github.io/floatforge/

## Documents
| Document | Rôle |
|---|---|
| [CLAUDE.md](CLAUDE.md) | Contexte, hypothèses, décisions retenues |
| [BACKLOG.md](BACKLOG.md) | Actions prévues, priorisées |
| [SCHEMA.md](SCHEMA.md) | Architecture et flux de calcul (Mermaid) |
| [PIEGES.md](PIEGES.md) | Pièges rencontrés (code, outils, données) |
| [ARCHIVES/](ARCHIVES/) | Documents obsolètes |

## Arborescence
```
floatforge/
├── README.md            ← ce document
├── CLAUDE.md BACKLOG.md SCHEMA.md PIEGES.md
├── site/                ← le site (source)
│   ├── index.html       ← interface v2 (HTML + CSS + JS)
│   ├── assets/logo.svg  ← logo
│   ├── engine.js        ← moteur de calcul pur (testable sous Node)
│   └── data/
│       ├── cs2.json     ← skins, collections, caisses, pools couteaux (généré)
│       └── prices.json  ← prix multi-marchés v2 (généré par l'Action, absent en local)
├── dist/                ← version à publier (engine.js inliné)
├── tools/
│   ├── build_data.py    ← régénère data/cs2.json depuis ByMykel/CSGO-API
│   ├── build_dist.py    ← assemble dist/ (aperçu artifact)
│   └── update_prices.py ← agrège Skinport, Market.CSGO, csgotrader → site/data/prices.json
├── tests/test_engine.js ← tests du moteur (node tests/test_engine.js)
├── .github/workflows/prices.yml ← toutes les heures : prix + tests + déploiement Pages
└── ARCHIVES/
```

## Lancer le site
```
cd site && python3 -m http.server 8000   # puis http://localhost:8000
```
Le site doit être servi en HTTP (le fichier JSON est chargé par fetch, impossible en `file://`).
