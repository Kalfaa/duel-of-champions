import { describe, expect, it } from 'vitest';
import { openDatabase } from '../../../src/repository/database';
import { SqliteMatchRepository } from '../../../src/repository/match-repository';

describe('SqliteMatchRepository', () => {
  it('enregistre et retrouve le résultat d\'une partie', async () => {
    const repository = new SqliteMatchRepository(openDatabase(':memory:'));
    const result = { gameId: 'g1', mode: 'pvp', winnerId: 'a', loserId: 'b' } as const;
    await repository.save({ result, recordedAt: new Date('2026-05-06T07:08:09Z') });
    expect(await repository.get('g1')).toEqual({ result, recordedAt: new Date('2026-05-06T07:08:09Z') });
    expect(await repository.get('g2')).toBeNull();
  });
});
