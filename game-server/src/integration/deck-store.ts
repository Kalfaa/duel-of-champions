import { z } from 'zod';

/** Contenu d'un deck tel que stocké par le serveur de comptes, qui ne connaît pas les cartes. */
export interface DeckContent {
  name: string;
  hero: string;
  cards: Record<string, number>;
  events: string[];
}

export interface StoredDeck extends DeckContent {
  id: string;
  updatedAt: string;
}

export interface IDeckStore {
  list(accountId: string): Promise<StoredDeck[]>;
  /** Le deck du compte, ou null s'il n'existe pas (ou appartient à un autre compte). */
  get(accountId: string, deckId: string): Promise<StoredDeck | null>;
  create(accountId: string, content: DeckContent): Promise<StoredDeck>;
  /** null si le deck n'existe pas. */
  update(accountId: string, deckId: string, content: DeckContent): Promise<StoredDeck | null>;
  /** false si le deck n'existait pas. */
  delete(accountId: string, deckId: string): Promise<boolean>;
}

/** Le serveur de comptes est injoignable ou a refusé la requête. */
export class DeckStoreError extends Error {
  constructor(message: string, readonly status: number | null = null) {
    super(message);
    this.name = 'DeckStoreError';
  }
}

export type JsonFetchFn = (url: string, init: { method: string; headers: Record<string, string>; body?: string }) =>
  Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>;

const storedDeckSchema = z.object({
  id: z.string(),
  name: z.string(),
  hero: z.string(),
  cards: z.record(z.string(), z.number()),
  events: z.array(z.string()),
  updatedAt: z.string(),
});

/** Decks des joueurs, enregistrés par le serveur de comptes (routes internes). */
export class HttpDeckStore implements IDeckStore {
  constructor(
    private readonly baseUrl: string,
    private readonly internalKey: string,
    private readonly fetchFn: JsonFetchFn,
  ) {}

  async list(accountId: string): Promise<StoredDeck[]> {
    return z.array(storedDeckSchema).parse(await this.request('GET', this.path(accountId)));
  }

  async get(accountId: string, deckId: string): Promise<StoredDeck | null> {
    const body = await this.request('GET', this.path(accountId, deckId), undefined, true);
    return body === null ? null : storedDeckSchema.parse(body);
  }

  async create(accountId: string, content: DeckContent): Promise<StoredDeck> {
    return storedDeckSchema.parse(await this.request('POST', this.path(accountId), content));
  }

  async update(accountId: string, deckId: string, content: DeckContent): Promise<StoredDeck | null> {
    const body = await this.request('PUT', this.path(accountId, deckId), content, true);
    return body === null ? null : storedDeckSchema.parse(body);
  }

  async delete(accountId: string, deckId: string): Promise<boolean> {
    return (await this.request('DELETE', this.path(accountId, deckId), undefined, true)) !== null;
  }

  private path(accountId: string, deckId?: string): string {
    const base = `${this.baseUrl}/internal/accounts/${encodeURIComponent(accountId)}/decks`;
    return deckId === undefined ? base : `${base}/${encodeURIComponent(deckId)}`;
  }

  /** Corps de la réponse ; null pour un 404 quand `notFoundIsNull`. */
  private async request(method: string, url: string, content?: DeckContent, notFoundIsNull = false): Promise<unknown> {
    let response: Awaited<ReturnType<JsonFetchFn>>;
    try {
      response = await this.fetchFn(url, {
        method,
        headers: { 'x-internal-key': this.internalKey, ...(content ? { 'content-type': 'application/json' } : {}) },
        ...(content ? { body: JSON.stringify(content) } : {}),
      });
    } catch {
      throw new DeckStoreError('Le serveur de comptes est injoignable : réessayez dans un instant.');
    }
    if (response.status === 404 && notFoundIsNull) return null;
    if (response.status === 204) return {};
    const body: unknown = await response.json().catch(() => null);
    if (!response.ok) {
      const message = typeof body === 'object' && body !== null && 'message' in body && typeof body.message === 'string'
        ? body.message : 'Le serveur de comptes a refusé la requête.';
      throw new DeckStoreError(message, response.status);
    }
    return body;
  }
}
