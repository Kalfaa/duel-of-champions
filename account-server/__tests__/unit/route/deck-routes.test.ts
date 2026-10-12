import Fastify, { type FastifyInstance } from 'fastify';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Deck } from '../../../src/model/deck';
import { TooManyDecksError } from '../../../src/model/errors';
import { registerDeckRoutes } from '../../../src/route/deck-routes';
import { registerErrorHandler } from '../../../src/route/errors';
import type { IDeckService } from '../../../src/service/deck-service';
import { DeckNotFoundError } from '../../../src/service/errors';

const content = { name: 'Marées', hero: 'kaiko', cards: { kappaShoya: 3 }, events: ['celebration'] };
const deck = Deck.create({ id: 'd1', accountId: 'acc', content, existingDecks: 0, now: new Date('2026-10-10T00:00:00Z') });
const response = { id: 'd1', ...content, updatedAt: '2026-10-10T00:00:00.000Z' };
const KEY = { 'x-internal-key': 'cle-interne' };

describe('routes internes des decks', () => {
  let app: FastifyInstance;
  let service: { [K in keyof IDeckService]: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    service = {
      list: vi.fn(async () => [deck]), get: vi.fn(async () => deck), create: vi.fn(async () => deck),
      update: vi.fn(async () => deck), delete: vi.fn(async () => {}),
    };
    app = Fastify();
    registerErrorHandler(app);
    registerDeckRoutes(app, service as unknown as IDeckService, 'cle-interne');
  });

  it('refuse une requête sans la clé interne', async () => {
    const res = await app.inject({ method: 'GET', url: '/internal/accounts/acc/decks' });
    expect(res.statusCode).toBe(403);
    expect(service.list).not.toHaveBeenCalled();
  });

  it('liste, lit, crée, modifie et supprime les decks d\'un compte', async () => {
    expect((await app.inject({ method: 'GET', url: '/internal/accounts/acc/decks', headers: KEY })).json()).toEqual([response]);
    expect((await app.inject({ method: 'GET', url: '/internal/accounts/acc/decks/d1', headers: KEY })).json()).toEqual(response);
    const created = await app.inject({ method: 'POST', url: '/internal/accounts/acc/decks', headers: KEY, payload: content });
    expect(created.statusCode).toBe(201);
    expect(service.create).toHaveBeenCalledWith('acc', content);
    expect((await app.inject({ method: 'PUT', url: '/internal/accounts/acc/decks/d1', headers: KEY, payload: content })).statusCode).toBe(200);
    expect(service.update).toHaveBeenCalledWith('acc', 'd1', content);
    expect((await app.inject({ method: 'DELETE', url: '/internal/accounts/acc/decks/d1', headers: KEY })).statusCode).toBe(204);
    expect(service.delete).toHaveBeenCalledWith('acc', 'd1');
  });

  it('refuse un deck mal formé et traduit les erreurs', async () => {
    expect((await app.inject({ method: 'POST', url: '/internal/accounts/acc/decks', headers: KEY, payload: { ...content, cards: { x: 0 } } })).statusCode).toBe(400);
    service.create.mockRejectedValueOnce(new TooManyDecksError(50));
    expect((await app.inject({ method: 'POST', url: '/internal/accounts/acc/decks', headers: KEY, payload: content })).json())
      .toEqual({ message: 'Vous avez déjà 50 decks : supprimez-en un pour en créer un autre.' });
    service.get.mockRejectedValueOnce(new DeckNotFoundError());
    expect((await app.inject({ method: 'GET', url: '/internal/accounts/acc/decks/x', headers: KEY })).statusCode).toBe(404);
  });
});
