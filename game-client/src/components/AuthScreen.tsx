import { useState, type FormEvent } from 'react';
import type { AuthMode } from '../hooks/useAuth';
import { cls } from './common';

interface Props {
  error: string | null;
  onSubmit(mode: AuthMode, username: string, password: string): Promise<void>;
}

/** Connexion ou création de compte : il faut un compte pour jouer et être classé. */
export function AuthScreen({ error, onSubmit }: Props) {
  const [mode, setMode] = useState<AuthMode>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      await onSubmit(mode, username.trim(), password);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="menu auth">
      <h1>Duel of Champions</h1>
      <form className="auth-box" onSubmit={submit}>
        <div className="modes">
          <button type="button" className={cls(mode === 'login' && 'on')} onClick={() => setMode('login')}>Connexion</button>
          <button type="button" className={cls(mode === 'register' && 'on')} onClick={() => setMode('register')}>Créer un compte</button>
        </div>
        <label>
          Pseudo
          <input value={username} onChange={e => setUsername(e.target.value)} autoComplete="username" autoFocus required
            maxLength={20} pattern={mode === 'register' ? '[A-Za-z0-9_\\-]{3,20}' : undefined} />
        </label>
        {mode === 'register' && <small className="auth-hint">3 à 20 caractères : lettres, chiffres, « _ » ou « - ».</small>}
        <label>
          Mot de passe
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={6} maxLength={128}
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'} />
        </label>
        {mode === 'register' && <small className="auth-hint">Au moins 6 caractères.</small>}
        {error && <div className="error" role="alert">{error}</div>}
        <button type="submit" className="auth-submit" disabled={busy}>
          {mode === 'login' ? 'Se connecter' : 'Créer le compte'}
        </button>
      </form>
    </div>
  );
}
