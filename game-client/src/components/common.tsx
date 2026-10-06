import type { CSSProperties, MouseEvent } from 'react';
import type { AttackType, CardView, ExpansionView, FactionId, Keywords, PlayerView, Rarity, StatKey } from '../api/protocol';
import type { Flash } from '../game/flashes';

export const STAT: Record<StatKey, { name: string }> = { m: { name: 'Puissance' }, g: { name: 'Magie' }, d: { name: 'Destinée' } };
export const ATTACK: Record<AttackType, { icon: string; name: string }> = {
  melee: { icon: '🗡️', name: 'Mêlée' },
  shooter: { icon: '🏹', name: 'Tireur' },
  flyer: { icon: '🪽', name: 'Volant' },
};

export const RARITY: Record<Rarity, string> = {
  common: 'Commune', uncommon: 'Peu commune', rare: 'Rare', unique: 'Unique', heroic: 'Héroïque',
};

/** Gemme de rareté, sous le nom de la carte ; sa couleur dépend de la rareté. */
export function RarityGem({ rarity }: { rarity: Rarity }) {
  return <span className={cls('rarity', rarity)} title={`Rareté : ${RARITY[rarity]}`} />;
}

/** Emblème d'une faction (en losange). */
export function FactionIcon({ faction, label, className }: { faction: FactionId | 'neutre'; label: string; className?: string }) {
  return <img className={cls('faction-icon', className)} src={`/img/faction/${faction}.webp`} alt={label} />;
}

/** Blason en haut à droite de la carte : sa faction, l'école de magie d'un sort, ou « Neutre ». */
export function FactionCrest({ faction, school = null }: { faction: { id: FactionId; label: string } | null; school?: string | null }) {
  const [title, icon] = faction ? [`Faction : ${faction.label}`, <FactionIcon faction={faction.id} label={faction.label} />]
    : school ? [`École de magie : ${school}`, <SchoolIcon school={school} />]
    : ['Faction : Neutre', <FactionIcon faction="neutre" label="Neutre" />];
  return <div className={cls('crest', !faction && school && 'school-crest')} title={title}>{icon}</div>;
}

/** Icône de l'extension, en bas à droite du texte de la carte. */
export function ExpansionMark({ expansion }: { expansion: ExpansionView }) {
  return <img className="expansion" src={`/img/expansion/${expansion.image}.png`} alt={expansion.name} title={`Extension : ${expansion.name}`} />;
}

/** Image de chaque école de magie ; une école inconnue garde une icône générique. */
const SCHOOL_IMAGES: Readonly<Record<string, string>> = {
  'Lumière': 'lumiere', 'Ténèbres': 'tenebres', 'Feu': 'feu', 'Eau': 'eau', 'Air': 'air', 'Terre': 'terre', 'Primordiale': 'primordiale',
};

/** Emblème rond d'une école de magie. */
export function SchoolIcon({ school }: { school: string }) {
  const image = SCHOOL_IMAGES[school];
  return image ? <img className="school-icon" src={`/img/school/${image}.webp`} alt={school} /> : <>✨</>;
}

