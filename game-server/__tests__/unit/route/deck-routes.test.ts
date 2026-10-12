import Fastify from 'fastify';
import { describe, expect, it, vi } from 'vitest';
import { GameRuleError } from '../../../src/model/errors';
import { registerDeckRoutes } from '../../../src/route/deck-routes';
import type { IAuthService } from '../../../src/service/auth-service';
import type { IDeckService, SavedDeck } from '../../../src/service/deck-service';
import { DeckNotFoundError, DeckStorageUnavailableError, UnauthenticatedError } from '../../../src/service/errors';

const draft = { name: 'Marées', hero: 'kaiko', cards: { kappaShoya: 3 }, events: ['celebration'] };
const saved: SavedDeck = { id: 'deck-1', updatedAt: '2026-10-10T00:00:00.000Z', ...draft, hero: 'kaiko', problems: [], heroView: null };
const AUTH = { authorization: 'Bearer jeton' };

function buildTestApp() {
  const service = {
    catalog: vi.fn(() => ({ heroes: [], cards: [], events: [], rules: {} })),
    list: vi.fn(async () => [saved]),
    create: vi.fn(async () => saved),
    update: vi.fn(async () => saved),
    delete: vi.fn(async () => {}),
    playable: vi.fn(),
  };
  const auth: IAuthService = {
    authenticate: vi.fn(async (token: string | null) => {
      if (token !== 'jeton') throw new UnauthenticatedError();
      return { accountId: 'acc', name: 'Alice' };
    }),
  };
  const app = Fastify();
  registerDeckRoutes(app, service as unknown as IDeckService, auth);
  return { app, service };
}

describe('routes des decks', () => {
  it('sert le catalogue sans authentification', async () => {
    const { app } = buildTestApp();
    const response = await app.inject({ method: 'GET', url: '/api/catalog' });
    expect(response.statusCode).toBe(200);
  });

  it('exige un jeton pour les decks du joueur', async () => {
    const { app, service } = buildTestApp();
    const response = await app.inject({ method: 'GET', url: '/api/my-decks' });
    expect(response.statusCode).toBe(401);
    expect(service.list).not.toHaveBeenCalled();
  });

  it('liste, crée, modifie et supprime les decks du joueur connecté', async () => {
    const { app, service } = buildTestApp();
    expect((await app.inject({ method: 'GET', url: '/api/my-decks', headers: AUTH })).json()).toEqual([saved]);
    expect(service.list).toHaveBeenCalledWith('acc');

    const created = await app.inject({ method: 'POST', url: '/api/my-decks', headers: AUTH, payload: { ...draft, name: '  Marées ' } });
    expect(created.statusCode).toBe(201);
    expect(service.create).toHaveBeenCalledWith('acc', draft);

    expect((await app.inject({ method: 'PUT', url: '/api/my-decks/deck-1', headers: AUTH, payload: draft })).statusCode).toBe(200);
    expect(service.update).toHaveBeenCalledWith('acc', 'deck-1', draft);

    expect((await app.inject({ method: 'DELETE', url: '/api/my-decks/deck-1', headers: AUTH })).statusCode).toBe(204);
    expect(service.delete).toHaveBeenCalledWith('acc', 'deck-1');
  });

  it.each([
    [{ ...draft, name: '' }, 'Nom du deck manquant.'],
    [{ ...draft, hero: '' }, 'Héros manquant.'],
    [{ ...draft, cards: { kappaShoya: 0 } }, undefined],
    [{ ...draft, events: Array(9).fill('celebration') }, undefined],
  ])('refuse un deck mal formé : %j', async (payload, message) => {
    const { app, service } = buildTestApp();
    const response = await app.inject({ method: 'POST', url: '/api/my-decks', headers: AUTH, payload });
    expect(response.statusCode).toBe(400);
    if (message) expect(response.json()).toEqual({ message });
    expect(service.create).not.toHaveBeenCalled();
  });

  it('traduit les erreurs du service en codes HTTP', async () => {
    const { app, service } = buildTestApp();
    service.create.mockRejectedValueOnce(new GameRuleError('Carte inconnue : x.'));
    service.update.mockRejectedValueOnce(new DeckNotFoundError());
    service.list.mockRejectedValueOnce(new DeckStorageUnavailableError());
    expect((await app.inject({ method: 'POST', url: '/api/my-decks', headers: AUTH, payload: draft })).statusCode).toBe(400);
    expect((await app.inject({ method: 'PUT', url: '/api/my-decks/x', headers: AUTH, payload: draft })).statusCode).toBe(404);
    expect((await app.inject({ method: 'GET', url: '/api/my-decks', headers: AUTH })).statusCode).toBe(503);
  });
});
