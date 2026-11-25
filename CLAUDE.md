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
- Prix (décision 2026-11-25, option A d'Alex) : **API publique Skinport, EUR**, récupérée toutes les heures par GitHub Actions (`tools/update_prices.py`) dans `site/data/prices.json` : prix mini, suggéré, quantité, moyenne 24 h, médianes 7/30/90 j, volume 7 j. Le site choisit le champ (mini par défaut).
- Priorité des prix : correction manuelle > import manuel > prix auto > prix de démo (uniquement si aucun prix auto, ex. aperçu artifact).

## Décisions techniques
- Site 100 % statique, sans framework ni build obligatoire : `index.html` + `engine.js` + `data/cs2.json`.
- Moteur séparé de l'UI pour pouvoir le tester sous Node.
- Générateur : front de Pareto (prix / float normalisé) par collection et par usure, puis combinaisons à 1 ou 2 collections et toutes les répartitions. ~940 000 contrats testés en ~3 s pour les Restreint.
- Stockage local (localStorage) : contrat en cours, prix importés, corrections, réglages du générateur.
- Aperçu privé : https://claude.ai/artifact/7qrHQMs6dfzACDcwtWG13e.
- Hébergement public choisi : **GitHub Pages** (dépôt public `floatforge` à créer par Alex), déploiement par la même Action que les prix.
- Wiki : onglet dédié (skins / collections), fiche skin avec plage de float, prix par usure et variations 7/30 j, liens trade up (peut donner / obtenu depuis), pools couteaux.

## Hypothèses à confirmer
- Définition des tags « 100 % gagnant » (pire issue > coût) et « remboursé » (pire issue ≥ seuil % du coût, 90 % par défaut).
- Devise : EUR supposé (non confirmé).
- En attente : pseudo GitHub d'Alex et création du dépôt pour la mise en ligne.

## Conventions
Documents tenus à jour : README.md (racine), CLAUDE.md, BACKLOG.md, SCHEMA.md, PIEGES.md. Titre, date de révision, sommaire. Les documents obsolètes vont dans ARCHIVES/. Langue : français.
