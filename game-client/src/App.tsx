import { GameScreen } from './components/GameScreen';
import { Menu } from './components/Menu';
import { useGame } from './hooks/useGame';

export function App() {
  const game = useGame();

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
    return <GameScreen view={game.view} ui={game.ui} flashes={game.flashes} attacking={game.attacking} ghosts={game.ghosts} turnBanner={game.turnBanner} onClick={game.click} onLeave={game.leave} />;
  }

  return <Menu error={game.connectionError} onStart={game.start} />;
}
