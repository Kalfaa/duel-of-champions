import { Fragment } from 'react';
import type { GameView, PlayerIndex, UnitView } from '../api/protocol';
import type { FlashMap } from '../game/flashes';
import type { Ghost } from '../game/ghosts';
import type { Lunge } from '../hooks/useGame';
import { slotKey, type Click, type Highlights, type Selection } from '../game/selection';
import type { Inspect } from './CardInspector';
import { ArtFallback, artStyle, ATTACK, cls, FlashMark, keywordIcons, onRightClick, StatBadges } from './common';
import { EventRow } from './EventRow';
import { HeroColumn } from './HeroColumn';

const ROWS = [0, 1] as const;
const LANES = [0, 1, 2, 3] as const;

interface Props {
  view: GameView;
  selection: Selection;
  highlights: Highlights;
  flashes: FlashMap;
  attacking: Lunge | null;
  ghosts: readonly Ghost[];
  onClick(click: Click): void;
  onInspect(target: Inspect): void;
  onOpenGrave(player: PlayerIndex): void;
}

/** Le joueur est toujours affiché à gauche (classe p0), l'adversaire à droite (p1). */
export function Battlefield({ view, selection, highlights, flashes, attacking, ghosts, onClick, onInspect, onOpenGrave }: Props) {
  const opponent: PlayerIndex = view.you === 0 ? 1 : 0;
  const sideOf = (player: PlayerIndex) => (player === view.you ? 'p0' : 'p1');

  const attackLane = (() => {
    if (attacking === null) return null;
    for (const p of view.players) {
      for (const row of ROWS) {
        const lane = p.board[row]!.findIndex(u => u?.uid === attacking.uid);
        if (lane !== -1) return lane;
      }
    }
    return null;
  })();

  const unit = (u: UnitView, player: PlayerIndex, dying = false) => {
    const kw = keywordIcons(u.keywords);
    const at = u.card.attackType ?? 'melee';
    return (
      <div
        className={cls('unit', sideOf(player), highlights.units.has(u.uid) && 'target',
          selection?.kind === 'unit' && selection.uid === u.uid && 'sel', attacking?.uid === u.uid && 'attacking', attacking?.uid === u.uid && attacking.riposte && 'riposte', dying && 'dying',
          player === view.current && u.exhausted && 'moved')}
        style={artStyle(u.card.art)}
        onContextMenu={dying ? undefined : onRightClick(() => onInspect({ kind: 'unit', uid: u.uid }))}
      >
        <ArtFallback art={u.card.art} icon={u.card.icon} />
        <span className="utag" title={ATTACK[at].name}>{ATTACK[at].icon}</span>
        {kw && <span className="ukw">{kw}</span>}
        {(u.stack > 1 || u.poison > 0 || u.enchantments.length > 0) && (
          <span className="ustate">
            {u.stack > 1 && <b title={`Pile de ${u.stack}`}>×{u.stack}</b>}
            {u.poison > 0 && <b className="poison" title={`Poison ${u.poison}`}>☠{u.poison}</b>}
            {u.enchantments.length > 0 && <b title={u.enchantments.join(', ')}>✨</b>}
          </span>
        )}
        <StatBadges atk={u.atk} ret={u.ret} hp={u.hpCur} hpMax={u.hpMax} />
        <FlashMark flash={flashes.get(`unit-${u.uid}`)} />
      </div>
    );
  };

  const slot = (player: PlayerIndex, row: number, lane: number) => {
    const u = view.players[player].board[row]?.[lane] ?? null;
    const ghost = ghosts.find(g => g.player === player && g.row === row && g.lane === lane);
    return (
      <div
        className={cls('slot', highlights.slots.has(slotKey(player, row, lane)) && 'target')}
        title={row === 0 ? 'Avant' : 'Arrière'}
        onClick={() => onClick({ kind: 'slot', player, row, lane })}
      >
        {u ? unit(u, player) : ghost && unit(ghost.unit, player, true)}
      </div>
    );
  };

  return (
    <div className="field">
      <div className="half l" style={{ backgroundImage: `url('/img/bg/${view.players[view.you].faction}.webp')` }} />
      <div className="half r" style={{ backgroundImage: `url('/img/bg/${view.players[opponent].faction}.webp')` }} />
      {/* Table de jeu vue en légère perspective, comme dans le jeu original */}
      <div className="table">
      <HeroColumn view={view} player={view.you} side="p0" highlights={highlights} flashes={flashes} onClick={onClick} onInspect={onInspect} onOpenGrave={onOpenGrave} />
      <div className="grid">
        {LANES.map(lane => (
          <Fragment key={lane}>
            {slot(view.you, 1, lane)}
            {slot(view.you, 0, lane)}
            <div className={cls('lane', attackLane === lane && 'hot')} />
            {slot(opponent, 0, lane)}
            {slot(opponent, 1, lane)}
          </Fragment>
        ))}
      </div>
      <HeroColumn view={view} player={opponent} side="p1" highlights={highlights} flashes={flashes} onClick={onClick} onInspect={onInspect} onOpenGrave={onOpenGrave} />
      </div>
      {/* Les deux événements sont posés à plat sous le champ de bataille */}
      <EventRow view={view} selection={selection} onClick={onClick} onInspect={onInspect} />
    </div>
  );
}
