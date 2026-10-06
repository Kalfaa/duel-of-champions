import { describe, expect, it } from 'vitest';
import { Account } from '../../../src/model/account';
import { INITIAL_RATING } from '../../../src/model/elo';
import { InvalidUsernameError, SelfMatchError } from '../../../src/model/errors';
import { sameMatchResult } from '../../../src/model/match';

const register = (id: string, username = `joueur_${id}`) =>
  Account.register({ id, username, passwordHash: 'hash', createdAt: new Date('2026-01-01T00:00:00Z') });

describe('Account', () => {
  it('crée un compte avec le classement de départ et aucune partie', () => {
    const account = register('a', 'Halospart1');
    expect(account.username).toBe('Halospart1');
    expect(account.rating).toBe(INITIAL_RATING);
    expect(account.stats).toEqual({ pvpWins: 0, pvpLosses: 0, aiWins: 0, aiLosses: 0 });
    expect(account.pvpGames).toBe(0);
  });

  it.each(['ab', 'a'.repeat(21), 'avec espace', 'émile', 'x;drop'])('refuse le pseudo « %s »', username => {
    expect(() => register('a', username)).toThrow(InvalidUsernameError);
  });

  it('accepte lettres, chiffres, tiret et souligné', () => {
    expect(() => register('a', 'Moar-Spartan_42')).not.toThrow();
  });

  it('normalise les pseudos sans tenir compte de la casse', () => {
    expect(Account.usernameKey('MoarSpartan')).toBe(Account.usernameKey('moarspartan'));
  });

  it('compte les parties contre l\'IA sans toucher au classement', () => {
    const account = register('a');
    account.recordAiGame(true);
    account.recordAiGame(false);
    account.recordAiGame(true);
    expect(account.stats).toMatchObject({ aiWins: 2, aiLosses: 1 });
    expect(account.rating).toBe(INITIAL_RATING);
    expect(account.pvpGames).toBe(0);
  });

  it('transfère des points du vaincu au vainqueur après une partie classée', () => {
    const winner = register('w');
    const loser = register('l');
    const changes = Account.settlePvp(winner, loser);
    expect(winner.rating).toBe(INITIAL_RATING + 16);
    expect(loser.rating).toBe(INITIAL_RATING - 16);
    expect(changes).toEqual([
      { accountId: 'w', before: INITIAL_RATING, after: INITIAL_RATING + 16 },
      { accountId: 'l', before: INITIAL_RATING, after: INITIAL_RATING - 16 },
    ]);
    expect(winner.stats.pvpWins).toBe(1);
    expect(loser.stats.pvpLosses).toBe(1);
  });

  it('refuse une partie classée contre soi-même', () => {
    const account = register('a');
    expect(() => Account.settlePvp(account, account)).toThrow(SelfMatchError);
    expect(account.rating).toBe(INITIAL_RATING);
  });

  it('retourne une copie des statistiques', () => {
    const account = register('a');
    account.stats.aiWins = 99;
    expect(account.stats.aiWins).toBe(0);
  });
});

describe('sameMatchResult', () => {
  it('compare l\'issue de deux résultats', () => {
    const pvp = { gameId: 'g', mode: 'pvp', winnerId: 'a', loserId: 'b' } as const;
    expect(sameMatchResult(pvp, { ...pvp })).toBe(true);
    expect(sameMatchResult(pvp, { ...pvp, winnerId: 'b', loserId: 'a' })).toBe(false);
    expect(sameMatchResult(pvp, { gameId: 'g', mode: 'ai', accountId: 'a', won: true })).toBe(false);
    const ai = { gameId: 'g', mode: 'ai', accountId: 'a', won: true } as const;
    expect(sameMatchResult(ai, { ...ai })).toBe(true);
    expect(sameMatchResult(ai, { ...ai, won: false })).toBe(false);
  });
});
