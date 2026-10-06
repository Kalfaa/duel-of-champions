import { SignJWT } from 'jose';
import { describe, expect, it } from 'vitest';
import { JwtTokenVerifier } from '../../../src/integration/token-verifier';

const sign = (secret: string, opts: { issuer?: string; expired?: boolean; name?: string } = {}) => {
  const jwt = new SignJWT(opts.name === undefined ? { name: 'Halospart1' } : { name: opts.name })
    .setProtectedHeader({ alg: 'HS256' }).setSubject('acc1').setIssuer(opts.issuer ?? 'duel-of-champions');
  jwt.setExpirationTime(opts.expired ? Math.floor(Date.now() / 1000) - 10 : '1h');
  return jwt.sign(new TextEncoder().encode(secret));
};

describe('JwtTokenVerifier', () => {
  const verifier = new JwtTokenVerifier('secret-partage');

  it('retrouve le compte d\'un jeton émis par le serveur de comptes', async () => {
    expect(await verifier.verify(await sign('secret-partage'))).toEqual({ accountId: 'acc1', username: 'Halospart1' });
  });

  it.each([
    ['signé avec un autre secret', () => sign('autre-secret')],
    ['expiré', () => sign('secret-partage', { expired: true })],
    ['d\'un autre émetteur', () => sign('secret-partage', { issuer: 'autre' })],
    ['illisible', async () => 'pas-un-jeton'],
  ])('refuse un jeton %s', async (_label, token) => {
    expect(await verifier.verify(await token())).toBeNull();
  });
});
