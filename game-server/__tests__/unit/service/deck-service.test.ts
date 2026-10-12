import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { DeckStoreError, type DeckContent, type IDeckStore, type StoredDeck } from '../../../src/integration/deck-store';
import { allHeroes } from '../../../src/model/heroes';
import { DeckService } from '../../../src/service/deck-service';
import { DeckNotFoundError, DeckRejectedError, DeckStorageUnavailableError } from '../../../src/service/errors';
import { legalDeck } from '../model/helpers';

type MockStore = { [K in keyof IDeckStore]: Mock<IDeckStore[K]> };

const stored = (content: DeckContent, id = 'deck-1'): StoredDeck => ({ id, updatedAt: '2026-10-10T00:00:00.000Z', ...content });

describe('DeckService', () => {
  let store: MockStore;
  let service: DeckService;

  beforeEach(() => {
    store = {
      list: vi.fn(async () => []),
      get: vi.fn(async () => null),
      create: vi.fn(async (_accountId: string, content: DeckContent) => stored(content)),
      update: vi.fn(async (_accountId: string, deckId: string, content: DeckContent) => stored(content, deckId)),
      delete: vi.fn(async () => true),
    };
    service = new DeckService(store);
  });

  it('propose tous les héros, toutes les cartes (sauf les jetons), tous les événements et les règles', () => {
    const catalog = service.catalog();
    expect(catalog.heroes).toHaveLength(allHeroes().length);
    expect(catalog.cards.map(c => c.id)).not.toContain('larveCouveuseMelee');
    expect(catalog.cards.length).toBeGreaterThan(200);
    expect(catalog.events.every(e => !e.used)).toBe(true);
    expect(catalog.rules).toMatchObject({ minCards: 50, maxCards: 200, maxCopies: 4, events: 8 });
  });

  it('enregistre un deck incomplet et signale ce qui l\'empêche d\'être joué', async () => {
    const deck = await service.create('acc', { name: 'Brouillon', hero: 'kaiko', cards: { kappaShoya: 2 }, events: [] });
    expect(store.create).toHaveBeenCalledWith('acc', { name: 'Brouillon', hero: 'kaiko', cards: { kappaShoya: 2 }, events: [] });
    expect(deck).toMatchObject({ id: 'deck-1', name: 'Brouillon', hero: 'kaiko' });
    expect(deck.problems).toEqual([
      'Le deck doit compter de 50 à 200 cartes (2 actuellement).',
      'Le deck doit avoir 8 événements (0 actuellement).',
    ]);
  });

  it('refuse d\'enregistrer une carte inconnue', async () => {
    await expect(service.create('acc', { name: 'X', hero: 'kaiko', cards: { inconnue: 1 }, events: [] })).rejects.toThrow('Carte inconnue');
    expect(store.create).not.toHaveBeenCalled();
  });

  it('modifie et supprime un deck du joueur, ou signale qu\'il n\'existe pas', async () => {
    await expect(service.update('acc', 'deck-2', { name: 'Y', hero: 'kat', cards: {}, events: [] })).resolves.toMatchObject({ id: 'deck-2' });
    store.update.mockResolvedValueOnce(null);
    await expect(service.update('acc', 'autre', { name: 'Y', hero: 'kat', cards: {}, events: [] })).rejects.toThrow(DeckNotFoundError);
    await expect(service.delete('acc', 'deck-2')).resolves.toBeUndefined();
    store.delete.mockResolvedValueOnce(false);
    await expect(service.delete('acc', 'autre')).rejects.toThrow(DeckNotFoundError);
  });

  it('signale un deck stocké dont le héros n\'existe plus', async () => {
    store.list.mockResolvedValueOnce([stored({ name: 'Vieux', hero: 'disparu', cards: {}, events: [] })]);
    const [deck] = await service.list('acc');
    expect(deck?.problems).toEqual(['Héros inconnu : disparu.']);
  });

  it('donne la composition d\'un deck jouable, et refuse un deck incomplet ou absent', async () => {
    const list = legalDeck('kaiko');
    store.get.mockResolvedValueOnce(stored({ name: 'Marées', ...list, cards: { ...list.cards }, events: [...list.events] }));
    await expect(service.playable('acc', 'deck-1')).resolves.toEqual({ hero: 'kaiko', cards: list.cards, events: list.events });

    store.get.mockResolvedValueOnce(stored({ name: 'Brouillon', hero: 'kaiko', cards: { kappaShoya: 2 }, events: [] }));
    await expect(service.playable('acc', 'deck-1')).rejects.toThrow('Le deck « Brouillon » n\'est pas jouable.');
    await expect(service.playable('acc', 'absent')).rejects.toThrow(DeckNotFoundError);
  });

  it('distingue un refus du serveur de comptes d\'une indisponibilité', async () => {
    store.create.mockRejectedValueOnce(new DeckStoreError('Vous avez déjà 50 decks.', 400));
    await expect(service.create('acc', { name: 'X', hero: 'kat', cards: {}, events: [] })).rejects.toThrow(new DeckRejectedError('Vous avez déjà 50 decks.'));
    store.list.mockRejectedValueOnce(new DeckStoreError('injoignable'));
    await expect(service.list('acc')).rejects.toThrow(DeckStorageUnavailableError);
  });
});
