import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import type { Account } from '../model/account';
import type { IAccountService, Session } from '../service/account-service';
import { UnauthenticatedError } from '../service/errors';
import { parseInput } from './errors';

const credentialsSchema = z.object({
  username: z.string({ error: 'Pseudo manquant.' }).trim().min(1, 'Pseudo manquant.').max(40, 'Pseudo trop long.'),
  password: z.string({ error: 'Mot de passe manquant.' })
    .min(6, 'Le mot de passe doit faire au moins 6 caractères.')
    .max(128, 'Le mot de passe doit faire au plus 128 caractères.'),
});

const leaderboardQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

const accountResponseSchema = z.object({
  id: z.string(),
  username: z.string(),
  rating: z.number(),
  stats: z.object({ pvpWins: z.number(), pvpLosses: z.number(), aiWins: z.number(), aiLosses: z.number() }),
  createdAt: z.string(),
});

const sessionResponseSchema = z.object({ token: z.string(), account: accountResponseSchema });

const leaderboardEntrySchema = z.object({
  rank: z.number(),
  username: z.string(),
  rating: z.number(),
  pvpWins: z.number(),
  pvpLosses: z.number(),
});

export type AccountResponse = z.infer<typeof accountResponseSchema>;
export type SessionResponse = z.infer<typeof sessionResponseSchema>;
export type LeaderboardEntry = z.infer<typeof leaderboardEntrySchema>;

const toAccountResponse = (account: Account): AccountResponse => accountResponseSchema.parse({
  id: account.id, username: account.username, rating: account.rating, stats: account.stats, createdAt: account.createdAt.toISOString(),
});

const toSessionResponse = (session: Session): SessionResponse =>
  sessionResponseSchema.parse({ token: session.token, account: toAccountResponse(session.account) });

function bearerToken(request: FastifyRequest): string {
  const match = /^Bearer (.+)$/.exec(request.headers.authorization ?? '');
  if (!match?.[1]) throw new UnauthenticatedError();
  return match[1];
}

export function registerAccountRoutes(app: FastifyInstance, service: IAccountService): void {
  app.get('/api/accounts/health', async () => ({ status: 'ok' }));

  app.post('/api/accounts', async (request, reply) => {
    const { username, password } = parseInput(credentialsSchema, request.body);
    const session = await service.register(username, password);
    return reply.status(201).send(toSessionResponse(session));
  });

  app.post('/api/accounts/login', async request => {
    const { username, password } = parseInput(credentialsSchema, request.body);
    return toSessionResponse(await service.login(username, password));
  });

  app.get('/api/accounts/me', async request => toAccountResponse(await service.authenticate(bearerToken(request))));

  app.get('/api/accounts/leaderboard', async (request): Promise<LeaderboardEntry[]> => {
    const { limit } = parseInput(leaderboardQuerySchema, request.query);
    const accounts = await service.leaderboard(limit);
    return z.array(leaderboardEntrySchema).parse(accounts.map((a, i) => ({
      rank: i + 1, username: a.username, rating: a.rating, pvpWins: a.stats.pvpWins, pvpLosses: a.stats.pvpLosses,
    })));
  });
}
