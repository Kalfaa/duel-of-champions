import { randomInt, randomUUID } from 'node:crypto';
import Fastify, { type FastifyInstance } from 'fastify';
import { AiPlayer } from './model/ai-player';
import type { Game } from './model/game';
import { MatchmakingQueue } from './model/matchmaking-queue';
import { InMemoryGameRepository } from './repository/game-repository';
import { registerGameSocket } from './route/game-socket';
import { registerHttpRoutes } from './route/http-routes';
import { DEFAULT_DELAYS, GameService, type PacingDelays } from './service/game-service';
import type { IDelay, IIdGenerator, ISeedSource } from './service/ports';

export interface ContainerOptions {
  logger?: boolean;
  delays?: PacingDelays;
  seeds?: ISeedSource;
}

const timerDelay: IDelay = { wait: ms => new Promise(resolve => setTimeout(resolve, ms)) };
const uuidGenerator: IIdGenerator = { next: () => randomUUID() };
const cryptoSeeds: ISeedSource = { next: () => randomInt(0, 2 ** 32) };

/** Seul endroit où les instances sont créées et câblées entre elles. */
export function buildApp(options: ContainerOptions = {}): FastifyInstance {
  const app = Fastify({ logger: options.logger ?? false });

  const gameRepository = new InMemoryGameRepository(new Map<string, Game>());
  const gameService = new GameService(
    gameRepository,
    new MatchmakingQueue(),
    new AiPlayer(),
    timerDelay,
    uuidGenerator,
    options.seeds ?? cryptoSeeds,
    options.delays ?? DEFAULT_DELAYS,
  );

  registerHttpRoutes(app, gameService);
  registerGameSocket(app, gameService);
  return app;
}
