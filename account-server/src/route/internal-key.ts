import { timingSafeEqual } from 'node:crypto';
import type { FastifyRequest } from 'fastify';

/** En-tête par lequel le serveur de jeu présente la clé interne. */
export const INTERNAL_KEY_HEADER = 'x-internal-key';

/** La requête vient du serveur de jeu : elle porte la clé interne attendue. */
export function hasInternalKey(request: FastifyRequest, expected: string): boolean {
  const given = request.headers[INTERNAL_KEY_HEADER];
  if (typeof given !== 'string') return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
