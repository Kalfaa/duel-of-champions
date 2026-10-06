import { SignJWT } from 'jose';
import { describe, expect, it } from 'vitest';
import { JwtTokenService, TOKEN_ISSUER } from '../../../src/integration/token-service';

describe('JwtTokenService', () => {
  const service = new JwtTokenService('secret-de-test');

  it('retrouve l\'identité portée par un jeton émis', async () => {
    const token = await service.issue({ accountId: 'a1', username: 'Halospart1' });
    expect(await service.verify(token)).toEqual({ accountId: 'a1', username: 'Halospart1' });
  });

  it('refuse un jeton signé avec un autre secret', async () => {
    const token = await new JwtTokenService('autre-secret').issue({ accountId: 'a1', username: 'x' });
    expect(await service.verify(token)).toBeNull();
  });

  it('refuse un jeton expiré', async () => {
    const token = await new SignJWT({ name: 'x' }).setProtectedHeader({ alg: 'HS256' }).setSubject('a1').setIssuer(TOKEN_ISSUER)
      .setExpirationTime(Math.floor(Date.now() / 1000) - 10).sign(new TextEncoder().encode('secret-de-test'));
    expect(await service.verify(token)).toBeNull();
  });

  it('refuse un texte qui n\'est pas un jeton', async () => {
    expect(await service.verify('pas-un-jeton')).toBeNull();
  });
});
