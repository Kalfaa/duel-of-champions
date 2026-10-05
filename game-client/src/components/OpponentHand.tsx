import { useLayoutEffect, useRef, type CSSProperties } from 'react';
import type { GameView, PlayerIndex } from '../api/protocol';
import type { Draw } from '../game/draws';
import { animateDraw, lastCards } from './drawAnimation';

/** Main de l'adversaire : ses cartes face cachée, avec le dos de sa faction ; ses pioches arrivent depuis sa bibliothèque. */
export function OpponentHand({ view, drawn = null }: { view: GameView; drawn?: Draw | null }) {
  const opponent: PlayerIndex = view.you === 0 ? 1 : 0;
  const p = view.players[opponent];
  const cardsRef = useRef<HTMLDivElement>(null);
  const drawnId = drawn?.id;
  const drawnCount = drawn?.theirs ?? 0;

  useLayoutEffect(() => {
    if (drawnId === undefined || !cardsRef.current) return;
    animateDraw(lastCards(cardsRef.current, ':scope > .card-back', drawnCount), document.querySelector<HTMLElement>('.pile.deck:not([data-mine])'));
  }, [drawnId, drawnCount]);

  return (
    <div className="opp-hand" title={`Main de ${p.hero.name} : ${p.handCount} carte${p.handCount > 1 ? 's' : ''}`}>
      <div className="opp-hand-label">Main adverse · {p.handCount}</div>
      <div className="opp-hand-cards" ref={cardsRef} style={{ '--n': p.handCount } as CSSProperties}>
        {Array.from({ length: p.handCount }, (_, i) => (
          <div key={i} className="card-back" style={{ backgroundImage: `url('/img/back/${p.faction}.webp')` }} />
        ))}
      </div>
    </div>
  );
}
