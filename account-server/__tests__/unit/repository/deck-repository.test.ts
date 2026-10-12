import type { DatabaseSync } from 'node:sqlite';
import { beforeEach, describe, expect, it } from 'vitest';
import { Account } from '../../../src/model/account';
import { Deck } from '../../../src/model/deck';
import { SqliteAccountRepository } from '../../../src/repository/account-repository';
import { openDatabase } from '../../../src/repository/database';
import { SqliteDeckRepository } from '../../../src/repository/deck-repository';

const deck = (id: string, accountId: string, at: string) => Deck.create({
  id, accountId, existingDecks: 0, now: new Date(at),
  content: { name: `Deck ${id}`, hero: 'kaiko', cards: { kappaShoya: 3, pretresseCorail: 2 }, events: ['celebration', 'dayOfFortune'] },
});

describe('SqliteDeckRepository', () => {
  let db: DatabaseSync;
  let repository: SqliteDeckRepository;

  beforeEach(async () => {
    db = openDatabase(':memory:');
    repository = new SqliteDeckRepository(db);
    const accounts = new SqliteAccountRepository(db);
    for (const id of ['a', 'b']) {
      await accounts.create(Account.register({ id, username: `joueur_${id}`, passwordHash: 'h', createdAt: new Date() }));
    }
  });

  it('enregistre puis recharge un deck à l\'identique', async () => {
    await repository.save(deck('d1', 'a', '2026-10-10T00:00:00Z'));
    const loaded = await repository.get('a', 'd1');
    expect(loaded).toBeInstanceOf(Deck);
    expect(loaded).toMatchObject({ id: 'd1', accountId: 'a', name: 'Deck d1', hero: 'kaiko', cards: { kappaShoya: 3, pretresseCorail: 2 }, events: ['celebration', 'dayOfFortune'] });
    expect(loaded!.updatedAt.toISOString()).toBe('2026-10-10T00:00:00.000Z');
  });

  it('ne donne pas accès au deck d\'un autre compte', async () => {
    await repository.save(deck('d1', 'a', '2026-10-10T00:00:00Z'));
    expect(await repository.get('b', 'd1')).toBeNull();
    expect(await repository.delete('b', 'd1')).toBe(false);
    expect(await repository.get('a', 'd1')).not.toBeNull();
  });

  it('liste et compte les decks d\'un compte, les plus récents d\'abord', async () => {
    await repository.save(deck('d1', 'a', '2026-10-10T00:00:00Z'));
    await repository.save(deck('d2', 'a', '2026-10-11T00:00:00Z'));
    await repository.save(deck('d3', 'b', '2026-10-12T00:00:00Z'));
    expect((await repository.listByAccount('a')).map(d => d.id)).toEqual(['d2', 'd1']);
    expect(await repository.countByAccount('a')).toBe(2);
  });

  it('remplace un deck modifié et supprime un deck', async () => {
    const saved = deck('d1', 'a', '2026-10-10T00:00:00Z');
    await repository.save(saved);
    saved.edit({ name: 'Nouveau', hero: 'kat', cards: {}, events: [] }, new Date('2026-10-11T00:00:00Z'));
    await repository.save(saved);
    expect(await repository.get('a', 'd1')).toMatchObject({ name: 'Nouveau', hero: 'kat', cards: {} });
    expect(await repository.delete('a', 'd1')).toBe(true);
    expect(await repository.countByAccount('a')).toBe(0);
  });
});
