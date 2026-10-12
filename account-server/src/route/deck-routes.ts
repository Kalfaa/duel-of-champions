import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { Deck } from '../model/deck';
import type { IDeckService } from '../service/deck-service';
import { parseInput } from './errors';
import { hasInternalKey } from './internal-key';

/** Réservé au serveur de jeu, qui valide les decks avant de les enregistrer : n'est pas relayé vers les clients. */
export const DECKS_PATH = '/internal/accounts/:accountId/decks';

const accountParamsSchema = z.object({ accountId: z.string().min(1).max(100) });
const deckParamsSchema = accountParamsSchema.extend({ deckId: z.string().min(1).max(100) });

const deckContentSchema = z.object({
  name: z.string().max(100),
  hero: z.string().min(1).max(100),
  cards: z.record(z.string().min(1).max(100), z.number().int().min(1).max(200))
    .refine(cards => Object.keys(cards).length <= 200, 'Trop de cartes différentes.'),
  events: z.array(z.string().min(1).max(100)).max(8),
});

const deckResponseSchema = deckContentSchema.extend({ id: z.string(), updatedAt: z.string() });

export type DeckResponse = z.infer<typeof deckResponseSchema>;

const toDeckResponse = (deck: Deck): DeckResponse => deckResponseSchema.parse({
  id: deck.id, name: deck.name, hero: deck.hero, cards: deck.cards, events: deck.events, updatedAt: deck.updatedAt.toISOString(),
});

export function registerDeckRoutes(app: FastifyInstance, service: IDeckService, internalKey: string): void {
  app.register(async scoped => {
    scoped.addHook('onRequest', async (request, reply) => {
      if (!hasInternalKey(request, internalKey)) return reply.status(403).send({ message: 'Accès réservé au serveur de jeu.' });
    });

    scoped.get(DECKS_PATH, async request => {
      const { accountId } = parseInput(accountParamsSchema, request.params);
      return (await service.list(accountId)).map(toDeckResponse);
    });

    scoped.get(`${DECKS_PATH}/:deckId`, async request => {
      const { accountId, deckId } = parseInput(deckParamsSchema, request.params);
      return toDeckResponse(await service.get(accountId, deckId));
    });

    scoped.post(DECKS_PATH, async (request, reply) => {
      const { accountId } = parseInput(accountParamsSchema, request.params);
      const deck = await service.create(accountId, parseInput(deckContentSchema, request.body));
      return reply.status(201).send(toDeckResponse(deck));
    });

    scoped.put(`${DECKS_PATH}/:deckId`, async request => {
      const { accountId, deckId } = parseInput(deckParamsSchema, request.params);
      return toDeckResponse(await service.update(accountId, deckId, parseInput(deckContentSchema, request.body)));
    });

    scoped.delete(`${DECKS_PATH}/:deckId`, async (request, reply) => {
      const { accountId, deckId } = parseInput(deckParamsSchema, request.params);
      await service.delete(accountId, deckId);
      return reply.status(204).send();
    });
  });
}
