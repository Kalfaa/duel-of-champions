import { useState } from 'react';
import type { CardView, GameView, PlayerIndex } from '../api/protocol';
import type { Inspect } from './CardInspector';
import { CardFace, cls, onRightClick } from './common';
import { CardDetails } from './CardDetails';

interface Props {
  view: GameView;
  player: PlayerIndex;
  onClose(): void;
  onInspect(target: Inspect): void;
}

/** Contenu d'un cimetière, de la carte la plus récente à la plus ancienne ; survoler une carte affiche ses détails. */
export function GraveViewer({ view, player, onClose, onInspect }: Props) {
  const p = view.players[player];
  const cards = [...p.grave].reverse();
  const [hovered, setHovered] = useState<CardView | null>(null);
  const shown = hovered ?? cards[0] ?? null;
  const owner = player === view.you ? 'Votre cimetière' : `Cimetière de ${p.hero.name}`;

  return (
    <div className="grave-viewer" onClick={onClose}>
      <div className="grave-box" onClick={e => e.stopPropagation()}>
        <div className="grave-head">
          <span>🪦 {owner} · {cards.length} carte{cards.length > 1 ? 's' : ''}</span>
          <button onClick={onClose}>Fermer</button>
        </div>
        {cards.length === 0
          ? <div className="grave-empty">Le cimetière est vide.</div>
          : (
            <div className="grave-body">
              <div className="grave-cards">
                {cards.map((c, i) => (
                  <div key={i} className={cls('card', c.type, shown === c && 'sel')} onMouseEnter={() => setHovered(c)} onContextMenu={onRightClick(() => onInspect({ kind: 'card', card: c }))}>
                    <CardFace card={c} />
                  </div>
                ))}
              </div>
              {shown && (
                <div className="grave-details">
                  <CardDetails card={shown} hp={shown.type === 'creature' ? String(shown.hp) : null} />
                </div>
              )}
            </div>
          )}
      </div>
    </div>
  );
}
