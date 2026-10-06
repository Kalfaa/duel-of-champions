export type PlayerIndex = 0 | 1;
export const other = (pi: PlayerIndex): PlayerIndex => (pi === 0 ? 1 : 0);

export type FactionId = 'havre' | 'necropole' | 'inferno' | 'sanctuaire' | 'bastion';
export const FACTION_IDS: readonly FactionId[] = ['havre', 'necropole', 'inferno', 'sanctuaire', 'bastion'];

/** Deck jouable : un héros et ses cartes, désigné par le nom du héros. */
export type DeckId =
  | 'siegfried' | 'namtaru' | 'kalAzaar' | 'ishuma' | 'kaiko' | 'takana' | 'yukiko' | 'kat'
  | 'alia' | 'adarMalik' | 'dhamiria' | 'noboru' | 'zardoc';
export const DECK_IDS: readonly DeckId[] = [
  'siegfried', 'namtaru', 'kalAzaar', 'ishuma', 'kaiko', 'takana', 'yukiko', 'kat',
  'alia', 'adarMalik', 'dhamiria', 'noboru', 'zardoc',
];

/** Caractéristiques du héros : Puissance, Magie, Destinée. */
export type StatKey = 'm' | 'g' | 'd';
export const STAT_NAMES: Record<StatKey, string> = { m: 'Puissance', g: 'Magie', d: 'Destinée' };
export type DevelopChoice = StatKey | 'draw';

export type AttackType = 'melee' | 'shooter' | 'flyer';

/** Rareté d'une carte, de la plus courante à la plus rare ; les héros sont héroïques. */
export type Rarity = 'common' | 'uncommon' | 'rare' | 'unique' | 'heroic';

/** Extension (série de cartes) dont vient une carte. */
export type ExpansionId = 'base' | 'voidRising' | 'heraldOfTheVoid';

/** Lignes où un type de créature peut se trouver : 0 = avant, 1 = arrière. */
export const ALLOWED_ROWS: Record<AttackType, readonly number[]> = { melee: [0], shooter: [1], flyer: [0, 1] };

