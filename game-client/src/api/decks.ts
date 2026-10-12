import type { Catalog, DeckDraft, DeckSummary, SavedDeck } from './protocol';

/** Erreur renvoyée par le serveur de jeu, avec son message lisible par le joueur. */
export class DeckApiError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
    this.name = 'DeckApiError';
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, init);
  } catch {
    throw new DeckApiError(0, 'Impossible de joindre le serveur de jeu.');
  }
  if (response.status === 204) return undefined as T;
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const message = body && typeof body === 'object' && 'message' in body && typeof body.message === 'string'
      ? body.message : `Le serveur a répondu ${response.status}.`;
    throw new DeckApiError(response.status, message);
  }
  return body as T;
}

const authorized = (token: string, init: RequestInit = {}, body?: unknown): RequestInit => ({
  ...init,
  headers: { authorization: `Bearer ${token}`, ...(body === undefined ? {} : { 'content-type': 'application/json' }) },
  ...(body === undefined ? {} : { body: JSON.stringify(body) }),
});

export const fetchDecks = (): Promise<DeckSummary[]> => request('/api/decks');

export const fetchCatalog = (): Promise<Catalog> => request('/api/catalog');

export const fetchMyDecks = (token: string): Promise<SavedDeck[]> => request('/api/my-decks', authorized(token));

/** Crée le deck, ou le remplace s'il a déjà un identifiant. */
export const saveDeck = (token: string, draft: DeckDraft, id?: string): Promise<SavedDeck> =>
  id === undefined
    ? request('/api/my-decks', authorized(token, { method: 'POST' }, draft))
    : request(`/api/my-decks/${encodeURIComponent(id)}`, authorized(token, { method: 'PUT' }, draft));

export const deleteDeck = (token: string, id: string): Promise<void> =>
  request(`/api/my-decks/${encodeURIComponent(id)}`, authorized(token, { method: 'DELETE' }));
