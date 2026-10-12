import { creatureStep, effect, getCard, handStep, unitChoice, type Card, type DamageSource, type Effect } from './cards';
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
  /** Les créatures qui arrivent en jeu ne peuvent pas être ciblées jusqu'au prochain tour de leur propriétaire. */
  protectsArrivals?: boolean;
  /** Déployer une créature coûtant 4 ou plus coûte 1 ressource de plus, ou 1 dégât au héros. */
  taxesBigCreatures?: boolean;
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
  // ----------------------- Édition de base (suite) -----------------------
  active({
    id: 'weekOfMercenaries', name: 'Semaine des mercenaires', rarity: 'rare', expansion: 'base', icon: '⚔️', art: 'Week_of_the_Mercenaries', cost: 3,
    text: 'Jusqu\'à la fin du tour, jouez avec la carte du dessus de votre bibliothèque révélée. Tant que c\'est une créature, vos créatures gagnent +1 en attaque ; sinon, les créatures ennemies gagnent +1 en riposte.',
    effect: effect([], (g, pi) => g.startMercenaryWeek(pi)),
  }),
  active({
    id: 'marketOfWonders', name: 'Marché des merveilles', rarity: 'rare', expansion: 'base', icon: '🎪', art: 'Market_of_Wonders', cost: 5,
    text: 'Regardez les trois cartes du dessus de votre bibliothèque. Prenez-en une en main et mettez les autres au cimetière.',
    effect: effect([], (g, pi) => g.pickFromTop(pi, 3, 'grave')),
  }),
  active({
    id: 'weekOfDead', name: 'Semaine des morts', rarity: 'common', expansion: 'base', icon: '💀', art: 'Week_of_the_Dead', cost: 1,
    text: 'Détruisez une créature alliée ciblée : gagnez autant de ressources que la moitié de son coût (arrondi inférieur).',
    effect: effect([creatureStep('Choisissez la créature alliée à détruire.', 'ally')], (g, pi, { choices }) => {
      const unit = g.locate(unitChoice(choices[0]))?.unit;
      if (!unit) return;
      const gain = Math.floor(getCard(unit.cardId).cost / 2);
      g.destroyUnit(unit.uid);
      if (gain) g.gainResources(pi, gain);
    }),
  }),
  active({
    id: 'weekOfKnowledge', name: 'Semaine du savoir', rarity: 'common', expansion: 'base', icon: '📖', art: 'Week_of_Knowledge', cost: 0,
    text: 'Piochez une carte. Vous ne pouvez plus jouer de carte ce tour-ci. Ne peut être utilisé que si vous n\'avez joué aucune carte ce tour-ci.',
    effect: effect([], (g, pi) => {
      g.draw(pi, 1);
      g.lockPlays(pi);
    }, { requirement: (g, pi) => (g.player(pi).cardsPlayedThisTurn ? 'Vous avez déjà joué une carte ce tour-ci.' : null) }),
  }),
  active({
    id: 'monthOfDancingFlames', name: 'Mois des flammes dansantes', rarity: 'common', expansion: 'base', icon: '💃', art: 'Month_of_the_Dancing_Flames', cost: 5,
    text: 'Jusqu\'à la fin du tour, toutes les créatures gagnent +1 en attaque et +1 en riposte.',
    effect: effect([], g => g.boostAllThisTurn(1)),
  }),
  // ----------------------- Ascension du vide (suite) -----------------------
  ongoing({
    id: 'pathOfAncestors', name: 'Chemin des ancêtres', rarity: 'rare', expansion: 'voidRising', icon: '🛤️', art: 'Path_of_the_Ancestors',
    text: 'Permanent : les créatures qui arrivent en jeu ne peuvent pas être ciblées jusqu\'au prochain tour de leur propriétaire.',
    protectsArrivals: true,
  }),
  ongoing({
    id: 'weekOfAusterity', name: 'Semaine d\'austérité', rarity: 'uncommon', expansion: 'voidRising', icon: '🪙', art: 'Week_of_Austerity',
    text: 'Permanent : déployer une créature coûtant 4 ressources ou plus coûte 1 ressource de plus ; si vous ne pouvez pas la payer, votre héros subit 1 dégât.',
    taxesBigCreatures: true,
  }),
  active({
    id: 'weekOfTamedSpirits', name: 'Semaine des esprits apprivoisés', rarity: 'uncommon', expansion: 'voidRising', icon: '🦊', art: 'Week_of_the_Tamed_Spirits', cost: 3,
    text: 'Jusqu\'à votre prochain tour, les créatures magiques gagnent +1 en attaque.',
    effect: effect([], (g, pi) => g.boostMagicCreatures(pi)),
  }),
  active({
    id: 'weekOfWildSpirits', name: 'Semaine des esprits sauvages', rarity: 'uncommon', expansion: 'voidRising', icon: '🐉', art: 'Week_of_the_Wild_Spirits', cost: 3,
    text: 'Jusqu\'à la fin du tour, les créatures magiques gagnent +1 en attaque.',
    effect: effect([], g => g.boostMagicCreatures(null)),
  }),
];

const EVENTS: ReadonlyMap<string, EventCard> = new Map(EVENT_LIST.map(e => [e.id, e]));

/** Tous les événements du jeu, dans l'ordre de la liste. */
export const allEvents = (): readonly EventCard[] => EVENT_LIST;

/** L'événement, ou undefined si l'identifiant est inconnu. */
export const findEvent = (id: string): EventCard | undefined => EVENTS.get(id);

export function getEvent(id: string): EventCard {
  const event = EVENTS.get(id);
  if (!event) throw new Error(`Événement inconnu : ${id}`);
  return event;
}
