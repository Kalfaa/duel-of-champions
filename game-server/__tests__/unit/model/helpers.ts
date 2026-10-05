import { getCreature } from '../../../src/model/cards';
import { Game, type PlayerState, type Unit } from '../../../src/model/game';
import { other, type Choice, type FactionId, type PlayerIndex } from '../../../src/model/types';

export interface Setup {
  game: Game;
  /** Joueur qui commence (tour en cours). */
  a: PlayerIndex;
  b: PlayerIndex;
}

/** Nouvelle partie dont le joueur `a` (celui qui commence) joue la première faction. */
export function newGame(factions: [FactionId, FactionId] = ['havre', 'inferno'], seed = 42): Setup {
  for (let s = seed; ; s++) {
    const game = Game.create({
      id: 'g1', seed: s,
      players: [{ id: 'p0', faction: factions[0], isAi: false }, { id: 'p1', faction: factions[1], isAi: false }],
    });
    if (game.current === 0) {
      // Événements sans effet permanent, pour que les coûts des cartes ne dépendent pas du tirage
      setEvents(game, ['celebration', 'dayOfFortune']);
      return { game, a: 0, b: other(0) };
    }
  }
}

/** Remplace les événements en jeu (et remet à zéro leur utilisation du tour). */
export function setEvents(game: Game, ids: string[]): void {
  const internals = game as unknown as { eventRow: string[]; eventsUsed: boolean[] };
  internals.eventRow = [...ids];
  internals.eventsUsed = ids.map(() => false);
}

/** Accès en écriture à l'état d'un joueur, pour préparer une situation de test. */
export const state = (game: Game, pi: PlayerIndex): PlayerState => game.player(pi) as PlayerState;

let nextUid = 1000;

/** Pose directement une créature sur le plateau, prête à agir. */
export function place(game: Game, pi: PlayerIndex, cardId: string, row: number, lane: number): Unit {
  const card = getCreature(cardId);
  const unit: Unit = {
    uid: nextUid++, cardId, owner: pi, attackType: card.attackType, magic: card.magic, keywords: { ...card.keywords }, deployedTurn: -1,
    atk: card.atk, ret: card.ret, hpCur: card.hp, hpMax: card.hp, stack: 1, poison: 0, enchantments: [], acted: false, attacked: false,
  };
  state(game, pi).board[row]![lane] = unit;
  return unit;
}

/** Donne une main précise, des ressources et des caractéristiques élevées au joueur. */
export function readyToPlay(game: Game, pi: PlayerIndex, hand: string[], res = 10): void {
  const p = state(game, pi);
  p.hand = [...hand];
  p.res = res;
  p.m = 7; p.g = 7; p.d = 7;
}

/** Joue une carte et la résout immédiatement (sans la pause de révélation gérée par le service). */
export function playNow(game: Game, pi: PlayerIndex, handIndex: number, choices: Choice[]): void {
  game.playCard(pi, handIndex, choices);
  game.resolvePending();
}

/** Utilise le pouvoir du héros et le résout immédiatement. */
export function powerNow(game: Game, pi: PlayerIndex, choices: Choice[]): void {
  game.usePower(pi, choices);
  game.resolvePending();
}

export const unit = (u: Unit): { kind: 'unit'; uid: number } => ({ kind: 'unit', uid: u.uid });
export const slot = (row: number, lane: number): Choice => ({ kind: 'slot', row, lane });
