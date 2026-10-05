import type { CardView, EventView, GameView, PlayerView, UnitView } from '../api/protocol';
import type { Hover } from './InfoPanel';
import { ArtFallback, artStyle, cls, hpFillStyle, keywordList, onRightClick, ReqBadges, SchoolBadges, schoolIcon, StatBadges, typeLabel } from './common';

/** Carte à inspecter : un élément du plateau ou de la main (comme au survol), ou une carte isolée (cimetière, choix). */
export type Inspect = Hover | { kind: 'card'; card: CardView };

type Inspected =
  | { kind: 'card'; card: CardView; owner?: PlayerView; unit?: UnitView }
  | { kind: 'hero'; player: PlayerView }
  | { kind: 'event'; event: EventView; leaving: boolean };

/** Retrouve la carte inspectée dans l'état courant de la partie ; `null` si elle n'y est plus (créature détruite, carte jouée). */
export function resolveInspect(view: GameView, target: Inspect): Inspected | null {
  switch (target.kind) {
    case 'card':
      return { kind: 'card', card: target.card };
    case 'hero':
      return { kind: 'hero', player: view.players[target.player] };
    case 'event': {
      const event = view.events[target.slot];
      return event ? { kind: 'event', event, leaving: target.slot === 0 } : null;
    }
    case 'hand': {
      const me = view.players[view.you];
      const card = me.hand?.[target.index];
      return card ? { kind: 'card', card, owner: me } : null;
    }
    case 'unit':
      for (const p of view.players) {
        for (const row of p.board) {
          const unit = row.find(u => u?.uid === target.uid);
          if (unit) return { kind: 'card', card: unit.card, unit };
        }
      }
      return null;
  }
}

/** État particulier d'une créature sur le plateau : pile, poison, enchantements. */
function unitStatus(u: UnitView): string[] {
  const r: string[] = [];
  if (u.stack > 1) r.push(`📚 Pile de ${u.stack}`);
  if (u.poison) r.push(`☠️ Poison ${u.poison}`);
  if (u.enchantments.length) r.push(`✨ ${u.enchantments.join(', ')}`);
  return r;
}

function CardBody({ card, owner, unit }: { card: CardView; owner?: PlayerView; unit?: UnitView }) {
  const keywords = keywordList(unit?.keywords ?? card.keywords);
  return (
    <div className={cls('icard', card.type)}>
      <div className="icard-art" style={artStyle(card.art)}><ArtFallback art={card.art} icon={card.icon} /></div>
      <div className="icard-name">{card.name}</div>
      <div className="icard-cost">{card.cost}</div>
      <div className="icard-reqs"><ReqBadges req={card.req} player={owner} /></div>
      {card.type === 'creature' && (unit
        ? <StatBadges atk={unit.atk} ret={unit.ret} hp={unit.hpCur} hpMax={unit.hpMax} />
        : <StatBadges atk={card.atk ?? 0} ret={card.ret ?? 0} hp={card.hp ?? 0} />)}
      <div className="icard-box">
        <div className="icard-type">{typeLabel(card)}</div>
        <div className="icard-text">
          {keywords.map(k => <p key={k.name}><b>{k.name}</b> ({k.desc})</p>)}
          {card.text && <p>{card.text}</p>}
          {!keywords.length && !card.text && <p className="icard-none">Aucune capacité.</p>}
          {unit && unitStatus(unit).map(s => <p key={s} className="icard-status">{s}</p>)}
        </div>
      </div>
    </div>
  );
}

function HeroBody({ player }: { player: PlayerView }) {
  const { hero } = player;
  // Comme sur la carte officielle, la bannière ne montre que les caractéristiques non nulles
  const base = Object.fromEntries(Object.entries(hero.base).filter(([, v]) => v > 0));
  return (
    <div className="icard hero">
      <div className="icard-art" style={artStyle(hero.art)}><ArtFallback art={hero.art} icon={hero.icon} /></div>
      <div className="icard-name">{hero.name}</div>
      <div className="icard-reqs icard-base" title="Caractéristiques de départ"><ReqBadges req={base} /></div>
      <SchoolBadges schools={hero.schools} />
      <div className="ust"><span className="b hp" style={hpFillStyle(player.hp, player.maxHp)} title={`Points de vie : ${player.hp}/${player.maxHp}`}>{player.hp}</span></div>
      <div className="icard-box">
        <div className="icard-type">Héros – {player.factionLabel}</div>
        <div className="icard-text">
          {hero.schools.length > 0 && <p><b>Magie</b> : {hero.schools.map(s => `${schoolIcon(s)} ${s}`).join(', ')}</p>}
          <p><b>✨ {hero.power.name} · {hero.power.cost}💎</b> ({hero.power.text})</p>
          <p className="icard-status">Deck {player.deckCount} · Main {player.handCount} · Cimetière {player.grave.length}</p>
        </div>
      </div>
    </div>
  );
}

function EventBody({ event, leaving }: { event: EventView; leaving: boolean }) {
  return (
    <div className="icard event">
      <div className="icard-art" style={artStyle(event.art)}><ArtFallback art={event.art} icon={event.icon} /></div>
      <div className="icard-name">{event.name}</div>
      {event.cost !== null && <div className="icard-cost">{event.cost}</div>}
      <div className="icard-box">
        <div className="icard-type">Événement{event.ongoing ? ' – Permanent' : ''}</div>
        <div className="icard-text">
          <p>{event.text}</p>
          {!event.ongoing && <p className="icard-status">Chaque joueur peut l'utiliser une fois par tour.</p>}
          {event.used && <p className="icard-status">Déjà utilisé ce tour-ci.</p>}
          {leaving && <p className="icard-status">⌛ Quitte le jeu à la fin du tour.</p>}
        </div>
      </div>
    </div>
  );
}

interface Props {
  view: GameView;
  target: Inspect;
  onClose(): void;
}

/** Carte affichée en grand avec tout son texte ; un clic (gauche ou droit) la referme. */
export function CardInspector({ view, target, onClose }: Props) {
  const inspected = resolveInspect(view, target);
  if (!inspected) return null;
  return (
    <div className="inspect" onClick={onClose} onContextMenu={onRightClick(onClose)}>
      {inspected.kind === 'hero' ? <HeroBody player={inspected.player} />
        : inspected.kind === 'event' ? <EventBody event={inspected.event} leaving={inspected.leaving} />
        : <CardBody {...inspected} />}
      <div className="inspect-hint">Clic ou Échap pour fermer</div>
    </div>
  );
}
