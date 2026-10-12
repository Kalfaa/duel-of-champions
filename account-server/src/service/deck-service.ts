import { Deck, type DeckContent } from '../model/deck';
import type { IAccountRepository } from '../repository/account-repository';
import type { IDeckRepository } from '../repository/deck-repository';
import type { ITransactionRunner } from '../repository/transaction';
import { AccountNotFoundError, DeckNotFoundError } from './errors';
import type { IClock, IIdGenerator } from './ports';

export interface IDeckService {
  list(accountId: string): Promise<Deck[]>;
  get(accountId: string, deckId: string): Promise<Deck>;
  create(accountId: string, content: DeckContent): Promise<Deck>;
  update(accountId: string, deckId: string, content: DeckContent): Promise<Deck>;
  delete(accountId: string, deckId: string): Promise<void>;
}

/** Decks des joueurs, enregistrés pour le compte du joueur à la demande du serveur de jeu. */
export class DeckService implements IDeckService {
  constructor(
    private readonly accounts: IAccountRepository,
    private readonly decks: IDeckRepository,
    private readonly transactions: ITransactionRunner,
    private readonly ids: IIdGenerator,
    private readonly clock: IClock,
  ) {}

  async list(accountId: string): Promise<Deck[]> {
    return this.decks.listByAccount(accountId);
  }

  async get(accountId: string, deckId: string): Promise<Deck> {
    const deck = await this.decks.get(accountId, deckId);
    if (!deck) throw new DeckNotFoundError();
    return deck;
  }

  async create(accountId: string, content: DeckContent): Promise<Deck> {
    return this.transactions.run(async () => {
      if (!await this.accounts.get(accountId)) throw new AccountNotFoundError(accountId);
      const deck = Deck.create({
        id: this.ids.next(), accountId, content, existingDecks: await this.decks.countByAccount(accountId), now: this.clock.now(),
      });
      await this.decks.save(deck);
      return deck;
    });
  }

  async update(accountId: string, deckId: string, content: DeckContent): Promise<Deck> {
    const deck = await this.get(accountId, deckId);
    deck.edit(content, this.clock.now());
    await this.decks.save(deck);
    return deck;
  }

  async delete(accountId: string, deckId: string): Promise<void> {
    if (!await this.decks.delete(accountId, deckId)) throw new DeckNotFoundError();
  }
}
