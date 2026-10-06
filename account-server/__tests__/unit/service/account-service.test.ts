import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Account } from '../../../src/model/account';
import { InvalidUsernameError, UsernameTakenError } from '../../../src/model/errors';
import type { IPasswordHasher } from '../../../src/integration/password-hasher';
import type { ITokenService } from '../../../src/integration/token-service';
import type { IAccountRepository } from '../../../src/repository/account-repository';
import { AccountService } from '../../../src/service/account-service';
import { InvalidCredentialsError, UnauthenticatedError } from '../../../src/service/errors';

const NOW = new Date('2026-10-05T12:00:00Z');

describe('AccountService', () => {
  let stored: Map<string, Account>;
  let accounts: { [K in keyof IAccountRepository]: ReturnType<typeof vi.fn> };
  let passwords: IPasswordHasher;
  let tokens: ITokenService;
  let service: AccountService;

  beforeEach(() => {
    stored = new Map();
    accounts = {
      get: vi.fn(async (id: string) => stored.get(id) ?? null),
      findByUsername: vi.fn(async (name: string) => [...stored.values()].find(a => a.username.toLowerCase() === name.toLowerCase()) ?? null),
      findTopRated: vi.fn(async () => [...stored.values()]),
      create: vi.fn(async (a: Account) => { stored.set(a.id, a); }),
      save: vi.fn(async () => {}),
    };
    passwords = { hash: vi.fn(async (p: string) => `hashed:${p}`), verify: vi.fn(async (p: string, h: string) => h === `hashed:${p}`) };
    tokens = {
      issue: vi.fn(async c => `token:${c.accountId}:${c.username}`),
      verify: vi.fn(async (t: string) => {
        const [, accountId, username] = t.split(':');
        return accountId && username ? { accountId, username } : null;
      }),
    };
    service = new AccountService(accounts as unknown as IAccountRepository, passwords, tokens, { next: () => 'id1' }, { now: () => NOW });
  });

  it('inscrit un joueur : mot de passe haché, compte créé et jeton émis', async () => {
    const session = await service.register('Halospart1', 'motdepasse');
    expect(session.token).toBe('token:id1:Halospart1');
    expect(session.account).toMatchObject({ id: 'id1', username: 'Halospart1', passwordHash: 'hashed:motdepasse', rating: 1000, createdAt: NOW });
    expect(accounts.create).toHaveBeenCalledWith(session.account);
  });

  it('refuse un pseudo déjà pris sans hacher le mot de passe', async () => {
    await service.register('Halospart1', 'motdepasse');
    await expect(service.register('halospart1', 'autre-mdp')).rejects.toThrow(UsernameTakenError);
    expect(passwords.hash).toHaveBeenCalledTimes(1);
  });

  it('refuse un pseudo mal formé avant tout accès aux comptes', async () => {
    await expect(service.register('a b', 'motdepasse')).rejects.toThrow(InvalidUsernameError);
    expect(accounts.findByUsername).not.toHaveBeenCalled();
    expect(passwords.hash).not.toHaveBeenCalled();
  });

  it('connecte un joueur avec le bon mot de passe', async () => {
    await service.register('Halospart1', 'motdepasse');
    const session = await service.login('HALOSPART1', 'motdepasse');
    expect(session.account.id).toBe('id1');
    expect(session.token).toBe('token:id1:Halospart1');
  });

  it.each([['Halospart1', 'mauvais'], ['inconnu', 'motdepasse']])('refuse la connexion de %s / %s', async (username, password) => {
    await service.register('Halospart1', 'motdepasse');
    await expect(service.login(username, password)).rejects.toThrow(InvalidCredentialsError);
  });

  it('retrouve le compte du porteur d\'un jeton valide', async () => {
    const { token } = await service.register('Halospart1', 'motdepasse');
    expect((await service.authenticate(token)).username).toBe('Halospart1');
  });

  it('refuse un jeton invalide, ou celui d\'un compte qui n\'existe plus', async () => {
    await expect(service.authenticate('n-importe-quoi')).rejects.toThrow(UnauthenticatedError);
    await expect(service.authenticate('token:disparu:x')).rejects.toThrow(UnauthenticatedError);
  });

  it('délègue le classement au repository', async () => {
    await service.leaderboard(5);
    expect(accounts.findTopRated).toHaveBeenCalledWith(5);
  });
});
