import { useCallback, useEffect, useState } from 'react';
import { AccountApiError, fetchMe, login, register } from '../api/accounts';
import type { Account, Session } from '../api/protocol';

export type AuthMode = 'login' | 'register';

export interface AuthController {
  /** `loading` le temps de vérifier une session enregistrée au démarrage. */
  status: 'loading' | 'anonymous' | 'authenticated';
  token: string | null;
  account: Account | null;
  error: string | null;
  signIn(mode: AuthMode, username: string, password: string): Promise<void>;
  logout(message?: string): void;
  /** Recharge le compte (classement et statistiques à jour après une partie). */
  refresh(): Promise<void>;
}

const TOKEN_KEY = 'duel-of-champions.token';

// Le stockage du navigateur peut être indisponible (navigation privée, données bloquées) : la session dure alors le temps de la page
function readToken(): string | null {
  try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
}

function writeToken(token: string | null): void {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch { /* session non conservée */ }
}

const SESSION_EXPIRED = 'Session expirée : reconnectez-vous.';

export function useAuth(): AuthController {
  const [token, setToken] = useState<string | null>(readToken);
  const [account, setAccount] = useState<Account | null>(null);
  const [status, setStatus] = useState<AuthController['status']>(() => (readToken() ? 'loading' : 'anonymous'));
  const [error, setError] = useState<string | null>(null);

  const logout = useCallback((message?: string) => {
    writeToken(null);
    setToken(null);
    setAccount(null);
    setStatus('anonymous');
    setError(message ?? null);
  }, []);

  const open = useCallback((session: Session) => {
    writeToken(session.token);
    setToken(session.token);
    setAccount(session.account);
    setStatus('authenticated');
    setError(null);
  }, []);

  const load = useCallback(async (current: string) => {
    try {
      setAccount(await fetchMe(current));
      setStatus('authenticated');
    } catch (e) {
      if (e instanceof AccountApiError && e.status === 401) logout(SESSION_EXPIRED);
      else {
        setStatus(s => (s === 'loading' ? 'anonymous' : s));
        setError(e instanceof Error ? e.message : String(e));
      }
    }
  }, [logout]);

  useEffect(() => {
    const saved = readToken();
    if (saved) void load(saved);
  }, [load]);

  const signIn = useCallback(async (mode: AuthMode, username: string, password: string) => {
    setError(null);
    try {
      open(await (mode === 'login' ? login : register)(username, password));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [open]);

  const refresh = useCallback(async () => {
    if (token) await load(token);
  }, [token, load]);

  return { status, token, account, error, signIn, logout, refresh };
}
