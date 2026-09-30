import { getCard, type Card } from './cards';
import { FACTIONS } from './factions';
import type { Game, LogEntry, StepOptions, Unit } from './game';
import type {
  AttackType, Choice, FactionId, Keywords, Phase, PlayerIndex, SlotRef, StatKey, Target,
} from './types';

export interface CardView {
  id: string;
  name: string;
  type: Card['type'];
  cost: number;
  req: Partial<Record<StatKey, number>>;
  icon: string;
  art: string;
  text: string | null;
  school: string | null;
  attackType: AttackType | null;
  /** Créature magique (ses dégâts sont magiques). */
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
  /** Taille de la pile (Empilable). */
  stack: number;
  poison: number;
  /** Noms des sorts permanents attachés. */
  enchantments: string[];
  /** La créature a déjà agi ce tour-ci, ou vient d'être déployée. */
  exhausted: boolean;
}

export interface HeroView {
  name: string;
  icon: string;
  art: string;
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
  /** null pour l'adversaire : sa main est cachée. */
  hand: CardView[] | null;
  /** Cimetière (public), de la plus ancienne carte à la plus récente. */
  grave: CardView[];
  board: (UnitView | null)[][];
  heroActionUsed: boolean;
}

/** Un choix à faire pour jouer une carte ou le pouvoir, avec ses options légales. */
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

export interface HandOption {
  playable: boolean;
  reason: string | null;
  steps: StepView[];
}

export interface PowerOption {
  usable: boolean;
  reason: string | null;
  steps: StepView[];
}

/** Ce qu'une créature du joueur peut faire ce tour-ci : attaquer une cible ou se déplacer. */
export interface UnitOption {
  uid: number;
  reason: string | null;
  attackTargets: Target[];
  moveSlots: SlotRef[];
}

/** Coups légaux du joueur, présents uniquement quand c'est à lui d'agir. */
export interface TurnOptions {
  /** Action du héros disponible : développement, pioche ou pouvoir (une seule par tour). */
  heroAction: { available: boolean; reason: string | null; drawReason: string | null };
  hand: HandOption[];
  power: PowerOption;
  units: UnitOption[];
  canEndTurn: boolean;
}

/** Carte jouée ou pouvoir utilisé, affiché en grand le temps de sa résolution. */
export type PendingView = { player: PlayerIndex; choices: Choice[] }
  & ({ kind: 'card'; card: CardView } | { kind: 'power'; power: HeroView['power'] });

export interface PlayerGameView {
  gameId: string;
  you: PlayerIndex;
  current: PlayerIndex;
  phase: Phase;
  turn: number;
  winner: PlayerIndex | null;
  /** Carte qui vient d'être jouée et qui n'est pas encore résolue (visible par les deux joueurs). */
  /** Seuls les choix visibles sur le plateau sont montrés (pas les cartes choisies dans la main). */
  pending: PendingView | null;
  players: [PlayerView, PlayerView];
  log: LogEntry[];
  options: TurnOptions | null;
}

export function toCardView(card: Card): CardView {
  const creature = card.type === 'creature' ? card : null;
  return {
    id: card.id, name: card.name, type: card.type, cost: card.cost, req: { ...card.req },
    icon: card.icon, art: card.art, text: card.text ?? null,
    school: card.type === 'creature' ? null : card.school ?? null,
    attackType: creature?.attackType ?? null, magic: creature?.magic ?? false,
    atk: creature?.atk ?? null, ret: creature?.ret ?? null, hp: creature?.hp ?? null,
    keywords: { ...(creature?.keywords ?? {}) },
  };
}

function toUnitView(game: Game, unit: Unit): UnitView {
  return {
    uid: unit.uid, card: toCardView(getCard(unit.cardId)),
    atk: unit.atk, ret: unit.ret, hpCur: unit.hpCur, hpMax: unit.hpMax,
    keywords: { ...unit.keywords }, stack: unit.stack, poison: unit.poison,
    enchantments: unit.enchantments.map(e => getCard(e.cardId).name), exhausted: unit.acted || unit.deployedTurn === game.turn,
  };
}

