import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Account } from '../../../src/model/account';
import { SelfMatchError } from '../../../src/model/errors';
import type { RecordedMatch } from '../../../src/model/match';
import type { IAccountRepository } from '../../../src/repository/account-repository';
import type { IMatchRepository } from '../../../src/repository/match-repository';
import type { ITransactionRunner } from '../../../src/repository/transaction';
import { AccountNotFoundError, ConflictingMatchError } from '../../../src/service/errors';
import { MatchService } from '../../../src/service/match-service';

const NOW = new Date('2026-10-05T12:00:00Z');
const register = (id: string) => Account.register({ id, username: `joueur_${id}`, passwordHash: 'h', createdAt: NOW });

describe('MatchService', () => {
  let stored: Map<string, Account>;
  let recorded: Map<string, RecordedMatch>;
  let accounts: { get: ReturnType<typeof vi.fn>; save: ReturnType<typeof vi.fn> };
  let matches: { get: ReturnType<typeof vi.fn>; save: ReturnType<typeof vi.fn> };
  let transactions: ITransactionRunner & { run: ReturnType<typeof vi.fn> };
  let service: MatchService;

  beforeEach(() => {
    stored = new Map([['a', register('a')], ['b', register('b')]]);
    recorded = new Map();
    accounts = { get: vi.fn(async (id: string) => stored.get(id) ?? null), save: vi.fn(async () => {}) };
    matches = {
      get: vi.fn(async (id: string) => recorded.get(id) ?? null),
      save: vi.fn(async (m: RecordedMatch) => { recorded.set(m.result.gameId, m); }),
    };
    transactions = { run: vi.fn(work => work()) } as ITransactionRunner & { run: ReturnType<typeof vi.fn> };
    service = new MatchService(accounts as unknown as IAccountRepository, matches as unknown as IMatchRepository, transactions, { now: () => NOW });
  });

  it('met à jour les classements après une partie classée, dans une transaction', async () => {
    const outcome = await service.record({ gameId: 'g1', mode: 'pvp', winnerId: 'a', loserId: 'b' });
    expect(outcome).toEqual({
      recorded: true,
      ratings: [{ accountId: 'a', before: 1000, after: 1016 }, { accountId: 'b', before: 1000, after: 984 }],
    });
    expect(accounts.save).toHaveBeenCalledWith(stored.get('a'));
    expect(accounts.save).toHaveBeenCalledWith(stored.get('b'));
    expect(matches.save).toHaveBeenCalledWith({ result: { gameId: 'g1', mode: 'pvp', winnerId: 'a', loserId: 'b' }, recordedAt: NOW });
    expect(transactions.run).toHaveBeenCalledTimes(1);
  });

  it('compte une partie contre l\'IA dans les statistiques, sans classement', async () => {
    const outcome = await service.record({ gameId: 'g1', mode: 'ai', accountId: 'a', won: false });
    expect(outcome).toEqual({ recorded: true, ratings: [] });
    expect(stored.get('a')!.stats.aiLosses).toBe(1);
    expect(stored.get('a')!.rating).toBe(1000);
    expect(accounts.save).toHaveBeenCalledWith(stored.get('a'));
  });

  it('ne compte qu\'une fois un résultat renvoyé', async () => {
    const result = { gameId: 'g1', mode: 'pvp', winnerId: 'a', loserId: 'b' } as const;
    await service.record(result);
    accounts.save.mockClear();
    expect(await service.record({ ...result })).toEqual({ recorded: false, ratings: [] });
    expect(accounts.save).not.toHaveBeenCalled();
    expect(stored.get('a')!.rating).toBe(1016);
  });

  it('refuse un autre résultat pour une partie déjà enregistrée', async () => {
    await service.record({ gameId: 'g1', mode: 'pvp', winnerId: 'a', loserId: 'b' });
    await expect(service.record({ gameId: 'g1', mode: 'pvp', winnerId: 'b', loserId: 'a' })).rejects.toThrow(ConflictingMatchError);
  });

  it('refuse une partie d\'un compte inconnu, sans rien enregistrer', async () => {
    await expect(service.record({ gameId: 'g1', mode: 'pvp', winnerId: 'a', loserId: 'fantome' })).rejects.toThrow(AccountNotFoundError);
    expect(matches.save).not.toHaveBeenCalled();
  });

  it('refuse une partie classée contre soi-même', async () => {
    await expect(service.record({ gameId: 'g1', mode: 'pvp', winnerId: 'a', loserId: 'a' })).rejects.toThrow(SelfMatchError);
  });
});
