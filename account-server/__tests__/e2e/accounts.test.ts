import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../../src/container';

describe('comptes via HTTP', () => {
  let app: FastifyInstance;
  const signup = (username: string, password = 'motdepasse') =>
    app.inject({ method: 'POST', url: '/api/accounts', payload: { username, password } });

  beforeEach(() => {
    app = buildApp({ databasePath: ':memory:', jwtSecret: 'secret-de-test', internalKey: 'cle-interne' });
  });

  afterEach(() => app.close());

  it('inscrit un joueur, le reconnecte, et l\'identifie grâce à son jeton', async () => {
    const created = await signup('Halospart1');
    expect(created.statusCode).toBe(201);
    const { token, account } = created.json<{ token: string; account: { id: string; rating: number } }>();
    expect(account.rating).toBe(1000);

    const login = await app.inject({ method: 'POST', url: '/api/accounts/login', payload: { username: 'halospart1', password: 'motdepasse' } });
    expect(login.statusCode).toBe(200);
    expect(login.json<{ account: { id: string } }>().account.id).toBe(account.id);

    const me = await app.inject({ method: 'GET', url: '/api/accounts/me', headers: { authorization: `Bearer ${token}` } });
    expect(me.statusCode).toBe(200);
    expect(me.json()).toMatchObject({ id: account.id, username: 'Halospart1' });
  });

  it('refuse un pseudo déjà pris et un mauvais mot de passe', async () => {
    await signup('Halospart1');
    expect((await signup('HALOSPART1')).statusCode).toBe(409);
    const login = await app.inject({ method: 'POST', url: '/api/accounts/login', payload: { username: 'Halospart1', password: 'mauvais-mdp' } });
    expect(login.statusCode).toBe(401);
  });

  it('refuse un jeton signé avec un autre secret', async () => {
    const other = buildApp({ databasePath: ':memory:', jwtSecret: 'autre-secret', internalKey: 'k' });
    const { token } = (await other.inject({ method: 'POST', url: '/api/accounts', payload: { username: 'Halospart1', password: 'motdepasse' } }))
      .json<{ token: string }>();
    await other.close();
    await signup('Halospart1');
    const me = await app.inject({ method: 'GET', url: '/api/accounts/me', headers: { authorization: `Bearer ${token}` } });
    expect(me.statusCode).toBe(401);
  });
});
