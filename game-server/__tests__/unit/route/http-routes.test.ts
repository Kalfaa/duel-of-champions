import Fastify from 'fastify';
import { describe, expect, it, vi } from 'vitest';
import { registerHttpRoutes } from '../../../src/route/http-routes';
import type { DeckSummary, IGameService } from '../../../src/service/game-service';

const siegfried: DeckSummary = {
  id: 'siegfried', faction: 'havre', factionLabel: 'Havre', factionIcon: '🦅', description: 'desc',
  hero: {
    name: 'Anton', icon: '🤴', art: 'art', rarity: 'heroic', expansion: { name: 'Édition de base', image: 'base' },
    base: { m: 2, g: 0, d: 1 }, schools: ['Lumière'], power: { name: 'Bénédiction', cost: 2, text: 'Soigne' }, passive: null,
  },
};

function buildTestApp() {
  const service = { listDecks: vi.fn(() => [siegfried]) };
  const app = Fastify();
  registerHttpRoutes(app, service as unknown as IGameService);
  return { app, service };
}

describe('routes HTTP', () => {
  it('GET /api/health répond ok', async () => {
    const { app } = buildTestApp();
    const response = await app.inject({ method: 'GET', url: '/api/health' });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: 'ok' });
  });

  it('GET /api/decks retourne les decks du service', async () => {
    const { app, service } = buildTestApp();
    const response = await app.inject({ method: 'GET', url: '/api/decks' });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual([siegfried]);
    expect(service.listDecks).toHaveBeenCalled();
  });
});
