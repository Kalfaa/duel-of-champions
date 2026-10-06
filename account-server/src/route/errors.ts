import type { FastifyInstance, FastifyReply } from 'fastify';
import { z } from 'zod';
import { AccountRuleError, UsernameTakenError } from '../model/errors';
import { AccountNotFoundError, ConflictingMatchError, InvalidCredentialsError, UnauthenticatedError } from '../service/errors';

/** Entrée refusée par un schéma de validation. */
export class InvalidRequestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidRequestError';
  }
}

/** Valide une entrée avec son schéma ; le premier problème trouvé est renvoyé au client. */
export function parseInput<T>(schema: z.ZodType<T>, input: unknown): T {
  const parsed = schema.safeParse(input);
  if (parsed.success) return parsed.data;
  const issue = parsed.error.issues[0];
  throw new InvalidRequestError(issue?.message ?? 'Requête invalide.');
}

function statusOf(error: unknown): number | null {
  if (error instanceof InvalidRequestError) return 400;
  if (error instanceof UsernameTakenError || error instanceof ConflictingMatchError) return 409;
  if (error instanceof AccountRuleError) return 400;
  if (error instanceof InvalidCredentialsError || error instanceof UnauthenticatedError) return 401;
  if (error instanceof AccountNotFoundError) return 404;
  return null;
}

/** Traduit les erreurs métier et de service en codes HTTP, avec un message lisible par le joueur. */
export function registerErrorHandler(app: FastifyInstance): void {
  app.setErrorHandler((error: unknown, request, reply: FastifyReply) => {
    const status = statusOf(error);
    if (status !== null && error instanceof Error) return reply.status(status).send({ message: error.message });
    // Erreurs de fastify lui-même (JSON illisible, corps trop gros…)
    if (error instanceof Error && 'statusCode' in error && typeof error.statusCode === 'number' && error.statusCode < 500) {
      return reply.status(error.statusCode).send({ message: 'Requête invalide.' });
    }
    request.log.error({ err: error }, 'Erreur interne');
    return reply.status(500).send({ message: 'Erreur interne du serveur.' });
  });
}
