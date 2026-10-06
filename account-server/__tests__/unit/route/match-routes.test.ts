import Fastify, { type FastifyInstance } from 'fastify';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { registerErrorHandler } from '../../../src/route/errors';
import { registerMatchRoutes } from '../../../src/route/match-routes';
import { ConflictingMatchError } from '../../../src/service/errors';
import type { IMatchService } from '../../../src/service/match-service';

describe('route des résultats de parties', () => {
  let app: FastifyInstance;
  let service: { record: ReturnType<typeof vi.fn> };
  const post = (payload: unknown, key: string | null = 'cle-interne') => app.inject({
    method: 'POST', url: '/internal/matches', payload: payload as object, headers: key === null ? {} : { 'x-internal-key': key },
  });

  beforeEach(() => {
    service = { record: vi.fn(async () => ({ recorded: true, ratings: [{ accountId: 'a', before: 1000, after: 1016 }] })) };
    app = Fastify();
    registerErrorHandler(app);
    registerMatchRoutes(app, service as unknown as IMatchService, 'cle-interne');
  });

  it('enregistre le résultat envoyé par le serveur de jeu', async () => {
    const result = { gameId: 'g1', mode: 'pvp', winnerId: 'a', loserId: 'b' };
    const response = await post(result);
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ recorded: true, ratings: [{ accountId: 'a', before: 1000, after: 1016 }] });
    expect(service.record).toHaveBeenCalledWith(result);
  });

  it.each([[null], ['mauvaise-cle']])('refuse une requête sans la bonne clé interne (%s)', async key => {
    const response = await post({ gameId: 'g1', mode: 'ai', accountId: 'a', won: true }, key);
    expect(response.statusCode).toBe(403);
    expect(service.record).not.toHaveBeenCalled();
  });

  it('refuse un résultat mal formé', async () => {
    expect((await post({ gameId: 'g1', mode: 'ai', accountId: 'a' })).statusCode).toBe(400);
    expect((await post({ gameId: 'g1', mode: 'tournoi' })).statusCode).toBe(400);
  });

  it('répond 409 à un résultat contradictoire', async () => {
    service.record.mockRejectedValueOnce(new ConflictingMatchError('g1'));
    expect((await post({ gameId: 'g1', mode: 'ai', accountId: 'a', won: true })).statusCode).toBe(409);
  });
});
