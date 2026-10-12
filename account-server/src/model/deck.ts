import { InvalidDeckNameError, TooManyDecksError } from './errors';

/** Composition d'un deck ; le serveur de jeu, qui connaît les cartes, en vérifie la validité. */
export interface DeckContent {
  name: string;
  hero: string;
  cards: Record<string, number>;
  events: string[];
}

export interface DeckState extends DeckContent {
  id: string;
  accountId: string;
  updatedAt: Date;
}

const MAX_NAME_LENGTH = 40;

/** Nombre maximal de decks par compte. */
export const MAX_DECKS_PER_ACCOUNT = 50;

/** Deck construit par un joueur. */
export class Deck {
  readonly id: string;
  readonly accountId: string;
  private state: DeckContent & { updatedAt: Date };

  constructor(state: DeckState) {
    this.id = state.id;
    this.accountId = state.accountId;
    this.state = { name: state.name, hero: state.hero, cards: { ...state.cards }, events: [...state.events], updatedAt: state.updatedAt };
  }

  /** Nouveau deck : le compte ne doit pas avoir atteint son nombre maximal de decks. */
  static create(opts: { id: string; accountId: string; content: DeckContent; existingDecks: number; now: Date }): Deck {
    if (opts.existingDecks >= MAX_DECKS_PER_ACCOUNT) throw new TooManyDecksError(MAX_DECKS_PER_ACCOUNT);
    const name = Deck.validName(opts.content.name);
    return new Deck({ ...opts.content, name, id: opts.id, accountId: opts.accountId, updatedAt: opts.now });
  }

  /** Remplace le contenu du deck. */
  edit(content: DeckContent, now: Date): void {
    this.state = { name: Deck.validName(content.name), hero: content.hero, cards: { ...content.cards }, events: [...content.events], updatedAt: now };
  }

  private static validName(name: string): string {
    const trimmed = name.trim();
    if (!trimmed || trimmed.length > MAX_NAME_LENGTH) throw new InvalidDeckNameError(MAX_NAME_LENGTH);
    return trimmed;
  }

  get name(): string { return this.state.name; }
  get hero(): string { return this.state.hero; }
  get cards(): Record<string, number> { return { ...this.state.cards }; }
  get events(): string[] { return [...this.state.events]; }
  get updatedAt(): Date { return this.state.updatedAt; }
}
