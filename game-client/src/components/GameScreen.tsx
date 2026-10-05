import { useEffect, useMemo, useState } from 'react';
import type { GameView, PlayerIndex } from '../api/protocol';
import type { Lunge } from '../hooks/useGame';
import type { FlashMap } from '../game/flashes';
import type { Ghost } from '../game/ghosts';
import { highlights as computeHighlights, type Click, type UiState } from '../game/selection';
import { Battlefield } from './Battlefield';
import { CardInspector, resolveInspect, type Inspect } from './CardInspector';
import { Chooser } from './Chooser';
import { GraveViewer } from './GraveViewer';
import { GameLog } from './GameLog';
import { Hand } from './Hand';
import { HeroMenu } from './HeroMenu';
import { InfoPanel, type Hover } from './InfoPanel';
import { RevealedCard } from './RevealedCard';
import { TopBar } from './TopBar';
import { TurnBannerView } from './TurnBannerView';
import type { TurnBanner } from '../game/turns';

interface Props {
  view: GameView;
  ui: UiState;
  flashes: FlashMap;
  attacking: Lunge | null;
  ghosts: readonly Ghost[];
  turnBanner?: TurnBanner | null;
  onClick(click: Click): void;
  onLeave(): void;
}

const pendingKey = (pending: NonNullable<GameView['pending']>): string =>
  pending.kind === 'card' ? pending.card.id : pending.kind === 'event' ? pending.event.id : 'power';

export function GameScreen({ view, ui, flashes, attacking, ghosts, turnBanner = null, onClick, onLeave }: Props) {
  const [hover, setHover] = useState<Hover | null>(null);
  const [graveOf, setGraveOf] = useState<PlayerIndex | null>(null);
  const [inspect, setInspect] = useState<Inspect | null>(null);
  // La carte inspectée peut disparaître (créature détruite, carte jouée) : l'inspection se ferme alors d'elle-même
  const inspecting = inspect !== null && resolveInspect(view, inspect) !== null;
  const highlights = useMemo(() => computeHighlights(view, ui.selection), [view, ui.selection]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && inspecting) {
        setInspect(null);
        return;
      }
      if (e.key === 'Escape') {
        setGraveOf(null);
        onClick({ kind: 'cancel' });
      }
      if (e.key === ' ') {
        e.preventDefault();
        onClick({ kind: 'endTurn' });
      }
    };
    const onContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      if (inspecting) setInspect(null);
      else onClick({ kind: 'cancel' });
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('contextmenu', onContextMenu);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('contextmenu', onContextMenu);
    };
  }, [onClick, inspecting]);

  const confirmLeave = () => {
    if (view.phase === 'over' || window.confirm('Abandonner et revenir au menu ?')) onLeave();
  };

  return (
    <>
      <div className="game">
        <TopBar view={view} onClick={onClick} onMenu={confirmLeave} />
        <Battlefield view={view} selection={ui.selection} highlights={highlights} flashes={flashes} attacking={attacking} ghosts={ghosts} onClick={onClick} onHover={setHover} onInspect={setInspect} onOpenGrave={setGraveOf} />
        <div className="bottom">
          <Hand view={view} selection={ui.selection} highlights={highlights} onClick={onClick} onHover={setHover} onInspect={setInspect} />
          <InfoPanel view={view} message={ui.message} hover={hover} onClick={onClick} onInspect={setInspect} />
          <GameLog log={view.log} you={view.you} />
        </div>
      </div>
      {turnBanner && <TurnBannerView key={turnBanner.id} view={view} banner={turnBanner} />}
      {graveOf !== null && <GraveViewer view={view} player={graveOf} onClose={() => setGraveOf(null)} onInspect={setInspect} />}
      <HeroMenu view={view} selection={ui.selection} onClick={onClick} />
      <Chooser view={view} selection={ui.selection} onClick={onClick} onInspect={setInspect} />
      {view.pending && <RevealedCard key={`${view.log.length}-${pendingKey(view.pending)}`} view={view} />}
      {inspect && inspecting && <CardInspector view={view} target={inspect} onClose={() => setInspect(null)} />}
      {view.phase === 'over' && (
        <div className="overlay">
          <h1>{view.winner === view.you ? '🏆 Victoire !' : '💀 Défaite…'}</h1>
          <button onClick={onLeave}>Rejouer</button>
        </div>
      )}
    </>
  );
}
