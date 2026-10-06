import { Account } from '../model/account';
import { UsernameTakenError } from '../model/errors';
import type { IPasswordHasher } from '../integration/password-hasher';
import type { ITokenService } from '../integration/token-service';
import type { IAccountRepository } from '../repository/account-repository';
import { InvalidCredentialsError, UnauthenticatedError } from './errors';
import type { IClock, IIdGenerator } from './ports';

/** Compte connecté et son jeton d'accès (à présenter au serveur de jeu). */
export interface Session {
  token: string;
  account: Account;
}

export interface IAccountService {
  register(username: string, password: string): Promise<Session>;
  login(username: string, password: string): Promise<Session>;
  /** Compte du porteur du jeton ; lève UnauthenticatedError si le jeton est invalide. */
  authenticate(token: string): Promise<Account>;
  leaderboard(limit: number): Promise<Account[]>;
}

export class AccountService implements IAccountService {
  constructor(
    private readonly accounts: IAccountRepository,
    private readonly passwords: IPasswordHasher,
    private readonly tokens: ITokenService,
    private readonly ids: IIdGenerator,
    private readonly clock: IClock,
  ) {}

  async register(username: string, password: string): Promise<Session> {
    // Pseudo vérifié avant de payer le coût du hachage
    Account.assertValidUsername(username);
    if (await this.accounts.findByUsername(username)) throw new UsernameTakenError(username);
    const passwordHash = await this.passwords.hash(password);
    const account = Account.register({ id: this.ids.next(), username, passwordHash, createdAt: this.clock.now() });
    await this.accounts.create(account);
    return this.openSession(account);
  }

  async login(username: string, password: string): Promise<Session> {
    const account = await this.accounts.findByUsername(username);
    if (!account || !(await this.passwords.verify(password, account.passwordHash))) throw new InvalidCredentialsError();
    return this.openSession(account);
  }

  async authenticate(token: string): Promise<Account> {
    const claims = await this.tokens.verify(token);
    const account = claims && (await this.accounts.get(claims.accountId));
    if (!account) throw new UnauthenticatedError();
    return account;
  }

  async leaderboard(limit: number): Promise<Account[]> {
    return this.accounts.findTopRated(limit);
  }

  private async openSession(account: Account): Promise<Session> {
    return { token: await this.tokens.issue({ accountId: account.id, username: account.username }), account };
  }
}
