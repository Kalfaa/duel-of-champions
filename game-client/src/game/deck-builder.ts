import type { CardView, Catalog, DeckDraft, DeckRules, EventView, FactionId, HeroSummary } from '../api/protocol';

/** Types de cartes affichables dans le catalogue. */
export type CardFilter = 'all' | CardView['type'];

/** Factions des héros, dans leur ordre d'apparition, avec leur nombre de héros. */
export function heroFactions(heroes: readonly HeroSummary[]): { id: FactionId; label: string; count: number }[] {
  const factions = new Map<FactionId, { id: FactionId; label: string; count: number }>();
  for (const h of heroes) {
    const entry = factions.get(h.faction) ?? { id: h.faction, label: h.factionLabel, count: 0 };
    entry.count++;
    factions.set(h.faction, entry);
  }
  return [...factions.values()];
}

export const emptyDraft = (hero: string): DeckDraft => ({ name: 'Nouveau deck', hero, cards: {}, events: [] });

const heroOf = (catalog: Catalog, hero: string): HeroSummary | undefined => catalog.heroes.find(h => h.id === hero);

/** La carte peut entrer dans un deck du héros : sorts de ses écoles, autres cartes de sa faction ou neutres. */
export function isAllowed(card: CardView, hero: HeroSummary): boolean {
  if (card.type === 'spell') return !!card.school && hero.hero.schools.includes(card.school);
  return card.faction === null || card.faction.id === hero.faction;
}

export const maxCopies = (card: CardView, rules: DeckRules): number =>
  (card.rarity === 'unique' ? rules.maxUniqueCopies : rules.maxCopies);

export const deckSize = (draft: Pick<DeckDraft, 'cards'>): number => Object.values(draft.cards).reduce((sum, n) => sum + n, 0);

/**
 * Cartes autorisées pour le héros, filtrées par type et par texte (nom, texte, école), triées par coût puis par nom.
 * Avec `factionOnly`, les créatures et fortunes neutres sont masquées (les sorts, sans faction, restent).
 */
export function availableCards(catalog: Catalog, hero: string, filter: CardFilter, search: string, factionOnly = false): CardView[] {
  const summary = heroOf(catalog, hero);
  if (!summary) return [];
  const needle = search.trim().toLowerCase();
  return catalog.cards
    .filter(c => isAllowed(c, summary))
    .filter(c => filter === 'all' || c.type === filter)
    .filter(c => !factionOnly || c.type === 'spell' || c.faction !== null)
    .filter(c => !needle || [c.name, c.text ?? '', c.school ?? ''].some(s => s.toLowerCase().includes(needle)))
    .sort((a, b) => a.cost - b.cost || a.name.localeCompare(b.name, 'fr'));
}

/** Événements filtrés par texte (nom ou effet), triés par nom. */
export function availableEvents(catalog: Catalog, search: string): EventView[] {
  const needle = search.trim().toLowerCase();
  return catalog.events
    .filter(e => !needle || [e.name, e.text].some(s => s.toLowerCase().includes(needle)))
    .sort((a, b) => a.name.localeCompare(b.name, 'fr'));
}

/** Ajoute un exemplaire, sauf si la carte ou le deck est au maximum. */
export function addCard(draft: DeckDraft, card: CardView, rules: DeckRules): DeckDraft {
  const count = draft.cards[card.id] ?? 0;
  if (count >= maxCopies(card, rules) || deckSize(draft) >= rules.maxCards) return draft;
  return { ...draft, cards: { ...draft.cards, [card.id]: count + 1 } };
}

export function removeCard(draft: DeckDraft, cardId: string): DeckDraft {
  const count = draft.cards[cardId] ?? 0;
  if (count === 0) return draft;
  const cards = { ...draft.cards };
  if (count === 1) delete cards[cardId];
  else cards[cardId] = count - 1;
  return { ...draft, cards };
}

/** Ajoute ou retire un événement ; on ne dépasse pas le nombre d'événements d'un deck. */
/** Ajoute un exemplaire de l'événement, sauf si l'événement ou le deck est au maximum. */
export function addEvent(draft: DeckDraft, eventId: string, rules: DeckRules): DeckDraft {
  const count = draft.events.filter(e => e === eventId).length;
  if (count >= rules.maxCopies || draft.events.length >= rules.events) return draft;
  return { ...draft, events: [...draft.events, eventId] };
}

/** Retire un exemplaire de l'événement. */
export function removeEvent(draft: DeckDraft, eventId: string): DeckDraft {
  const index = draft.events.lastIndexOf(eventId);
  if (index === -1) return draft;
  return { ...draft, events: draft.events.filter((_, i) => i !== index) };
}

/** Change de héros : les cartes qu'il ne peut pas utiliser sont retirées du deck. */
export function changeHero(draft: DeckDraft, hero: string, catalog: Catalog): DeckDraft {
  const summary = heroOf(catalog, hero);
  if (!summary) return draft;
  const byId = new Map(catalog.cards.map(c => [c.id, c]));
  const cards = Object.fromEntries(Object.entries(draft.cards).filter(([id]) => {
    const card = byId.get(id);
    return card && isAllowed(card, summary);
  }));
  return { ...draft, hero, cards };
}

/** Ce qui empêche de jouer le deck, d'après les règles (le serveur reste seul juge). */
export function draftProblems(draft: DeckDraft, rules: DeckRules): string[] {
  const problems: string[] = [];
  const size = deckSize(draft);
  if (size < rules.minCards || size > rules.maxCards) problems.push(`Le deck doit compter de ${rules.minCards} à ${rules.maxCards} cartes (${size} actuellement).`);
  if (draft.events.length !== rules.events) problems.push(`Le deck doit avoir ${rules.events} événements (${draft.events.length} actuellement).`);
  return problems;
}

/** Nombre de créatures, de sorts et de fortunes du deck (exemplaires compris). */
export function typeCounts(entries: readonly { card: CardView; count: number }[]): Record<CardView['type'], number> {
  const counts: Record<CardView['type'], number> = { creature: 0, spell: 0, fortune: 0 };
  for (const { card, count } of entries) counts[card.type] += count;
  return counts;
}

/** Cartes du deck, triées par coût puis par nom, avec leur nombre d'exemplaires. */
export function deckEntries(draft: DeckDraft, catalog: Catalog): { card: CardView; count: number }[] {
  const byId = new Map(catalog.cards.map(c => [c.id, c]));
  return Object.entries(draft.cards)
    .flatMap(([id, count]) => {
      const card = byId.get(id);
      return card ? [{ card, count }] : [];
    })
    .sort((a, b) => a.card.cost - b.card.cost || a.card.name.localeCompare(b.card.name, 'fr'));
}
