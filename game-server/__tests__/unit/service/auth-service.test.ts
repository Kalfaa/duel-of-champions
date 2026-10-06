import { describe, expect, it, vi } from 'vitest';
import { AuthService } from '../../../src/service/auth-service';
import { UnauthenticatedError } from '../../../src/service/errors';

describe('AuthService', () => {
  const verify = vi.fn(async (token: string) => (token === 'valide' ? { accountId: 'acc1', username: 'Halospart1' } : null));
  const service = new AuthService({ verify });

  it('identifie le joueur porteur d\'un jeton valide', async () => {
    expect(await service.authenticate('valide')).toEqual({ accountId: 'acc1', name: 'Halospart1' });
  });

  it('refuse un jeton absent ou invalide', async () => {
    await expect(service.authenticate(null)).rejects.toThrow(UnauthenticatedError);
    await expect(service.authenticate('invalide')).rejects.toThrow(UnauthenticatedError);
  });
});
