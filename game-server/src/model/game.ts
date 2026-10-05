import { getCard, type Card, type CreatureCard, type DamageSource, type Effect, type Step, type StepContext } from './cards';
import { GameRuleError } from './errors';
import { getEvent, type ActiveEvent } from './events';
import { FACTIONS, type HeroPower } from './factions';
import { SeededRandom } from './random';
import {
  ALLOWED_ROWS, FACTION_IDS, STAT_NAMES, other, sameChoice,
  type AttackType, type Choice, type DevelopChoice, type FactionId, type GameAction, type Keywords,
  type Phase, type PlayerIndex, type SlotRef, type StatKey, type Target,
} from './types';

export const STARTING_HAND = 6;
export const MAX_HAND = 10;
export const MAX_RESOURCES = 10;
export const HERO_HP = 20;
/** Coût en ressources de la pioche du héros. */
export const DRAW_COST = 1;
export const ROWS = 2;
export const LANES = 4;
/** Nombre d'événements en jeu à la fois. */
export const EVENT_SLOTS = 2;
const LOG_LIMIT = 120;
export const AI_PLAYER_ID = 'ai';

/** Sort permanent attaché à une créature ; il rejoint le cimetière de son lanceur quand elle disparaît. */
export interface Enchantment {
  cardId: string;
  owner: PlayerIndex;
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

/** Riposte due par un défenseur qui a survécu, résolue juste après l'attaque. */
interface PendingRetaliation {
  defender: number;
  attacker: number;
  /** L'attaquant a infligé des dégâts d'attaque : son Drain de vie s'applique après la riposte. */
  drained: boolean;
}

/** Une étape de choix et les options légales à ce moment. */
export interface StepOptions {
  step: Step;
  options: Choice[];
}

export interface PlayerSetup {
  id: string;
  faction: FactionId;
  isAi: boolean;
}

export interface GameSetup {
  id: string;
  seed: number;
  players: readonly [PlayerSetup, PlayerSetup];
}

const adjacent = (a: SlotRef, b: SlotRef): boolean =>
  (a.row === b.row && Math.abs(a.lane - b.lane) === 1) || (a.lane === b.lane && a.row !== b.row);

const sameSlot = (a: SlotRef, b: SlotRef): boolean => a.row === b.row && a.lane === b.lane;

const POISON: DamageSource = { magic: false };

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

