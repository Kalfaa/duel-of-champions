import {
  FIRE, getCard, RELOCATE_DESTINATION, RELOCATE_TARGET, type Card, type CreatureCard, type DamageSource, type Effect, type LastingRules, type Step, type StepContext,
} from './cards';
import { DECKS, PLAYABLE_DECKS, type Hero, type HeroPower } from './decks';
import { GameRuleError } from './errors';
import { getEvent, type ActiveEvent } from './events';
import { SeededRandom } from './random';
import {
  ALLOWED_ROWS, STAT_NAMES, other, sameChoice,
  type AttackType, type Choice, type DeckId, type DevelopChoice, type FactionId, type GameAction, type Keywords,
  type Phase, type PlayerIndex, type SlotRef, type StatKey, type Target,
} from './types';

export const STARTING_HAND = 6;
export const MAX_HAND = 10;
export const MAX_RESOURCES = 10;
/** Coût en ressources de la pioche du héros. */
export const DRAW_COST = 1;
export const ROWS = 2;
export const LANES = 4;
/** Nombre d'événements en jeu à la fois. */
export const EVENT_SLOTS = 2;
const LOG_LIMIT = 120;
export const AI_PLAYER_ID = 'ai';
/** Nom affiché de l'adversaire contrôlé par l'IA. */
export const AI_PLAYER_NAME = 'IA';

/** Sort permanent attaché à une créature et ses modifications ; il rejoint le cimetière de son lanceur quand elle disparaît. */
export interface Enchantment {
  cardId: string;
  owner: PlayerIndex;
  atk: number;
  ret: number;
  /** PV ajoutés à la créature (retirés avec l'enchantement). */
  hp?: number;
  keywords: Keywords;
}

/** Carte qui reste en jeu (sort global ou de couloir, fortune permanente), avec ses règles (voir LastingRules). */
export interface LastingCard {
  cardId: string;
  owner: PlayerIndex;
  /** Couloir enchanté, pour une carte de couloir. */
  lane: number | null;
  /** Carte de la créature ciblée en la jouant (Forteresse sous-marine). */
  subject: string | null;
  /** Phalange impériale : ses bonus s'appliquent jusqu'au prochain tour de son propriétaire. */
  active: boolean;
}

export interface Unit {
  readonly uid: number;
  readonly cardId: string;
  readonly owner: PlayerIndex;
  readonly attackType: AttackType;
  /** Créature magique : ses dégâts de combat sont magiques. */
  readonly magic: boolean;
  /** Tour (compteur global) où la créature a été déployée : elle ne peut pas agir ce tour-là. */
  readonly deployedTurn: number;
  keywords: Keywords;
  atk: number;
  ret: number;
  hpCur: number;
  hpMax: number;
  /** Nombre de créatures empilées (capacité Empilable). */
  stack: number;
  /** Marqueurs de poison : 1 dégât chacun au ravitaillement de son propriétaire. */
  poison: number;
  /** Marqueurs d'estropiement : -1 en attaque et en riposte chacun. */
  cripple: number;
  /** Marqueurs +1 en attaque (Arme ardente). */
  boost: number;
  /** Marqueurs de rage : +1 en attaque et en riposte chacun. */
  enrage: number;
  /** Ne peut pas attaquer jusqu'au prochain tour de ce joueur (Toucher glacé, Labyrinthe gelé). */
  cannotAttackUntil: PlayerIndex | null;
  /** Immobilisée jusqu'au prochain tour de ce joueur (Toucher glacé). */
  immobileUntil: PlayerIndex | null;
  /** Bonus d'attaque jusqu'à la fin du tour. */
  tempAttack: number;
  /** Capacités gagnées jusqu'à la fin du tour (pouvoir de Zardoc). */
  tempKeywords: Keywords;
  /** À la fin du tour de son propriétaire, elle est détruite (Grand final de Kat) ou bannie (Dernier ordre de Seria). */
  doomed: 'destroy' | 'banish' | null;
  /** Ne peut pas être ciblée jusqu'au prochain tour de ce joueur (Jour du Sanctuaire). */
  untargetableUntil: PlayerIndex | null;
  /** La créature s'est déplacée ce tour-ci (une créature Rapide peut encore attaquer). */
  moved: boolean;
  enchantments: Enchantment[];
  /** La créature a déjà attaqué ou s'est déjà déplacée ce tour-ci. */
  acted: boolean;
  /** La créature a attaqué ce tour-ci (Rétablissement). */
  attacked: boolean;
}

export interface DeployBonus {
  atk: number;
  ret: number;
  hp: number;
}

const NO_DEPLOY_BONUS: Readonly<DeployBonus> = { atk: 0, ret: 0, hp: 0 };

export interface PlacedUnit extends SlotRef {
  unit: Unit;
  owner: PlayerIndex;
}

export interface PlayerState extends Record<StatKey, number> {
  readonly id: string;
  readonly isAi: boolean;
  /** Compte du joueur (null pour l'IA) : sert à enregistrer le résultat de la partie. */
  readonly accountId: string | null;
  /** Nom affiché du joueur. */
  readonly name: string;
  readonly deckId: DeckId;
  readonly faction: FactionId;
  hp: number;
  maxHp: number;
  res: number;
  maxRes: number;
  /** Bibliothèque : la dernière carte est le dessus. */
  deck: string[];
  hand: string[];
  grave: string[];
  board: (Unit | null)[][];
  /** Le héros a déjà utilisé son action du tour (développement, pioche ou pouvoir). */
  heroActionUsed: boolean;
  /** PV ajoutés aux créatures de mêlée déployées ce tour-ci. */
  meleeDeployBonus: number;
  /** Bonus de la prochaine créature déployée ce tour-ci (événements). */
  nextDeployBonus: DeployBonus;
  /** Le joueur voit la main adverse jusqu'à la fin de son tour (Pilier de clairvoyance). */
  seesOpponentHand: boolean;
  /** Un espion a déjà augmenté la production ce tour-ci (Shinobi maître chanteur). */
  blackmailUsed: boolean;
  /** Le joueur a défaussé une carte ce tour-ci (Plieur de destin). */
  discardedThisTurn: boolean;
  /** Créatures déployées ce tour-ci (Débandade). */
  deployedThisTurn: number;
  /** Cartes jouées ce tour-ci (Arbitres aveugles). */
  cardsPlayedThisTurn: number;
  /** Créatures mises au cimetière depuis la fin du dernier tour du joueur (pouvoir d'Adar-Malik). */
  recentDead: string[];
  /** Carte révélée par l'Autel des souhaits : elle ne coûte rien ce tour-ci. */
  freeCard: string | null;
  /** Le joueur a quitté la partie (abandon ou déconnexion). */
  left: boolean;
}

export type LogTone = 'turn' | 'damage' | 'action' | 'info';

export interface LogEntry {
  text: string;
  tone: LogTone;
  player: PlayerIndex | null;
}

/** Effets visuels à rejouer par les clients (attaques, dégâts, soins, renforcements). */
export type GameEvent =
  | { kind: 'attack'; attacker: number; target: Target }
  /** Le défenseur riposte contre la créature qui vient de l'attaquer. */
  | { kind: 'retaliate'; attacker: number; target: Target }
  | { kind: 'damage' | 'heal'; target: Target; amount: number }
  | { kind: 'buff'; target: Target };

/** Carte jouée ou pouvoir du héros utilisé, révélé aux deux joueurs mais pas encore résolu. */
export type PendingPlay = {
  player: PlayerIndex;
  choices: Choice[];
  /** Cartes retirées de la main par les choix `hand` (secrètes). */
  taken: string[];
} & ({ kind: 'card'; cardId: string } | { kind: 'power' } | { kind: 'event'; eventId: string });

/** Riposte due par le défenseur, résolue juste après l'attaque. */
interface PendingRetaliation {
  /** Le défenseur, qui peut être mort entre-temps s'il a Rétribution. */
  defender: Unit;
  /** Sa riposte au moment de l'attaque, utilisée s'il est mort. */
  amount: number;
  attacker: number;
  /** Cible de l'attaque, pour la seconde attaque d'une Double attaque. */
  target: Target;
  /** C'était la première attaque de la créature ce tour-ci. */
  first: boolean;
  /** Ce que subit l'attaquant après l'attaque (Guerrier shinje, Maniaque des flammes). */
  reprisal: Reprisal;
  /** L'attaquant a infligé des dégâts d'attaque : son Drain de vie s'applique après la riposte. */
  drained: boolean;
}

interface Reprisal {
  destroy: boolean;
  damage: number;
}

/**
 * Raison d'un choix après résolution : ce que deviendra la carte choisie. Les cartes révélées ne sont montrées qu'au
 * joueur qui choisit.
 */
export type PickReason =
  /** Dans la main adverse : la carte (et, si `sameName`, ses homonymes) est défaussée ; `purge` détruit aussi ses homonymes en jeu. */
  | { kind: 'discardFromHand'; sameName: boolean; purge: boolean }
  /** Dans la bibliothèque adverse : la carte va au cimetière, puis la bibliothèque est mélangée. */
  | { kind: 'millLibrary' }
  /** Parmi les cartes du dessus de sa bibliothèque : l'une va en main, les autres dessous. */
  | { kind: 'keepFromTop'; cards: string[] }
  /** Remettre les cartes du dessus dans l'ordre : chaque carte choisie est replacée au-dessus des précédentes. */
  | { kind: 'reorderTop'; remaining: string[]; placed: string[] }
  /** Simple consultation (Rapport d'espion). */
  | { kind: 'browse' }
  /** Briseur de sorts : détruire un sort permanent (carte en jeu, ou dernier enchantement d'une créature). */
  | { kind: 'smash' }
  /** Chant des perdus : choisir une créature ennemie à déplacer, ou arrêter. */
  | { kind: 'songTarget' }
  | { kind: 'songDestination'; uid: number };

export interface PendingPick {
  player: PlayerIndex;
  reason: PickReason;
  prompt: string;
  options: Choice[];
  labels: string[] | null;
  /** Cartes révélées au joueur qui choisit, dans l'ordre des options `card`. */
  revealed: string[];
}

/** Une étape de choix et les options légales à ce moment. */
export interface StepOptions {
  step: Step;
  options: Choice[];
  /** Pour une étape qui dépend des précédentes : ses options selon chaque suite de choix possible. */
  after: { previous: Choice[]; options: Choice[] }[] | null;
}

export interface PlayerSetup {
  id: string;
  deck: DeckId;
  isAi: boolean;
  accountId: string | null;
  name: string;
}

/** Issue d'une partie terminée, à prendre en compte dans les comptes des joueurs. */
export type GameOutcome =
  | { gameId: string; mode: 'pvp'; winnerId: string; loserId: string }
  | { gameId: string; mode: 'ai'; accountId: string; won: boolean };

export interface GameSetup {
  id: string;
  seed: number;
  players: readonly [PlayerSetup, PlayerSetup];
}

const adjacent = (a: SlotRef, b: SlotRef): boolean =>
  (a.row === b.row && Math.abs(a.lane - b.lane) === 1) || (a.lane === b.lane && a.row !== b.row);

const sameSlot = (a: SlotRef, b: SlotRef): boolean => a.row === b.row && a.lane === b.lane;

const POISON: DamageSource = { magic: false };

interface DamageResult {
  /** Dégâts réellement encaissés (au plus les PV restants). */
  dealt: number;
  /** Dégâts en trop au-delà des PV restants. */
  excess: number;
}

const NO_DAMAGE: Readonly<DamageResult> = { dealt: 0, excess: 0 };

export class Game {
  private players: [PlayerState, PlayerState];
  private currentPlayer: PlayerIndex = 0;
  private currentPhase: Phase = 'action';
  private turnCount = 0;
  private winnerIndex: PlayerIndex | null = null;
  private pendingPlay: PendingPlay | null = null;
  private pendingRetaliation: PendingRetaliation | null = null;
  private lastUid = 0;
  private logEntries: LogEntry[] = [];
  private pendingEvents: GameEvent[] = [];
  /** Pioche d'événements commune aux deux joueurs : le dernier est le dessus. */
  private eventDeck: string[] = [];
  /** Événements sortis du jeu, remélangés quand la pioche est vide. */
  private eventDiscard: string[] = [];
  /** Événements en jeu, de gauche à droite. */
  private eventRow: string[] = [];
  /** Événements déjà utilisés par le joueur actif ce tour-ci (par position). */
  private eventsUsed: boolean[] = [];
  /** Cartes qui restent en jeu, des deux joueurs, dans l'ordre où elles ont été jouées. */
  private lastingCards: LastingCard[] = [];
  /** Créatures mises au cimetière depuis le début du tour. */
  private deathsThisTurn = 0;
  /** Choix à faire après la résolution d'une carte ; aucune autre action n'est possible entre-temps. */
  private pendingPickState: PendingPick | null = null;
  /** Carte dont l'effet est en train d'être appliqué, et son joueur (protections contre les sorts et fortunes). */
  private resolving: { cardId: string; player: PlayerIndex } | null = null;
  /** Le joueur actif est dans sa phase de ravitaillement (Arbitre du Néant, Salles de l'inertie). */
  private supplyPhase = false;

  private constructor(
    readonly id: string,
    private rng: SeededRandom,
    setups: readonly [PlayerSetup, PlayerSetup],
  ) {
    this.players = [this.createPlayer(setups[0]), this.createPlayer(setups[1])];
  }

  static create(setup: GameSetup): Game {
    return new Game(setup.id, new SeededRandom(setup.seed), setup.players).start();
  }

  /** Partie contre l'IA : elle joue un deck d'une autre faction que celui du joueur, tiré au hasard. */
  static createAgainstAi(opts: { id: string; seed: number; player: Omit<PlayerSetup, 'isAi'> }): Game {
    const rng = new SeededRandom(opts.seed);
    const faction = DECKS[opts.player.deck].faction;
    const aiDeck = rng.pick(PLAYABLE_DECKS.filter(d => DECKS[d].faction !== faction));
    return new Game(opts.id, rng, [
      { ...opts.player, isAi: false },
      { id: AI_PLAYER_ID, deck: aiDeck, isAi: true, accountId: null, name: AI_PLAYER_NAME },
    ]).start();
  }

  /** Copie indépendante de la partie (sans journal ni événements), pour simuler un coup. */
  clone(): Game {
    const copy = Object.create(Game.prototype) as Game;
    Object.assign(copy, {
      id: this.id,
      rng: this.rng.clone(),
      players: structuredClone(this.players),
      currentPlayer: this.currentPlayer,
      currentPhase: this.currentPhase,
      turnCount: this.turnCount,
      winnerIndex: this.winnerIndex,
      pendingPlay: structuredClone(this.pendingPlay),
      pendingRetaliation: structuredClone(this.pendingRetaliation),
      lastUid: this.lastUid,
      logEntries: [],
      pendingEvents: [],
      eventDeck: [...this.eventDeck],
      eventDiscard: [...this.eventDiscard],
      eventRow: [...this.eventRow],
      eventsUsed: [...this.eventsUsed],
      lastingCards: structuredClone(this.lastingCards),
      deathsThisTurn: this.deathsThisTurn,
      pendingPickState: structuredClone(this.pendingPickState),
      resolving: this.resolving,
      supplyPhase: this.supplyPhase,
    });
    return copy;
  }

