import type { GameView, LastingView, PlayerIndex } from '../api/protocol';
import type { Click, Highlights } from '../game/selection';
import { hoverHandlers, type Hover, type Inspect } from './CardInspector';
import { cls, onRightClick } from './common';

const DURATION: Record<LastingView['duration'], string> = {
  endOfTurn: 'jusqu\'à la fin du tour',
  nextTurn: 'jusqu\'au prochain tour de son joueur',
  permanent: 'permanent',
};

interface Props {
  view: GameView;
  player: PlayerIndex;
  highlights: Highlights;
  onClick(click: Click): void;
  onInspect(target: Inspect): void;
  onHover?: Hover;
}

/** Cartes du joueur restées en jeu : un clic la choisit (Arbre de vérité), un clic droit l'affiche en grand. */
export function LastingRow({ view, player, highlights, onClick, onInspect, onHover }: Props) {
  const { lasting } = view.players[player];
  if (!lasting.length) return null;
  return (
    <div className="lasting">
      {lasting.map(l => {
        const lane = l.lane === null ? '' : `couloir ${l.lane + 1}`;
        return (
          <div
            key={l.index}
            className={cls('lasting-card', l.card.type, highlights.lasting.has(l.index) && 'target')}
            title={`${l.card.name} (${[DURATION[l.duration], lane].filter(Boolean).join(', ')}) : ${l.card.text ?? ''}`}
            onClick={() => onClick({ kind: 'lasting', index: l.index })}
            onContextMenu={onRightClick(() => onInspect({ kind: 'card', card: l.card }))}
            {...hoverHandlers(onHover, { kind: 'card', card: l.card })}
          >
            {l.card.icon} {l.card.name}{lane && <small> · {lane}</small>}
          </div>
        );
      })}
    </div>
  );
}
