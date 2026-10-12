import { findCard, type Card } from './cards';
import { DECKS } from './decks';
import { GameRuleError } from './errors';
import { findEvent } from './events';
import { findHero, getHero } from './heroes';
import type { DeckId } from './types';

/** Composition d'un deck : un héros (désigné par son deck d'origine), ses cartes et ses événements. */
export interface DeckList {
  /** Identifiant du héros (voir heroes.ts). */
  hero: string;
  /** Nombre d'exemplaires de chaque carte. */
  cards: Readonly<Record<string, number>>;
  events: readonly string[];
}

/** Règles de construction d'un deck créé par un joueur. */
export const DECK_RULES = {
  minCards: 50,
  maxCards: 200,
  /** Exemplaires d'une même carte ou d'un même événement ; une carte unique n'en a qu'un. */
  maxCopies: 4,
  maxUniqueCopies: 1,
  events: 8,
} as const;

/** Composition d'un des decks prédéfinis. */
export function presetDeckList(id: DeckId): DeckList {
  const { hero, cards, events } = DECKS[id];
  return { hero, cards, events };
}

export const isHeroId = (id: string): boolean => findHero(id) !== undefined;

/** Pourquoi la carte ne peut pas entrer dans un deck de ce héros (null si elle le peut). */
export function cardRefusal(heroId: string, card: Card): string | null {
  if (card.type === 'creature' && card.token) return `${card.name} : jeton, il ne peut pas entrer dans un deck.`;
  const hero = getHero(heroId);
  const { faction } = hero;
  if (card.type === 'spell') {
    return card.school && hero.schools.includes(card.school) ? null : `${card.name} : sort d'une école de magie que ${hero.name} n'utilise pas.`;
  }
  return card.faction === null || card.faction === faction ? null : `${card.name} : carte d'une autre faction.`;
}

/** Nombre maximal d'exemplaires de la carte dans un deck. */
export const maxCopiesOf = (card: Card): number => (card.rarity === 'unique' ? DECK_RULES.maxUniqueCopies : DECK_RULES.maxCopies);

export const deckSize = (list: Pick<DeckList, 'cards'>): number => Object.values(list.cards).reduce((sum, n) => sum + n, 0);

/**
 * Problèmes qui empêchent de jouer le deck, à corriger par le joueur (liste vide : deck valide).
 * Un deck incomplet peut être enregistré, mais pas joué.
 */
export function deckProblems(list: DeckList): string[] {
  if (!isHeroId(list.hero)) return [`Héros inconnu : ${list.hero}.`];
  const problems: string[] = [];
  const size = deckSize(list);
  if (size < DECK_RULES.minCards || size > DECK_RULES.maxCards) {
    problems.push(`Le deck doit compter de ${DECK_RULES.minCards} à ${DECK_RULES.maxCards} cartes (${size} actuellement).`);
  }
  for (const [id, count] of Object.entries(list.cards)) {
    const card = findCard(id);
    if (!card) {
      problems.push(`Carte inconnue : ${id}.`);
      continue;
    }
    const refusal = cardRefusal(list.hero, card);
    if (refusal) problems.push(refusal);
    const max = maxCopiesOf(card);
    if (count > max) problems.push(`${card.name} : ${max} exemplaire${max > 1 ? 's' : ''} au plus.`);
  }
  if (list.events.length !== DECK_RULES.events) {
    problems.push(`Le deck doit avoir ${DECK_RULES.events} événements (${list.events.length} actuellement).`);
  }
  for (const id of new Set(list.events)) {
    const event = findEvent(id);
    if (!event) {
      problems.push(`Événement inconnu : ${id}.`);
      continue;
    }
    const count = list.events.filter(e => e === id).length;
    if (count > DECK_RULES.maxCopies) problems.push(`${event.name} : ${DECK_RULES.maxCopies} exemplaires au plus.`);
  }
  return problems;
}

/** Un deck enregistré ne référence que des cartes et événements existants, en nombre raisonnable. */
export function assertStorableDeckList(list: DeckList): void {
  if (!isHeroId(list.hero)) throw new GameRuleError(`Héros inconnu : ${list.hero}.`);
  const unknownCard = Object.keys(list.cards).find(id => !findCard(id));
  if (unknownCard) throw new GameRuleError(`Carte inconnue : ${unknownCard}.`);
  const unknownEvent = list.events.find(id => !findEvent(id));
  if (unknownEvent) throw new GameRuleError(`Événement inconnu : ${unknownEvent}.`);
  if (deckSize(list) > DECK_RULES.maxCards) throw new GameRuleError(`Un deck compte au plus ${DECK_RULES.maxCards} cartes.`);
  if (list.events.length > DECK_RULES.events) throw new GameRuleError(`Un deck a au plus ${DECK_RULES.events} événements.`);
}