  // ==================================================================
  //  Lecture de l'état
  // ==================================================================
  get current(): PlayerIndex { return this.currentPlayer; }
  get phase(): Phase { return this.currentPhase; }
  get turn(): number { return this.turnCount; }
  get winner(): PlayerIndex | null { return this.winnerIndex; }
  get isOver(): boolean { return this.currentPhase === 'over'; }
  get pending(): Readonly<PendingPlay> | null { return this.pendingPlay; }
  /** Une riposte attend d'être résolue (voir resolveRetaliation). */
  get hasPendingRetaliation(): boolean { return this.pendingRetaliation !== null; }
  /** Choix après résolution en attente (voir pick). */
  get pendingPick(): Readonly<PendingPick> | null { return this.pendingPickState; }
  get log(): readonly LogEntry[] { return this.logEntries; }
  get currentIsAi(): boolean { return this.players[this.currentPlayer].isAi; }

  /** Événements en jeu, de gauche à droite (celui de gauche part à la fin du tour). */
  get events(): readonly string[] { return this.eventRow; }
  get eventDeckCount(): number { return this.eventDeck.length; }

  /** L'événement à cette position a déjà été utilisé par le joueur actif ce tour-ci. */
  eventUsed(slot: number): boolean {
    return this.eventsUsed[slot] ?? false;
  }

  player(pi: PlayerIndex): Readonly<PlayerState> {
    return this.players[pi];
  }

  /** Cartes qui restent en jeu, des deux joueurs ; un choix `lasting` désigne une position dans cette liste. */
  get lasting(): readonly LastingCard[] { return this.lastingCards; }

  hero(pi: PlayerIndex): Hero {
    return DECKS[this.players[pi].deckId].hero;
  }

  heroName(pi: PlayerIndex): string {
    return this.hero(pi).name;
  }

  heroPower(pi: PlayerIndex): HeroPower | null {
    return this.hero(pi).power;
  }

  /** Caractéristique du héros, augmentée par les créatures chanceuses pour la Destinée. */
  statOf(pi: PlayerIndex, stat: StatKey): number {
    const key = stat === 'd' ? 'lucky' : stat === 'g' ? 'magicChannel' : null;
    const bonus = key ? this.units(pi).reduce((sum, x) => sum + (x.unit.keywords[key] ?? 0), 0) : 0;
    return this.players[pi][stat] + bonus;
  }

  /** Index du joueur encore présent dans la partie, ou null. */
  indexOf(playerId: string): PlayerIndex | null {
    const pi = this.players.findIndex(p => p.id === playerId && !p.left);
    return pi === -1 ? null : (pi as PlayerIndex);
  }

  /** Index des joueurs humains encore présents. */
  humanPlayers(): PlayerIndex[] {
    return ([0, 1] as const).filter(pi => !this.players[pi].isAi && !this.players[pi].left);
  }

  get isAbandoned(): boolean {
    return this.humanPlayers().length === 0;
  }

  /**
   * Issue de la partie terminée pour les comptes des joueurs : classée entre deux comptes, ou contre l'IA.
   * Null tant que la partie n'est pas finie, ou si un joueur n'a pas de compte.
   */
  outcome(): GameOutcome | null {
    if (!this.isOver || this.winnerIndex === null) return null;
    const winner = this.players[this.winnerIndex];
    const loser = this.players[other(this.winnerIndex)];
    if (winner.isAi || loser.isAi) {
      const human = winner.isAi ? loser : winner;
      return human.accountId === null ? null : { gameId: this.id, mode: 'ai', accountId: human.accountId, won: human === winner };
    }
    if (winner.accountId === null || loser.accountId === null) return null;
    return { gameId: this.id, mode: 'pvp', winnerId: winner.accountId, loserId: loser.accountId };
  }

  /** Vide et retourne les événements visuels produits depuis le dernier appel. */
  drainEvents(): GameEvent[] {
    const events = this.pendingEvents;
    this.pendingEvents = [];
    return events;
  }

  units(pi: PlayerIndex): PlacedUnit[] {
    const r: PlacedUnit[] = [];
    const board = this.players[pi].board;
    for (let row = 0; row < ROWS; row++) {
      for (let lane = 0; lane < LANES; lane++) {
        const unit = board[row]![lane];
        if (unit) r.push({ unit, owner: pi, row, lane });
      }
    }
    return r;
  }

  emptySlots(pi: PlayerIndex): SlotRef[] {
    const r: SlotRef[] = [];
    const board = this.players[pi].board;
    for (let row = 0; row < ROWS; row++) {
      for (let lane = 0; lane < LANES; lane++) if (!board[row]![lane]) r.push({ row, lane });
    }
    return r;
  }

  /** Cases libres où ce type de créature peut se trouver : mêlée à l'avant, tireur à l'arrière, volant partout. */
  placementSlots(pi: PlayerIndex, attackType: AttackType): SlotRef[] {
    return this.emptySlots(pi).filter(s => ALLOWED_ROWS[attackType].includes(s.row));
  }

  /**
   * Cases où déployer la créature : cases libres autorisées, et piles de la même créature si elle est empilable,
   * hors des couloirs bloqués par une créature ennemie (Nyorai sairensa).
   */
  deploySlots(pi: PlayerIndex, card: CreatureCard): SlotRef[] {
    const blocked = new Set(this.units(other(pi)).filter(x => x.unit.keywords.blockLane).map(x => x.lane));
    const free = this.placementSlots(pi, card.attackType);
    const stacks = card.keywords.stackable
      ? this.units(pi).filter(x => x.unit.cardId === card.id).map(({ row, lane }) => ({ row, lane }))
      : [];
    const replaced = card.keywords.replaces
      ? this.units(pi).filter(x => x.unit.cardId !== card.id && ALLOWED_ROWS[card.attackType].includes(x.row)).map(({ row, lane }) => ({ row, lane }))
      : [];
    return [...free, ...stacks, ...replaced].filter(s => !blocked.has(s.lane));
  }

  /** Cases où une créature déplacée de force peut aller : cases libres autorisées de son camp, ou sa case actuelle. */
  relocationCells(uid: number): Choice[] {
    const found = this.locate(uid);
    if (!found) return [];
    const cell = (s: SlotRef): Choice => ({ kind: 'cell', player: found.owner, row: s.row, lane: s.lane });
    return [cell(found), ...this.placementSlots(found.owner, found.unit.attackType).map(cell)];
  }

  locate(uid: number): PlacedUnit | null {
    for (const pi of [0, 1] as const) {
      const found = this.units(pi).find(x => x.unit.uid === uid);
      if (found) return found;
    }
    return null;
  }

  /** Créatures adjacentes à celle-ci, dans le même camp. */
  adjacentUnits(uid: number): Unit[] {
    const found = this.locate(uid);
    if (!found) return [];
    return this.units(found.owner).filter(x => adjacent(x, found)).map(x => x.unit);
  }

  /**
   * Attaque actuelle de la créature (au minimum 0) : marqueurs, enchantements, bonus de meute et d'Honneur,
   * cartes permanentes en jeu et capacité du héros. Sous Trêve d'Elrath, elle est égale à sa riposte.
   */
  attackOf(unit: Unit): number {
    if (this.lastingCards.some(e => rulesOf(e).attackEqualsRetaliation)) return this.retaliationOf(unit);
    const honorAttack = unit.keywords.honor ? this.hero(unit.owner).passive?.honorAttack ?? 0 : 0;
    const base = unit.keywords.mightStats ? this.statOf(unit.owner, 'm') : unit.atk;
    const discardRage = this.players[other(unit.owner)].discardedThisTurn ? unit.keywords.discardRage ?? 0 : 0;
    return Math.max(0, base + unit.boost + this.statBonus(unit, 'atk') + honorAttack + discardRage);
  }

  /** Riposte actuelle de la créature (au minimum 0) : comme l'attaque, plus les auras des autres créatures alliées. */
  retaliationOf(unit: Unit): number {
    const aura = this.units(unit.owner).reduce((sum, x) => sum + (x.unit === unit ? 0 : x.unit.keywords.retAura ?? 0), 0);
    const base = unit.keywords.mightStats ? this.statOf(unit.owner, 'm') : unit.ret;
    return Math.max(0, base + this.statBonus(unit, 'ret') + aura);
  }

  /**
   * Capacités actuelles de la créature : les siennes, celles de ses enchantements et des cartes permanentes en jeu,
   * et l'Explosion donnée aux créatures de l'Eau par un allié (Kirin sacré).
   */
  keywordsOf(unit: Unit): Keywords {
    let k: Keywords = mergeKeywords(unit.keywords, unit.tempKeywords);
    for (const e of unit.enchantments) k = mergeKeywords(k, e.keywords);
    for (const entry of this.lastingCards) {
      const granted = rulesOf(entry).keywords?.(this, unit, entry);
      if (granted) k = mergeKeywords(k, granted);
    }
    const waterBlast = this.units(unit.owner).reduce((max, x) => Math.max(max, x.unit === unit ? 0 : x.unit.keywords.waterBlast ?? 0), 0);
    if (waterBlast && schoolOf(unit) === 'Eau') k.areaBlast = Math.max(k.areaBlast ?? 0, waterBlast);
    if (k.infect) {
      k.infect += this.units(unit.owner).reduce((sum, x) => sum + (x.unit === unit ? 0 : x.unit.keywords.infectAura ?? 0), 0);
    }
    const found = this.locate(unit.uid);
    if (found && this.units(other(found.owner)).some(x => x.lane === found.lane && x.unit.keywords.berserkAura)) k.berserk = true;
    for (const entry of this.lastingCards) rulesOf(entry).suppresses?.forEach(key => delete k[key]);
    return k;
  }

  /** La créature ne peut pas bouger : immobilisée (Toucher glacé) ou hypnotisée par une créature ennemie de son couloir. */
  isImmobilized(unit: Unit): boolean {
    if (unit.immobileUntil !== null) return true;
    const found = this.locate(unit.uid);
    return !!found && this.units(other(found.owner)).some(x => x.lane === found.lane && this.keywordsOf(x.unit).hypnotize);
  }

  /** La créature ne peut pas attaquer ce tour-ci (Toucher glacé, cartes permanentes, Salle des défis). */
  cannotAttack(unit: Unit): boolean {
    if (unit.cannotAttackUntil !== null || this.keywordsOf(unit).noAttack) return true;
    const found = this.locate(unit.uid);
    return this.lastingCards.some(entry => {
      const rules = rulesOf(entry);
      if (rules.cannotAttack?.(this, unit, entry)) return true;
      return !!rules.oneAttackPerLine && !!found && entry.owner !== unit.owner
        && this.units(unit.owner).some(x => x.unit !== unit && x.row === found.row && x.unit.attacked);
    });
  }

  /** La créature peut être ciblée par les sorts et les capacités (pas par une carte permanente comme Ange gardien). */
  isTargetable(uid: number): boolean {
    const unit = this.locate(uid)?.unit;
    if (!unit || unit.untargetableUntil !== null || this.keywordsOf(unit).untargetable) return false;
    return !this.lastingCards.some(entry => rulesOf(entry).untargetable?.(this, unit, entry));
  }

  /**
   * Étapes de choix de la carte et leurs options légales ; une créature protégée contre ce type de carte (sort de Ténèbres,
   * fortune, sort ennemi) ne peut pas être ciblée.
   */
  playSteps(pi: PlayerIndex, handIndex: number): StepOptions[] {
    const cardId = this.players[pi].hand[handIndex];
    if (cardId === undefined) return [];
    const card = getCard(cardId);
    const steps = this.stepOptions(pi, card.type === 'creature' ? this.deploySteps(pi, card) : card.effect.steps, { handIndex });
    if (card.type === 'creature') return steps;
    const allowed = (c: Choice) => c.kind !== 'unit' || !this.isWardedAgainst(c.uid, card, pi);
    return steps.map(s => ({
      ...s, options: s.options.filter(allowed), after: s.after?.map(a => ({ ...a, options: a.options.filter(allowed) })) ?? null,
    }));
  }

  powerSteps(pi: PlayerIndex): StepOptions[] {
    const power = this.heroPower(pi);
    return power ? this.stepOptions(pi, power.effect.steps, { handIndex: null }) : [];
  }

  eventSteps(pi: PlayerIndex, slot: number): StepOptions[] {
    const event = this.activeEventAt(slot);
    return event ? this.stepOptions(pi, event.effect.steps, { handIndex: null }) : [];
  }

  /** Coût d'une carte pour ce joueur, modifié par les événements permanents et les cartes permanentes en jeu (au minimum 0). */
  cardCost(pi: PlayerIndex, card: Card): number {
    if (this.players[pi].freeCard === card.id) return 0;
    let cost = card.cost;
    for (const entry of this.lastingCards) {
      const override = rulesOf(entry).costOverride?.(this, pi, card, entry) ?? null;
      if (override !== null) cost = Math.min(cost, override);
    }
    const events = this.eventRow.reduce((sum, id) => {
      const event = getEvent(id);
      return sum + (event.kind === 'ongoing' ? event.costModifier?.(card) ?? 0 : 0);
    }, 0);
    const lasting = this.lastingCards.reduce((sum, entry) => sum + (rulesOf(entry).costDelta?.(this, pi, card, entry) ?? 0), 0);
    const blood = card.type === 'creature' && card.keywords.bloodDiscount ? this.deathsThisTurn : 0;
    return Math.max(0, cost + events + lasting - blood);
  }

  /** Raison pour laquelle la carte ne peut pas être jouée, ou null si elle le peut. */
  whyNotPlay(pi: PlayerIndex, handIndex: number): string | null {
    const turnError = this.turnError(pi);
    if (turnError) return turnError;
    const p = this.players[pi];
    const cardId = p.hand[handIndex];
    if (cardId === undefined) return 'Carte introuvable.';
    const card = getCard(cardId);
    if (p.res < this.cardCost(pi, card)) return 'Pas assez de ressources.';
    const limit = this.eventRow.reduce((min, id) => {
      const event = getEvent(id);
      return event.kind === 'ongoing' && event.maxCardsPerTurn !== undefined ? Math.min(min, event.maxCardsPerTurn) : min;
    }, Infinity);
    if (p.cardsPlayedThisTurn >= limit) return `Vous ne pouvez pas jouer plus de ${limit} cartes par tour.`;
    if (card.type === 'creature' && this.lastingCards.some(e => rulesOf(e).forbidsDeploy?.(this, pi, e))) {
      return 'Vous ne pouvez pas déployer de créature ce tour-ci.';
    }
    const condition = card.type === 'creature' ? null : card.effect.requirement?.(this, pi) ?? null;
    return this.requirementError(pi, card.req) ?? condition ?? this.stepsError(this.playSteps(pi, handIndex));
  }

