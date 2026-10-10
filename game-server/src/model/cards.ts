import type { Game, LastingCard, Unit } from './game';
import { ALLOWED_ROWS, other, STAT_NAMES, type AttackType, type ExpansionId, type FactionId, type Keywords, type Choice, type PlayerIndex, type Rarity, type StatKey } from './types';

/** Contexte du calcul des options : la carte jouée ne peut pas se choisir elle-même dans la main. */
export interface StepContext {
  handIndex: number | null;
}

/** Un choix à faire en jouant la carte (cible, carte de la main, ligne, option…). */
export interface Step {
  /** Consigne affichée au joueur. */
  prompt: string;
  options(game: Game, pi: PlayerIndex, ctx: StepContext): Choice[];
  /**
   * Options qui dépendent des choix faits aux étapes précédentes (dans l'ordre) ; elles remplacent alors `options`,
   * qui doit en être l'union.
   */
  after?(game: Game, pi: PlayerIndex, previous: readonly Choice[]): Choice[];
  /** Libellés des options d'un choix « au choix » (choix de type `mode`). */
  labels?: readonly string[];
  /** Le choix doit différer de celui fait à l'étape indiquée. */
  distinctFrom?: number;
  /** Raison donnée quand aucune option n'est disponible. */
  emptyReason?: string;
}

export interface EffectInput {
  choices: readonly Choice[];
  /** Cartes retirées de la main par les choix `hand`, dans l'ordre des étapes. */
  taken: readonly string[];
  /** Créature qui vient d'arriver en jeu, pour un effet à l'arrivée. */
  self?: number;
}

export interface Effect {
  steps: readonly Step[];
  apply(game: Game, pi: PlayerIndex, input: EffectInput): void;
  /** Valeur ajoutée par l'IA à l'effet, quand elle ne se voit pas immédiatement sur le plateau. */
  aiBonus?(game: Game, pi: PlayerIndex): number;
  /** Raison pour laquelle la carte ne peut pas être jouée en ce moment, ou null. */
  requirement?(game: Game, pi: PlayerIndex): string | null;
}

interface CardBase {
  id: string;
  name: string;
  rarity: Rarity;
  /** null pour une carte neutre. */
  faction: FactionId | null;
  expansion: ExpansionId;
  cost: number;
  req: Partial<Record<StatKey, number>>;
  icon: string;
  /** Nom de l'illustration dans img/art/ (sans extension) ; sans illustration, l'icône est affichée. */
  art?: string;
  text?: string;
}

export interface CreatureCard extends CardBase {
  type: 'creature';
  atk: number;
  ret: number;
  hp: number;
  attackType: AttackType;
  /** Créature magique : ses dégâts sont magiques. */
  magic: boolean;
  /** École de magie de la créature : ses dégâts sont de cette école (dégâts de feu…). */
  school?: string;
  keywords: Keywords;
  /** Effet quand elle arrive en jeu ; ses choix suivent celui de la case. Sans cible possible, il n'a pas lieu. */
  arrival?: Effect;
}

/**
 * Règles d'une carte qui reste en jeu (sort global ou de couloir, fortune permanente) ; `entry` est la carte en jeu,
 * avec son propriétaire. Chaque règle ne s'applique que tant que la carte est en jeu.
 */
export interface LastingRules {
  /** Jusqu'à la fin du tour, jusqu'au prochain tour de son propriétaire, ou tant qu'elle n'est pas détruite. */
  duration: 'endOfTurn' | 'nextTurn' | 'permanent';
  /** Elle cible un couloir (choix `lane`), qu'elle enchante. */
  lane?: boolean;
  attackBonus?(game: Game, unit: Unit, entry: LastingCard): number;
  retaliationBonus?(game: Game, unit: Unit, entry: LastingCard): number;
  keywords?(game: Game, unit: Unit, entry: LastingCard): Keywords;
  cannotAttack?(game: Game, unit: Unit, entry: LastingCard): boolean;
  untargetable?(game: Game, unit: Unit, entry: LastingCard): boolean;
  /** Coût d'une carte jouée par `pi` : remplacé (valeur retournée) ou inchangé (null). */
  costOverride?(game: Game, pi: PlayerIndex, card: Card, entry: LastingCard): number | null;
  /** Modification du coût d'une carte jouée par `pi`. */
  costDelta?(game: Game, pi: PlayerIndex, card: Card, entry: LastingCard): number;
  /** Le joueur `pi` ne peut pas déployer de créature. */
  forbidsDeploy?(game: Game, pi: PlayerIndex, entry: LastingCard): boolean;
  /** La production du joueur `pi` est réduite de moitié à son ravitaillement. */
  halvesSupply?(game: Game, pi: PlayerIndex, entry: LastingCard): boolean;
  /** Dégâts d'un sort de cette école réduits de moitié. */
  halvesSpellDamage?(school: string): boolean;
  /** Aucun marqueur ne peut être posé sur cette créature. */
  blocksCounters?(game: Game, unit: Unit, entry: LastingCard): boolean;
  /** L'attaque de chaque créature est égale à sa riposte. */
  attackEqualsRetaliation?: boolean;
  /** Les créatures ennemies ne peuvent attaquer qu'une par ligne et par tour. */
  oneAttackPerLine?: boolean;
  /** Détruite quand son propriétaire n'a plus de créature. */
  needsCreatures?: boolean;
  /** Une créature de mêlée ou volante de son couloir qui attaque reçoit N marqueurs de poison, et la carte est détruite. */
  poisonsAttackers?: number;
  /** Les créatures alliées gardent leurs marqueurs de rage quand elles attaquent. */
  keepsEnrage?: boolean;
  /** Détruite quand une créature alliée avec Rage furibonde meurt. */
  fragileToEnragedDeath?: boolean;
  /** Capacités retirées à toutes les créatures. */
  suppresses?: readonly (keyof Keywords)[];
  /** Couloir enchanté : une créature ennemie de ce couloir qui attaque est ensuite bannie. */
  banishesAttackers?: boolean;
  /** Couloir enchanté : une créature qui y est déployée ou déplacée subit N dégâts. */
  laneDamage?: number;
  /** Au début du tour de son propriétaire, une créature non unique de son cimetière revient dans sa main. */
  recallEachTurn?: boolean;
  /** Les dégâts subis par les créatures alliées de la ligne avant sont divisés par deux. */
  halvesFrontDamage?: boolean;
  /** Quand une créature alliée meurt, la Puissance de son propriétaire augmente de 1. */
  mightOnDeath?: boolean;
  /** Les joueurs ne peuvent pas piocher en dehors de leur phase de ravitaillement. */
  noExtraDraw?: boolean;
  /** Types de carte au choix (choix `mode`) : celui choisi devient le sujet de la carte en jeu. */
  subjects?: readonly Card['type'][];
  /** L'adversaire qui joue une carte du type choisi défausse une carte au hasard. */
  punishesPlays?: boolean;
  /** Tant qu'aucune créature de mêlée alliée n'a attaqué pendant le tour de son propriétaire, ses créatures gagnent ensuite ces bonus jusqu'à son prochain tour. */
  phalanx?: boolean;
}

export interface ActionCard extends CardBase {
  type: 'spell' | 'fortune';
  school?: string;
  /** Sort permanent : il reste attaché à la créature enchantée jusqu'à sa disparition. */
  ongoing?: boolean;
  /** La carte reste en jeu avec ces règles après son effet. */
  lasting?: LastingRules;
  /** Sort permanent : au début du tour de son lanceur, détruit la créature enchantée et retourne dans sa main (Mort silencieuse). */
  killsAndReturns?: boolean;
  effect: Effect;
}

export type Card = CreatureCard | ActionCard;

/**
 * Source de dégâts : seuls les dégâts non magiques sont réduits par Incorporel ; l'école compte pour le feu et les ténèbres,
 * et les dégâts des sorts sont marqués comme tels. Des dégâts imparables (Riposte parfaite) ne sont réduits par rien.
 */
export interface DamageSource {
  magic: boolean;
  school?: string;
  spell?: boolean;
  unpreventable?: boolean;
}
export const MAGIC: DamageSource = { magic: true };
const LIGHT: DamageSource = { magic: true, school: 'Lumière', spell: true };
const DARK: DamageSource = { magic: true, school: 'Ténèbres', spell: true };
export const FIRE: DamageSource = { magic: true, school: 'Feu', spell: true };
const AIR: DamageSource = { magic: true, school: 'Air', spell: true };
const WATER: DamageSource = { magic: true, school: 'Eau', spell: true };
/** Dégâts infligés par une fortune ou une capacité : ni magiques, ni d'une école. */
const PLAIN: DamageSource = { magic: false };

// ------------------------------------------------------------------
//  Étapes de choix réutilisables
// ------------------------------------------------------------------
type Side = 'any' | 'ally' | 'enemy';

const unitsOn = (game: Game, pi: PlayerIndex, side: Side) =>
  side === 'ally' ? game.units(pi) : side === 'enemy' ? game.units(other(pi)) : [...game.units(pi), ...game.units(other(pi))];

/** Une créature ciblée ; les créatures qui ne peuvent pas être ciblées (Ange gardien…) sont exclues. */
export const creatureStep = (prompt: string, side: Side, filter: (game: Game, cardId: string) => boolean = () => true, distinctFrom?: number): Step => ({
  prompt, distinctFrom, emptyReason: 'Aucune cible valide.',
  options: (game, pi) => unitsOn(game, pi, side)
    .filter(x => filter(game, x.unit.cardId) && game.isTargetable(x.unit.uid))
    .map((x): Choice => ({ kind: 'unit', uid: x.unit.uid })),
});

/** Déjouer, pouvoir de Noboru, Rafale : la créature ennemie à déplacer, puis sa nouvelle case. */
export const RELOCATE_TARGET: Step = {
  prompt: 'Choisissez la créature ennemie à déplacer.',
  emptyReason: 'Aucune créature ennemie à déplacer.',
  options: (game, pi) => game.units(other(pi))
    .filter(x => game.isTargetable(x.unit.uid) && !game.keywordsOf(x.unit).anchored)
    .map((x): Choice => ({ kind: 'unit', uid: x.unit.uid })),
};

export const RELOCATE_DESTINATION: Step = {
  prompt: 'Choisissez sa nouvelle case (sa case actuelle pour la laisser en place).',
  options: () => [],
  after: (game, _pi, previous) => game.relocationCells(unitChoice(previous[previous.length - 1])),
};

/** Une carte permanente en jeu (sort ou fortune), des deux joueurs. */
const lastingStep = (prompt: string, types: readonly Card['type'][]): Step => ({
  prompt, emptyReason: 'Aucune carte permanente en jeu.',
  options: g => g.lasting.flatMap((entry, index): Choice[] => (types.includes(getCard(entry.cardId).type) ? [{ kind: 'lasting', index }] : [])),
});

const laneStep = (prompt: string): Step => ({
  prompt,
  options: () => [0, 1, 2, 3].map((lane): Choice => ({ kind: 'lane', lane })),
});

export const handStep = (prompt: string, filter: (card: Card) => boolean = () => true, emptyReason = 'Aucune carte à choisir dans votre main.'): Step => ({
  prompt, emptyReason,
  options: (game, pi, ctx) => game.player(pi).hand
    .map((id, index) => ({ id, index }))
    .filter(c => c.index !== ctx.handIndex && filter(getCard(c.id)))
    .map((c): Choice => ({ kind: 'hand', index: c.index })),
});

const zoneStep = (prompt: string, zone: 'library' | 'grave', filter: (card: Card) => boolean, emptyReason: string): Step => ({
  prompt, emptyReason,
  options: (game, pi) => {
    const p = game.player(pi);
    const ids = [...new Set(zone === 'library' ? p.deck : p.grave)].filter(id => filter(getCard(id))).sort();
    return ids.map((cardId): Choice => ({ kind: 'card', zone, cardId }));
  },
});

const lineStep = (prompt: string): Step => ({
  prompt,
  options: (_game, pi) => [pi, other(pi)].flatMap(player => [0, 1].map((row): Choice => ({ kind: 'line', player, row }))),
});

export const unitChoice = (pick: Choice | undefined): number => {
  if (pick?.kind !== 'unit') throw new Error('Ce choix doit être une créature.');
  return pick.uid;
};

const cardChoice = (pick: Choice | undefined): string => {
  if (pick?.kind !== 'card') throw new Error('Ce choix doit être une carte.');
  return pick.cardId;
};

export const costAtMost = (n: number) => (_game: Game, cardId: string): boolean => getCard(cardId).cost <= n;

// ------------------------------------------------------------------
//  Constructeurs
// ------------------------------------------------------------------
/** Carte telle qu'écrite dans la liste : sa faction et son extension viennent de sa section. */
type Draft<T extends Card> = Omit<T, 'faction' | 'expansion'>;

const creature = (c: Omit<Draft<CreatureCard>, 'type' | 'keywords' | 'magic'> & { keywords?: Keywords; magic?: boolean }): Draft<CreatureCard> =>
  ({ type: 'creature', keywords: {}, magic: false, ...c });
const spell = (c: Omit<Draft<ActionCard>, 'type'>): Draft<ActionCard> => ({ type: 'spell', ...c });
const fortune = (c: Omit<Draft<ActionCard>, 'type'>): Draft<ActionCard> => ({ type: 'fortune', ...c });
/** Cartes d'une faction (null : neutres) dans une extension ; un sort n'a pas de faction, mais une école de magie. */
const section = (faction: FactionId | null, expansion: ExpansionId, cards: (Draft<CreatureCard> | Draft<ActionCard>)[]): Card[] =>
  cards.map((c): Card => (c.type === 'creature'
    ? { ...c, faction, expansion }
    : { ...c, faction: c.type === 'spell' ? null : faction, expansion }));
export const effect = (steps: readonly Step[], apply: Effect['apply'], opts: Pick<Effect, 'aiBonus' | 'requirement'> = {}): Effect =>
  ({ steps, apply, ...opts });

/** Puissance, Magie, Destinée, dans l'ordre des choix « au choix ». */
const STAT_KEYS: readonly StatKey[] = ['m', 'g', 'd'];

const damageAll = (g: Game, pi: PlayerIndex, n: number, source: DamageSource) => g.units(pi).forEach(x => g.damageUnit(x.unit.uid, n, source));

