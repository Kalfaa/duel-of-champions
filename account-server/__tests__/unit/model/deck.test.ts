import { describe, expect, it } from 'vitest';
import { Deck, MAX_DECKS_PER_ACCOUNT, type DeckContent } from '../../../src/model/deck';
import { InvalidDeckNameError, TooManyDecksError } from '../../../src/model/errors';

const NOW = new Date('2026-10-10T12:00:00Z');
const content: DeckContent = { name: '  Marées  ', hero: 'kaiko', cards: { kappaShoya: 3 }, events: ['celebration'] };

describe('Deck', () => {
  it('crée un deck au nom nettoyé', () => {
    const deck = Deck.create({ id: 'd1', accountId: 'acc', content, existingDecks: 0, now: NOW });
    expect(deck).toMatchObject({ id: 'd1', accountId: 'acc', name: 'Marées', hero: 'kaiko', cards: { kappaShoya: 3 }, events: ['celebration'], updatedAt: NOW });
  });

  it('refuse un nom vide ou trop long', () => {
    for (const name of ['   ', 'x'.repeat(41)]) {
      expect(() => Deck.create({ id: 'd1', accountId: 'acc', content: { ...content, name }, existingDecks: 0, now: NOW })).toThrow(InvalidDeckNameError);
    }
  });

  it(`limite un compte à ${MAX_DECKS_PER_ACCOUNT} decks`, () => {
    expect(() => Deck.create({ id: 'd1', accountId: 'acc', content, existingDecks: MAX_DECKS_PER_ACCOUNT, now: NOW })).toThrow(TooManyDecksError);
  });

  it('remplace son contenu et sa date de modification', () => {
    const deck = Deck.create({ id: 'd1', accountId: 'acc', content, existingDecks: 0, now: NOW });
    const later = new Date('2026-10-11T00:00:00Z');
    deck.edit({ name: 'Tempêtes', hero: 'kat', cards: {}, events: [] }, later);
    expect(deck).toMatchObject({ name: 'Tempêtes', hero: 'kat', cards: {}, events: [], updatedAt: later });
    expect(() => deck.edit({ ...content, name: '' }, later)).toThrow(InvalidDeckNameError);
  });

  it('ne laisse pas modifier ses cartes de l\'extérieur', () => {
    const deck = Deck.create({ id: 'd1', accountId: 'acc', content, existingDecks: 0, now: NOW });
    deck.cards.kappaShoya = 99;
    deck.events.push('autre');
    expect(deck.cards).toEqual({ kappaShoya: 3 });
    expect(deck.events).toEqual(['celebration']);
  });
});