  /** Raison pour laquelle le héros ne peut pas agir (développement, pioche ou pouvoir), ou null. */
  whyNotHeroAction(pi: PlayerIndex): string | null {
    return this.turnError(pi) ?? (this.players[pi].heroActionUsed ? 'Votre héros a déjà agi ce tour-ci.' : null);
  }

  whyNotDevelop(pi: PlayerIndex, choice: DevelopChoice): string | null {
    const heroError = this.whyNotHeroAction(pi);
    if (heroError) return heroError;
    return choice === 'draw' && this.players[pi].res < DRAW_COST ? 'Piocher coûte 1 ressource.' : null;
  }

  whyNotPower(pi: PlayerIndex): string | null {
    const heroError = this.whyNotHeroAction(pi);
    if (heroError) return heroError;
    const power = this.heroPower(pi);
    if (!power) return 'Votre héros n\'a pas de pouvoir.';
    if (this.players[pi].res < power.cost) return 'Pas assez de ressources.';
    return this.stepsError(this.powerSteps(pi));
  }

  /** Raison pour laquelle l'événement ne peut pas être utilisé, ou null. */
  whyNotUseEvent(pi: PlayerIndex, slot: number): string | null {
    const turnError = this.turnError(pi);
    if (turnError) return turnError;
    const id = this.eventRow[slot];
    if (id === undefined) return 'Événement introuvable.';
    const event = getEvent(id);
    if (event.kind === 'ongoing') return 'Cet événement est permanent : il ne s\'utilise pas.';
    if (this.eventsUsed[slot]) return 'Vous avez déjà utilisé cet événement ce tour-ci.';
    if (this.players[pi].res < event.cost) return 'Pas assez de ressources.';
    return this.stepsError(this.eventSteps(pi, slot));
  }

  /** Raison pour laquelle la créature ne peut ni attaquer ni se déplacer, ou null. */
  whyNotUnitAct(pi: PlayerIndex, uid: number): string | null {
    const error = this.unitTurnError(pi, uid);
    if (error) return error;
    const unit = this.locate(uid)!.unit;
    return this.hasUsed(unit, 'attack') && this.hasUsed(unit, 'move') ? 'Cette créature a déjà agi ce tour-ci.' : null;
  }

  whyNotAttack(pi: PlayerIndex, uid: number): string | null {
    const error = this.unitTurnError(pi, uid);
    if (error) return error;
    const unit = this.locate(uid)!.unit;
    if (this.hasUsed(unit, 'attack')) return 'Cette créature a déjà agi ce tour-ci.';
    if (this.cannotAttack(unit)) return 'Cette créature ne peut pas attaquer ce tour-ci.';
    return this.attackOf(unit) > 0 ? null : 'Cette créature n\'a pas d\'attaque.';
  }

  /**
   * Cibles d'attaque d'une créature, dans son couloir : la mêlée et les volants frappent la ligne avant
   * adverse si elle est occupée, les tireurs choisissent. Sans créature adverse dans le couloir, le héros.
   * « Ubiquité » atteint toute créature ennemie ; une créature qui provoque doit être attaquée si possible.
   */
  attackTargets(pi: PlayerIndex, uid: number): Target[] {
    return this.whyNotAttack(pi, uid) ? [] : this.reachableTargets(this.locate(uid)!);
  }

  /** Cibles à portée de la créature, sans tenir compte de ce qu'elle a déjà fait ce tour-ci. */
  private reachableTargets({ unit, lane, owner: pi }: PlacedUnit): Target[] {
    const e = other(pi);
    const enemyBoard = this.players[e].board;
    const front = enemyBoard[0]![lane];
    const back = enemyBoard[1]![lane];
    const hero: Target = { kind: 'hero', player: e };
    const toTarget = (u: Unit): Target => ({ kind: 'unit', uid: u.uid });
    let targets: Target[];
    if (this.keywordsOf(unit).attackAnywhere) {
      targets = this.units(e).map(x => toTarget(x.unit));
      if (!front && !back) targets.push(hero);
    } else if (!front && !back) {
      targets = [hero];
    } else {
      const reachable = unit.attackType === 'shooter' ? [front, back] : [front ?? back];
      targets = reachable.filter((u): u is Unit => !!u).map(toTarget);
    }
    const might = getCard(unit.cardId).req.m ?? 0;
    targets = targets.filter(t => t.kind === 'hero' || this.canBeAttackedBy(t.uid, might));
    const taunting = targets.filter(t => t.kind === 'unit' && this.unitKeywords(t.uid).taunt);
    return taunting.length ? taunting : targets;
  }

  /** Erreurs communes aux actions d'une créature : tour, propriétaire, tour de déploiement (sauf Attaque rapide). */
  private unitTurnError(pi: PlayerIndex, uid: number): string | null {
    const turnError = this.turnError(pi);
    if (turnError) return turnError;
    const found = this.locate(uid);
    if (!found || found.owner !== pi) return 'Créature introuvable.';
    if (found.unit.deployedTurn === this.turnCount && !this.keywordsOf(found.unit).quickAttack) {
      return 'Une créature ne peut pas agir le tour de son déploiement.';
    }
    return null;
  }

  /** La créature a déjà attaqué (ou s'est déjà déplacée) ce tour-ci ; une créature Rapide peut faire les deux. */
  private hasUsed(unit: Unit, action: 'attack' | 'move'): boolean {
    if (!this.keywordsOf(unit).swift) return unit.acted;
    return action === 'attack' ? unit.attacked : unit.moved;
  }

  /** La créature est protégée contre cette carte : sort de Ténèbres, fortune, ou sort d'un adversaire. */
  private isWardedAgainst(uid: number, card: Card, caster: PlayerIndex): boolean {
    const unit = this.locate(uid)?.unit;
    if (!unit || card.type === 'creature') return false;
    const k = this.keywordsOf(unit);
    if (card.type === 'fortune') return !!k.fortuneWard;
    return (card.school === 'Ténèbres' && !!k.darkWard) || (!!k.enemySpellWard && unit.owner !== caster);
  }

  /** La carte en cours de résolution ne peut pas affecter cette créature (voir isWardedAgainst). */
  private isShielded(unit: Unit): boolean {
    return !!this.resolving && this.isWardedAgainst(unit.uid, getCard(this.resolving.cardId), this.resolving.player);
  }

  /** Personne ne peut piocher hors de sa phase de ravitaillement (Arbitre du Néant, Salles de l'inertie). */
  private drawLocked(): boolean {
    return [...this.units(0), ...this.units(1)].some(x => x.unit.keywords.noExtraDraw)
      || this.lastingCards.some(e => rulesOf(e).noExtraDraw);
  }

  /** Les cartes et capacités ne font plus gagner de ressources (Okane no okane). */
  private resourcesLocked(): boolean {
    return [...this.units(0), ...this.units(1)].some(x => x.unit.keywords.noResourceGain);
  }

  /** Une créature quitte le jeu (morte, bannie ou renvoyée en main) : Voyant du chaos. */
  private onLeave({ unit, owner }: PlacedUnit): void {
    if (unit.keywords.leaveDiscard && this.currentPlayer !== owner) this.discardRandom(other(owner));
  }

  /** Une créature entre dans un couloir enchanté par Éclats de glace. */
  private enterLane(unit: Unit, lane: number): void {
    for (const entry of this.lastingCards) {
      const damage = rulesOf(entry).laneDamage;
      if (damage && entry.lane === lane) this.damageUnit(unit.uid, damage, ICE);
    }
  }

  /** Pose la créature jouée : remplacement (Kabuki tei), Appeleur de sang, Déjouer ou effet à l'arrivée. */
  private resolveCreature(pi: PlayerIndex, card: CreatureCard, choices: readonly Choice[]): void {
    const [slot, ...rest] = choices;
    this.players[pi].deployedThisTurn++;
    if (card.keywords.bloodPact) {
      this.bloodPact(pi, card, choices);
      return;
    }
    if (slot?.kind !== 'slot') return;
    const occupant = this.players[pi].board[slot.row]![slot.lane];
    if (card.keywords.replaces && occupant && occupant.cardId !== card.id) this.returnToHand(occupant.uid);
    const unit = this.deploy(pi, card, slot);
    const [moved, to] = rest;
    if (card.keywords.outmanoeuvre) {
      if (moved?.kind === 'unit' && to?.kind === 'cell') this.relocate(moved.uid, to);
      return;
    }
    if (card.arrival && this.locate(unit.uid)) card.arrival.apply(this, pi, { choices: rest, taken: [], self: unit.uid });
  }

  /** La créature peut être attaquée : ni protégée par la Peur contre cet attaquant, ni par une créature Imposante. */
  private canBeAttackedBy(uid: number, attackerMight: number): boolean {
    const found = this.locate(uid);
    if (!found) return false;
    const fear = this.keywordsOf(found.unit).fear;
    return !(fear !== undefined && attackerMight <= fear) && !this.isSheltered(found);
  }

  /** Une autre créature alliée Imposante du même couloir protège celle-ci des attaques et des dégâts de combat. */
  private isSheltered(found: PlacedUnit): boolean {
    return this.units(found.owner).some(x => x.unit !== found.unit && x.lane === found.lane && this.keywordsOf(x.unit).towering);
  }

  moveDestinations(pi: PlayerIndex, uid: number): SlotRef[] {
    if (this.unitTurnError(pi, uid)) return [];
    const found = this.locate(uid)!;
    if (this.hasUsed(found.unit, 'move') || this.isImmobilized(found.unit) || this.keywordsOf(found.unit).anchored) return [];
    return this.placementSlots(pi, found.unit.attackType).filter(s => adjacent(found, s));
  }

  // ==================================================================
  //  Actions des joueurs
  // ==================================================================
  apply(pi: PlayerIndex, action: GameAction): void {
    switch (action.type) {
      case 'develop': return this.develop(pi, action.choice);
      case 'play': return this.playCard(pi, action.handIndex, action.choices);
      case 'power': return this.usePower(pi, action.choices);
      case 'event': return this.useEvent(pi, action.slot, action.choices);
      case 'attack': return this.attack(pi, action.uid, action.target);
      case 'move': return this.moveUnit(pi, action.uid, action.to);
      case 'pick': return this.pick(pi, action.choice);
      case 'endTurn': return this.endTurn(pi);
    }
  }

  /** Action du héros : +1 dans une caractéristique (gratuit), ou piocher une carte (1 ressource). */
  develop(pi: PlayerIndex, choice: DevelopChoice): void {
    this.assertNoError(this.whyNotDevelop(pi, choice));
    const p = this.players[pi];
    p.heroActionUsed = true;
    if (choice === 'draw') {
      p.res -= DRAW_COST;
      this.addLog(`${this.heroName(pi)} pioche une carte supplémentaire.`, 'action', pi);
      this.draw(pi, 1);
    } else {
      p[choice]++;
      this.addLog(`${this.heroName(pi)} développe sa ${STAT_NAMES[choice]} (${p[choice]}).`, 'action', pi);
    }
  }

  /**
   * Joue une carte : elle est payée, retirée de la main (avec les cartes choisies dans la main) et révélée,
   * mais son effet n'est appliqué (ou la créature posée) qu'à l'appel de resolvePending().
   * Aucune autre action n'est possible entre-temps.
   */
  playCard(pi: PlayerIndex, handIndex: number, choices: readonly Choice[]): void {
    this.assertNoError(this.whyNotPlay(pi, handIndex));
    const p = this.players[pi];
    const card = getCard(p.hand[handIndex]!);
    if (!this.validChoices(pi, this.playSteps(pi, handIndex), choices)) {
      throw new GameRuleError(card.type === 'creature' ? 'Choisissez un emplacement autorisé.' : 'Choix invalide.');
    }

    p.res -= this.cardCost(pi, card);
    if (p.freeCard === card.id) p.freeCard = null;
    p.cardsPlayedThisTurn++;
    const [, ...taken] = this.takeFromHand(pi, [handIndex, ...handIndices(choices)]);
    this.pendingPlay = { kind: 'card', player: pi, cardId: card.id, choices: [...choices], taken };
    const target = choices.find(c => c.kind === 'unit' || c.kind === 'hero');
    if (card.type === 'creature') this.addLog(`${this.heroName(pi)} déploie ${card.name}.`, 'action', pi);
    else this.addLog(`${this.heroName(pi)} joue ${card.name}${target ? ' sur ' + this.targetName(target as Target) : ''}.`, 'action', pi);
    this.imposeDiscards(pi);
    for (const entry of this.lastingCards) {
      if (rulesOf(entry).punishesPlays && entry.owner !== pi && entry.subject === card.type) this.discardRandom(pi);
    }
  }

  /** Résout la carte jouée (pose la créature ou applique l'effet) ou le pouvoir du héros. */
  resolvePending(): void {
    const play = this.pendingPlay;
    if (!play) throw new GameRuleError('Aucune carte à résoudre.');
    this.pendingPlay = null;
    if (this.isOver) return;
    const { player: pi, choices, taken } = play;
    if (play.kind === 'power') {
      const power = this.heroPower(pi);
      if (power) this.applyEffect(power.effect, pi, choices, taken);
      this.settle();
      return;
    }
    if (play.kind === 'event') {
      const event = getEvent(play.eventId);
      if (event.kind === 'active') this.applyEffect(event.effect, pi, choices, taken);
      return;
    }
    const card = getCard(play.cardId);
    if (card.type === 'creature') {
      this.resolveCreature(pi, card, choices);
      this.settle();
      return;
    }
    const subject = choices.find(c => c.kind === 'unit');
    const mode = choices.find(c => c.kind === 'mode');
    const subjectCard = card.lasting?.subjects && mode?.kind === 'mode'
      ? card.lasting.subjects[mode.index] ?? null
      : subject?.kind === 'unit' ? this.locate(subject.uid)?.unit.cardId ?? null : null;
    this.resolving = { cardId: card.id, player: pi };
    card.effect.apply(this, pi, { choices, taken });
    this.resolving = null;
    if (card.lasting) {
      const lane = choices.find(c => c.kind === 'lane');
      this.lastingCards.push({ cardId: card.id, owner: pi, lane: lane?.kind === 'lane' ? lane.lane : null, subject: subjectCard, active: false });
    } else if (!card.ongoing) {
      this.bury(pi, [card.id]);
    }
    this.settle();
  }

