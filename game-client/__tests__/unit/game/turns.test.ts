import { describe, expect, it } from 'vitest';
import { turnTaker } from '../../../src/game/turns';
import { view } from '../fixtures';

describe('turnTaker', () => {
  it('annonce le joueur qui prend la main quand le tour change', () => {
    expect(turnTaker(view({ current: 0 }), view({ current: 1 }))).toBe(1);
    expect(turnTaker(view({ current: 1 }), view({ current: 0 }))).toBe(0);
  });

  it('ne dit rien tant que le même joueur a la main', () => {
    expect(turnTaker(view({ current: 0 }), view({ current: 0 }))).toBeNull();
  });

  it('annonce le premier joueur au début d\'une partie', () => {
    expect(turnTaker(null, view({ current: 1 }))).toBe(1);
    expect(turnTaker(view({ gameId: 'autre', current: 1 }), view({ current: 1 }))).toBe(1);
  });

  it('ne dit rien quand la partie se termine', () => {
    expect(turnTaker(view({ current: 0 }), view({ current: 1, phase: 'over' }))).toBeNull();
  });
});
