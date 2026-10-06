import { randomUUID } from 'node:crypto';
import Fastify, { type FastifyInstance } from 'fastify';
import { ScryptPasswordHasher, type IPasswordHasher } from './integration/password-hasher';
import { JwtTokenService } from './integration/token-service';
import { SqliteAccountRepository } from './repository/account-repository';
import { openDatabase } from './repository/database';
import { SqliteMatchRepository } from './repository/match-repository';
import { SqliteTransactionRunner } from './repository/transaction';
import { registerAccountRoutes } from './route/account-routes';
import { registerErrorHandler } from './route/errors';
import { registerMatchRoutes } from './route/match-routes';
import { AccountService } from './service/account-service';
import { MatchService } from './service/match-service';
import type { IClock, IIdGenerator } from './service/ports';

export interface ContainerOptions {
  logger?: boolean;
  /** Fichier SQLite, ou `:memory:`. */
  databasePath: string;
  /** Secret de signature des jetons, partagé avec le serveur de jeu. */
  jwtSecret: string;
  /** Clé que le serveur de jeu présente pour envoyer les résultats des parties. */
  internalKey: string;
  passwordHasher?: IPasswordHasher;
}

const uuidGenerator: IIdGenerator = { next: () => randomUUID() };
const systemClock: IClock = { now: () => new Date() };

/** Seul endroit où les instances sont créées et câblées entre elles. */
export function buildApp(options: ContainerOptions): FastifyInstance {
  const app = Fastify({ logger: options.logger ?? false });

  const db = openDatabase(options.databasePath);
  const accounts = new SqliteAccountRepository(db);
  const accountService = new AccountService(
    accounts,
    options.passwordHasher ?? new ScryptPasswordHasher(),
    new JwtTokenService(options.jwtSecret),
    uuidGenerator,
    systemClock,
  );
  const matchService = new MatchService(accounts, new SqliteMatchRepository(db), new SqliteTransactionRunner(db), systemClock);

  registerErrorHandler(app);
  registerAccountRoutes(app, accountService);
  registerMatchRoutes(app, matchService, options.internalKey);
  app.addHook('onClose', (_instance, done) => {
    db.close();
    done();
  });
  return app;
}
