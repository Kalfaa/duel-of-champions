# Le Héraut du vide : points à trancher

Questions ouvertes après l'ajout de l'extension. Pour chacune : la situation actuelle dans le jeu, les options, et une recommandation. Cocher la case une fois la décision prise.

Liste complète des cartes et de leur état : [heraut-du-vide.md](heraut-du-vide.md).

---

## 1. Les 5 héros ne sont pas proposés

- [ ] **À décider**

Alia (Havre), Adar-Malik (Nécropole), Dhamiria (Inferno), Noboru (Sanctuaire) et Zardoc (Bastion) ont chacun un deck de 30 cartes, joué sans erreur par l'IA dans les tests. Mais le menu ne propose qu'un deck par faction (`PLAYABLE_DECKS` dans [decks.ts](../../game-server/src/model/decks.ts)), et ce sont toujours les decks précédents.

Options :
- **A.** Garder les decks actuels.
- **B.** Remplacer, faction par faction, le deck proposé par celui du héros du Héraut du vide.
- **C.** Proposer plusieurs decks par faction.

## 2. Composition des 5 decks

- [ ] **À valider**

Les decks ont été composés sans référence officielle, surtout avec les cartes de l'extension. Leurs 8 événements mélangent les anciens et les 3 nouveaux (Arbitres aveugles, Équilibre cosmique, Jour du Sanctuaire).

## 3. Carte non faite : Unmei-kami

- [ ] **À décider**

« Quand elle blesse le héros ennemi, regardez la main adverse : vous pouvez y jouer un sort ou une fortune (en payant son coût et en remplissant ses conditions). » Jouer une carte de l'adversaire, avec ses propres choix de cibles, demande un mécanisme de plus. Sa Protection contre les fortunes, elle, existe déjà dans le moteur.

Options : l'ajouter plus tard, ou l'ajouter avec seulement sa Protection contre les fortunes.

## 4. Écarts volontaires avec le texte officiel

- [ ] **À valider**

- **Autel des souhaits.** Le texte dit « jouez-la gratuitement ». La carte révélée va **dans la main** et ne coûte rien ce tour-ci : la jouer tout de suite demanderait de choisir ses cibles au milieu de la résolution.
- **Chanteuse du ruisseau et Rappel mineur.** Ils renvoient une carte permanente en jeu (sort global, de couloir, ou fortune), mais pas un enchantement posé sur une créature.
- **Brise-sorts du Crâne noir.** En visant une créature, on détruit son **dernier** enchantement posé.
- **Voyant du chaos, Lacérateur du chaos, Chambre de la démence.** Les défausses se font **au hasard**, et non au choix du joueur qui défausse.
- **Garde du Loup.** Son texte parle du « Capitaine du Loup » (erreur du wiki ou de la carte). Il a été lu comme « gagne +1 en attaque et en riposte par créature alliée adjacente ».
- **Chaton guerrier.** Il n'a aucune condition de Puissance, Magie ou Destinée (champ vide sur le wiki).
- **Mort silencieuse.** Si la créature enchantée meurt avant le début de votre tour, le sort va au cimetière (il ne revient en main que s'il la tue).

## 5. Interprétations de règles

- [ ] **À valider**

- **Peur N.** Elle compare N à la **Puissance exigée par la carte** de l'attaquant.
- **Imposante.** Elle protège les **autres** créatures alliées de son couloir (pas elle-même), contre les attaques et contre les dégâts de combat (attaque, riposte, Charge, Balayage). Les dégâts d'Explosion et des sorts ne sont pas bloqués.
- **Berserk.** L'attaque d'office vise la première cible à portée et sa riposte est résolue tout de suite. Une créature déployée ce tour-ci n'attaque pas.
- **Riposte parfaite.** Elle ignore les gardes, l'Armure, Imposante, les réductions de moitié et les protections.
- **Protection contre les fortunes et contre les sorts ennemis.** La créature ne peut pas être ciblée par ces cartes. Elle ne subit ni leurs dégâts, ni leurs marqueurs, ni leurs enchantements, ni leurs déplacements.
- **« Piocher en dehors du ravitaillement » (Arbitre du Néant, Salles de l'inertie).** La pioche du héros (1 ressource) est aussi bloquée.
- **Okane no okane.** Il bloque les gains de ressources des cartes et capacités (Héritage, Tourbillon, Provisions volées…), pas la production du tour ni les hausses de production (Mine d'or, Shinobi).
- **Gardien du Néant.** Les créatures bannies à leur mort ne comptent pas comme « mises au cimetière » (Chevaucheur de vautour, Adar-Malik).
- **Pouvoir d'Adar-Malik.** Il propose les créatures mises au cimetière depuis la fin de votre dernier tour, quelle que soit la façon (mort, défausse…).
