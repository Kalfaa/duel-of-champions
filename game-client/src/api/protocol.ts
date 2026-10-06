// Types des messages échangés avec game-server.
// À garder synchronisés avec game-server/src/route/protocol.ts et game-server/src/model/game-view.ts.

export type PlayerIndex = 0 | 1;
export type FactionId = 'havre' | 'necropole' | 'inferno' | 'sanctuaire' | 'bastion';
export type DeckId =
  | 'siegfried' | 'namtaru' | 'kalAzaar' | 'ishuma' | 'kaiko' | 'takana' | 'yukiko' | 'kat'
  | 'alia' | 'adarMalik' | 'dhamiria' | 'noboru' | 'zardoc';
export type StatKey = 'm' | 'g' | 'd';
export type DevelopChoice = StatKey | 'draw';
export type AttackType = 'melee' | 'shooter' | 'flyer';
export type Rarity = 'common' | 'uncommon' | 'rare' | 'unique' | 'heroic';
export type Phase = 'action' | 'over';

export interface Keywords {
  noret?: boolean;
  stackable?: boolean;
  meleeGuard?: number;
  rangedGuard?: number;
  heal?: number;
  mending?: boolean;
  regen?: number;
  lifeDrain?: number;
  infect?: number;
  incorporeal?: boolean;
  charge?: boolean;
  sweep?: boolean;
  areaBlast?: number;
  attackAnywhere?: boolean;
  taunt?: boolean;
  imposeDiscard?: boolean;
  retribution?: boolean;
  preemptive?: boolean;
  fireBurst?: number;
  fireHeal?: boolean;
  crippling?: number;
  darkWard?: boolean;
  deathTouch?: boolean;
  packBonus?: number;
  retAura?: number;
  supplyStrike?: number;
  supplyDraw?: number;
  trample?: boolean;
  deathCurse?: number;
  deathDraw?: boolean;
  recycle?: boolean;
  honor?: number;
  hypnotize?: boolean;
  frozenTouch?: boolean;
  magicShield?: boolean;
  lucky?: number;
  enemyBonus?: number;
  blockLane?: boolean;
  outmanoeuvre?: boolean;
  waterBlast?: number;
  blackmail?: boolean;
  rampage?: boolean;
  burning?: number;
  needsCompany?: boolean;
  enrage?: number;
  magicResist?: boolean;
  doubleAttack?: boolean;
  quickAttack?: boolean;
  armor?: number;
  mightStats?: boolean;
  bloodDiscount?: boolean;
  warchant?: number;
  bloodPact?: boolean;
  fear?: number;
  towering?: boolean;
  noAttack?: boolean;
  swift?: boolean;
  fortuneWard?: boolean;
  enemySpellWard?: boolean;
  untargetable?: boolean;
  magicChannel?: number;
  noCounters?: boolean;
  earthHeal?: boolean;
  flyerGuard?: number;
  spellResist?: boolean;
  berserk?: boolean;
  berserkAura?: boolean;
  perfectRetaliation?: boolean;
  bloodthirst?: number;
  anchored?: boolean;
  destroysAttacker?: boolean;
  punish?: number;
  handLimit?: number;
  leaveDiscard?: boolean;
  deathDiscard?: boolean;
  heroRegen?: number;
  spellBonus?: number;
  infectAura?: number;
  noExtraDraw?: boolean;
  banishDead?: boolean;
  soulFeed?: number;
  noResourceGain?: boolean;
  discardRage?: number;
  spellsmasher?: boolean;
  replaces?: boolean;
  chains?: number;
  shell?: boolean;
}

export interface SlotRef {
  row: number;
  lane: number;
}

export type Target = { kind: 'unit'; uid: number } | { kind: 'hero'; player: PlayerIndex };
/** Un choix fait en jouant une carte ou le pouvoir du héros. */
export type Choice =
  | ({ kind: 'slot' } & SlotRef)
  /** Case du plateau de n'importe quel joueur (destination d'un déplacement forcé). */
  | ({ kind: 'cell'; player: PlayerIndex } & SlotRef)
  /** Un couloir entier, des deux côtés du champ de bataille. */
  | { kind: 'lane'; lane: number }
  /** Une carte permanente en jeu, par sa position dans la liste des cartes permanentes. */
  | { kind: 'lasting'; index: number }
  | Target
  | { kind: 'line'; player: PlayerIndex; row: number }
  | { kind: 'hand'; index: number }
  /** Une carte de sa bibliothèque ou de son cimetière, ou une carte révélée (choix après résolution). */
  | { kind: 'card'; zone: 'library' | 'grave' | 'revealed'; cardId: string }
  | { kind: 'mode'; index: number };

