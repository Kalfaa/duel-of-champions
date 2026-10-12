import { describe, expect, it } from 'vitest';
import { allCards, getCard } from '../../../src/model/cards';
import { assertStorableDeckList, cardRefusal, deckProblems, deckSize, presetDeckList } from '../../../src/model/deck-list';
import { legalDeck } from './helpers';

describe('deckProblems', () => {
  it('accepte un deck de 50 cartes de la faction et des écoles du héros, avec 8 événements', () => {
    const list = legalDeck('kaiko');
    expect(deckSize(list)).toBe(50);
    expect(deckProblems(list)).toEqual([]);
    expect(deckProblems(legalDeck('kaiko', 200))).toEqual([]);
  });

  it('exige de 50 à 200 cartes', () => {
    expect(deckProblems(presetDeckList('kaiko'))).toEqual(['Le deck doit compter de 50 à 200 cartes (30 actuellement).']);
  });

  it('limite chaque carte à 4 exemplaires, et une carte unique à 1', () => {
    const list = legalDeck('kaiko');
    const unique = allCards().find(c => c.rarity === 'unique' && !cardRefusal('kaiko', c))!;
    const common = Object.keys(list.cards).find(id => getCard(id).rarity !== 'unique')!;
    const problems = deckProblems({ ...list, cards: { ...list.cards, [common]: 5, [unique.id]: 2 } });
    expect(problems).toContain(`${getCard(common).name} : 4 exemplaires au plus.`);
    expect(problems).toContain(`${unique.name} : 1 exemplaire au plus.`);
  });

  it('refuse les créatures et fortunes d\'une autre faction, mais accepte les neutres', () => {
    expect(cardRefusal('kaiko', getCard('ecuyerElite'))).toBe('Écuyer d\'élite : carte d\'une autre faction.');
    const neutral = allCards().find(c => c.type === 'creature' && c.faction === null)!;
    expect(cardRefusal('kaiko', neutral)).toBeNull();
  });

  it('refuse les sorts d\'une école que le héros n\'utilise pas', () => {
    expect(cardRefusal('kaiko', getCard('ventPorteur'))).toBeNull();
    expect(cardRefusal('kaiko', getCard('negationMagie'))).toBe('Négation de la magie : sort d\'une école de magie que Kaiko, invocatrice des profondeurs n\'utilise pas.');
  });

  it('exige 8 événements, dont 4 exemplaires au plus du même', () => {
    const list = legalDeck('kaiko');
    expect(deckProblems({ ...list, events: list.events.slice(0, 7) })).toEqual(['Le deck doit avoir 8 événements (7 actuellement).']);
    const others = list.events.filter(id => id !== 'celebration');
    expect(deckProblems({ ...list, events: [...Array(4).fill('celebration'), ...others.slice(0, 4)] })).toEqual([]);
    expect(deckProblems({ ...list, events: [...Array(5).fill('celebration'), ...others.slice(0, 3)] })).toEqual(['Fête : 4 exemplaires au plus.']);
  });
});

describe('assertStorableDeckList', () => {
  it('accepte un deck incomplet', () => {
    expect(() => assertStorableDeckList({ hero: 'kaiko', cards: { kappaShoya: 2 }, events: [] })).not.toThrow();
  });

  it('refuse les cartes et événements inconnus, et les decks trop grands', () => {
    expect(() => assertStorableDeckList({ hero: 'kaiko', cards: { inconnue: 1 }, events: [] })).toThrow('Carte inconnue : inconnue.');
    expect(() => assertStorableDeckList({ hero: 'kaiko', cards: {}, events: ['inconnu'] })).toThrow('Événement inconnu : inconnu.');
    expect(() => assertStorableDeckList({ hero: 'kaiko', cards: { kappaShoya: 201 }, events: [] })).toThrow('au plus 200 cartes');
  });
});
