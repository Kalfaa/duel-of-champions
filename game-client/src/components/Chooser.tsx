import type { GameView } from '../api/protocol';
import { currentStep, type Click, type Selection } from '../game/selection';
import { ArtFallback, artStyle } from './common';

interface Props {
  view: GameView;
  selection: Selection;
  onClick(click: Click): void;
}

/** Fenêtre de choix pour les étapes qui ne se désignent pas sur le plateau : option « au choix » ou carte d'une pile. */
export function Chooser({ view, selection, onClick }: Props) {
  const step = currentStep(view, selection);
  if (!step || !step.options.length || !step.options.every(o => o.kind === 'mode' || o.kind === 'card')) return null;
  return (
    <div className="chooser">
      <div className="chooser-box">
        <div className="chooser-title">{step.prompt}</div>
        <div className="chooser-options">
          {step.options.map((choice, i) => {
            const card = step.cards?.[i];
            const label = choice.kind === 'mode' ? step.labels?.[choice.index] ?? `Option ${choice.index + 1}` : card?.name ?? '?';
            return (
              <button key={i} className={card ? 'choice-card' : 'choice-mode'} onClick={() => onClick({ kind: 'choose', choice })}>
                {card && <div className="cart" style={artStyle(card.art)}><ArtFallback art={card.art} icon={card.icon} /></div>}
                <span>{label}</span>
              </button>
            );
          })}
        </div>
        <button className="chooser-cancel" onClick={() => onClick({ kind: 'cancel' })}>Annuler</button>
      </div>
    </div>
  );
}
