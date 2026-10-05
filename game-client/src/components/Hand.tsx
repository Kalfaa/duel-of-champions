import type { CSSProperties } from 'react';
import type { GameView } from '../api/protocol';
import type { Click, Highlights, Selection } from '../game/selection';
import type { Inspect } from './CardInspector';
import type { Hover } from './InfoPanel';
import { CardFace, cls, onRightClick } from './common';

interface Props {
  view: GameView;
  selection: Selection;
  highlights: Highlights;
  onClick(click: Click): void;
  onHover(hover: Hover): void;
  onInspect(target: Inspect): void;
}

export function Hand({ view, selection, highlights, onClick, onHover, onInspect }: Props) {
  const me = view.players[view.you];
  const options = view.options;
  return (
    <div className="hand" style={{ '--n': me.hand?.length ?? 0 } as CSSProperties}>
      {(me.hand ?? []).map((c, i) => {
        const playable = !!options?.hand[i]?.playable;
        const selected = selection?.kind === 'hand' && selection.index === i;
        return (
          <div
            key={`${i}-${c.id}`}
            className={cls('card', c.type, playable && 'playable', selected && 'sel', highlights.hand.has(i) && 'target')}
            onClick={() => onClick({ kind: 'hand', index: i })}
            onMouseEnter={() => onHover({ kind: 'hand', index: i })}
            onContextMenu={onRightClick(() => onInspect({ kind: 'hand', index: i }))}
          >
            <CardFace card={c} player={me} cost={options?.hand[i]?.cost} />
          </div>
        );
      })}
    </div>
  );
}
