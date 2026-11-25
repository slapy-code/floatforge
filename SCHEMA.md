# SCHEMA — architecture et flux de calcul

_Révision : 2026-11-25_

## Sommaire
1. [Architecture](#architecture)
2. [Calcul d'un contrat](#calcul-dun-contrat)
3. [Générateur](#générateur)

## Architecture
```mermaid
flowchart LR
  API[ByMykel/CSGO-API<br/>skins.json, crates.json] -->|tools/build_data.py| DATA[site/data/cs2.json]
  SKP[API Skinport] -->|GitHub Action horaire<br/>tools/update_prices.py| PJ[site/data/prices.json]
  PJ --> UI
  PRIX[Fichier de prix importé<br/>Skinport / JSON / CSV] -->|localStorage| UI
  UI -->|GitHub Pages| WEB[Site public]
  DATA --> UI[index.html<br/>Calculateur · Générateur · Wiki · Prix · Méthode]
  UI <--> ENG[engine.js<br/>moteur pur]
  ENG --> TESTS[tests/test_engine.js]
  UI -->|tools/build_dist.py| DIST[dist/ à publier]
```

## Calcul d'un contrat
```mermaid
flowchart TD
  A[Entrées : skin, float, quantité, prix] --> B{10 entrées ?<br/>5 si Covert}
  B -->|non| E[Erreur affichée]
  B -->|oui| C[Float normalisé de chaque entrée]
  C --> D[Moyenne normalisée]
  A --> F[Comptage par collection]
  F --> G[Sorties possibles :<br/>rareté +1 ou pool couteaux/gants]
  G --> H[P = part de la collection / nb sorties]
  D --> I[Float de sortie = min + moy × plage]
  I --> J[Usure → prix → net après frais]
  H --> K[Stats : VE, ROI, médiane,<br/>pire, meilleure, écart-type, P profit]
  J --> K
```

## Générateur
```mermaid
flowchart TD
  P[Réglages : rareté, StatTrak, usures,<br/>position dans la tranche, budget] --> C[Candidats par collection<br/>front de Pareto prix / float]
  C --> M[Combinaisons 1 ou 2 collections<br/>répartitions 1/9 … 9/1]
  M --> EV[Évaluation de chaque contrat]
  EV --> T{Tous les tags cochés ?}
  T -->|oui| R[Tri et 100 meilleurs]
  R --> O[Ouvrir dans le calculateur]
```
