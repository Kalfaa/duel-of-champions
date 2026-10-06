import { sameChoice, type Choice, type GameView } from '../api/protocol';
import { currentStep, stepOptions, type Click, type Selection } from '../game/selection';
import type { Inspect } from './CardInspector';
import { ArtFallback, artStyle, cls, onRightClick } from './common';

interface Props {
  view: GameView;
  selection: Selection;
  onClick(click: Click): void;
  onInspect(target: Inspect): void;
}

/**
 * Fenêtre de choix pour les étapes qui ne se désignent pas sur le plateau : option « au choix » ou carte d'une pile.
 * Elle sert aussi aux choix après résolution ; quand ceux-ci se font sur le plateau, elle reste discrète et ne montre
 * que la consigne et les boutons.
 */
export function Chooser({ view, selection, onClick, onInspect }: Props) {
  if (view.pick) return <PickChooser view={view} onClick={onClick} onInspect={onInspect} />;
  const step = currentStep(view, selection);
  const options = step && selection && 'choices' in selection ? stepOptions(step, selection.choices) : [];
  if (!step || !options.length || !options.every(o => o.kind === 'mode' || o.kind === 'card')) return null;
  return (
    <div className="chooser">
      <div className="chooser-box">
        <div className="chooser-title">{step.prompt}</div>
        <div className="chooser-options">
          {options.map((choice, i) => {
            const card = step.cards?.[step.options.findIndex(o => sameChoice(o, choice))];
            const label = choice.kind === 'mode' ? step.labels?.[choice.index] ?? `Option ${choice.index + 1}` : card?.name ?? '?';
            return (
              <button key={i} className={card ? 'choice-card' : 'choice-mode'} onClick={() => onClick({ kind: 'choose', choice })}
                onContextMenu={card ? onRightClick(() => onInspect({ kind: 'card', card })) : undefined}>
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

function PickChooser({ view, onClick, onInspect }: Omit<Props, 'selection'>) {
  const pick = view.pick!;
  const buttons = pick.options.filter(o => o.kind === 'mode' || o.kind === 'card');
  const onBoard = buttons.length < pick.options.length;
  const cardOf = (choice: Choice) => (choice.kind === 'card' ? pick.cards.find(c => c.id === choice.cardId) : undefined);
  return (
    <div className={cls('chooser', onBoard && 'compact')}>
      <div className="chooser-box">
        <div className="chooser-title">{pick.prompt}</div>
        <div className="chooser-options">
          {buttons.map((choice, i) => {
            const card = cardOf(choice);
            const label = choice.kind === 'mode' ? pick.labels?.[choice.index] ?? `Option ${choice.index + 1}` : card?.name ?? '?';
            return (
              <button key={i} className={card ? 'choice-card' : 'choice-mode'} onClick={() => onClick({ kind: 'pick', choice })}
                onContextMenu={card ? onRightClick(() => onInspect({ kind: 'card', card })) : undefined}>
                {card && <div className="cart" style={artStyle(card.art)}><ArtFallback art={card.art} icon={card.icon} /></div>}
                <span>{label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
