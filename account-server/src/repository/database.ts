import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

/** Ouvre la base (fichier, ou `:memory:` pour les tests) et crée les tables manquantes. */
export function openDatabase(path: string): DatabaseSync {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS accounts (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL,
      username_key TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      rating INTEGER NOT NULL,
      pvp_wins INTEGER NOT NULL DEFAULT 0,
      pvp_losses INTEGER NOT NULL DEFAULT 0,
      ai_wins INTEGER NOT NULL DEFAULT 0,
      ai_losses INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS accounts_rating ON accounts (rating DESC);
    CREATE TABLE IF NOT EXISTS matches (
      game_id TEXT PRIMARY KEY,
      result TEXT NOT NULL,
      recorded_at TEXT NOT NULL
    );
  `);
  return db;
}
