import type { GameView } from '../api/protocol';
import type { Click, Selection } from '../game/selection';
import { hoverHandlers, type Hover, type Inspect } from './CardInspector';
import { ArtFallback, artStyle, cls, onRightClick } from './common';

interface Props {
  view: GameView;
  selection: Selection;
  onClick(click: Click): void;
  onInspect(target: Inspect): void;
  onHover?: Hover;
}

/** Les deux événements en jeu, communs aux deux joueurs ; celui de gauche quitte le jeu à la fin du tour. */
export function EventRow({ view, selection, onClick, onInspect, onHover }: Props) {
  // Un serveur pas encore mis à jour n'envoie pas les événements : la zone est alors masquée
  const events = view.events ?? [];
  if (!events.length) return null;
  return (
    <div className="events">
      <div className="events-deck" title={`Événements restants dans la pioche commune : ${view.eventDeckCount}`}>{view.eventDeckCount}</div>
      <div className="events-cards">
        {events.map((e, slot) => {
          const usable = !!view.options?.events[slot]?.usable;
          const selected = selection?.kind === 'event' && selection.slot === slot;
          return (
            <div
              key={`${slot}-${e.id}`}
              className={cls('event-card', usable && 'playable', selected && 'sel', e.used && 'used')}
              title={slot === 0 ? 'Quitte le jeu à la fin du tour' : undefined}
              onClick={() => onClick({ kind: 'event', slot })}
              onContextMenu={onRightClick(() => onInspect({ kind: 'event', slot }))}
              {...hoverHandlers(onHover, { kind: 'event', slot })}
            >
              <div className="ev-art" style={artStyle(e.art)}><ArtFallback art={e.art} icon={e.icon} /></div>
              {e.cost === null ? <div className="ev-tag">Permanent</div> : <div className="cost">{e.cost}</div>}
              {slot === 0 && <div className="ev-leaving">⌛</div>}
              <div className="ev-info">
                <div className="ev-name">{e.name}</div>
                <div className="ev-text">{e.text}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
