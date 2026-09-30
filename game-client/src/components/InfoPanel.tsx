import type { CardView, DevelopChoice, GameView, PlayerIndex, UnitView } from '../api/protocol';
import type { Click } from '../game/selection';
import { ArtFallback, artStyle, keywordList, ReqBadges, typeLabel } from './common';

export type Hover =
  | { kind: 'hand'; index: number }
  | { kind: 'unit'; uid: number }
  | { kind: 'hero'; player: PlayerIndex };

interface Props {
  view: GameView;
  message: string;
  hover: Hover | null;
  onClick(click: Click): void;
}

function Head({ view, message, onClick }: Omit<Props, 'hover'>) {
  if (view.phase === 'over') return <>Partie terminée</>;
  if (view.pending) {
    const who = view.players[view.pending.player].hero.name;
    return view.pending.kind === 'card' ? <>{who} joue {view.pending.card.name}…</> : <>{who} utilise {view.pending.power.name}…</>;
  }
  const options = view.options;
  if (!options) return <>L'adversaire réfléchit…</>;
  if (message) return <>{message}</>;
  if (options.heroAction.available) {
    const dev = (choice: DevelopChoice, label: string) => <button onClick={() => onClick({ kind: 'develop', choice })}>{label}</button>;
    return <>Héros : {dev('m', '+1 Puissance')}{dev('g', '+1 Magie')}{dev('d', '+1 Destinée')}{dev('draw', 'Piocher (1💎)')} ou pouvoir</>;
  }
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

/** État particulier d'une créature sur le plateau : pile, poison, enchantements. */
function unitStatus(u: UnitView): string[] {
  const r: string[] = [];
  if (u.stack > 1) r.push(`📚 Pile de ${u.stack}`);
  if (u.poison) r.push(`☠️ Poison ${u.poison}`);
  if (u.enchantments.length) r.push(`✨ ${u.enchantments.join(', ')}`);
  return r;
}

function Body({ view, hover }: { view: GameView; hover: Hover | null }) {
  const hint = <div className="ihint">Survolez une carte pour voir ses détails.</div>;
  if (!hover) return hint;
  const me = view.players[view.you];

  if (hover.kind === 'hero') {
    const p = view.players[hover.player];
    const { hero } = p;
    return (
      <>
        <div className="iart" style={artStyle(hero.art)}><ArtFallback art={hero.art} icon={hero.icon} /></div>
        <div className="itext">
          <div className="iname">{hero.name}</div>
          <div className="itype">Héros – {p.factionLabel}</div>
          <div className="idesc"><b>✨ {hero.power.name} ({hero.power.cost}💎)</b> : {hero.power.text}</div>
          <div className="istats"><span className="hpv">❤ {p.hp}/{p.maxHp}</span><span>Deck {p.deckCount}</span><span>Main {p.handCount}</span></div>
        </div>
      </>
    );
  }

  if (hover.kind === 'hand') {
    const card = me.hand?.[hover.index];
    if (!card) return hint;
    return <CardDetails card={card} hp={card.type === 'creature' ? String(card.hp) : null} ownerStats={me} />;
  }

  for (const p of view.players) {
    for (const row of p.board) {
      const u = row.find(x => x?.uid === hover.uid);
      if (u) return <CardDetails card={{ ...u.card, atk: u.atk, ret: u.ret, keywords: u.keywords }} hp={`${u.hpCur}/${u.hpMax}`} status={unitStatus(u)} />;
    }
  }
  return hint;
}

export function InfoPanel({ view, message, hover, onClick }: Props) {
  return (
    <div className="info">
      <div className="ihead"><Head view={view} message={message} onClick={onClick} /></div>
      <div className="ibody"><Body view={view} hover={hover} /></div>
    </div>
  );
}
