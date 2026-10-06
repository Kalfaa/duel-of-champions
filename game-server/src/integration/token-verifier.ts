import { jwtVerify } from 'jose';

/** Joueur identifié par le jeton d'accès délivré par le serveur de comptes. */
export interface VerifiedToken {
  accountId: string;
  username: string;
}

export interface ITokenVerifier {
  /** Identité portée par le jeton, ou null s'il est invalide ou expiré. */
  verify(token: string): Promise<VerifiedToken | null>;
}

/** Émetteur des jetons, identique à celui du serveur de comptes. */
const TOKEN_ISSUER = 'duel-of-champions';

/** Vérifie les jetons JWT (HS256) avec le secret partagé avec le serveur de comptes. */
export class JwtTokenVerifier implements ITokenVerifier {
  private readonly key: Uint8Array;

  constructor(secret: string) {
    this.key = new TextEncoder().encode(secret);
  }

  async verify(token: string): Promise<VerifiedToken | null> {
    try {
      const { payload } = await jwtVerify(token, this.key, { issuer: TOKEN_ISSUER, algorithms: ['HS256'] });
      if (typeof payload.sub !== 'string' || typeof payload.name !== 'string') return null;
      return { accountId: payload.sub, username: payload.name };
    } catch {
      return null;
    }
  }
}
