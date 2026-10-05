import type { CardView, GameView, PlayerIndex } from '../api/protocol';
import type { Click } from '../game/selection';
import { ArtFallback, artStyle, keywordList, ReqBadges, typeLabel } from './common';

export type Hover =
  | { kind: 'hand'; index: number }
  | { kind: 'unit'; uid: number }
  | { kind: 'hero'; player: PlayerIndex }
  /** Un des deux événements en jeu. */
  | { kind: 'event'; slot: number };

interface Props {
  view: GameView;
  message: string;
  hover: Hover | null;
  onClick(click: Click): void;
  onInspect(target: Hover): void;
}

function Head({ view, message, onClick }: Omit<Props, 'hover' | 'onInspect'>) {
  if (view.phase === 'over') return <>Partie terminée</>;
  if (view.pending) {
    const who = view.players[view.pending.player].hero.name;
    switch (view.pending.kind) {
      case 'card': return <>{who} joue {view.pending.card.name}…</>;
      case 'power': return <>{who} utilise {view.pending.power.name}…</>;
      case 'event': return <>{who} utilise l'événement {view.pending.event.name}…</>;
    }
  }
  const options = view.options;
  if (!options) return <>L'adversaire réfléchit…</>;
  if (message) return <>{message}</>;
  if (options.heroAction.available) return <>Cliquez sur votre héros pour développer une caractéristique, piocher ou utiliser son pouvoir.</>;
  return <>Jouez vos cartes, attaquez ou déplacez vos créatures, puis terminez le tour.</>;
}

export function CardDetails({ card, hp, ownerStats, status = [] }: { card: CardView; hp: string | null; ownerStats?: GameView['players'][number]; status?: string[] }) {
  const keywords = keywordList(card.keywords).map(k => <div key={k.name}><b>{k.name}</b> : {k.desc}</div>);
  return (
    <>
      <div className="iart" style={artStyle(card.art)}><ArtFallback art={card.art} icon={card.icon} /></div>
      <div className="itext">
        <div className="iname">{card.name}</div>
        <div className="itype">{typeLabel(card)}</div>
        <div className="ireqs">
          <span className="cost" style={{ position: 'static', width: 22, height: 22, fontSize: 12 }}>{card.cost}</span>
          <ReqBadges req={card.req} player={ownerStats} />
        </div>
        <div className="idesc">
          {keywords}
          {card.text ?? (keywords.length ? null : <i style={{ color: '#9c8c70' }}>Aucune capacité.</i>)}
          {status.map(s => <div key={s} className="istatus">{s}</div>)}
        </div>
        {hp !== null && (
          <div className="istats"><span className="atk">🗡 {card.atk}</span><span className="ret">↺ {card.ret}</span><span className="hpv">❤ {hp}</span></div>
        )}
      </div>
    </>
  );
}

export function InfoPanel({ view, message, hover, onClick, onInspect }: Props) {
  return (
    <div className="info">
      <div className="ihead">
        <Head view={view} message={message} onClick={onClick} />
        {/* Sur écran tactile, pas de clic droit : ce bouton ouvre en grand la dernière carte touchée */}
        {hover && <button className="izoom" title="Voir la carte en grand" onClick={() => onInspect(hover)}>🔍</button>}
      </div>
    </div>
  );
}
