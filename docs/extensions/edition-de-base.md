# Édition de base (Base set 1)

Première extension de *Might & Magic: Duel of Champions* : 224 cartes (16 héros, 86 créatures, 63 sorts, 47 fortunes, 12 événements), réparties sur les cinq factions.
Source : [wiki Might and Magic](https://mightandmagic.fandom.com/wiki/Base_set_1). Données : `data/base_set_1.json`.

Toutes les cartes sont jouables et proposées dans la construction de decks. Les héros sans deck prédéfini (12 sur 16) ne sont disponibles que dans les decks construits par les joueurs.

## Choix d'interprétation

Le texte du wiki est parfois incomplet ou ambigu ; voici comment il a été lu.

- **Persistant** (Blizzard, Contagion, Vitesse de l'éclair, Protection des arcanes, Peau de pierre, Hiver éternel) : quand la créature enchantée quitte le jeu, le sort enchante une autre créature au hasard du même camp au lieu d'aller au cimetière.
- **Blizzard, Contagion** : au début du tour de chaque joueur, ils frappent la créature enchantée, puis *passent* (et non se copient) sur une créature adjacente au hasard du même camp, si elle n'a pas déjà ce sort.
- **Immolation** : le wiki indique « Enchant creature », mais l'effet porte sur toutes les créatures ; elle est jouée comme un sort global.
- **Martyr** : seuls les dégâts dont la source est connue comme adverse (créatures, sorts et fortunes adverses) sont empêchés ; le poison et les événements ne le sont pas.
- **Tordeur de sorts** : le sort pris devient gratuit ce tour-ci ; s'il est joué, il va au cimetière de son nouveau propriétaire (et non de l'adversaire) ; sinon, il va au cimetière adverse à la fin du tour.
- **Siphon d'âmes** (texte du wiki tronqué) : le sort choisi devient gratuit ce tour-ci, au lieu d'être joué immédiatement.
- **Garde impériale** : elle subit aussi les dégâts « non combattants » infligés au héros (bibliothèque vide, contrecoup…).
- **Mère couveuse** : la larve prend la ligne de la couveuse morte (une larve de mêlée à l'avant, tireuse à l'arrière).
- **Croisé solaire** : chaque Croisé solaire en jeu fait grandir les piles de 1 ; c'est la première destruction par un chevalier allié du tour qui compte, pendant le tour de son propriétaire.
- **Cristal de révélation** : seules les créatures gagnent Bouclier magique (aucune carte n'inflige de dégâts magiques au héros pour l'instant).
- **Prison** : la production adverse continue d'augmenter, mais l'adversaire reçoit 0 ressource à son prochain ravitaillement.
- **Semaine des mercenaires** : le dessus de la bibliothèque est annoncé dans le journal ; le bonus suit la carte du dessus tant que l'effet dure.

| Carte (nom officiel) | Type | Faction / école | Rareté | État dans le jeu |
|---|---|---|---|---|
| Acamas, Champion of the Bloodhorn | Héros | Bastion | Héroïque | ✅ Acamas, champion de la Corne sanglante |
| Belias, Lord of the Kennels | Héros | Inferno | Héroïque | ✅ Belias, seigneur des chenils |
| Cassandra, Seeker of Light | Héros | Havre | Héroïque | ✅ Cassandra, en quête de lumière |
| Fleshbane, Champion of the Misshapen | Héros | Nécropole | Héroïque | ✅ Fleshbane, champion des Difformes |
| Garant, Seeker of Discord | Héros | Inferno | Héroïque | ✅ Garant, en quête de discorde |
| Jezziel, Invoker of Hope | Héros | Havre | Héroïque | ✅ Jezziel, invocateur de l'espoir |
| Kal-Azaar, Invoker of Agony | Héros | Inferno | Héroïque | ✅ Kal-Azaar, invocateur de l'agonie |
| Kat, Seeker of Freedom | Héros | Bastion | Héroïque | ✅ Kat, en quête de liberté |
| Kelthor, Lord of Fury | Héros | Bastion | Héroïque | ✅ Kelthor, seigneur de la fureur |
| Mother Namtaru, Invoker of Death | Héros | Nécropole | Héroïque | ✅ Mère Namtaru, invocatrice de la mort |
| Nergal, Lord of Pestilence | Héros | Nécropole | Héroïque | ✅ Nergal, seigneur de la pestilence |
| Sandalphon, Lord of Power | Héros | Havre | Héroïque | ✅ Sandalphon, seigneur du pouvoir |
| Seria, Seeker of the Lost Souls | Héros | Nécropole | Héroïque | ✅ Seria, en quête des âmes perdues |
| Shaar, Invoker of the Skies | Héros | Bastion | Héroïque | ✅ Shaar, invocateur des cieux |
| Siegfried, Champion of Faith | Héros | Havre | Héroïque | ✅ Siegfried, champion de la foi |
| Xorm, Champion of the Abyss | Héros | Inferno | Héroïque | ✅ Xorm, champion de l'Abîme |
| Atropos, Weaver of the Dead | Créature | Nécropole | Unique | ✅ Atropos, tisseuse des morts |
| Blood caller | Créature | Bastion | Unique | ✅ Appeleur de sang |
| Chaos imp | Créature | Inferno | Unique | ✅ Diablotin du chaos |
| Dark assassin | Créature | Neutre | Unique | ✅ Assassin des ténèbres |
| Doom bringer | Créature | Inferno | Unique | ✅ Porteur de destruction |
| Eleonore, the Voice of Harmony | Créature | Havre | Unique | ✅ Éléonore, voix de l'harmonie |
| Imperial guard | Créature | Havre | Unique | ✅ Garde impériale |
| The Banshee | Créature | Nécropole | Unique | ✅ La Banshee |
| Wyvern rider | Créature | Bastion | Unique | ✅ Chevaucheur de wyverne |
| Abyssal lord | Créature | Inferno | Rare | ✅ Seigneur abyssal |
| Breeder mother | Créature | Inferno | Rare | ✅ Mère couveuse |
| Celestial | Créature | Havre | Rare | ✅ Céleste |
| Chaos sorceress | Créature | Inferno | Rare | ✅ Sorcière du chaos |
| Enraged cyclops | Créature | Bastion | Rare | ✅ Cyclope enragé |
| Fate weaver | Créature | Nécropole | Rare | ✅ Tisseuse du destin |
| Ghost dragon | Créature | Nécropole | Rare | ✅ Dragon spectral |
| Moonsilk spider | Créature | Neutre | Rare | ✅ Araignée de soie lunaire |
| Panther warrior | Créature | Bastion | Rare | ✅ Guerrier panthère |
| Pao deathseeker | Créature | Neutre | Rare | ✅ Traqueur de mort pao |
| Pit lord | Créature | Inferno | Rare | ✅ Seigneur des fosses |
| Raging smasher | Créature | Bastion | Rare | ✅ Cogneur enragé |
| Sun crusader | Créature | Havre | Rare | ✅ Croisé solaire |
| Vampire lord | Créature | Nécropole | Rare | ✅ Seigneur vampire |
| Vestal | Créature | Havre | Rare | ✅ Vestale |
| Angry wyvern | Créature | Neutre | Peu commune | ✅ Wyverne furieuse |
| Archlich | Créature | Nécropole | Peu commune | ✅ Archiliche |
| Blazing glory | Créature | Havre | Peu commune | ✅ Gloire ardente |
| Centaur marauder | Créature | Bastion | Peu commune | ✅ Maraudeur centaure |
| Cerberus | Créature | Inferno | Peu commune | ✅ Cerbère |
| Crusher | Créature | Bastion | Peu commune | ✅ Broyeur |
| Cyclops brawler | Créature | Bastion | Peu commune | ✅ Cyclope bagarreur |
| Dreamreaver | Créature | Bastion | Peu commune | ✅ Faucheur de rêves |
| Elite squire | Créature | Havre | Peu commune | ✅ Écuyer d'élite |
| Fate spinner | Créature | Nécropole | Peu commune | ✅ Fileuse du destin |
| Helexian librarian | Créature | Neutre | Peu commune | ✅ Bibliothécaire hélexien |
| Holy praetorian | Créature | Havre | Peu commune | ✅ Prétorien sacré |
| Imperial griffin | Créature | Havre | Peu commune | ✅ Griffon impérial |
| Jaguar warrior | Créature | Bastion | Peu commune | ✅ Guerrier jaguar |
| Lacerator | Créature | Inferno | Peu commune | ✅ Lacérateur |
| Lesser shadow elemental | Créature | Neutre | Peu commune | ✅ Élémentaire d'ombre mineur |
| Pit fiend | Créature | Inferno | Peu commune | ✅ Démon des fosses |
| Putrid lamasu | Créature | Nécropole | Peu commune | ✅ Lamassu putride |
| Ravager | Créature | Inferno | Peu commune | ✅ Ravageur |
| Ravenous ghoul | Créature | Nécropole | Peu commune | ✅ Goule vorace |
| Striking fury | Créature | Bastion | Peu commune | ✅ Furie frappeuse |
| Tithe collector | Créature | Havre | Peu commune | ✅ Percepteur de la dîme |
| Vampire knight | Créature | Nécropole | Peu commune | ✅ Chevalier vampire |
| Vengeful spectre | Créature | Nécropole | Peu commune | ✅ Spectre vengeur |
| Wandering bard | Créature | Neutre | Peu commune | ✅ Barde errant |
| Warrior seraph | Créature | Havre | Peu commune | ✅ Séraphin guerrier |
| Centaur archer | Créature | Bastion | Commune | ✅ Archer centaure |
| Demented | Créature | Inferno | Commune | ✅ Dément |
| Devoted sister | Créature | Havre | Commune | ✅ Sœur dévouée |
| Dreamwalker | Créature | Bastion | Commune | ✅ Marcheur des rêves |
| Expert marksman | Créature | Havre | Commune | ✅ Tireur expert |
| Goblin hunter | Créature | Bastion | Commune | ✅ Chasseur gobelin |
| Goblin scout | Créature | Bastion | Commune | ✅ Éclaireur gobelin |
| Gravid breeder | Créature | Inferno | Commune | ✅ Couveuse gravide |
| Hell hound | Créature | Inferno | Commune | ✅ Chien de l'enfer |
| Imperial crossbowman | Créature | Havre | Commune | ✅ Arbalétrier impérial |
| Imperial sentinel | Créature | Havre | Commune | ✅ Sentinelle impériale |
| Juggernaut | Créature | Inferno | Commune | ✅ Mastodonte |
| Lamasu | Créature | Nécropole | Commune | ✅ Lamassu |
| Lesser air elemental | Créature | Neutre | Commune | ✅ Élémentaire d'air mineur |
| Lesser earth elemental | Créature | Neutre | Commune | ✅ Élémentaire de terre mineur |
| Lesser fire elemental | Créature | Neutre | Commune | ✅ Élémentaire de feu mineur |
| Lilim | Créature | Inferno | Commune | ✅ Lilim |
| Lingering ghost | Créature | Nécropole | Commune | ✅ Fantôme errant |
| Loyal griffin | Créature | Havre | Commune | ✅ Griffon loyal |
| Maniac | Créature | Inferno | Commune | ✅ Maniaque |
| Neophyte lich | Créature | Nécropole | Commune | ✅ Liche néophyte |
| Pao hunter | Créature | Neutre | Commune | ✅ Chasseur pao |
| Plague skeleton | Créature | Nécropole | Commune | ✅ Squelette pestiféré |
| Plague zombie | Créature | Nécropole | Commune | ✅ Zombie pesteux |
| Radiant glory | Créature | Havre | Commune | ✅ Gloire radieuse |
| Ranaar harpy | Créature | Bastion | Commune | ✅ Harpie ranaar |
| Ranaar mauler | Créature | Bastion | Commune | ✅ Cogneur ranaar |
| Rogue mercenary | Créature | Neutre | Commune | ✅ Mercenaire voyou |
| Sea elf archer | Créature | Neutre | Commune | ✅ Archer elfe des mers |
| Skeleton spearman | Créature | Nécropole | Commune | ✅ Squelette lancier |
| Succubus | Créature | Inferno | Commune | ✅ Succube |
| Sun rider | Créature | Havre | Commune | ✅ Cavalier solaire |
| Tainted orc | Créature | Bastion | Commune | ✅ Orc corrompu |
| Tormentor | Créature | Inferno | Commune | ✅ Tourmenteur |
| Wild griffin | Créature | Neutre | Commune | ✅ Griffon sauvage |
| Wretched ghoul | Créature | Nécropole | Commune | ✅ Goule misérable |
| Armageddon | Sort | Feu | Rare | ✅ Armageddon |
| Blizzard | Sort | Eau | Rare | ✅ Blizzard |
| Celestial armour | Sort | Lumière | Rare | ✅ Armure céleste |
| Contagion | Sort | Terre | Rare | ✅ Contagion |
| Curse of the Netherworld | Sort | Ténèbres | Rare | ✅ Malédiction du Néant |
| Divine intervention | Sort | Lumière | Rare | ✅ Intervention divine |
| Father Sky's wrath | Sort | Air | Rare | ✅ Courroux du Père Ciel |
| Firestorm | Sort | Feu | Rare | ✅ Tempête de feu |
| Fog veil | Sort | Air | Rare | ✅ Voile de brume |
| For whom the Bell tolls | Sort | Primordiale | Rare | ✅ Pour qui sonne le glas |
| Geyser | Sort | Eau | Rare | ✅ Geyser |
| Immolation | Sort | Feu | Rare | ✅ Immolation |
| Lightning speed | Sort | Air | Rare | ✅ Vitesse de l'éclair |
| Mass regeneration | Sort | Terre | Rare | ✅ Régénération de masse |
| Puppet master | Sort | Ténèbres | Rare | ✅ Maître des marionnettes |
| Resurrection | Sort | Lumière | Rare | ✅ Résurrection |
| Shadow image | Sort | Ténèbres | Rare | ✅ Image fantôme |
| Spell twister | Sort | Primordiale | Rare | ✅ Tordeur de sorts |
| Time jump | Sort | Primordiale | Rare | ✅ Saut temporel |
| Tsunami | Sort | Eau | Rare | ✅ Tsunami |
| Arcane ward | Sort | Primordiale | Peu commune | ✅ Protection des arcanes |
| Chain lightning | Sort | Air | Peu commune | ✅ Chaîne d'éclairs |
| Cleansing light | Sort | Lumière | Peu commune | ✅ Lumière purificatrice |
| Earthquake | Sort | Terre | Peu commune | ✅ Tremblement de terre |
| Eternal winter | Sort | Eau | Peu commune | ✅ Hiver éternel |
| Fireball | Sort | Feu | Peu commune | ✅ Boule de feu |
| Frenzy | Sort | Feu | Peu commune | ✅ Frénésie |
| Frozen ground | Sort | Eau | Peu commune | ✅ Sol gelé |
| Grounded | Sort | Air | Peu commune | ✅ Cloués au sol |
| Ice spikes | Sort | Eau | Peu commune | ✅ Piques de glace |
| Inner fire | Sort | Feu | Peu commune | ✅ Feu intérieur |
| Insect swarm | Sort | Terre | Peu commune | ✅ Nuée d'insectes |
| Martyr | Sort | Lumière | Peu commune | ✅ Martyr |
| Soul syphon | Sort | Primordiale | Peu commune | ✅ Siphon d'âmes |
| Soulreaver | Sort | Ténèbres | Peu commune | ✅ Faucheur d'âmes |
| Stone skin | Sort | Terre | Peu commune | ✅ Peau de pierre |
| Storm wind | Sort | Air | Peu commune | ✅ Vent de tempête |
| Town portal | Sort | Primordiale | Peu commune | ✅ Portail de ville |
| Vampiric embrace | Sort | Ténèbres | Peu commune | ✅ Étreinte vampirique |
| Weakness | Sort | Ténèbres | Peu commune | ✅ Faiblesse |
| Agony | Sort | Ténèbres | Commune | ✅ Agonie |
| Bless | Sort | Lumière | Commune | ✅ Bénédiction |
| Cyclone | Sort | Air | Commune | ✅ Cyclone |
| Death seal | Sort | Ténèbres | Commune | ✅ Sceau de mort |
| Dispel magic | Sort | Primordiale | Commune | ✅ Dissipation de la magie |
| Fire bolt | Sort | Feu | Commune | ✅ Trait de feu |
| Fire shield | Sort | Feu | Commune | ✅ Bouclier de feu |
| Fire trap | Sort | Feu | Commune | ✅ Piège de feu |
| Heal | Sort | Lumière | Commune | ✅ Soin |
| Ice wall | Sort | Eau | Commune | ✅ Mur de glace |
| Icy weapon | Sort | Eau | Commune | ✅ Arme glacée |
| Lightning bolt | Sort | Air | Commune | ✅ Éclair |
| Purge | Sort | Ténèbres | Commune | ✅ Purge |
| Refreshing spring | Sort | Eau | Commune | ✅ Source rafraîchissante |
| Regeneration | Sort | Terre | Commune | ✅ Régénération |
| Rock wall | Sort | Terre | Commune | ✅ Mur de pierre |
| Slow | Sort | Primordiale | Commune | ✅ Lenteur |
| Stone shield | Sort | Terre | Commune | ✅ Bouclier de pierre |
| Sunburst | Sort | Lumière | Commune | ✅ Explosion solaire |
| Teleport | Sort | Primordiale | Commune | ✅ Téléportation |
| Venomous touch | Sort | Terre | Commune | ✅ Toucher venimeux |
| Wind shield | Sort | Air | Commune | ✅ Bouclier de vent |
| Word of Light | Sort | Lumière | Commune | ✅ Parole de lumière |
| Altar of Asha | Fortune | Neutre | Unique | ✅ Autel d'Asha |
| Cassandra's imperial devotion | Fortune | Havre | Unique | ✅ Dévotion impériale de Cassandra |
| Garant's purge | Fortune | Inferno | Unique | ✅ Purge de Garant |
| Kat's grand finale | Fortune | Bastion | Unique | ✅ Grand final de Kat |
| Altar of Eternal Servitude | Fortune | Nécropole | Rare | ✅ Autel de la servitude éternelle |
| Crystal cavern | Fortune | Neutre | Rare | ✅ Caverne de cristal |
| Crystal of Power | Fortune | Neutre | Rare | ✅ Cristal de puissance |
| Hall of Torment | Fortune | Inferno | Rare | ✅ Salle des tourments |
| Prison | Fortune | Havre | Rare | ✅ Prison |
| Reinforcements | Fortune | Neutre | Rare | ✅ Renforts |
| Seria's last order | Fortune | Nécropole | Rare | ✅ Le dernier ordre de Seria |
| The last stand | Fortune | Bastion | Rare | ✅ Le dernier carré |
| Wasteland | Fortune | Neutre | Rare | ✅ Terres désolées |
| Altar of Shadows | Fortune | Neutre | Peu commune | ✅ Autel des ombres |
| Arcane academy | Fortune | Neutre | Peu commune | ✅ Académie des arcanes |
| Asha uses all | Fortune | Nécropole | Peu commune | ✅ Asha utilise tout |
| Broken bridge | Fortune | Neutre | Peu commune | ✅ Pont brisé |
| Call to Duty | Fortune | Neutre | Peu commune | ✅ Appel du devoir |
| Crystal of Revelation | Fortune | Neutre | Peu commune | ✅ Cristal de révélation |
| Fountain of Youth | Fortune | Havre | Peu commune | ✅ Fontaine de jouvence |
| House of Madness | Fortune | Inferno | Peu commune | ✅ Maison de la folie |
| Observatory | Fortune | Neutre | Peu commune | ✅ Observatoire |
| Orc camp | Fortune | Bastion | Peu commune | ✅ Camp orc |
| Pit of Hate | Fortune | Inferno | Peu commune | ✅ Fosse de la haine |
| Shantiri ruins | Fortune | Nécropole | Peu commune | ✅ Ruines shantiri |
| Tax office | Fortune | Havre | Peu commune | ✅ Bureau des impôts |
| Altar of Destruction | Fortune | Inferno | Commune | ✅ Autel de destruction |
| Ambush spot | Fortune | Neutre | Commune | ✅ Lieu d'embuscade |
| Arena | Fortune | Bastion | Commune | ✅ Arène |
| Blood pool | Fortune | Bastion | Commune | ✅ Bassin de sang |
| Blood shaman hut | Fortune | Bastion | Commune | ✅ Hutte du chaman de sang |
| Campfire | Fortune | Neutre | Commune | ✅ Feu de camp |
| Cartographer | Fortune | Neutre | Commune | ✅ Cartographe |
| Chaos rift | Fortune | Inferno | Commune | ✅ Faille du chaos |
| Dragon vein | Fortune | Neutre | Commune | ✅ Veine de dragon |
| Dwarven smith | Fortune | Havre | Commune | ✅ Forgeron nain |
| Fortified outpost | Fortune | Havre | Commune | ✅ Avant-poste fortifié |
| Gold pile | Fortune | Neutre | Commune | ✅ Tas d'or |
| Graveyard | Fortune | Nécropole | Commune | ✅ Cimetière |
| Mass grave | Fortune | Nécropole | Commune | ✅ Fosse commune |
| No rest for the Wicked | Fortune | Nécropole | Commune | ✅ Pas de repos pour les méchants |
| Rally flag | Fortune | Neutre | Commune | ✅ Drapeau de ralliement |
| River of gems | Fortune | Havre | Commune | ✅ Rivière de gemmes |
| Sacrificial altar | Fortune | Bastion | Commune | ✅ Autel sacrificiel |
| Stone of Enlightenment | Fortune | Neutre | Commune | ✅ Pierre d'illumination |
| Twist of Fate | Fortune | Inferno | Commune | ✅ Coup du sort |
| Weapon supplies | Fortune | Neutre | Commune | ✅ Réserves d'armes |
| Market of Wonders | Événement | — | Rare | ✅ Marché des merveilles |
| Week of the Mercenaries | Événement | — | Rare | ✅ Semaine des mercenaires |
| Mana Storm | Événement | — | Peu commune | ✅ Tempête de mana |
| Market of Shadows | Événement | — | Peu commune | ✅ Marché des ombres |
| Month of the Emerald Song | Événement | — | Peu commune | ✅ Mois du chant d'émeraude |
| Week of Taxes | Événement | — | Peu commune | ✅ Semaine des impôts |
| Celebrations | Événement | — | Commune | ✅ Fête |
| Day of Fortune | Événement | — | Commune | ✅ Jour de fortune |
| Month of the Dancing Flames | Événement | — | Commune | ✅ Mois des flammes dansantes |
| Week of Knowledge | Événement | — | Commune | ✅ Semaine du savoir |
| Week of the Dead | Événement | — | Commune | ✅ Semaine des morts |
| Week of the Weaponsmiths | Événement | — | Commune | ✅ Semaine des armuriers |