  /** Partie contre l'IA : elle joue une faction différente de celle du joueur, tirée au hasard. */
  static createAgainstAi(opts: { id: string; seed: number; playerId: string; faction: FactionId }): Game {
    const rng = new SeededRandom(opts.seed);
    const aiFaction = rng.pick(FACTION_IDS.filter(f => f !== opts.faction));
    return new Game(opts.id, rng, [
      { id: opts.playerId, faction: opts.faction, isAi: false },
      { id: AI_PLAYER_ID, faction: aiFaction, isAi: true },
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

  heroName(pi: PlayerIndex): string {
    return FACTIONS[this.players[pi].faction].hero.name;
  }

  heroPower(pi: PlayerIndex): HeroPower {
    return FACTIONS[this.players[pi].faction].hero.power;
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

  /** Cases où déployer la créature : cases libres autorisées, et piles de la même créature si elle est empilable. */
  deploySlots(pi: PlayerIndex, card: CreatureCard): SlotRef[] {
    const free = this.placementSlots(pi, card.attackType);
    if (!card.keywords.stackable) return free;
    const stacks = this.units(pi).filter(x => x.unit.cardId === card.id).map(({ row, lane }) => ({ row, lane }));
    return [...free, ...stacks];
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

  /** Étapes de choix de la carte et leurs options légales. */
  playSteps(pi: PlayerIndex, handIndex: number): StepOptions[] {
    const cardId = this.players[pi].hand[handIndex];
    if (cardId === undefined) return [];
    const card = getCard(cardId);
    const steps = card.type === 'creature' ? [this.deployStep(card)] : card.effect.steps;
    return this.stepOptions(pi, steps, { handIndex });
  }

  powerSteps(pi: PlayerIndex): StepOptions[] {
    return this.stepOptions(pi, this.heroPower(pi).effect.steps, { handIndex: null });
  }

  eventSteps(pi: PlayerIndex, slot: number): StepOptions[] {
    const event = this.activeEventAt(slot);
    return event ? this.stepOptions(pi, event.effect.steps, { handIndex: null }) : [];
  }

  /** Coût d'une carte, augmenté par les événements permanents en jeu. */
  cardCost(card: Card): number {
    return card.cost + this.eventRow.reduce((sum, id) => {
      const event = getEvent(id);
      return sum + (event.kind === 'ongoing' ? event.costModifier(card) : 0);
    }, 0);
  }

  /** Raison pour laquelle la carte ne peut pas être jouée, ou null si elle le peut. */
  whyNotPlay(pi: PlayerIndex, handIndex: number): string | null {
    const turnError = this.turnError(pi);
    if (turnError) return turnError;
    const p = this.players[pi];
    const cardId = p.hand[handIndex];
    if (cardId === undefined) return 'Carte introuvable.';
    const card = getCard(cardId);
    if (p.res < this.cardCost(card)) return 'Pas assez de ressources.';
    return this.requirementError(pi, card.req) ?? this.stepsError(this.playSteps(pi, handIndex));
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
    if (this.players[pi].res < this.heroPower(pi).cost) return 'Pas assez de ressources.';
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
    const turnError = this.turnError(pi);
    if (turnError) return turnError;
    const found = this.locate(uid);
    if (!found || found.owner !== pi) return 'Créature introuvable.';
    if (found.unit.deployedTurn === this.turnCount) return 'Une créature ne peut pas agir le tour de son déploiement.';
    if (found.unit.acted) return 'Cette créature a déjà agi ce tour-ci.';
    return null;
  }

  whyNotAttack(pi: PlayerIndex, uid: number): string | null {
    const error = this.whyNotUnitAct(pi, uid);
    if (error) return error;
    return this.locate(uid)!.unit.atk > 0 ? null : 'Cette créature n\'a pas d\'attaque.';
  }

  /**
   * Cibles d'attaque d'une créature, dans son couloir : la mêlée et les volants frappent la ligne avant
   * adverse si elle est occupée, les tireurs choisissent. Sans créature adverse dans le couloir, le héros.
   * « Attaque n'importe où » atteint toute créature ennemie ; une créature qui provoque doit être attaquée si possible.
   */
  attackTargets(pi: PlayerIndex, uid: number): Target[] {
    if (this.whyNotAttack(pi, uid)) return [];
    const { unit, lane } = this.locate(uid)!;
    const e = other(pi);
    const enemyBoard = this.players[e].board;
    const front = enemyBoard[0]![lane];
    const back = enemyBoard[1]![lane];
    const hero: Target = { kind: 'hero', player: e };
    const toTarget = (u: Unit): Target => ({ kind: 'unit', uid: u.uid });
    let targets: Target[];
    if (unit.keywords.attackAnywhere) {
      targets = this.units(e).map(x => toTarget(x.unit));
      if (!front && !back) targets.push(hero);
    } else if (!front && !back) {
      targets = [hero];
    } else {
      const reachable = unit.attackType === 'shooter' ? [front, back] : [front ?? back];
      targets = reachable.filter((u): u is Unit => !!u).map(toTarget);
    }
    const taunting = targets.filter(t => t.kind === 'unit' && this.locate(t.uid)?.unit.keywords.taunt);
    return taunting.length ? taunting : targets;
  }

  moveDestinations(pi: PlayerIndex, uid: number): SlotRef[] {
    if (this.whyNotUnitAct(pi, uid)) return [];
    const found = this.locate(uid)!;
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
    if (!this.validChoices(this.playSteps(pi, handIndex), choices)) {
      throw new GameRuleError(card.type === 'creature' ? 'Choisissez un emplacement autorisé.' : 'Choix invalide.');
    }

    p.res -= this.cardCost(card);
    const [, ...taken] = this.takeFromHand(pi, [handIndex, ...handIndices(choices)]);
    this.pendingPlay = { kind: 'card', player: pi, cardId: card.id, choices: [...choices], taken };
    const target = choices.find(c => c.kind === 'unit' || c.kind === 'hero');
    if (card.type === 'creature') this.addLog(`${this.heroName(pi)} déploie ${card.name}.`, 'action', pi);
    else this.addLog(`${this.heroName(pi)} joue ${card.name}${target ? ' sur ' + this.targetName(target as Target) : ''}.`, 'action', pi);
    this.imposeDiscards(pi);
  }

  /** Résout la carte jouée (pose la créature ou applique l'effet) ou le pouvoir du héros. */
  resolvePending(): void {
    const play = this.pendingPlay;
    if (!play) throw new GameRuleError('Aucune carte à résoudre.');
    this.pendingPlay = null;
    if (this.isOver) return;
    const { player: pi, choices, taken } = play;
    if (play.kind === 'power') {
      this.applyEffect(this.heroPower(pi).effect, pi, choices, taken);
      return;
    }
    if (play.kind === 'event') {
      const event = getEvent(play.eventId);
      if (event.kind === 'active') this.applyEffect(event.effect, pi, choices, taken);
      return;
    }
    const card = getCard(play.cardId);
    if (card.type === 'creature') {
      const slot = choices[0];
      if (slot?.kind === 'slot') this.deploy(pi, card, slot);
    } else {
      card.effect.apply(this, pi, { choices, taken });
      if (!card.ongoing) this.players[pi].grave.push(card.id);
    }
  }

  /**
   * Action du héros : pouvoir spécial. Comme une carte, il est payé et révélé, puis résolu par resolvePending().
   */
  usePower(pi: PlayerIndex, choices: readonly Choice[]): void {
    this.assertNoError(this.whyNotPower(pi));
    const power = this.heroPower(pi);
    if (!this.validChoices(this.powerSteps(pi), choices)) throw new GameRuleError('Choix invalide.');
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
    if (!this.validChoices(this.eventSteps(pi, slot), choices)) throw new GameRuleError('Choix invalide.');
    this.players[pi].res -= event.cost;
    this.eventsUsed[slot] = true;
    const taken = this.takeFromHand(pi, handIndices(choices));
    this.pendingPlay = { kind: 'event', player: pi, eventId: event.id, choices: [...choices], taken };
    this.addLog(`${this.heroName(pi)} utilise l'événement ${event.name}.`, 'action', pi);
  }

  /**
   * La créature attaque une cible. Charge, Attaque en balayage et Explosion touchent d'autres créatures.
   * Si le défenseur survit et a de la riposte, celle-ci est mise en attente et appliquée par
   * resolveRetaliation() ; aucune autre action n'est possible entre-temps.
   */
  attack(pi: PlayerIndex, uid: number, target: Target): void {
    this.assertNoError(this.whyNotAttack(pi, uid));
    if (!this.attackTargets(pi, uid).some(t => sameChoice(t, target))) throw new GameRuleError('Cette cible est hors de portée.');
    const unit = this.locate(uid)!.unit;
    const name = getCard(unit.cardId).name;
    unit.acted = true;
    unit.attacked = true;
    this.pendingEvents.push({ kind: 'attack', attacker: uid, target });

    let drained = false;
    if (target.kind === 'hero') {
      this.addLog(`${name} frappe ${this.heroName(target.player)} (${unit.atk}).`, 'damage', pi);
      drained = unit.atk > 0;
      this.damageHero(target.player, unit.atk);
    } else {
      this.addLog(`${name} attaque ${this.targetName(target)}.`, 'action', pi);
      const struck = [target.uid, ...this.extraStrikes(unit, target.uid)];
      const blasted = unit.keywords.areaBlast ? this.adjacentUnits(target.uid) : [];
      for (const defenderUid of struck) {
        const dealt = this.strike(unit, unit.atk, defenderUid);
        if (dealt > 0) drained = true;
        const hit = this.locate(defenderUid)?.unit;
        if (dealt > 0 && hit && unit.keywords.infect) hit.poison += unit.keywords.infect;
      }
      const blast = unit.keywords.areaBlast ?? 0;
      blasted.forEach(u => this.damageUnit(u.uid, blast, { magic: unit.magic }));
      const defender = this.locate(target.uid)?.unit;
      if (defender && defender.ret > 0 && !unit.keywords.noret && this.locate(uid)) {
        this.pendingRetaliation = { defender: defender.uid, attacker: uid, drained };
        return;
      }
    }
    this.applyLifeDrain(uid, drained);
  }

  /** Le défenseur riposte : il inflige sa valeur de riposte à son attaquant. */
  resolveRetaliation(): void {
    const pending = this.pendingRetaliation;
    if (!pending) throw new GameRuleError('Aucune riposte à résoudre.');
    this.pendingRetaliation = null;
    const defender = this.locate(pending.defender)?.unit;
    if (this.isOver || !defender || !this.locate(pending.attacker)) return;
    this.pendingEvents.push({ kind: 'retaliate', attacker: defender.uid, target: { kind: 'unit', uid: pending.attacker } });
    this.addLog(`${getCard(defender.cardId).name} riposte (${defender.ret}).`, 'action', defender.owner);
    this.strike(defender, defender.ret, pending.attacker);
    this.applyLifeDrain(pending.attacker, pending.drained);
  }

  /** La créature se déplace vers une case adjacente autorisée ; cela remplace son attaque du tour. */
  moveUnit(pi: PlayerIndex, uid: number, to: SlotRef): void {
    this.assertNoError(this.whyNotUnitAct(pi, uid));
    if (!this.moveDestinations(pi, uid).some(s => sameSlot(s, to))) throw new GameRuleError('Choisissez une case adjacente libre et autorisée.');
    const p = this.players[pi];
    const found = this.locate(uid)!;
    p.board[found.row]![found.lane] = null;
    p.board[to.row]![to.lane] = found.unit;
    found.unit.acted = true;
    this.addLog(`${getCard(found.unit.cardId).name} se déplace.`, 'action', pi);
  }

  /** Fin du tour : Rétablissement des créatures qui n'ont pas attaqué, rotation des événements, puis tour adverse. */
  endTurn(pi: PlayerIndex): void {
    this.assertNoError(this.turnError(pi));
    for (const { unit } of this.units(pi)) {
      if (unit.keywords.mending && !unit.attacked) this.healUnit(unit.uid, unit.hpMax - unit.hpCur);
    }
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
    this.players[pi].grave.push(...cardIds);
  }

  /** Place des cartes au-dessus de la bibliothèque (la dernière sera piochée la première). */
  putOnLibrary(pi: PlayerIndex, cardIds: readonly string[]): void {
    this.players[pi].deck.push(...cardIds);
  }

  gainResources(pi: PlayerIndex, n: number): void {
    this.players[pi].res += n;
    this.addLog(`${this.heroName(pi)} gagne ${n} ressources.`, 'info', pi);
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

  /** Nombre de créatures de la main déployables avec ce budget (coût et conditions). */
  affordableCreatures(pi: PlayerIndex, budget: number): number {
    return this.players[pi].hand.filter(id => {
      const card = getCard(id);
      return card.type === 'creature' && this.cardCost(card) <= budget && this.requirementError(pi, card.req) === null;
    }).length;
  }

  /** La créature de la main est jouable avec les ressources actuelles et est du type indiqué. */
  canAffordCreature(pi: PlayerIndex, cardId: string, attackType: AttackType): boolean {
    const card = getCard(cardId);
    return card.type === 'creature' && card.attackType === attackType && this.cardCost(card) <= this.players[pi].res
      && this.requirementError(pi, card.req) === null;
  }

  /**
   * Inflige des dégâts à une créature ; retourne les dégâts réellement encaissés.
   * Intangible divise par deux les dégâts non magiques.
   */
  damageUnit(uid: number, n: number, source: DamageSource): number {
    const unit = this.locate(uid)?.unit;
    if (!unit || unit.hpCur <= 0) return 0;
    const amount = unit.keywords.incorporeal && !source.magic ? Math.floor(n / 2) : n;
    if (amount <= 0) return 0;
    const dealt = Math.min(amount, unit.hpCur);
    unit.hpCur -= amount;
    this.pendingEvents.push({ kind: 'damage', target: { kind: 'unit', uid }, amount });
    if (unit.hpCur <= 0) this.destroyUnit(uid);
    return dealt;
  }

  /** Retire la créature du plateau : toute sa pile et ses enchantements rejoignent les cimetières. */
  destroyUnit(uid: number): void {
    const found = this.locate(uid);
    if (!found) return;
    const { unit } = found;
    this.players[found.owner].board[found.row]![found.lane] = null;
    for (let i = 0; i < unit.stack; i++) this.players[found.owner].grave.push(unit.cardId);
    for (const e of unit.enchantments) this.players[e.owner].grave.push(e.cardId);
    this.addLog(`${getCard(unit.cardId).name} est détruit.`, 'damage', null);
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

  /** Attache un sort permanent à la créature et applique ses modifications (attaque et riposte au minimum 0). */
  enchant(uid: number, cardId: string, caster: PlayerIndex, mods: { atk?: number; ret?: number; keywords?: Keywords }): void {
    const unit = this.locate(uid)?.unit;
    if (!unit) {
      this.players[caster].grave.push(cardId);
      return;
    }
    unit.enchantments.push({ cardId, owner: caster });
    unit.atk = Math.max(0, unit.atk + (mods.atk ?? 0));
    unit.ret = Math.max(0, unit.ret + (mods.ret ?? 0));
    const { lifeDrain, ...granted } = mods.keywords ?? {};
    unit.keywords = { ...unit.keywords, ...granted };
    if (lifeDrain) unit.keywords.lifeDrain = (unit.keywords.lifeDrain ?? 0) + lifeDrain;
    this.pendingEvents.push({ kind: 'buff', target: { kind: 'unit', uid } });
  }

  // ==================================================================
  //  Déroulement interne
  // ==================================================================
  private createPlayer(setup: PlayerSetup): PlayerState {
    const faction = FACTIONS[setup.faction];
    const deck = Object.entries(faction.deck).flatMap(([id, count]) => Array<string>(count).fill(id));
    return {
      id: setup.id, isAi: setup.isAi, faction: setup.faction,
      hp: HERO_HP, maxHp: HERO_HP, m: faction.hero.m, g: faction.hero.g, d: faction.hero.d, res: 0, maxRes: 0,
      deck: this.rng.shuffle(deck), hand: [], grave: [],
      board: Array.from({ length: ROWS }, () => Array<Unit | null>(LANES).fill(null)),
      heroActionUsed: false, meleeDeployBonus: 0, nextDeployBonus: { ...NO_DEPLOY_BONUS }, left: false,
    };
  }

  private start(): this {
    const first: PlayerIndex = this.rng.next() < 0.5 ? 0 : 1;
    this.currentPlayer = first;
    this.draw(first, STARTING_HAND, true);
    this.draw(other(first), STARTING_HAND, true);
    this.dealEvents();
    this.addLog(`${this.heroName(first)} commence la partie.`, 'turn', null);
    this.beginTurn();
    return this;
  }

  /**
   * Phase de ravitaillement : +1 production, ressources rechargées, poison, Régénération et Soin,
   * pioche ; puis phase d'action.
   */
  private beginTurn(): void {
    const pi = this.currentPlayer;
    const p = this.players[pi];
    this.turnCount++;
    p.maxRes = Math.min(MAX_RESOURCES, p.maxRes + 1);
    p.res = p.maxRes;
    p.heroActionUsed = false;
    p.meleeDeployBonus = 0;
    p.nextDeployBonus = { ...NO_DEPLOY_BONUS };
    this.eventsUsed = this.eventRow.map(() => false);
    this.addLog(`— Tour de ${this.heroName(pi)} —`, 'turn', null);
    for (const { unit } of this.units(pi)) {
      unit.acted = false;
      unit.attacked = false;
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
    this.draw(pi, 1);
    if (!this.isOver) this.currentPhase = 'action';
  }

  /** Les événements des deux joueurs sont mélangés ensemble et les deux premiers sont mis en jeu. */
  private dealEvents(): void {
    const all = this.players.flatMap(p => FACTIONS[p.faction].events);
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
  private deploy(pi: PlayerIndex, card: CreatureCard, slot: SlotRef): void {
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
      return;
    }
    const unit = this.makeUnit(card, pi);
    unit.atk += next.atk;
    unit.ret += next.ret;
    unit.hpMax += bonus;
    unit.hpCur += bonus;
    p.board[slot.row]![slot.lane] = unit;
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

  /** Dégâts de combat (attaque ou riposte) : les gardes de la cible et de ses voisines les réduisent. */
  private strike(from: Unit, amount: number, toUid: number): number {
    const found = this.locate(toUid);
    if (!found) return 0;
    const key = from.attackType === 'melee' ? 'meleeGuard' : from.attackType === 'shooter' ? 'rangedGuard' : null;
    const guard = key === null ? 0 : this.units(found.owner)
      .filter(x => x.unit === found.unit || adjacent(x, found))
      .reduce((sum, x) => sum + (x.unit.keywords[key] ?? 0), 0);
    return this.damageUnit(toUid, Math.max(0, amount - guard), { magic: from.magic });
  }

  private applyLifeDrain(uid: number, drained: boolean): void {
    const unit = this.locate(uid)?.unit;
    if (drained && unit?.keywords.lifeDrain) this.healUnit(uid, unit.keywords.lifeDrain);
  }

  /** Chaque Diablotin du chaos adverse fait défausser une carte au hasard au joueur qui vient de jouer. */
  private imposeDiscards(pi: PlayerIndex): void {
    const p = this.players[pi];
    for (const { unit } of this.units(other(pi))) {
      if (!unit.keywords.imposeDiscard || !p.hand.length) continue;
      const [cardId] = p.hand.splice(Math.floor(this.rng.next() * p.hand.length), 1);
      p.grave.push(cardId!);
      this.addLog(`${getCard(unit.cardId).name} fait défausser ${getCard(cardId!).name}.`, 'info', pi);
    }
  }

  private addToHand(pi: PlayerIndex, cardId: string, silent = false): void {
    const p = this.players[pi];
    if (p.hand.length >= MAX_HAND) {
      if (!silent) this.addLog(`Main pleine : ${getCard(cardId).name} est défaussée.`, 'info', pi);
      p.grave.push(cardId);
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

  private stepOptions(pi: PlayerIndex, steps: readonly Step[], ctx: StepContext): StepOptions[] {
    return steps.map(step => ({ step, options: step.options(this, pi, ctx) }));
  }

  private stepsError(steps: readonly StepOptions[]): string | null {
    for (const { step, options } of steps) {
      const needed = step.distinctFrom === undefined ? 1 : 2;
      if (options.length < needed) return step.emptyReason ?? 'Aucune cible valide.';
    }
    return null;
  }

  private validChoices(steps: readonly StepOptions[], choices: readonly Choice[]): boolean {
    if (choices.length !== steps.length) return false;
    const hands = handIndices(choices);
    if (new Set(hands).size !== hands.length) return false;
    return steps.every(({ step, options }, i) => {
      const choice = choices[i]!;
      if (!options.some(o => sameChoice(o, choice))) return false;
      return step.distinctFrom === undefined || !sameChoice(choice, choices[step.distinctFrom]!);
    });
  }

  private requirementError(pi: PlayerIndex, req: Partial<Record<StatKey, number>>): string | null {
    const p = this.players[pi];
    for (const [k, v] of Object.entries(req) as [StatKey, number][]) {
      if (p[k] < v) return `Il faut ${STAT_NAMES[k]} ${v}.`;
    }
    return null;
  }

  private turnError(pi: PlayerIndex): string | null {
    if (this.isOver) return 'La partie est terminée.';
    if (this.currentPlayer !== pi) return 'Ce n\'est pas votre tour.';
    if (this.pendingPlay) return PENDING_ERRORS[this.pendingPlay.kind];
    if (this.pendingRetaliation) return 'Une riposte est en cours.';
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
      stack: 1, poison: 0, enchantments: [], acted: false, attacked: false,
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
