import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../../src/container';

interface Session { token: string; account: { id: string } }

describe('decks des joueurs', () => {
  let app: FastifyInstance;
  const signup = async (username: string): Promise<Session> =>
    (await app.inject({ method: 'POST', url: '/api/accounts', payload: { username, password: 'motdepasse' } })).json<Session>();
  const call = (method: 'GET' | 'POST' | 'PUT' | 'DELETE', url: string, payload?: object) =>
    app.inject({ method, url, headers: { 'x-internal-key': 'cle-interne' }, ...(payload ? { payload } : {}) });
  const content = { name: 'Marées', hero: 'kaiko', cards: { kappaShoya: 3 }, events: ['celebration'] };

  beforeEach(() => {
    app = buildApp({ databasePath: ':memory:', jwtSecret: 'secret-de-test', internalKey: 'cle-interne' });
  });

  afterEach(() => app.close());

  it('crée, modifie, liste et supprime les decks d\'un compte', async () => {
    const alice = await signup('alice');
    const base = `/internal/accounts/${alice.account.id}/decks`;
    const created = await call('POST', base, content);
    expect(created.statusCode).toBe(201);
    const { id } = created.json<{ id: string }>();

    await call('PUT', `${base}/${id}`, { ...content, name: 'Tempêtes' });
    expect((await call('GET', base)).json()).toEqual([expect.objectContaining({ id, name: 'Tempêtes', hero: 'kaiko', cards: { kappaShoya: 3 } })]);

    expect((await call('DELETE', `${base}/${id}`)).statusCode).toBe(204);
    expect((await call('GET', `${base}/${id}`)).statusCode).toBe(404);
  });

  it('isole les decks de chaque compte et refuse un compte inconnu', async () => {
    const alice = await signup('alice');
    const bob = await signup('bob');
    const { id } = (await call('POST', `/internal/accounts/${alice.account.id}/decks`, content)).json<{ id: string }>();
    expect((await call('GET', `/internal/accounts/${bob.account.id}/decks/${id}`)).statusCode).toBe(404);
    expect((await call('GET', `/internal/accounts/${bob.account.id}/decks`)).json()).toEqual([]);
    expect((await call('POST', '/internal/accounts/inconnu/decks', content)).statusCode).toBe(404);
  });
});
