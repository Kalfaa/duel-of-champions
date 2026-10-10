# Ascension du vide : points à trancher

Questions ouvertes après l'ajout de l'extension (étapes 1 à 4). Pour chacune : la situation actuelle dans le jeu, les options, et une recommandation. Cocher la case une fois la décision prise.

Liste complète des cartes et de leur état : [ascension-du-vide.md](ascension-du-vide.md).

---

## 1. Cartes implémentées mais absentes de tout deck

- [ ] **À décider**

Ces cartes fonctionnent dans le moteur mais ne sont dans aucun deck, donc on ne peut pas les jouer.

| Faction / école | Cartes |
|---|---|
| Havre | Capitaine, Justicier, Prétorien et Tireur d'élite du Loup ; Phalange impériale, Arbre de vérité, Trêve d'Elrath |
| Nécropole | Scelleuse de destin, Assassin vampire, Fileuse et Squelette de soie lunaire ; Autel de la Déesse araignée, Antre d'Ariana, Rite de transfert nécromantique |
| Inferno | Invocatrice du Néant ; Diablotin, Mastodonte et Cerbère des flammes infernales ; Pont des flammes infernales |
| Bastion | Gobelin du Crâne noir (classé Inferno dans la liste du wiki, Bastion sur sa fiche), Seigneur de guerre, Chevaucheur de vautour et Chantre de guerre du Crâne noir ; Attaque surprise, Appel de la Corne sanglante, Rituel des plumes de sang. Aucun deck Bastion n'existe encore |
| Sort de Terre | Étreinte de la terre |
| Neutres | Shi-no-shi, Élémentaire de feu supérieur, Spectre du Néant, Loup redoutable* ; Trône du renouveau, Réalignement cosmique, Tour de l'Oubli, Héritage, Monastère d'Hélexia, Malédiction de négation, Pillage |
| Sorts | Feu : Feu intérieur collectif, Arme ardente, Combustion. Ténèbres : Malédiction du pénitent, Désespoir, Entraves de soie lunaire. Terre : Nuage toxique, Bulbe vénéneux. Lumière : Pureté |

\* Le Loup redoutable est dans le deck de Takana. Les autres neutres listées n'apparaissent dans aucun deck.

Options :
- **A.** Les ajouter aux decks actuels de Siegfried, Namtaru et Kal-Azaar, en remplaçant certaines cartes.
- **B.** Créer de nouveaux decks pour ces factions, avec d'autres héros du Base set 1 (Cassandra, Jezziel, Sandalphon pour Havre ; Fleshbane, Nergal, Seria pour Nécropole ; Belias, Garant, Xorm pour Inferno). Il faudrait coder leurs pouvoirs.
- **C.** Les laisser hors decks pour l'instant.

Recommandation : **B**, qui suit la règle « nouveaux decks plutôt que modifier les anciens ». Elle demande toutefois de coder les héros du Base set 1.

## 2. Deck de Kal-Azaar non conforme

- [ ] **À décider**

- Il compte **29 cartes** au lieu de 30.
- Il contient **3 Diablotins du chaos**, alors que c'est une carte **unique** (1 exemplaire par deck dans Duel of Champions).

Options :
- **A.** Ramener le Diablotin du chaos à 1 exemplaire et compléter jusqu'à 30 avec d'autres cartes Inferno.
- **B.** Garder le deck tel quel.

