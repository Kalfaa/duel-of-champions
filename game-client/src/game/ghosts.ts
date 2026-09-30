import type { GameView, PlayerIndex, UnitView } from '../api/protocol';

/** Créature qui vient de disparaître du plateau, affichée encore un instant pour son animation de mort. */
export interface Ghost {
  unit: UnitView;
  player: PlayerIndex;
  row: number;
  lane: number;
}

function unitsOf(view: GameView): Ghost[] {
  return ([0, 1] as const).flatMap(player =>
    view.players[player].board.flatMap((cells, row) =>
      cells.flatMap((unit, lane) => (unit ? [{ unit, player, row, lane }] : []))));
}

/** Créatures présentes dans `prev` qui ne sont plus nulle part dans `next` (détruites ou sacrifiées). */
export function findRemovedUnits(prev: GameView | null, next: GameView): Ghost[] {
  if (!prev || prev.gameId !== next.gameId) return [];
  const remaining = new Set(unitsOf(next).map(x => x.unit.uid));
  return unitsOf(prev).filter(x => !remaining.has(x.unit.uid));
}