export type GameAction =
  | { type: 'develop'; choice: DevelopChoice }
  | { type: 'play'; handIndex: number; choices: Choice[] }
  | { type: 'power'; choices: Choice[] }
  /** Utiliser l'un des deux événements en jeu (0 = celui de gauche, qui part en fin de tour). */
  | { type: 'event'; slot: number; choices: Choice[] }
  | { type: 'attack'; uid: number; target: Target }
  | { type: 'move'; uid: number; to: SlotRef }
  /** Choix parmi les cartes révélées après la résolution d'une carte. */
  | { type: 'pick'; choice: Choice }
  | { type: 'endTurn' };

/** Extension (série de cartes) d'une carte. */
export interface ExpansionView {
  name: string;
  /** Nom de l'icône dans img/expansion/ (sans extension). */
  image: string;
}

export interface CardView {
  id: string;
  name: string;
  type: 'creature' | 'spell' | 'fortune';
  rarity: Rarity;
  /** null pour une carte neutre. */
  faction: { id: FactionId; label: string; icon: string } | null;
  expansion: ExpansionView;
  cost: number;
  req: Partial<Record<StatKey, number>>;
  icon: string;
  /** null quand la carte n'a pas d'illustration : l'icône est affichée à la place. */
  art: string | null;
  text: string | null;
  school: string | null;
  attackType: AttackType | null;
  magic: boolean;
  atk: number | null;
  ret: number | null;
  hp: number | null;
  keywords: Keywords;
}

export interface UnitView {
  uid: number;
  card: CardView;
  atk: number;
  ret: number;
  hpCur: number;
  hpMax: number;
  keywords: Keywords;
  stack: number;
  poison: number;
  /** Marqueurs d'estropiement. */
  cripple: number;
  /** Marqueurs +1 en attaque. */
  boost: number;
  /** Marqueurs de rage. */
  enrage: number;
  enchantments: string[];
  exhausted: boolean;
  /** Elle ne peut pas attaquer ce tour-ci. */
  cannotAttack: boolean;
  /** Elle ne peut pas bouger (Hypnose, Toucher glacé). */
  immobilized: boolean;
}

export interface HeroView {
  name: string;
  icon: string;
  art: string;
  rarity: Rarity;
  expansion: ExpansionView;
  /** Puissance, Magie et Destinée de départ du héros. */
  base: Record<StatKey, number>;
  /** Écoles de magie utilisées par le héros (Lumière, Ténèbres, Feu…). */
  schools: string[];
  /** Pouvoir activable ; null si le héros n'en a pas. */
  power: { name: string; cost: number; text: string } | null;
  /** Capacité permanente ; null si le héros n'en a pas. */
  passive: { name: string; text: string } | null;
}

/** Carte qui reste en jeu (sort global ou de couloir, fortune permanente). */
export interface LastingView {
  /** Position dans la liste des cartes permanentes des deux joueurs (choix `lasting`). */
  index: number;
  card: CardView;
  duration: 'endOfTurn' | 'nextTurn' | 'permanent';
  /** Couloir enchanté, pour une carte de couloir. */
  lane: number | null;
}

export interface PlayerView extends Record<StatKey, number> {
  /** Pseudo du joueur, ou « IA ». */
  name: string;
  faction: FactionId;
  factionLabel: string;
  factionIcon: string;
  hero: HeroView;
  hp: number;
  maxHp: number;
  res: number;
  maxRes: number;
  deckCount: number;
  handCount: number;
  hand: CardView[] | null;
  /** Cimetière, de la plus ancienne carte à la plus récente. */
  grave: CardView[];
  board: (UnitView | null)[][];
  /** Cartes permanentes en jeu de ce joueur. */
  lasting: LastingView[];
  heroActionUsed: boolean;
}

export interface StepView {
  prompt: string;
  options: Choice[];
  /** Libellés des options d'un choix « au choix ». */
  labels: string[] | null;
  /** Cartes des options de bibliothèque ou de cimetière, dans le même ordre. */
  cards: CardView[] | null;
  /** Le choix doit différer de celui fait à l'étape indiquée. */
  distinctFrom: number | null;
  /** Étape qui dépend des précédentes : ses options selon les choix déjà faits. */
  after: { previous: Choice[]; options: Choice[] }[] | null;
}

