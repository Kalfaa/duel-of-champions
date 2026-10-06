import { describe, expect, it } from 'vitest';
import { Game } from '../../../src/model/game';
import { InMemoryGameRepository } from '../../../src/repository/game-repository';

const makeGame = (id: string, playerId: string) => Game.createAgainstAi({ id, seed: 1, player: { id: playerId, deck: 'siegfried', accountId: `acc-${playerId}`, name: playerId } });

describe('InMemoryGameRepository', () => {
  it('sauvegarde et recharge une partie', async () => {
    const store = new Map<string, Game>();
    const repository = new InMemoryGameRepository(store);
    const game = makeGame('g1', 'alice');
    await repository.save(game);
    expect(store.get('g1')).toBe(game);
    expect(await repository.get('g1')).toBe(game);
    expect(await repository.get('inconnue')).toBeNull();
  });

  it('retrouve la partie d\'un joueur tant qu\'il ne l\'a pas quittée', async () => {
    const repository = new InMemoryGameRepository(new Map());
    const game = makeGame('g1', 'alice');
    await repository.save(makeGame('g2', 'bob'));
    await repository.save(game);
    expect(await repository.findByPlayer('alice')).toBe(game);
    game.leave(0);
    expect(await repository.findByPlayer('alice')).toBeNull();
  });

  it('supprime une partie', async () => {
    const store = new Map<string, Game>();
    const repository = new InMemoryGameRepository(store);
    await repository.save(makeGame('g1', 'alice'));
    await repository.delete('g1');
    expect(store.size).toBe(0);
  });
});
