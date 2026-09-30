import Fastify from 'fastify';
import { describe, expect, it, vi } from 'vitest';
import { registerHttpRoutes } from '../../../src/route/http-routes';
import type { FactionSummary, IGameService } from '../../../src/service/game-service';

const havre: FactionSummary = {
  id: 'havre', label: 'Havre', icon: '🦅', description: 'desc',
  hero: { name: 'Anton', icon: '🤴', art: 'art', power: { name: 'Bénédiction', cost: 2, text: 'Soigne' } },
};

function buildTestApp() {
  const service = { listFactions: vi.fn(() => [havre]) };
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

  it('GET /api/factions retourne les factions du service', async () => {
    const { app, service } = buildTestApp();
    const response = await app.inject({ method: 'GET', url: '/api/factions' });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual([havre]);
    expect(service.listFactions).toHaveBeenCalled();
  });
});
