import { getCard } from './cards';
import type { Game, StepOptions, Unit } from './game';
import { other, sameChoice, type Choice, type DevelopChoice, type GameAction, type PlayerIndex, type StatKey } from './types';

export interface AiStrategy {
  /** Choisit la prochaine action du joueur actif (action du héros, carte, attaque ou fin de tour). */
  chooseAction(game: Game, pi: PlayerIndex): GameAction;
}

interface Candidate {
  score: number;
  action: GameAction;
}

const WIN = 1_000_000;
/** Amélioration minimale de la position pour jouer une carte ou attaquer. */
const MIN_GAIN = 0.2;
/** Au-delà de ce gain, le pouvoir héroïque est préféré au développement. */
const POWER_OVER_DEVELOP = 3;
/** Nombre maximal de combinaisons de choix évaluées par carte. */
const MAX_COMBOS = 150;
/** Cartes de la main envisagées pour un choix « carte de la main » (les moins précieuses). */
const HAND_CANDIDATES = 2;

/** Valeur d'une créature sur le plateau. */
export function unitValue(u: Unit): number {
  const k = u.keywords;
  const abilities = (k.noret ? 1 : 0) + (k.meleeGuard ?? 0) + (k.rangedGuard ?? 0) + (k.heal ?? 0) + (k.regen ?? 0)
    + (k.lifeDrain ?? 0) * 1.2 + (k.infect ?? 0) + (k.areaBlast ?? 0) + (k.incorporeal ? 2 : 0)
    + (k.charge || k.sweep ? 1.5 : 0) + (k.attackAnywhere ? 2 : 0) + (k.taunt ? 1 : 0) + (k.mending ? 1 : 0)
    + (k.imposeDiscard ? 3 : 0);
  return u.atk * 1.5 + u.hpCur + u.ret * 0.7 + abilities - u.poison * 1.5;
}

/** Valeur d'une carte en main : les créatures, cœur du deck, valent un peu plus. */
const handCardValue = (id: string): number => {
  const card = getCard(id);
  return 1.5 + card.cost * 0.25 + (card.type === 'creature' ? 1 : 0);
};

/** Les points de vie comptent davantage quand le héros est en danger. */
const heroValue = (hp: number): number => hp + Math.min(0, hp - 6) * 1.5;

/** Évaluation de la position du point de vue du joueur. */
export function evaluate(game: Game, pi: PlayerIndex): number {
  if (game.isOver) return game.winner === pi ? WIN : -WIN;
  const me = game.player(pi);
  const foe = game.player(other(pi));
  const board = (q: PlayerIndex) => game.units(q).reduce((s, x) => s + unitValue(x.unit), 0);
  return heroValue(me.hp) * 0.8 - heroValue(foe.hp)
    + board(pi) - board(other(pi))
    + me.hand.reduce((s, id) => s + handCardValue(id), 0) - foe.hand.length * 1.5
    + me.res * 0.2;
}

const best = (candidates: Candidate[]): Candidate | null =>
  candidates.reduce<Candidate | null>((b, c) => (!b || c.score > b.score ? c : b), null);

/**
 * IA qui simule chaque coup légal sur une copie de la partie et garde celui qui améliore le plus sa position.
 * Ordre d'un tour : action du héros (pouvoir s'il est rentable, sinon développement), puis cartes et attaques
 * tant qu'elles en valent la peine, puis fin du tour.
 */
export class AiPlayer implements AiStrategy {
  chooseAction(game: Game, pi: PlayerIndex): GameAction {
    const base = evaluate(game, pi);
    return this.heroAction(game, pi, base) ?? this.bestMove(game, pi, base) ?? { type: 'endTurn' };
  }

  private heroAction(game: Game, pi: PlayerIndex, base: number): GameAction | null {
    if (game.whyNotHeroAction(pi) !== null) return null;
    const power = this.powerAction(game, pi, base);
    if (power && power.score >= POWER_OVER_DEVELOP) return power.action;
    const choice = this.chooseDevelopment(game, pi);
    return game.whyNotDevelop(pi, choice) === null ? { type: 'develop', choice } : null;
  }

