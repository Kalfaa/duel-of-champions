import { describe, expect, it } from 'vitest';
import { expectedScore, ratingDelta } from '../../../src/model/elo';

describe('Elo', () => {
  it('donne une chance sur deux à deux joueurs de même niveau', () => {
    expect(expectedScore(1200, 1200)).toBe(0.5);
  });

  it('donne environ 91 % de chances avec 400 points d\'avance', () => {
    expect(expectedScore(1400, 1000)).toBeCloseTo(0.909, 3);
  });

  it('rapporte la moitié du facteur K entre joueurs de même niveau', () => {
    expect(ratingDelta(1000, 1000)).toBe(16);
  });

  it('récompense davantage une victoire contre un adversaire mieux classé', () => {
    expect(ratingDelta(1000, 1400)).toBe(29);
    expect(ratingDelta(1400, 1000)).toBe(3);
  });

  it('rapporte toujours au moins un point', () => {
    expect(ratingDelta(3000, 100)).toBe(1);
  });
});
