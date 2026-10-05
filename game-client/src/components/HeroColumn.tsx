import type { GameView, PlayerIndex } from '../api/protocol';
import type { FlashMap } from '../game/flashes';
import type { Click, Highlights } from '../game/selection';
import type { Inspect } from './CardInspector';
import type { Hover } from './InfoPanel';
import { ArtFallback, artStyle, cls, FlashMark, hpFillStyle, onRightClick, SchoolBadges } from './common';

interface Props {
  view: GameView;
  player: PlayerIndex;
  side: 'p0' | 'p1';
  highlights: Highlights;
  flashes: FlashMap;
  onClick(click: Click): void;
  onHover(hover: Hover): void;
  onInspect(target: Inspect): void;
  onOpenGrave(player: PlayerIndex): void;
}

export function HeroColumn({ view, player, side, highlights, flashes, onClick, onHover, onInspect, onOpenGrave }: Props) {
  const p = view.players[player];
  const { hero } = p;
  const mine = player === view.you;
  // Le héros peut agir ce tour-ci : un clic dessus ouvre ses actions
  const ready = mine && !!view.options?.heroAction.available;
  const hover = () => onHover({ kind: 'hero', player });
  const inspect = onRightClick(() => onInspect({ kind: 'hero', player }));

  return (
    <div className={cls('herocol', side)}>
      <div
        className={cls('herocard', side, view.current === player && 'active', ready && 'ready', highlights.heroes.has(player) && 'target')}
        style={artStyle(hero.art)}
        onClick={() => onClick({ kind: 'hero', player })}
        onMouseEnter={hover}
        onContextMenu={inspect}
      >
        <ArtFallback art={hero.art} icon={hero.icon} />
        <SchoolBadges schools={hero.schools} />
        <div className="herohp" style={hpFillStyle(p.hp, p.maxHp)} title={`Points de vie : ${p.hp}/${p.maxHp}`}>{p.hp}</div>
        <FlashMark flash={flashes.get(`hero-${player}`)} />
      </div>
      <div className="power" title={hero.power.text} onMouseEnter={hover} onContextMenu={inspect}>
        ✨ {hero.power.name} · {hero.power.cost}💎
      </div>
      <div className="piles">
        <div className="pile deck" title="Bibliothèque"><span className="cnt">{p.deckCount}</span><small>Deck</small></div>
        <div className="pile grave" style={artStyle(p.grave.at(-1)?.art)} title="Consulter le cimetière" onClick={() => onOpenGrave(player)}>
          <span className="cnt">{p.grave.length}</span><small>Cimetière</small>
        </div>
      </div>
    </div>
  );
}