/** Capacités des créatures (Duel of Champions). */
export interface Keywords {
  /** Immunisé contre la riposte. */
  noret?: boolean;
  /** Empilable : une créature du même nom peut être déployée dessus. */
  stackable?: boolean;
  /** Garde mêlée : retire N aux dégâts de combat des créatures de mêlée, pour elle et ses voisines. */
  meleeGuard?: number;
  /** Garde distance : retire N aux dégâts de combat des tireurs, pour elle et ses voisines. */
  rangedGuard?: number;
  /** Soin : au ravitaillement, soigne N aux créatures alliées adjacentes. */
  heal?: number;
  /** Rétablissement : en fin de tour, si elle n'a pas attaqué, soigne toutes ses blessures. */
  mending?: boolean;
  /** Régénération : au ravitaillement, soigne N. */
  regen?: number;
  /** Drain de vie : quand elle inflige des dégâts d'attaque, soigne N. */
  lifeDrain?: number;
  /** Infection : ses dégâts d'attaque posent N marqueurs de poison. */
  infect?: number;
  /** Intangible : les dégâts non magiques sont divisés par deux (arrondi inférieur). */
  incorporeal?: boolean;
  /** Charge : attaque aussi l'autre créature du couloir de la cible. */
  charge?: boolean;
  /** Attaque en balayage : attaque aussi les créatures voisines de la cible sur sa ligne. */
  sweep?: boolean;
  /** Explosion : inflige N dégâts aux créatures adjacentes à la cible. */
  areaBlast?: number;
  /** Ubiquité : peut attaquer toute créature ennemie. */
  attackAnywhere?: boolean;
  /** Les créatures ennemies doivent l'attaquer si elles le peuvent. */
  taunt?: boolean;
  /** Chaque carte jouée par l'adversaire lui fait défausser une carte. */
  imposeDiscard?: boolean;
  /** Rétribution : riposte même si elle meurt de l'attaque. */
  retribution?: boolean;
  /** Frappe préventive : riposte avant que l'attaquant n'inflige ses dégâts. */
  preemptive?: boolean;
  /** Explosion de feu : à sa mort, inflige N dégâts de feu aux créatures de son couloir, des deux côtés. */
  fireBurst?: number;
  /** Soin par le feu : les dégâts de feu qu'elle subit la soignent à la place. */
  fireHeal?: boolean;
  /** Estropiement : ses dégâts d'attaque posent N marqueurs d'estropiement (-1 attaque et -1 riposte chacun). */
  crippling?: number;
  /** Protection contre les ténèbres : ne peut pas être ciblée par les sorts de Ténèbres et ignore leurs dégâts. */
  darkWard?: boolean;
  /** Détruit toute créature à qui elle inflige des dégâts de combat. */
  deathTouch?: boolean;
  /** Gagne +N en attaque et en riposte par créature alliée adjacente. */
  packBonus?: number;
  /** Les autres créatures alliées gagnent +N en riposte. */
  retAura?: number;
  /** Au ravitaillement, inflige N dégâts au héros ennemi. */
  supplyStrike?: number;
  /** Au ravitaillement, fait piocher N cartes de plus. */
  supplyDraw?: number;
  /** Quand elle détruit une créature en attaquant, l'excédent de dégâts touche le héros ennemi. */
  trample?: boolean;
  /** Si elle meurt pendant le tour adverse, inflige N dégâts au héros ennemi. */
  deathCurse?: number;
  /** Quand elle ou une autre créature alliée meurt, son propriétaire pioche une carte. */
  deathDraw?: boolean;
  /** Quand elle doit aller au cimetière, elle est remélangée dans la bibliothèque. */
  recycle?: boolean;
  /** Honneur : les créatures alliées adjacentes gagnent +N en attaque et en riposte. */
  honor?: number;
  /** Hypnose : les créatures ennemies de son couloir sont immobilisées. */
  hypnotize?: boolean;
  /** Toucher glacé : la créature à qui elle inflige des dégâts d'attaque ne peut ni attaquer ni bouger jusqu'au prochain tour de son propriétaire. */
  frozenTouch?: boolean;
  /** Bouclier magique : ne subit aucun dégât des sorts ni des créatures magiques. */
  magicShield?: boolean;
  /** Chanceuse : la Destinée de son propriétaire augmente de N tant qu'elle est en jeu. */
  lucky?: number;
  /** Gagne +N en attaque et en riposte par créature ennemie. */
  enemyBonus?: number;
  /** Les créatures ennemies ne peuvent pas être déployées dans son couloir. */
  blockLane?: boolean;
  /** Déjouer : en arrivant en jeu, déplace une créature ennemie ciblée. */
  outmanoeuvre?: boolean;
  /** Les autres créatures alliées de l'école de l'Eau gagnent Explosion N. */
  waterBlast?: number;
  /** La première fois par tour qu'elle blesse le héros ennemi au combat, la production de son propriétaire augmente de 1. */
  blackmail?: boolean;
  /** Gagne un marqueur +1 en attaque chaque fois qu'elle attaque (Arme ardente). */
  rampage?: boolean;
  /** Subit N dégâts de feu au début du tour de chaque joueur (Combustion). */
  burning?: number;
  /** Détruite dès qu'elle n'a plus de créature alliée adjacente. */
  needsCompany?: boolean;
  /** Rage : quand une autre créature alliée meurt, reçoit N marqueurs de rage (+1 en attaque et en riposte chacun), retirés après son attaque. */
  enrage?: number;
  /** Résistance à la magie : les dégâts des sorts et des créatures magiques sont divisés par deux (arrondi inférieur). */
  magicResist?: boolean;
  /** Double attaque : si elle survit à sa première attaque, elle attaque une seconde fois. */
  doubleAttack?: boolean;
  /** Attaque rapide : peut attaquer ou se déplacer le tour de son déploiement. */
  quickAttack?: boolean;
  /** Armure : retire N aux dégâts de combat qu'elle subit. */
  armor?: number;
  /** Son attaque et sa riposte sont égales à la Puissance de son propriétaire. */
  mightStats?: boolean;
  /** Coûte 1 ressource de moins par créature mise au cimetière ce tour-ci. */
  bloodDiscount?: boolean;
  /** À la fin du tour de son propriétaire, ses créatures avec Rage reçoivent N marqueurs de rage. */
  warchant?: number;
  /** En arrivant, détruit deux autres créatures alliées ciblées ; son attaque et sa riposte valent leurs PV restants cumulés. */
  bloodPact?: boolean;
  /** Peur N : ne peut pas être attaquée par une créature qui exige N ou moins en Puissance. */
  fear?: number;
  /** Imposante : les autres créatures alliées de son couloir ne peuvent être ni attaquées ni blessées au combat. */
  towering?: boolean;
  /** Ne peut pas attaquer. */
  noAttack?: boolean;
  /** Rapide : peut attaquer et se déplacer le même tour. */
  swift?: boolean;
  /** Protection contre les fortunes : ni ciblée, ni affectée par les fortunes. */
  fortuneWard?: boolean;
  /** Protection contre les sorts ennemis : ni ciblée, ni affectée par les sorts adverses. */
  enemySpellWard?: boolean;
  /** Ne peut pas être ciblée. */
  untargetable?: boolean;
  /** Canal magique N : la Magie de son propriétaire augmente de N tant qu'elle est en jeu. */
  magicChannel?: number;
  /** Aucun marqueur ne peut être posé sur elle. */
  noCounters?: boolean;
  /** Soin par la terre : les dégâts de terre qu'elle subit la soignent à la place. */
  earthHeal?: boolean;
  /** Garde volants : retire N aux dégâts de combat des volants contre elle et ses voisines. */
  flyerGuard?: number;
  /** Résistance aux sorts : les dégâts des sorts sont divisés par deux. */
  spellResist?: boolean;
  /** Berserk : au début de la phase d'action de son propriétaire, attaque d'office la première cible de son couloir. */
  berserk?: boolean;
  /** Les créatures ennemies de son couloir gagnent Berserk. */
  berserkAura?: boolean;
  /** Riposte parfaite : ses dégâts de riposte ne peuvent pas être réduits. */
  perfectRetaliation?: boolean;
  /** Soif de sang N : quand une créature ennemie meurt, reçoit N marqueurs de rage. */
  bloodthirst?: number;
  /** Ancrée : ne peut être ni déplacée ni échangée. */
  anchored?: boolean;
  /** Après avoir été attaquée, détruit la créature qui l'a attaquée. */
  destroysAttacker?: boolean;
  /** Après avoir été attaquée, inflige N dégâts à la créature qui l'a attaquée. */
  punish?: number;
  /** Au début du tour de chaque joueur, il défausse au hasard jusqu'à garder N cartes. */
  handLimit?: number;
  /** Si elle quitte le jeu pendant le tour adverse, l'adversaire défausse une carte au hasard. */
  leaveDiscard?: boolean;
  /** Si elle meurt pendant le tour de son propriétaire, l'adversaire défausse une carte au hasard. */
  deathDiscard?: boolean;
  /** Au début du tour de son propriétaire, soigne N blessures de son héros. */
  heroRegen?: number;
  /** +N en attaque et en riposte par sort permanent en jeu. */
  spellBonus?: number;
  /** Les autres créatures alliées avec Infection gagnent +N en Infection. */
  infectAura?: number;
  /** Les joueurs ne peuvent pas piocher en dehors de leur phase de ravitaillement. */
  noExtraDraw?: boolean;
  /** Les autres créatures qui meurent sont bannies au lieu d'aller au cimetière. */
  banishDead?: boolean;
  /** Quand une créature meurt, soigne N blessures de celle-ci. */
  soulFeed?: number;
  /** Les cartes et capacités ne peuvent plus faire gagner de ressources. */
  noResourceGain?: boolean;
  /** +N en attaque tant que l'adversaire a défaussé une carte ce tour-ci. */
  discardRage?: number;
  /** En attaquant, détruit un sort permanent ciblé. */
  spellsmasher?: boolean;
  /** Se déploie sur une créature alliée, qui retourne dans la main de son propriétaire. */
  replaces?: boolean;
  /** Au début du tour de son propriétaire, celui-ci subit N dégâts (Chaînes maudites). */
  chains?: number;
  /** Bloque tous les dégâts, et le sort qui l'accorde est alors détruit (Carapace de glace). */
  shell?: boolean;
}