  /**
   * Action du héros : pouvoir spécial. Comme une carte, il est payé et révélé, puis résolu par resolvePending().
   */
  usePower(pi: PlayerIndex, choices: readonly Choice[]): void {
    this.assertNoError(this.whyNotPower(pi));
    const power = this.heroPower(pi)!;
    if (!this.validChoices(pi, this.powerSteps(pi), choices)) throw new GameRuleError('Choix invalide.');
    const p = this.players[pi];
    p.res -= power.cost;
    p.heroActionUsed = true;
    const taken = this.takeFromHand(pi, handIndices(choices));
    const target = choices.find(c => c.kind === 'unit' || c.kind === 'hero');
    this.pendingPlay = { kind: 'power', player: pi, choices: [...choices], taken };
    this.addLog(`${this.heroName(pi)} utilise ${power.name}${target ? ' sur ' + this.targetName(target as Target) : ''}.`, 'action', pi);
  }

  /**
   * Utilise un événement en jeu : comme une carte, il est payé et révélé, puis résolu par resolvePending().
   * Chaque joueur peut utiliser chaque événement une fois par tour, qui que soit le joueur qui l'a apporté.
   */
  useEvent(pi: PlayerIndex, slot: number, choices: readonly Choice[]): void {
    this.assertNoError(this.whyNotUseEvent(pi, slot));
    const event = this.activeEventAt(slot)!;
    if (!this.validChoices(pi, this.eventSteps(pi, slot), choices)) throw new GameRuleError('Choix invalide.');
    this.players[pi].res -= event.cost;
    this.eventsUsed[slot] = true;
    const taken = this.takeFromHand(pi, handIndices(choices));
    this.pendingPlay = { kind: 'event', player: pi, eventId: event.id, choices: [...choices], taken };
    this.addLog(`${this.heroName(pi)} utilise l'événement ${event.name}.`, 'action', pi);
  }

  /**
   * La créature attaque une cible. Charge, Attaque en balayage et Explosion touchent d'autres créatures.
   * Si le défenseur a de la riposte et survit (ou a Rétribution), celle-ci est mise en attente et appliquée par
   * resolveRetaliation() ; aucune autre action n'est possible entre-temps. Avec Frappe préventive, il riposte d'abord.
   */
  attack(pi: PlayerIndex, uid: number, target: Target): void {
    this.assertNoError(this.whyNotAttack(pi, uid));
    if (!this.attackTargets(pi, uid).some(t => sameChoice(t, target))) throw new GameRuleError('Cette cible est hors de portée.');
    const unit = this.locate(uid)!.unit;
    unit.acted = true;
    unit.attacked = true;
    this.performAttack(pi, unit, target, true);
  }

  /**
   * Une attaque de la créature : la première, ou la seconde d'une Double attaque. Si une riposte est due, elle est
   * mise en attente ; la suite de l'attaque (seconde attaque, perte de la rage) se fait alors après elle.
   */
  private performAttack(pi: PlayerIndex, unit: Unit, target: Target, first: boolean): void {
    const uid = unit.uid;
    const name = getCard(unit.cardId).name;
    this.pendingEvents.push({ kind: 'attack', attacker: uid, target });

    const k = this.keywordsOf(unit);
    if (k.rampage) this.addCounters(unit, 'boost', 1);
    this.poisonousBulbs(unit);

    let drained = false;
    let reprisal: Reprisal = { destroy: false, damage: 0 };
    if (target.kind === 'hero') {
      const atk = this.attackOf(unit);
      this.addLog(`${name} frappe ${this.heroName(target.player)} (${atk}).`, 'damage', pi);
      drained = atk > 0;
      this.damageHero(target.player, atk);
      if (atk > 0 && k.blackmail) this.blackmail(pi);
    } else {
      this.addLog(`${name} attaque ${this.targetName(target)}.`, 'action', pi);
      const defender = this.locate(target.uid)!.unit;
      const dk = this.keywordsOf(defender);
      reprisal = { destroy: !!dk.destroysAttacker, damage: dk.punish ?? 0 };
      const retaliation = k.noret ? 0 : this.retaliationOf(defender);
      if (retaliation > 0 && dk.preemptive) {
        this.retaliate(defender, retaliation, uid);
        if (!this.locate(uid)) return;
      }
      const atk = this.attackOf(unit);
      const struck = [target.uid, ...this.extraStrikes(unit, target.uid)];
      const blasted = k.areaBlast ? this.adjacentUnits(target.uid) : [];
      for (const defenderUid of struck) {
        const { dealt, excess } = this.strike(unit, atk, defenderUid);
        if (dealt > 0) drained = true;
        const hit = this.locate(defenderUid)?.unit;
        if (dealt > 0 && hit) this.onAttackDamage(pi, k, hit);
        if (!hit && excess > 0 && k.trample && defenderUid === target.uid) this.damageHero(other(pi), excess);
      }
      const blast = k.areaBlast ?? 0;
      blasted.forEach(u => this.damageUnit(u.uid, blast, this.unitSource(unit)));
      const survived = this.locate(target.uid) !== null;
      if (retaliation > 0 && !dk.preemptive && (survived || dk.retribution) && this.locate(uid)) {
        this.pendingRetaliation = { defender, amount: retaliation, attacker: uid, target, first, reprisal, drained };
        return;
      }
    }
    this.applyLifeDrain(uid, drained);
    this.applyReprisal(unit, reprisal);
    this.afterAttack(unit, target, first);
  }

  /** Ce que subit l'attaquant après avoir attaqué : destruction (Guerrier shinje) ou dégâts (Maniaque des flammes). */
  private applyReprisal(attacker: Unit, reprisal: Reprisal): void {
    if (!this.locate(attacker.uid)) return;
    if (reprisal.damage > 0) this.damageUnit(attacker.uid, reprisal.damage, { magic: false });
    if (reprisal.destroy) this.destroyUnit(attacker.uid);
  }

  /**
   * Fin d'une attaque : une créature à Double attaque encore en vie attaque une seconde fois (la même cible si elle
   * est encore à portée, sinon la première à portée) ; après sa dernière attaque, la créature perd sa rage.
   */
  private afterAttack(unit: Unit, target: Target, first: boolean): void {
    const found = this.locate(unit.uid);
    if (!found || this.isOver) return;
    if (first && this.keywordsOf(unit).doubleAttack) {
      const reachable = this.reachableTargets(found);
      const next = reachable.find(t => sameChoice(t, target)) ?? reachable[0];
      if (next) {
        this.performAttack(found.owner, unit, next, false);
        return;
      }
    }
    const keepsEnrage = this.lastingCards.some(e => e.owner === unit.owner && rulesOf(e).keepsEnrage);
    if (!keepsEnrage) unit.enrage = 0;
    const gate = this.lastingCards.find(e => rulesOf(e).banishesAttackers && e.lane === found.lane && e.owner !== found.owner);
    if (gate) {
      this.banishUnit(unit.uid);
      return;
    }
    if (this.keywordsOf(unit).spellsmasher) this.offerSmash(found.owner);
  }

  /** Le défenseur riposte : il inflige sa valeur de riposte à son attaquant, même mort s'il a Rétribution. */
  resolveRetaliation(): void {
    const pending = this.pendingRetaliation;
    if (!pending) throw new GameRuleError('Aucune riposte à résoudre.');
    this.pendingRetaliation = null;
    const { defender } = pending;
    if (this.isOver || !this.locate(pending.attacker)) return;
    const alive = this.locate(defender.uid) !== null;
    if (!alive && !this.keywordsOf(defender).retribution) return;
    const amount = alive ? this.retaliationOf(defender) : pending.amount;
    if (amount > 0) this.retaliate(defender, amount, pending.attacker);
    this.applyLifeDrain(pending.attacker, pending.drained);
    const attacker = this.locate(pending.attacker)?.unit;
    if (attacker) this.applyReprisal(attacker, pending.reprisal);
    if (attacker && this.locate(attacker.uid)) this.afterAttack(attacker, pending.target, pending.first);
  }

  /** La créature se déplace vers une case adjacente autorisée ; cela remplace son attaque du tour. */
  moveUnit(pi: PlayerIndex, uid: number, to: SlotRef): void {
    this.assertNoError(this.whyNotUnitAct(pi, uid));
    if (!this.moveDestinations(pi, uid).some(s => sameSlot(s, to))) throw new GameRuleError('Choisissez une case adjacente libre et autorisée.');
    const p = this.players[pi];
    const found = this.locate(uid)!;
    p.board[found.row]![found.lane] = null;
    p.board[to.row]![to.lane] = found.unit;
    found.unit.moved = true;
    if (!this.keywordsOf(found.unit).swift) found.unit.acted = true;
    this.addLog(`${getCard(found.unit.cardId).name} se déplace.`, 'action', pi);
    if (to.lane !== found.lane) this.enterLane(found.unit, to.lane);
    this.settle();
  }

  /** Choisit parmi les cartes révélées ou les options proposées après la résolution d'une carte. */
  pick(pi: PlayerIndex, choice: Choice): void {
    const pending = this.pendingPickState;
    if (this.isOver) throw new GameRuleError('La partie est terminée.');
    if (!pending || pending.player !== pi) throw new GameRuleError('Aucun choix à faire.');
    if (!pending.options.some(o => sameChoice(o, choice))) throw new GameRuleError('Choix invalide.');
    this.pendingPickState = null;
    this.resolvePick(pi, pending.reason, choice);
    this.settle();
  }

  /**
   * Fin du tour : Rétablissement des créatures qui n'ont pas attaqué, cartes permanentes « jusqu'à la fin du tour »
   * retirées, Phalange impériale activée si aucune créature de mêlée n'a attaqué, rotation des événements, puis tour adverse.
   */
  endTurn(pi: PlayerIndex): void {
    this.assertNoError(this.turnError(pi));
    for (const { unit } of this.units(pi)) {
      if (unit.keywords.mending && !unit.attacked) this.healUnit(unit.uid, unit.hpMax - unit.hpCur);
    }
    for (const { unit } of this.units(pi)) {
      if (unit.doomed === 'destroy') this.destroyUnit(unit.uid);
      else if (unit.doomed === 'banish') this.banishUnit(unit.uid);
    }
    for (const q of [0, 1] as const) {
      this.units(q).forEach(x => {
        x.unit.tempAttack = 0;
        x.unit.tempKeywords = {};
      });
    }
    const chant = this.units(pi).reduce((sum, x) => sum + (x.unit.keywords.warchant ?? 0), 0);
    if (chant) this.units(pi).filter(x => this.keywordsOf(x.unit).enrage).forEach(x => this.addCounters(x.unit, 'enrage', chant));
    const meleeAttacked = this.units(pi).some(x => x.unit.attacked && x.unit.attackType === 'melee');
    for (const entry of this.lastingCards) {
      if (entry.owner === pi && rulesOf(entry).phalanx) entry.active = !meleeAttacked;
    }
    this.expireLasting(pi, 'endOfTurn');
    const p = this.players[pi];
    p.seesOpponentHand = false;
    p.recentDead = [];
    p.freeCard = null;
    this.rotateEvents();
    this.currentPlayer = other(pi);
    this.beginTurn();
  }

  /** Le joueur quitte la partie ; si elle est en cours, il abandonne. */
  leave(pi: PlayerIndex): void {
    const p = this.players[pi];
    if (p.left) return;
    p.left = true;
    if (!this.isOver) {
      this.addLog(`${this.heroName(pi)} abandonne.`, 'turn', null);
      this.finish(other(pi));
    }
  }

  // ==================================================================
  //  Primitives utilisées par les effets de cartes
  // ==================================================================
  /** Pioche ; chaque carte manquante dans la bibliothèque coûte 1 PV. */
  draw(pi: PlayerIndex, n: number, silent = false): void {
    const p = this.players[pi];
    if (!this.supplyPhase && n > 0 && this.drawLocked()) {
      this.addLog('Personne ne peut piocher en dehors de sa phase de ravitaillement.', 'info', pi);
      return;
    }
    for (let i = 0; i < n; i++) {
      const cardId = p.deck.pop();
      if (cardId === undefined) {
        this.addLog(`${this.heroName(pi)} n'a plus de cartes et perd 1 PV.`, 'damage', pi);
        this.damageHero(pi, 1);
        continue;
      }
      this.addToHand(pi, cardId, silent);
    }
  }

  /** Prend une carte de la bibliothèque, la met en main et mélange la bibliothèque. */
  tutor(pi: PlayerIndex, cardId: string): void {
    const p = this.players[pi];
    const index = p.deck.indexOf(cardId);
    if (index === -1) return;
    p.deck.splice(index, 1);
    this.addToHand(pi, cardId);
    this.rng.shuffle(p.deck);
    this.addLog(`${this.heroName(pi)} cherche ${getCard(cardId).name} dans sa bibliothèque.`, 'info', pi);
  }

  /** Reprend en main une carte du cimetière. */
  returnFromGrave(pi: PlayerIndex, cardId: string): void {
    const p = this.players[pi];
    const index = p.grave.lastIndexOf(cardId);
    if (index === -1) return;
    p.grave.splice(index, 1);
    this.addToHand(pi, cardId);
    this.addLog(`${this.heroName(pi)} reprend ${getCard(cardId).name} de son cimetière.`, 'info', pi);
  }

  discard(pi: PlayerIndex, cardIds: readonly string[]): void {
    if (cardIds.length) this.players[pi].discardedThisTurn = true;
    this.bury(pi, cardIds);
  }

  /** Défausse toute la main. */
  discardHand(pi: PlayerIndex): void {
    const p = this.players[pi];
    const hand = p.hand;
    p.hand = [];
    this.discard(pi, hand);
  }

  /** Défausse une carte au hasard. */
  discardRandom(pi: PlayerIndex): void {
    const p = this.players[pi];
    if (!p.hand.length) return;
    const [cardId] = p.hand.splice(Math.floor(this.rng.next() * p.hand.length), 1);
    this.discard(pi, [cardId!]);
    this.addLog(`${this.heroName(pi)} défausse ${getCard(cardId!).name}.`, 'info', pi);
  }

  /** Défausse des cartes au hasard jusqu'à n'en garder que `max` ; retourne le nombre de cartes défaussées. */
  discardRandomDownTo(pi: PlayerIndex, max: number): number {
    const p = this.players[pi];
    let discarded = 0;
    while (p.hand.length > max) {
      const [cardId] = p.hand.splice(Math.floor(this.rng.next() * p.hand.length), 1);
      this.discard(pi, [cardId!]);
      discarded++;
    }
    return discarded;
  }

  /** Bannit une carte du cimetière : elle quitte la partie. */
  banishFromGrave(pi: PlayerIndex, cardId: string): void {
    const p = this.players[pi];
    const index = p.grave.lastIndexOf(cardId);
    if (index === -1) return;
    p.grave.splice(index, 1);
    this.addLog(`${getCard(cardId).name} est banni du cimetière.`, 'info', pi);
  }

