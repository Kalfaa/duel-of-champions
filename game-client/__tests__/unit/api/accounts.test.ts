import { afterEach, describe, expect, it, vi } from 'vitest';
import { AccountApiError, fetchLeaderboard, fetchMe, login, register } from '../../../src/api/accounts';

const respond = (status: number, body: unknown) =>
  vi.fn(async () => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } }));

describe('API des comptes', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('inscrit et connecte un joueur', async () => {
    const fetchMock = respond(201, { token: 'jeton', account: { username: 'Halospart1' } });
    vi.stubGlobal('fetch', fetchMock);
    expect(await register('Halospart1', 'motdepasse')).toEqual({ token: 'jeton', account: { username: 'Halospart1' } });
    expect(fetchMock).toHaveBeenCalledWith('/api/accounts', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: '{"username":"Halospart1","password":"motdepasse"}',
    });
    await login('Halospart1', 'motdepasse');
    expect(fetchMock).toHaveBeenLastCalledWith('/api/accounts/login', expect.objectContaining({ method: 'POST' }));
  });

  it('présente le jeton pour lire son compte', async () => {
    const fetchMock = respond(200, { username: 'Halospart1' });
    vi.stubGlobal('fetch', fetchMock);
    await fetchMe('jeton');
    expect(fetchMock).toHaveBeenCalledWith('/api/accounts/me', { headers: { authorization: 'Bearer jeton' } });
    await fetchLeaderboard(5);
    expect(fetchMock).toHaveBeenLastCalledWith('/api/accounts/leaderboard?limit=5', {});
  });

  it('remonte le message et le code d\'erreur du serveur', async () => {
    vi.stubGlobal('fetch', respond(409, { message: 'Le pseudo « Halospart1 » est déjà pris.' }));
    const error = await register('Halospart1', 'motdepasse').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(AccountApiError);
    expect(error).toMatchObject({ status: 409, message: 'Le pseudo « Halospart1 » est déjà pris.' });
  });

  it('signale un serveur injoignable', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('fetch failed'); }));
    await expect(fetchMe('jeton')).rejects.toMatchObject({ status: 0, message: 'Impossible de joindre le serveur de comptes.' });
  });
});
