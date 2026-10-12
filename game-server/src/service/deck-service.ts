import { allCards } from '../model/cards';
import { assertStorableDeckList, DECK_RULES, deckProblems, type DeckList } from '../model/deck-list';
import { GameRuleError } from '../model/errors';
import { allEvents } from '../model/events';
import { toCardView, toEventView, toHeroSummary, toHeroView, type CardView, type EventView, type HeroSummary, type HeroView } from '../model/game-view';
import { allHeroes, findHero } from '../model/heroes';
import { DeckStoreError, type DeckContent, type IDeckStore, type StoredDeck } from '../integration/deck-store';
import { DeckNotFoundError, DeckRejectedError, DeckStorageUnavailableError } from './errors';

/** Tout ce qu'il faut pour construire un deck : héros, cartes, événements et règles. */
export interface Catalog {
  heroes: HeroSummary[];
  cards: CardView[];
  events: EventView[];
  rules: typeof DECK_RULES;
}

/** Deck d'un joueur, tel qu'il le construit. */
export interface DeckDraft extends DeckList {
  name: string;
}

/** Deck enregistré, avec ce qui l'empêche d'être joué (liste vide : jouable). */
export interface SavedDeck extends DeckDraft {
  id: string;
  updatedAt: string;
  problems: string[];
  /** Le héros du deck, pour l'afficher (null s'il n'existe plus). */
  heroView: HeroView | null;
}

export interface IDeckService {
  catalog(): Catalog;
  list(accountId: string): Promise<SavedDeck[]>;
  create(accountId: string, draft: DeckDraft): Promise<SavedDeck>;
  update(accountId: string, deckId: string, draft: DeckDraft): Promise<SavedDeck>;
  delete(accountId: string, deckId: string): Promise<void>;
  /** Composition d'un deck du joueur pour lancer une partie ; lève une erreur s'il n'est pas jouable. */
  playable(accountId: string, deckId: string): Promise<DeckList>;
}

const toContent = (draft: DeckDraft): DeckContent =>
  ({ name: draft.name, hero: draft.hero, cards: { ...draft.cards }, events: [...draft.events] });

/** Un deck stocké dont le héros n'existe plus ne peut pas être joué : il est signalé comme tel. */
function toSavedDeck(stored: StoredDeck): SavedDeck {
  const list: DeckList = { hero: stored.hero, cards: stored.cards, events: stored.events };
  const hero = findHero(stored.hero);
  return {
    id: stored.id, name: stored.name, updatedAt: stored.updatedAt, ...list,
    problems: deckProblems(list), heroView: hero ? toHeroView(hero) : null,
  };
}

/** Traduit un échec du stockage : refus (4xx) à montrer au joueur, ou indisponibilité. */
async function fromStore<T>(call: Promise<T>): Promise<T> {
  try {
    return await call;
  } catch (error) {
    if (!(error instanceof DeckStoreError)) throw error;
    if (error.status !== null && error.status < 500) throw new DeckRejectedError(error.message);
    throw new DeckStorageUnavailableError();
  }
}

export class DeckService implements IDeckService {
  constructor(private readonly store: IDeckStore) {}

  catalog(): Catalog {
    return {
      heroes: allHeroes().map(toHeroSummary),
      cards: allCards().filter(c => c.type !== 'creature' || !c.token).map(toCardView),
      events: allEvents().map(e => toEventView(e.id, false)),
      rules: DECK_RULES,
    };
  }

  async list(accountId: string): Promise<SavedDeck[]> {
    return (await fromStore(this.store.list(accountId))).map(toSavedDeck);
  }

  async create(accountId: string, draft: DeckDraft): Promise<SavedDeck> {
    assertStorableDeckList(draft);
    return toSavedDeck(await fromStore(this.store.create(accountId, toContent(draft))));
  }

  async update(accountId: string, deckId: string, draft: DeckDraft): Promise<SavedDeck> {
    assertStorableDeckList(draft);
    const found = await fromStore(this.store.update(accountId, deckId, toContent(draft)));
    if (!found) throw new DeckNotFoundError();
    return toSavedDeck(found);
  }

  async delete(accountId: string, deckId: string): Promise<void> {
    if (!await fromStore(this.store.delete(accountId, deckId))) throw new DeckNotFoundError();
  }

  async playable(accountId: string, deckId: string): Promise<DeckList> {
    const found = await fromStore(this.store.get(accountId, deckId));
    if (!found) throw new DeckNotFoundError();
    const deck = toSavedDeck(found);
    const [problem] = deck.problems;
    if (problem) throw new GameRuleError(`Le deck « ${deck.name} » n'est pas jouable. ${problem}`);
    return { hero: deck.hero, cards: deck.cards, events: deck.events };
  }
}
