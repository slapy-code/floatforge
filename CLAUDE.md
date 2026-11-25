# CLAUDE.md — contexte et décisions

_Révision : 2026-11-25_

## Sommaire
1. [Demande](#demande)
2. [Règles de calcul retenues](#règles-de-calcul-retenues)
3. [Données](#données)
4. [Décisions techniques](#décisions-techniques)
5. [Hypothèses à confirmer](#hypothèses-à-confirmer)
6. [Conventions](#conventions)

## Demande
Alex veut un site qui fait ce que font TradeUpSpy et CSFloat (calculateur de trade up), « en beaucoup mieux » : choix de rareté, skins, floats, prix ; résultats complets (probabilités, gain/perte, coût total, float moyen, meilleure/pire issue, moyenne, médiane…) ; plus un générateur de tous les contrats possibles filtrés par tags (100 % gagnant, 100 % remboursé…). Carte blanche sur le nom et le design, thème sombre. Nom choisi : **FloatForge**.

## Règles de calcul retenues
- 10 entrées de même rareté → 1 skin de la rareté suivante. 5 Covert → 1 couteau/gants (depuis le 22/10/2025).
- Pas de mélange StatTrak / normal. 5 Covert StatTrak → couteau StatTrak, jamais de gants.
- P(issue) = (entrées de sa collection / entrées totales) / nb de sorties de la collection.
- Couteaux/gants : pool = tous les objets dorés de la caisse liée à la collection ; équiprobables par finition. Collections carte/Armory : pas de pool.
- Float de sortie (formule normalisée, défaut) : `min_out + moyenne((f − min_in)/(max_in − min_in)) × (max_out − min_out)`. L'ancienne formule (moyenne brute) reste disponible.
- Sources : ZAP-Hosting et CSDB (pas de doc Valve officielle). Vérifié : l'exemple ZAP (0,2590) est reproduit par les tests.

## Données
- Icônes : URLs Steam CDN de ByMykel. Bloquées dans l'aperçu artifact (CSP) et depuis le conteneur, visibles sur le site hébergé ; repli sur une vignette texte.
- Skins, plages de float, collections, caisses : ByMykel/CSGO-API (GitHub, licence MIT), converties par `tools/build_data.py`.
- Prix (format v2, décision 2026-11-25 suite à la demande d'Alex « pas que Steam, comme csgoskins.gg ») : GitHub Action horaire (`tools/update_prices.py`) qui agrège **Skinport (API officielle), Market.CSGO (API officielle) et l'agrégateur gratuit prices.csgotrader.app** (fichiers par marché latest/<marché>.json : Buff163, YouPin, CSFloat, CS.MONEY, Lis-Skins, C5Game, Loot.Farm, CSGOEmpire, Swap.gg, Steam ; USD converti). Prix de référence = médiane des marchés « cash » (hors Steam et sites d'échange) sans valeurs aberrantes (÷3 / ×3). Champs : ref, low, med7, med30, vol7, qty, prix par marché. Le site utilise la référence par défaut.
- Les sites qui exigent une clé (CSFloat API, Pricempire, csgoskins.gg API) ne sont pas utilisés ; une sonde de nombreux sites via GitHub Actions a été refusée par le contrôle de sécurité de Claude : s'en tenir aux API documentées.
- Priorité des prix : correction manuelle > import manuel > prix auto > prix de démo (uniquement si aucun prix auto, ex. aperçu artifact).

## Décisions techniques
- Site 100 % statique, sans framework ni build obligatoire : `index.html` + `engine.js` + `data/cs2.json`.
- Moteur séparé de l'UI pour pouvoir le tester sous Node.
- Générateur : front de Pareto (prix / float normalisé) par collection et par usure, puis combinaisons à 1 ou 2 collections et toutes les répartitions. ~940 000 contrats testés en ~3 s pour les Restreint.
- Stockage local (localStorage) : contrat en cours, prix importés, corrections, réglages du générateur.
- Aperçu privé : https://claude.ai/artifact/7qrHQMs6dfzACDcwtWG13e.
- Hébergement public choisi : **GitHub Pages** (dépôt public `floatforge` à créer par Alex), déploiement par la même Action que les prix.
- Design v2 (2026-11-25, demande d'Alex « 100× plus pro, comme CSFloat / CS.MONEY / csgoskins.gg ») : navigation avec méga-menu des armes (icônes), recherche globale, calculateur en cases d'objets, synthèse collante, issues en cartes, fiche skin façon csgoskins.gg (usures à gauche, offres par marché à droite avec boutons « Voir l'offre »). Police Inter, bleu #3b82f6 sur bleu nuit.
- Logo (révisé 2026-11-25, demande d'Alex « juste une enclume moderne stylisée ») : enclume seule, dégradés bleus, sans fond ; `site/assets/logo.svg`, aussi en favicon inline.
- Barre du haut : tous les outils restent accessibles sur toutes les tailles d'écran (plus de menu burger ; sur mobile la navigation passe sur une 2e ligne).
- Générateur : filtre par collections (recherche + cases) avec deux modes : « Uniquement celles-ci » (toutes les entrées des collections cochées) ou « Au moins une » (une collection cochée, mélangée avec n'importe quelle autre).
- Icônes : restent sur le CDN Steam (le problème signalé venait de la connexion d'Alex, pas du site).
- Cases du simulateur : boutons Dupliquer (une copie) et Remplir (complète les cases vides avec ce skin).
- Wiki : vues Skins (filtres catégorie/rareté, tri) et Collections, fiches détaillées, liens trade up.

## Hypothèses à confirmer
- Définition des tags « 100 % gagnant » (pire issue > coût) et « remboursé » (pire issue ≥ seuil % du coût, 90 % par défaut).
- Devise : EUR supposé (non confirmé).
- Site en ligne : https://slapy-code.github.io/floatforge/ (dépôt public github.com/slapy-code/floatforge, Pages source = GitHub Actions), depuis le 2026-11-25.

## Conventions
Documents tenus à jour : README.md (racine), CLAUDE.md, BACKLOG.md, SCHEMA.md, PIEGES.md. Titre, date de révision, sommaire. Les documents obsolètes vont dans ARCHIVES/. Langue : français.
