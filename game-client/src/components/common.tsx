import type { CSSProperties, MouseEvent } from 'react';
import type { AttackType, CardView, Keywords, PlayerView, StatKey } from '../api/protocol';
import type { Flash } from '../game/flashes';

export const STAT: Record<StatKey, { name: string }> = { m: { name: 'Puissance' }, g: { name: 'Magie' }, d: { name: 'Destinée' } };
export const ATTACK: Record<AttackType, { icon: string; name: string }> = {
  melee: { icon: '🗡️', name: 'Mêlée' },
  shooter: { icon: '🏹', name: 'Tireur' },
  flyer: { icon: '🪽', name: 'Volant' },
};

/** Icône de chaque école de magie ; une école inconnue garde une icône générique. */
const SCHOOL_ICONS: Readonly<Record<string, string>> = { 'Lumière': '☀️', 'Ténèbres': '🌙', 'Feu': '🔥' };
export const schoolIcon = (school: string): string => SCHOOL_ICONS[school] ?? '✨';

/** Pastilles des écoles de magie d'un héros. */
export function SchoolBadges({ schools }: { schools: readonly string[] }) {
  if (!schools.length) return null;
  return (
    <div className="schools">
      {schools.map(s => <span key={s} className="school" title={`Magie : ${s}`}>{schoolIcon(s)}</span>)}
    </div>
  );
}

export const cls = (...names: (string | false | null | undefined)[]): string => names.filter(Boolean).join(' ');

/** Gestionnaire de clic droit : remplace le menu contextuel et l'annulation de la sélection (écoutée sur le document). */
export const onRightClick = (fn: () => void) => (e: MouseEvent) => {
  e.preventDefault();
  e.stopPropagation();
  fn();
};

export const artStyle = (art: string | null | undefined): CSSProperties | undefined =>
  art ? { backgroundImage: `url('/img/art/${art}.webp')` } : undefined;

/** Nom, icône et description de chaque capacité ; N est la valeur de la capacité. */
const KEYWORDS: { [K in keyof Keywords]-?: { name: string; icon: string; desc: string } } = {
  noret: { name: 'Immunisé contre la riposte', icon: '🪶', desc: 'Aucune riposte ne lui est infligée.' },
  stackable: { name: 'Empilable', icon: '📚', desc: 'Une créature du même nom peut être déployée dessus : ses caractéristiques s\'additionnent.' },
  meleeGuard: { name: 'Garde contre la mêlée', icon: '🛡️', desc: 'Retire N aux dégâts de combat des créatures de mêlée contre elle et ses voisines.' },
  rangedGuard: { name: 'Garde contre les tireurs', icon: '🧱', desc: 'Retire N aux dégâts de combat des tireurs contre elle et ses voisines.' },
  heal: { name: 'Soin', icon: '✚', desc: 'Au ravitaillement, soigne N aux créatures alliées adjacentes.' },
  mending: { name: 'Rétablissement', icon: '💤', desc: 'En fin de tour, si elle n\'a pas attaqué, soigne toutes ses blessures.' },
  regen: { name: 'Régénération', icon: '♻️', desc: 'Au ravitaillement, soigne N.' },
  lifeDrain: { name: 'Drain de vie', icon: '🩸', desc: 'Quand elle inflige des dégâts d\'attaque, soigne N.' },
  infect: { name: 'Infection', icon: '☣️', desc: 'Ses dégâts d\'attaque posent N marqueurs de poison (1 dégât chacun à chaque ravitaillement).' },
  incorporeal: { name: 'Intangible', icon: '👻', desc: 'Les dégâts non magiques qu\'elle subit sont divisés par deux.' },
  charge: { name: 'Charge', icon: '🐎', desc: 'Attaque aussi l\'autre créature du couloir de la cible.' },
  sweep: { name: 'Attaque en balayage', icon: '〰️', desc: 'Attaque aussi les créatures voisines de la cible sur sa ligne.' },
  areaBlast: { name: 'Explosion', icon: '💥', desc: 'Inflige N dégâts aux créatures adjacentes à la cible.' },
  attackAnywhere: { name: 'Attaque n\'importe où', icon: '🎯', desc: 'Peut attaquer toute créature ennemie ; le héros seulement si son couloir est vide.' },
  taunt: { name: 'Provocation', icon: '📣', desc: 'Les créatures ennemies doivent l\'attaquer si elles le peuvent.' },
  imposeDiscard: { name: 'Chaos', icon: '🃏', desc: 'Chaque fois que l\'adversaire joue une carte, il défausse une carte au hasard.' },
};