const CARD_LIST: Card[] = [
  // ----------------------------- HAVRE -----------------------------
  ...section('havre', 'base', [
    creature({ id: 'ecuyerElite', name: 'Écuyer d\'élite', rarity: 'uncommon', cost: 2, req: { m: 2 }, atk: 1, ret: 2, hp: 3, attackType: 'melee', icon: '🛡️', art: 'Elite_squire', keywords: { rangedGuard: 2 } }),
    creature({ id: 'arbaletrierImperial', name: 'Arbalétrier impérial', rarity: 'common', cost: 1, req: { m: 1 }, atk: 1, ret: 0, hp: 2, attackType: 'shooter', icon: '🏹', art: 'Imperial_crossbowman', keywords: { noret: true, stackable: true } }),
    creature({ id: 'sentinelleImperiale', name: 'Sentinelle impériale', rarity: 'common', cost: 1, req: { m: 1 }, atk: 1, ret: 1, hp: 2, attackType: 'melee', icon: '⚔️', art: 'Imperial_sentinel', keywords: { meleeGuard: 1, stackable: true } }),
    creature({ id: 'soeurDevouee', name: 'Sœur dévouée', rarity: 'common', cost: 2, req: { m: 1, g: 1 }, atk: 1, ret: 1, hp: 4, attackType: 'shooter', magic: true, icon: '🕊️', art: 'Devoted_sister', keywords: { noret: true, heal: 2 } }),
    creature({ id: 'griffonLoyal', name: 'Griffon loyal', rarity: 'common', cost: 2, req: { m: 2 }, atk: 2, ret: 1, hp: 4, attackType: 'flyer', icon: '🦅', art: 'Loyal_griffin' }),
    creature({ id: 'vestale', name: 'Vestale', rarity: 'rare', cost: 4, req: { m: 3, g: 2 }, atk: 1, ret: 1, hp: 7, attackType: 'shooter', magic: true, icon: '📿', art: 'Vestal_card', keywords: { noret: true, heal: 3, mending: true } }),
    creature({ id: 'cavalierSolaire', name: 'Cavalier solaire', rarity: 'common', cost: 3, req: { m: 3 }, atk: 2, ret: 1, hp: 5, attackType: 'melee', icon: '🐎', art: 'Sun_rider_card', keywords: { noret: true, charge: true } }),
    creature({ id: 'seraphinGuerrier', name: 'Séraphin guerrier', rarity: 'uncommon', cost: 4, req: { m: 4 }, atk: 3, ret: 2, hp: 6, attackType: 'flyer', icon: '👼', art: 'Warrior_seraph', keywords: { regen: 2, taunt: true } }),
    spell({
      id: 'soin', name: 'Soin', rarity: 'common', school: 'Lumière', cost: 1, req: { g: 1 }, icon: '💧', art: 'Heal_card',
      text: 'Soigne 3 blessures d\'une créature ciblée.',
      effect: effect([creatureStep('Choisissez la créature à soigner.', 'any')], (g, _pi, { choices }) => g.healUnit(unitChoice(choices[0]), 3)),
    }),
    spell({
      id: 'benediction', name: 'Bénédiction', rarity: 'common', school: 'Lumière', cost: 3, req: { g: 3 }, icon: '💪', art: 'Bless_card', ongoing: true,
      text: 'Enchante une créature alliée. Permanent : elle gagne +2 en attaque.',
      effect: effect([creatureStep('Choisissez la créature alliée à bénir.', 'ally')],
        (g, pi, { choices }) => g.enchant(unitChoice(choices[0]), 'benediction', pi, { atk: 2 })),
    }),
    spell({
      id: 'paroleLumiere', name: 'Parole de lumière', rarity: 'common', school: 'Lumière', cost: 4, req: { g: 4 }, icon: '⚡', art: 'Word_of_Light_card',
      text: 'Inflige 2 dégâts à toutes les créatures ennemies.',
      effect: effect([], (g, pi) => damageAll(g, other(pi), 2, LIGHT)),
    }),
    fortune({
      id: 'avantPoste', name: 'Avant-poste fortifié', rarity: 'common', cost: 2, req: { d: 2 }, icon: '🧱', art: 'Fortified_outpost',
      text: 'Au choix : piochez une carte, OU si vous avez moins de créatures que l\'adversaire sur le champ de bataille, gagnez 4 ressources.',
      effect: effect([{
        prompt: 'Choisissez un effet.',
        labels: ['Piocher une carte', 'Gagner 4 ressources'],
        options: (g, pi) => {
          const modes: Choice[] = [{ kind: 'mode', index: 0 }];
          if (g.units(pi).length < g.units(other(pi)).length) modes.push({ kind: 'mode', index: 1 });
          return modes;
        },
      }], (g, pi, { choices }) => {
        if (choices[0]?.kind === 'mode' && choices[0].index === 1) g.gainResources(pi, 4);
        else g.draw(pi, 1);
      }),
    }),
  ]),

  // ---------------------------- NÉCROPOLE ----------------------------
  ...section('necropole', 'base', [
    creature({ id: 'squeletteLancier', name: 'Squelette lancier', rarity: 'common', cost: 1, req: { m: 1 }, atk: 1, ret: 0, hp: 2, attackType: 'shooter', icon: '💀', art: 'Skeleton_spearman', keywords: { noret: true, stackable: true } }),
    creature({ id: 'squelettePestifere', name: 'Squelette pestiféré', rarity: 'common', cost: 2, req: { m: 2 }, atk: 1, ret: 0, hp: 3, attackType: 'shooter', icon: '🦴', art: 'Plague_skeleton', keywords: { noret: true, infect: 1, stackable: true } }),
    creature({ id: 'gouleMiserable', name: 'Goule misérable', rarity: 'common', cost: 1, req: { m: 1 }, atk: 2, ret: 1, hp: 2, attackType: 'melee', icon: '🧟', art: 'Wretched_ghoul' }),
    creature({ id: 'licheNeophyte', name: 'Liche néophyte', rarity: 'common', cost: 2, req: { m: 2, g: 1 }, atk: 2, ret: 0, hp: 4, attackType: 'shooter', magic: true, icon: '🧙', art: 'Neophyte_lich', keywords: { noret: true } }),
    creature({ id: 'fantomeErrant', name: 'Fantôme errant', rarity: 'common', cost: 2, req: { m: 2, g: 1 }, atk: 2, ret: 1, hp: 3, attackType: 'flyer', magic: true, icon: '👻', art: 'Lingering_ghost', keywords: { incorporeal: true } }),
    creature({ id: 'chevalierVampire', name: 'Chevalier vampire', rarity: 'uncommon', cost: 3, req: { m: 3 }, atk: 2, ret: 0, hp: 5, attackType: 'flyer', icon: '🧛', art: 'Vampire_knight', keywords: { noret: true, lifeDrain: 2 } }),
    creature({ id: 'archiliche', name: 'Archiliche', rarity: 'uncommon', cost: 4, req: { m: 4, g: 1 }, atk: 3, ret: 1, hp: 6, attackType: 'shooter', magic: true, icon: '☠️', art: 'Archlich_card', keywords: { noret: true, lifeDrain: 2 } }),
    creature({ id: 'dragonSpectral', name: 'Dragon spectral', rarity: 'rare', cost: 7, req: { m: 6, g: 1 }, atk: 5, ret: 3, hp: 7, attackType: 'flyer', magic: true, icon: '🐉', art: 'Ghost_dragon_card', keywords: { noret: true, incorporeal: true, lifeDrain: 2 } }),
    spell({
      id: 'etreinteVampirique', name: 'Étreinte vampirique', rarity: 'uncommon', school: 'Ténèbres', cost: 2, req: { g: 2 }, icon: '🩸', art: 'Vampiric_embrace_card', ongoing: true,
      text: 'Enchante une créature. Permanent : elle gagne Drain de vie 2.',
      effect: effect([creatureStep('Choisissez la créature à enchanter.', 'any')],
        (g, pi, { choices }) => g.enchant(unitChoice(choices[0]), 'etreinteVampirique', pi, { keywords: { lifeDrain: 2 } })),
    }),
    spell({
      id: 'faiblesse', name: 'Faiblesse', rarity: 'uncommon', school: 'Ténèbres', cost: 2, req: { g: 2 }, icon: '🥀', art: 'Weakness_card', ongoing: true,
      text: 'Enchante une créature. Permanent : elle perd 2 en attaque et 2 en riposte.',
      effect: effect([creatureStep('Choisissez la créature à affaiblir.', 'any')],
        (g, pi, { choices }) => g.enchant(unitChoice(choices[0]), 'faiblesse', pi, { atk: -2, ret: -2 })),
    }),
    fortune({
      id: 'fosseCommune', name: 'Fosse commune', rarity: 'common', cost: 1, req: { d: 2 }, icon: '🪦', art: 'Mass_grave',
      text: 'Placez une carte de votre main au-dessus de votre bibliothèque. Détruisez une créature ciblée coûtant 2 ressources ou moins.',
      effect: effect([
        handStep('Choisissez la carte à remettre sur votre bibliothèque.'),
        creatureStep('Choisissez la créature à détruire (coût 2 ou moins).', 'any', costAtMost(2)),
      ], (g, pi, { choices, taken }) => {
        g.putOnLibrary(pi, taken);
        g.destroyUnit(unitChoice(choices[1]));
      }),
    }),
    fortune({
      id: 'ruinesShantiri', name: 'Ruines shantiri', rarity: 'uncommon', cost: 1, req: { d: 1 }, icon: '📕', art: 'Shantiri_ruins',
      text: 'Défaussez une carte de sort. Reprenez en main un sort non unique ciblé de votre cimetière.',
      effect: effect([
        handStep('Choisissez le sort à défausser.', c => c.type === 'spell', 'Aucun sort à défausser.'),
        zoneStep('Choisissez le sort à reprendre du cimetière.', 'grave', c => c.type === 'spell', 'Aucun sort dans votre cimetière.'),
      ], (g, pi, { choices, taken }) => {
        g.discard(pi, taken);
        g.returnFromGrave(pi, cardChoice(choices[1]));
      }),
    }),
    spell({
      id: 'maledictionNeant', name: 'Malédiction du Néant', rarity: 'rare', school: 'Ténèbres', cost: 6, req: { g: 6 }, icon: '🕯️', art: 'Curse_of_the_Netherworld_card',
      text: 'Inflige 3 dégâts à toutes les créatures ennemies. Soigne 3 blessures de toutes les créatures alliées.',
      effect: effect([], (g, pi) => {
        damageAll(g, other(pi), 3, DARK);
        g.units(pi).forEach(x => g.healUnit(x.unit.uid, 3));
      }),
    }),
  ]),

  // ----------------------------- INFERNO -----------------------------
  ...section('inferno', 'base', [
    creature({ id: 'diablotinChaos', name: 'Diablotin du chaos', rarity: 'unique', cost: 4, req: { m: 1, d: 3 }, atk: 1, ret: 0, hp: 1, attackType: 'shooter', icon: '😈', art: 'Chaos_imp', keywords: { noret: true, imposeDiscard: true } }),
    creature({ id: 'cerbere', name: 'Cerbère', rarity: 'uncommon', cost: 3, req: { m: 3 }, atk: 3, ret: 1, hp: 3, attackType: 'melee', icon: '🐕', art: 'Cerberus_card', keywords: { noret: true, sweep: true } }),
    creature({ id: 'tourmenteur', name: 'Tourmenteur', rarity: 'common', cost: 3, req: { m: 3, g: 1 }, atk: 2, ret: 2, hp: 5, attackType: 'melee', magic: true, icon: '⛓️', art: 'Tormentor_card', keywords: { areaBlast: 2 } }),
    creature({ id: 'succube', name: 'Succube', rarity: 'common', cost: 2, req: { m: 2, g: 1 }, atk: 2, ret: 0, hp: 4, attackType: 'shooter', magic: true, icon: '🦇', art: 'Succubus_card', keywords: { noret: true } }),
    creature({ id: 'lacerateur', name: 'Lacérateur', rarity: 'uncommon', cost: 4, req: { m: 4, g: 1 }, atk: 3, ret: 2, hp: 6, attackType: 'melee', magic: true, icon: '👹', art: 'Lacerator_card', keywords: { areaBlast: 3 } }),
    creature({ id: 'sorciereChaos', name: 'Sorcière du chaos', rarity: 'rare', cost: 5, req: { m: 4, g: 2 }, atk: 4, ret: 2, hp: 7, attackType: 'shooter', magic: true, icon: '🔥', art: 'Chaos_sorceress', keywords: { noret: true, areaBlast: 3 } }),
    creature({ id: 'seigneurFosses', name: 'Seigneur des fosses', rarity: 'rare', cost: 6, req: { m: 5 }, atk: 4, ret: 3, hp: 7, attackType: 'flyer', icon: '🔱', art: 'Pit_lord_card', keywords: { attackAnywhere: true } }),
    creature({ id: 'seigneurAbyssal', name: 'Seigneur abyssal', rarity: 'rare', cost: 7, req: { m: 6 }, atk: 5, ret: 4, hp: 9, attackType: 'melee', icon: '👿', art: 'Abyssal_lord_card', keywords: { attackAnywhere: true } }),
    spell({
      id: 'traitFeu', name: 'Trait de feu', rarity: 'common', school: 'Feu', cost: 1, req: { g: 1 }, icon: '☄️', art: 'Fire_bolt_card',
      text: 'Inflige 2 dégâts à une créature ciblée.',
      effect: effect([creatureStep('Choisissez la créature à frapper.', 'any')], (g, _pi, { choices }) => g.damageUnit(unitChoice(choices[0]), 2, FIRE)),
    }),
    spell({
      id: 'bouleFeu', name: 'Boule de feu', rarity: 'uncommon', school: 'Feu', cost: 4, req: { g: 4 }, icon: '💥', art: 'Fireball_card',
      text: 'Inflige 4 dégâts à une créature ciblée et à toutes les créatures adjacentes.',
      effect: effect([creatureStep('Choisissez le centre de l\'explosion.', 'any')], (g, _pi, { choices }) => {
        const uid = unitChoice(choices[0]);
        const around = g.adjacentUnits(uid);
        g.damageUnit(uid, 4, FIRE);
        around.forEach(u => g.damageUnit(u.uid, 4, FIRE));
      }),
    }),
    spell({
      id: 'tempeteFeu', name: 'Tempête de feu', rarity: 'rare', school: 'Feu', cost: 5, req: { g: 5 }, icon: '🌋', art: 'Firestorm_card',
      text: 'Inflige 4 dégâts à toutes les créatures de la ligne ciblée.',
      effect: effect([lineStep('Choisissez la ligne à embraser.')], (g, _pi, { choices }) => {
        const line = choices[0];
        if (line?.kind !== 'line') throw new Error('Ce choix doit être une ligne.');
        g.units(line.player).filter(x => x.row === line.row).forEach(x => g.damageUnit(x.unit.uid, 4, FIRE));
      }),
    }),
    spell({
      id: 'frenesie', name: 'Frénésie', rarity: 'uncommon', school: 'Feu', cost: 3, req: { g: 3 }, icon: '💢', art: 'Frenzy_card',
      text: 'Choisissez une créature ciblée. Infligez à une autre créature ciblée des dégâts égaux à l\'attaque de la première.',
      effect: effect([
        creatureStep('Choisissez la créature dont l\'attaque sera utilisée.', 'any'),
        creatureStep('Choisissez une autre créature à frapper.', 'any', undefined, 0),
      ], (g, _pi, { choices }) => {
        const source = g.locate(unitChoice(choices[0]))?.unit;
        g.damageUnit(unitChoice(choices[1]), source ? g.attackOf(source) : 0, FIRE);
      }),
    }),
    fortune({
      id: 'autelDestruction', name: 'Autel de destruction', rarity: 'common', cost: 1, req: { d: 1 }, icon: '🗡️', art: 'Altar_of_Destruction_card',
      text: 'Placez une carte de votre main au-dessus de votre bibliothèque. Inflige 2 dégâts au héros ennemi.',
      effect: effect([handStep('Choisissez la carte à remettre sur votre bibliothèque.')], (g, pi, { taken }) => {
        g.putOnLibrary(pi, taken);
        g.damageHero(other(pi), 2);
      }),
    }),
  ]),

  // ----------------------------- NEUTRES -----------------------------
  ...section(null, 'base', [
    fortune({
      id: 'appelDevoir', name: 'Appel du devoir', rarity: 'uncommon', cost: 3, req: { d: 3 }, icon: '📜', art: 'Call_to_Duty',
      text: 'Cherchez une carte de créature dans votre bibliothèque et ajoutez-la à votre main. Mélangez votre bibliothèque.',
      effect: effect(
        [zoneStep('Choisissez une créature de votre bibliothèque.', 'library', c => c.type === 'creature', 'Aucune créature dans votre bibliothèque.')],
        (g, pi, { choices }) => g.tutor(pi, cardChoice(choices[0])),
      ),
    }),
  ]),

  // ===================== ASCENSION DU VIDE : HAVRE =====================
  ...section('havre', 'voidRising', [
    creature({ id: 'capitaineLoup', name: 'Capitaine du Loup', rarity: 'unique', cost: 2, req: { m: 3 }, atk: 1, ret: 0, hp: 5, attackType: 'melee', icon: '🐺', art: 'Wolf_captain', keywords: { retribution: true, packBonus: 1 } }),
    creature({ id: 'justicierLoup', name: 'Justicier du Loup', rarity: 'rare', cost: 5, req: { m: 4, g: 2 }, atk: 2, ret: 3, hp: 7, attackType: 'shooter', magic: true, school: 'Lumière', icon: '⚖️', art: 'Wolf_justicar', keywords: { noret: true, retAura: 2 } }),
    creature({ id: 'pretorienLoup', name: 'Prétorien du Loup', rarity: 'uncommon', cost: 4, req: { m: 4 }, atk: 2, ret: 4, hp: 6, attackType: 'melee', icon: '🛡️', art: 'Wolf_praetorian', keywords: { retribution: true } }),
    creature({ id: 'tireurLoup', name: 'Tireur d\'élite du Loup', rarity: 'common', cost: 3, req: { m: 3 }, atk: 2, ret: 2, hp: 4, attackType: 'shooter', icon: '🎯', art: 'Wolf_marksman', keywords: { noret: true, retribution: true } }),
  ]),

  // =================== ASCENSION DU VIDE : NÉCROPOLE ===================
  ...section('necropole', 'voidRising', [
    creature({ id: 'scelleuseDestin', name: 'Scelleuse de destin', rarity: 'rare', cost: 6, req: { m: 3, g: 1, d: 3 }, atk: 2, ret: 2, hp: 5, attackType: 'flyer', magic: true, school: 'Ténèbres', icon: '🔮', art: 'Fate_sealer', keywords: { incorporeal: true, lifeDrain: 2, deathDraw: true } }),
    creature({ id: 'assassinVampire', name: 'Assassin vampire', rarity: 'rare', cost: 4, req: { m: 3 }, atk: 1, ret: 2, hp: 4, attackType: 'melee', icon: '🗡️', art: 'Vampire_assassin', keywords: { deathTouch: true } }),
    creature({ id: 'fileuseSoieLunaire', name: 'Fileuse de soie lunaire', rarity: 'uncommon', cost: 4, req: { m: 4 }, atk: 2, ret: 2, hp: 5, attackType: 'shooter', icon: '🕷️', art: 'Moonsilk_spinner', keywords: { crippling: 2 } }),
    creature({ id: 'squeletteSoieLunaire', name: 'Squelette de soie lunaire', rarity: 'common', cost: 2, req: { m: 2 }, atk: 2, ret: 1, hp: 3, attackType: 'melee', icon: '🕸️', art: 'Moonsilk_skeleton', keywords: { crippling: 1 } }),
    fortune({
      id: 'autelDeesseAraignee', name: 'Autel de la Déesse araignée', rarity: 'uncommon', cost: 3, req: { d: 2 }, icon: '🕷️', art: 'Altar_of_the_Spider_Goddess',
      text: 'Détruisez une créature alliée ciblée. Piochez autant de cartes que la moitié de ses PV restants, arrondie au supérieur.',
      effect: effect([creatureStep('Choisissez la créature alliée à sacrifier.', 'ally')], (g, pi, { choices }) => {
        const uid = unitChoice(choices[0]);
        const hp = g.locate(uid)?.unit.hpCur ?? 0;
        g.destroyUnit(uid);
        g.draw(pi, Math.ceil(hp / 2));
      }),
    }),
    fortune({
      id: 'antreAriana', name: 'Antre d\'Ariana', rarity: 'common', cost: 2, req: { d: 2 }, icon: '🕸️', art: 'Ariana_s_lair',
      text: 'Défaussez une carte de créature. Reprenez en main une carte de créature ciblée de votre cimetière.',
      effect: effect([
        handStep('Choisissez la créature à défausser.', c => c.type === 'creature', 'Aucune créature à défausser.'),
        zoneStep('Choisissez la créature à reprendre du cimetière.', 'grave', c => c.type === 'creature', 'Aucune créature dans votre cimetière.'),
      ], (g, pi, { choices, taken }) => {
        g.discard(pi, taken);
        g.returnFromGrave(pi, cardChoice(choices[1]));
      }),
    }),
  ]),

  // ==================== ASCENSION DU VIDE : INFERNO ====================
  ...section('inferno', 'voidRising', [
    creature({ id: 'invocatriceNeant', name: 'Invocatrice du Néant', rarity: 'unique', cost: 3, req: { m: 3, g: 1 }, atk: 2, ret: 0, hp: 4, attackType: 'shooter', magic: true, school: 'Primordiale', icon: '🌀', art: 'Caller_of_the_Void', keywords: { noret: true, supplyStrike: 1 } }),
    creature({ id: 'diablotinFlammes', name: 'Diablotin des flammes infernales', rarity: 'uncommon', cost: 2, req: { m: 2, g: 2 }, atk: 3, ret: 0, hp: 2, attackType: 'flyer', magic: true, school: 'Feu', icon: '🧨', art: 'Hellfire_imp', keywords: { fireBurst: 1 } }),
    creature({ id: 'mastodonteFlammes', name: 'Mastodonte des flammes infernales', rarity: 'uncommon', cost: 5, req: { m: 5, g: 1 }, atk: 7, ret: 3, hp: 3, attackType: 'melee', magic: true, school: 'Feu', icon: '🦏', art: 'Hellfire_juggernaut', keywords: { fireBurst: 4, trample: true } }),
    creature({ id: 'cerbereFlammes', name: 'Cerbère des flammes infernales', rarity: 'common', cost: 3, req: { m: 3 }, atk: 2, ret: 0, hp: 3, attackType: 'shooter', school: 'Feu', icon: '🐕', art: 'Hellfire_cerberus', keywords: { noret: true, attackAnywhere: true } }),
    fortune({
      id: 'sallesAmnesie', name: 'Salles de l\'amnésie', rarity: 'common', cost: 1, req: { d: 1 }, icon: '🧠', art: 'Halls_of_Amnesia',
      text: 'Au choix : regardez la main de l\'adversaire et choisissez-y un sort qu\'il défausse, OU cherchez un sort dans sa bibliothèque et mettez-le dans son cimetière.',
      effect: effect([{
        prompt: 'Choisissez un effet.', labels: ['Main adverse', 'Bibliothèque adverse'],
        options: () => [0, 1].map((index): Choice => ({ kind: 'mode', index })),
      }], (g, pi, { choices }) => (choices[0]?.kind === 'mode' && choices[0].index === 1
        ? g.pickFromOpponentLibrary(pi, ['spell'])
        : g.pickFromOpponentHand(pi, ['spell'], false))),
    }),
    fortune({
      id: 'gueulesChaos', name: 'Gueules du chaos', rarity: 'common', cost: 1, req: { d: 1 }, icon: '👄', art: 'Maws_of_Chaos',
      text: 'Au choix : regardez la main de l\'adversaire et choisissez-y une fortune qu\'il défausse, OU cherchez une fortune dans sa bibliothèque et mettez-la dans son cimetière.',
      effect: effect([{
        prompt: 'Choisissez un effet.', labels: ['Main adverse', 'Bibliothèque adverse'],
        options: () => [0, 1].map((index): Choice => ({ kind: 'mode', index })),
      }], (g, pi, { choices }) => (choices[0]?.kind === 'mode' && choices[0].index === 1
        ? g.pickFromOpponentLibrary(pi, ['fortune'])
        : g.pickFromOpponentHand(pi, ['fortune'], false))),
    }),
    fortune({
      id: 'pontFlammes', name: 'Pont des flammes infernales', rarity: 'uncommon', cost: 3, req: { d: 3 }, icon: '🌉', art: 'Hellfire_bridge',
      text: 'Défaussez toute votre main. Piochez 3 cartes.',
      effect: effect([], (g, pi) => {
        g.discardHand(pi);
        g.draw(pi, 3);
      }),
    }),
  ]),

  // ==================== ASCENSION DU VIDE : BASTION ====================
  ...section('bastion', 'voidRising', [
    creature({ id: 'gobelinCraneNoir', name: 'Gobelin du Crâne noir', rarity: 'uncommon', cost: 2, req: { m: 2 }, atk: 3, ret: 3, hp: 4, attackType: 'shooter', icon: '👺', art: 'Blackskull_goblin', keywords: { noret: true, needsCompany: true } }),
    creature({ id: 'seigneurCraneNoir', name: 'Seigneur de guerre du Crâne noir', rarity: 'unique', cost: 5, req: { m: 3 }, atk: 0, ret: 0, hp: 7, attackType: 'melee', icon: '👹', art: 'Blackskull_clan_warlord', keywords: { mightStats: true } }),
    creature({ id: 'chevaucheurVautour', name: 'Chevaucheur de vautour du Crâne noir', rarity: 'rare', cost: 5, req: { m: 4 }, atk: 3, ret: 3, hp: 6, attackType: 'flyer', icon: '🦅', art: 'Blackskull_vulture_rider', keywords: { bloodDiscount: true } }),
    creature({ id: 'chantreGuerre', name: 'Chantre de guerre du Crâne noir', rarity: 'common', cost: 1, req: { m: 1 }, atk: 0, ret: 0, hp: 2, attackType: 'melee', icon: '🥁', art: 'Blackskull_warchanter', keywords: { warchant: 1 } }),
    fortune({
      id: 'attaqueSurprise', name: 'Attaque surprise', rarity: 'uncommon', cost: 3, req: { d: 3 }, icon: '🗡️', art: 'Surprise_attack',
      text: 'Choisissez une créature alliée ciblée. Infligez à une créature ennemie ciblée des dégâts égaux à son attaque.',
      effect: effect([
        creatureStep('Choisissez la créature alliée dont l\'attaque sera utilisée.', 'ally'),
        creatureStep('Choisissez la créature ennemie à frapper.', 'enemy'),
      ], (g, _pi, { choices }) => {
        const source = g.locate(unitChoice(choices[0]))?.unit;
        g.damageUnit(unitChoice(choices[1]), source ? g.attackOf(source) : 0, { magic: false });
      }),
    }),
    fortune({
      id: 'appelCorneSanglante', name: 'Appel de la Corne sanglante', rarity: 'common', cost: 2, req: { d: 2 }, icon: '📯', art: 'Call_of_the_Bloodhorn',
      text: 'Permanent : vos créatures gardent leurs marqueurs de rage quand elles attaquent. Détruit quand une de vos créatures avec Rage furibonde meurt.',
      effect: effect([], () => {}),
      lasting: { duration: 'permanent', keepsEnrage: true, fragileToEnragedDeath: true },
    }),
    fortune({
      id: 'ritePlumesSang', name: 'Rituel des plumes de sang', rarity: 'common', cost: 1, req: { d: 2 }, icon: '🪶', art: 'Ritual_of_the_Blood_Feathers',
      text: 'Retirez tous les marqueurs d\'une créature alliée ciblée, puis soignez-la d\'autant de blessures que de marqueurs retirés.',
      effect: effect([creatureStep('Choisissez la créature alliée à purifier.', 'ally')], (g, _pi, { choices }) => {
        const uid = unitChoice(choices[0]);
        g.healUnit(uid, g.clearCounters(uid));
      }),
    }),
  ]),

  // ==================== ASCENSION DU VIDE : NEUTRES ====================
  ...section(null, 'voidRising', [
    creature({ id: 'shiNoShi', name: 'Shi-no-shi', rarity: 'unique', cost: 8, req: { m: 6, g: 2 }, atk: 6, ret: 6, hp: 6, attackType: 'flyer', magic: true, icon: '🐲', art: 'Shi-no-shi', keywords: { charge: true, darkWard: true, recycle: true } }),
    creature({ id: 'frereAveugle', name: 'Frère aveugle', rarity: 'rare', cost: 4, req: { m: 1, d: 3 }, atk: 1, ret: 1, hp: 5, attackType: 'shooter', magic: true, icon: '🧘', art: 'Blind_Brother', keywords: { supplyDraw: 1 } }),
    creature({ id: 'elementaireFeuSuperieur', name: 'Élémentaire de feu supérieur', rarity: 'rare', cost: 5, req: { m: 3, g: 3 }, atk: 3, ret: 2, hp: 5, attackType: 'shooter', magic: true, school: 'Feu', icon: '🔥', art: 'Greater_fire_elemental', keywords: { noret: true, fireHeal: true, fireBurst: 2 } }),
    creature({ id: 'tortueMontagnes', name: 'Tortue des montagnes profondes', rarity: 'uncommon', cost: 3, req: { m: 3 }, atk: 1, ret: 3, hp: 5, attackType: 'melee', icon: '🐢', art: 'Deep_mountain_turtle', keywords: { preemptive: true } }),
    creature({ id: 'spectreNeant', name: 'Spectre du Néant', rarity: 'uncommon', cost: 3, req: { m: 2, g: 1, d: 2 }, atk: 1, ret: 0, hp: 1, attackType: 'melee', magic: true, school: 'Primordiale', icon: '👻', art: 'Void_wraith_DoC', keywords: { deathCurse: 3 } }),
    creature({ id: 'vautourNoir', name: 'Vautour noir', rarity: 'common', cost: 2, req: { m: 2 }, atk: 2, ret: 1, hp: 2, attackType: 'flyer', icon: '🦅', art: 'Black_vulture' }),
    creature({ id: 'loupRedoutable', name: 'Loup redoutable', rarity: 'common', cost: 2, req: { m: 2 }, atk: 1, ret: 2, hp: 2, attackType: 'melee', icon: '🐺', art: 'Dire_wolf_card', keywords: { retribution: true } }),
    fortune({
      id: 'troneRenouveau', name: 'Trône du renouveau', rarity: 'unique', cost: 5, req: { d: 5 }, icon: '🪑', art: 'Throne_of_Renewal',
      text: 'Toutes les cartes du champ de bataille retournent dans la main de leur propriétaire, puis vos ressources sont vidées.',
      effect: effect([], (g, pi) => {
        g.returnAllToHand();
        g.emptyResources(pi);
      }),
    }),
    fortune({
      id: 'realignementCosmique', name: 'Réalignement cosmique', rarity: 'rare', cost: 4, req: { d: 4 }, icon: '🌌', art: 'Cosmic_realignment',
      text: 'Les deux joueurs défaussent toute leur main et piochent 5 cartes.',
      effect: effect([], g => {
        for (const p of [0, 1] as const) {
          g.discardHand(p);
          g.draw(p, 5);
        }
      }),
    }),
    fortune({
      id: 'tourOubli', name: 'Tour de l\'Oubli', rarity: 'rare', cost: 4, req: { d: 3 }, icon: '🗼', art: 'Tower_of_Oblivion',
      text: 'Les deux joueurs défaussent des cartes au hasard jusqu\'à en avoir 6 au plus. Chaque héros subit autant de dégâts que de cartes défaussées par son joueur.',
      effect: effect([], g => {
        for (const p of [0, 1] as const) g.damageHero(p, g.discardRandomDownTo(p, 6));
      }),
    }),
    fortune({
      id: 'heritage', name: 'Héritage', rarity: 'uncommon', cost: 0, req: { d: 3 }, icon: '📜', art: 'Inheritance',
      text: 'Bannissez une carte de créature ciblée de votre cimetière, puis gagnez 3 ressources. Ne peut être jouée que s\'il ne vous reste aucune ressource.',
      effect: effect(
        [zoneStep('Choisissez la créature à bannir de votre cimetière.', 'grave', c => c.type === 'creature', 'Aucune créature dans votre cimetière.')],
        (g, pi, { choices }) => {
          g.banishFromGrave(pi, cardChoice(choices[0]));
          g.gainResources(pi, 3);
        },
        { requirement: (g, pi) => (g.player(pi).res > 0 ? 'Il ne doit plus vous rester de ressources.' : null) },
      ),
    }),
    fortune({
      id: 'monastereHelexia', name: 'Monastère d\'Hélexia', rarity: 'uncommon', cost: 1, req: { d: 1 }, icon: '⛩️', art: 'Monastery_of_Helexia',
      text: 'Mélangez tous les événements et mettez-en 2 nouveaux en jeu.',
      effect: effect([], g => g.reshuffleEvents()),
    }),
    fortune({
      id: 'provisionsVolees', name: 'Provisions volées', rarity: 'common', cost: 1, req: { d: 3 }, icon: '💰', art: 'Stolen_supplies',
      text: 'Gagnez autant de ressources que l\'adversaire en a, puis videz les siennes.',
      effect: effect([], (g, pi) => g.stealResources(pi)),
    }),
    fortune({
      id: 'maledictionNegation', name: 'Malédiction de négation', rarity: 'common', cost: 2, req: { d: 2 }, icon: '🚫', art: 'Curse_of_Negation',
      text: 'Baissez de 1 la Puissance, la Magie ou la Destinée de l\'adversaire.',
      effect: effect([{
        prompt: 'Choisissez la caractéristique adverse à baisser.',
        labels: STAT_KEYS.map(k => STAT_NAMES[k]),
        options: () => STAT_KEYS.map((_k, index): Choice => ({ kind: 'mode', index })),
      }], (g, pi, { choices }) => {
        const pick = choices[0];
        const stat = pick?.kind === 'mode' ? STAT_KEYS[pick.index] : undefined;
        if (stat) g.decreaseStat(other(pi), stat, 1);
      }),
    }),
  ]),

  // =================== ASCENSION DU VIDE : SANCTUAIRE ===================
  ...section('sanctuaire', 'voidRising', [
    creature({ id: 'yetiMontagnes', name: 'Yéti des montagnes profondes', rarity: 'unique', cost: 5, req: { m: 5 }, atk: 2, ret: 0, hp: 6, attackType: 'melee', icon: '🦍', art: 'Deep_mountain_yeti', keywords: { enemyBonus: 1 } }),
    creature({ id: 'nyoraiSairensa', name: 'Nyorai sairensa', rarity: 'unique', cost: 4, req: { m: 4, g: 1 }, atk: 3, ret: 3, hp: 5, attackType: 'melee', magic: true, school: 'Eau', icon: '🐍', art: 'Nyorai_sairensa', keywords: { outmanoeuvre: true, blockLane: true } }),
    creature({ id: 'kensei', name: 'Kensei', rarity: 'rare', cost: 7, req: { m: 5 }, atk: 2, ret: 1, hp: 4, attackType: 'melee', icon: '⚔️', art: 'Kensei_card', keywords: { noret: true, honor: 3 } }),
    creature({ id: 'mizuKami', name: 'Mizu-kami', rarity: 'rare', cost: 5, req: { m: 3, g: 2 }, atk: 3, ret: 1, hp: 5, attackType: 'melee', magic: true, school: 'Eau', icon: '🌊', art: 'Mizu-kami_card', keywords: { magicShield: true } }),
    creature({ id: 'kirinSacre', name: 'Kirin sacré', rarity: 'rare', cost: 6, req: { m: 5, g: 2 }, atk: 4, ret: 3, hp: 9, attackType: 'shooter', magic: true, school: 'Eau', icon: '🦄', art: 'Sacred_kirin_card', keywords: { areaBlast: 4, waterBlast: 1 } }),
    creature({ id: 'pretresseShanriya', name: 'Prêtresse shanriya', rarity: 'rare', cost: 4, req: { m: 3, g: 2 }, atk: 2, ret: 0, hp: 6, attackType: 'shooter', magic: true, school: 'Eau', icon: '🧜', art: 'Shanriya_priestess', keywords: { noret: true, areaBlast: 1, hypnotize: true, frozenTouch: true } }),
    creature({ id: 'shinobiMaitreChanteur', name: 'Shinobi maître chanteur', rarity: 'rare', cost: 2, req: { m: 1, d: 2 }, atk: 1, ret: 0, hp: 3, attackType: 'shooter', icon: '🥷', art: 'Shinobi_blackmailer', keywords: { blackmail: true } }),
    creature({ id: 'kappaShoya', name: 'Kappa shoya', rarity: 'uncommon', cost: 4, req: { m: 4, g: 1 }, atk: 3, ret: 1, hp: 6, attackType: 'melee', magic: true, school: 'Eau', icon: '🐸', art: 'Kappa_shoya_card', keywords: { outmanoeuvre: true } }),
    creature({ id: 'kenshi', name: 'Kenshi', rarity: 'uncommon', cost: 5, req: { m: 5 }, atk: 2, ret: 1, hp: 4, attackType: 'melee', icon: '🗡️', art: 'Kenshi_card', keywords: { honor: 2 } }),
    creature({ id: 'maitreMareesNaga', name: 'Maître des marées naga', rarity: 'uncommon', cost: 5, req: { m: 5, g: 1 }, atk: 4, ret: 2, hp: 6, attackType: 'shooter', magic: true, school: 'Eau', icon: '🌀', art: 'Naga_tide_master', keywords: { noret: true, outmanoeuvre: true } }),
    creature({ id: 'guerrierNaga', name: 'Guerrier naga', rarity: 'uncommon', cost: 4, req: { m: 4 }, atk: 2, ret: 1, hp: 6, attackType: 'melee', icon: '🐍', art: 'Naga_warrior_card', keywords: { honor: 1 } }),
    creature({ id: 'pretressePerle', name: 'Prêtresse des perles', rarity: 'uncommon', cost: 5, req: { m: 5, g: 1 }, atk: 3, ret: 2, hp: 6, attackType: 'shooter', magic: true, school: 'Eau', icon: '🦪', art: 'Pearl_priestess_card', keywords: { noret: true, hypnotize: true, outmanoeuvre: true } }),
    creature({ id: 'wanizame', name: 'Wanizame', rarity: 'uncommon', cost: 4, req: { m: 4 }, atk: 3, ret: 1, hp: 5, attackType: 'melee', school: 'Eau', icon: '🦈', art: 'Wanizame_card', keywords: { honor: 1 } }),
    creature({ id: 'pretresseCorail', name: 'Prêtresse du corail', rarity: 'common', cost: 3, req: { m: 3, g: 1 }, atk: 2, ret: 1, hp: 3, attackType: 'shooter', magic: true, school: 'Eau', icon: '🪸', art: 'Coral_priestess_card', keywords: { noret: true, outmanoeuvre: true } }),
    creature({ id: 'kappa', name: 'Kappa', rarity: 'common', cost: 3, req: { m: 3 }, atk: 2, ret: 3, hp: 6, attackType: 'melee', icon: '🐢', art: 'Kappa_card' }),
    creature({ id: 'kirin', name: 'Kirin', rarity: 'common', cost: 3, req: { m: 3, g: 1 }, atk: 2, ret: 1, hp: 5, attackType: 'shooter', magic: true, school: 'Eau', icon: '🦌', art: 'Kirin_card', keywords: { areaBlast: 2 } }),
    creature({ id: 'espritSource', name: 'Esprit de la source', rarity: 'common', cost: 2, req: { m: 2, g: 1 }, atk: 2, ret: 2, hp: 4, attackType: 'melee', magic: true, school: 'Eau', icon: '💧', art: 'Spring_spirit_card' }),
    creature({ id: 'gardeShanriya', name: 'Garde shanriya', rarity: 'uncommon', cost: 3, req: { m: 3, g: 1 }, atk: 2, ret: 0, hp: 4, attackType: 'shooter', magic: true, school: 'Eau', icon: '❄️', art: 'Shanriya_guard', keywords: { noret: true, frozenTouch: true } }),
    creature({ id: 'gardeRequin', name: 'Garde requin', rarity: 'common', cost: 1, req: { m: 1 }, atk: 2, ret: 1, hp: 2, attackType: 'melee', icon: '🦈', art: 'Shark_guard_card' }),
    creature({ id: 'demoiselleNeiges', name: 'Demoiselle des neiges', rarity: 'common', cost: 3, req: { m: 3 }, atk: 2, ret: 1, hp: 5, attackType: 'shooter', school: 'Eau', icon: '☃️', art: 'Snow_maiden_card', keywords: { noret: true, hypnotize: true } }),
    creature({ id: 'renardBlanc', name: 'Renard blanc', rarity: 'common', cost: 2, req: { m: 2 }, atk: 2, ret: 1, hp: 3, attackType: 'melee', icon: '🦊', art: 'White_fox', keywords: { lucky: 1 } }),
    creature({ id: 'yukiOnna', name: 'Yuki-onna', rarity: 'common', cost: 5, req: { m: 5 }, atk: 3, ret: 2, hp: 9, attackType: 'shooter', school: 'Eau', icon: '👘', art: 'Yuki-onna_card', keywords: { noret: true, hypnotize: true } }),
    fortune({
      id: 'sanctuaireYukiko', name: 'Sanctuaire de Yukiko', rarity: 'unique', cost: 0, req: { d: 2 }, icon: '⛩️', art: 'Yukiko_s_shrine',
      text: 'Jusqu\'à la fin du tour : tant que vous avez moins de créatures que l\'adversaire, vos créatures non uniques coûtent 2 ressources.',
      effect: effect([], () => {}),
      lasting: {
        duration: 'endOfTurn',
        costOverride: (g, pi, card, entry) => (pi === entry.owner && card.type === 'creature' && card.rarity !== 'unique'
          && g.units(pi).length < g.units(other(pi)).length ? 2 : null),
      },
    }),
    fortune({
      id: 'terreHonoree', name: 'Terre honorée', rarity: 'rare', cost: 2, req: { d: 3 }, icon: '🎌', art: 'Honored_land',
      text: 'Jusqu\'à votre prochain tour : vos créatures gagnent +X en attaque et en riposte, X étant leur valeur d\'Honneur.',
      effect: effect([], () => {}),
      lasting: {
        duration: 'nextTurn',
        attackBonus: (_g, unit, entry) => (unit.owner === entry.owner ? unit.keywords.honor ?? 0 : 0),
        retaliationBonus: (_g, unit, entry) => (unit.owner === entry.owner ? unit.keywords.honor ?? 0 : 0),
      },
    }),
    fortune({
      id: 'templeCache', name: 'Temple caché', rarity: 'uncommon', cost: 1, req: { d: 1 }, icon: '🛕', art: 'Hidden_temple',
      text: 'Placez une carte de votre main au-dessus de votre bibliothèque. Jusqu\'à la fin du tour : les créatures coûtent 1 ressource de moins.',
      effect: effect([handStep('Choisissez la carte à remettre sur votre bibliothèque.')], (g, pi, { taken }) => g.putOnLibrary(pi, taken)),
      lasting: { duration: 'endOfTurn', costDelta: (_g, _pi, card) => (card.type === 'creature' ? -1 : 0) },
    }),
    fortune({
      id: 'avalanche', name: 'Avalanche', rarity: 'uncommon', cost: 4, req: { d: 4 }, icon: '🏔️', art: 'Avalanche',
      text: 'Jusqu\'à votre prochain tour : l\'adversaire ne peut pas déployer de créature.',
      effect: effect([], () => {}),
      lasting: { duration: 'nextTurn', forbidsDeploy: (_g, pi, entry) => pi !== entry.owner },
    }),
    fortune({
      id: 'labyrintheGele', name: 'Labyrinthe gelé', rarity: 'uncommon', cost: 2, req: { d: 2 }, icon: '🧊', art: 'The_Frozen_Maze',
      text: 'Jusqu\'à votre prochain tour : deux créatures ennemies ciblées ne peuvent pas attaquer.',
      effect: effect([
        creatureStep('Choisissez la première créature ennemie à geler.', 'enemy'),
        creatureStep('Choisissez la seconde créature ennemie à geler.', 'enemy', undefined, 0),
      ], (g, pi, { choices }) => choices.forEach(c => g.preventAttack(unitChoice(c), pi))),
    }),
    fortune({
      id: 'salleDefis', name: 'Salle des défis', rarity: 'common', cost: 2, req: { d: 2 }, icon: '🏯', art: 'Challenge_hall',
      text: 'Jusqu\'à votre prochain tour : une seule créature ennemie par ligne peut attaquer à chaque tour.',
      effect: effect([], () => {}),
      lasting: { duration: 'nextTurn', oneAttackPerLine: true },
    }),
    fortune({
      id: 'pilierClairvoyance', name: 'Pilier de clairvoyance', rarity: 'common', cost: 1, req: { d: 1 }, icon: '👁️', art: 'Pillar_of_Foresight',
      text: 'Regardez la main de l\'adversaire (jusqu\'à la fin du tour). Piochez une carte.',
      effect: effect([], (g, pi) => {
        g.revealOpponentHand(pi);
        g.draw(pi, 1);
      }),
    }),
    fortune({
      id: 'tourTemple', name: 'Tour du temple', rarity: 'common', cost: 2, req: { d: 2 }, icon: '🗼', art: 'Temple_tower',
      text: 'Au choix : piochez une carte, OU si vous avez moins de créatures que l\'adversaire, augmentez de 1 votre Puissance, votre Magie ou votre Destinée.',
      effect: effect([{
        prompt: 'Choisissez un effet.',
        labels: ['Piocher une carte', ...STAT_KEYS.map(k => `+1 ${STAT_NAMES[k]}`)],
        options: (g, pi) => {
          const modes: Choice[] = [{ kind: 'mode', index: 0 }];
          if (g.units(pi).length < g.units(other(pi)).length) STAT_KEYS.forEach((_k, i) => modes.push({ kind: 'mode', index: i + 1 }));
          return modes;
        },
      }], (g, pi, { choices }) => {
        const pick = choices[0];
        const stat = pick?.kind === 'mode' ? STAT_KEYS[pick.index - 1] : undefined;
        if (stat) g.increaseStat(pi, stat, 1);
        else g.draw(pi, 1);
      }),
    }),
    fortune({
      id: 'forteresseSousMarine', name: 'Forteresse sous-marine', rarity: 'uncommon', cost: 2, req: { d: 2 }, icon: '🏰', art: 'Underwater_fortress',
      text: 'Choisissez une créature alliée ciblée. Cherchez dans votre bibliothèque une créature du même nom et ajoutez-la à votre main ; jusqu\'à la fin du tour, elle coûte 2 ressources de moins.',
      effect: effect([creatureStep('Choisissez la créature alliée dont chercher un exemplaire.', 'ally')], (g, pi, { choices }) => {
        const cardId = g.locate(unitChoice(choices[0]))?.unit.cardId;
        if (cardId && g.player(pi).deck.includes(cardId)) g.tutor(pi, cardId);
      }),
      lasting: { duration: 'endOfTurn', costDelta: (_g, pi, card, entry) => (pi === entry.owner && card.id === entry.subject ? -2 : 0) },
    }),
    fortune({
      id: 'tourbillon', name: 'Tourbillon', rarity: 'uncommon', cost: 2, req: { d: 2 }, icon: '🌀', art: 'Whirlpool_card',
      text: 'Renvoyez une créature alliée ciblée dans la main de son propriétaire. Gagnez 2 ressources.',
      effect: effect([creatureStep('Choisissez la créature alliée à renvoyer dans votre main.', 'ally')], (g, pi, { choices }) => {
        g.returnToHand(unitChoice(choices[0]));
        g.gainResources(pi, 2);
      }),
    }),
  ]),

  // ================ ASCENSION DU VIDE : FORTUNES DE FACTION ================
  ...section('havre', 'voidRising', [
    fortune({
      id: 'phalangeImperiale', name: 'Phalange impériale', rarity: 'uncommon', cost: 2, req: { d: 2 }, icon: '🛡️', art: 'Imperial_phalanx',
      text: 'Permanent : si aucune de vos créatures de mêlée n\'a attaqué pendant votre tour, vos créatures gagnent Châtiment et +1 en riposte jusqu\'à votre prochain tour.',
      effect: effect([], () => {}),
      lasting: {
        duration: 'permanent', phalanx: true,
        retaliationBonus: (_g, unit, entry) => (entry.active && unit.owner === entry.owner ? 1 : 0),
        keywords: (_g, unit, entry) => (entry.active && unit.owner === entry.owner ? { retribution: true } : {}),
      },
    }),
    fortune({
      id: 'arbreVerite', name: 'Arbre de vérité', rarity: 'common', cost: 1, req: { d: 2 }, icon: '🌳', art: 'Tree_of_Truth',
      text: 'Détruisez une fortune permanente ciblée.',
      effect: effect([{
        prompt: 'Choisissez la fortune permanente à détruire.',
        emptyReason: 'Aucune fortune permanente en jeu.',
        options: g => g.lasting.flatMap((entry, index): Choice[] => (getCard(entry.cardId).type === 'fortune' ? [{ kind: 'lasting', index }] : [])),
      }], (g, _pi, { choices }) => {
        const pick = choices[0];
        if (pick?.kind === 'lasting') g.destroyLasting(pick.index);
      }),
    }),
    fortune({
      id: 'treveElrath', name: 'Trêve d\'Elrath', rarity: 'common', cost: 2, req: { d: 2 }, icon: '🕊️', art: 'Truce_of_Elrath',
      text: 'Jusqu\'à votre prochain tour : l\'attaque de chaque créature est égale à sa riposte.',
      effect: effect([], () => {}),
      lasting: { duration: 'nextTurn', attackEqualsRetaliation: true },
    }),
  ]),
  ...section('necropole', 'voidRising', [
    fortune({
      id: 'riteTransfert', name: 'Rite de transfert nécromantique', rarity: 'common', cost: 1, req: { d: 2 }, icon: '⚰️', art: 'Rite_of_Necromantic_Transfer',
      text: 'Détruisez une créature alliée ciblée. Prenez dans votre cimetière une créature de coût inférieur et déployez-la gratuitement.',
      effect: effect([
        creatureStep('Choisissez la créature alliée à sacrifier.', 'ally'),
        {
          prompt: 'Choisissez la créature de coût inférieur à faire revenir du cimetière.',
          emptyReason: 'Aucune créature de coût inférieur dans votre cimetière.',
          options: () => [],
          after: (g, pi, [sacrificed]) => {
            const cost = getCard(g.locate(unitChoice(sacrificed))?.unit.cardId ?? '').cost;
            return [...new Set(g.player(pi).grave)].sort()
              .filter(id => { const card = getCard(id); return card.type === 'creature' && card.cost < cost; })
              .map((cardId): Choice => ({ kind: 'card', zone: 'grave', cardId }));
          },
        },
        {
          prompt: 'Choisissez où la déployer.',
          options: () => [],
          after: (g, pi, [sacrificed, revived]) => {
            const freed = g.locate(unitChoice(sacrificed));
            const card = getCreature(cardChoice(revived));
            const slots = g.placementSlots(pi, card.attackType);
            if (freed && ALLOWED_ROWS[card.attackType].includes(freed.row)) slots.push({ row: freed.row, lane: freed.lane });
            return slots.map((s): Choice => ({ kind: 'slot', ...s }));
          },
        },
      ], (g, pi, { choices: [sacrificed, revived, slot] }) => {
        g.destroyUnit(unitChoice(sacrificed));
        if (slot?.kind === 'slot') g.deployFromGrave(pi, cardChoice(revived), slot);
      }),
    }),
  ]),
  ...section(null, 'voidRising', [
    fortune({
      id: 'pillage', name: 'Pillage', rarity: 'uncommon', cost: 3, req: { d: 3 }, icon: '💰', art: 'Pillage',
      text: 'Jusqu\'à votre prochain tour : au ravitaillement, l\'adversaire ne reçoit que la moitié de sa production, arrondie à l\'inférieur.',
      effect: effect([], () => {}),
      lasting: { duration: 'nextTurn', halvesSupply: (_g, pi, entry) => pi !== entry.owner },
    }),

    // ------------------------------ Sorts ------------------------------
    spell({
      id: 'maledictionPenitent', name: 'Malédiction du pénitent', school: 'Ténèbres', rarity: 'rare', cost: 4, req: { g: 4 }, icon: '😔', art: 'Curse_of_the_Penitent',
      text: 'Inflige à chaque créature des dégâts égaux à la moitié de ses PV restants, arrondie au supérieur.',
      effect: effect([], g => {
        const all = [...g.units(0), ...g.units(1)].map(x => ({ uid: x.unit.uid, n: Math.ceil(x.unit.hpCur / 2) }));
        all.forEach(({ uid, n }) => g.damageUnit(uid, n, DARK));
      }),
    }),
    spell({
      id: 'desespoir', name: 'Désespoir', school: 'Ténèbres', rarity: 'rare', cost: 3, req: { g: 3 }, icon: '😩', art: 'Despair_card',
      text: 'Inflige 2 dégâts à chaque créature ennemie sans créature alliée adjacente.',
      effect: effect([], (g, pi) => {
        g.units(other(pi)).filter(x => !g.adjacentUnits(x.unit.uid).length).forEach(x => g.damageUnit(x.unit.uid, 2, DARK));
      }),
    }),
    spell({
      id: 'feuInterieurCollectif', name: 'Feu intérieur collectif', school: 'Feu', rarity: 'rare', cost: 5, req: { g: 4 }, icon: '🔥', art: 'Mass_inner_fire',
      text: 'Jusqu\'à votre prochain tour : vos créatures gagnent +2 en attaque et +2 en riposte.',
      effect: effect([], () => {}),
      lasting: {
        duration: 'nextTurn',
        attackBonus: (_g, unit, entry) => (unit.owner === entry.owner ? 2 : 0),
        retaliationBonus: (_g, unit, entry) => (unit.owner === entry.owner ? 2 : 0),
      },
    }),
    spell({
      id: 'tempeteSable', name: 'Tempête de sable', school: 'Air', rarity: 'rare', cost: 3, req: { g: 3 }, icon: '🌪️', art: 'Sand_storm',
      text: 'Jusqu\'à votre prochain tour : les créatures ennemies de mêlée et volantes ne peuvent pas attaquer.',
      effect: effect([], () => {}),
      lasting: { duration: 'nextTurn', cannotAttack: (_g, unit, entry) => unit.owner !== entry.owner && unit.attackType !== 'shooter' },
    }),
    spell({
      id: 'gardeTenebres', name: 'Garde contre les ténèbres', school: 'Lumière', rarity: 'rare', cost: 3, req: { g: 2 }, icon: '🌕', art: 'Ward_against_darkness',
      text: 'Permanent : vos créatures gagnent Protection contre les ténèbres. Détruit quand vous n\'avez plus de créature.',
      effect: effect([], () => {}),
      lasting: { duration: 'permanent', needsCreatures: true, keywords: (_g, unit, entry) => (unit.owner === entry.owner ? { darkWard: true } : {}) },
    }),
    spell({
      id: 'armeArdente', name: 'Arme ardente', school: 'Feu', rarity: 'uncommon', cost: 3, req: { g: 2 }, icon: '🗡️', art: 'Fiery_weapon', ongoing: true,
      text: 'Enchante une créature. Permanent : chaque fois qu\'elle attaque, elle gagne un marqueur +1 en attaque.',
      effect: effect([creatureStep('Choisissez la créature à enchanter.', 'any')],
        (g, pi, { choices }) => g.enchant(unitChoice(choices[0]), 'armeArdente', pi, { keywords: { rampage: true } })),
    }),
    spell({
      id: 'dissipationMasse', name: 'Dissipation de masse', school: 'Primordiale', rarity: 'uncommon', cost: 2, req: { m: 3 }, icon: '💨', art: 'Mass_dispel',
      text: 'Détruisez tous les sorts permanents.',
      effect: effect([], g => g.dispelAll()),
    }),
    spell({
      id: 'mousson', name: 'Mousson', school: 'Eau', rarity: 'uncommon', cost: 2, req: { g: 3 }, icon: '🌧️', art: 'Monsoon_card',
      text: 'Permanent : les sorts de Feu et de Terre infligent moitié moins de dégâts, arrondi à l\'inférieur.',
      effect: effect([], () => {}),
      lasting: { duration: 'permanent', halvesSpellDamage: school => school === 'Feu' || school === 'Terre' },
    }),
    spell({
      id: 'purete', name: 'Pureté', school: 'Lumière', rarity: 'uncommon', cost: 2, req: { g: 2 }, icon: '🤍', art: 'Purity',
      text: 'Retirez tous les marqueurs de vos créatures. Permanent : aucun marqueur ne peut être posé sur vos créatures.',
      effect: effect([], (g, pi) => g.units(pi).forEach(x => g.clearCounters(x.unit.uid))),
      lasting: { duration: 'permanent', blocksCounters: (_g, unit, entry) => unit.owner === entry.owner },
    }),
    spell({
      id: 'nuageToxique', name: 'Nuage toxique', school: 'Terre', rarity: 'uncommon', cost: 4, req: { g: 3 }, icon: '☁️', art: 'Poison_cloud_card',
      text: 'Posez un marqueur de poison sur chaque créature.',
      effect: effect([], g => [...g.units(0), ...g.units(1)].forEach(x => g.addCounters(x.unit, 'poison', 1))),
    }),
    spell({
      id: 'flechesTempete', name: 'Flèches de tempête', school: 'Air', rarity: 'uncommon', cost: 3, req: { g: 3 }, icon: '🏹', art: 'Storm_arrows_card',
      text: 'Jusqu\'à la fin du tour : vos tireurs gagnent Ubiquité.',
      effect: effect([], () => {}),
      lasting: {
        duration: 'endOfTurn',
        keywords: (_g, unit, entry) => (unit.owner === entry.owner && unit.attackType === 'shooter' ? { attackAnywhere: true } : {}),
      },
    }),
    spell({
      id: 'etreinteTerre', name: 'Étreinte de la terre', school: 'Terre', rarity: 'rare', cost: 2, req: { g: 2 }, icon: '🪨', art: 'Earth_s_grasp',
      text: 'Permanent : toutes les créatures perdent Attaque rapide.',
      effect: effect([], () => {}),
      lasting: { duration: 'permanent', suppresses: ['quickAttack'] },
    }),
    spell({
      id: 'combustion', name: 'Combustion', school: 'Feu', rarity: 'common', cost: 2, req: { g: 2 }, icon: '🔥', art: 'Combustion', ongoing: true,
      text: 'Enchante une créature. Permanent : au début du tour de chaque joueur, elle subit 1 dégât de feu.',
      effect: effect([creatureStep('Choisissez la créature à enchanter.', 'any')],
        (g, pi, { choices }) => g.enchant(unitChoice(choices[0]), 'combustion', pi, { keywords: { burning: 1 } })),
    }),
    spell({
      id: 'angeGardien', name: 'Ange gardien', school: 'Lumière', rarity: 'common', cost: 2, req: { g: 2 }, icon: '👼', art: 'Guardian_angel_card',
      text: 'Enchante un couloir. Jusqu\'à votre prochain tour : les créatures de ce couloir ne peuvent pas être ciblées.',
      effect: effect([laneStep('Choisissez le couloir à protéger.')], () => {}),
      lasting: { duration: 'nextTurn', lane: true, untargetable: (g, unit, entry) => g.locate(unit.uid)?.lane === entry.lane },
    }),
    spell({
      id: 'ventPorteur', name: 'Vent porteur', school: 'Air', rarity: 'common', cost: 3, req: { g: 3 }, icon: '🍃', art: 'Lifting_wind',
      text: 'Échangez la place de deux créatures alliées ciblées (chacune doit pouvoir occuper la case de l\'autre).',
      effect: effect([
        creatureStep('Choisissez la première créature alliée.', 'ally'),
        {
          prompt: 'Choisissez la créature alliée avec laquelle l\'échanger.',
          emptyReason: 'Aucune créature alliée avec laquelle l\'échanger.',
          options: () => [],
          after: (g, pi, [first]) => g.units(pi)
            .filter(x => g.isTargetable(x.unit.uid) && g.canSwap(unitChoice(first), x.unit.uid))
            .map((x): Choice => ({ kind: 'unit', uid: x.unit.uid })),
        },
      ], (g, _pi, { choices }) => g.swap(unitChoice(choices[0]), unitChoice(choices[1]))),
    }),
    spell({
      id: 'entravesSoieLunaire', name: 'Entraves de soie lunaire', school: 'Ténèbres', rarity: 'common', cost: 2, req: { g: 3 }, icon: '⛓️', art: 'Moonsilk_fetters',
      text: 'Posez un marqueur d\'estropiement sur deux créatures ciblées.',
      effect: effect([
        creatureStep('Choisissez la première créature à entraver.', 'any'),
        creatureStep('Choisissez la seconde créature à entraver.', 'any', undefined, 0),
      ], (g, _pi, { choices }) => choices.forEach(c => {
        const unit = g.locate(unitChoice(c))?.unit;
        if (unit) g.addCounters(unit, 'cripple', 1);
      })),
    }),
    spell({
      id: 'negationMagie', name: 'Négation de la magie', school: 'Primordiale', rarity: 'common', cost: 2, req: { g: 1 }, icon: '🚫', art: 'Negate_magic',
      text: 'Retirez tous les marqueurs et détruisez tous les sorts permanents d\'une créature ciblée.',
      effect: effect([creatureStep('Choisissez la créature à purifier.', 'any')], (g, _pi, { choices }) => {
        const uid = unitChoice(choices[0]);
        g.clearCounters(uid);
        g.dispelUnit(uid);
      }),
    }),
    spell({
      id: 'bulbeVenimeux', name: 'Bulbe vénéneux', school: 'Terre', rarity: 'common', cost: 2, req: { g: 2 }, icon: '🌷', art: 'Poisonous_bulb',
      text: 'Enchante un couloir. Permanent : quand une créature de mêlée ou volante de ce couloir attaque, elle reçoit 2 marqueurs de poison et le bulbe est détruit.',
      effect: effect([laneStep('Choisissez le couloir où planter le bulbe.')], () => {}),
      lasting: { duration: 'permanent', lane: true, poisonsAttackers: 2 },
    }),
    spell({
      id: 'murEau', name: 'Mur d\'eau', school: 'Eau', rarity: 'common', cost: 2, req: { g: 2 }, icon: '🌊', art: 'Water_wall',
      text: 'Jusqu\'à votre prochain tour : les créatures qui ont 2 ou moins en attaque ne peuvent pas attaquer.',
      effect: effect([], () => {}),
      lasting: { duration: 'nextTurn', cannotAttack: (g, unit) => g.attackOf(unit) <= 2 },
    }),
  ]),

  // ========================= BASE : BASTION =========================
  ...section('bastion', 'base', [
    creature({ id: 'appeleurSang', name: 'Appeleur de sang', rarity: 'unique', cost: 5, req: { m: 5, g: 1 }, atk: 0, ret: 0, hp: 7, attackType: 'melee', magic: true, icon: '🩸', art: 'Blood_caller', keywords: { bloodPact: true } }),
    creature({ id: 'chevaucheurWyverne', name: 'Chevaucheur de wyverne', rarity: 'unique', cost: 6, req: { m: 6 }, atk: 3, ret: 1, hp: 7, attackType: 'flyer', icon: '🐉', art: 'Wyvern_rider', keywords: { enrage: 2, magicResist: true } }),
    creature({ id: 'cyclopeEnrage', name: 'Cyclope enragé', rarity: 'rare', cost: 7, req: { m: 6 }, atk: 4, ret: 2, hp: 7, attackType: 'shooter', icon: '👁️', art: 'Enraged_cyclops_card', keywords: { noret: true, doubleAttack: true } }),
    creature({ id: 'guerrierPanthere', name: 'Guerrier panthère', rarity: 'rare', cost: 6, req: { m: 6 }, atk: 3, ret: 3, hp: 5, attackType: 'melee', school: 'Air', icon: '🐆', art: 'Panther_warrior_card', keywords: { quickAttack: true, charge: true } }),
    creature({ id: 'cogneurEnrage', name: 'Cogneur enragé', rarity: 'rare', cost: 6, req: { m: 6 }, atk: 4, ret: 2, hp: 7, attackType: 'melee', school: 'Air', icon: '👊', art: 'Raging_smasher', keywords: { noret: true, charge: true, enrage: 2 } }),
    creature({ id: 'maraudeurCentaure', name: 'Maraudeur centaure', rarity: 'uncommon', cost: 5, req: { m: 5 }, atk: 3, ret: 2, hp: 5, attackType: 'shooter', icon: '🏹', art: 'Centaur_marauder_card', keywords: { noret: true, attackAnywhere: true, armor: 1 } }),
    creature({ id: 'broyeur', name: 'Broyeur', rarity: 'uncommon', cost: 4, req: { m: 4 }, atk: 2, ret: 1, hp: 4, attackType: 'melee', icon: '🔨', art: 'Crusher_card', keywords: { magicResist: true, enrage: 1 } }),
    creature({ id: 'cyclopeBagarreur', name: 'Cyclope bagarreur', rarity: 'uncommon', cost: 4, req: { m: 4 }, atk: 2, ret: 2, hp: 6, attackType: 'melee', icon: '🥊', art: 'Cyclops_brawler', keywords: { doubleAttack: true } }),
    creature({ id: 'faucheurReves', name: 'Faucheur de rêves', rarity: 'uncommon', cost: 5, req: { m: 5, g: 1 }, atk: 3, ret: 3, hp: 6, attackType: 'shooter', magic: true, icon: '🌘', art: 'Dreamreaver_card', keywords: { noret: true, enrage: 1 } }),
    creature({ id: 'guerrierJaguar', name: 'Guerrier jaguar', rarity: 'uncommon', cost: 3, req: { m: 3 }, atk: 1, ret: 0, hp: 5, attackType: 'melee', school: 'Air', icon: '🐯', art: 'Jaguar_warrior_card', keywords: { enrage: 1, armor: 1, charge: true } }),
    creature({ id: 'furieFrappeuse', name: 'Furie frappeuse', rarity: 'uncommon', cost: 4, req: { m: 4 }, atk: 3, ret: 1, hp: 5, attackType: 'flyer', school: 'Air', icon: '🪽', art: 'Striking_fury', keywords: { noret: true, enrage: 1 } }),
    creature({ id: 'archerCentaure', name: 'Archer centaure', rarity: 'common', cost: 3, req: { m: 3 }, atk: 3, ret: 2, hp: 4, attackType: 'shooter', icon: '🏹', art: 'Centaur_archer', keywords: { noret: true } }),
    creature({ id: 'marcheurReves', name: 'Marcheur des rêves', rarity: 'common', cost: 3, req: { m: 3, g: 1 }, atk: 2, ret: 0, hp: 4, attackType: 'shooter', magic: true, icon: '🌙', art: 'Dreamwalker_card', keywords: { noret: true, enrage: 1 } }),
    creature({ id: 'eclaireurGobelin', name: 'Éclaireur gobelin', rarity: 'common', cost: 1, req: { m: 1 }, atk: 2, ret: 0, hp: 1, attackType: 'shooter', icon: '👺', art: 'Goblin_scout', keywords: { noret: true } }),
    creature({ id: 'chasseurGobelin', name: 'Chasseur gobelin', rarity: 'common', cost: 2, req: { m: 2 }, atk: 2, ret: 1, hp: 3, attackType: 'shooter', icon: '🎯', art: 'Goblin_hunter_card', keywords: { noret: true } }),
    creature({ id: 'harpieRanaar', name: 'Harpie ranaar', rarity: 'common', cost: 2, req: { m: 2 }, atk: 2, ret: 1, hp: 4, attackType: 'flyer', icon: '🦅', art: 'Ranaar_harpy' }),
    creature({ id: 'cogneurRanaar', name: 'Cogneur ranaar', rarity: 'common', cost: 1, req: { m: 1 }, atk: 0, ret: 0, hp: 3, attackType: 'melee', icon: '😤', art: 'Ranaar_mauler', keywords: { enrage: 1 } }),
    creature({ id: 'orcCorrompu', name: 'Orc corrompu', rarity: 'common', cost: 4, req: { m: 4 }, atk: 4, ret: 3, hp: 7, attackType: 'melee', icon: '🧌', art: 'Tainted_orc' }),
    fortune({
      id: 'grandFinalKat', name: 'Grand final de Kat', rarity: 'unique', cost: 5, req: { m: 4, d: 4 }, icon: '🎆', art: 'Kat_s_grand_finale',
      text: 'Déployez gratuitement une créature de votre main. Elle gagne Attaque rapide. À la fin du tour, détruisez-la.',
      effect: effect([
        handStep('Choisissez la créature à déployer.', c => c.type === 'creature', 'Aucune créature dans votre main.'),
        {
          prompt: 'Choisissez où la déployer.',
          emptyReason: 'Aucun emplacement libre.',
          options: () => [],
          after: (g, pi, [pick]) => {
            const cardId = pick?.kind === 'hand' ? g.player(pi).hand[pick.index] : undefined;
            const card = cardId === undefined ? null : getCard(cardId);
            return card?.type === 'creature' ? g.deploySlots(pi, card).map((s): Choice => ({ kind: 'slot', ...s })) : [];
          },
        },
      ], (g, pi, { choices, taken }) => {
        const slot = choices[1];
        if (slot?.kind === 'slot' && taken[0]) g.deployForOneTurn(pi, taken[0], slot);
      }),
    }),
    fortune({
      id: 'dernierCarre', name: 'Le dernier carré', rarity: 'rare', cost: 3, req: { d: 2 }, icon: '🚩', art: 'The_last_stand',
      text: 'Jusqu\'à la fin du tour : vos créatures gagnent Ubiquité.',
      effect: effect([], () => {}),
      lasting: { duration: 'endOfTurn', keywords: (_g, unit, entry) => (unit.owner === entry.owner ? { attackAnywhere: true } : {}) },
    }),
    fortune({
      id: 'campOrc', name: 'Camp orc', rarity: 'uncommon', cost: 2, req: { d: 2 }, icon: '⛺', art: 'Orc_camp',
      text: 'Posez sur chacune de vos créatures autant de marqueurs de rage que sa valeur de Rage furibonde.',
      effect: effect([], (g, pi) => g.units(pi).forEach(x => {
        const enrage = g.keywordsOf(x.unit).enrage;
        if (enrage) g.addCounters(x.unit, 'enrage', enrage);
      })),
    }),
    fortune({
      id: 'arene', name: 'Arène', rarity: 'common', cost: 2, req: { d: 2 }, icon: '🏟️', art: 'Arena_card',
      text: 'Au choix : piochez une carte, OU si votre héros a moins de PV que le héros ennemi, infligez-lui 3 dégâts.',
      effect: effect([{
        prompt: 'Choisissez un effet.',
        labels: ['Piocher une carte', 'Infliger 3 dégâts au héros ennemi'],
        options: (g, pi) => {
          const modes: Choice[] = [{ kind: 'mode', index: 0 }];
          if (g.player(pi).hp < g.player(other(pi)).hp) modes.push({ kind: 'mode', index: 1 });
          return modes;
        },
      }], (g, pi, { choices }) => {
        if (choices[0]?.kind === 'mode' && choices[0].index === 1) g.damageHero(other(pi), 3);
        else g.draw(pi, 1);
      }),
    }),
    fortune({
      id: 'bassinSang', name: 'Bassin de sang', rarity: 'common', cost: 2, req: { d: 2 }, icon: '🩸', art: 'Blood_pool',
      text: 'Votre héros subit 2 dégâts. Jusqu\'à la fin du tour : vos créatures gagnent +1 en attaque.',
      effect: effect([], (g, pi) => g.damageHero(pi, 2)),
      lasting: { duration: 'endOfTurn', attackBonus: (_g, unit, entry) => (unit.owner === entry.owner ? 1 : 0) },
    }),
    fortune({
      id: 'hutteChaman', name: 'Hutte du chaman de sang', rarity: 'common', cost: 1, req: { d: 1 }, icon: '🛖', art: 'Blood_shaman_hut',
      text: 'Une créature alliée ciblée gagne +2 en attaque jusqu\'à la fin du tour. Placez une carte de votre main au-dessus de votre bibliothèque.',
      effect: effect([
        creatureStep('Choisissez la créature alliée à renforcer.', 'ally'),
        handStep('Choisissez la carte à remettre sur votre bibliothèque.'),
      ], (g, pi, { choices, taken }) => {
        g.boostUntilEndOfTurn(unitChoice(choices[0]), 2);
        g.putOnLibrary(pi, taken);
      }),
    }),
    fortune({
      id: 'autelSacrificiel', name: 'Autel sacrificiel', rarity: 'common', cost: 1, req: { d: 1 }, icon: '🗿', art: 'Sacrificial_altar',
      text: 'Choisissez une créature alliée ciblée. Infligez à une autre créature ciblée des dégâts égaux à ses PV restants, puis détruisez la créature alliée.',
      effect: effect([
        creatureStep('Choisissez la créature alliée à sacrifier.', 'ally'),
        creatureStep('Choisissez la créature à frapper.', 'any', undefined, 0),
      ], (g, _pi, { choices }) => {
        const sacrificed = unitChoice(choices[0]);
        const hp = g.locate(sacrificed)?.unit.hpCur ?? 0;
        g.damageUnit(unitChoice(choices[1]), hp, { magic: false });
        g.destroyUnit(sacrificed);
      }),
    }),
  ]),

  // ======================= HÉRAUT DU VIDE : HAVRE =======================
  ...section('havre', 'heraldOfTheVoid', [
    creature({ id: 'pretreBatailleGriffon', name: 'Prêtre de bataille griffon', rarity: 'unique', cost: 3, req: { m: 2, g: 2 }, atk: 1, ret: 2, hp: 5, attackType: 'shooter', magic: true, school: 'Lumière', icon: '🙏', art: 'Griffin_battle_priest', keywords: { noret: true, heal: 2, heroRegen: 1 } }),
    creature({ id: 'gloireImmaculee', name: 'Gloire immaculée', rarity: 'rare', cost: 5, req: { m: 4, g: 2 }, atk: 3, ret: 3, hp: 6, attackType: 'flyer', magic: true, school: 'Lumière', icon: '✨', art: 'Immaculate_glory', keywords: { darkWard: true, noCounters: true } }),
    creature({
      id: 'angeMisericorde', name: 'Ange de miséricorde', rarity: 'uncommon', cost: 4, req: { m: 3, d: 2 }, atk: 2, ret: 2, hp: 6, attackType: 'flyer', school: 'Lumière', icon: '👼', art: 'Angel_of_Mercy',
      text: 'En arrivant, reprend au hasard une carte de créature de votre cimetière.',
      arrival: effect([], (g, pi) => g.recallRandomCreature(pi, false)),
    }),
    creature({ id: 'chevalierGriffon', name: 'Chevalier griffon', rarity: 'uncommon', cost: 3, req: { m: 3 }, atk: 1, ret: 2, hp: 5, attackType: 'flyer', icon: '🦅', art: 'Griffin_knight', keywords: { flyerGuard: 2 } }),
    creature({ id: 'lancierGriffon', name: 'Lancier monté sur griffon', rarity: 'uncommon', cost: 4, req: { m: 4 }, atk: 3, ret: 2, hp: 6, attackType: 'melee', icon: '🐎', art: 'Griffin_mounted_spearman', keywords: { swift: true } }),
    creature({ id: 'elusElrath', name: 'Élu d\'Elrath', rarity: 'common', cost: 4, req: { m: 4, g: 1 }, atk: 2, ret: 2, hp: 6, attackType: 'shooter', magic: true, school: 'Lumière', icon: '🌟', art: 'Chosen_of_Elrath', keywords: { noret: true, mending: true } }),
    creature({ id: 'tireurGriffon', name: 'Tireur d\'élite griffon', rarity: 'common', cost: 4, req: { m: 4 }, atk: 3, ret: 3, hp: 6, attackType: 'shooter', icon: '🏹', art: 'Griffin_marksman', keywords: { noret: true } }),
    creature({ id: 'gardeLoup', name: 'Garde du Loup', rarity: 'common', cost: 2, req: { m: 1 }, atk: 0, ret: 2, hp: 5, attackType: 'melee', icon: '🛡️', art: 'Wolf_guard', keywords: { retribution: true, perfectRetaliation: true, packBonus: 1 } }),
    fortune({
      id: 'postureOffensive', name: 'Posture offensive', rarity: 'rare', cost: 1, req: { d: 2 }, icon: '⚔️', art: 'Offensive_stance',
      text: 'Jusqu\'à votre prochain tour : vos créatures gagnent Riposte parfaite.',
      effect: effect([], () => {}),
      lasting: { duration: 'nextTurn', keywords: (_g, unit, entry) => (unit.owner === entry.owner ? { perfectRetaliation: true } : {}) },
    }),
    fortune({
      id: 'forceNombre', name: 'La force du nombre', rarity: 'common', cost: 2, req: { d: 2 }, icon: '👥', art: 'Strength_in_numbers',
      text: 'Soignez votre héros d\'1 blessure par créature alliée sur le champ de bataille.',
      effect: effect([], (g, pi) => g.healHero(pi, g.units(pi).length)),
    }),
    fortune({
      id: 'benedictionElrath', name: 'Bénédiction d\'Elrath', rarity: 'common', cost: 2, req: { d: 2 }, icon: '💖', art: 'Elrath_s_blessing',
      text: 'Soignez 5 blessures de votre héros. Ne peut être jouée que si votre héros a 5 PV ou moins.',
      effect: effect([], (g, pi) => g.healHero(pi, 5), { requirement: (g, pi) => (g.player(pi).hp > 5 ? 'Votre héros doit avoir 5 PV ou moins.' : null) }),
    }),
    fortune({
      id: 'tenteSoeurs', name: 'La tente des sœurs', rarity: 'common', cost: 2, req: { d: 2 }, icon: '⛺', art: 'Sister_s_tent',
      text: 'Placez une carte de créature ciblée de votre cimetière au-dessus de votre bibliothèque.',
      effect: effect([zoneStep('Choisissez la créature à remettre sur votre bibliothèque.', 'grave', c => c.type === 'creature', 'Aucune créature dans votre cimetière.')],
        (g, pi, { choices }) => g.graveToLibraryTop(pi, cardChoice(choices[0]))),
    }),
  ]),

  // ===================== HÉRAUT DU VIDE : NÉCROPOLE =====================
  ...section('necropole', 'heraldOfTheVoid', [
    creature({ id: 'canalisatriceNamtaru', name: 'Canalisatrice namtaru', rarity: 'unique', cost: 3, req: { m: 2, g: 2 }, atk: 1, ret: 0, hp: 5, attackType: 'melee', magic: true, school: 'Primordiale', icon: '🧿', art: 'Namtaru_channeler', keywords: { infect: 1, spellBonus: 1 } }),
    creature({ id: 'cauchemarVivant', name: 'Cauchemar vivant', rarity: 'rare', cost: 5, req: { m: 4 }, atk: 3, ret: 3, hp: 6, attackType: 'melee', school: 'Ténèbres', icon: '😱', art: 'Living_nightmare', keywords: { fear: 3 } }),
    creature({ id: 'ermiteBoisSombre', name: 'Ermite du Bois sombre', rarity: 'uncommon', cost: 4, req: { m: 4, g: 1 }, atk: 2, ret: 1, hp: 6, attackType: 'shooter', magic: true, school: 'Terre', icon: '🧙', art: 'Dark_Wood_hermit', keywords: { noret: true, infect: 1, infectAura: 1 } }),
    creature({
      id: 'cracheurPourriture', name: 'Cracheur de pourriture', rarity: 'uncommon', cost: 4, req: { m: 4 }, atk: 2, ret: 0, hp: 5, attackType: 'shooter', school: 'Terre', icon: '🕷️', art: 'Decay_spitter', keywords: { infect: 1 },
      text: 'En arrivant, pose 2 marqueurs de poison sur une autre créature ciblée.',
      arrival: effect([creatureStep('Choisissez la créature à empoisonner.', 'any')], (g, _pi, { choices }) => {
        const unit = g.locate(unitChoice(choices[0]))?.unit;
        if (unit) g.addCounters(unit, 'poison', 2);
      }),
    }),
    creature({ id: 'licheDevoreuse', name: 'Liche dévoreuse d\'âmes', rarity: 'uncommon', cost: 4, req: { m: 4 }, atk: 2, ret: 1, hp: 7, attackType: 'melee', school: 'Ténèbres', icon: '💀', art: 'Soul-consuming_lich', keywords: { soulFeed: 2 } }),
    creature({ id: 'arbrePendu', name: 'Arbre aux pendus', rarity: 'common', cost: 2, req: { m: 1 }, atk: 0, ret: 1, hp: 5, attackType: 'melee', school: 'Terre', icon: '🌳', art: 'Hangman_tree', keywords: { noAttack: true, regen: 2 } }),
    creature({ id: 'archerSquelette', name: 'Archer squelette', rarity: 'common', cost: 3, req: { m: 3 }, atk: 2, ret: 2, hp: 5, attackType: 'shooter', icon: '🏹', art: 'Skeleton_archer_card', keywords: { noret: true } }),
    creature({ id: 'spectreIndompte', name: 'Spectre indompté', rarity: 'common', cost: 3, req: { m: 3, g: 1 }, atk: 2, ret: 2, hp: 4, attackType: 'flyer', magic: true, school: 'Primordiale', icon: '👻', art: 'Untamed_wraith', keywords: { incorporeal: true } }),
    fortune({
      id: 'dernierOrdreSeria', name: 'Le dernier ordre de Seria', rarity: 'rare', cost: 5, req: { m: 4, d: 4 }, icon: '📯', art: 'Seria_s_last_order',
      text: 'Déployez gratuitement une créature non unique ciblée de votre cimetière. Elle gagne Attaque rapide. À la fin du tour, bannissez-la.',
      effect: effect([
        zoneStep('Choisissez la créature à rappeler.', 'grave', c => c.type === 'creature' && c.rarity !== 'unique', 'Aucune créature non unique dans votre cimetière.'),
        {
          prompt: 'Choisissez où la déployer.', emptyReason: 'Aucun emplacement libre.', options: () => [],
          after: (g, pi, [pick]) => (pick?.kind === 'card' ? g.deploySlots(pi, getCreature(pick.cardId)).map((sl): Choice => ({ kind: 'slot', ...sl })) : []),
        },
      ], (g, pi, { choices: [pick, slot] }) => {
        const cardId = cardChoice(pick);
        if (slot?.kind === 'slot' && g.takeFromGrave(pi, cardId)) g.deployForOneTurn(pi, cardId, slot, 'banish');
      }),
    }),
    fortune({
      id: 'tombePrecoce', name: 'Tombe précoce', rarity: 'uncommon', cost: 2, req: { d: 3 }, icon: '⚰️', art: 'Early_grave',
      text: 'Cherchez une carte de créature dans votre bibliothèque et mettez-la au cimetière. Mélangez votre bibliothèque.',
      effect: effect([zoneStep('Choisissez la créature à mettre au cimetière.', 'library', c => c.type === 'creature', 'Aucune créature dans votre bibliothèque.')],
        (g, pi, { choices }) => g.millCard(pi, cardChoice(choices[0]))),
    }),
    fortune({
      id: 'consumerServiteurs', name: 'Consumer les serviteurs', rarity: 'common', cost: 2, req: { d: 2 }, icon: '🍖', art: 'Consume_minions',
      text: 'Détruisez une créature alliée ciblée. Soignez 3 blessures de votre héros.',
      effect: effect([creatureStep('Choisissez la créature alliée à consumer.', 'ally')], (g, pi, { choices }) => {
        g.destroyUnit(unitChoice(choices[0]));
        g.healHero(pi, 3);
      }),
    }),
    fortune({
      id: 'riteRestauration', name: 'Rite de restauration nécromantique', rarity: 'common', cost: 1, req: { d: 1 }, icon: '🩹', art: 'Rite_of_Necromantic_Restoration',
      text: 'Détruisez une créature alliée ciblée. Soignez toutes les blessures d\'une autre créature ciblée.',
      effect: effect([
        creatureStep('Choisissez la créature alliée à sacrifier.', 'ally'),
        creatureStep('Choisissez la créature à soigner.', 'any', undefined, 0),
      ], (g, _pi, { choices }) => {
        g.destroyUnit(unitChoice(choices[0]));
        const healed = g.locate(unitChoice(choices[1]))?.unit;
        if (healed) g.healUnit(healed.uid, healed.hpMax - healed.hpCur);
      }),
    }),
  ]),

  // ====================== HÉRAUT DU VIDE : INFERNO ======================
  ...section('inferno', 'heraldOfTheVoid', [
    creature({ id: 'voyantChaos', name: 'Voyant du chaos', rarity: 'unique', cost: 3, req: { m: 2, d: 2 }, atk: 2, ret: 0, hp: 3, attackType: 'shooter', school: 'Primordiale', icon: '🔮', art: 'Chaos_seer', keywords: { noret: true, handLimit: 6, leaveDiscard: true } }),
    creature({ id: 'arbitreNeant', name: 'Arbitre du Néant', rarity: 'rare', cost: 4, req: { m: 2, g: 2, d: 2 }, atk: 2, ret: 1, hp: 4, attackType: 'shooter', magic: true, school: 'Primordiale', icon: '⚖️', art: 'Void_arbiter', keywords: { noret: true, magicChannel: 2, noExtraDraw: true } }),
    creature({ id: 'plieurDestin', name: 'Plieur de destin', rarity: 'rare', cost: 3, req: { m: 3, g: 1, d: 1 }, atk: 2, ret: 2, hp: 5, attackType: 'shooter', magic: true, school: 'Primordiale', icon: '🧙‍♂️', art: 'Fate_bender', keywords: { noret: true, discardRage: 2 } }),
    creature({ id: 'lacerateurChaos', name: 'Lacérateur du chaos', rarity: 'uncommon', cost: 2, req: { m: 2, g: 1, d: 1 }, atk: 2, ret: 0, hp: 3, attackType: 'melee', magic: true, school: 'Feu', icon: '👹', art: 'Chaos_lacerator', keywords: { areaBlast: 3, deathDiscard: true } }),
    creature({ id: 'maniaqueFlammes', name: 'Maniaque des flammes infernales', rarity: 'uncommon', cost: 5, req: { m: 5 }, atk: 3, ret: 0, hp: 5, attackType: 'melee', school: 'Feu', icon: '🤪', art: 'Hellfire_maniac', keywords: { berserkAura: true, punish: 4 } }),
    creature({ id: 'rodeurTenebres', name: 'Rôdeur des ténèbres', rarity: 'uncommon', cost: 2, req: { m: 3 }, atk: 2, ret: 0, hp: 4, attackType: 'melee', school: 'Ténèbres', icon: '🦇', art: 'Lurker_in_the_Dark', keywords: { fear: 2 } }),
    creature({ id: 'gonfleurFlammes', name: 'Gonfleur des flammes infernales', rarity: 'common', cost: 2, req: { m: 1, g: 2 }, atk: 0, ret: 0, hp: 2, attackType: 'melee', magic: true, school: 'Feu', icon: '🎈', art: 'Hellfire_bloater', keywords: { noAttack: true, fireBurst: 4 } }),
    creature({ id: 'esclaveFlammes', name: 'Esclave des flammes infernales', rarity: 'common', cost: 4, req: { m: 4 }, atk: 4, ret: 4, hp: 4, attackType: 'shooter', school: 'Feu', icon: '⛓️', art: 'Hellfire_slave', keywords: { noret: true } }),
    creature({ id: 'executeurUrKhrag', name: 'Exécuteur ur-khrag', rarity: 'common', cost: 5, req: { m: 5 }, atk: 4, ret: 5, hp: 7, attackType: 'melee', icon: '🪓', art: 'Ur-Khrag_enforcer', keywords: { berserk: true, sweep: true } }),
    fortune({
      id: 'failleNeant', name: 'Faille du Néant', rarity: 'rare', cost: 5, req: { d: 3 }, icon: '🕳️', art: 'Void_rift',
      text: 'Regardez la main de l\'adversaire et choisissez-y une carte : il la défausse avec toutes ses homonymes. Détruisez toutes les cartes de ce nom en jeu.',
      effect: effect([], (g, pi) => g.pickFromOpponentHand(pi, ['creature', 'spell', 'fortune'], true, true)),
    }),
    fortune({
      id: 'jugementNeant', name: 'Jugement du Néant', rarity: 'uncommon', cost: 2, req: { d: 2 }, icon: '⚖️', art: 'Void_judgement',
      text: 'Bannissez toutes les cartes des deux cimetières.',
      effect: effect([], g => g.banishGraves()),
    }),
    fortune({
      id: 'chambreDemence', name: 'Chambre de la démence', rarity: 'common', cost: 1, req: { d: 1 }, icon: '🌀', art: 'Chamber_of_Dementia',
      text: 'Choisissez créature, sort ou fortune. Jusqu\'à votre prochain tour : chaque fois que l\'adversaire joue une carte de ce type, il défausse une carte au hasard.',
      effect: effect([{
        prompt: 'Choisissez le type de carte à punir.',
        labels: ['Créature', 'Sort', 'Fortune'],
        options: () => [0, 1, 2].map((index): Choice => ({ kind: 'mode', index })),
      }], () => {}),
      lasting: { duration: 'nextTurn', subjects: ['creature', 'spell', 'fortune'], punishesPlays: true },
    }),
    fortune({
      id: 'sallesInertie', name: 'Salles de l\'inertie', rarity: 'common', cost: 2, req: { d: 2 }, icon: '🏛️', art: 'Halls_of_Inertia',
      text: 'Jusqu\'à votre prochain tour : personne ne peut piocher en dehors de sa phase de ravitaillement.',
      effect: effect([], () => {}),
      lasting: { duration: 'nextTurn', noExtraDraw: true },
    }),
  ]),

  // ==================== HÉRAUT DU VIDE : SANCTUAIRE ====================
  ...section('sanctuaire', 'heraldOfTheVoid', [
    creature({ id: 'guerrierShinje', name: 'Guerrier shinje', rarity: 'unique', cost: 3, req: { m: 3, g: 1 }, atk: 2, ret: 0, hp: 4, attackType: 'melee', magic: true, icon: '🗡️', art: 'Shinje_warrior', keywords: { destroysAttacker: true } }),
    creature({ id: 'kappaVenerable', name: 'Kappa vénérable', rarity: 'uncommon', cost: 4, req: { m: 4, d: 1 }, atk: 3, ret: 3, hp: 6, attackType: 'melee', icon: '🐢', art: 'Venerable_kappa', keywords: { fortuneWard: true } }),
    creature({
      id: 'kabukiTei', name: 'Kabuki tei', rarity: 'uncommon', cost: 4, req: { m: 3, d: 2 }, atk: 2, ret: 2, hp: 5, attackType: 'melee', icon: '🎭', art: 'Kabuki_tei', keywords: { honor: 1, replaces: true },
      text: 'Peut être déployé sur une autre créature alliée, qui retourne alors dans la main de son propriétaire.',
    }),
    creature({
      id: 'chanteuseRuisseau', name: 'Chanteuse du ruisseau', rarity: 'uncommon', cost: 2, req: { m: 1, g: 1, d: 1 }, atk: 1, ret: 0, hp: 3, attackType: 'shooter', magic: true, school: 'Eau', icon: '🎶', art: 'Stream_singer', keywords: { noret: true },
      text: 'En arrivant, renvoie un sort ou une fortune permanent ciblé dans la main de son propriétaire.',
      arrival: effect([lastingStep('Choisissez la carte permanente à renvoyer.', ['spell', 'fortune'])], (g, _pi, { choices }) => {
        const pick = choices[0];
        if (pick?.kind === 'lasting') g.returnLastingToHand(pick.index);
      }),
    }),
    creature({ id: 'nagaYokujin', name: 'Naga yokujin', rarity: 'common', cost: 3, req: { m: 3 }, atk: 2, ret: 2, hp: 5, attackType: 'shooter', icon: '🏹', art: 'Naga_yokujin', keywords: { noret: true } }),
    creature({ id: 'okaneNoOkane', name: 'Okane no okane', rarity: 'common', cost: 3, req: { m: 2, d: 1 }, atk: 2, ret: 1, hp: 4, attackType: 'shooter', school: 'Primordiale', icon: '🐍', art: 'Okane_no_okane', keywords: { noret: true, noResourceGain: true } }),
    creature({ id: 'gardiensCascade', name: 'Gardiens de la cascade', rarity: 'common', cost: 2, req: { m: 1 }, atk: 0, ret: 2, hp: 5, attackType: 'melee', school: 'Eau', icon: '🌊', art: 'Waterfall_guardians', keywords: { hypnotize: true } }),
    fortune({
      id: 'transeCombat', name: 'Transe de combat', rarity: 'rare', cost: 2, req: { d: 2 }, icon: '🧘', art: 'Battle_trance',
      text: 'Cherchez une carte dans votre bibliothèque, mélangez-la, puis placez cette carte au-dessus.',
      effect: effect([zoneStep('Choisissez la carte à placer au-dessus de votre bibliothèque.', 'library', () => true, 'Votre bibliothèque est vide.')],
        (g, pi, { choices }) => g.moveToLibraryTop(pi, cardChoice(choices[0]))),
    }),
    fortune({
      id: 'bassinDivination', name: 'Bassin de divination', rarity: 'uncommon', cost: 2, req: { d: 2 }, icon: '🔮', art: 'Scrying_pool',
      text: 'Regardez les 5 cartes du dessus de votre bibliothèque et remettez-les dans l\'ordre de votre choix.',
      effect: effect([], (g, pi) => g.reorderTop(pi, 5)),
    }),
    fortune({
      id: 'salleFortune', name: 'Salle de la fortune', rarity: 'common', cost: 1, req: { d: 2 }, icon: '🍀', art: 'Hall_of_Fortune',
      text: 'Regardez les 3 cartes du dessus de votre bibliothèque : prenez-en une en main, placez les deux autres sous votre bibliothèque.',
      effect: effect([], (g, pi) => g.pickFromTop(pi, 3)),
    }),
    fortune({
      id: 'rapportEspion', name: 'Rapport d\'espion', rarity: 'common', cost: 2, req: { d: 2 }, icon: '📜', art: 'Spy_report',
      text: 'Consultez la bibliothèque de l\'adversaire, puis mélangez-la. Piochez une carte.',
      effect: effect([], (g, pi) => {
        g.browseOpponentLibrary(pi);
        g.draw(pi, 1);
      }),
    }),
  ]),

  // ======================= HÉRAUT DU VIDE : BASTION ======================
  ...section('bastion', 'heraldOfTheVoid', [
    creature({ id: 'cyclopeCraneNoir', name: 'Cyclope du Crâne noir', rarity: 'unique', cost: 6, req: { m: 6 }, atk: 3, ret: 0, hp: 6, attackType: 'melee', icon: '👁️', art: 'Blackskull_cyclops', keywords: { doubleAttack: true, fear: 4 } }),
    creature({ id: 'wyverneFrenetique', name: 'Wyverne frénétique', rarity: 'rare', cost: 5, req: { m: 5 }, atk: 3, ret: 3, hp: 8, attackType: 'flyer', icon: '🐉', art: 'Bloodfrenized_wyvern', keywords: { bloodthirst: 1 } }),
    creature({ id: 'broyeurCraneNoir', name: 'Broyeur du Crâne noir', rarity: 'uncommon', cost: 5, req: { m: 5 }, atk: 3, ret: 2, hp: 7, attackType: 'melee', icon: '🔨', art: 'Blackskull_crusher', keywords: { enemySpellWard: true } }),
    creature({ id: 'dechiqueteurCraneNoir', name: 'Déchiqueteur du Crâne noir', rarity: 'uncommon', cost: 4, req: { m: 4 }, atk: 2, ret: 0, hp: 4, attackType: 'melee', school: 'Air', icon: '🪚', art: 'Blackskull_shredder', keywords: { quickAttack: true, swift: true } }),
    creature({ id: 'briseSortsCraneNoir', name: 'Brise-sorts du Crâne noir', rarity: 'uncommon', cost: 4, req: { m: 4 }, atk: 2, ret: 2, hp: 6, attackType: 'melee', icon: '💥', art: 'Blackskull_spellsmasher', keywords: { spellsmasher: true } }),
    creature({ id: 'centaureCraneNoir', name: 'Centaure du Crâne noir', rarity: 'common', cost: 3, req: { m: 3 }, atk: 2, ret: 1, hp: 3, attackType: 'shooter', icon: '🏹', art: 'Blackskull_centaur', keywords: { noret: true, swift: true } }),
    creature({ id: 'betePronces', name: 'Bête des ronces', rarity: 'common', cost: 2, req: { m: 1 }, atk: 0, ret: 2, hp: 5, attackType: 'melee', school: 'Terre', icon: '🌿', art: 'Bramble_beast', keywords: { armor: 1, spellResist: true } }),
    creature({ id: 'guerrierChaton', name: 'Chaton guerrier', rarity: 'common', cost: 1, req: {}, atk: 1, ret: 0, hp: 1, attackType: 'melee', icon: '🐱', art: 'Kitten_warrior', keywords: { quickAttack: true, untargetable: true } }),
    creature({ id: 'oliphantGuerre', name: 'Oliphant de guerre', rarity: 'common', cost: 3, req: { m: 3 }, atk: 2, ret: 2, hp: 7, attackType: 'melee', icon: '🐘', art: 'War_oliphant' }),
    fortune({
      id: 'sangTribu', name: 'Le sang de ma tribu', rarity: 'rare', cost: 0, req: { d: 2 }, icon: '🩸', art: 'Blood_of_my_tribe',
      text: 'Jusqu\'à votre prochain tour : chaque fois qu\'une de vos créatures meurt, votre Puissance augmente de 1.',
      effect: effect([], () => {}),
      lasting: { duration: 'nextTurn', mightOnDeath: true },
    }),
    fortune({
      id: 'debandade', name: 'Débandade', rarity: 'uncommon', cost: 2, req: { d: 2 }, icon: '🐃', art: 'Stampede',
      text: 'Infligez 3 dégâts au héros ennemi. Ne peut être jouée que si vous avez déployé 2 créatures ou plus ce tour-ci.',
      effect: effect([], (g, pi) => g.damageHero(other(pi), 3), {
        requirement: (g, pi) => (g.player(pi).deployedThisTurn < 2 ? 'Il faut avoir déployé 2 créatures ce tour-ci.' : null),
      }),
    }),
    fortune({
      id: 'armurerieOrc', name: 'Armurerie orc', rarity: 'common', cost: 3, req: { d: 2 }, icon: '🛡️', art: 'Orc_armory',
      text: 'Augmentez votre Puissance de 2.',
      effect: effect([], (g, pi) => g.increaseStat(pi, 'm', 2)),
    }),
  ]),

  // ======================= HÉRAUT DU VIDE : NEUTRES ======================
  ...section(null, 'heraldOfTheVoid', [
    creature({ id: 'elementaireTerreSuperieur', name: 'Élémentaire de terre supérieur', rarity: 'rare', cost: 6, req: { m: 5, g: 2 }, atk: 3, ret: 4, hp: 9, attackType: 'melee', magic: true, school: 'Terre', icon: '🪨', art: 'Greater_earth_elemental', keywords: { earthHeal: true, towering: true } }),
    creature({ id: 'gardienNeant', name: 'Gardien du Néant', rarity: 'rare', cost: 4, req: { m: 3, g: 1, d: 2 }, atk: 2, ret: 1, hp: 5, attackType: 'shooter', magic: true, school: 'Primordiale', icon: '🧙', art: 'Void_keeper', keywords: { noret: true, banishDead: true } }),
    creature({ id: 'sylvestreBoisSombre', name: 'Sylvestre du Bois sombre', rarity: 'uncommon', cost: 3, req: { m: 1 }, atk: 0, ret: 1, hp: 7, attackType: 'melee', school: 'Terre', icon: '🌲', art: 'Dark_Wood_treant', keywords: { towering: true, noAttack: true } }),
    creature({
      id: 'colporteurMagie', name: 'Colporteur de magie', rarity: 'uncommon', cost: 2, req: { m: 1, d: 2 }, atk: 1, ret: 0, hp: 1, attackType: 'melee', icon: '🎒', art: 'Magic_peddler',
      text: 'En arrivant, cherche un sort unique dans votre bibliothèque et l\'ajoute à votre main.',
      arrival: effect([zoneStep('Choisissez le sort unique à prendre.', 'library', c => c.type === 'spell' && c.rarity === 'unique', 'Aucun sort unique dans votre bibliothèque.')],
        (g, pi, { choices }) => g.tutor(pi, cardChoice(choices[0]))),
    }),
    creature({ id: 'elementaireEauMineur', name: 'Élémentaire d\'eau mineur', rarity: 'common', cost: 3, req: { m: 2, g: 1 }, atk: 2, ret: 1, hp: 4, attackType: 'shooter', magic: true, school: 'Eau', icon: '💧', art: 'Lesser_water_elemental', keywords: { noret: true } }),
    creature({ id: 'serpentaile', name: 'Serpentaile', rarity: 'common', cost: 1, req: { m: 1 }, atk: 1, ret: 0, hp: 2, attackType: 'flyer', icon: '🪰', art: 'Serpentfly_card' }),
    fortune({
      id: 'autelVoeux', name: 'Autel des souhaits', rarity: 'rare', cost: 2, req: { d: 2 }, icon: '🌠', art: 'Altar_of_Wishes_card',
      text: 'Révélez la carte du dessus de votre bibliothèque. Si vous remplissez ses conditions, prenez-la en main : elle ne coûte rien ce tour-ci.',
      effect: effect([], (g, pi) => g.wishTopCard(pi)),
    }),
    fortune({
      id: 'renegats', name: 'Renégats', rarity: 'rare', cost: 2, req: { d: 2 }, icon: '🔄', art: 'Turncoats',
      text: 'La production de chaque joueur diminue de 1.',
      effect: effect([], g => [0, 1].forEach(q => g.changeProduction(q as PlayerIndex, -1))),
    }),
    fortune({
      id: 'mineOr', name: 'Mine d\'or', rarity: 'common', cost: 2, req: { d: 2 }, icon: '⛏️', art: 'Gold_mine_card',
      text: 'Votre production augmente de 1.',
      effect: effect([], (g, pi) => g.changeProduction(pi, 1)),
    }),
    fortune({
      id: 'tactiquesRevisees', name: 'Tactiques révisées', rarity: 'uncommon', cost: 1, req: { d: 2 }, icon: '📋', art: 'Revised_tactics',
      text: 'Cherchez 3 cartes dans votre bibliothèque et bannissez-les, puis mélangez-la. Piochez une carte.',
      effect: effect([1, 2, 3].map(n => zoneStep(`Choisissez la carte n°${n} à bannir.`, 'library', () => true, 'Votre bibliothèque est vide.')),
        (g, pi, { choices }) => {
          choices.forEach(c => g.banishFromLibrary(pi, cardChoice(c)));
          g.draw(pi, 1);
        }),
    }),
    fortune({
      id: 'caverneOubliee', name: 'Caverne oubliée', rarity: 'common', cost: 3, req: { d: 2 }, icon: '🕳️', art: 'Forgotten_cave',
      text: 'Piochez 2 cartes.',
      effect: effect([], (g, pi) => g.draw(pi, 2)),
    }),
    fortune({
      id: 'savoirSuperieur', name: 'Savoir supérieur', rarity: 'common', cost: 4, req: { d: 2 }, icon: '📚', art: 'Higher_learning',
      text: 'Augmentez de 1 votre Puissance, votre Magie et votre Destinée.',
      effect: effect([], (g, pi) => STAT_KEYS.forEach(k => g.increaseStat(pi, k, 1))),
    }),

    // ------------------------------ Sorts ------------------------------
    spell({
      id: 'flammeInterdite', name: 'La flamme interdite', school: 'Feu', rarity: 'unique', cost: 4, req: { g: 3 }, icon: '🔥', art: 'The_Forbidden_Flame',
      text: 'Inflige à chaque créature des dégâts égaux au double de votre Magie.',
      effect: effect([], (g, pi) => {
        const n = 2 * g.statOf(pi, 'g');
        [...g.units(0), ...g.units(1)].forEach(x => g.damageUnit(x.unit.uid, n, FIRE));
      }),
    }),
    spell({
      id: 'porteNulle', name: 'La porte vers nulle part', school: 'Primordiale', rarity: 'unique', cost: 3, req: { g: 3 }, icon: '🚪', art: 'The_Gate_to_Nowhere',
      text: 'Enchante un couloir. Permanent : une créature ennemie de ce couloir qui attaque est ensuite bannie.',
      effect: effect([laneStep('Choisissez le couloir à enchanter.')], () => {}),
      lasting: { duration: 'permanent', lane: true, banishesAttackers: true },
    }),
    spell({
      id: 'lumiereLendemain', name: 'La lumière de demain', school: 'Lumière', rarity: 'unique', cost: 4, req: { g: 4 }, icon: '🌅', art: 'The_Light_of_Tomorrow',
      text: 'Permanent : au début de votre tour, une carte de créature non unique de votre cimetière revient au hasard dans votre main.',
      effect: effect([], () => {}),
      lasting: { duration: 'permanent', recallEachTurn: true },
    }),
    spell({
      id: 'forceNature', name: 'La force de la nature', school: 'Terre', rarity: 'unique', cost: 4, req: { g: 4 }, icon: '🌳', art: 'The_Might_of_Nature',
      text: 'Permanent : les dégâts infligés à vos créatures de la ligne avant sont divisés par deux.',
      effect: effect([], () => {}),
      lasting: { duration: 'permanent', halvesFrontDamage: true },
    }),
    spell({
      id: 'mortSilencieuse', name: 'La mort silencieuse', school: 'Ténèbres', rarity: 'unique', cost: 4, req: { g: 4 }, icon: '🤫', art: 'The_Silent_Death', ongoing: true, killsAndReturns: true,
      text: 'Enchante une créature. Au début de votre tour, détruisez-la et reprenez ce sort en main.',
      effect: effect([creatureStep('Choisissez la créature condamnée.', 'any')], (g, pi, { choices }) => g.enchant(unitChoice(choices[0]), 'mortSilencieuse', pi, {})),
    }),
    spell({
      id: 'chantPerdus', name: 'Le chant des perdus', school: 'Air', rarity: 'unique', cost: 4, req: { g: 4 }, icon: '🎼', art: 'The_Song_of_the_Lost',
      text: 'Déplacez une créature ennemie ciblée ; recommencez autant de fois que vous le voulez.',
      effect: effect([], (g, pi) => g.startSong(pi)),
    }),
    spell({
      id: 'forceMer', name: 'La force de la mer', school: 'Eau', rarity: 'unique', cost: 4, req: { g: 4 }, icon: '🌊', art: 'The_Strength_of_the_Sea',
      text: 'Permanent : vos créatures gagnent +1 en attaque et Protection contre les fortunes.',
      effect: effect([], () => {}),
      lasting: {
        duration: 'permanent',
        attackBonus: (_g, unit, entry) => (unit.owner === entry.owner ? 1 : 0),
        keywords: (_g, unit, entry) => (unit.owner === entry.owner ? { fortuneWard: true } : {}),
      },
    }),
    spell({
      id: 'chainesMaudites', name: 'Chaînes maudites', school: 'Ténèbres', rarity: 'uncommon', cost: 3, req: { g: 3 }, icon: '⛓️', art: 'Cursed_chains', ongoing: true,
      text: 'Enchante une créature. Au début du tour de son propriétaire, son héros subit 1 dégât.',
      effect: effect([creatureStep('Choisissez la créature à enchaîner.', 'any')], (g, pi, { choices }) => g.enchant(unitChoice(choices[0]), 'chainesMaudites', pi, { keywords: { chains: 1 } })),
    }),
    spell({
      id: 'rageArdente', name: 'Rage ardente', school: 'Feu', rarity: 'uncommon', cost: 2, req: { g: 2 }, icon: '😡', art: 'Fiery_rage_card', ongoing: true,
      text: 'Enchante une créature. Permanent : elle gagne +1 en attaque et Berserk.',
      effect: effect([creatureStep('Choisissez la créature à enrager.', 'any')], (g, pi, { choices }) => g.enchant(unitChoice(choices[0]), 'rageArdente', pi, { atk: 1, keywords: { berserk: true } })),
    }),
    spell({
      id: 'eclatsGlace', name: 'Éclats de glace', school: 'Eau', rarity: 'uncommon', cost: 3, req: { g: 3 }, icon: '🧊', art: 'Ice_splinters',
      text: 'Enchante un couloir. Permanent : chaque créature déployée ou déplacée dans ce couloir subit 2 dégâts.',
      effect: effect([laneStep('Choisissez le couloir à enchanter.')], () => {}),
      lasting: { duration: 'permanent', lane: true, laneDamage: 2 },
    }),
    spell({
      id: 'resolution', name: 'Résolution', school: 'Lumière', rarity: 'uncommon', cost: 2, req: { g: 2 }, icon: '🛡️', art: 'Resolute_stand',
      text: 'Permanent : vos créatures gagnent +1 en riposte.',
      effect: effect([], () => {}),
      lasting: { duration: 'permanent', retaliationBonus: (_g, unit, entry) => (unit.owner === entry.owner ? 1 : 0) },
    }),
    spell({
      id: 'etreinteSylanna', name: 'Étreinte de Sylanna', school: 'Terre', rarity: 'uncommon', cost: 2, req: { g: 3 }, icon: '🌸', art: 'Sylanna_s_embrace', ongoing: true,
      text: 'Enchante une créature. Permanent : elle gagne Régénération 1 et +2 PV.',
      effect: effect([creatureStep('Choisissez la créature à enchanter.', 'any')], (g, pi, { choices }) => g.enchant(unitChoice(choices[0]), 'etreinteSylanna', pi, { hp: 2, keywords: { regen: 1 } })),
    }),
    spell({
      id: 'rafale', name: 'Rafale', school: 'Air', rarity: 'uncommon', cost: 2, req: { g: 3 }, icon: '💨', art: 'Wind_gust',
      text: 'Déplacez une créature ennemie ciblée, puis infligez 1 dégât à elle et aux créatures adjacentes.',
      effect: effect([RELOCATE_TARGET, RELOCATE_DESTINATION], (g, _pi, { choices: [moved, to] }) => {
        const uid = unitChoice(moved);
        if (to?.kind === 'cell') g.relocate(uid, to);
        const around = g.adjacentUnits(uid);
        g.damageUnit(uid, 1, AIR);
        around.forEach(u => g.damageUnit(u.uid, 1, AIR));
      }),
    }),
    spell({
      id: 'ancrage', name: 'Ancrage', school: 'Terre', rarity: 'common', cost: 1, req: { g: 1 }, icon: '⚓', art: 'Earth_bound', ongoing: true,
      text: 'Enchante une créature. Permanent : elle est ancrée (ne peut être ni déplacée ni échangée).',
      effect: effect([creatureStep('Choisissez la créature à ancrer.', 'any')], (g, pi, { choices }) => g.enchant(unitChoice(choices[0]), 'ancrage', pi, { keywords: { anchored: true } })),
    }),
    spell({
      id: 'vagueChaleur', name: 'Vague de chaleur', school: 'Feu', rarity: 'common', cost: 1, req: { g: 1 }, icon: '🌡️', art: 'Heat_wave',
      text: 'Inflige 1 dégât à chaque créature.',
      effect: effect([], g => [...g.units(0), ...g.units(1)].forEach(x => g.damageUnit(x.unit.uid, 1, FIRE))),
    }),
    spell({
      id: 'carapaceGlace', name: 'Carapace de glace', school: 'Eau', rarity: 'common', cost: 1, req: { g: 2 }, icon: '🧊', art: 'Ice_shell', ongoing: true,
      text: 'Enchante une créature alliée. Permanent : elle est ancrée ; les prochains dégâts qu\'elle subit sont annulés et la carapace se brise.',
      effect: effect([creatureStep('Choisissez la créature alliée à protéger.', 'ally')], (g, pi, { choices }) => g.enchant(unitChoice(choices[0]), 'carapaceGlace', pi, { keywords: { anchored: true, shell: true } })),
    }),
    spell({
      id: 'intimidation', name: 'Intimidation', school: 'Ténèbres', rarity: 'common', cost: 2, req: { g: 2 }, icon: '😠', art: 'Intimidation_card',
      text: 'Jusqu\'à votre prochain tour : les créatures sans créature alliée adjacente ne peuvent pas attaquer.',
      effect: effect([], () => {}),
      lasting: { duration: 'nextTurn', cannotAttack: (g, unit) => !g.adjacentUnits(unit.uid).length },
    }),
    spell({
      id: 'frappeFoudre', name: 'Frappe de la foudre', school: 'Air', rarity: 'common', cost: 3, req: { g: 2 }, icon: '⚡', art: 'Lightning_strike',
      text: 'Inflige 4 dégâts à une créature ciblée.',
      effect: effect([creatureStep('Choisissez la créature à foudroyer.', 'any')], (g, _pi, { choices }) => g.damageUnit(unitChoice(choices[0]), 4, AIR)),
    }),
    spell({
      id: 'celerite', name: 'Célérité', school: 'Lumière', rarity: 'common', cost: 2, req: { g: 2 }, icon: '💫', art: 'Lightspeed', ongoing: true,
      text: 'Enchante une créature alliée. Permanent : elle gagne Frappe préventive.',
      effect: effect([creatureStep('Choisissez la créature alliée à accélérer.', 'ally')], (g, pi, { choices }) => g.enchant(unitChoice(choices[0]), 'celerite', pi, { keywords: { preemptive: true } })),
    }),
    spell({
      id: 'rappelMineur', name: 'Rappel mineur', school: 'Primordiale', rarity: 'common', cost: 3, req: { g: 3 }, icon: '↩️', art: 'Minor_recall',
      text: 'Renvoyez un sort ou une fortune permanent ciblé dans la main de son propriétaire.',
      effect: effect([lastingStep('Choisissez la carte permanente à renvoyer.', ['spell', 'fortune'])], (g, _pi, { choices }) => {
        const pick = choices[0];
        if (pick?.kind === 'lasting') g.returnLastingToHand(pick.index);
      }),
    }),
  ]),
];

const CARDS: ReadonlyMap<string, Card> = new Map(CARD_LIST.map(c => [c.id, c]));

export function getCard(id: string): Card {
  const card = CARDS.get(id);
  if (!card) throw new Error(`Carte inconnue : ${id}`);
  return card;
}

export function getCreature(id: string): CreatureCard {
  const card = getCard(id);
  if (card.type !== 'creature') throw new Error(`${id} n'est pas une créature.`);
  return card;
}