  /** Place des cartes au-dessus de la bibliothèque (la dernière sera piochée la première). */
  putOnLibrary(pi: PlayerIndex, cardIds: readonly string[]): void {
    this.players[pi].deck.push(...cardIds);
  }

  gainResources(pi: PlayerIndex, n: number): void {
    if (this.resourcesLocked()) return;
    this.players[pi].res += n;
    this.addLog(`${this.heroName(pi)} gagne ${n} ressources.`, 'info', pi);
  }

  /** Change la production du joueur (entre 0 et le maximum). */
  changeProduction(pi: PlayerIndex, delta: number): void {
    const p = this.players[pi];
    p.maxRes = Math.max(0, Math.min(MAX_RESOURCES, p.maxRes + delta));
    this.addLog(`Production de ${this.heroName(pi)} : ${p.maxRes}.`, 'info', pi);
  }

  boostMeleeDeployments(pi: PlayerIndex, n: number): void {
    this.players[pi].meleeDeployBonus += n;
  }

  /** La prochaine créature déployée ce tour-ci reçoit ces bonus (cumulables). */
  boostNextDeployment(pi: PlayerIndex, bonus: Partial<DeployBonus>): void {
    const next = this.players[pi].nextDeployBonus;
    next.atk += bonus.atk ?? 0;
    next.ret += bonus.ret ?? 0;
    next.hp += bonus.hp ?? 0;
  }

  increaseStat(pi: PlayerIndex, stat: StatKey, n: number): void {
    const p = this.players[pi];
    p[stat] += n;
    this.addLog(`${this.heroName(pi)} gagne +${n} en ${STAT_NAMES[stat]} (${p[stat]}).`, 'info', pi);
  }

  /** Baisse une caractéristique du héros (au minimum 0). */
  decreaseStat(pi: PlayerIndex, stat: StatKey, n: number): void {
    const p = this.players[pi];
    p[stat] = Math.max(0, p[stat] - n);
    this.addLog(`${this.heroName(pi)} perd ${n} en ${STAT_NAMES[stat]} (${p[stat]}).`, 'info', pi);
  }

  /** Le joueur prend toutes les ressources restantes de son adversaire. */
  stealResources(pi: PlayerIndex): void {
    const foe = this.players[other(pi)];
    const stolen = foe.res;
    foe.res = 0;
    if (!this.resourcesLocked()) this.players[pi].res += stolen;
    this.addLog(`${this.heroName(pi)} vole ${stolen} ressources.`, 'info', pi);
  }

  emptyResources(pi: PlayerIndex): void {
    this.players[pi].res = 0;
  }

  /** Toutes les créatures (piles comprises) et leurs enchantements retournent dans la main de leur propriétaire. */
  returnAllToHand(): void {
    for (const pi of [0, 1] as const) {
      for (const { unit, row, lane } of this.units(pi)) {
        this.players[pi].board[row]![lane] = null;
        for (let i = 0; i < unit.stack; i++) this.addToHand(pi, unit.cardId);
        for (const e of unit.enchantments) this.addToHand(e.owner, e.cardId);
      }
    }
    this.addLog('Toutes les cartes du champ de bataille retournent dans la main de leur propriétaire.', 'info', null);
  }

  /** Remet tous les événements dans la pioche, la mélange et en met deux nouveaux en jeu. */
  reshuffleEvents(): void {
    this.eventDeck = this.rng.shuffle([...this.eventDeck, ...this.eventDiscard, ...this.eventRow]);
    this.eventDiscard = [];
    this.eventRow = [];
    while (this.eventRow.length < EVENT_SLOTS) this.eventRow.push(this.drawEvent());
    this.eventsUsed = this.eventRow.map(() => false);
    this.addLog(`Nouveaux événements : ${this.eventRow.map(id => getEvent(id).name).join(', ')}.`, 'info', null);
  }

  /** Nombre de créatures de la main déployables avec ce budget (coût et conditions). */
  affordableCreatures(pi: PlayerIndex, budget: number): number {
    return this.players[pi].hand.filter(id => {
      const card = getCard(id);
      return card.type === 'creature' && this.cardCost(pi, card) <= budget && this.requirementError(pi, card.req) === null;
    }).length;
  }

  /** La créature de la main est jouable avec les ressources actuelles et est du type indiqué. */
  canAffordCreature(pi: PlayerIndex, cardId: string, attackType: AttackType): boolean {
    const card = getCard(cardId);
    return card.type === 'creature' && card.attackType === attackType && this.cardCost(pi, card) <= this.players[pi].res
      && this.requirementError(pi, card.req) === null;
  }

  /**
   * Inflige des dégâts à une créature ; retourne les dégâts réellement encaissés.
   * Intangible divise par deux les dégâts non magiques ; voir aussi inflict().
   */
  damageUnit(uid: number, n: number, source: DamageSource): number {
    return this.inflict(uid, n, source).dealt;
  }

  /**
   * Retire la créature du plateau : toute sa pile et ses enchantements rejoignent les cimetières.
   * Sa mort déclenche ensuite ses effets et ceux des autres créatures (voir deathTriggers).
   */
  destroyUnit(uid: number): void {
    const found = this.locate(uid);
    if (!found) return;
    const { unit } = found;
    this.players[found.owner].board[found.row]![found.lane] = null;
    const keeper = [...this.units(0), ...this.units(1)].some(x => x.unit.keywords.banishDead);
    if (keeper) {
      this.addLog(`${getCard(unit.cardId).name} est banni.`, 'damage', null);
    } else {
      this.deathsThisTurn += unit.stack;
      this.bury(found.owner, Array<string>(unit.stack).fill(unit.cardId));
      this.addLog(`${getCard(unit.cardId).name} est détruit.`, 'damage', null);
    }
    for (const e of unit.enchantments) this.bury(e.owner, [e.cardId]);
    this.onLeave(found);
    this.deathTriggers(found);
    this.settle();
  }

  damageHero(pi: PlayerIndex, n: number): void {
    if (n <= 0 || this.isOver) return;
    const p = this.players[pi];
    p.hp -= n;
    this.pendingEvents.push({ kind: 'damage', target: { kind: 'hero', player: pi }, amount: n });
    if (p.hp <= 0) {
      p.hp = 0;
      this.finish(other(pi));
    }
  }

  healUnit(uid: number, n: number): void {
    const unit = this.locate(uid)?.unit;
    if (!unit) return;
    const healed = Math.min(n, unit.hpMax - unit.hpCur);
    if (healed <= 0) return;
    unit.hpCur += healed;
    this.pendingEvents.push({ kind: 'heal', target: { kind: 'unit', uid }, amount: healed });
  }

  healHero(pi: PlayerIndex, n: number): void {
    const p = this.players[pi];
    const healed = Math.min(n, p.maxHp - p.hp);
    if (healed <= 0) return;
    p.hp += healed;
    this.pendingEvents.push({ kind: 'heal', target: { kind: 'hero', player: pi }, amount: healed });
  }

  /** Attache un sort permanent à la créature ; ses modifications s'appliquent tant qu'il reste attaché. */
  enchant(uid: number, cardId: string, caster: PlayerIndex, mods: { atk?: number; ret?: number; hp?: number; keywords?: Keywords }): void {
    const unit = this.locate(uid)?.unit;
    if (!unit || this.isShielded(unit)) {
      this.bury(caster, [cardId]);
      return;
    }
    const hp = mods.hp ?? 0;
    unit.enchantments.push({ cardId, owner: caster, atk: mods.atk ?? 0, ret: mods.ret ?? 0, hp, keywords: { ...mods.keywords } });
    unit.hpMax += hp;
    unit.hpCur += hp;
    this.pendingEvents.push({ kind: 'buff', target: { kind: 'unit', uid } });
  }

  /** Pose des marqueurs sur la créature, sauf si une carte permanente l'en protège (Pureté). */
  addCounters(unit: Unit, kind: 'poison' | 'cripple' | 'boost' | 'enrage', n: number): void {
    if (this.keywordsOf(unit).noCounters || this.isShielded(unit)) return;
    if (this.lastingCards.some(entry => rulesOf(entry).blocksCounters?.(this, unit, entry))) return;
    unit[kind] += n;
  }

  /** Retire tous les marqueurs de la créature ; retourne leur nombre. */
  clearCounters(uid: number): number {
    const unit = this.locate(uid)?.unit;
    if (!unit) return 0;
    const removed = unit.poison + unit.cripple + unit.boost + unit.enrage;
    unit.poison = 0;
    unit.cripple = 0;
    unit.boost = 0;
    unit.enrage = 0;
    return removed;
  }

  /** Détruit les sorts permanents attachés à la créature : ils rejoignent le cimetière de leur lanceur. */
  dispelUnit(uid: number): void {
    const unit = this.locate(uid)?.unit;
    if (!unit) return;
    const enchantments = unit.enchantments;
    unit.enchantments = [];
    for (const e of enchantments) this.removeEnchantmentEffects(unit, e);
    for (const e of enchantments) this.bury(e.owner, [e.cardId]);
  }

  /** Retire les PV accordés par un enchantement qui disparaît ; la créature meurt si elle n'en a plus. */
  private removeEnchantmentEffects(unit: Unit, e: Enchantment): void {
    if (!e.hp) return;
    unit.hpMax -= e.hp;
    unit.hpCur = Math.min(unit.hpCur, unit.hpMax);
    if (unit.hpCur <= 0) this.destroyUnit(unit.uid);
  }

  /** Détruit tous les sorts permanents : enchantements des créatures et sorts restés en jeu. */
  dispelAll(): void {
    for (const pi of [0, 1] as const) this.units(pi).forEach(x => this.dispelUnit(x.unit.uid));
    for (let i = this.lastingCards.length - 1; i >= 0; i--) {
      if (getCard(this.lastingCards[i]!.cardId).type === 'spell') this.destroyLasting(i);
    }
    this.addLog('Tous les sorts permanents sont détruits.', 'info', null);
  }

  /** Détruit une carte permanente en jeu : elle rejoint le cimetière de son propriétaire. */
  destroyLasting(index: number): void {
    const [entry] = this.lastingCards.splice(index, 1);
    if (!entry) return;
    this.bury(entry.owner, [entry.cardId]);
    this.addLog(`${getCard(entry.cardId).name} est détruit.`, 'info', entry.owner);
  }

  /** La créature ne peut pas attaquer jusqu'au prochain tour de ce joueur. */
  preventAttack(uid: number, until: PlayerIndex): void {
    const unit = this.locate(uid)?.unit;
    if (unit) unit.cannotAttackUntil = until;
  }

  /** Renvoie la créature (toute sa pile) dans la main de son propriétaire ; ses enchantements vont au cimetière. */
  returnToHand(uid: number): void {
    const found = this.locate(uid);
    if (!found) return;
    const { unit, owner } = found;
    this.players[owner].board[found.row]![found.lane] = null;
    for (const e of unit.enchantments) this.bury(e.owner, [e.cardId]);
    for (let i = 0; i < unit.stack; i++) this.addToHand(owner, unit.cardId);
    this.addLog(`${getCard(unit.cardId).name} retourne dans la main de ${this.heroName(owner)}.`, 'info', owner);
    this.onLeave(found);
    this.settle();
  }

  /** Déplace de force une créature vers une case de son camp (Déjouer). */
  relocate(uid: number, to: SlotRef): void {
    const found = this.locate(uid);
    if (!found || sameSlot(found, to) || this.keywordsOf(found.unit).anchored || this.isShielded(found.unit)) return;
    const board = this.players[found.owner].board;
    if (board[to.row]![to.lane]) return;
    board[found.row]![found.lane] = null;
    board[to.row]![to.lane] = found.unit;
    this.addLog(`${getCard(found.unit.cardId).name} est déplacé.`, 'info', found.owner);
    if (to.lane !== found.lane) this.enterLane(found.unit, to.lane);
    this.settle();
  }

  /** Échange la place de deux créatures du même camp. */
  swap(firstUid: number, secondUid: number): void {
    const a = this.locate(firstUid);
    const b = this.locate(secondUid);
    if (!a || !b || a.owner !== b.owner) return;
    const board = this.players[a.owner].board;
    board[a.row]![a.lane] = b.unit;
    board[b.row]![b.lane] = a.unit;
    this.addLog(`${getCard(a.unit.cardId).name} et ${getCard(b.unit.cardId).name} échangent leur place.`, 'info', a.owner);
    if (a.lane !== b.lane) {
      this.enterLane(a.unit, b.lane);
      this.enterLane(b.unit, a.lane);
    }
    this.settle();
  }

  /** Deux créatures du même camp peuvent échanger leur place : chacune est autorisée sur la ligne de l'autre. */
  canSwap(firstUid: number, secondUid: number): boolean {
    const a = this.locate(firstUid);
    const b = this.locate(secondUid);
    return !!a && !!b && a.unit !== b.unit && a.owner === b.owner
      && !this.keywordsOf(a.unit).anchored && !this.keywordsOf(b.unit).anchored
      && ALLOWED_ROWS[a.unit.attackType].includes(b.row) && ALLOWED_ROWS[b.unit.attackType].includes(a.row);
  }

  /** Le joueur voit la main adverse jusqu'à la fin de son tour. */
  revealOpponentHand(pi: PlayerIndex): void {
    this.players[pi].seesOpponentHand = true;
  }

  /**
   * Déploie gratuitement une créature déjà retirée de la main ou du cimetière : elle gagne Attaque rapide et sera
   * détruite (ou bannie) à la fin du tour.
   */
  deployForOneTurn(pi: PlayerIndex, cardId: string, slot: SlotRef, fate: 'destroy' | 'banish' = 'destroy'): void {
    const card = getCard(cardId);
    if (card.type !== 'creature' || this.players[pi].board[slot.row]![slot.lane]) return;
    const unit = this.deploy(pi, card, slot);
    unit.keywords = { ...unit.keywords, quickAttack: true };
    unit.doomed = fate;
    this.addLog(`${card.name} entre en jeu pour ce tour.`, 'info', pi);
  }

  /** Retire une carte du cimetière (pour la jouer ailleurs) ; retourne false si elle n'y est pas. */
  takeFromGrave(pi: PlayerIndex, cardId: string): boolean {
    const p = this.players[pi];
    const index = p.grave.lastIndexOf(cardId);
    if (index === -1) return false;
    p.grave.splice(index, 1);
    return true;
  }

  /** La créature gagne des capacités jusqu'à la fin du tour. */
  grantUntilEndOfTurn(uid: number, keywords: Keywords): void {
    const unit = this.locate(uid)?.unit;
    if (!unit) return;
    unit.tempKeywords = mergeKeywords(unit.tempKeywords, keywords);
    this.pendingEvents.push({ kind: 'buff', target: { kind: 'unit', uid } });
  }

  /** La créature ne peut pas être ciblée jusqu'au prochain tour de ce joueur. */
  shieldUntil(uid: number, until: PlayerIndex): void {
    const unit = this.locate(uid)?.unit;
    if (unit) unit.untargetableUntil = until;
  }

