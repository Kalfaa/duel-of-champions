import type { Account, LeaderboardEntry, Session } from './protocol';

/** Erreur renvoyée par le serveur de comptes, avec son message lisible par le joueur. */
export class AccountApiError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
    this.name = 'AccountApiError';
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`/api/accounts${path}`, init);
  } catch {
    throw new AccountApiError(0, 'Impossible de joindre le serveur de comptes.');
  }
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const message = body && typeof body === 'object' && 'message' in body && typeof body.message === 'string'
      ? body.message : `Le serveur de comptes a répondu ${response.status}.`;
    throw new AccountApiError(response.status, message);
  }
  return body as T;
}

const postJson = (body: unknown): RequestInit => ({ method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });

export const register = (username: string, password: string): Promise<Session> => request('', postJson({ username, password }));

export const login = (username: string, password: string): Promise<Session> => request('/login', postJson({ username, password }));

export const fetchMe = (token: string): Promise<Account> => request('/me', { headers: { authorization: `Bearer ${token}` } });

export const fetchLeaderboard = (limit = 10): Promise<LeaderboardEntry[]> => request(`/leaderboard?limit=${limit}`);
