import type { CSSProperties } from 'react';
import type { GameView, LastingView, PlayerIndex } from '../api/protocol';
import type { Click, Highlights } from '../game/selection';
import { hoverHandlers, type Hover, type Inspect } from './CardInspector';
import { ArtFallback, artStyle, cls, onRightClick } from './common';

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

/**
 * Emplacement des cartes du joueur restées en jeu (sorts et fortunes permanents), toujours visible :
 * un clic choisit une carte (Arbre de vérité, Dissipation), un clic droit l'affiche en grand.
 */
export function LastingRow({ view, player, highlights, onClick, onInspect, onHover }: Props) {
  // Les enchantements de couloir sont posés au milieu du champ de bataille (voir LaneEnchantments)
  const lasting = view.players[player].lasting.filter(l => l.lane === null);
  return (
    <div className={cls('lasting-slot', !lasting.length && 'empty')} style={{ '--n': lasting.length } as CSSProperties} title={lasting.length ? undefined : 'Sorts et fortunes permanents'}>
      {!lasting.length && <span className="lasting-slot-label">Permanents</span>}
      {lasting.map(l => {
        const lane = l.lane === null ? '' : `couloir ${l.lane + 1}`;
        return (
          <div
            key={l.index}
            className={cls('lasting-card', l.card.type, highlights.lasting.has(l.index) && 'target')}
            style={artStyle(l.card.art)}
            title={`${l.card.name} (${[DURATION[l.duration], lane].filter(Boolean).join(', ')}) : ${l.card.text ?? ''}`}
            onClick={() => onClick({ kind: 'lasting', index: l.index })}
            onContextMenu={onRightClick(() => onInspect({ kind: 'card', card: l.card }))}
            {...hoverHandlers(onHover, { kind: 'card', card: l.card })}
          >
            <ArtFallback art={l.card.art} icon={l.card.icon} />
            {l.lane !== null && <span className="lasting-lane">{l.lane + 1}</span>}
            {l.duration !== 'permanent' && <span className="lasting-timer">⌛</span>}
          </div>
        );
      })}
    </div>
  );
}

/**
 * Case centrale d'un couloir, entre les deux camps : les cartes qui enchantent ce couloir (des deux joueurs) y sont
 * posées ; un clic les choisit, un clic droit les affiche en grand.
 */
export function LaneEnchantments({ view, lane, hot, highlights, onClick, onInspect, onHover }: {
  view: GameView;
  lane: number;
  hot: boolean;
  highlights: Highlights;
  onClick(click: Click): void;
  onInspect(target: Inspect): void;
  onHover?: Hover;
}) {
  const cards = view.players.flatMap((p, owner) => p.lasting.filter(l => l.lane === lane).map(l => ({ ...l, mine: owner === view.you })));
  return (
    <div className={cls('lane', hot && 'hot', cards.length > 0 && 'enchanted')}>
      {cards.map(l => (
        <div
          key={l.index}
          className={cls('lane-card', l.card.type, l.mine ? 'mine' : 'theirs', highlights.lasting.has(l.index) && 'target')}
          style={artStyle(l.card.art)}
          title={`${l.card.name} (${l.mine ? 'à vous' : 'adverse'}, ${DURATION[l.duration]}) : ${l.card.text ?? ''}`}
          onClick={() => onClick({ kind: 'lasting', index: l.index })}
          onContextMenu={onRightClick(() => onInspect({ kind: 'card', card: l.card }))}
          {...hoverHandlers(onHover, { kind: 'card', card: l.card })}
        >
          <ArtFallback art={l.card.art} icon={l.card.icon} />
          {l.duration !== 'permanent' && <span className="lasting-timer">⌛</span>}
        </div>
      ))}
    </div>
  );
}
