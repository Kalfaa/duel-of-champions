import { describe, expect, it } from 'vitest';
import { GameRuleError } from '../../../src/model/errors';
import { MatchmakingQueue } from '../../../src/model/matchmaking-queue';

describe('MatchmakingQueue', () => {
  it('met en attente le premier joueur puis forme une paire avec le suivant', () => {
    const queue = new MatchmakingQueue();
    expect(queue.join({ playerId: 'a', faction: 'havre' })).toBeNull();
    expect(queue.has('a')).toBe(true);
    expect(queue.join({ playerId: 'b', faction: 'inferno' })).toEqual([
      { playerId: 'a', faction: 'havre' },
      { playerId: 'b', faction: 'inferno' },
    ]);
    expect(queue.has('a')).toBe(false);
  });

  it('refuse qu\'un joueur rejoigne deux fois la file', () => {
    const queue = new MatchmakingQueue();
    queue.join({ playerId: 'a', faction: 'havre' });
    expect(() => queue.join({ playerId: 'a', faction: 'havre' })).toThrow(GameRuleError);
  });

  it('retire un joueur de la file', () => {
    const queue = new MatchmakingQueue();
    queue.join({ playerId: 'a', faction: 'havre' });
    expect(queue.leave('a')).toBe(true);
    expect(queue.leave('a')).toBe(false);
    expect(queue.join({ playerId: 'b', faction: 'havre' })).toBeNull();
  });
});
