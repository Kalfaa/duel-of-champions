import { describe, expect, it } from 'vitest';
import { findRemovedUnits } from '../../../src/game/ghosts';
import { player, unit, view } from '../fixtures';

describe('findRemovedUnits', () => {
  const before = view({
    players: [
      player({ board: [[unit(1), null, null, null], [null, unit(2), null, null]] }),
      player({ hand: null, board: [[unit(3), null, null, null], [null, null, null, null]] }),
    ],
  });

  it('retrouve les créatures disparues avec leur ancienne case', () => {
    const after = view({
      players: [
        player({ board: [[unit(1), null, null, null], [null, null, null, null]] }),
        player({ hand: null }),
      ],
    });
    expect(findRemovedUnits(before, after).map(g => [g.unit.uid, g.player, g.row, g.lane])).toEqual([[2, 0, 1, 1], [3, 1, 0, 0]]);
  });

  it('ignore une créature qui s\'est seulement déplacée', () => {
    const after = view({
      players: [
        player({ board: [[null, unit(1), null, null], [null, unit(2), null, null]] }),
        player({ hand: null, board: [[unit(3), null, null, null], [null, null, null, null]] }),
      ],
    });
    expect(findRemovedUnits(before, after)).toEqual([]);
  });

  it('ignore le premier état et un changement de partie', () => {
    expect(findRemovedUnits(null, before)).toEqual([]);
    expect(findRemovedUnits(before, view({ gameId: 'autre' }))).toEqual([]);
  });
});
