import { describe, expect, it } from 'vitest';
import { GameRuleError } from '../../../src/model/errors';
import { MatchmakingQueue, type QueueTicket } from '../../../src/model/matchmaking-queue';
import type { DeckId } from '../../../src/model/types';

const ticket = (playerId: string, deck: DeckId = 'siegfried', accountId = `acc-${playerId}`): QueueTicket =>
  ({ playerId, accountId, name: playerId, deck });

describe('MatchmakingQueue', () => {
  it('met en attente le premier joueur puis forme une paire avec le suivant', () => {
    const queue = new MatchmakingQueue();
    expect(queue.join(ticket('a'))).toBeNull();
    expect(queue.has('a')).toBe(true);
    expect(queue.join(ticket('b', 'kalAzaar'))).toEqual([ticket('a'), ticket('b', 'kalAzaar')]);
    expect(queue.has('a')).toBe(false);
  });

  it('refuse qu\'un joueur rejoigne deux fois la file', () => {
    const queue = new MatchmakingQueue();
    queue.join(ticket('a'));
    expect(() => queue.join(ticket('a'))).toThrow(GameRuleError);
  });

  it('retire un joueur de la file', () => {
    const queue = new MatchmakingQueue();
    queue.join(ticket('a'));
    expect(queue.leave('a')).toBe(true);
    expect(queue.leave('a')).toBe(false);
    expect(queue.join(ticket('b'))).toBeNull();
  });

  it('n\'apparie jamais deux connexions d\'un même compte', () => {
    const queue = new MatchmakingQueue();
    expect(queue.join(ticket('onglet1', 'siegfried', 'acc-alice'))).toBeNull();
    expect(queue.join(ticket('onglet2', 'kalAzaar', 'acc-alice'))).toBeNull();
    // Un autre compte est apparié avec la plus ancienne connexion en attente
    expect(queue.join(ticket('bob'))).toEqual([ticket('onglet1', 'siegfried', 'acc-alice'), ticket('bob')]);
    expect(queue.has('onglet2')).toBe(true);
  });
});
