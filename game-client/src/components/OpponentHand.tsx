import { useLayoutEffect, useRef, type CSSProperties } from 'react';
import type { GameView, PlayerIndex } from '../api/protocol';
import type { Draw } from '../game/draws';
import { hoverHandlers, type Hover, type Inspect } from './CardInspector';
import { ArtFallback, artStyle, cls, onRightClick } from './common';
import { animateDraw, lastCards } from './drawAnimation';

interface Props {
  view: GameView;
  drawn?: Draw | null;
  onInspect?(target: Inspect): void;
  onHover?: Hover;
}

/**
 * Main de l'adversaire : ses cartes face cachée, avec le dos de sa faction ; ses pioches arrivent depuis sa bibliothèque.
 * Quand une carte la révèle (Pilier de clairvoyance), ses cartes sont montrées face visible.
 */
export function OpponentHand({ view, drawn = null, onInspect, onHover }: Props) {
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
      <div className="opp-hand-label">Main adverse · {p.handCount}{p.hand && ' · révélée'}</div>
      <div className="opp-hand-cards" ref={cardsRef} style={{ '--n': p.handCount } as CSSProperties}>
        {p.hand
          ? p.hand.map((card, i) => (
            <div
              key={`${i}-${card.id}`}
              className={cls('card-back', 'revealed', card.type)}
              style={artStyle(card.art)}
              title={card.name}
              onContextMenu={onRightClick(() => onInspect?.({ kind: 'card', card }))}
              {...hoverHandlers(onHover, { kind: 'card', card })}
            >
              <ArtFallback art={card.art} icon={card.icon} />
              <span className="revealed-cost">{card.cost}</span>
              <span className="revealed-name">{card.name}</span>
            </div>
          ))
          : Array.from({ length: p.handCount }, (_, i) => (
            <div key={i} className="card-back" style={{ backgroundImage: `url('/img/back/${p.faction}.webp')` }} />
          ))}
      </div>
    </div>
  );
}
