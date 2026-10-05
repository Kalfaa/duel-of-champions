// Types des messages échangés avec game-server.
// À garder synchronisés avec game-server/src/route/protocol.ts et game-server/src/model/game-view.ts.

export type PlayerIndex = 0 | 1;
export type FactionId = 'havre' | 'necropole' | 'inferno';
export type StatKey = 'm' | 'g' | 'd';
export type DevelopChoice = StatKey | 'draw';
export type AttackType = 'melee' | 'shooter' | 'flyer';
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
}

export interface SlotRef {
  row: number;
  lane: number;
}

export type Target = { kind: 'unit'; uid: number } | { kind: 'hero'; player: PlayerIndex };
/** Un choix fait en jouant une carte ou le pouvoir du héros. */
export type Choice =
  | ({ kind: 'slot' } & SlotRef)
  | Target
  | { kind: 'line'; player: PlayerIndex; row: number }
  | { kind: 'hand'; index: number }
  | { kind: 'card'; zone: 'library' | 'grave'; cardId: string }
  | { kind: 'mode'; index: number };

export type GameAction =
  | { type: 'develop'; choice: DevelopChoice }
  | { type: 'play'; handIndex: number; choices: Choice[] }
  | { type: 'power'; choices: Choice[] }
  /** Utiliser l'un des deux événements en jeu (0 = celui de gauche, qui part en fin de tour). */
  | { type: 'event'; slot: number; choices: Choice[] }
  | { type: 'attack'; uid: number; target: Target }
  | { type: 'move'; uid: number; to: SlotRef }
  | { type: 'endTurn' };

export interface CardView {
  id: string;
  name: string;
  type: 'creature' | 'spell' | 'fortune';
  cost: number;
  req: Partial<Record<StatKey, number>>;
  icon: string;
  art: string;
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
  enchantments: string[];
  exhausted: boolean;
}

export interface HeroView {
  name: string;
  icon: string;
  art: string;
  /** Puissance, Magie et Destinée de départ du héros. */
  base: Record<StatKey, number>;
  /** Écoles de magie utilisées par le héros (Lumière, Ténèbres, Feu…). */
  schools: string[];
  power: { name: string; cost: number; text: string };
}

export interface PlayerView extends Record<StatKey, number> {
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
}

/** Événement en jeu, commun aux deux joueurs. */
export interface EventView {
  id: string;
  name: string;
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
  & ({ kind: 'card'; card: CardView } | { kind: 'power'; power: HeroView['power'] } | { kind: 'event'; event: EventView });

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
}

export type GameEvent =
  | { kind: 'attack'; attacker: number; target: Target }
  | { kind: 'retaliate'; attacker: number; target: Target }
  | { kind: 'damage' | 'heal'; target: Target; amount: number }
  | { kind: 'buff'; target: Target };

export type ClientMessage =
  | { type: 'startAi'; faction: FactionId }
  | { type: 'findMatch'; faction: FactionId }
  | { type: 'action'; action: GameAction }
  | { type: 'leave' };

export type ServerMessage =
  | { type: 'waiting' }
  | { type: 'state'; view: GameView; events: GameEvent[] }
  | { type: 'error'; message: string };

export interface FactionSummary {
  id: FactionId;
  label: string;
  icon: string;
  description: string;
  hero: HeroView;
}

export const other = (pi: PlayerIndex): PlayerIndex => (pi === 0 ? 1 : 0);

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
