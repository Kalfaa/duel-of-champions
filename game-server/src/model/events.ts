import { creatureStep, effect, handStep, unitChoice, type Card, type DamageSource, type Effect } from './cards';
import type { Game } from './game';
import { other, type ExpansionId, type PlayerIndex, type Rarity } from './types';

interface EventBase {
  id: string;
  name: string;
  rarity: Rarity;
  /** Extension où l'événement est apparu. */
  expansion: ExpansionId;
  icon: string;
  /** Nom de l'illustration dans img/art/ (sans extension). */
  art: string;
  text: string;
}

/** Événement activable : chaque joueur peut l'utiliser une fois par tour en payant son coût. */
export interface ActiveEvent extends EventBase {
  kind: 'active';
  cost: number;
  effect: Effect;
}

/** Événement permanent : sa règle s'applique aux deux joueurs tant qu'il est en jeu. */
export interface OngoingEvent extends EventBase {
  kind: 'ongoing';
  /** Surcoût (en ressources) d'une carte jouée tant que l'événement est en jeu. */
  costModifier?(card: Card): number;
  /** Nombre maximal de cartes que chaque joueur peut jouer par tour. */
  maxCardsPerTurn?: number;
}

export type EventCard = ActiveEvent | OngoingEvent;

/** Dégâts d'un événement : ils ne sont pas magiques. */
const EVENT_DAMAGE: DamageSource = { magic: false };

const active = (e: Omit<ActiveEvent, 'kind'>): ActiveEvent => ({ kind: 'active', ...e });
const ongoing = (e: Omit<OngoingEvent, 'kind'>): OngoingEvent => ({ kind: 'ongoing', ...e });

/** L'IA n'utilise un bonus de déploiement que si elle peut encore déployer une créature après l'avoir payé. */
const deployBonusValue = (cost: number, value: number) => (g: Game, pi: PlayerIndex): number =>
  g.affordableCreatures(pi, g.player(pi).res - cost) > 0 ? value : -1;

