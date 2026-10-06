import { useCallback, useEffect } from 'react';
import type { Account } from './api/protocol';
import { AuthScreen } from './components/AuthScreen';
import { GameScreen } from './components/GameScreen';
import { Menu } from './components/Menu';
import { useAuth } from './hooks/useAuth';
import { useGame } from './hooks/useGame';

export function App() {
  const auth = useAuth();

  if (auth.status === 'loading') {
    return (
      <div className="overlay">
        <div className="spinner" />
      </div>
    );
  }

  if (auth.status === 'anonymous' || !auth.token || !auth.account) {
    return <AuthScreen error={auth.error} onSubmit={auth.signIn} />;
  }

  return <Lobby token={auth.token} account={auth.account} onLogout={auth.logout} onRefresh={auth.refresh} />;
}

interface LobbyProps {
  token: string;
  account: Account;
  onLogout(message?: string): void;
  onRefresh(): Promise<void>;
}

/** Menu, attente d'un adversaire et partie, pour le joueur connecté. */
function Lobby({ token, account, onLogout, onRefresh }: LobbyProps) {
  const onUnauthorized = useCallback(() => onLogout('Session expirée : reconnectez-vous.'), [onLogout]);
  const game = useGame(token, onUnauthorized);

  // De retour au menu, le classement et les statistiques tiennent compte de la partie terminée
  useEffect(() => {
    if (game.screen === 'menu') void onRefresh();
  }, [game.screen, onRefresh]);

  if (game.screen === 'waiting') {
    return (
      <div className="overlay">
        <div className="spinner" />
        <p>Recherche d'un adversaire…</p>
        <button onClick={game.leave}>Annuler</button>
      </div>
    );
  }

  if (game.screen === 'game' && game.view) {
    return <GameScreen view={game.view} ui={game.ui} flashes={game.flashes} attacking={game.attacking} ghosts={game.ghosts} turnBanner={game.turnBanner} drawn={game.drawn} onClick={game.click} onLeave={game.leave} />;
  }

  return <Menu account={account} error={game.connectionError} onStart={game.start} onLogout={() => onLogout()} />;
}
