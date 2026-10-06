import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { IGameService } from '../service/game-service';

const deckResponseSchema = z.object({
  id: z.string(),
  faction: z.string(),
  factionLabel: z.string(),
  factionIcon: z.string(),
  description: z.string(),
  hero: z.object({
    name: z.string(),
    icon: z.string(),
    art: z.string(),
    rarity: z.string(),
    expansion: z.object({ name: z.string(), image: z.string() }),
    base: z.object({ m: z.number(), g: z.number(), d: z.number() }),
    schools: z.array(z.string()),
    power: z.object({ name: z.string(), cost: z.number(), text: z.string() }).nullable(),
    passive: z.object({ name: z.string(), text: z.string() }).nullable(),
  }),
});

export type DeckResponse = z.infer<typeof deckResponseSchema>;

export function registerHttpRoutes(app: FastifyInstance, service: IGameService): void {
  app.get('/api/health', async () => ({ status: 'ok' }));

  app.get('/api/decks', async (): Promise<DeckResponse[]> =>
    z.array(deckResponseSchema).parse(service.listDecks()));
}
