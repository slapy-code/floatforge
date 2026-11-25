# PIÈGES — rencontrés pendant le développement

_Révision : 2026-11-25_

## Sommaire
1. [Données](#données)
2. [Réseau et environnement](#réseau-et-environnement)
3. [Calcul](#calcul)
4. [Interface](#interface)

## Données
- Dans skins.json, les **couteaux ont la rareté « Covert »** comme les armes : il faut les distinguer par la catégorie (Knives / Gloves).
- Les pools de couteaux viennent de `crates.json` (`contains_rare`) ; les phases Doppler y apparaissent plusieurs fois → dédoublonner par nom.
- Une collection peut avoir plusieurs caisses : fusionner les pools.
- Noms de marché : `StatTrak™ AK-47 | X (Field-Tested)` mais `★ StatTrak™ Karambit | Fade (Factory New)` (le ★ reste devant). Couteau vanilla : pas d'usure dans le nom.

## Réseau et environnement
- Depuis le conteneur Claude : jsDelivr et les sites de prix (Steam, Skinport, CSFloat) sont bloqués ; raw.githubusercontent.com fonctionne.
- Dans un artifact claude.ai, toute requête vers un autre site (images Steam, API de prix) est bloquée : les images sont masquées automatiquement, les prix doivent être importés.
- `/mnt/project-files` est un lien vers `/mnt/attach/project-files` : utiliser des chemins absolus dans les scripts.
- Le CDN d'images Steam (community.akamai.steamstatic.com) est bloqué depuis le conteneur : impossible de télécharger les icônes pour les embarquer. Le dépôt counter-strike-image-tracker n'a que ~360 rendus de skins, insuffisant.
- api.github.com refuse les dépôts non attachés ; un `git clone --filter=blob:none --no-checkout` anonyme marche pour lister des fichiers publics.
- Un heredoc + `( … &)` dans une même commande a été refusé par le contrôle de sécurité : lancer le serveur de test dans une commande séparée.

## Calcul
- Utiliser la formule **normalisée** (depuis oct. 2025) ; beaucoup d'anciens calculateurs utilisent encore la moyenne brute.
- Les floats sont des float32 dans le jeu : un résultat pile sur une limite (0,07, 0,15…) peut tomber d'un côté ou de l'autre. Garder une marge.
- Une entrée dont la collection n'a pas de rareté supérieure est refusée par le jeu.

## Interface
- `updatePriceBadge` plantait quand seuls les prix auto existaient (`prices.source` sur null) : toujours tester les 3 états (démo, auto, import).
- L'API Skinport répond en Brotli (`Accept-Encoding: br` obligatoire) : `pip install brotli` dans l'Action.
- Sans `<meta charset="utf-8">`, le site servi en local affiche les accents en mojibake (l'artifact l'ajoute tout seul).
- Le site doit être servi en HTTP : `fetch('data/cs2.json')` échoue en `file://`.
