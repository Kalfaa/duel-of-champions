# Le Héraut du vide (Herald of the Void)

Troisième extension de *Might & Magic: Duel of Champions* : 103 cartes, réparties sur les cinq factions du jeu.
Source : [wiki Might and Magic](https://mightandmagic.fandom.com/wiki/Herald_of_the_Void_(pack)). Données : `data/herald_of_the_void.json`.

Les decks des 5 héros existent (`game-server/src/model/decks.ts`) mais ne sont pas proposés dans le menu (un deck par faction pour l'instant).

| Carte (nom officiel) | Type | Faction / école | Rareté | État dans le jeu |
|---|---|---|---|---|
| Adar-Malik, Caller of Doom | Héros | Nécropole | Héroïque | ✅ Adar-Malik, appel du destin |
| Alia, Caller of Faith | Héros | Havre | Héroïque | ✅ Alia, appel de la foi |
| Dhamiria, Caller of Madness | Héros | Inferno | Héroïque | ✅ Dhamiria, appel de la folie |
| Noboru, Caller of Twilight | Héros | Sanctuaire | Héroïque | ✅ Noboru, appel du crépuscule |
| Zardoc, Caller of Valor | Héros | Bastion | Héroïque | ✅ Zardoc, appel de la bravoure |
| Blackskull cyclops | Créature | Bastion | Unique | ✅ Cyclope du Crâne noir |
| Chaos seer | Créature | Inferno | Unique | ✅ Voyant du chaos |
| Griffin battle priest | Créature | Havre | Unique | ✅ Prêtre de bataille griffon |
| Namtaru channeler | Créature | Nécropole | Unique | ✅ Canalisatrice namtaru |
| Shinje warrior | Créature | Sanctuaire | Unique | ✅ Guerrier shinje |
| Bloodfrenzied wyvern | Créature | Bastion | Rare | ✅ Wyverne frénétique |
| Greater earth elemental | Créature | Neutre | Rare | ✅ Élémentaire de terre supérieur |
| Immaculate glory | Créature | Havre | Rare | ✅ Gloire immaculée |
| Living nightmare | Créature | Nécropole | Rare | ✅ Cauchemar vivant |
| Void arbiter | Créature | Inferno | Rare | ✅ Arbitre du Néant |
| Void keeper | Créature | Neutre | Rare | ✅ Gardien du Néant |
| Unmei-kami | Créature | Sanctuaire | Rare | ❌ Jouer une carte de la main adverse : non fait |
| Angel of Mercy | Créature | Havre | Peu commune | ✅ Ange de miséricorde |
| Blackskull crusher | Créature | Bastion | Peu commune | ✅ Broyeur du Crâne noir |
| Blackskull shredder | Créature | Bastion | Peu commune | ✅ Déchiqueteur du Crâne noir |
| Blackskull spellsmasher | Créature | Bastion | Peu commune | ✅ Brise-sorts du Crâne noir |
| Chaos lacerator | Créature | Inferno | Peu commune | ✅ Lacérateur du chaos |
| Dark Wood hermit | Créature | Nécropole | Peu commune | ✅ Ermite du Bois sombre |
| Dark Wood treant | Créature | Neutre | Peu commune | ✅ Sylvestre du Bois sombre |
| Decay spitter | Créature | Nécropole | Peu commune | ✅ Cracheur de pourriture |
| Griffin knight | Créature | Havre | Peu commune | ✅ Chevalier griffon |
| Griffin mounted spearman | Créature | Havre | Peu commune | ✅ Lancier monté sur griffon |
| Hellfire maniac | Créature | Inferno | Peu commune | ✅ Maniaque des flammes infernales |
| Kabuki tei | Créature | Sanctuaire | Peu commune | ✅ Kabuki tei |
| Lurker in the Dark | Créature | Inferno | Peu commune | ✅ Rôdeur des ténèbres |
| Magic peddler | Créature | Neutre | Peu commune | ✅ Colporteur de magie |
| Soul-consuming lich | Créature | Nécropole | Peu commune | ✅ Liche dévoreuse d'âmes |
| Stream singer | Créature | Sanctuaire | Peu commune | ✅ Chanteuse du ruisseau |
| Venerable kappa | Créature | Sanctuaire | Peu commune | ✅ Kappa vénérable |
| Blackskull centaur | Créature | Bastion | Commune | ✅ Centaure du Crâne noir |
| Bramble beast | Créature | Bastion | Commune | ✅ Bête des ronces |
| Chosen of Elrath | Créature | Havre | Commune | ✅ Élu d'Elrath |
| Griffin marksman | Créature | Havre | Commune | ✅ Tireur d'élite griffon |
| Hangman tree | Créature | Nécropole | Commune | ✅ Arbre aux pendus |
| Hellfire bloater | Créature | Inferno | Commune | ✅ Gonfleur des flammes infernales |
| Hellfire slave | Créature | Inferno | Commune | ✅ Esclave des flammes infernales |
| Kitten warrior | Créature | Bastion | Commune | ✅ Chaton guerrier |
| Lesser water elemental | Créature | Neutre | Commune | ✅ Élémentaire d'eau mineur |
| Naga yokujin | Créature | Sanctuaire | Commune | ✅ Naga yokujin |
| Okane no okane | Créature | Sanctuaire | Commune | ✅ Okane no okane |
| Serpentfly | Créature | Neutre | Commune | ✅ Serpentaile |
| Skeleton archer | Créature | Nécropole | Commune | ✅ Archer squelette |
| Untamed wraith | Créature | Nécropole | Commune | ✅ Spectre indompté |
| Ur-Khrag enforcer | Créature | Inferno | Commune | ✅ Exécuteur ur-khrag |
| War oliphant | Créature | Bastion | Commune | ✅ Oliphant de guerre |
| Waterfall guardians | Créature | Sanctuaire | Commune | ✅ Gardiens de la cascade |
| Wolf guard | Créature | Havre | Commune | ✅ Garde du Loup |
| The Forbidden Flame | Sort | Feu | Unique | ✅ La flamme interdite |
| The Gate to Nowhere | Sort | Primordiale | Unique | ✅ La porte vers nulle part |
| The Light of Tomorrow | Sort | Lumière | Unique | ✅ La lumière de demain |
| The Might of Nature | Sort | Terre | Unique | ✅ La force de la nature |
| The Silent Death | Sort | Ténèbres | Unique | ✅ La mort silencieuse |
| The Song of the Lost | Sort | Air | Unique | ✅ Le chant des perdus |
| The Strength of the Sea | Sort | Eau | Unique | ✅ La force de la mer |
| Cursed chains | Sort | Ténèbres | Peu commune | ✅ Chaînes maudites |
| Fate bender | Créature | Inferno | Rare | ✅ Plieur de destin |
| Fiery rage | Sort | Feu | Peu commune | ✅ Rage ardente |
| Ice splinters | Sort | Eau | Peu commune | ✅ Éclats de glace |
| Resolute stand | Sort | Lumière | Peu commune | ✅ Résolution |
| Sylanna's embrace | Sort | Terre | Peu commune | ✅ Étreinte de Sylanna |
| Wind gust | Sort | Air | Peu commune | ✅ Rafale |
| Earth bound | Sort | Terre | Commune | ✅ Ancrage |
| Heat wave | Sort | Feu | Commune | ✅ Vague de chaleur |
| Ice shell | Sort | Eau | Commune | ✅ Carapace de glace |
| Intimidation | Sort | Ténèbres | Commune | ✅ Intimidation |
| Lightning strike | Sort | Air | Commune | ✅ Frappe de la foudre |
| Lightspeed | Sort | Lumière | Commune | ✅ Célérité |
| Minor recall | Sort | Primordiale | Commune | ✅ Rappel mineur |
| Altar of Wishes | Fortune | Neutre | Rare | ✅ Autel des souhaits |
| Battle trance | Fortune | Sanctuaire | Rare | ✅ Transe de combat |
| Blood of my tribe | Fortune | Bastion | Rare | ✅ Le sang de ma tribu |
| Offensive stance | Fortune | Havre | Rare | ✅ Posture offensive |
| Seria's last order | Fortune | Nécropole | Rare | ✅ Le dernier ordre de Seria |
| Turncoats | Fortune | Neutre | Rare | ✅ Renégats |
| Void rift | Fortune | Inferno | Rare | ✅ Faille du Néant |
| Early grave | Fortune | Nécropole | Peu commune | ✅ Tombe précoce |
| Gold mine | Fortune | Neutre | Commune | ✅ Mine d'or |
| Revised tactics | Fortune | Neutre | Peu commune | ✅ Tactiques révisées |
| Scrying pool | Fortune | Sanctuaire | Peu commune | ✅ Bassin de divination |
| Stampede | Fortune | Bastion | Peu commune | ✅ Débandade |
| Strength in numbers | Fortune | Havre | Commune | ✅ La force du nombre |
| Void judgement | Fortune | Inferno | Peu commune | ✅ Jugement du Néant |
| Chamber of Dementia | Fortune | Inferno | Commune | ✅ Chambre de la démence |
| Consume minions | Fortune | Nécropole | Commune | ✅ Consumer les serviteurs |
| Elrath's blessing | Fortune | Havre | Commune | ✅ Bénédiction d'Elrath |
| Forgotten cave | Fortune | Neutre | Commune | ✅ Caverne oubliée |
| Hall of Fortune | Fortune | Sanctuaire | Commune | ✅ Salle de la fortune |
| Halls of Inertia | Fortune | Inferno | Commune | ✅ Salles de l'inertie |
| Higher learning | Fortune | Neutre | Commune | ✅ Savoir supérieur |
| Rite of Necromantic Restoration | Fortune | Nécropole | Commune | ✅ Rite de restauration nécromantique |
| Orc armory | Fortune | Bastion | Commune | ✅ Armurerie orc |
| Sister's tent | Fortune | Havre | Commune | ✅ La tente des sœurs |
| Spy report | Fortune | Sanctuaire | Commune | ✅ Rapport d'espion |
| Blind Arbiters | Événement | — | Rare | ✅ Arbitres aveugles |
| Cosmic Balance | Événement | — | Rare | ✅ Équilibre cosmique |
| Conscription Day | Événement | — | Peu commune | ✅ Jour de la conscription (déjà en jeu) |
| Day of the Sanctuary | Événement | — | Peu commune | ✅ Jour du Sanctuaire |
| Hail Storm | Événement | — | Commune | ✅ Tempête de grêle (déjà en jeu) |
