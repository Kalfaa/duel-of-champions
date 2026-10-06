import { describe, expect, it } from 'vitest';
import { getCard } from '../../../src/model/cards';
import { DECKS } from '../../../src/model/decks';
import { getEvent } from '../../../src/model/events';
import { DECK_IDS } from '../../../src/model/types';

const cardsOf = (id: (typeof DECK_IDS)[number]) => Object.keys(DECKS[id].cards).map(getCard);

describe('DECKS', () => {
  it.each(DECK_IDS)('le deck %s apporte 8 événements existants', id => {
    const { events } = DECKS[id];
    expect(events).toHaveLength(8);
    events.forEach(e => expect(() => getEvent(e)).not.toThrow());
  });

  it.each(['ishuma', 'kaiko', 'takana', 'yukiko', 'kat', 'alia', 'adarMalik', 'dhamiria', 'noboru', 'zardoc'] as const)('le deck %s compte 30 cartes, au plus un exemplaire de chaque carte unique', id => {
    const { cards } = DECKS[id];
    expect(Object.values(cards).reduce((sum, n) => sum + n, 0)).toBe(30);
    for (const [cardId, count] of Object.entries(cards)) {
      if (getCard(cardId).rarity === 'unique') expect(count).toBe(1);
    }
  });

  it.each(DECK_IDS)('le deck %s ne contient que des cartes de sa faction ou neutres', id => {
    for (const card of cardsOf(id)) expect([DECKS[id].faction, null]).toContain(card.faction);
  });

  it('les sorts n\'ont pas de faction mais une école de magie', () => {
    for (const card of DECK_IDS.flatMap(cardsOf).filter(c => c.type === 'spell')) {
      expect(card).toMatchObject({ faction: null, school: expect.any(String) });
    }
  });

  it('les créatures des decks appartiennent à une faction ou sont neutres', () => {
    const creatures = DECK_IDS.flatMap(cardsOf).filter(c => c.type === 'creature');
    expect(creatures.length).toBeGreaterThan(0);
  });

  it('les héros d\'Ascension du vide ont leurs PV et caractéristiques officiels', () => {
    expect(DECKS.kaiko.hero).toMatchObject({ hp: 18, m: 0, g: 2, d: 1 });
    expect(DECKS.yukiko.hero).toMatchObject({ hp: 20, m: 1, g: 1, d: 2, power: null });
    expect(DECKS.takana.hero.passive?.honorAttack).toBe(1);
  });
});
