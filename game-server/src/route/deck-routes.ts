import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { GameRuleError } from '../model/errors';
import type { IAuthService } from '../service/auth-service';
import type { DeckDraft, IDeckService } from '../service/deck-service';
import {
  DeckNotFoundError, DeckRejectedError, DeckStorageUnavailableError, UnauthenticatedError,
} from '../service/errors';

export const MY_DECKS_PATH = '/api/my-decks';

const deckDraftSchema = z.object({
  name: z.string({ error: 'Nom du deck manquant.' }).trim().min(1, 'Nom du deck manquant.').max(40, 'Nom du deck trop long (40 caractères au plus).'),
  hero: z.string({ error: 'Héros manquant.' }).min(1, 'Héros manquant.').max(100),
  cards: z.record(z.string().min(1).max(100), z.number().int().min(1).max(200))
    .refine(cards => Object.keys(cards).length <= 200, 'Trop de cartes différentes.'),
  events: z.array(z.string().min(1).max(100)).max(8),
});

const deckIdParamsSchema = z.object({ deckId: z.string().min(1).max(100) });

/** Entrée refusée par un schéma de validation. */
class InvalidRequestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidRequestError';
  }
}

function parseInput<T>(schema: z.ZodType<T>, input: unknown): T {
  const parsed = schema.safeParse(input);
  if (parsed.success) return parsed.data;
  throw new InvalidRequestError(parsed.error.issues[0]?.message ?? 'Requête invalide.');
}

function bearerToken(request: FastifyRequest): string | null {
  return /^Bearer (.+)$/.exec(request.headers.authorization ?? '')?.[1] ?? null;
}

function statusOf(error: unknown): number | null {
  if (error instanceof InvalidRequestError || error instanceof GameRuleError || error instanceof DeckRejectedError) return 400;
  if (error instanceof UnauthenticatedError) return 401;
  if (error instanceof DeckNotFoundError) return 404;
  if (error instanceof DeckStorageUnavailableError) return 503;
  return null;
}

/** Catalogue des cartes et decks du joueur connecté (création, modification, suppression). */
export function registerDeckRoutes(app: FastifyInstance, service: IDeckService, auth: IAuthService): void {
  const accountOf = async (request: FastifyRequest): Promise<string> => (await auth.authenticate(bearerToken(request))).accountId;

  app.register(async scoped => {
    scoped.setErrorHandler((error: unknown, request, reply: FastifyReply) => {
      const status = statusOf(error);
      if (status !== null && error instanceof Error) return reply.status(status).send({ message: error.message });
      if (error instanceof Error && 'statusCode' in error && typeof error.statusCode === 'number' && error.statusCode < 500) {
        return reply.status(error.statusCode).send({ message: 'Requête invalide.' });
      }
      request.log.error({ err: error }, 'Erreur interne');
      return reply.status(500).send({ message: 'Erreur interne du serveur.' });
    });

    scoped.get('/api/catalog', async () => service.catalog());

    scoped.get(MY_DECKS_PATH, async request => service.list(await accountOf(request)));

    scoped.post(MY_DECKS_PATH, async (request, reply) => {
      const accountId = await accountOf(request);
      const draft: DeckDraft = parseInput(deckDraftSchema, request.body);
      return reply.status(201).send(await service.create(accountId, draft));
    });

    scoped.put(`${MY_DECKS_PATH}/:deckId`, async request => {
      const accountId = await accountOf(request);
      const { deckId } = parseInput(deckIdParamsSchema, request.params);
      return service.update(accountId, deckId, parseInput(deckDraftSchema, request.body));
    });

    scoped.delete(`${MY_DECKS_PATH}/:deckId`, async (request, reply) => {
      const accountId = await accountOf(request);
      const { deckId } = parseInput(deckIdParamsSchema, request.params);
      await service.delete(accountId, deckId);
      return reply.status(204).send();
    });
  });
}
