import { describe, expect, it } from 'vitest';
import { ScryptPasswordHasher } from '../../../src/integration/password-hasher';

describe('ScryptPasswordHasher', () => {
  const hasher = new ScryptPasswordHasher();

  it('vérifie le bon mot de passe et refuse les autres', async () => {
    const hash = await hasher.hash('motdepasse');
    expect(hash).toMatch(/^scrypt\$/);
    expect(hash).not.toContain('motdepasse');
    expect(await hasher.verify('motdepasse', hash)).toBe(true);
    expect(await hasher.verify('mauvais', hash)).toBe(false);
  });

  it('sale chaque hachage', async () => {
    expect(await hasher.hash('motdepasse')).not.toBe(await hasher.hash('motdepasse'));
  });

  it('refuse un hachage mal formé', async () => {
    expect(await hasher.verify('motdepasse', 'n-importe-quoi')).toBe(false);
  });
});
