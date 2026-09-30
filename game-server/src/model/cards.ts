import type { Game } from './game';
import { other, type AttackType, type Keywords, type Choice, type PlayerIndex, type StatKey } from './types';

/** Contexte du calcul des options : la carte jouée ne peut pas se choisir elle-même dans la main. */
export interface StepContext {
  handIndex: number | null;
}

/** Un choix à faire en jouant la carte (cible, carte de la main, ligne, option…). */
export interface Step {
  /** Consigne affichée au joueur. */
  prompt: string;
  options(game: Game, pi: PlayerIndex, ctx: StepContext): Choice[];
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
}

export interface Effect {
  steps: readonly Step[];
  apply(game: Game, pi: PlayerIndex, input: EffectInput): void;
  /** Valeur ajoutée par l'IA à l'effet, quand elle ne se voit pas immédiatement sur le plateau. */
  aiBonus?(game: Game, pi: PlayerIndex): number;
}

interface CardBase {
  id: string;
  name: string;
  cost: number;
  req: Partial<Record<StatKey, number>>;
  icon: string;
  /** Nom de l'illustration dans img/art/ (sans extension). */
  art: string;
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
  keywords: Keywords;
}

export interface ActionCard extends CardBase {
  type: 'spell' | 'fortune';
  school?: string;
  /** Sort permanent : il reste attaché à la créature enchantée jusqu'à sa disparition. */
  ongoing?: boolean;
  effect: Effect;
}

export type Card = CreatureCard | ActionCard;

/** Source de dégâts : seuls les dégâts non magiques sont réduits par Intangible. */
export interface DamageSource {
  magic: boolean;
}
export const MAGIC: DamageSource = { magic: true };

// ------------------------------------------------------------------
//  Étapes de choix réutilisables
// ------------------------------------------------------------------
type Side = 'any' | 'ally' | 'enemy';

const unitsOn = (game: Game, pi: PlayerIndex, side: Side) =>
  side === 'ally' ? game.units(pi) : side === 'enemy' ? game.units(other(pi)) : [...game.units(pi), ...game.units(other(pi))];

