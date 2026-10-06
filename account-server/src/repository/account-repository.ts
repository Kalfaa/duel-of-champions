import type { DatabaseSync } from 'node:sqlite';
import { Account } from '../model/account';
import { UsernameTakenError } from '../model/errors';

export interface IAccountRepository {
  get(id: string): Promise<Account | null>;
  /** Recherche insensible à la casse. */
  findByUsername(username: string): Promise<Account | null>;
  /** Comptes les mieux classés parmi ceux qui ont joué au moins une partie classée. */
  findTopRated(limit: number): Promise<Account[]>;
  /** Crée le compte ; lève UsernameTakenError si le pseudo est déjà utilisé. */
  create(account: Account): Promise<void>;
  save(account: Account): Promise<void>;
}

interface AccountRow {
  id: string;
  username: string;
  password_hash: string;
  rating: number;
  pvp_wins: number;
  pvp_losses: number;
  ai_wins: number;
  ai_losses: number;
  created_at: string;
}

const toAccount = (row: AccountRow): Account => new Account({
  id: row.id,
  username: row.username,
  passwordHash: row.password_hash,
  rating: row.rating,
  stats: { pvpWins: row.pvp_wins, pvpLosses: row.pvp_losses, aiWins: row.ai_wins, aiLosses: row.ai_losses },
  createdAt: new Date(row.created_at),
});

const isUniqueViolation = (error: unknown): boolean =>
  error instanceof Error && 'errcode' in error && error.errcode === 2067; // SQLITE_CONSTRAINT_UNIQUE

export class SqliteAccountRepository implements IAccountRepository {
  constructor(private readonly db: DatabaseSync) {}

  async get(id: string): Promise<Account | null> {
    const row = this.db.prepare('SELECT * FROM accounts WHERE id = ?').get(id) as AccountRow | undefined;
    return row ? toAccount(row) : null;
  }

  async findByUsername(username: string): Promise<Account | null> {
    const row = this.db.prepare('SELECT * FROM accounts WHERE username_key = ?').get(Account.usernameKey(username)) as AccountRow | undefined;
    return row ? toAccount(row) : null;
  }

  async findTopRated(limit: number): Promise<Account[]> {
    const rows = this.db.prepare(
      'SELECT * FROM accounts WHERE pvp_wins + pvp_losses > 0 ORDER BY rating DESC, pvp_wins DESC, username_key LIMIT ?',
    ).all(limit) as unknown as AccountRow[];
    return rows.map(toAccount);
  }

  async create(account: Account): Promise<void> {
    const { pvpWins, pvpLosses, aiWins, aiLosses } = account.stats;
    try {
      this.db.prepare(`
        INSERT INTO accounts (id, username, username_key, password_hash, rating, pvp_wins, pvp_losses, ai_wins, ai_losses, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(account.id, account.username, Account.usernameKey(account.username), account.passwordHash, account.rating,
        pvpWins, pvpLosses, aiWins, aiLosses, account.createdAt.toISOString());
    } catch (error) {
      if (isUniqueViolation(error)) throw new UsernameTakenError(account.username);
      throw error;
    }
  }

  async save(account: Account): Promise<void> {
    const { pvpWins, pvpLosses, aiWins, aiLosses } = account.stats;
    this.db.prepare(`
      UPDATE accounts SET rating = ?, pvp_wins = ?, pvp_losses = ?, ai_wins = ?, ai_losses = ? WHERE id = ?
    `).run(account.rating, pvpWins, pvpLosses, aiWins, aiLosses, account.id);
  }
}