Recommandation : **A**. Si c'est fait, le test « au plus un exemplaire de chaque carte unique » peut s'appliquer à tous les decks (aujourd'hui, il ne vérifie que les decks Sanctuaire).

## 3. PV des héros de base

- [ ] **À valider**

Chaque héros a maintenant ses PV officiels. **Namtaru et Kal-Azaar sont passés de 20 à 18 PV**, ce qui affaiblit Nécropole et Inferno face à Havre.

Options :
- **A.** Garder les valeurs officielles.
- **B.** Remettre 20 PV à tous les héros du Base set 1.

## 4. Raretés : la liste du wiki et la fiche de la carte ne concordent pas

- [ ] **À décider**

| Carte | Liste de l'extension | Fiche de la carte | Dans le jeu |
|---|---|---|---|
| Shanriya guard (Garde shanriya) | Commune | Peu commune | Peu commune |
| Fiery weapon (Arme ardente) | Peu commune | Commune | Peu commune |
| Poison cloud (Nuage toxique) | Peu commune | Commune | Peu commune |
| Honored land (Terre honorée) | Rare | Peu commune | Rare |
| Avalanche | Peu commune | Commune | Peu commune |
| Underwater fortress (Forteresse sous-marine) | Peu commune | Commune | Peu commune |
| Whirlpool (Tourbillon) | Peu commune | Commune | Peu commune |
| Path of the Ancestors (événement, pas encore ajouté) | Peu commune | Rare | — |

Options :
- **A.** Toujours suivre la liste de l'extension.
- **B.** Toujours suivre la fiche de la carte.

Le jeu mélange les deux sources aujourd'hui : la Garde shanriya suit la fiche, les autres suivent la liste. Il faut choisir une règle et l'appliquer partout.

## 5. Créatures « mêlée tireur »

- [ ] **À décider**

Le wiki donne le type « melee shooter » à 5 créatures. Le jeu ne connaît que mêlée, tireur et volant, alors elles sont toutes traitées comme des **tireurs** (ligne arrière, cible au choix dans le couloir) :

- Kirin
- Kirin sacré
- Garde shanriya
- Shinobi maître chanteur
- Fileuse de soie lunaire

Options :
- **A.** Garder « tireur ».
- **B.** Les passer en mêlée.
- **C.** Créer un type hybride, ce qui demande des règles de placement et d'attaque à définir.

Une confirmation de la règle officielle serait utile avant de choisir.

## 6. Interprétations de règles

- [ ] **À valider**

- **« Row » = couloir.** L'Explosion de feu touche toutes les créatures de son couloir, des deux côtés. Même lecture pour Ange gardien et Bulbe vénéneux (« enchant row ») et pour Nyorai sairensa (couloir interdit au déploiement ennemi).
- **Charge de Shi-no-shi.** Elle utilise la Charge déjà codée (l'autre créature du couloir de la cible). C'est cohérent avec la lecture « row = couloir ».
- **Salle des défis.** « Une seule créature ennemie par **ligne** » a été lu comme ligne avant / arrière.
- **Bouclier magique (Mizu-kami).** Il bloque aussi les dégâts des pouvoirs de héros (Agonie de Kal-Azaar, pouvoir d'Ishuma), qui sont comptés comme magiques.
- **Mur d'eau.** Il empêche d'attaquer toutes les créatures qui ont 2 ou moins en attaque, y compris celles du joueur qui l'a lancé.
- **Hypnose.** « Les créatures ennemies devant elle » a été lu comme toutes les créatures ennemies de son couloir.

## 7. Composition des 4 decks Sanctuaire

> Seul le deck de **Kaiko** est proposé pour l'instant (un deck par faction : `PLAYABLE_DECKS` dans [decks.ts](../../game-server/src/model/decks.ts)). Ceux d'Ishuma, de Takana et de Yukiko restent définis mais ne sont proposés ni au joueur ni à l'IA.

- [ ] **À valider**

Les decks d'Ishuma, Kaiko, Takana et Yukiko ont été composés sans référence officielle. Ils sont définis dans [game-server/src/model/decks.ts](../../game-server/src/model/decks.ts). Leurs 8 événements ont été choisis parmi ceux qui existent déjà.

## 8. Noms français

- [ ] **À valider**

Les noms français des cartes d'Ascension du vide sont des traductions maison, faute de liste officielle trouvée. Le nom de l'extension, « Ascension du vide », vient de la demande.

## 9. Cartes non implémentées

- [ ] **À décider pour chacune**

| Carte | Raison | Piste |
|---|---|---|
| Spell steal | Prendre un sort permanent adverse et le rejouer gratuitement, avec de nouvelles cibles. | Le choix après résolution existe maintenant (ajouté avec le Héraut du vide), mais il faudrait aussi rejouer le sort avec de nouvelles cibles. |
| Clashing Tides | Pas de fiche sur le wiki. | Trouver le texte de la carte ailleurs. |
| 4 événements | Étape 5. | Path of the Ancestors, Week of Austerity, Week of the Tamed Spirits, Week of the Wild Spirits. |

## 10. Faction Bastion

- [ ] **À valider**

Bastion est jouable avec un deck de **Kat, en quête de liberté** (Terre / Air, sans pouvoir). Le deck est composé d'archers gobelins, de cyclopes et de fortunes : Grand final de Kat, Le dernier carré, Arène, Bassin de sang, Hutte du chaman, Autel sacrificiel. Les 25 cartes Bastion du Base set 1 et les 7 d'Ascension du vide sont implémentées.

Restent à décider :

- **Composition du deck de Kat.** Faite sans référence officielle. Elle n'utilise aucune carte Bastion d'Ascension du vide ni aucune carte à Rage.
- **Autres héros Bastion.** Acamas, Kelthor et Shaar n'ont pas de deck. Un deck de Rage (Acamas ou Kelthor) utiliserait Cogneur ranaar, Guerrier jaguar, Chevaucheur de wyverne, Chantre de guerre, Camp orc et Appel de la Corne sanglante. Il faudrait coder leurs pouvoirs.
- **Grand final de Kat.** La créature est déployée gratuitement, sans vérifier ses conditions de Puissance, Magie et Destinée. Le texte de la carte ne dit pas s'il faut les remplir.
- **Appeleur de sang.** Il ne peut être joué qu'avec deux autres créatures alliées à sacrifier.

Interprétations à valider :

- **Double attaque.** ✅ Règle confirmée : la créature a deux phases d'attaque par tour ; le joueur lance chacune et en choisit la cible, et chaque attaque subit la riposte. Reste à valider : après sa première attaque, elle ne peut plus se déplacer ; elle perd sa rage après chaque attaque.
- **Rage.** ✅ Confirmé : les marqueurs sont reçus à la mort d'une **autre** créature alliée, pas de la créature elle-même.
- **Cumul des réductions de moitié.** Résistance à la magie, Intangible et Mousson s'appliquent l'une après l'autre (×½ chacune).

