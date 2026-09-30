import type { GameView, PlayerIndex } from '../api/protocol';
import type { FlashMap } from '../game/flashes';
import type { Click, Highlights } from '../game/selection';
import type { Hover } from './InfoPanel';
import { ArtFallback, artStyle, cls, FlashMark, hpFillStyle } from './common';

interface Props {
  view: GameView;
  player: PlayerIndex;
  side: 'p0' | 'p1';
  highlights: Highlights;
  flashes: FlashMap;
  onClick(click: Click): void;
  onHover(hover: Hover): void;
  onOpenGrave(player: PlayerIndex): void;
}

export function HeroColumn({ view, player, side, highlights, flashes, onClick, onHover, onOpenGrave }: Props) {
  const p = view.players[player];
  const { hero } = p;
  const mine = player === view.you;
  const ready = mine && !!view.options?.power.usable;
  const hover = () => onHover({ kind: 'hero', player });

  return (
    <div className="herocol">
      <div
        className={cls('herocard', side, view.current === player && 'active', highlights.heroes.has(player) && 'target')}
        style={artStyle(hero.art)}
        onClick={() => onClick({ kind: 'hero', player })}
        onMouseEnter={hover}
      >
        <ArtFallback art={hero.art} icon={hero.icon} />
        <div className="herohp" style={hpFillStyle(p.hp, p.maxHp)} title={`Points de vie : ${p.hp}/${p.maxHp}`}>{p.hp}</div>
        <FlashMark flash={flashes.get(`hero-${player}`)} />
      </div>
      <button
        className={cls('power', ready && 'ready')}
        disabled={!ready}
        onClick={mine ? () => onClick({ kind: 'power' }) : undefined}
        onMouseEnter={hover}
      >
        ✨ {hero.power.name} · {hero.power.cost}💎
      </button>
      <div className="piles">
        <div className="pile deck" title="Bibliothèque"><span className="cnt">{p.deckCount}</span><small>Deck</small></div>
        <div className="pile grave" style={artStyle(p.grave.at(-1)?.art)} title="Consulter le cimetière" onClick={() => onOpenGrave(player)}>
          <span className="cnt">{p.grave.length}</span><small>Cimetière</small>
        </div>
      </div>
    </div>
  );
}
