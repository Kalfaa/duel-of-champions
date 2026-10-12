import { useCallback, useEffect, useMemo, useState } from 'react';
import type { GameView, PlayerIndex } from '../api/protocol';
import type { Lunge } from '../hooks/useGame';
import type { FlashMap } from '../game/flashes';
import type { Ghost } from '../game/ghosts';
import { highlights as computeHighlights, type Click, type UiState } from '../game/selection';
import { Battlefield } from './Battlefield';
import { CardInspector, CardPreview, resolveInspect, type Hover, type Inspect } from './CardInspector';
import { Chooser } from './Chooser';
import { GraveViewer } from './GraveViewer';
import { Hand } from './Hand';
import { HeroMenu } from './HeroMenu';
import { LogPanel } from './LogPanel';
import { OpponentHand } from './OpponentHand';
import { RevealedCard } from './RevealedCard';
import { TopBar } from './TopBar';
import { TurnBannerView } from './TurnBannerView';
import type { TurnBanner } from '../game/turns';
import type { Draw } from '../game/draws';

interface Props {
  view: GameView;
  ui: UiState;
  flashes: FlashMap;
  attacking: Lunge | null;
  ghosts: readonly Ghost[];
  turnBanner?: TurnBanner | null;
  drawn?: Draw | null;
  onClick(click: Click): void;
  /** Avant le premier tour : garder sa main de départ (false) ou en piocher une nouvelle (true). */
  onMulligan(redraw: boolean): void;
  onLeave(): void;
}

const pendingKey = (pending: NonNullable<GameView['pending']>): string =>
  pending.kind === 'card' ? pending.card.id : pending.kind === 'event' ? pending.event.id : 'power';

export function GameScreen({ view, ui, flashes, attacking, ghosts, turnBanner = null, drawn = null, onClick, onMulligan, onLeave }: Props) {
  const [graveOf, setGraveOf] = useState<PlayerIndex | null>(null);
  const [inspect, setInspect] = useState<Inspect | null>(null);
  const [logOpen, setLogOpen] = useState(false);
  const [hover, setHover] = useState<Inspect | null>(null);
  const onHover = useCallback<Hover>(target => setHover(target), []);
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
        setLogOpen(false);
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
        <TopBar view={view} onClick={onClick} onMenu={confirmLeave} onLog={() => setLogOpen(open => !open)} />
        <Battlefield view={view} selection={ui.selection} highlights={highlights} flashes={flashes} attacking={attacking} ghosts={ghosts} onClick={onClick} onInspect={setInspect} onOpenGrave={setGraveOf} onHover={onHover} />
        <div className="bottom">
          <Hand view={view} selection={ui.selection} highlights={highlights} drawn={drawn} onClick={onClick} onInspect={setInspect} onHover={onHover} />
          <OpponentHand view={view} drawn={drawn} onInspect={setInspect} onHover={onHover} />
        </div>
      </div>
      {turnBanner && <TurnBannerView key={turnBanner.id} view={view} banner={turnBanner} />}
      {logOpen && <LogPanel view={view} onClose={() => setLogOpen(false)} />}
      {graveOf !== null && <GraveViewer view={view} player={graveOf} onClose={() => setGraveOf(null)} onInspect={setInspect} />}
      <HeroMenu view={view} selection={ui.selection} onClick={onClick} />
      <Chooser view={view} selection={ui.selection} onClick={onClick} onInspect={setInspect} />
      {view.pending && <RevealedCard key={`${view.log.length}-${pendingKey(view.pending)}`} view={view} />}
      {inspect && inspecting && <CardInspector view={view} target={inspect} onClose={() => setInspect(null)} />}
      {hover && !inspecting && <CardPreview view={view} target={hover} />}
      {view.phase === 'mulligan' && <MulliganBox canMulligan={view.canMulligan} onMulligan={onMulligan} />}
      {view.phase === 'over' && (
        <div className="overlay">
          <h1>{view.winner === view.you ? '🏆 Victoire !' : '💀 Défaite…'}</h1>
          <button onClick={onLeave}>Rejouer</button>
        </div>
      )}
    </>
  );
}

/** Début de partie : garder sa main de départ ou la changer une fois, puis attendre l'adversaire. */
export function MulliganBox({ canMulligan, onMulligan }: { canMulligan: boolean; onMulligan(redraw: boolean): void }) {
  return (
    <div className="mulligan-box" role="dialog" aria-label="Main de départ">
      {canMulligan ? (
        <>
          <b>Votre main de départ</b>
          <p>Vous pouvez la garder, ou la remélanger dans votre bibliothèque et piocher une nouvelle main (une seule fois).</p>
          <div className="mulligan-actions">
            <button onClick={() => onMulligan(false)}>Garder cette main</button>
            <button onClick={() => onMulligan(true)}>Changer de main</button>
          </div>
        </>
      ) : (
        <>
          <div className="spinner" />
          <p>En attente du choix de l'adversaire…</p>
        </>
      )}
    </div>
  );
}
