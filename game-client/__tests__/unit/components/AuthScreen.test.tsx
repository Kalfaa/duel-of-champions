import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { AuthScreen } from '../../../src/components/AuthScreen';

describe('AuthScreen', () => {
  it('propose la connexion par défaut, avec pseudo et mot de passe', () => {
    const html = renderToStaticMarkup(<AuthScreen error={null} onSubmit={async () => {}} />);
    expect(html).toContain('Se connecter');
    expect(html).toContain('Créer un compte');
    expect(html).toContain('autoComplete="username"');
    expect(html).toContain('type="password"');
    expect(html).not.toContain('role="alert"');
  });

  it('affiche l\'erreur renvoyée par le serveur', () => {
    const html = renderToStaticMarkup(<AuthScreen error="Pseudo ou mot de passe incorrect." onSubmit={async () => {}} />);
    expect(html).toContain('<div class="error" role="alert">Pseudo ou mot de passe incorrect.</div>');
  });
});
