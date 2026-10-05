export type PlayerIndex = 0 | 1;
export const other = (pi: PlayerIndex): PlayerIndex => (pi === 0 ? 1 : 0);

export type FactionId = 'havre' | 'necropole' | 'inferno';
export const FACTION_IDS: readonly FactionId[] = ['havre', 'necropole', 'inferno'];

/** Caractéristiques du héros : Puissance, Magie, Destinée. */
export type StatKey = 'm' | 'g' | 'd';
export const STAT_NAMES: Record<StatKey, string> = { m: 'Puissance', g: 'Magie', d: 'Destinée' };
export type DevelopChoice = StatKey | 'draw';

export type AttackType = 'melee' | 'shooter' | 'flyer';

/** Lignes où un type de créature peut se trouver : 0 = avant, 1 = arrière. */
export const ALLOWED_ROWS: Record<AttackType, readonly number[]> = { melee: [0], shooter: [1], flyer: [0, 1] };

/** Capacités des créatures (Duel of Champions). */
export interface Keywords {
  /** Immunisé contre la riposte. */
  noret?: boolean;
  /** Empilable : une créature du même nom peut être déployée dessus. */
  stackable?: boolean;
  /** Garde contre la mêlée : retire N aux dégâts de combat des créatures de mêlée, pour elle et ses voisines. */
  meleeGuard?: number;
  /** Garde contre les tireurs : retire N aux dégâts de combat des tireurs, pour elle et ses voisines. */
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
  /** Attaque n'importe où : peut attaquer toute créature ennemie. */
  attackAnywhere?: boolean;
  /** Les créatures ennemies doivent l'attaquer si elles le peuvent. */
  taunt?: boolean;
  /** Chaque carte jouée par l'adversaire lui fait défausser une carte. */
  imposeDiscard?: boolean;
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
  | Target
  /** Une ligne entière (avant ou arrière) d'un joueur. */
  | { kind: 'line'; player: PlayerIndex; row: number }
  /** Une carte de sa main, par sa position avant que la carte jouée n'en soit retirée. */
  | { kind: 'hand'; index: number }
  /** Une carte de sa bibliothèque ou de son cimetière. */
  | { kind: 'card'; zone: 'library' | 'grave'; cardId: string }
  /** Une option d'un choix « au choix ». */
  | { kind: 'mode'; index: number };

export type Phase = 'action' | 'over';

export type GameAction =
  | { type: 'develop'; choice: DevelopChoice }
  | { type: 'play'; handIndex: number; choices: Choice[] }
  | { type: 'power'; choices: Choice[] }
  /** Utiliser l'un des deux événements en jeu (0 = celui de gauche, qui part en fin de tour). */
  | { type: 'event'; slot: number; choices: Choice[] }
  | { type: 'attack'; uid: number; target: Target }
  | { type: 'move'; uid: number; to: SlotRef }
  | { type: 'endTurn' };

export const sameChoice = (a: Choice, b: Choice): boolean => {
  switch (a.kind) {
    case 'slot': return b.kind === 'slot' && a.row === b.row && a.lane === b.lane;
    case 'unit': return b.kind === 'unit' && a.uid === b.uid;
    case 'hero': return b.kind === 'hero' && a.player === b.player;
    case 'line': return b.kind === 'line' && a.player === b.player && a.row === b.row;
    case 'hand': return b.kind === 'hand' && a.index === b.index;
    case 'card': return b.kind === 'card' && a.zone === b.zone && a.cardId === b.cardId;
    case 'mode': return b.kind === 'mode' && a.index === b.index;
  }
};
