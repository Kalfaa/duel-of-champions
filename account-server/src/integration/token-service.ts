import { jwtVerify, SignJWT } from 'jose';

/** Joueur identifié par un jeton d'accès. */
export interface TokenClaims {
  accountId: string;
  username: string;
}

export interface ITokenService {
  issue(claims: TokenClaims): Promise<string>;
  /** Retourne l'identité portée par le jeton, ou null s'il est invalide ou expiré. */
  verify(token: string): Promise<TokenClaims | null>;
}

/** Émetteur commun avec le serveur de jeu, qui vérifie les jetons avec le même secret. */
export const TOKEN_ISSUER = 'duel-of-champions';

/** Jetons JWT signés en HS256 avec un secret partagé avec le serveur de jeu. */
export class JwtTokenService implements ITokenService {
  private readonly key: Uint8Array;

  constructor(secret: string, private readonly ttl: string = '30d') {
    this.key = new TextEncoder().encode(secret);
  }

  async issue({ accountId, username }: TokenClaims): Promise<string> {
    return new SignJWT({ name: username })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(accountId)
      .setIssuer(TOKEN_ISSUER)
      .setIssuedAt()
      .setExpirationTime(this.ttl)
      .sign(this.key);
  }

  async verify(token: string): Promise<TokenClaims | null> {
    try {
      const { payload } = await jwtVerify(token, this.key, { issuer: TOKEN_ISSUER, algorithms: ['HS256'] });
      if (typeof payload.sub !== 'string' || typeof payload.name !== 'string') return null;
      return { accountId: payload.sub, username: payload.name };
    } catch {
      return null;
    }
  }
}
