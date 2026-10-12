import { describe, expect, it } from 'vitest';
import type { Catalog, DeckRules, HeroSummary } from '../../../src/api/protocol';
import {
  addCard, availableCards, availableEvents, heroFactions, changeHero, deckEntries, deckSize, draftProblems, emptyDraft, removeCard, addEvent, removeEvent, typeCounts,
} from '../../../src/game/deck-builder';
import { card, gameEvent, player } from '../fixtures';

const RULES: DeckRules = { minCards: 50, maxCards: 200, maxCopies: 4, maxUniqueCopies: 1, events: 8 };

const hero = (id: string, faction: HeroSummary['faction'], schools: string[]): HeroSummary => ({
  id, faction, factionLabel: faction, factionIcon: '', hero: { ...player().hero, schools },
});

const squire = card();
const unique = card({ id: 'archange', name: 'Archange', rarity: 'unique', cost: 7 });
const neutral = card({ id: 'loup', name: 'Loup', faction: null, cost: 1 });
const demon = card({ id: 'diablotin', name: 'Diablotin', faction: { id: 'inferno', label: 'Inferno', icon: '🔥' } });
const heal = card({ id: 'soin', name: 'Soin', type: 'spell', faction: null, school: 'Lumière', cost: 1, text: 'Soigne 3 blessures.' });
const fireball = card({ id: 'bouleFeu', name: 'Boule de feu', type: 'spell', faction: null, school: 'Feu', cost: 3 });

const catalog: Catalog = {
  heroes: [hero('siegfried', 'havre', ['Lumière']), hero('kalAzaar', 'inferno', ['Feu'])],
  cards: [squire, unique, neutral, demon, heal, fireball],
  events: [gameEvent()],
  rules: RULES,
};

describe('availableCards', () => {
  it('propose les cartes de la faction, les neutres et les sorts des écoles du héros, triés par coût', () => {
    expect(availableCards(catalog, 'siegfried', 'all', '').map(c => c.id)).toEqual(['loup', 'soin', 'ecuyerElite', 'archange']);
    expect(availableCards(catalog, 'kalAzaar', 'all', '').map(c => c.id)).toEqual(['loup', 'diablotin', 'bouleFeu']);
  });

  it('masque les créatures et fortunes neutres sur demande, mais garde les sorts', () => {
    expect(availableCards(catalog, 'siegfried', 'all', '', true).map(c => c.id)).toEqual(['soin', 'ecuyerElite', 'archange']);
  });

  it('filtre par type et par texte', () => {
    expect(availableCards(catalog, 'siegfried', 'spell', '').map(c => c.id)).toEqual(['soin']);
    expect(availableCards(catalog, 'siegfried', 'all', 'blessures').map(c => c.id)).toEqual(['soin']);
    expect(availableCards(catalog, 'siegfried', 'all', 'ÉCUYER').map(c => c.id)).toEqual(['ecuyerElite']);
  });
});

describe('addCard / removeCard', () => {
  it('ajoute jusqu\'à 4 exemplaires, 1 pour une carte unique', () => {
    let draft = emptyDraft('siegfried');
    for (let i = 0; i < 6; i++) draft = addCard(addCard(draft, squire, RULES), unique, RULES);
    expect(draft.cards).toEqual({ ecuyerElite: 4, archange: 1 });
  });

  it('ne dépasse pas la taille maximale du deck', () => {
    const full = { ...emptyDraft('siegfried'), cards: { autre: 200 } };
    expect(addCard(full, squire, RULES)).toBe(full);
  });

  it('retire un exemplaire, puis la carte', () => {
    const draft = { ...emptyDraft('siegfried'), cards: { ecuyerElite: 2 } };
    expect(removeCard(draft, 'ecuyerElite').cards).toEqual({ ecuyerElite: 1 });
    expect(removeCard(removeCard(draft, 'ecuyerElite'), 'ecuyerElite').cards).toEqual({});
    expect(removeCard(draft, 'absente')).toBe(draft);
  });
});

describe('addEvent / removeEvent', () => {
  it('ajoute jusqu\'à 4 exemplaires d\'un événement, sans dépasser 8 événements', () => {
    let draft = emptyDraft('siegfried');
    for (let i = 0; i < 5; i++) draft = addEvent(draft, 'celebration', RULES);
    expect(draft.events).toEqual(Array(4).fill('celebration'));
    const full = { ...draft, events: [...draft.events, 'a', 'b', 'c', 'd'] };
    expect(addEvent(full, 'e', RULES)).toBe(full);
  });

  it('retire un exemplaire à la fois', () => {
    const draft = { ...emptyDraft('siegfried'), events: ['celebration', 'hailStorm', 'celebration'] };
    expect(removeEvent(draft, 'celebration').events).toEqual(['celebration', 'hailStorm']);
    expect(removeEvent(draft, 'absent')).toBe(draft);
  });
});

describe('changeHero', () => {
  it('retire les cartes que le nouveau héros ne peut pas utiliser', () => {
    const draft = { ...emptyDraft('siegfried'), cards: { ecuyerElite: 2, loup: 3, soin: 1 } };
    const changed = changeHero(draft, 'kalAzaar', catalog);
    expect(changed.hero).toBe('kalAzaar');
    expect(changed.cards).toEqual({ loup: 3 });
  });
});

describe('draftProblems / deckEntries', () => {
  it('signale un deck trop petit ou sans ses 8 événements', () => {
    const draft = { ...emptyDraft('siegfried'), cards: { ecuyerElite: 4 } };
    expect(deckSize(draft)).toBe(4);
    expect(draftProblems(draft, RULES)).toEqual([
      'Le deck doit compter de 50 à 200 cartes (4 actuellement).',
      'Le deck doit avoir 8 événements (0 actuellement).',
    ]);
    expect(draftProblems({ ...draft, cards: { ecuyerElite: 50 }, events: ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'] }, RULES)).toEqual([]);
  });

  it('liste les cartes du deck par coût', () => {
    const draft = { ...emptyDraft('siegfried'), cards: { archange: 1, loup: 2, inconnue: 1 } };
    expect(deckEntries(draft, catalog).map(e => [e.card.id, e.count])).toEqual([['loup', 2], ['archange', 1]]);
  });
});

describe('heroFactions', () => {
  it('liste les factions des héros dans leur ordre, avec leur nombre de héros', () => {
    expect(heroFactions([...catalog.heroes, hero('alia', 'havre', ['Lumière'])])).toEqual([
      { id: 'havre', label: 'havre', count: 2 }, { id: 'inferno', label: 'inferno', count: 1 },
    ]);
  });
});

describe('availableEvents', () => {
  it('filtre les événements par nom ou par effet', () => {
    const withEvents = { ...catalog, events: [gameEvent(), gameEvent({ id: 'hailStorm', name: 'Tempête de grêle', text: 'Inflige 1 dégât à chaque créature.' })] };
    expect(availableEvents(withEvents, '').map(e => e.id)).toEqual(['celebration', 'hailStorm']);
    expect(availableEvents(withEvents, 'dégât').map(e => e.id)).toEqual(['hailStorm']);
  });
});

describe('typeCounts', () => {
  it('compte les créatures, sorts et fortunes du deck, exemplaires compris', () => {
    const draft = { ...emptyDraft('siegfried'), cards: { ecuyerElite: 3, loup: 2, soin: 4 } };
    expect(typeCounts(deckEntries(draft, catalog))).toEqual({ creature: 5, spell: 4, fortune: 0 });
  });
});
