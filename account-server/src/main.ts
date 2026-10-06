import { existsSync } from 'node:fs';
import { buildApp } from './container';

// Secrets lus dans le .env de la racine s'il existe (voir README)
const envFile = new URL('../../.env', import.meta.url);
if (existsSync(envFile)) process.loadEnvFile(envFile);

/** Valeurs de développement, identiques à celles du serveur de jeu ; à remplacer dès que le jeu est exposé. */
const DEV_JWT_SECRET = 'dev-only-jwt-secret-change-me';
const DEV_INTERNAL_KEY = 'dev-only-internal-key-change-me';

const port = Number(process.env.PORT ?? 3001);
const host = process.env.HOST ?? '0.0.0.0';

const app = buildApp({
  logger: true,
  databasePath: process.env.DATABASE_PATH ?? new URL('../data/accounts.db', import.meta.url).pathname,
  jwtSecret: process.env.JWT_SECRET ?? DEV_JWT_SECRET,
  internalKey: process.env.INTERNAL_API_KEY ?? DEV_INTERNAL_KEY,
});
if (!process.env.JWT_SECRET || !process.env.INTERNAL_API_KEY) {
  app.log.warn('JWT_SECRET ou INTERNAL_API_KEY non défini : secrets de développement utilisés.');
}
await app.listen({ port, host });
