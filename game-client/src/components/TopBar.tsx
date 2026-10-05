import type { GameView, PlayerIndex, StatKey } from '../api/protocol';
import type { Click } from '../game/selection';
import { cls, STAT } from './common';

interface Props {
  view: GameView;
  onClick(click: Click): void;
  onMenu(): void;
}

function Side({ view, player, side }: { view: GameView; player: PlayerIndex; side: 'p0' | 'p1' }) {
  const p = view.players[player];
  const stat = (k: StatKey) => <span className={cls('sb', k)} title={STAT[k].name}>{p[k]}</span>;
  return (
    <div className={cls('tb-side', side, view.current === player && 'active')}>
      <div className={cls('banner', p.faction)}>{p.factionIcon}</div>
      <div className="pinfo">
        <div className="pname">{p.hero.name}</div>
        <div className="statrow">
          {stat('m')}{stat('g')}{stat('d')}
          <span className="psub">Main {p.handCount}</span>
        </div>
      </div>
      <div className="resc" title="Ressources"><b>{p.res}</b><small>{p.maxRes}</small></div>
    </div>
  );
}

export function TopBar({ view, onClick, onMenu }: Props) {
  const opponent: PlayerIndex = view.you === 0 ? 1 : 0;
  const label = view.phase === 'over' ? 'Fin' : view.current !== view.you ? 'Tour adverse' : 'Fin du tour';
  return (
    <div className="topbar">
      <button className="menubtn" title="Menu" onClick={onMenu}>⚙</button>
      <Side view={view} player={view.you} side="p0" />
      <button className="endturn" onClick={() => onClick({ kind: 'endTurn' })} disabled={!view.options?.canEndTurn}>
        {label}<small>Tour {Math.ceil(view.turn / 2)}</small>
      </button>
      <Side view={view} player={opponent} side="p1" />
    </div>
  );
}
