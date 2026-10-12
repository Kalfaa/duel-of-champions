import { describe, expect, it } from 'vitest';
import { handOrder } from '../../../src/game/hand';
import { card, playable } from '../fixtures';

describe('handOrder', () => {
  it('range les cartes de la moins chère à la plus chère', () => {
    expect(handOrder([card({ cost: 5 }), card({ cost: 1 }), card({ cost: 3 })])).toEqual([1, 2, 0]);
  });

  it('garde l\'ordre de la main à coût égal', () => {
    expect(handOrder([card({ cost: 2 }), card({ cost: 1 }), card({ cost: 2 })])).toEqual([1, 0, 2]);
  });

  it('utilise le coût réel quand il est connu', () => {
    const options = [{ ...playable(), cost: 6 }, { ...playable(), cost: 3 }];
    expect(handOrder([card({ cost: 1 }), card({ cost: 3 })], options)).toEqual([1, 0]);
  });
});
