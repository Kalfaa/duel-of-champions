import type { GameView, PlayerIndex } from '../api/protocol';

/** Cartes qui viennent d'arriver dans les mains depuis les bibliothèques, le temps de leur animation. */
export interface Draw {
  id: number;
  /** Cartes piochées par le joueur : ce sont les dernières de sa main (une carte piochée est ajoutée à la fin). */
  mine: number;
  /** Cartes piochées par l'adversaire (face cachée). */
  theirs: number;
}

/**
 * Nombre de cartes que ce joueur vient de piocher entre deux états : sa bibliothèque a diminué
 * d'autant, et ces cartes sont les dernières de sa main. Aucune au début d'une partie.
 */
export function countDrawnCards(prev: GameView | null, next: GameView, player: PlayerIndex = next.you): number {
  if (!prev || prev.gameId !== next.gameId) return 0;
  const before = prev.players[player];
  const after = next.players[player];
  const fromDeck = before.deckCount - after.deckCount;
  const handSize = after.hand?.length ?? after.handCount;
  return fromDeck > 0 ? Math.min(fromDeck, handSize) : 0;
}
