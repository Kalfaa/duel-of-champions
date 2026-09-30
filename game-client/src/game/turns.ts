import type { GameView, PlayerIndex } from '../api/protocol';

/** Bandeau annonçant le joueur qui prend la main. */
export interface TurnBanner {
  /** Identifiant unique, pour rejouer l'animation à chaque changement de tour. */
  id: number;
  player: PlayerIndex;
}

/** Joueur qui prend la main entre `prev` et `next` (début de partie compris), ou null si le tour ne change pas. */
export function turnTaker(prev: GameView | null, next: GameView): PlayerIndex | null {
  if (next.phase === 'over') return null;
  if (!prev || prev.gameId !== next.gameId) return next.current;
  return prev.current !== next.current ? next.current : null;
}
