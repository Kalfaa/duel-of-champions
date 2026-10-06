import type { GameView } from '../api/protocol';
import { CardBody, EventBody, HeroBody } from './CardInspector';
import { cls } from './common';

/**
 * Carte jouée, événement ou pouvoir du héros utilisé, montré le temps que le serveur le résolve : la carte telle qu'on
 * l'inspecte, en plus petit (pour un pouvoir, la carte du héros).
 */
export function RevealedCard({ view }: { view: GameView }) {
  const pending = view.pending;
  if (!pending) return null;
  const mine = pending.player === view.you;
  const who = mine ? 'Vous' : view.players[pending.player].hero.name;
  const player = view.players[pending.player];

  const [label, body] = pending.kind === 'power'
    ? [mine ? 'Vous utilisez votre pouvoir' : `${who} utilise son pouvoir`,
      <HeroBody player={{ ...player, hero: { ...player.hero, power: pending.power } }} />]
    : pending.kind === 'event'
      ? [mine ? 'Vous utilisez l\'événement' : `${who} utilise l'événement`, <EventBody event={pending.event} leaving={false} />]
      : [mine ? 'Vous jouez' : `${who} joue`, <CardBody card={pending.card} />];

  return (
    <div className={cls('reveal', mine ? 'p0' : 'p1')}>
      <div className="who">{label}</div>
      <div className="reveal-card">{body}</div>
    </div>
  );
}