/** Événement en jeu, commun aux deux joueurs. */
export interface EventView {
  id: string;
  name: string;
  rarity: Rarity;
  expansion: ExpansionView;
  icon: string;
  art: string;
  text: string;
  /** Coût d'utilisation ; null pour un événement permanent. */
  cost: number | null;
  ongoing: boolean;
  /** Déjà utilisé par le joueur actif ce tour-ci. */
  used: boolean;
}

export interface HandOption {
  /** Coût réel de la carte, modifié par les événements permanents. */
  cost: number;
  playable: boolean;
  reason: string | null;
  steps: StepView[];
}

export interface UnitOption {
  uid: number;
  reason: string | null;
  attackTargets: Target[];
  moveSlots: SlotRef[];
}

export interface TurnOptions {
  heroAction: { available: boolean; reason: string | null; drawReason: string | null };
  hand: HandOption[];
  power: { usable: boolean; reason: string | null; steps: StepView[] };
  /** Un par événement en jeu, dans le même ordre. */
  events: { usable: boolean; reason: string | null; steps: StepView[] }[];
  units: UnitOption[];
  canEndTurn: boolean;
}

export interface LogEntry {
  text: string;
  tone: 'turn' | 'damage' | 'action' | 'info';
  player: PlayerIndex | null;
}

/** Carte jouée ou pouvoir du héros utilisé, affiché en grand le temps de sa résolution. */
export type PendingView = { player: PlayerIndex; choices: Choice[] }
  & ({ kind: 'card'; card: CardView } | { kind: 'power'; power: NonNullable<HeroView['power']> } | { kind: 'event'; event: EventView });

/** Choix après résolution : options, et cartes révélées dans l'ordre des options `card`. */
export interface PickView {
  prompt: string;
  options: Choice[];
  labels: string[] | null;
  cards: CardView[];
}

export interface GameView {
  gameId: string;
  you: PlayerIndex;
  current: PlayerIndex;
  phase: Phase;
  turn: number;
  winner: PlayerIndex | null;
  /** Carte qui vient d'être jouée et qui n'est pas encore résolue. */
  pending: PendingView | null;
  players: [PlayerView, PlayerView];
  /** Les deux événements en jeu : celui de gauche part à la fin du tour. */
  events: EventView[];
  eventDeckCount: number;
  log: LogEntry[];
  options: TurnOptions | null;
  /** Choix à faire après la résolution d'une carte (montré au seul joueur qui choisit). */
  pick: PickView | null;
}

export type GameEvent =
  | { kind: 'attack'; attacker: number; target: Target }
  | { kind: 'retaliate'; attacker: number; target: Target }
  | { kind: 'damage' | 'heal'; target: Target; amount: number }
  | { kind: 'buff'; target: Target };

export type ClientMessage =
  | { type: 'startAi'; deck: DeckId }
  | { type: 'findMatch'; deck: DeckId }
  | { type: 'action'; action: GameAction }
  | { type: 'leave' };

export type ServerMessage =
  | { type: 'waiting' }
  | { type: 'state'; view: GameView; events: GameEvent[] }
  | { type: 'error'; message: string };

/** Deck jouable : un héros, sa faction et ses cartes. */
export interface DeckSummary {
  id: DeckId;
  faction: FactionId;
  factionLabel: string;
  factionIcon: string;
  description: string;
  hero: HeroView;
}

export const other = (pi: PlayerIndex): PlayerIndex => (pi === 0 ? 1 : 0);

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

// ---------- Serveur de comptes (HTTP /api/accounts) ----------

export interface AccountStats {
  pvpWins: number;
  pvpLosses: number;
  aiWins: number;
  aiLosses: number;
}

export interface Account {
  id: string;
  username: string;
  /** Classement Elo (parties contre d'autres joueurs). */
  rating: number;
  stats: AccountStats;
  createdAt: string;
}

/** Compte connecté et jeton d'accès à présenter au serveur de jeu. */
export interface Session {
  token: string;
  account: Account;
}

export interface LeaderboardEntry {
  rank: number;
  username: string;
  rating: number;
  pvpWins: number;
  pvpLosses: number;
}