function toPlayerView(game: Game, pi: PlayerIndex, visibleHand: boolean): PlayerView {
  const p = game.player(pi);
  const faction = FACTIONS[p.faction];
  const power = faction.hero.power;
  return {
    faction: p.faction, factionLabel: faction.label, factionIcon: faction.icon,
    hero: { name: faction.hero.name, icon: faction.hero.icon, art: faction.hero.art, power: { name: power.name, cost: power.cost, text: power.text } },
    hp: p.hp, maxHp: p.maxHp, m: p.m, g: p.g, d: p.d, res: p.res, maxRes: p.maxRes,
    deckCount: p.deck.length, handCount: p.hand.length,
    hand: visibleHand ? p.hand.map(id => toCardView(getCard(id))) : null,
    grave: p.grave.map(id => toCardView(getCard(id))),
    board: p.board.map(row => row.map(u => (u ? toUnitView(game, u) : null))),
    heroActionUsed: p.heroActionUsed,
  };
}

function toStepView({ step, options }: StepOptions): StepView {
  const cards = options.length && options.every(o => o.kind === 'card')
    ? options.flatMap(o => (o.kind === 'card' ? [toCardView(getCard(o.cardId))] : []))
    : null;
  return {
    prompt: step.prompt, options, labels: step.labels ? [...step.labels] : null, cards,
    distinctFrom: step.distinctFrom ?? null,
  };
}

function turnOptions(game: Game, pi: PlayerIndex): TurnOptions | null {
  if (game.current !== pi || game.phase !== 'action' || game.pending || game.hasPendingRetaliation) return null;
  const hand = game.player(pi).hand.map((_id, i): HandOption => {
    const reason = game.whyNotPlay(pi, i);
    return { playable: reason === null, reason, steps: reason === null ? game.playSteps(pi, i).map(toStepView) : [] };
  });
  const powerReason = game.whyNotPower(pi);
  const power: PowerOption = {
    usable: powerReason === null, reason: powerReason,
    steps: powerReason === null ? game.powerSteps(pi).map(toStepView) : [],
  };
  const heroReason = game.whyNotHeroAction(pi);
  const units = game.units(pi).map(({ unit }): UnitOption => ({
    uid: unit.uid,
    reason: game.whyNotUnitAct(pi, unit.uid),
    attackTargets: game.attackTargets(pi, unit.uid),
    moveSlots: game.moveDestinations(pi, unit.uid),
  }));
  return {
    heroAction: { available: heroReason === null, reason: heroReason, drawReason: game.whyNotDevelop(pi, 'draw') },
    hand, power, units, canEndTurn: true,
  };
}

const onBoard = (c: Choice): boolean => c.kind === 'slot' || c.kind === 'unit' || c.kind === 'hero' || c.kind === 'line';

function pendingView(game: Game): PendingView | null {
  const pending = game.pending;
  if (!pending) return null;
  const base = { player: pending.player, choices: pending.choices.filter(onBoard) };
  if (pending.kind === 'card') return { ...base, kind: 'card', card: toCardView(getCard(pending.cardId)) };
  const { name, cost, text } = game.heroPower(pending.player);
  return { ...base, kind: 'power', power: { name, cost, text } };
}

/** Ce que voit un joueur : son jeu complet, la main adverse cachée, et ses coups légaux. */
export function buildPlayerView(game: Game, pi: PlayerIndex): PlayerGameView {
  return {
    gameId: game.id, you: pi, current: game.current, phase: game.phase, turn: game.turn,
    winner: game.winner,
    pending: pendingView(game),
    players: [toPlayerView(game, 0, pi === 0), toPlayerView(game, 1, pi === 1)],
    log: game.log.map(l => ({ ...l })),
    options: turnOptions(game, pi),
  };
}