/** Pastilles des écoles de magie d'un héros. */
export function SchoolBadges({ schools }: { schools: readonly string[] }) {
  if (!schools.length) return null;
  return (
    <div className="schools">
      {schools.map(s => <span key={s} className="school" title={`Magie : ${s}`}><SchoolIcon school={s} /></span>)}
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
  meleeGuard: { name: 'Garde mêlée', icon: '🛡️', desc: 'Retire N aux dégâts de combat des créatures de mêlée contre elle et ses voisines.' },
  rangedGuard: { name: 'Garde distance', icon: '🧱', desc: 'Retire N aux dégâts de combat des tireurs contre elle et ses voisines.' },
  heal: { name: 'Soin', icon: '✚', desc: 'Au ravitaillement, soigne N aux créatures alliées adjacentes.' },
  mending: { name: 'Rétablissement', icon: '💤', desc: 'En fin de tour, si elle n\'a pas attaqué, soigne toutes ses blessures.' },
  regen: { name: 'Régénération', icon: '♻️', desc: 'Au ravitaillement, soigne N.' },
  lifeDrain: { name: 'Drain de vie', icon: '🩸', desc: 'Quand elle inflige des dégâts d\'attaque, soigne N.' },
  infect: { name: 'Infection', icon: '☣️', desc: 'Ses dégâts d\'attaque posent N marqueurs de poison (1 dégât chacun à chaque ravitaillement).' },
  incorporeal: { name: 'Intangible', icon: '👻', desc: 'Les dégâts non magiques qu\'elle subit sont divisés par deux.' },
  charge: { name: 'Charge', icon: '🐎', desc: 'Attaque aussi l\'autre créature du couloir de la cible.' },
  sweep: { name: 'Attaque en balayage', icon: '〰️', desc: 'Attaque aussi les créatures voisines de la cible sur sa ligne.' },
  areaBlast: { name: 'Explosion', icon: '💥', desc: 'Inflige N dégâts aux créatures adjacentes à la cible.' },
  attackAnywhere: { name: 'Ubiquité', icon: '🎯', desc: 'Peut attaquer toute créature ennemie ; le héros seulement si son couloir est vide.' },
  taunt: { name: 'Provocation', icon: '📣', desc: 'Les créatures ennemies doivent l\'attaquer si elles le peuvent.' },
  imposeDiscard: { name: 'Chaos', icon: '🃏', desc: 'Chaque fois que l\'adversaire joue une carte, il défausse une carte au hasard.' },
  retribution: { name: 'Rétribution', icon: '⚔️', desc: 'Riposte même si elle meurt de l\'attaque.' },
  preemptive: { name: 'Frappe préventive', icon: '⏱️', desc: 'Riposte avant que l\'attaquant n\'inflige ses dégâts.' },
  fireBurst: { name: 'Explosion de feu', icon: '🔥', desc: 'À sa mort, inflige N dégâts de feu aux créatures de son couloir, des deux côtés.' },
  fireHeal: { name: 'Soin par le feu', icon: '♨️', desc: 'Les dégâts de feu qu\'elle subit la soignent à la place.' },
  crippling: { name: 'Estropiement', icon: '🦵', desc: 'Ses dégâts d\'attaque posent N marqueurs d\'estropiement (-1 en attaque et en riposte chacun).' },
  darkWard: { name: 'Protection contre les ténèbres', icon: '🌑', desc: 'Ne peut pas être ciblée par les sorts de Ténèbres et ignore leurs dégâts.' },
  deathTouch: { name: 'Assassinat', icon: '☠️', desc: 'Détruit toute créature à qui elle inflige des dégâts de combat.' },
  packBonus: { name: 'Meute', icon: '🐺', desc: 'Gagne +N en attaque et en riposte par créature alliée adjacente.' },
  retAura: { name: 'Inspiration', icon: '🛡️', desc: 'Les autres créatures alliées gagnent +N en riposte.' },
  supplyStrike: { name: 'Appel du Néant', icon: '🌀', desc: 'Au ravitaillement, inflige N dégâts au héros ennemi.' },
  supplyDraw: { name: 'Clairvoyance', icon: '👁️', desc: 'Au ravitaillement, son propriétaire pioche N cartes de plus.' },
  trample: { name: 'Piétinement', icon: '🦶', desc: 'Quand elle détruit une créature en attaquant, l\'excédent de dégâts touche le héros ennemi.' },
  deathCurse: { name: 'Vengeance', icon: '💀', desc: 'Si elle meurt pendant le tour adverse, inflige N dégâts au héros ennemi.' },
  deathDraw: { name: 'Destin scellé', icon: '🔮', desc: 'Quand elle ou une autre créature alliée meurt, son propriétaire pioche une carte.' },
  recycle: { name: 'Éternel retour', icon: '🔁', desc: 'Quand elle doit aller au cimetière, elle est remélangée dans la bibliothèque.' },
  honor: { name: 'Honneur', icon: '🎌', desc: 'Les créatures alliées adjacentes gagnent +N en attaque et en riposte.' },
  hypnotize: { name: 'Hypnose', icon: '🌀', desc: 'Les créatures ennemies de son couloir sont immobilisées.' },
  frozenTouch: { name: 'Toucher glacé', icon: '❄️', desc: 'La créature à qui elle inflige des dégâts d\'attaque ne peut ni attaquer ni bouger jusqu\'au prochain tour de son propriétaire.' },
  magicShield: { name: 'Bouclier magique', icon: '🔰', desc: 'Ne subit aucun dégât des sorts ni des créatures magiques.' },
  lucky: { name: 'Chanceuse', icon: '🍀', desc: 'La Destinée de son propriétaire augmente de N tant qu\'elle est en jeu.' },
  enemyBonus: { name: 'Colosse', icon: '💪', desc: 'Gagne +N en attaque et en riposte par créature ennemie.' },
  blockLane: { name: 'Gardienne du couloir', icon: '🚧', desc: 'Les créatures ennemies ne peuvent pas être déployées dans son couloir.' },
  outmanoeuvre: { name: 'Déjouer', icon: '↔️', desc: 'En arrivant en jeu, déplace une créature ennemie ciblée.' },
  waterBlast: { name: 'Marée', icon: '🌊', desc: 'Les autres créatures alliées de l\'Eau gagnent Explosion N.' },
  blackmail: { name: 'Chantage', icon: '🥷', desc: 'La première fois par tour qu\'elle blesse le héros ennemi au combat, la production de son propriétaire augmente de 1.' },
  rampage: { name: 'Arme ardente', icon: '🗡️', desc: 'Gagne un marqueur +1 en attaque chaque fois qu\'elle attaque.' },
  burning: { name: 'Combustion', icon: '🔥', desc: 'Subit N dégâts de feu au début du tour de chaque joueur.' },
  needsCompany: { name: 'Solitude fatale', icon: '🫂', desc: 'Détruite dès qu\'elle n\'a plus de créature alliée adjacente.' },
  enrage: { name: 'Rage', icon: '😡', desc: 'Quand une autre créature alliée meurt, reçoit N marqueurs de rage (+1 en attaque et en riposte chacun), retirés après son attaque.' },
  magicResist: { name: 'Résistance à la magie', icon: '🧿', desc: 'Les dégâts des sorts et des créatures magiques sont divisés par deux.' },
  doubleAttack: { name: 'Double attaque', icon: '⚔️', desc: 'Si elle survit à sa première attaque, elle attaque une seconde fois.' },
  quickAttack: { name: 'Attaque rapide', icon: '⚡', desc: 'Peut attaquer ou se déplacer le tour de son déploiement.' },
  armor: { name: 'Armure', icon: '🪖', desc: 'Retire N aux dégâts de combat qu\'elle subit.' },
  mightStats: { name: 'Seigneur de guerre', icon: '👑', desc: 'Son attaque et sa riposte sont égales à la Puissance de son propriétaire.' },
  bloodDiscount: { name: 'Charognard', icon: '🦴', desc: 'Coûte 1 ressource de moins par créature mise au cimetière ce tour-ci.' },
  bloodPact: { name: 'Pacte de sang', icon: '🩸', desc: 'En arrivant, détruit deux autres créatures alliées ciblées ; son attaque et sa riposte valent leurs PV restants cumulés.' },
  fear: { name: 'Peur', icon: '😨', desc: 'Ne peut pas être attaquée par une créature qui exige N ou moins en Puissance.' },
  towering: { name: 'Imposante', icon: '🗻', desc: 'Les autres créatures alliées de son couloir ne peuvent être ni attaquées ni blessées au combat.' },
  noAttack: { name: 'Ne peut pas attaquer', icon: '🚫', desc: 'Cette créature ne peut pas attaquer.' },
  swift: { name: 'Rapide', icon: '💨', desc: 'Peut attaquer et se déplacer le même tour.' },
  fortuneWard: { name: 'Protection contre les fortunes', icon: '🍀', desc: 'Ni ciblée ni affectée par les fortunes.' },
  enemySpellWard: { name: 'Protection contre les sorts ennemis', icon: '🛡️', desc: 'Ni ciblée ni affectée par les sorts adverses.' },
  untargetable: { name: 'Insaisissable', icon: '🫥', desc: 'Ne peut pas être ciblée.' },
  magicChannel: { name: 'Canal magique', icon: '🔷', desc: 'La Magie de son propriétaire augmente de N tant qu\'elle est en jeu.' },
  noCounters: { name: 'Sans marqueurs', icon: '⭕', desc: 'Aucun marqueur ne peut être posé sur elle.' },
  earthHeal: { name: 'Soin par la terre', icon: '🪨', desc: 'Les dégâts de terre qu\'elle subit la soignent à la place.' },
  flyerGuard: { name: 'Garde volants', icon: '🪽', desc: 'Retire N aux dégâts de combat des volants contre elle et ses voisines.' },
  spellResist: { name: 'Résistance aux sorts', icon: '📕', desc: 'Les dégâts des sorts sont divisés par deux.' },
  berserk: { name: 'Berserk', icon: '🤬', desc: 'Au début de la phase d\'action de son propriétaire, attaque d\'office la première cible à sa portée.' },
  berserkAura: { name: 'Folie contagieuse', icon: '🤪', desc: 'Les créatures ennemies de son couloir gagnent Berserk.' },
  perfectRetaliation: { name: 'Riposte parfaite', icon: '🎯', desc: 'Ses dégâts de riposte ne peuvent pas être réduits.' },
  bloodthirst: { name: 'Soif de sang', icon: '🩸', desc: 'Quand une créature ennemie meurt, reçoit N marqueurs de rage.' },
  anchored: { name: 'Ancrée', icon: '⚓', desc: 'Ne peut être ni déplacée ni échangée.' },
  destroysAttacker: { name: 'Riposte fatale', icon: '☠️', desc: 'Après avoir été attaquée, détruit la créature qui l\'a attaquée.' },
  punish: { name: 'Représailles', icon: '💥', desc: 'Après avoir été attaquée, inflige N dégâts à la créature qui l\'a attaquée.' },
  handLimit: { name: 'Mains vides', icon: '✋', desc: 'Au début du tour de chaque joueur, il défausse au hasard jusqu\'à garder N cartes.' },
  leaveDiscard: { name: 'Malédiction du départ', icon: '🚪', desc: 'Si elle quitte le jeu pendant le tour adverse, l\'adversaire défausse une carte au hasard.' },
  deathDiscard: { name: 'Dernier outrage', icon: '🗑️', desc: 'Si elle meurt pendant votre tour, l\'adversaire défausse une carte au hasard.' },
  heroRegen: { name: 'Prière', icon: '🙏', desc: 'Au début de votre tour, soigne N blessures de votre héros.' },
  spellBonus: { name: 'Canalisation', icon: '🔮', desc: 'Gagne +N en attaque et en riposte par sort permanent en jeu.' },
  infectAura: { name: 'Contagion', icon: '🦠', desc: 'Les autres créatures alliées avec Infection gagnent +N en Infection.' },
  noExtraDraw: { name: 'Interdiction de piocher', icon: '🚱', desc: 'Personne ne peut piocher en dehors de sa phase de ravitaillement.' },
  banishDead: { name: 'Gardien du Néant', icon: '🕳️', desc: 'Les autres créatures qui meurent sont bannies au lieu d\'aller au cimetière.' },
  soulFeed: { name: 'Dévoreuse d\'âmes', icon: '👻', desc: 'Quand une créature meurt, soigne N blessures de celle-ci.' },
  noResourceGain: { name: 'Avarice', icon: '💰', desc: 'Les cartes et capacités ne peuvent plus faire gagner de ressources.' },
  discardRage: { name: 'Destin plié', icon: '🌀', desc: '+N en attaque tant que l\'adversaire a défaussé une carte ce tour-ci.' },
  spellsmasher: { name: 'Brise-sorts', icon: '💥', desc: 'Quand elle attaque, détruit un sort permanent ciblé.' },
  replaces: { name: 'Relève', icon: '🔁', desc: 'Peut se déployer sur une créature alliée, qui retourne dans la main de son propriétaire.' },
  chains: { name: 'Chaînes maudites', icon: '⛓️', desc: 'Au début du tour de son propriétaire, celui-ci subit N dégâts.' },
  shell: { name: 'Carapace de glace', icon: '🧊', desc: 'Les prochains dégâts qu\'elle subit sont annulés et la carapace se brise.' },
  warchant: { name: 'Chant de guerre', icon: '🥁', desc: 'À la fin de votre tour, vos créatures avec Rage reçoivent N marqueurs de rage.' },
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
