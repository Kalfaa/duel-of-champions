import type { GameView } from '../api/protocol';
import { ArtFallback, artStyle, cls, keywordList, ReqBadges, StatBadges, typeLabel } from './common';

/** Carte jouée ou pouvoir du héros utilisé, affiché en grand le temps que le serveur le résolve. */
export function RevealedCard({ view }: { view: GameView }) {
  const pending = view.pending;
  if (!pending) return null;
  const mine = pending.player === view.you;
  const who = mine ? 'Vous' : view.players[pending.player].hero.name;

  if (pending.kind === 'power') {
    const { hero } = view.players[pending.player];
    const { power } = pending;
    return (
      <div className={cls('reveal', mine ? 'p0' : 'p1')}>
        <div className="who">{mine ? 'Vous utilisez votre pouvoir' : `${who} utilise son pouvoir`}</div>
        <div className="card power">
          <div className="cart" style={artStyle(hero.art)}><ArtFallback art={hero.art} icon={hero.icon} /></div>
          <div className="cost">{power.cost}</div>
          <div className="cbar">
            <div className="cname">✨ {power.name}</div>
            <div className="itype">{hero.name}</div>
            <div className="ctext">{power.text}</div>
          </div>
        </div>
      </div>
    );
  }

  if (pending.kind === 'event') {
    const { event } = pending;
    return (
      <div className={cls('reveal', mine ? 'p0' : 'p1')}>
        <div className="who">{mine ? 'Vous utilisez l\'événement' : `${who} utilise l'événement`}</div>
        <div className="card event">
          <div className="cart" style={artStyle(event.art)}><ArtFallback art={event.art} icon={event.icon} /></div>
          {event.cost !== null && <div className="cost">{event.cost}</div>}
          <div className="cbar">
            <div className="cname">{event.name}</div>
            <div className="itype">Événement</div>
            <div className="ctext">{event.text}</div>
          </div>
        </div>
      </div>
    );
  }

  const { card } = pending;
  const text = [...keywordList(card.keywords).map(k => k.name), card.text].filter(Boolean).join(' · ');
  return (
    <div className={cls('reveal', mine ? 'p0' : 'p1')}>
      <div className="who">{mine ? 'Vous jouez' : `${who} joue`}</div>
      <div className={cls('card', card.type)}>
        <div className="cart" style={artStyle(card.art)}><ArtFallback art={card.art} icon={card.icon} /></div>
        <div className="cost">{card.cost}</div>
        <div className="creqs"><ReqBadges req={card.req} /></div>
        {card.type === 'creature' && <StatBadges atk={card.atk ?? 0} ret={card.ret ?? 0} hp={card.hp ?? 0} />}
        <div className="cbar">
          <div className="cname">{card.name}</div>
          <div className="itype">{typeLabel(card)}</div>
          {text && <div className="ctext">{text}</div>}
        </div>
      </div>
    </div>
  );
}