  /** Soigne toutes les blessures des créatures du joueur. */
  healAll(pi: PlayerIndex): void {
    this.units(pi).forEach(x => this.healUnit(x.unit.uid, x.unit.hpMax - x.unit.hpCur));
  }

  /** Une créature au hasard du cimetière (non unique si demandé) revient dans la main. */
  recallRandomCreature(pi: PlayerIndex, nonUniqueOnly: boolean): void {
    const ids = this.players[pi].grave.filter(id => {
      const card = getCard(id);
      return card.type === 'creature' && (!nonUniqueOnly || card.rarity !== 'unique');
    });
    if (ids.length) this.returnFromGrave(pi, ids[Math.floor(this.rng.next() * ids.length)]!);
  }

  /** Bannit la créature : elle quitte la partie, sans mourir ; ses enchantements vont au cimetière. */
  banishUnit(uid: number): void {
    const found = this.locate(uid);
    if (!found) return;
    this.players[found.owner].board[found.row]![found.lane] = null;
    for (const e of found.unit.enchantments) this.bury(e.owner, [e.cardId]);
    this.addLog(`${getCard(found.unit.cardId).name} est banni.`, 'info', null);
    this.onLeave(found);
    this.settle();
  }

  /** Une carte permanente en jeu retourne dans la main de son propriétaire. */
  returnLastingToHand(index: number): void {
    const [entry] = this.lastingCards.splice(index, 1);
    if (!entry) return;
    this.addToHand(entry.owner, entry.cardId);
    this.addLog(`${getCard(entry.cardId).name} retourne dans la main de ${this.heroName(entry.owner)}.`, 'info', entry.owner);
  }

  /** Met une carte de la bibliothèque au-dessus de celle-ci, après avoir mélangé le reste. */
  moveToLibraryTop(pi: PlayerIndex, cardId: string): void {
    const deck = this.players[pi].deck;
    const index = deck.indexOf(cardId);
    if (index === -1) return;
    deck.splice(index, 1);
    this.rng.shuffle(deck);
    deck.push(cardId);
  }

  /** Met une carte de la bibliothèque au cimetière, puis mélange la bibliothèque. */
  millCard(pi: PlayerIndex, cardId: string): void {
    const deck = this.players[pi].deck;
    const index = deck.indexOf(cardId);
    if (index === -1) return;
    deck.splice(index, 1);
    this.bury(pi, [cardId]);
    this.rng.shuffle(deck);
    this.addLog(`${getCard(cardId).name} va au cimetière.`, 'info', pi);
  }

  /** Bannit une carte de la bibliothèque, puis mélange la bibliothèque. */
  banishFromLibrary(pi: PlayerIndex, cardId: string): void {
    const deck = this.players[pi].deck;
    const index = deck.indexOf(cardId);
    if (index === -1) return;
    deck.splice(index, 1);
    this.rng.shuffle(deck);
  }

  /** Bannit toutes les cartes des deux cimetières. */
  banishGraves(): void {
    for (const p of this.players) p.grave = [];
    this.addLog('Les deux cimetières sont bannis.', 'info', null);
  }

  /** Met une carte du cimetière au-dessus de la bibliothèque. */
  graveToLibraryTop(pi: PlayerIndex, cardId: string): void {
    if (this.takeFromGrave(pi, cardId)) this.players[pi].deck.push(cardId);
  }

  /** Autel des souhaits : la carte du dessus est révélée ; si le joueur en remplit les conditions, elle va en main, gratuite ce tour-ci. */
  wishTopCard(pi: PlayerIndex): void {
    const p = this.players[pi];
    const cardId = p.deck.at(-1);
    if (cardId === undefined) return;
    const card = getCard(cardId);
    this.addLog(`Carte révélée : ${card.name}.`, 'info', pi);
    if (this.requirementError(pi, card.req) !== null) return;
    p.deck.pop();
    this.addToHand(pi, cardId);
    p.freeCard = cardId;
  }

  // ------------------------------------------------------------------
  //  Choix après résolution
  // ------------------------------------------------------------------
  /** La main adverse est révélée au joueur, qui y choisit une carte des types indiqués. */
  pickFromOpponentHand(pi: PlayerIndex, types: readonly Card['type'][], sameName: boolean, purge = false): void {
    const ids = this.players[other(pi)].hand.filter(id => types.includes(getCard(id).type));
    this.offerCards(pi, { kind: 'discardFromHand', sameName, purge }, 'Choisissez la carte que l\'adversaire défausse.', ids);
  }

  /** La bibliothèque adverse est révélée au joueur, qui y choisit une carte des types indiqués à mettre au cimetière. */
  pickFromOpponentLibrary(pi: PlayerIndex, types: readonly Card['type'][]): void {
    const ids = this.players[other(pi)].deck.filter(id => types.includes(getCard(id).type));
    if (!ids.length) this.rng.shuffle(this.players[other(pi)].deck);
    this.offerCards(pi, { kind: 'millLibrary' }, 'Choisissez la carte de la bibliothèque adverse à mettre au cimetière.', ids);
  }

  /** Le joueur regarde les N cartes du dessus de sa bibliothèque et en garde une. */
  pickFromTop(pi: PlayerIndex, n: number): void {
    const cards = this.players[pi].deck.slice(-n).reverse();
    this.offerCards(pi, { kind: 'keepFromTop', cards }, 'Choisissez la carte à prendre en main ; les autres vont sous la bibliothèque.', cards);
  }

  /** Le joueur remet les N cartes du dessus de sa bibliothèque dans l'ordre de son choix. */
  reorderTop(pi: PlayerIndex, n: number): void {
    const cards = this.players[pi].deck.slice(-n).reverse();
    this.offerCards(pi, { kind: 'reorderTop', remaining: cards, placed: [] }, 'Choisissez la carte à placer tout en dessous de ces cartes.', cards);
  }

  /** Le joueur consulte la bibliothèque adverse. */
  browseOpponentLibrary(pi: PlayerIndex): void {
    this.offerCards(pi, { kind: 'browse' }, 'Bibliothèque adverse (choisissez une carte pour fermer).', this.players[other(pi)].deck);
  }

  /** Chant des perdus : déplacer des créatures ennemies, autant de fois que voulu. */
  startSong(pi: PlayerIndex): void {
    const targets = RELOCATE_TARGET.options(this, pi, { handIndex: null });
    if (!targets.length) return;
    this.pendingPickState = {
      player: pi, reason: { kind: 'songTarget' }, prompt: 'Choisissez une créature ennemie à déplacer, ou terminez.',
      options: [{ kind: 'mode', index: 0 }, ...targets], labels: ['Terminer'], revealed: [],
    };
  }

  private offerCards(pi: PlayerIndex, reason: PickReason, prompt: string, ids: readonly string[]): void {
    const unique = [...new Set(ids)];
    if (!unique.length) return;
    this.pendingPickState = {
      player: pi, reason, prompt, labels: null, revealed: unique,
      options: unique.map((cardId): Choice => ({ kind: 'card', zone: 'revealed', cardId })),
    };
  }

  /** Briseur de sorts : s'il y a des sorts permanents, son joueur en choisit un à détruire. */
  private offerSmash(pi: PlayerIndex): void {
    const lasting = this.lastingCards.flatMap((e, index): Choice[] => (getCard(e.cardId).type === 'spell' ? [{ kind: 'lasting', index }] : []));
    const enchanted = [...this.units(0), ...this.units(1)].filter(x => x.unit.enchantments.length).map((x): Choice => ({ kind: 'unit', uid: x.unit.uid }));
    const options = [...lasting, ...enchanted];
    if (!options.length) return;
    this.pendingPickState = {
      player: pi, reason: { kind: 'smash' }, labels: null, revealed: [], options,
      prompt: 'Choisissez le sort permanent à détruire (une carte en jeu, ou une créature pour son dernier enchantement).',
    };
  }

  private resolvePick(pi: PlayerIndex, reason: PickReason, choice: Choice): void {
    const cardId = choice.kind === 'card' ? choice.cardId : null;
    const foe = other(pi);
    switch (reason.kind) {
      case 'discardFromHand': {
        if (!cardId) return;
        const hand = this.players[foe].hand;
        const removed = reason.sameName ? hand.filter(id => id === cardId) : [cardId];
        removed.forEach(id => hand.splice(hand.indexOf(id), 1));
        this.discard(foe, removed);
        this.addLog(`${this.heroName(foe)} défausse ${getCard(cardId).name}.`, 'info', foe);
        if (reason.purge) this.purgeFromBattlefield(cardId);
        return;
      }
      case 'millLibrary':
        if (cardId) this.millCard(foe, cardId);
        return;
      case 'keepFromTop': {
        if (!cardId) return;
        const deck = this.players[pi].deck;
        reason.cards.forEach(() => deck.pop());
        const rest = [...reason.cards];
        rest.splice(rest.indexOf(cardId), 1);
        deck.unshift(...rest);
        this.addToHand(pi, cardId);
        return;
      }
      case 'reorderTop': {
        if (!cardId) return;
        const remaining = [...reason.remaining];
        remaining.splice(remaining.indexOf(cardId), 1);
        const placed = [...reason.placed, cardId];
        if (remaining.length) {
          const unique = [...new Set(remaining)];
          this.pendingPickState = {
            player: pi, reason: { kind: 'reorderTop', remaining, placed }, labels: null, revealed: unique,
            prompt: 'Choisissez la carte suivante (de bas en haut).',
            options: unique.map((id): Choice => ({ kind: 'card', zone: 'revealed', cardId: id })),
          };
          return;
        }
        const deck = this.players[pi].deck;
        placed.forEach(() => deck.pop());
        deck.push(...placed);
        return;
      }
      case 'browse':
        return;
      case 'smash':
        if (choice.kind === 'lasting') this.destroyLasting(choice.index);
        if (choice.kind === 'unit') {
          const unit = this.locate(choice.uid)?.unit;
          const last = unit?.enchantments.pop();
          if (unit && last) {
            this.removeEnchantmentEffects(unit, last);
            this.bury(last.owner, [last.cardId]);
          }
        }
        return;
      case 'songTarget':
        if (choice.kind !== 'unit') return;
        this.pendingPickState = {
          player: pi, reason: { kind: 'songDestination', uid: choice.uid }, labels: null, revealed: [],
          prompt: 'Choisissez sa nouvelle case.', options: this.relocationCells(choice.uid),
        };
        return;
      case 'songDestination':
        if (choice.kind === 'cell') this.relocate(reason.uid, choice);
        this.startSong(pi);
        return;
    }
  }

  /** Faille du Néant : détruit toutes les cartes en jeu de ce nom (créatures, enchantements, cartes permanentes). */
  private purgeFromBattlefield(cardId: string): void {
    for (const q of [0, 1] as const) {
      for (const { unit } of this.units(q)) {
        if (unit.cardId === cardId) {
          this.destroyUnit(unit.uid);
          continue;
        }
        const kept = unit.enchantments.filter(e => e.cardId !== cardId);
        unit.enchantments.filter(e => e.cardId === cardId).forEach(e => {
          this.removeEnchantmentEffects(unit, e);
          this.bury(e.owner, [e.cardId]);
        });
        unit.enchantments = kept;
      }
    }
    for (let i = this.lastingCards.length - 1; i >= 0; i--) if (this.lastingCards[i]!.cardId === cardId) this.destroyLasting(i);
  }

  /** La créature gagne un bonus d'attaque jusqu'à la fin du tour. */
  boostUntilEndOfTurn(uid: number, n: number): void {
    const unit = this.locate(uid)?.unit;
    if (!unit) return;
    unit.tempAttack += n;
    this.pendingEvents.push({ kind: 'buff', target: { kind: 'unit', uid } });
  }

  deployFromGrave(pi: PlayerIndex, cardId: string, slot: SlotRef): void {
    const p = this.players[pi];
    const index = p.grave.lastIndexOf(cardId);
    const card = getCard(cardId);
    if (index === -1 || card.type !== 'creature' || p.board[slot.row]![slot.lane]) return;
    p.grave.splice(index, 1);
    this.deploy(pi, card, slot);
    this.addLog(`${card.name} revient du cimetière.`, 'info', pi);
  }

  // ==================================================================
  //  Déroulement interne
  // ==================================================================
  private createPlayer(setup: PlayerSetup): PlayerState {
    const { faction, hero, cards } = DECKS[setup.deck];
    const deck = Object.entries(cards).flatMap(([id, count]) => Array<string>(count).fill(id));
    return {
      id: setup.id, isAi: setup.isAi, deckId: setup.deck, faction, accountId: setup.accountId, name: setup.name,
      hp: hero.hp, maxHp: hero.hp, m: hero.m, g: hero.g, d: hero.d, res: 0, maxRes: 0,
      deck: this.rng.shuffle(deck), hand: [], grave: [],
      board: Array.from({ length: ROWS }, () => Array<Unit | null>(LANES).fill(null)),
      heroActionUsed: false, meleeDeployBonus: 0, nextDeployBonus: { ...NO_DEPLOY_BONUS },
      seesOpponentHand: false, blackmailUsed: false, discardedThisTurn: false, deployedThisTurn: 0, cardsPlayedThisTurn: 0,
      recentDead: [], freeCard: null, left: false,
    };
  }

  private start(): this {
    const first: PlayerIndex = this.rng.next() < 0.5 ? 0 : 1;
    this.currentPlayer = first;
    this.supplyPhase = true;
    this.draw(first, STARTING_HAND, true);
    this.draw(other(first), STARTING_HAND, true);
    this.supplyPhase = false;
    this.dealEvents();
    this.addLog(`${this.heroName(first)} commence la partie.`, 'turn', null);
    this.beginTurn();
    return this;
  }

