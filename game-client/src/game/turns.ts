import type { GameView, PlayerIndex } from '../api/protocol';

/** Bandeau annonçant le joueur qui prend la main. */
export interface TurnBanner {
  /** Identifiant unique, pour rejouer l'animation à chaque changement de tour. */
  id: number;
  player: PlayerIndex;
}

/** Joueur qui prend la main entre `prev` et `next` (premier tour compris, après le mulligan), ou null si le tour ne change pas. */
export function turnTaker(prev: GameView | null, next: GameView): PlayerIndex | null {
  if (next.phase !== 'action') return null;
  if (!prev || prev.gameId !== next.gameId || prev.phase === 'mulligan') return next.current;
  return prev.current !== next.current ? next.current : null;
}
