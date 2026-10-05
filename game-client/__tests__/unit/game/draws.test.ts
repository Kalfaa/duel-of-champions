import { describe, expect, it } from 'vitest';
import { countDrawnCards } from '../../../src/game/draws';
import { card, player, view } from '../fixtures';

const withMe = (deckCount: number, handSize: number, over: Parameters<typeof view>[0] = {}) =>
  view({ players: [player({ deckCount, hand: Array.from({ length: handSize }, () => card()) }), player({ hand: null })], ...over });

describe('countDrawnCards', () => {
  it('compte les cartes passées de la bibliothèque à la main', () => {
    expect(countDrawnCards(withMe(20, 3), withMe(19, 4))).toBe(1);
    expect(countDrawnCards(withMe(20, 3), withMe(18, 5))).toBe(2);
  });

  it('compte la carte piochée même si une autre a été défaussée en même temps', () => {
    expect(countDrawnCards(withMe(20, 3), withMe(19, 3))).toBe(1);
  });

  it('ignore une carte jouée, le début de partie et une autre partie', () => {
    expect(countDrawnCards(withMe(20, 3), withMe(20, 2))).toBe(0);
    expect(countDrawnCards(null, withMe(14, 6))).toBe(0);
    expect(countDrawnCards(withMe(20, 3, { gameId: 'old' }), withMe(19, 4))).toBe(0);
  });

  it('ne regarde que la main du joueur', () => {
    const before = view({ players: [player({ deckCount: 20 }), player({ hand: null, deckCount: 20 })] });
    const after = view({ players: [player({ deckCount: 20 }), player({ hand: null, deckCount: 19, handCount: 6 })] });
    expect(countDrawnCards(before, after)).toBe(0);
  });

  it('compte les pioches de l\'adversaire d\'après la taille de sa main cachée', () => {
    const before = view({ players: [player(), player({ hand: null, deckCount: 20, handCount: 5 })] });
    const after = view({ players: [player(), player({ hand: null, deckCount: 19, handCount: 6 })] });
    expect(countDrawnCards(before, after, 1)).toBe(1);
    const played = view({ players: [player(), player({ hand: null, deckCount: 20, handCount: 4 })] });
    expect(countDrawnCards(before, played, 1)).toBe(0);
  });
});