/** Une case du plateau d'un joueur : rangée 0 = avant, 1 = arrière. */
export interface SlotRef {
  row: number;
  lane: number;
}

export type Target = { kind: 'unit'; uid: number } | { kind: 'hero'; player: PlayerIndex };

/** Un choix fait en jouant une carte ou le pouvoir du héros. */
export type Choice =
  /** Case de son propre plateau (déploiement d'une créature). */
  | ({ kind: 'slot' } & SlotRef)
  /** Case du plateau de n'importe quel joueur (destination d'un déplacement forcé). */
  | ({ kind: 'cell'; player: PlayerIndex } & SlotRef)
  /** Un couloir entier, à travers le champ de bataille (cases de même couloir des deux joueurs). */
  | { kind: 'lane'; lane: number }
  /** Une carte permanente en jeu, par sa position dans la liste des cartes permanentes. */
  | { kind: 'lasting'; index: number }
  | Target
  /** Une ligne entière (avant ou arrière) d'un joueur. */
  | { kind: 'line'; player: PlayerIndex; row: number }
  /** Une carte de sa main, par sa position avant que la carte jouée n'en soit retirée. */
  | { kind: 'hand'; index: number }
  /** Une carte de sa bibliothèque ou de son cimetière, ou une carte révélée (main ou bibliothèque adverse, dessus de sa bibliothèque). */
  | { kind: 'card'; zone: CardZone; cardId: string }
  /** Une option d'un choix « au choix ». */
  | { kind: 'mode'; index: number };

