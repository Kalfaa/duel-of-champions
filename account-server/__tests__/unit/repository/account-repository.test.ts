import type { DatabaseSync } from 'node:sqlite';
import { beforeEach, describe, expect, it } from 'vitest';
import { Account } from '../../../src/model/account';
import { UsernameTakenError } from '../../../src/model/errors';
import { SqliteAccountRepository } from '../../../src/repository/account-repository';
import { openDatabase } from '../../../src/repository/database';

const register = (id: string, username: string) =>
  Account.register({ id, username, passwordHash: `hash-${id}`, createdAt: new Date('2026-03-04T05:06:07Z') });

describe('SqliteAccountRepository', () => {
  let db: DatabaseSync;
  let repository: SqliteAccountRepository;

  beforeEach(() => {
    db = openDatabase(':memory:');
    repository = new SqliteAccountRepository(db);
  });

  it('crée puis recharge un compte à l\'identique', async () => {
    await repository.create(register('a', 'Halospart1'));
    const loaded = await repository.get('a');
    expect(loaded).toBeInstanceOf(Account);
    expect(loaded).toMatchObject({ id: 'a', username: 'Halospart1', passwordHash: 'hash-a', rating: 1000 });
    expect(loaded!.createdAt.toISOString()).toBe('2026-03-04T05:06:07.000Z');
    expect(await repository.get('inconnu')).toBeNull();
  });

  it('retrouve un compte par pseudo sans tenir compte de la casse', async () => {
    await repository.create(register('a', 'MoarSpartan'));
    expect((await repository.findByUsername('moarspartan'))?.id).toBe('a');
    expect(await repository.findByUsername('autre')).toBeNull();
  });

  it('refuse un pseudo déjà pris, même avec une autre casse', async () => {
    await repository.create(register('a', 'MoarSpartan'));
    await expect(repository.create(register('b', 'MOARSPARTAN'))).rejects.toThrow(UsernameTakenError);
  });

  it('sauvegarde classement et statistiques', async () => {
    const winner = register('w', 'gagnant');
    const loser = register('l', 'perdant');
    await repository.create(winner);
    await repository.create(loser);
    Account.settlePvp(winner, loser);
    winner.recordAiGame(false);
    await repository.save(winner);
    const loaded = await repository.get('w');
    expect(loaded!.rating).toBe(1016);
    expect(loaded!.stats).toEqual({ pvpWins: 1, pvpLosses: 0, aiWins: 0, aiLosses: 1 });
  });

  it('classe les joueurs ayant disputé une partie classée, du meilleur au moins bon', async () => {
    const [a, b, c, idle] = [register('a', 'alice'), register('b', 'bob'), register('c', 'carole'), register('d', 'dora')];
    for (const account of [a, b, c, idle]) await repository.create(account);
    Account.settlePvp(b, a);
    Account.settlePvp(b, c); // bob 1031, carole 985, alice 984
    for (const account of [a, b, c]) await repository.save(account);

    const top = await repository.findTopRated(10);
    expect(top.map(t => t.username)).toEqual(['bob', 'carole', 'alice']);
    expect((await repository.findTopRated(1)).map(t => t.username)).toEqual(['bob']);
  });
});
