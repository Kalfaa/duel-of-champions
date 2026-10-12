import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { DeckStoreError, HttpDeckStore, type DeckContent, type JsonFetchFn } from '../../../src/integration/deck-store';

const content: DeckContent = { name: 'Marées', hero: 'kaiko', cards: { kappaShoya: 3 }, events: ['celebration'] };
const saved = { id: 'deck-1', updatedAt: '2026-10-10T00:00:00.000Z', ...content };

const reply = (status: number, body: unknown = null) => ({ ok: status < 300, status, json: async () => body });

describe('HttpDeckStore', () => {
  let fetchFn: Mock<JsonFetchFn>;
  let store: HttpDeckStore;

  beforeEach(() => {
    fetchFn = vi.fn<JsonFetchFn>(async () => reply(200, saved));
    store = new HttpDeckStore('http://comptes', 'cle-interne', fetchFn);
  });

  it('crée un deck avec la clé interne, sous le compte du joueur', async () => {
    fetchFn.mockResolvedValueOnce(reply(201, saved));
    await expect(store.create('acc 1', content)).resolves.toEqual(saved);
    expect(fetchFn).toHaveBeenCalledExactlyOnceWith('http://comptes/internal/accounts/acc%201/decks', {
      method: 'POST',
      headers: { 'x-internal-key': 'cle-interne', 'content-type': 'application/json' },
      body: JSON.stringify(content),
    });
  });

  it('liste, lit, modifie et supprime les decks', async () => {
    fetchFn.mockResolvedValueOnce(reply(200, [saved]));
    await expect(store.list('acc')).resolves.toEqual([saved]);
    await expect(store.get('acc', 'deck-1')).resolves.toEqual(saved);
    await expect(store.update('acc', 'deck-1', content)).resolves.toEqual(saved);
    fetchFn.mockResolvedValueOnce(reply(204));
    await expect(store.delete('acc', 'deck-1')).resolves.toBe(true);
    expect(fetchFn.mock.calls.map(([url, init]) => [init.method, url])).toEqual([
      ['GET', 'http://comptes/internal/accounts/acc/decks'],
      ['GET', 'http://comptes/internal/accounts/acc/decks/deck-1'],
      ['PUT', 'http://comptes/internal/accounts/acc/decks/deck-1'],
      ['DELETE', 'http://comptes/internal/accounts/acc/decks/deck-1'],
    ]);
  });

  it('traduit un deck absent par null ou false', async () => {
    fetchFn.mockResolvedValue(reply(404, { message: 'Ce deck n\'existe pas.' }));
    await expect(store.get('acc', 'x')).resolves.toBeNull();
    await expect(store.update('acc', 'x', content)).resolves.toBeNull();
    await expect(store.delete('acc', 'x')).resolves.toBe(false);
  });

  it('remonte le message d\'un refus et signale une panne', async () => {
    fetchFn.mockResolvedValueOnce(reply(400, { message: 'Vous avez déjà 50 decks.' }));
    await expect(store.create('acc', content)).rejects.toThrow(new DeckStoreError('Vous avez déjà 50 decks.', 400));
    fetchFn.mockRejectedValueOnce(new Error('ECONNREFUSED'));
    await expect(store.list('acc')).rejects.toThrow(DeckStoreError);
  });
});