export type CardZone = 'library' | 'grave' | 'revealed';

export type Phase = 'action' | 'over';

export type GameAction =
  | { type: 'develop'; choice: DevelopChoice }
  | { type: 'play'; handIndex: number; choices: Choice[] }
  | { type: 'power'; choices: Choice[] }
  /** Utiliser l'un des deux événements en jeu (0 = celui de gauche, qui part en fin de tour). */
  | { type: 'event'; slot: number; choices: Choice[] }
  | { type: 'attack'; uid: number; target: Target }
  | { type: 'move'; uid: number; to: SlotRef }
  /** Choix parmi des cartes révélées après la résolution d'une carte (voir Game.pendingPick). */
  | { type: 'pick'; choice: Choice }
  | { type: 'endTurn' };

export const sameChoice = (a: Choice, b: Choice): boolean => {
  switch (a.kind) {
    case 'slot': return b.kind === 'slot' && a.row === b.row && a.lane === b.lane;
    case 'cell': return b.kind === 'cell' && a.player === b.player && a.row === b.row && a.lane === b.lane;
    case 'lane': return b.kind === 'lane' && a.lane === b.lane;
    case 'lasting': return b.kind === 'lasting' && a.index === b.index;
    case 'unit': return b.kind === 'unit' && a.uid === b.uid;
    case 'hero': return b.kind === 'hero' && a.player === b.player;
    case 'line': return b.kind === 'line' && a.player === b.player && a.row === b.row;
    case 'hand': return b.kind === 'hand' && a.index === b.index;
    case 'card': return b.kind === 'card' && a.zone === b.zone && a.cardId === b.cardId;
    case 'mode': return b.kind === 'mode' && a.index === b.index;
  }
};
