import { getCard, type Card, type LastingRules } from './cards';
import { DECKS, type Hero } from './decks';
import { getEvent } from './events';
import { EXPANSIONS } from './expansions';
import { FACTIONS } from './factions';
import type { Game, LogEntry, StepOptions, Unit } from './game';
import type {
  AttackType, Choice, ExpansionId, FactionId, Keywords, Phase, PlayerIndex, Rarity, SlotRef, StatKey, Target,
} from './types';

/** Extension d'une carte, telle qu'affichée. */
export interface ExpansionView {
  name: string;
  /** Nom de l'icône dans img/expansion/ (sans extension). */
  image: string;
}

export interface CardView {
  id: string;
  name: string;
  type: Card['type'];
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
  /** Marqueurs d'estropiement. */
  cripple: number;
  /** Marqueurs +1 en attaque. */
  boost: number;
  /** Marqueurs de rage. */
  enrage: number;
  /** Noms des sorts permanents attachés. */
  enchantments: string[];
  /** La créature a déjà agi ce tour-ci, ou vient d'être déployée. */
  exhausted: boolean;
  /** Elle ne peut pas attaquer ce tour-ci (Toucher glacé, cartes permanentes…). */
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
  duration: LastingRules['duration'];
  /** Couloir enchanté, pour une carte de couloir. */
  lane: number | null;
}

export interface PlayerView extends Record<StatKey, number> {
  /** Nom affiché du joueur (pseudo de son compte, ou « IA »). */
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
  /** null pour l'adversaire : sa main est cachée. */
  hand: CardView[] | null;
  /** Cimetière (public), de la plus ancienne carte à la plus récente. */
  grave: CardView[];
  board: (UnitView | null)[][];
  /** Cartes permanentes en jeu de ce joueur. */
  lasting: LastingView[];
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
  /** Étape qui dépend des précédentes : ses options selon les choix déjà faits. */
  after: { previous: Choice[]; options: Choice[] }[] | null;
}

/** Événement en jeu, visible par les deux joueurs. */
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

export interface PowerOption {
  usable: boolean;
  reason: string | null;
  steps: StepView[];
}

export type EventOption = PowerOption;

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
  /** Un par événement en jeu, dans le même ordre. */
  events: EventOption[];
  units: UnitOption[];
  canEndTurn: boolean;
}

/** Carte jouée ou pouvoir utilisé, affiché en grand le temps de sa résolution. */
export type PendingView = { player: PlayerIndex; choices: Choice[] }
  & ({ kind: 'card'; card: CardView } | { kind: 'power'; power: HeroView['power'] } | { kind: 'event'; event: EventView });

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
  /** Les deux événements en jeu : celui de gauche part à la fin du tour. */
  events: EventView[];
  eventDeckCount: number;
  log: LogEntry[];
  options: TurnOptions | null;
  /** Choix à faire après la résolution d'une carte ; montré au seul joueur qui choisit. */
  pick: PickView | null;
}

/** Choix après résolution : options, et cartes révélées dans le même ordre que les options `card`. */
export interface PickView {
  prompt: string;
  options: Choice[];
  labels: string[] | null;
  cards: CardView[];
}

const toExpansionView = (id: ExpansionId): ExpansionView => ({ name: EXPANSIONS[id].name, image: EXPANSIONS[id].image });

export function toCardView(card: Card): CardView {
  const creature = card.type === 'creature' ? card : null;
  return {
    id: card.id, name: card.name, type: card.type, rarity: card.rarity,
    faction: card.faction ? { id: card.faction, label: FACTIONS[card.faction].label, icon: FACTIONS[card.faction].icon } : null,
    expansion: toExpansionView(card.expansion),
    cost: card.cost, req: { ...card.req },
    icon: card.icon, art: card.art ?? null, text: card.text ?? null, school: card.school ?? null,
    attackType: creature?.attackType ?? null, magic: creature?.magic ?? false,
    atk: creature?.atk ?? null, ret: creature?.ret ?? null, hp: creature?.hp ?? null,
    keywords: { ...(creature?.keywords ?? {}) },
  };
}

function toUnitView(game: Game, unit: Unit): UnitView {
  return {
    uid: unit.uid, card: toCardView(getCard(unit.cardId)),
    atk: game.attackOf(unit), ret: game.retaliationOf(unit), hpCur: unit.hpCur, hpMax: unit.hpMax,
    keywords: game.keywordsOf(unit), stack: unit.stack, poison: unit.poison, cripple: unit.cripple, boost: unit.boost, enrage: unit.enrage,
    enchantments: unit.enchantments.map(e => getCard(e.cardId).name), exhausted: unit.acted || unit.deployedTurn === game.turn,
    cannotAttack: game.cannotAttack(unit), immobilized: game.isImmobilized(unit),
  };
}

export function toHeroView(hero: Hero): HeroView {
  const { power, passive } = hero;
  return {
    name: hero.name, icon: hero.icon, art: hero.art, rarity: hero.rarity, expansion: toExpansionView(hero.expansion),
    base: { m: hero.m, g: hero.g, d: hero.d }, schools: [...hero.schools],
    power: power ? { name: power.name, cost: power.cost, text: power.text } : null,
    passive: passive ? { name: passive.name, text: passive.text } : null,
  };
}