  /**
   * Phase de ravitaillement : fin des effets « jusqu'à votre prochain tour », +1 production, ressources rechargées
   * (réduites de moitié par Pillage), Combustion, poison, Régénération et Soin, pioche ; puis phase d'action.
   */
  private beginTurn(): void {
    const pi = this.currentPlayer;
    const p = this.players[pi];
    this.turnCount++;
    this.expireLasting(pi, 'nextTurn');
    for (const entry of this.lastingCards) if (entry.owner === pi) entry.active = false;
    for (const q of [0, 1] as const) {
      this.players[q].discardedThisTurn = false;
      for (const { unit } of this.units(q)) {
        if (unit.cannotAttackUntil === pi) unit.cannotAttackUntil = null;
        if (unit.immobileUntil === pi) unit.immobileUntil = null;
        if (unit.untargetableUntil === pi) unit.untargetableUntil = null;
      }
    }
    p.maxRes = Math.min(MAX_RESOURCES, p.maxRes + 1);
    p.res = this.lastingCards.some(e => rulesOf(e).halvesSupply?.(this, pi, e)) ? Math.floor(p.maxRes / 2) : p.maxRes;
    p.heroActionUsed = false;
    p.meleeDeployBonus = 0;
    p.nextDeployBonus = { ...NO_DEPLOY_BONUS };
    p.blackmailUsed = false;
    p.deployedThisTurn = 0;
    p.cardsPlayedThisTurn = 0;
    this.deathsThisTurn = 0;
    this.eventsUsed = this.eventRow.map(() => false);
    this.addLog(`— Tour de ${this.heroName(pi)} —`, 'turn', null);
    const handLimit = [...this.units(0), ...this.units(1)].reduce((min, x) => Math.min(min, x.unit.keywords.handLimit ?? Infinity), Infinity);
    if (handLimit < Infinity) this.discardRandomDownTo(pi, handLimit);
    this.startOfTurnTriggers(pi);
    for (const q of [0, 1] as const) {
      for (const { unit } of this.units(q)) {
        const burning = this.keywordsOf(unit).burning;
        if (burning) this.damageUnit(unit.uid, burning, FIRE);
      }
    }
    for (const { unit } of this.units(pi)) {
      unit.acted = false;
      unit.attacked = false;
      unit.moved = false;
      if (unit.poison > 0) {
        this.addLog(`${getCard(unit.cardId).name} subit le poison (${unit.poison}).`, 'damage', pi);
        this.damageUnit(unit.uid, unit.poison, POISON);
      }
    }
    for (const { unit } of this.units(pi)) {
      if (unit.keywords.regen) this.healUnit(unit.uid, unit.keywords.regen);
    }
    for (const { unit } of this.units(pi)) {
      const heal = unit.keywords.heal;
      if (heal) this.adjacentUnits(unit.uid).forEach(u => this.healUnit(u.uid, heal));
    }
    for (const { unit } of this.units(pi)) {
      const strike = unit.keywords.supplyStrike;
      if (!strike) continue;
      this.addLog(`${getCard(unit.cardId).name} frappe ${this.heroName(other(pi))} (${strike}).`, 'damage', pi);
      this.damageHero(other(pi), strike);
    }
    const extraDraws = this.units(pi).reduce((sum, x) => sum + (x.unit.keywords.supplyDraw ?? 0), 0);
    this.supplyPhase = true;
    this.draw(pi, 1 + extraDraws);
    this.supplyPhase = false;
    if (this.isOver) return;
    this.currentPhase = 'action';
    this.berserkAttacks(pi);
  }

  /**
   * Début du tour du joueur : soins de son héros (Prêtre de bataille), Chaînes maudites, Mort silencieuse,
   * Lumière de demain.
   */
  private startOfTurnTriggers(pi: PlayerIndex): void {
    for (const { unit } of this.units(pi)) {
      const k = this.keywordsOf(unit);
      if (k.heroRegen) this.healHero(pi, k.heroRegen);
      if (k.chains) this.damageHero(pi, k.chains);
    }
    for (const q of [0, 1] as const) {
      for (const { unit } of this.units(q)) {
        const doom = unit.enchantments.find(e => e.owner === pi && cardKillsAndReturns(e.cardId));
        if (!doom) continue;
        unit.enchantments.splice(unit.enchantments.indexOf(doom), 1);
        this.addToHand(pi, doom.cardId);
        this.destroyUnit(unit.uid);
      }
    }
    for (const entry of this.lastingCards) if (entry.owner === pi && rulesOf(entry).recallEachTurn) this.recallRandomCreature(pi, true);
  }

  /** Berserk : au début de la phase d'action, chaque créature concernée attaque d'office la première cible à sa portée. */
  private berserkAttacks(pi: PlayerIndex): void {
    for (const { unit } of this.units(pi)) {
      if (!this.locate(unit.uid) || !this.keywordsOf(unit).berserk || this.whyNotAttack(pi, unit.uid)) continue;
      const target = this.attackTargets(pi, unit.uid)[0];
      if (!target) continue;
      this.addLog(`${getCard(unit.cardId).name} attaque, pris de folie.`, 'action', pi);
      this.attack(pi, unit.uid, target);
      while (this.pendingRetaliation) this.resolveRetaliation();
      if (this.isOver || this.pendingPickState) return;
    }
  }

  /** Les événements des deux joueurs sont mélangés ensemble et les deux premiers sont mis en jeu. */
  private dealEvents(): void {
    const all = this.players.flatMap(p => DECKS[p.deckId].events);
    this.eventDeck = this.rng.shuffle([...all]);
    while (this.eventRow.length < EVENT_SLOTS) this.eventRow.push(this.drawEvent());
  }

  /** Pioche un événement ; la pioche vide est reconstituée en remélangeant les événements sortis. */
  private drawEvent(): string {
    if (!this.eventDeck.length) {
      this.eventDeck = this.rng.shuffle(this.eventDiscard);
      this.eventDiscard = [];
    }
    const id = this.eventDeck.pop();
    if (id === undefined) throw new Error('Aucun événement à piocher.');
    return id;
  }

  /** Fin de tour : l'événement de gauche sort du jeu, celui de droite prend sa place et un nouveau arrive à droite. */
  private rotateEvents(): void {
    const leaving = this.eventRow.shift();
    if (leaving === undefined) return;
    this.eventDiscard.push(leaving);
    const arriving = this.drawEvent();
    this.eventRow.push(arriving);
    this.addLog(`Nouvel événement : ${getEvent(arriving).name}.`, 'info', null);
  }

  private activeEventAt(slot: number): ActiveEvent | null {
    const id = this.eventRow[slot];
    if (id === undefined) return null;
    const event = getEvent(id);
    return event.kind === 'active' ? event : null;
  }

  private finish(winner: PlayerIndex): void {
    this.winnerIndex = winner;
    this.currentPhase = 'over';
    this.pendingPlay = null;
    this.pendingRetaliation = null;
    this.addLog(`${this.heroName(winner)} remporte le duel !`, 'turn', null);
  }

  private applyEffect(effect: Effect, pi: PlayerIndex, choices: readonly Choice[], taken: readonly string[]): void {
    effect.apply(this, pi, { choices, taken });
  }

  /** Déploiement : la case, puis pour Déjouer, la créature ennemie à déplacer et sa nouvelle case (s'il y a des ennemis). */
  private deploySteps(pi: PlayerIndex, card: CreatureCard): Step[] {
    const deploy = this.deployStep(card);
    if (card.keywords.bloodPact) return [deploy, BLOOD_PACT_FIRST, BLOOD_PACT_SECOND];
    const arrival = card.arrival?.steps ?? [];
    if (arrival.length && arrival.every(s => s.options(this, pi, { handIndex: null }).length)) return [deploy, ...arrival];
    return card.keywords.outmanoeuvre && this.units(other(pi)).length ? [deploy, RELOCATE_TARGET, RELOCATE_DESTINATION] : [deploy];
  }

  private deployStep(card: CreatureCard): Step {
    return {
      prompt: card.keywords.stackable
        ? `Choisissez un emplacement libre ou une pile de ${card.name}.`
        : 'Choisissez un emplacement libre.',
      options: (game, pi) => game.deploySlots(pi, card).map((s): Choice => ({ kind: 'slot', ...s })),
      emptyReason: card.attackType === 'melee' ? 'Aucun emplacement libre sur la ligne avant.'
        : card.attackType === 'shooter' ? 'Aucun emplacement libre sur la ligne arrière.'
        : 'Aucun emplacement libre.',
    };
  }

  /** Pose la créature, ou l'ajoute à la pile de la même créature déjà présente sur la case. */
  private deploy(pi: PlayerIndex, card: CreatureCard, slot: SlotRef): Unit {
    const p = this.players[pi];
    const next = p.nextDeployBonus;
    p.nextDeployBonus = { ...NO_DEPLOY_BONUS };
    const bonus = (card.attackType === 'melee' ? p.meleeDeployBonus : 0) + next.hp;
    const existing = p.board[slot.row]![slot.lane];
    if (existing) {
      existing.stack++;
      existing.atk += card.atk + next.atk;
      existing.ret += card.ret + next.ret;
      existing.hpMax += card.hp + bonus;
      existing.hpCur += card.hp + bonus;
      this.pendingEvents.push({ kind: 'buff', target: { kind: 'unit', uid: existing.uid } });
      this.addLog(`La pile de ${card.name} passe à ${existing.stack}.`, 'info', pi);
      return existing;
    }
    const unit = this.makeUnit(card, pi);
    unit.atk += next.atk;
    unit.ret += next.ret;
    unit.hpMax += bonus;
    unit.hpCur += bonus;
    p.board[slot.row]![slot.lane] = unit;
    this.enterLane(unit, slot.lane);
    return unit;
  }

  /** Créatures touchées en plus de la cible : Charge (même couloir) et Attaque en balayage (voisines de ligne). */
  private extraStrikes(attacker: Unit, targetUid: number): number[] {
    const found = this.locate(targetUid);
    if (!found) return [];
    const board = this.players[found.owner].board;
    const extra: (Unit | null | undefined)[] = [];
    if (attacker.keywords.charge) extra.push(board[1 - found.row]![found.lane]);
    if (attacker.keywords.sweep) extra.push(board[found.row]![found.lane - 1], board[found.row]![found.lane + 1]);
    return extra.filter((u): u is Unit => !!u).map(u => u.uid);
  }

  /**
   * Dégâts de combat (attaque ou riposte) : les gardes de la cible et de ses voisines les réduisent.
   * Une créature qui tue au contact détruit la cible blessée.
   */
  private strike(from: Unit, amount: number, toUid: number, perfect = false): DamageResult {
    const found = this.locate(toUid);
    if (!found || (!perfect && this.isSheltered(found))) return NO_DAMAGE;
    const key = from.attackType === 'melee' ? 'meleeGuard' : from.attackType === 'shooter' ? 'rangedGuard' : 'flyerGuard';
    const guard = perfect ? 0 : this.units(found.owner)
      .filter(x => x.unit === found.unit || adjacent(x, found))
      .reduce((sum, x) => sum + (x.unit.keywords[key] ?? 0), 0);
    const armor = perfect ? 0 : this.keywordsOf(found.unit).armor ?? 0;
    const source = perfect ? { ...this.unitSource(from), unpreventable: true } : this.unitSource(from);
    const result = this.inflict(toUid, Math.max(0, amount - guard - armor), source);
    if (result.dealt > 0 && from.keywords.deathTouch && this.locate(toUid)) this.destroyUnit(toUid);
    return result;
  }

  private retaliate(defender: Unit, amount: number, attackerUid: number): void {
    this.pendingEvents.push({ kind: 'retaliate', attacker: defender.uid, target: { kind: 'unit', uid: attackerUid } });
    this.addLog(`${getCard(defender.cardId).name} riposte (${amount}).`, 'action', defender.owner);
    this.strike(defender, amount, attackerUid, !!this.keywordsOf(defender).perfectRetaliation);
  }

  /**
   * Inflige des dégâts à une créature. Intangible divise par deux les dégâts non magiques,
   * Protection contre les ténèbres ignore ceux des Ténèbres, Soin par le feu change ceux du feu en soin.
   */
  private inflict(uid: number, n: number, source: DamageSource): DamageResult {
    const unit = this.locate(uid)?.unit;
    if (!unit || unit.hpCur <= 0) return NO_DAMAGE;
    const k = this.keywordsOf(unit);
    const found = this.locate(uid)!;
    const school = source.school;
    let halvings = 0;
    if (!source.unpreventable) {
      if (this.isShielded(unit) || (school === 'Ténèbres' && k.darkWard) || (source.magic && k.magicShield)) return NO_DAMAGE;
      const shell = unit.enchantments.findIndex(e => e.keywords.shell);
      if (shell !== -1) {
        const [broken] = unit.enchantments.splice(shell, 1);
        this.bury(broken!.owner, [broken!.cardId]);
        this.addLog(`${getCard(broken!.cardId).name} absorbe les dégâts et se brise.`, 'info', unit.owner);
        return NO_DAMAGE;
      }
      halvings = [
        k.incorporeal && !source.magic,
        k.magicResist && source.magic,
        k.spellResist && source.spell,
        !!source.spell && !!school && this.lastingCards.some(e => rulesOf(e).halvesSpellDamage?.(school)),
        found.row === 0 && this.lastingCards.some(e => rulesOf(e).halvesFrontDamage && e.owner === unit.owner),
      ].filter(Boolean).length;
    }
    const amount = Math.floor(n / 2 ** halvings);
    if (amount <= 0) return NO_DAMAGE;
    if ((school === 'Feu' && k.fireHeal) || (school === 'Terre' && k.earthHeal)) {
      this.healUnit(uid, amount);
      return NO_DAMAGE;
    }
    const dealt = Math.min(amount, unit.hpCur);
    unit.hpCur -= amount;
    this.pendingEvents.push({ kind: 'damage', target: { kind: 'unit', uid }, amount });
    if (unit.hpCur <= 0) this.destroyUnit(uid);
    return { dealt, excess: amount - dealt };
  }

  /** Dégâts infligés par une créature : magiques ou non, et de l'école de magie de sa carte. */
  private unitSource(unit: Unit): DamageSource {
    const school = schoolOf(unit);
    return school ? { magic: unit.magic, school } : { magic: unit.magic };
  }

  private unitKeywords(uid: number): Keywords {
    const unit = this.locate(uid)?.unit;
    return unit ? this.keywordsOf(unit) : {};
  }

  /** Bonus d'attaque ou de riposte : estropiement, enchantements, meute, Honneur des voisines, ennemis (Yéti) et cartes permanentes. */
  private statBonus(unit: Unit, stat: 'atk' | 'ret'): number {
    const enchantments = unit.enchantments.reduce((sum, e) => sum + e[stat], 0);
    const honor = this.adjacentUnits(unit.uid).reduce((sum, u) => sum + (u.keywords.honor ?? 0), 0);
    const enemies = (unit.keywords.enemyBonus ?? 0) * this.units(other(unit.owner)).length;
    const spells = unit.keywords.spellBonus ? unit.keywords.spellBonus * this.ongoingSpellCount() : 0;
    const lasting = this.lastingCards.reduce((sum, entry) => {
      const rules = rulesOf(entry);
      return sum + ((stat === 'atk' ? rules.attackBonus : rules.retaliationBonus)?.(this, unit, entry) ?? 0);
    }, 0);
    const temporary = stat === 'atk' ? unit.tempAttack : 0;
    return enchantments - unit.cripple + unit.enrage + temporary + this.packBonus(unit) + honor + enemies + spells + lasting;
  }

  /** Sorts permanents en jeu : enchantements des créatures et sorts restés en jeu. */
  private ongoingSpellCount(): number {
    const enchantments = [...this.units(0), ...this.units(1)].reduce((sum, x) => sum + x.unit.enchantments.length, 0);
    return enchantments + this.lastingCards.filter(e => getCard(e.cardId).type === 'spell').length;
  }

