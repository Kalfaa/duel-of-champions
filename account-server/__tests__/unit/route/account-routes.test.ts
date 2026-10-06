import Fastify, { type FastifyInstance } from 'fastify';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Account } from '../../../src/model/account';
import { InvalidUsernameError, UsernameTakenError } from '../../../src/model/errors';
import { registerAccountRoutes } from '../../../src/route/account-routes';
import { registerErrorHandler } from '../../../src/route/errors';
import type { IAccountService } from '../../../src/service/account-service';
import { InvalidCredentialsError, UnauthenticatedError } from '../../../src/service/errors';

const account = Account.register({ id: 'a1', username: 'Halospart1', passwordHash: 'secret-hash', createdAt: new Date('2026-10-05T12:00:00Z') });
const accountJson = {
  id: 'a1', username: 'Halospart1', rating: 1000,
  stats: { pvpWins: 0, pvpLosses: 0, aiWins: 0, aiLosses: 0 }, createdAt: '2026-10-05T12:00:00.000Z',
};

describe('routes des comptes', () => {
  let app: FastifyInstance;
  let service: { [K in keyof IAccountService]: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    service = {
      register: vi.fn(async () => ({ token: 'jeton', account })),
      login: vi.fn(async () => ({ token: 'jeton', account })),
      authenticate: vi.fn(async () => account),
      leaderboard: vi.fn(async () => [account]),
    };
    app = Fastify();
    registerErrorHandler(app);
    registerAccountRoutes(app, service as unknown as IAccountService);
  });

  it('POST /api/accounts inscrit le joueur et renvoie sa session, sans le hachage du mot de passe', async () => {
    const response = await app.inject({ method: 'POST', url: '/api/accounts', payload: { username: ' Halospart1 ', password: 'motdepasse' } });
    expect(response.statusCode).toBe(201);
    expect(response.json()).toEqual({ token: 'jeton', account: accountJson });
    expect(response.body).not.toContain('secret-hash');
    expect(service.register).toHaveBeenCalledWith('Halospart1', 'motdepasse');
  });

  it.each([
    [{ username: 'x' }, 'Mot de passe manquant.'],
    [{ username: 'Halospart1', password: 'court' }, 'Le mot de passe doit faire au moins 6 caractères.'],
    [{ password: 'motdepasse' }, 'Pseudo manquant.'],
  ])('refuse le corps %j', async (payload, message) => {
    const response = await app.inject({ method: 'POST', url: '/api/accounts', payload });
    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({ message });
    expect(service.register).not.toHaveBeenCalled();
  });

  it('traduit les erreurs métier en codes HTTP', async () => {
    service.register.mockRejectedValueOnce(new UsernameTakenError('Halospart1'));
    const taken = await app.inject({ method: 'POST', url: '/api/accounts', payload: { username: 'Halospart1', password: 'motdepasse' } });
    expect(taken.statusCode).toBe(409);
    expect(taken.json()).toEqual({ message: 'Le pseudo « Halospart1 » est déjà pris.' });

    service.register.mockRejectedValueOnce(new InvalidUsernameError());
    const invalid = await app.inject({ method: 'POST', url: '/api/accounts', payload: { username: 'a b', password: 'motdepasse' } });
    expect(invalid.statusCode).toBe(400);
  });

  it('POST /api/accounts/login connecte le joueur, ou répond 401', async () => {
    const ok = await app.inject({ method: 'POST', url: '/api/accounts/login', payload: { username: 'Halospart1', password: 'motdepasse' } });
    expect(ok.statusCode).toBe(200);
    expect(ok.json()).toEqual({ token: 'jeton', account: accountJson });

    service.login.mockRejectedValueOnce(new InvalidCredentialsError());
    const ko = await app.inject({ method: 'POST', url: '/api/accounts/login', payload: { username: 'Halospart1', password: 'mauvais-mdp' } });
    expect(ko.statusCode).toBe(401);
    expect(ko.json()).toEqual({ message: 'Pseudo ou mot de passe incorrect.' });
  });

  it('GET /api/accounts/me renvoie le compte du porteur du jeton', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/accounts/me', headers: { authorization: 'Bearer jeton' } });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual(accountJson);
    expect(service.authenticate).toHaveBeenCalledWith('jeton');
  });

  it('GET /api/accounts/me répond 401 sans jeton ou avec un jeton invalide', async () => {
    expect((await app.inject({ method: 'GET', url: '/api/accounts/me' })).statusCode).toBe(401);
    expect(service.authenticate).not.toHaveBeenCalled();
    service.authenticate.mockRejectedValueOnce(new UnauthenticatedError());
    expect((await app.inject({ method: 'GET', url: '/api/accounts/me', headers: { authorization: 'Bearer faux' } })).statusCode).toBe(401);
  });

  it('GET /api/accounts/leaderboard renvoie le classement avec les rangs', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/accounts/leaderboard?limit=5' });
    expect(response.json()).toEqual([{ rank: 1, username: 'Halospart1', rating: 1000, pvpWins: 0, pvpLosses: 0 }]);
    expect(service.leaderboard).toHaveBeenCalledWith(5);
    await app.inject({ method: 'GET', url: '/api/accounts/leaderboard' });
    expect(service.leaderboard).toHaveBeenLastCalledWith(20);
    expect((await app.inject({ method: 'GET', url: '/api/accounts/leaderboard?limit=1000' })).statusCode).toBe(400);
  });

  it('répond 400 à un corps JSON illisible', async () => {
    const response = await app.inject({ method: 'POST', url: '/api/accounts', headers: { 'content-type': 'application/json' }, payload: '{' });
    expect(response.statusCode).toBe(400);
  });
});