function toPlayerView(game: Game, pi: PlayerIndex, visibleHand: boolean): PlayerView {
  const p = game.player(pi);
  const faction = FACTIONS[p.faction];
  const lasting = game.lasting.flatMap((entry, index): LastingView[] => {
    const card = getCard(entry.cardId);
    if (entry.owner !== pi || card.type === 'creature' || !card.lasting) return [];
    return [{ index, card: toCardView(card), duration: card.lasting.duration, lane: entry.lane }];
  });
  return {
    name: p.name, faction: p.faction, factionLabel: faction.label, factionIcon: faction.icon,
    hero: toHeroView(DECKS[p.deckId].hero),
    hp: p.hp, maxHp: p.maxHp, m: game.statOf(pi, 'm'), g: game.statOf(pi, 'g'), d: game.statOf(pi, 'd'), res: p.res, maxRes: p.maxRes,
    deckCount: p.deck.length, handCount: p.hand.length,
    hand: visibleHand ? p.hand.map(id => toCardView(getCard(id))) : null,
    grave: p.grave.map(id => toCardView(getCard(id))),
    board: p.board.map(row => row.map(u => (u ? toUnitView(game, u) : null))),
    lasting,
    heroActionUsed: p.heroActionUsed,
  };
}

function toEventView(id: string, used: boolean): EventView {
  const e = getEvent(id);
  return {
    id: e.id, name: e.name, rarity: e.rarity, expansion: toExpansionView(e.expansion), icon: e.icon, art: e.art, text: e.text,
    cost: e.kind === 'active' ? e.cost : null, ongoing: e.kind === 'ongoing', used,
  };
}

function toStepView({ step, options, after }: StepOptions): StepView {
  const cards = options.length && options.every(o => o.kind === 'card')
    ? options.flatMap(o => (o.kind === 'card' ? [toCardView(getCard(o.cardId))] : []))
    : null;
  return {
    prompt: step.prompt, options, labels: step.labels ? [...step.labels] : null, cards,
    distinctFrom: step.distinctFrom ?? null, after,
  };
}

function turnOptions(game: Game, pi: PlayerIndex): TurnOptions | null {
  if (game.current !== pi || game.phase !== 'action' || game.pending || game.hasPendingRetaliation || game.pendingPick) return null;
  const hand = game.player(pi).hand.map((id, i): HandOption => {
    const reason = game.whyNotPlay(pi, i);
    return { cost: game.cardCost(pi, getCard(id)), playable: reason === null, reason, steps: reason === null ? game.playSteps(pi, i).map(toStepView) : [] };
  });
  const events = game.events.map((_id, slot): EventOption => {
    const reason = game.whyNotUseEvent(pi, slot);
    return { usable: reason === null, reason, steps: reason === null ? game.eventSteps(pi, slot).map(toStepView) : [] };
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
    hand, power, events, units, canEndTurn: true,
  };
}

const onBoard = (c: Choice): boolean =>
  c.kind === 'slot' || c.kind === 'cell' || c.kind === 'lane' || c.kind === 'unit' || c.kind === 'hero' || c.kind === 'line';

function pendingView(game: Game): PendingView | null {
  const pending = game.pending;
  if (!pending) return null;
  const base = { player: pending.player, choices: pending.choices.filter(onBoard) };
  if (pending.kind === 'card') return { ...base, kind: 'card', card: toCardView(getCard(pending.cardId)) };
  if (pending.kind === 'event') return { ...base, kind: 'event', event: toEventView(pending.eventId, true) };
  const power = game.heroPower(pending.player);
  return power ? { ...base, kind: 'power', power: { name: power.name, cost: power.cost, text: power.text } } : null;
}

/** Ce que voit un joueur : son jeu complet, la main adverse cachée, et ses coups légaux. */
export function buildPlayerView(game: Game, pi: PlayerIndex): PlayerGameView {
  return {
    gameId: game.id, you: pi, current: game.current, phase: game.phase, turn: game.turn,
    winner: game.winner,
    pending: pendingView(game),
    players: [0, 1].map(q => toPlayerView(game, q as PlayerIndex, q === pi || game.player(pi).seesOpponentHand)) as [PlayerView, PlayerView],
    events: game.events.map((id, slot) => toEventView(id, game.eventUsed(slot))),
    eventDeckCount: game.eventDeckCount,
    log: game.log.map(l => ({ ...l })),
    options: turnOptions(game, pi),
    pick: pickView(game, pi),
  };
}

function pickView(game: Game, pi: PlayerIndex): PickView | null {
  const pick = game.pendingPick;
  if (!pick || pick.player !== pi) return null;
  return {
    prompt: pick.prompt, options: [...pick.options], labels: pick.labels ? [...pick.labels] : null,
    cards: pick.revealed.map(id => toCardView(getCard(id))),
  };
}