const activeKeywords = (k: Keywords) =>
  (Object.keys(KEYWORDS) as (keyof Keywords)[]).flatMap(key => {
    const value = k[key];
    if (!value) return [];
    const n = typeof value === 'number' ? value : null;
    const { name, icon, desc } = KEYWORDS[key];
    return [{ name: n === null ? name : `${name} ${n}`, icon, desc: desc.replace(/\bN\b/g, String(n ?? '')) }];
  });

/** Capacités de la créature, avec leur description. */
export const keywordList = (k: Keywords): { name: string; desc: string }[] => activeKeywords(k).map(({ name, desc }) => ({ name, desc }));

export const keywordIcons = (k: Keywords): string => activeKeywords(k).filter(x => x.icon !== '📚').map(x => x.icon).join('');

export function typeLabel(c: CardView): string {
  if (c.type === 'creature' && c.attackType) return `Créature – ${ATTACK[c.attackType].icon} ${ATTACK[c.attackType].name}${c.magic ? ' magique' : ''}`;
  if (c.type === 'spell') return `Sort – ${c.school ?? ''}`;
  return 'Fortune';
}

/** Style d'un rond de vie : il est rempli par le bas en proportion des PV restants (variable CSS --hp, de 0 à 1). */
export const hpFillStyle = (hp: number, maxHp: number): CSSProperties =>
  ({ '--hp': maxHp > 0 ? Math.min(1, Math.max(0, hp / maxHp)) : 0 }) as CSSProperties;

/** Attaque, riposte et PV d'une créature ; sans `hpMax`, les PV sont considérés au maximum (carte en main). */
export function StatBadges({ atk, ret, hp, hpMax = hp }: { atk: number; ret: number; hp: number; hpMax?: number }) {
  return (
    <div className="ust">
      <span className="b atk" title="Attaque">{atk}</span>
      <span className="b ret" title="Riposte">{ret}</span>
      <span className={cls('b hp', hp < hpMax && 'dmg')} style={hpFillStyle(hp, hpMax)} title={`Points de vie : ${hp}/${hpMax}`}>{hp}</span>
    </div>
  );
}

/** Pastilles de conditions (Puissance / Magie / Destinée) ; en rouge si le joueur ne les remplit pas. */
export function ReqBadges({ req, player }: { req: CardView['req']; player?: PlayerView }) {
  return (
    <>
      {(Object.entries(req) as [StatKey, number][]).map(([k, v]) => (
        <span key={k} className={cls('sb', k, player && player[k] < v && 'miss')} title={`${STAT[k].name} ${v}`}>{v}</span>
      ))}
    </>
  );
}

export function FlashMark({ flash }: { flash: Flash | undefined }) {
  if (!flash) return null;
  return <div key={flash.id} className={cls('flash', flash.heal && 'heal')}>{flash.text}</div>;
}

/** Illustration de fond, ou l'emoji de la carte si elle n'en a pas. */
export function ArtFallback({ art, icon }: { art: string | null | undefined; icon: string }) {
  return art ? null : <span className="emoji">{icon}</span>;
}

/** Texte d'une carte : ses capacités puis son effet. */
export const cardText = (c: CardView): string => [...keywordList(c.keywords).map(k => k.name), c.text].filter(Boolean).join(' · ');

/**
 * Face d'une carte en petit (main, cimetière) : illustration, coût, conditions, caractéristiques et nom.
 * Avec `details`, le type et le texte sont aussi rendus (révélés en CSS au survol de la carte agrandie).
 */
export function CardFace({ card, player, cost = card.cost, details = false }: { card: CardView; player?: PlayerView; cost?: number; details?: boolean }) {
  const text = details ? cardText(card) : '';
  return (
    <>
      <div className="cart" style={artStyle(card.art)}><ArtFallback art={card.art} icon={card.icon} /></div>
      <div className={cls('cost', cost > card.cost && 'up')} title={cost > card.cost ? `Coût augmenté par un événement (${card.cost} de base)` : undefined}>{cost}</div>
      <div className="creqs"><ReqBadges req={card.req} player={player} /></div>
      {card.type === 'creature' && <StatBadges atk={card.atk ?? 0} ret={card.ret ?? 0} hp={card.hp ?? 0} />}
      <div className="cbar">
        <div className="cname">{card.name}</div>
        {details && <div className="itype">{typeLabel(card)}</div>}
        {text && <div className="ctext">{text}</div>}
      </div>
    </>
  );
}
