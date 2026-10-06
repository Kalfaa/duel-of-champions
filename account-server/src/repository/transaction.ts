import type { DatabaseSync } from 'node:sqlite';

export interface ITransactionRunner {
  /** Exécute `work` dans une transaction : tout est enregistré, ou rien si une erreur est levée. */
  run<T>(work: () => Promise<T>): Promise<T>;
}

/**
 * Transaction SQLite. Les repositories SQLite étant synchrones sous leurs promesses, aucune autre
 * requête ne peut s'intercaler entre BEGIN et COMMIT tant que `work` ne fait pas d'autre I/O.
 */
export class SqliteTransactionRunner implements ITransactionRunner {
  constructor(private readonly db: DatabaseSync) {}

  async run<T>(work: () => Promise<T>): Promise<T> {
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const result = await work();
      this.db.exec('COMMIT');
      return result;
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
  }
}
