import type { ITokenVerifier } from '../integration/token-verifier';
import { UnauthenticatedError } from './errors';
import type { PlayerIdentity } from './ports';

export interface IAuthService {
  /** Joueur porteur du jeton ; lève UnauthenticatedError si le jeton est absent, invalide ou expiré. */
  authenticate(token: string | null): Promise<PlayerIdentity>;
}

export class AuthService implements IAuthService {
  constructor(private readonly tokens: ITokenVerifier) {}

  async authenticate(token: string | null): Promise<PlayerIdentity> {
    const verified = token ? await this.tokens.verify(token) : null;
    if (!verified) throw new UnauthenticatedError();
    return { accountId: verified.accountId, name: verified.username };
  }
}
