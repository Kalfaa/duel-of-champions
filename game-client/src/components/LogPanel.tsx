import type { GameView } from '../api/protocol';
import { GameLog } from './GameLog';

/** Historique de la partie, ouvert depuis le bouton 📜 de la barre du haut ; un clic à côté le referme. */
export function LogPanel({ view, onClose }: { view: GameView; onClose(): void }) {
  return (
    <div className="log-backdrop" onClick={onClose}>
      <div className="log-panel" onClick={e => e.stopPropagation()}>
        <div className="log-head">
          <span>📜 Historique</span>
          <button onClick={onClose}>Fermer</button>
        </div>
        <GameLog log={view.log} you={view.you} />
      </div>
    </div>
  );
}
