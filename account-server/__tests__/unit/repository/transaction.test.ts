import { describe, expect, it } from 'vitest';
import { openDatabase } from '../../../src/repository/database';
import { SqliteTransactionRunner } from '../../../src/repository/transaction';

describe('SqliteTransactionRunner', () => {
  const insert = 'INSERT INTO matches (game_id, result, recorded_at) VALUES (?, \'{}\', \'2026-01-01\')';
  const count = (db: ReturnType<typeof openDatabase>) => (db.prepare('SELECT COUNT(*) AS n FROM matches').get() as { n: number }).n;

  it('enregistre le travail effectué et retourne son résultat', async () => {
    const db = openDatabase(':memory:');
    const result = await new SqliteTransactionRunner(db).run(async () => {
      db.prepare(insert).run('g1');
      return 'ok';
    });
    expect(result).toBe('ok');
    expect(count(db)).toBe(1);
  });

  it('annule tout si une erreur est levée', async () => {
    const db = openDatabase(':memory:');
    await expect(new SqliteTransactionRunner(db).run(async () => {
      db.prepare(insert).run('g1');
      throw new Error('échec');
    })).rejects.toThrow('échec');
    expect(count(db)).toBe(0);
  });
});
