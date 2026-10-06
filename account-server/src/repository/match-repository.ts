import type { DatabaseSync } from 'node:sqlite';
import type { MatchResult, RecordedMatch } from '../model/match';

export interface IMatchRepository {
  get(gameId: string): Promise<RecordedMatch | null>;
  save(match: RecordedMatch): Promise<void>;
}

interface MatchRow {
  result: string;
  recorded_at: string;
}

export class SqliteMatchRepository implements IMatchRepository {
  constructor(private readonly db: DatabaseSync) {}

  async get(gameId: string): Promise<RecordedMatch | null> {
    const row = this.db.prepare('SELECT result, recorded_at FROM matches WHERE game_id = ?').get(gameId) as MatchRow | undefined;
    return row ? { result: JSON.parse(row.result) as MatchResult, recordedAt: new Date(row.recorded_at) } : null;
  }

  async save(match: RecordedMatch): Promise<void> {
    this.db.prepare('INSERT INTO matches (game_id, result, recorded_at) VALUES (?, ?, ?)')
      .run(match.result.gameId, JSON.stringify(match.result), match.recordedAt.toISOString());
  }
}