export const creatureStep = (prompt: string, side: Side, filter: (game: Game, cardId: string) => boolean = () => true, distinctFrom?: number): Step => ({
  prompt, distinctFrom, emptyReason: 'Aucune cible valide.',
  options: (game, pi) => unitsOn(game, pi, side)
    .filter(x => filter(game, x.unit.cardId))
    .map((x): Choice => ({ kind: 'unit', uid: x.unit.uid })),
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
const creature = (c: Omit<CreatureCard, 'type' | 'keywords' | 'magic'> & { keywords?: Keywords; magic?: boolean }): CreatureCard =>
  ({ type: 'creature', keywords: {}, magic: false, ...c });
const spell = (c: Omit<ActionCard, 'type'>): ActionCard => ({ type: 'spell', ...c });
const fortune = (c: Omit<ActionCard, 'type'>): ActionCard => ({ type: 'fortune', ...c });
export const effect = (steps: readonly Step[], apply: Effect['apply'], opts: Pick<Effect, 'aiBonus'> = {}): Effect =>
  ({ steps, apply, ...opts });

const damageAll = (g: Game, pi: PlayerIndex, n: number) => g.units(pi).forEach(x => g.damageUnit(x.unit.uid, n, MAGIC));

const CARD_LIST: Card[] = [
  // ----------------------------- HAVRE -----------------------------
  creature({ id: 'ecuyerElite', name: 'Écuyer d\'élite', cost: 2, req: { m: 2 }, atk: 1, ret: 2, hp: 3, attackType: 'melee', icon: '🛡️', art: 'Elite_squire', keywords: { rangedGuard: 2 } }),
  creature({ id: 'arbaletrierImperial', name: 'Arbalétrier impérial', cost: 1, req: { m: 1 }, atk: 1, ret: 0, hp: 2, attackType: 'shooter', icon: '🏹', art: 'Imperial_crossbowman', keywords: { noret: true, stackable: true } }),
  creature({ id: 'sentinelleImperiale', name: 'Sentinelle impériale', cost: 1, req: { m: 1 }, atk: 1, ret: 1, hp: 2, attackType: 'melee', icon: '⚔️', art: 'Imperial_sentinel', keywords: { meleeGuard: 1, stackable: true } }),
  creature({ id: 'soeurDevouee', name: 'Sœur dévouée', cost: 2, req: { m: 1, g: 1 }, atk: 1, ret: 1, hp: 4, attackType: 'shooter', magic: true, icon: '🕊️', art: 'Devoted_sister', keywords: { noret: true, heal: 2 } }),
  creature({ id: 'griffonLoyal', name: 'Griffon loyal', cost: 2, req: { m: 2 }, atk: 2, ret: 1, hp: 4, attackType: 'flyer', icon: '🦅', art: 'Loyal_griffin' }),
  creature({ id: 'vestale', name: 'Vestale', cost: 4, req: { m: 3, g: 2 }, atk: 1, ret: 1, hp: 7, attackType: 'shooter', magic: true, icon: '📿', art: 'Vestal_card', keywords: { noret: true, heal: 3, mending: true } }),
  creature({ id: 'cavalierSolaire', name: 'Cavalier solaire', cost: 3, req: { m: 3 }, atk: 2, ret: 1, hp: 5, attackType: 'melee', icon: '🐎', art: 'Sun_rider_card', keywords: { noret: true, charge: true } }),
  creature({ id: 'seraphinGuerrier', name: 'Séraphin guerrier', cost: 4, req: { m: 4 }, atk: 3, ret: 2, hp: 6, attackType: 'flyer', icon: '👼', art: 'Warrior_seraph', keywords: { regen: 2, taunt: true } }),
  spell({
    id: 'soin', name: 'Soin', school: 'Lumière', cost: 1, req: { g: 1 }, icon: '💧', art: 'Heal_card',
    text: 'Soigne 3 blessures d\'une créature ciblée.',
    effect: effect([creatureStep('Choisissez la créature à soigner.', 'any')], (g, _pi, { choices }) => g.healUnit(unitChoice(choices[0]), 3)),
  }),
  spell({
    id: 'benediction', name: 'Bénédiction', school: 'Lumière', cost: 3, req: { g: 3 }, icon: '💪', art: 'Bless_card', ongoing: true,
    text: 'Enchante une créature alliée. Permanent : elle gagne +2 en attaque.',
    effect: effect([creatureStep('Choisissez la créature alliée à bénir.', 'ally')],
      (g, pi, { choices }) => g.enchant(unitChoice(choices[0]), 'benediction', pi, { atk: 2 })),
  }),
  spell({
    id: 'paroleLumiere', name: 'Parole de lumière', school: 'Lumière', cost: 4, req: { g: 4 }, icon: '⚡', art: 'Word_of_Light_card',
    text: 'Inflige 2 dégâts à toutes les créatures ennemies.',
    effect: effect([], (g, pi) => damageAll(g, other(pi), 2)),
  }),
  fortune({
    id: 'appelDevoir', name: 'Appel du devoir', cost: 3, req: { d: 3 }, icon: '📜', art: 'Call_to_Duty',
    text: 'Cherchez une carte de créature dans votre bibliothèque et ajoutez-la à votre main. Mélangez votre bibliothèque.',
    effect: effect(
      [zoneStep('Choisissez une créature de votre bibliothèque.', 'library', c => c.type === 'creature', 'Aucune créature dans votre bibliothèque.')],
      (g, pi, { choices }) => g.tutor(pi, cardChoice(choices[0])),
    ),
  }),
  fortune({
    id: 'avantPoste', name: 'Avant-poste fortifié', cost: 2, req: { d: 2 }, icon: '🧱', art: 'Fortified_outpost',
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

  // ---------------------------- NÉCROPOLE ----------------------------
  creature({ id: 'squeletteLancier', name: 'Squelette lancier', cost: 1, req: { m: 1 }, atk: 1, ret: 0, hp: 2, attackType: 'shooter', icon: '💀', art: 'Skeleton_spearman', keywords: { noret: true, stackable: true } }),
  creature({ id: 'squelettePestifere', name: 'Squelette pestiféré', cost: 2, req: { m: 2 }, atk: 1, ret: 0, hp: 3, attackType: 'shooter', icon: '🦴', art: 'Plague_skeleton', keywords: { noret: true, infect: 1, stackable: true } }),
  creature({ id: 'gouleMiserable', name: 'Goule misérable', cost: 1, req: { m: 1 }, atk: 2, ret: 1, hp: 2, attackType: 'melee', icon: '🧟', art: 'Wretched_ghoul' }),
  creature({ id: 'licheNeophyte', name: 'Liche néophyte', cost: 2, req: { m: 2, g: 1 }, atk: 2, ret: 0, hp: 4, attackType: 'shooter', magic: true, icon: '🧙', art: 'Neophyte_lich', keywords: { noret: true } }),
  creature({ id: 'fantomeErrant', name: 'Fantôme errant', cost: 2, req: { m: 2, g: 1 }, atk: 2, ret: 1, hp: 3, attackType: 'flyer', magic: true, icon: '👻', art: 'Lingering_ghost', keywords: { incorporeal: true } }),
  creature({ id: 'chevalierVampire', name: 'Chevalier vampire', cost: 3, req: { m: 3 }, atk: 2, ret: 0, hp: 5, attackType: 'flyer', icon: '🧛', art: 'Vampire_knight', keywords: { noret: true, lifeDrain: 2 } }),
  creature({ id: 'archiliche', name: 'Archiliche', cost: 4, req: { m: 4, g: 1 }, atk: 3, ret: 1, hp: 6, attackType: 'shooter', magic: true, icon: '☠️', art: 'Archlich_card', keywords: { noret: true, lifeDrain: 2 } }),
  creature({ id: 'dragonSpectral', name: 'Dragon spectral', cost: 7, req: { m: 6, g: 1 }, atk: 5, ret: 3, hp: 7, attackType: 'flyer', magic: true, icon: '🐉', art: 'Ghost_dragon_card', keywords: { noret: true, incorporeal: true, lifeDrain: 2 } }),
  spell({
    id: 'etreinteVampirique', name: 'Étreinte vampirique', school: 'Ténèbres', cost: 2, req: { g: 2 }, icon: '🩸', art: 'Vampiric_embrace_card', ongoing: true,
    text: 'Enchante une créature. Permanent : elle gagne Drain de vie 2.',
    effect: effect([creatureStep('Choisissez la créature à enchanter.', 'any')],
      (g, pi, { choices }) => g.enchant(unitChoice(choices[0]), 'etreinteVampirique', pi, { keywords: { lifeDrain: 2 } })),
  }),
  spell({
    id: 'faiblesse', name: 'Faiblesse', school: 'Ténèbres', cost: 2, req: { g: 2 }, icon: '🥀', art: 'Weakness_card', ongoing: true,
    text: 'Enchante une créature. Permanent : elle perd 2 en attaque et 2 en riposte.',
    effect: effect([creatureStep('Choisissez la créature à affaiblir.', 'any')],
      (g, pi, { choices }) => g.enchant(unitChoice(choices[0]), 'faiblesse', pi, { atk: -2, ret: -2 })),
  }),
  fortune({
    id: 'fosseCommune', name: 'Fosse commune', cost: 1, req: { d: 2 }, icon: '🪦', art: 'Mass_grave',
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
    id: 'ruinesShantiri', name: 'Ruines shantiri', cost: 1, req: { d: 1 }, icon: '📕', art: 'Shantiri_ruins',
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
    id: 'maledictionNeant', name: 'Malédiction du Néant', school: 'Ténèbres', cost: 6, req: { g: 6 }, icon: '🕯️', art: 'Curse_of_the_Netherworld_card',
    text: 'Inflige 3 dégâts à toutes les créatures ennemies. Soigne 3 blessures de toutes les créatures alliées.',
    effect: effect([], (g, pi) => {
      damageAll(g, other(pi), 3);
      g.units(pi).forEach(x => g.healUnit(x.unit.uid, 3));
    }),
  }),

  // ----------------------------- INFERNO -----------------------------
  creature({ id: 'diablotinChaos', name: 'Diablotin du chaos', cost: 4, req: { m: 1, d: 3 }, atk: 1, ret: 0, hp: 1, attackType: 'shooter', icon: '😈', art: 'Chaos_imp', keywords: { noret: true, imposeDiscard: true } }),
  creature({ id: 'cerbere', name: 'Cerbère', cost: 3, req: { m: 3 }, atk: 3, ret: 1, hp: 3, attackType: 'melee', icon: '🐕', art: 'Cerberus_card', keywords: { noret: true, sweep: true } }),
  creature({ id: 'tourmenteur', name: 'Tourmenteur', cost: 3, req: { m: 3, g: 1 }, atk: 2, ret: 2, hp: 5, attackType: 'melee', magic: true, icon: '⛓️', art: 'Tormentor_card', keywords: { areaBlast: 2 } }),
  creature({ id: 'succube', name: 'Succube', cost: 2, req: { m: 2, g: 1 }, atk: 2, ret: 0, hp: 4, attackType: 'shooter', magic: true, icon: '🦇', art: 'Succubus_card', keywords: { noret: true } }),
  creature({ id: 'lacerateur', name: 'Lacérateur', cost: 4, req: { m: 4, g: 1 }, atk: 3, ret: 2, hp: 6, attackType: 'melee', magic: true, icon: '👹', art: 'Lacerator_card', keywords: { areaBlast: 3 } }),
  creature({ id: 'sorciereChaos', name: 'Sorcière du chaos', cost: 5, req: { m: 4, g: 2 }, atk: 4, ret: 2, hp: 7, attackType: 'shooter', magic: true, icon: '🔥', art: 'Chaos_sorceress', keywords: { noret: true, areaBlast: 3 } }),
  creature({ id: 'seigneurFosses', name: 'Seigneur des fosses', cost: 6, req: { m: 5 }, atk: 4, ret: 3, hp: 7, attackType: 'flyer', icon: '🔱', art: 'Pit_lord_card', keywords: { attackAnywhere: true } }),
  creature({ id: 'seigneurAbyssal', name: 'Seigneur abyssal', cost: 7, req: { m: 6 }, atk: 5, ret: 4, hp: 9, attackType: 'melee', icon: '👿', art: 'Abyssal_lord_card', keywords: { attackAnywhere: true } }),
  spell({
    id: 'traitFeu', name: 'Trait de feu', school: 'Feu', cost: 1, req: { g: 1 }, icon: '☄️', art: 'Fire_bolt_card',
    text: 'Inflige 2 dégâts à une créature ciblée.',
    effect: effect([creatureStep('Choisissez la créature à frapper.', 'any')], (g, _pi, { choices }) => g.damageUnit(unitChoice(choices[0]), 2, MAGIC)),
  }),
  spell({
    id: 'bouleFeu', name: 'Boule de feu', school: 'Feu', cost: 4, req: { g: 4 }, icon: '💥', art: 'Fireball_card',
    text: 'Inflige 4 dégâts à une créature ciblée et à toutes les créatures adjacentes.',
    effect: effect([creatureStep('Choisissez le centre de l\'explosion.', 'any')], (g, _pi, { choices }) => {
      const uid = unitChoice(choices[0]);
      const around = g.adjacentUnits(uid);
      g.damageUnit(uid, 4, MAGIC);
      around.forEach(u => g.damageUnit(u.uid, 4, MAGIC));
    }),
  }),
  spell({
    id: 'tempeteFeu', name: 'Tempête de feu', school: 'Feu', cost: 5, req: { g: 5 }, icon: '🌋', art: 'Firestorm_card',
    text: 'Inflige 4 dégâts à toutes les créatures de la ligne ciblée.',
    effect: effect([lineStep('Choisissez la ligne à embraser.')], (g, _pi, { choices }) => {
      const line = choices[0];
      if (line?.kind !== 'line') throw new Error('Ce choix doit être une ligne.');
      g.units(line.player).filter(x => x.row === line.row).forEach(x => g.damageUnit(x.unit.uid, 4, MAGIC));
    }),
  }),
  spell({
    id: 'frenesie', name: 'Frénésie', school: 'Feu', cost: 3, req: { g: 3 }, icon: '💢', art: 'Frenzy_card',
    text: 'Choisissez une créature ciblée. Infligez à une autre créature ciblée des dégâts égaux à l\'attaque de la première.',
    effect: effect([
      creatureStep('Choisissez la créature dont l\'attaque sera utilisée.', 'any'),
      creatureStep('Choisissez une autre créature à frapper.', 'any', undefined, 0),
    ], (g, _pi, { choices }) => {
      const source = g.locate(unitChoice(choices[0]))?.unit;
      g.damageUnit(unitChoice(choices[1]), source?.atk ?? 0, MAGIC);
    }),
  }),
  fortune({
    id: 'autelDestruction', name: 'Autel de destruction', cost: 1, req: { d: 1 }, icon: '🗡️', art: 'Altar_of_Destruction_card',
    text: 'Placez une carte de votre main au-dessus de votre bibliothèque. Inflige 2 dégâts au héros ennemi.',
    effect: effect([handStep('Choisissez la carte à remettre sur votre bibliothèque.')], (g, pi, { taken }) => {
      g.putOnLibrary(pi, taken);
      g.damageHero(other(pi), 2);
    }),
  }),
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
