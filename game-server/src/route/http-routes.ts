import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { IGameService } from '../service/game-service';

const factionResponseSchema = z.object({
  id: z.string(),
  label: z.string(),
  icon: z.string(),
  description: z.string(),
  hero: z.object({
    name: z.string(),
    icon: z.string(),
    art: z.string(),
    power: z.object({ name: z.string(), cost: z.number(), text: z.string() }),
  }),
});

export type FactionResponse = z.infer<typeof factionResponseSchema>;

export function registerHttpRoutes(app: FastifyInstance, service: IGameService): void {
  app.get('/api/health', async () => ({ status: 'ok' }));

  app.get('/api/factions', async (): Promise<FactionResponse[]> =>
    z.array(factionResponseSchema).parse(service.listFactions()));
}
