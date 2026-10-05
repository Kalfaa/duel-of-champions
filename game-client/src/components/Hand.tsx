import { useLayoutEffect, useRef, type CSSProperties } from 'react';
import type { GameView } from '../api/protocol';
import type { Draw } from '../game/draws';
import type { Click, Highlights, Selection } from '../game/selection';
import type { Inspect } from './CardInspector';
import { CardFace, cls, onRightClick } from './common';
import { animateDraw, lastCards } from './drawAnimation';

interface Props {
  view: GameView;
  selection: Selection;
  highlights: Highlights;
  /** Cartes qui viennent d'être piochées : elles arrivent en volant depuis la bibliothèque. */
  drawn?: Draw | null;
  onClick(click: Click): void;
  onInspect(target: Inspect): void;
}

export function Hand({ view, selection, highlights, drawn = null, onClick, onInspect }: Props) {
  const me = view.players[view.you];
  const options = view.options;
  const handRef = useRef<HTMLDivElement>(null);
  const drawnId = drawn?.id;
  const drawnCount = drawn?.mine ?? 0;

  useLayoutEffect(() => {
    if (drawnId === undefined || !handRef.current) return;
    animateDraw(lastCards(handRef.current, ':scope > .card', drawnCount), document.querySelector<HTMLElement>('.pile.deck[data-mine]'));
  }, [drawnId, drawnCount]);

  return (
    <div className="hand" ref={handRef} style={{ '--n': me.hand?.length ?? 0 } as CSSProperties}>
      {(me.hand ?? []).map((c, i) => {
        const playable = !!options?.hand[i]?.playable;
        const selected = selection?.kind === 'hand' && selection.index === i;
        return (
          <div
            key={`${i}-${c.id}`}
            className={cls('card', c.type, playable && 'playable', selected && 'sel', highlights.hand.has(i) && 'target')}
            onClick={() => onClick({ kind: 'hand', index: i })}
            onContextMenu={onRightClick(() => onInspect({ kind: 'hand', index: i }))}
          >
            <CardFace card={c} player={me} cost={options?.hand[i]?.cost} />
          </div>
        );
      })}
    </div>
  );
}
