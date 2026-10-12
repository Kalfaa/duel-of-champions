import type { DatabaseSync } from 'node:sqlite';
import { Deck } from '../model/deck';

export interface IDeckRepository {
  /** Le deck du compte, ou null s'il n'existe pas ou appartient à un autre compte. */
  get(accountId: string, deckId: string): Promise<Deck | null>;
  /** Decks du compte, du plus récemment modifié au plus ancien. */
  listByAccount(accountId: string): Promise<Deck[]>;
  countByAccount(accountId: string): Promise<number>;
  /** Crée ou remplace le deck. */
  save(deck: Deck): Promise<void>;
  /** false si le deck n'existait pas. */
  delete(accountId: string, deckId: string): Promise<boolean>;
}

interface DeckRow {
  id: string;
  account_id: string;
  name: string;
  hero: string;
  cards: string;
  events: string;
  updated_at: string;
}

const toDeck = (row: DeckRow): Deck => new Deck({
  id: row.id,
  accountId: row.account_id,
  name: row.name,
  hero: row.hero,
  cards: JSON.parse(row.cards) as Record<string, number>,
  events: JSON.parse(row.events) as string[],
  updatedAt: new Date(row.updated_at),
});

export class SqliteDeckRepository implements IDeckRepository {
  constructor(private readonly db: DatabaseSync) {}

  async get(accountId: string, deckId: string): Promise<Deck | null> {
    const row = this.db.prepare('SELECT * FROM decks WHERE id = ? AND account_id = ?').get(deckId, accountId) as DeckRow | undefined;
    return row ? toDeck(row) : null;
  }

  async listByAccount(accountId: string): Promise<Deck[]> {
    const rows = this.db.prepare('SELECT * FROM decks WHERE account_id = ? ORDER BY updated_at DESC, id').all(accountId) as unknown as DeckRow[];
    return rows.map(toDeck);
  }

  async countByAccount(accountId: string): Promise<number> {
    const row = this.db.prepare('SELECT COUNT(*) AS n FROM decks WHERE account_id = ?').get(accountId) as { n: number };
    return row.n;
  }

  async save(deck: Deck): Promise<void> {
    this.db.prepare(`
      INSERT INTO decks (id, account_id, name, hero, cards, events, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT (id) DO UPDATE SET name = excluded.name, hero = excluded.hero, cards = excluded.cards,
        events = excluded.events, updated_at = excluded.updated_at
    `).run(deck.id, deck.accountId, deck.name, deck.hero, JSON.stringify(deck.cards), JSON.stringify(deck.events), deck.updatedAt.toISOString());
  }

  async delete(accountId: string, deckId: string): Promise<boolean> {
    return this.db.prepare('DELETE FROM decks WHERE id = ? AND account_id = ?').run(deckId, accountId).changes > 0;
  }
}
