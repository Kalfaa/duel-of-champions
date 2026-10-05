import type { CardView, GameView } from '../api/protocol';
import { ArtFallback, artStyle, keywordList, ReqBadges, typeLabel } from './common';

/** Description d'une carte en petit (illustration, coût, conditions, capacités et caractéristiques), pour le cimetière. */
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