  private chooseDevelopment(game: Game, pi: PlayerIndex): DevelopChoice {
    const p = game.player(pi);
    const need: Record<StatKey, number> = { m: 0, g: 0, d: 0 };
    for (const id of p.hand) {
      for (const [k, v] of Object.entries(getCard(id).req) as [StatKey, number][]) {
        const deficit = v - p[k];
        if (deficit > 0) need[k] += deficit === 1 ? 3 : 1;
      }
    }
    let choice: StatKey | null = null;
    for (const k of ['m', 'g', 'd'] as const) if (need[k] > (choice ? need[choice] : 0)) choice = k;
    if (choice) return choice;
    if (p.hand.length <= 2 && p.res >= 1) return 'draw';
    return p.m <= p.g ? 'm' : 'g';
  }

  private powerAction(game: Game, pi: PlayerIndex, base: number): Candidate | null {
    if (game.whyNotPower(pi) !== null) return null;
    const bonus = game.heroPower(pi).effect.aiBonus?.(game, pi) ?? 0;
    return best(this.combos(game, pi, game.powerSteps(pi), null).map(choices => {
      const action: GameAction = { type: 'power', choices };
      return { score: this.simulate(game, pi, action) - base + bonus, action };
    }));
  }

  /** Meilleure carte ou attaque, si elle améliore suffisamment la position. */
  private bestMove(game: Game, pi: PlayerIndex, base: number): GameAction | null {
    const actions: GameAction[] = [];
    game.player(pi).hand.forEach((_id, handIndex) => {
      if (game.whyNotPlay(pi, handIndex) !== null) return;
      for (const choices of this.combos(game, pi, game.playSteps(pi, handIndex), handIndex)) {
        actions.push({ type: 'play', handIndex, choices });
      }
    });
    for (const { unit } of game.units(pi)) {
      for (const target of game.attackTargets(pi, unit.uid)) actions.push({ type: 'attack', uid: unit.uid, target });
    }
    const b = best(actions.map(action => ({ score: this.simulate(game, pi, action) - base, action })));
    return b && b.score > MIN_GAIN ? b.action : null;
  }

  /** Combinaisons de choix à évaluer ; pour les cartes de la main, seules les moins précieuses sont envisagées. */
  private combos(game: Game, pi: PlayerIndex, steps: readonly StepOptions[], handIndex: number | null): Choice[][] {
    const hand = game.player(pi).hand;
    let result: Choice[][] = [[]];
    steps.forEach(({ step, options }) => {
      const candidates = options[0]?.kind === 'hand'
        ? [...options].sort((x, y) => handValueAt(hand, x) - handValueAt(hand, y)).slice(0, HAND_CANDIDATES)
        : options;
      const next: Choice[][] = [];
      for (const prefix of result) {
        for (const choice of candidates) {
          if (step.distinctFrom !== undefined && sameChoice(choice, prefix[step.distinctFrom]!)) continue;
          if (choice.kind === 'hand' && (choice.index === handIndex || prefix.some(c => sameChoice(c, choice)))) continue;
          next.push([...prefix, choice]);
          if (next.length >= MAX_COMBOS) break;
        }
        if (next.length >= MAX_COMBOS) break;
      }
      result = next;
    });
    return result;
  }

  /** Joue l'action sur une copie de la partie (révélation et riposte comprises) et évalue le résultat. */
  private simulate(game: Game, pi: PlayerIndex, action: GameAction): number {
    const sim = game.clone();
    try {
      sim.apply(pi, action);
      if (sim.pending) sim.resolvePending();
      if (sim.hasPendingRetaliation) sim.resolveRetaliation();
    } catch {
      return -Infinity;
    }
    return evaluate(sim, pi);
  }
}

const handValueAt = (hand: readonly string[], choice: Choice): number =>
  choice.kind === 'hand' && hand[choice.index] !== undefined ? handCardValue(hand[choice.index]!) : Infinity;
