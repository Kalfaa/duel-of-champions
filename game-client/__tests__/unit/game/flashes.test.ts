import { describe, expect, it } from 'vitest';
import { createFlashes, mergeFlashes, removeFlashes } from '../../../src/game/flashes';

describe('flashes', () => {
  it('crée un flash par événement, indexé par sa cible', () => {
    const created = createFlashes([
      { kind: 'damage', target: { kind: 'unit', uid: 3 }, amount: 2 },
      { kind: 'heal', target: { kind: 'hero', player: 1 }, amount: 4 },
      { kind: 'buff', target: { kind: 'unit', uid: 5 } },
    ]);
    expect(created.map(([key, f]) => [key, f.text, f.heal])).toEqual([
      ['unit-3', '-2', false],
      ['hero-1', '+4', true],
      ['unit-5', '▲', true],
    ]);
  });

  it('n\'affiche pas de flash pour une attaque, seulement pour ses dégâts', () => {
    const created = createFlashes([
      { kind: 'attack', attacker: 1, target: { kind: 'unit', uid: 3 } },
      { kind: 'damage', target: { kind: 'unit', uid: 3 }, amount: 2 },
    ]);
    expect(created.map(([key, f]) => [key, f.text])).toEqual([['unit-3', '-2']]);
  });

  it('ne retire pas un flash remplacé entre-temps sur la même cible', () => {
    const first = createFlashes([{ kind: 'damage', target: { kind: 'unit', uid: 3 }, amount: 1 }]);
    const second = createFlashes([{ kind: 'damage', target: { kind: 'unit', uid: 3 }, amount: 2 }]);
    const merged = mergeFlashes(mergeFlashes(new Map(), first), second);
    const afterFirstExpires = removeFlashes(merged, new Set(first.map(([, f]) => f.id)));
    expect(afterFirstExpires.get('unit-3')?.text).toBe('-2');
  });
});
