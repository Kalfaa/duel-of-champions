import { timingSafeEqual } from 'node:crypto';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import type { IMatchService } from '../service/match-service';
import { parseInput } from './errors';

/** Réservé au serveur de jeu : n'est pas relayé vers les clients (voir le proxy du client). */
export const MATCHES_PATH = '/internal/matches';
export const INTERNAL_KEY_HEADER = 'x-internal-key';

const matchResultSchema = z.discriminatedUnion('mode', [
  z.object({ gameId: z.string().min(1), mode: z.literal('pvp'), winnerId: z.string().min(1), loserId: z.string().min(1) }),
  z.object({ gameId: z.string().min(1), mode: z.literal('ai'), accountId: z.string().min(1), won: z.boolean() }),
]);

const matchOutcomeSchema = z.object({
  recorded: z.boolean(),
  ratings: z.array(z.object({ accountId: z.string(), before: z.number(), after: z.number() })),
});

export type MatchOutcomeResponse = z.infer<typeof matchOutcomeSchema>;

function hasInternalKey(request: FastifyRequest, expected: string): boolean {
  const given = request.headers[INTERNAL_KEY_HEADER];
  if (typeof given !== 'string') return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function registerMatchRoutes(app: FastifyInstance, service: IMatchService, internalKey: string): void {
  app.post(MATCHES_PATH, async (request, reply) => {
    if (!hasInternalKey(request, internalKey)) return reply.status(403).send({ message: 'Accès réservé au serveur de jeu.' });
    const result = parseInput(matchResultSchema, request.body);
    return matchOutcomeSchema.parse(await service.record(result));
  });
}
