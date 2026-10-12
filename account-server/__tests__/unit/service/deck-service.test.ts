import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Account } from '../../../src/model/account';
import { Deck, type DeckContent } from '../../../src/model/deck';
import { TooManyDecksError } from '../../../src/model/errors';
import type { IAccountRepository } from '../../../src/repository/account-repository';
import type { IDeckRepository } from '../../../src/repository/deck-repository';
import type { ITransactionRunner } from '../../../src/repository/transaction';
import { DeckService } from '../../../src/service/deck-service';
import { AccountNotFoundError, DeckNotFoundError } from '../../../src/service/errors';

const NOW = new Date('2026-10-10T12:00:00Z');
const content: DeckContent = { name: 'Marées', hero: 'kaiko', cards: { kappaShoya: 3 }, events: [] };

describe('DeckService (comptes)', () => {
  let decks: { [K in keyof IDeckRepository]: ReturnType<typeof vi.fn> };
  let accounts: { get: ReturnType<typeof vi.fn> };
  let transactions: { run: ReturnType<typeof vi.fn> };
  let service: DeckService;

  beforeEach(() => {
    accounts = { get: vi.fn(async (id: string) => (id === 'acc' ? Account.register({ id, username: 'alice', passwordHash: 'h', createdAt: NOW }) : null)) };
    decks = {
      get: vi.fn(async () => null), listByAccount: vi.fn(async () => []), countByAccount: vi.fn(async () => 0),
      save: vi.fn(async () => {}), delete: vi.fn(async () => true),
    };
    transactions = { run: vi.fn(work => work()) };
    service = new DeckService(
      accounts as unknown as IAccountRepository, decks as unknown as IDeckRepository, transactions as unknown as ITransactionRunner,
      { next: () => 'd1' }, { now: () => NOW },
    );
  });

  it('crée un deck pour un compte existant, dans une transaction', async () => {
    const deck = await service.create('acc', content);
    expect(deck).toMatchObject({ id: 'd1', accountId: 'acc', name: 'Marées', updatedAt: NOW });
    expect(decks.save).toHaveBeenCalledWith(deck);
    expect(transactions.run).toHaveBeenCalled();
  });

  it('refuse un compte inconnu ou qui a trop de decks', async () => {
    await expect(service.create('inconnu', content)).rejects.toThrow(AccountNotFoundError);
    decks.countByAccount.mockResolvedValueOnce(50);
    await expect(service.create('acc', content)).rejects.toThrow(TooManyDecksError);
    expect(decks.save).not.toHaveBeenCalled();
  });

  it('modifie un deck du compte', async () => {
    decks.get.mockResolvedValueOnce(Deck.create({ id: 'd1', accountId: 'acc', content, existingDecks: 0, now: new Date(0) }));
    const deck = await service.update('acc', 'd1', { ...content, name: 'Tempêtes' });
    expect(deck).toMatchObject({ name: 'Tempêtes', updatedAt: NOW });
    expect(decks.save).toHaveBeenCalledWith(deck);
  });

  it('signale un deck absent', async () => {
    await expect(service.get('acc', 'x')).rejects.toThrow(DeckNotFoundError);
    await expect(service.update('acc', 'x', content)).rejects.toThrow(DeckNotFoundError);
    decks.delete.mockResolvedValueOnce(false);
    await expect(service.delete('acc', 'x')).rejects.toThrow(DeckNotFoundError);
  });
});