const EVENT_LIST: EventCard[] = [
  active({
    id: 'celebration', name: 'Fête', rarity: 'common', expansion: 'base', icon: '🎉', art: 'Celebrations', cost: 2,
    text: 'Chaque joueur pioche une carte.',
    effect: effect([], (g, pi) => {
      g.draw(pi, 1);
      g.draw(other(pi), 1);
    }),
  }),
  active({
    id: 'dayOfFortune', name: 'Jour de fortune', rarity: 'common', expansion: 'base', icon: '🍀', art: 'Day_of_Fortune', cost: 3,
    text: 'Défaussez une carte, puis piochez une carte.',
    effect: effect([handStep('Choisissez la carte à défausser.')], (g, pi, { taken }) => {
      g.discard(pi, taken);
      g.draw(pi, 1);
    }),
  }),
  active({
    id: 'marketOfShadows', name: 'Marché des ombres', rarity: 'uncommon', expansion: 'base', icon: '🕯️', art: 'Market_of_Shadows', cost: 2,
    text: 'Infligez 1 dégât à votre héros. Piochez une carte.',
    effect: effect([], (g, pi) => {
      g.damageHero(pi, 1);
      g.draw(pi, 1);
    }),
  }),
  active({
    id: 'hailStorm', name: 'Tempête de grêle', rarity: 'common', expansion: 'heraldOfTheVoid', icon: '🌨️', art: 'Hail_Storm', cost: 4,
    text: 'Inflige 1 dégât à chaque créature.',
    effect: effect([], g => {
      for (const pi of [0, 1] as const) g.units(pi).forEach(x => g.damageUnit(x.unit.uid, 1, EVENT_DAMAGE));
    }),
  }),
  active({
    id: 'conscriptionDay', name: 'Jour de la conscription', rarity: 'uncommon', expansion: 'heraldOfTheVoid', icon: '📯', art: 'Conscription_Day', cost: 3,
    text: 'Les deux joueurs gagnent +1 en Puissance.',
    effect: effect([], (g, pi) => {
      g.increaseStat(pi, 'm', 1);
      g.increaseStat(other(pi), 'm', 1);
    }),
  }),
  active({
    id: 'weaponsmiths', name: 'Semaine des armuriers', rarity: 'common', expansion: 'base', icon: '⚒️', art: 'Week_of_the_Weaponsmiths', cost: 3,
    text: 'La prochaine créature que vous déployez ce tour-ci gagne +1 en attaque.',
    effect: effect([], (g, pi) => g.boostNextDeployment(pi, { atk: 1 }), { aiBonus: deployBonusValue(3, 1.5) }),
  }),
  active({
    id: 'emeraldSong', name: 'Mois du chant d\'émeraude', rarity: 'common', expansion: 'base', icon: '🎶', art: 'Month_of_the_Emerald_Song', cost: 3,
    text: 'La prochaine créature que vous déployez ce tour-ci gagne +2 PV.',
    effect: effect([], (g, pi) => g.boostNextDeployment(pi, { hp: 2 }), { aiBonus: deployBonusValue(3, 2) }),
  }),
  active({
    id: 'fallenWolf', name: 'Jour du loup déchu', rarity: 'common', expansion: 'voidRising', icon: '🐺', art: 'Day_of_the_Fallen_Wolf', cost: 3,
    text: 'La prochaine créature que vous déployez ce tour-ci gagne +2 en riposte.',
    effect: effect([], (g, pi) => g.boostNextDeployment(pi, { ret: 2 }), { aiBonus: deployBonusValue(3, 1.4) }),
  }),
  ongoing({
    id: 'manaStorm', name: 'Tempête de mana', rarity: 'uncommon', expansion: 'base', icon: '🌀', art: 'Mana_Storm',
    text: 'Permanent : les cartes de sort coûtent 1 ressource de plus.',
    costModifier: card => (card.type === 'spell' ? 1 : 0),
  }),
  ongoing({
    id: 'weekOfTaxes', name: 'Semaine des impôts', rarity: 'uncommon', expansion: 'base', icon: '💰', art: 'Week_of_Taxes',
    text: 'Permanent : les cartes de fortune coûtent 1 ressource de plus.',
    costModifier: card => (card.type === 'fortune' ? 1 : 0),
  }),
  ongoing({
    id: 'blindArbiters', name: 'Arbitres aveugles', rarity: 'rare', expansion: 'heraldOfTheVoid', icon: '🙈', art: 'Blind_Arbiters',
    text: 'Permanent : aucun joueur ne peut jouer plus de 3 cartes par tour.',
    maxCardsPerTurn: 3,
  }),
  active({
    id: 'cosmicBalance', name: 'Équilibre cosmique', rarity: 'rare', expansion: 'heraldOfTheVoid', icon: '☯️', art: 'Cosmic_Balance', cost: 4,
    text: 'Votre héros subit 3 dégâts : chaque joueur défausse des cartes au hasard jusqu\'à en garder 6 au plus.',
    effect: effect([], (g, pi) => {
      g.damageHero(pi, 3);
      g.discardRandomDownTo(pi, 6);
      g.discardRandomDownTo(other(pi), 6);
    }),
  }),
  active({
    id: 'dayOfSanctuary', name: 'Jour du Sanctuaire', rarity: 'uncommon', expansion: 'heraldOfTheVoid', icon: '⛩️', art: 'Day_of_the_Sanctuary', cost: 1,
    text: 'Jusqu\'à votre prochain tour, une créature ciblée ne peut pas être ciblée.',
    effect: effect([creatureStep('Choisissez la créature à protéger.', 'any')], (g, pi, { choices }) => g.shieldUntil(unitChoice(choices[0]), pi)),
  }),
];

const EVENTS: ReadonlyMap<string, EventCard> = new Map(EVENT_LIST.map(e => [e.id, e]));

export function getEvent(id: string): EventCard {
  const event = EVENTS.get(id);
  if (!event) throw new Error(`Événement inconnu : ${id}`);
  return event;
}
