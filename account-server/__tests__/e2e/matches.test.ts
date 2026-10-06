import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../../src/container';

interface Session { token: string; account: { id: string } }

describe('résultats des parties et classement', () => {
  let app: FastifyInstance;
  const signup = async (username: string): Promise<Session> =>
    (await app.inject({ method: 'POST', url: '/api/accounts', payload: { username, password: 'motdepasse' } })).json<Session>();
  const report = (payload: object) =>
    app.inject({ method: 'POST', url: '/internal/matches', payload, headers: { 'x-internal-key': 'cle-interne' } });
  const me = async (session: Session) =>
    (await app.inject({ method: 'GET', url: '/api/accounts/me', headers: { authorization: `Bearer ${session.token}` } }))
      .json<{ rating: number; stats: Record<string, number> }>();

  beforeEach(() => {
    app = buildApp({ databasePath: ':memory:', jwtSecret: 'secret-de-test', internalKey: 'cle-interne' });
  });

  afterEach(() => app.close());

  it('met à jour Elo, statistiques et classement après les parties', async () => {
    const alice = await signup('alice');
    const bob = await signup('bob');
    await signup('sans_partie');

    const first = await report({ gameId: 'g1', mode: 'pvp', winnerId: alice.account.id, loserId: bob.account.id });
    expect(first.json()).toMatchObject({ recorded: true, ratings: [{ after: 1016 }, { after: 984 }] });
    await report({ gameId: 'g2', mode: 'ai', accountId: bob.account.id, won: true });

    expect(await me(alice)).toMatchObject({ rating: 1016, stats: { pvpWins: 1, pvpLosses: 0 } });
    expect(await me(bob)).toMatchObject({ rating: 984, stats: { pvpWins: 0, pvpLosses: 1, aiWins: 1 } });

    const leaderboard = await app.inject({ method: 'GET', url: '/api/accounts/leaderboard' });
    expect(leaderboard.json()).toEqual([
      { rank: 1, username: 'alice', rating: 1016, pvpWins: 1, pvpLosses: 0 },
      { rank: 2, username: 'bob', rating: 984, pvpWins: 0, pvpLosses: 1 },
    ]);
  });

  it('ne compte qu\'une fois un résultat renvoyé', async () => {
    const alice = await signup('alice');
    const bob = await signup('bob');
    const result = { gameId: 'g1', mode: 'pvp', winnerId: alice.account.id, loserId: bob.account.id };
    await report(result);
    expect((await report(result)).json()).toEqual({ recorded: false, ratings: [] });
    expect((await me(alice)).rating).toBe(1016);
  });

  it('n\'enregistre rien si un des comptes est inconnu', async () => {
    const alice = await signup('alice');
    const response = await report({ gameId: 'g1', mode: 'pvp', winnerId: alice.account.id, loserId: 'fantome' });
    expect(response.statusCode).toBe(404);
    expect((await me(alice)).rating).toBe(1000);
    // La partie n'a pas été marquée comme enregistrée : un nouvel envoi corrigé est accepté
    const bob = await signup('bob');
    expect((await report({ gameId: 'g1', mode: 'pvp', winnerId: alice.account.id, loserId: bob.account.id })).json()).toMatchObject({ recorded: true });
  });
});