  /** Effets des dégâts d'attaque sur une créature : Infection, Estropiement, Toucher glacé. */
  private onAttackDamage(pi: PlayerIndex, k: Keywords, hit: Unit): void {
    if (k.infect) this.addCounters(hit, 'poison', k.infect);
    if (k.crippling) this.addCounters(hit, 'cripple', k.crippling);
    if (k.frozenTouch) {
      hit.cannotAttackUntil = pi;
      hit.immobileUntil = pi;
    }
  }

  /** Bulbe vénéneux : une créature de mêlée ou volante de son couloir qui attaque est empoisonnée, et le bulbe détruit. */
  private poisonousBulbs(attacker: Unit): void {
    const found = this.locate(attacker.uid);
    if (!found || attacker.attackType === 'shooter') return;
    for (let i = this.lastingCards.length - 1; i >= 0; i--) {
      const entry = this.lastingCards[i]!;
      const poison = rulesOf(entry).poisonsAttackers;
      if (!poison || entry.lane !== found.lane) continue;
      this.addCounters(attacker, 'poison', poison);
      this.destroyLasting(i);
    }
  }

  /** Shinobi maître chanteur : la première fois du tour, la production du joueur augmente de 1. */
  private blackmail(pi: PlayerIndex): void {
    const p = this.players[pi];
    if (p.blackmailUsed) return;
    p.blackmailUsed = true;
    p.maxRes = Math.min(MAX_RESOURCES, p.maxRes + 1);
    this.addLog(`${this.heroName(pi)} augmente sa production (${p.maxRes}).`, 'info', pi);
  }

  /** Retire les cartes permanentes du joueur dont la durée se termine maintenant. */
  private expireLasting(pi: PlayerIndex, duration: LastingRules['duration']): void {
    for (let i = this.lastingCards.length - 1; i >= 0; i--) {
      const entry = this.lastingCards[i]!;
      if (entry.owner === pi && rulesOf(entry).duration === duration) this.destroyLasting(i);
    }
  }

  /**
   * Après un changement sur le plateau : détruit les créatures qui exigent un allié adjacent et n'en ont plus,
   * puis les cartes permanentes qui exigent des créatures alliées quand leur propriétaire n'en a plus.
   */
  private settle(): void {
    for (const pi of [0, 1] as const) {
      const lonely = this.units(pi).find(x => x.unit.keywords.needsCompany && !this.adjacentUnits(x.unit.uid).length);
      if (lonely) {
        this.destroyUnit(lonely.unit.uid);
        return;
      }
    }
    this.checkLasting();
  }

  /** Détruit les cartes permanentes qui exigent des créatures alliées quand leur propriétaire n'en a plus. */
  private checkLasting(): void {
    for (let i = this.lastingCards.length - 1; i >= 0; i--) {
      const entry = this.lastingCards[i]!;
      if (rulesOf(entry).needsCreatures && !this.units(entry.owner).length) this.destroyLasting(i);
    }
  }

  /** Appeleur de sang : détruit les deux créatures alliées choisies, puis arrive avec leurs PV restants cumulés en attaque et riposte. */
  private bloodPact(pi: PlayerIndex, card: CreatureCard, choices: readonly Choice[]): void {
    const [slot, ...sacrificed] = choices;
    const victims = sacrificed.flatMap(c => (c.kind === 'unit' ? [this.locate(c.uid)?.unit] : [])).filter((u): u is Unit => !!u);
    const power = victims.reduce((sum, u) => sum + u.hpCur, 0);
    victims.forEach(u => this.destroyUnit(u.uid));
    if (slot?.kind !== 'slot') return;
    const unit = this.deploy(pi, card, slot);
    unit.atk = power;
    unit.ret = power;
  }

  /** Bonus de meute : +N en attaque et en riposte par créature alliée adjacente. */
  private packBonus(unit: Unit): number {
    return unit.keywords.packBonus ? unit.keywords.packBonus * this.adjacentUnits(unit.uid).length : 0;
  }

  /**
   * Effets de la mort d'une créature : malédiction si elle meurt pendant le tour adverse,
   * pioche pour elle et chaque créature alliée qui en a la capacité, puis Explosion de feu sur son couloir (des deux côtés).
   */
  private deathTriggers(dead: PlacedUnit): void {
    const { unit, owner } = dead;
    const k = unit.keywords;
    if (k.deathCurse && this.currentPlayer !== owner) this.damageHero(other(owner), k.deathCurse);
    if (k.deathDiscard && this.currentPlayer === owner) this.discardRandom(other(owner));
    for (const { unit: foe } of this.units(other(owner))) {
      const thirst = this.keywordsOf(foe).bloodthirst;
      if (thirst) this.addCounters(foe, 'enrage', thirst);
    }
    for (const { unit: any } of [...this.units(0), ...this.units(1)]) {
      if (any.keywords.soulFeed) this.healUnit(any.uid, any.keywords.soulFeed);
    }
    for (const entry of this.lastingCards) {
      if (entry.owner === owner && rulesOf(entry).mightOnDeath) this.increaseStat(owner, 'm', 1);
    }
    for (const { unit: friend } of this.units(owner)) {
      const enrage = this.keywordsOf(friend).enrage;
      if (enrage) this.addCounters(friend, 'enrage', enrage);
    }
    if (this.keywordsOf(unit).enrage) {
      for (let i = this.lastingCards.length - 1; i >= 0; i--) {
        const entry = this.lastingCards[i]!;
        if (entry.owner === owner && rulesOf(entry).fragileToEnragedDeath) this.destroyLasting(i);
      }
    }
    const draws = this.units(owner).filter(x => x.unit.keywords.deathDraw).length + (k.deathDraw ? 1 : 0);
    if (draws > 0) this.draw(owner, draws);
    const burst = k.fireBurst;
    if (!burst) return;
    this.addLog(`${getCard(unit.cardId).name} explose (${burst}).`, 'damage', owner);
    const source = this.unitSource(unit);
    [...this.units(owner), ...this.units(other(owner))]
      .filter(x => x.lane === dead.lane)
      .forEach(x => this.damageUnit(x.unit.uid, burst, source));
  }

  /** Met des cartes au cimetière de leur propriétaire ; celles qui se recyclent sont remélangées dans sa bibliothèque. */
  private bury(pi: PlayerIndex, cardIds: readonly string[]): void {
    const p = this.players[pi];
    for (const cardId of cardIds) {
      const card = getCard(cardId);
      if (card.type !== 'creature' || !card.keywords.recycle) {
        p.grave.push(cardId);
        if (card.type === 'creature') p.recentDead.push(cardId);
        continue;
      }
      p.deck.push(cardId);
      this.rng.shuffle(p.deck);
      this.addLog(`${card.name} retourne dans la bibliothèque.`, 'info', pi);
    }
  }

  private applyLifeDrain(uid: number, drained: boolean): void {
    const unit = this.locate(uid)?.unit;
    const lifeDrain = unit ? this.keywordsOf(unit).lifeDrain : undefined;
    if (drained && lifeDrain) this.healUnit(uid, lifeDrain);
  }

  /** Chaque Diablotin du chaos adverse fait défausser une carte au hasard au joueur qui vient de jouer. */
  private imposeDiscards(pi: PlayerIndex): void {
    const p = this.players[pi];
    for (const { unit } of this.units(other(pi))) {
      if (!unit.keywords.imposeDiscard || !p.hand.length) continue;
      const [cardId] = p.hand.splice(Math.floor(this.rng.next() * p.hand.length), 1);
      this.bury(pi, [cardId!]);
      this.addLog(`${getCard(unit.cardId).name} fait défausser ${getCard(cardId!).name}.`, 'info', pi);
    }
  }

  private addToHand(pi: PlayerIndex, cardId: string, silent = false): void {
    const p = this.players[pi];
    if (p.hand.length >= MAX_HAND) {
      if (!silent) this.addLog(`Main pleine : ${getCard(cardId).name} est défaussée.`, 'info', pi);
      this.bury(pi, [cardId]);
      return;
    }
    p.hand.push(cardId);
  }

  /** Retire de la main les cartes aux positions données ; retourne leurs identifiants dans le même ordre. */
  private takeFromHand(pi: PlayerIndex, indices: readonly number[]): string[] {
    const hand = this.players[pi].hand;
    const taken = indices.map(i => hand[i]!);
    [...indices].sort((x, y) => y - x).forEach(i => hand.splice(i, 1));
    return taken;
  }

  /**
   * Options de chaque étape. Une étape qui dépend des précédentes (`after`) est calculée pour chaque suite de choix
   * possible ; ses options sont alors leur union.
   */
  private stepOptions(pi: PlayerIndex, steps: readonly Step[], ctx: StepContext): StepOptions[] {
    const result: StepOptions[] = [];
    let prefixes: Choice[][] = [[]];
    const dependent = steps.some(s => s.after);
    for (const step of steps) {
      const after = step.after ? prefixes.map(previous => ({ previous, options: step.after!(this, pi, previous) })) : null;
      const options = after ? uniqueChoices(after.flatMap(a => a.options)) : step.options(this, pi, ctx);
      result.push({ step, options, after });
      if (!dependent) continue;
      prefixes = prefixes.flatMap(prefix => {
        const choices = after?.find(a => a.previous === prefix)?.options ?? options;
        return choices
          .filter(c => step.distinctFrom === undefined || !sameChoice(c, prefix[step.distinctFrom]!))
          .map(c => [...prefix, c]);
      }).slice(0, MAX_PREFIXES);
    }
    return result;
  }

  private stepsError(steps: readonly StepOptions[]): string | null {
    for (const { step, options } of steps) {
      const needed = step.distinctFrom === undefined ? 1 : 2;
      if (options.length < needed) return step.emptyReason ?? 'Aucune cible valide.';
    }
    return null;
  }

  private validChoices(pi: PlayerIndex, steps: readonly StepOptions[], choices: readonly Choice[]): boolean {
    if (choices.length !== steps.length) return false;
    const hands = handIndices(choices);
    if (new Set(hands).size !== hands.length) return false;
    return steps.every(({ step, options }, i) => {
      const choice = choices[i]!;
      const legal = step.after ? step.after(this, pi, choices.slice(0, i)) : options;
      if (!legal.some(o => sameChoice(o, choice))) return false;
      return step.distinctFrom === undefined || !sameChoice(choice, choices[step.distinctFrom]!);
    });
  }

  private requirementError(pi: PlayerIndex, req: Partial<Record<StatKey, number>>): string | null {
    for (const [k, v] of Object.entries(req) as [StatKey, number][]) {
      if (this.statOf(pi, k) < v) return `Il faut ${STAT_NAMES[k]} ${v}.`;
    }
    return null;
  }

  private turnError(pi: PlayerIndex): string | null {
    if (this.isOver) return 'La partie est terminée.';
    if (this.currentPlayer !== pi) return 'Ce n\'est pas votre tour.';
    if (this.pendingPlay) return PENDING_ERRORS[this.pendingPlay.kind];
    if (this.pendingRetaliation) return 'Une riposte est en cours.';
    if (this.pendingPickState) return 'Faites d\'abord votre choix parmi les cartes proposées.';
    return null;
  }

  private assertNoError(error: string | null): void {
    if (error) throw new GameRuleError(error);
  }

  private makeUnit(card: CreatureCard, owner: PlayerIndex): Unit {
    return {
      uid: ++this.lastUid, cardId: card.id, owner, attackType: card.attackType, magic: card.magic,
      keywords: { ...card.keywords }, deployedTurn: this.turnCount,
      atk: card.atk, ret: card.ret, hpCur: card.hp, hpMax: card.hp,
      stack: 1, poison: 0, cripple: 0, boost: 0, enrage: 0, cannotAttackUntil: null, immobileUntil: null, tempAttack: 0,
      tempKeywords: {}, doomed: null, untargetableUntil: null, enchantments: [], acted: false, attacked: false, moved: false,
    };
  }

  private targetName(t: Target): string {
    if (t.kind === 'hero') return this.heroName(t.player);
    const found = this.locate(t.uid);
    return found ? getCard(found.unit.cardId).name : '?';
  }

  private addLog(text: string, tone: LogTone, player: PlayerIndex | null): void {
    this.logEntries.push({ text, tone, player });
    if (this.logEntries.length > LOG_LIMIT) this.logEntries.shift();
  }
}

const PENDING_ERRORS: Record<PendingPlay['kind'], string> = {
  card: 'Une carte est en cours de résolution.',
  power: 'Un pouvoir est en cours de résolution.',
  event: 'Un événement est en cours de résolution.',
};

const handIndices = (choices: readonly Choice[]): number[] =>
  choices.flatMap(c => (c.kind === 'hand' ? [c.index] : []));

/** Nombre maximal de suites de choix explorées pour les étapes dépendantes. */
const MAX_PREFIXES = 400;

const uniqueChoices = (choices: readonly Choice[]): Choice[] =>
  choices.filter((c, i) => choices.findIndex(o => sameChoice(o, c)) === i);

const rulesOf = (entry: LastingCard): LastingRules => {
  const card = getCard(entry.cardId);
  return card.type !== 'creature' && card.lasting ? card.lasting : NO_RULES;
};

const NO_RULES: LastingRules = { duration: 'permanent' };

const cardKillsAndReturns = (cardId: string): boolean => {
  const card = getCard(cardId);
  return card.type !== 'creature' && !!card.killsAndReturns;
};

/** Dégâts d'Éclats de glace. */
const ICE: DamageSource = { magic: true, school: 'Eau', spell: true };

const schoolOf = (unit: Unit): string | undefined => {
  const card = getCard(unit.cardId);
  return card.type === 'creature' ? card.school : undefined;
};

/** Ajoute des capacités : les valeurs numériques s'additionnent, les autres s'activent. */
function mergeKeywords(base: Keywords, extra: Keywords): Keywords {
  const merged: Record<string, number | boolean | undefined> = { ...base };
  for (const [key, value] of Object.entries(extra) as [string, number | boolean | undefined][]) {
    const current = merged[key];
    merged[key] = typeof value === 'number' && typeof current === 'number' ? current + value : value ?? current;
  }
  return merged as Keywords;
}

/** Appeleur de sang : les deux autres créatures alliées à sacrifier. */
const BLOOD_PACT_FIRST: Step = {
  prompt: 'Choisissez la première créature alliée à sacrifier.',
  emptyReason: 'Il faut deux autres créatures alliées à sacrifier.',
  options: (game, pi) => game.units(pi).filter(x => game.isTargetable(x.unit.uid)).map((x): Choice => ({ kind: 'unit', uid: x.unit.uid })),
};

const BLOOD_PACT_SECOND: Step = { ...BLOOD_PACT_FIRST, prompt: 'Choisissez la seconde créature alliée à sacrifier.', distinctFrom: 1 };

