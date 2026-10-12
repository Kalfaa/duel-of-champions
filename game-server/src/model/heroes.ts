import {
  cardChoice, costAtMost, creatureStep, effect, handStep, MAGIC, RELOCATE_DESTINATION, RELOCATE_TARGET, slotForPrevious, unitChoice, zoneStep,
  type Effect, type Step,
} from './cards';
import { other, type Choice, type ExpansionId, type FactionId, type Rarity, type StatKey } from './types';

export interface HeroPower {
  name: string;
  cost: number;
  text: string;
  effect: Effect;
}

/** Capacité permanente d'un héros. */
export interface HeroPassive {
  name: string;
  text: string;
  /** Les créatures alliées avec Honneur gagnent +N en attaque. */
  honorAttack?: number;
}

export interface Hero extends Record<StatKey, number> {
  /** Identifiant stable : il est enregistré dans les decks des joueurs. */
  id: string;
  /** Faction de l'armée du héros : ses créatures et fortunes en sont, ou sont neutres. */
  faction: FactionId;
  name: string;
  icon: string;
  art: string;
  rarity: Rarity;
  expansion: ExpansionId;
  /** Points de vie de départ. */
  hp: number;
  /** Écoles de magie dont le héros utilise les sorts. */
  schools: readonly string[];
  /** Pouvoir activable, s'il en a un. */
  power: HeroPower | null;
  passive: HeroPassive | null;
}

const discardStep = handStep('Choisissez la carte à défausser.');

/** Une créature mise au cimetière depuis la fin du dernier tour du joueur (pouvoir d'Adar-Malik). */
const recentDeadStep: Step = {
  prompt: 'Choisissez la créature à reprendre en main.',
  emptyReason: 'Aucune créature n\'est allée au cimetière depuis la fin de votre dernier tour.',
  options: (game, pi) => {
    const p = game.player(pi);
    return [...new Set(p.recentDead)].filter(id => p.grave.includes(id)).sort().map((cardId): Choice => ({ kind: 'card', zone: 'grave', cardId }));
  },
};

const HERALD_HERO = { rarity: 'heroic', expansion: 'heraldOfTheVoid', hp: 20, m: 1, g: 1, d: 1, passive: null } as const;

/** Une créature ennemie immobilisée (Hypnotiser, Toucher gelé). */
const immobilizedEnemyStep: Step = {
  prompt: 'Choisissez la créature ennemie immobilisée à frapper.',
  emptyReason: 'Aucune créature ennemie immobilisée.',
  options: (game, pi) => game.units(other(pi))
    .filter(x => game.isImmobilized(x.unit) && game.isTargetable(x.unit.uid))
    .map((x): Choice => ({ kind: 'unit', uid: x.unit.uid })),
};

/** Tous les héros du jeu, dans l'ordre des extensions. */
const HERO_LIST: Hero[] = [
  {
    id: 'siegfried', faction: 'havre',
    name: 'Siegfried, champion de la foi', icon: '🤴', art: 'Siegfried_Champion_of_Faith', rarity: 'heroic', expansion: 'base',
    hp: 20, m: 2, g: 0, d: 1, schools: ['Lumière'], passive: null,
    power: {
      name: 'Ferveur', cost: 0, text: 'Les créatures de mêlée que vous déployez ce tour-ci gagnent +1 PV.',
      effect: effect([], (g, pi) => g.boostMeleeDeployments(pi, 1), {
        aiBonus: (g, pi) => 1.5 * g.player(pi).hand.filter(id => g.canAffordCreature(pi, id, 'melee')).length - 1,
      }),
    },
  },
  {
    id: 'namtaru', faction: 'necropole',
    name: 'Mère Namtaru, invocatrice de la mort', icon: '🧝‍♀️', art: 'Mother_Namtaru_Invoker_of_Death', rarity: 'heroic', expansion: 'base',
    hp: 18, m: 0, g: 2, d: 1, schools: ['Ténèbres'], passive: null,
    power: {
      name: 'Faucheuse', cost: 0, text: 'Défaussez une carte : détruisez une créature ennemie ciblée coûtant 2 ressources ou moins.',
      effect: effect([discardStep, creatureStep('Choisissez la créature ennemie à détruire (coût 2 ou moins).', 'enemy', costAtMost(2))],
        (g, pi, { choices, taken }) => {
          g.discard(pi, taken);
          g.destroyUnit(unitChoice(choices[1]));
        }),
    },
  },
  {
    id: 'kalAzaar', faction: 'inferno',
    name: 'Kal-Azaar, invocateur de l\'agonie', icon: '👺', art: 'Kal-Azaar_Invoker_of_Agony', rarity: 'heroic', expansion: 'base',
    hp: 18, m: 0, g: 2, d: 1, schools: ['Feu'], passive: null,
    power: {
      name: 'Agonie', cost: 0, text: 'Défaussez une carte : infligez 2 dégâts à une créature ciblée.',
      effect: effect([discardStep, creatureStep('Choisissez la créature à frapper.', 'any')],
        (g, pi, { choices, taken }) => {
          g.discard(pi, taken);
          g.damageUnit(unitChoice(choices[1]), 2, MAGIC);
        }),
    },
  },
  {
    id: 'ishuma', faction: 'sanctuaire',
    name: 'Ishuma, seigneur des dragons', icon: '🐉', art: 'Ishuma_Lord_of_Dragons', rarity: 'heroic', expansion: 'voidRising',
    hp: 20, m: 1, g: 1, d: 1, schools: ['Lumière', 'Eau'], passive: null,
    power: {
      name: 'Courroux du dragon', cost: 0, text: 'Infligez 2 dégâts à une créature ennemie immobilisée ciblée.',
      effect: effect([immobilizedEnemyStep], (g, _pi, { choices }) => g.damageUnit(unitChoice(choices[0]), 2, MAGIC)),
    },
  },
  {
    id: 'kaiko', faction: 'sanctuaire',
    name: 'Kaiko, invocatrice des profondeurs', icon: '🧜‍♀️', art: 'Kaiko_Invoker_of_the_Depths', rarity: 'heroic', expansion: 'voidRising',
    hp: 18, m: 0, g: 2, d: 1, schools: ['Lumière', 'Eau', 'Air'], passive: null,
    power: {
      name: 'Reflux', cost: 1, text: 'Défaussez une carte : renvoyez une créature alliée ciblée dans la main de son propriétaire.',
      effect: effect([discardStep, creatureStep('Choisissez la créature alliée à renvoyer dans votre main.', 'ally')],
        (g, pi, { choices, taken }) => {
          g.discard(pi, taken);
          g.returnToHand(unitChoice(choices[1]));
        }),
    },
  },
  {
    id: 'takana', faction: 'sanctuaire',
    name: 'Takana Osore, champion des marées', icon: '🔱', art: 'Takana_Osore_Champion_of_the_Tides', rarity: 'heroic', expansion: 'voidRising',
    hp: 20, m: 2, g: 0, d: 1, schools: ['Eau'], power: null,
    passive: { name: 'Voie de l\'honneur', text: 'Permanent : vos créatures avec Honneur gagnent +1 en attaque.', honorAttack: 1 },
  },
  {
    id: 'yukiko', faction: 'sanctuaire',
    name: 'Yukiko, en quête d\'honneur', icon: '🦊', art: 'Yukiko_Seeker_of_Honour', rarity: 'heroic', expansion: 'voidRising',
    hp: 20, m: 1, g: 1, d: 2, schools: ['Eau', 'Air'], power: null, passive: null,
  },
  {
    id: 'kat', faction: 'bastion',
    name: 'Kat, en quête de liberté', icon: '🏹', art: 'Kat_Seeker_of_Freedom', rarity: 'heroic', expansion: 'base',
    hp: 20, m: 1, g: 1, d: 2, schools: ['Terre', 'Air'], power: null, passive: null,
  },
  {
    id: 'alia', faction: 'havre',
    ...HERALD_HERO, name: 'Alia, appel de la foi', icon: '👼', art: 'Alia_Caller_of_Faith', schools: ['Lumière', 'Feu'],
    power: {
      name: 'Grâce d\'Elrath', cost: 6, text: 'Soignez toutes les blessures de vos créatures.',
      effect: effect([], (g, pi) => g.healAll(pi)),
    },
  },
  {
    id: 'adarMalik', faction: 'necropole',
    ...HERALD_HERO, name: 'Adar-Malik, appel du destin', icon: '🧛', art: 'Adar-Malik_Caller_of_Doom', schools: ['Ténèbres', 'Feu'],
    power: {
      name: 'Rappel des morts', cost: 6, text: 'Reprenez en main une créature mise dans votre cimetière depuis la fin de votre dernier tour.',
      effect: effect([recentDeadStep], (g, pi, { choices }) => {
        const pick = choices[0];
        if (pick?.kind === 'card') g.returnFromGrave(pi, pick.cardId);
      }),
    },
  },
  {
    id: 'dhamiria', faction: 'inferno',
    ...HERALD_HERO, name: 'Dhamiria, appel de la folie', icon: '😈', art: 'Dhamiria_Caller_of_Madness', schools: ['Terre', 'Feu'],
    power: {
      name: 'Folie', cost: 6, text: 'Regardez la main de l\'adversaire et choisissez-y un sort ou une fortune : il la défausse avec toutes ses homonymes.',
      effect: effect([], (g, pi) => g.pickFromOpponentHand(pi, ['spell', 'fortune'], true)),
    },
  },
  {
    id: 'noboru', faction: 'sanctuaire',
    ...HERALD_HERO, name: 'Noboru, appel du crépuscule', icon: '🌗', art: 'Noboru_Caller_of_Twilight', schools: ['Lumière', 'Ténèbres'],
    power: {
      name: 'Crépuscule', cost: 4, text: 'Déplacez une créature ennemie ciblée.',
      effect: effect([RELOCATE_TARGET, RELOCATE_DESTINATION], (g, _pi, { choices: [moved, to] }) => {
        if (to?.kind === 'cell') g.relocate(unitChoice(moved), to);
      }),
    },
  },
  {
    id: 'zardoc', faction: 'bastion',
    ...HERALD_HERO, name: 'Zardoc, appel de la bravoure', icon: '🪓', art: 'Zardoc_Caller_of_Valor', schools: ['Lumière', 'Terre'],
    power: {
      name: 'Charge héroïque', cost: 6, text: 'Une créature ciblée gagne Vivacité et Charge jusqu\'à la fin du tour.',
      effect: effect([creatureStep('Choisissez la créature à lancer à la charge.', 'any')],
        (g, _pi, { choices }) => g.grantUntilEndOfTurn(unitChoice(choices[0]), { swift: true, charge: true })),
    },
  },
  // ----------------------- Édition de base (suite) -----------------------
  {
    id: 'cassandra', faction: 'havre',
    name: 'Cassandra, en quête de lumière', icon: '👸', art: 'Cassandra_Seeker_of_Light', rarity: 'heroic', expansion: 'base',
    hp: 20, m: 1, g: 1, d: 2, schools: ['Lumière', 'Air'], power: null, passive: null,
  },
  {
    id: 'jezziel', faction: 'havre',
    name: 'Jezziel, invocateur de l\'espoir', icon: '😇', art: 'Jezziel_Invoker_of_Hope', rarity: 'heroic', expansion: 'base',
    hp: 18, m: 0, g: 2, d: 1, schools: ['Primordiale', 'Lumière', 'Air'], passive: null,
    power: {
      name: 'Espoir', cost: 0, text: 'Défaussez une carte : soignez 3 blessures d\'une créature ciblée.',
      effect: effect([discardStep, creatureStep('Choisissez la créature à soigner.', 'any')], (g, pi, { choices, taken }) => {
        g.discard(pi, taken);
        g.healUnit(unitChoice(choices[1]), 3);
      }),
    },
  },
  {
    id: 'sandalphon', faction: 'havre',
    name: 'Sandalphon, seigneur du pouvoir', icon: '⚜️', art: 'Sandalphon_Lord_of_Power', rarity: 'heroic', expansion: 'base',
    hp: 20, m: 1, g: 1, d: 1, schools: ['Eau', 'Air'], passive: null,
    power: {
      name: 'Pouvoir', cost: 0, text: 'Défaussez une carte : gagnez 2 ressources.',
      effect: effect([discardStep], (g, pi, { taken }) => {
        g.discard(pi, taken);
        g.gainResources(pi, 2);
      }),
    },
  },
  {
    id: 'fleshbane', faction: 'necropole',
    name: 'Fleshbane, champion des Difformes', icon: '🧛‍♂️', art: 'Fleshbane_Champion_of_the_Misshapen', rarity: 'heroic', expansion: 'base',
    hp: 20, m: 2, g: 0, d: 1, schools: ['Ténèbres'], passive: null,
    power: {
      name: 'Festin de sang', cost: 3, text: 'Déployez gratuitement une carte de créature vampire ciblée de votre cimetière exigeant 3 en Puissance ou moins.',
      effect: effect([
        zoneStep('Choisissez le vampire à déployer.', 'grave',
          c => c.type === 'creature' && c.tribe === 'vampire' && (c.req.m ?? 0) <= 3, 'Aucun vampire (Puissance 3 ou moins) dans votre cimetière.'),
        slotForPrevious('Choisissez où le déployer.'),
      ], (g, pi, { choices }) => {
        const slot = choices[1];
        if (slot?.kind === 'slot') g.deployFromGrave(pi, cardChoice(choices[0]), slot);
      }),
    },
  },
  {
    id: 'nergal', faction: 'necropole',
    name: 'Nergal, seigneur de la pestilence', icon: '🦠', art: 'Nergal_Lord_of_Pestilence', rarity: 'heroic', expansion: 'base',
    hp: 20, m: 1, g: 1, d: 1, schools: ['Primordiale', 'Terre'], passive: null,
    power: {
      name: 'Pestilence', cost: 1, text: 'Posez un marqueur de poison sur une créature ciblée.',
      effect: effect([creatureStep('Choisissez la créature à empoisonner.', 'any')], (g, _pi, { choices }) => {
        const unit = g.locate(unitChoice(choices[0]))?.unit;
        if (unit) g.addCounters(unit, 'poison', 1);
      }),
    },
  },
  {
    id: 'seria', faction: 'necropole',
    name: 'Seria, en quête des âmes perdues', icon: '🧝‍♀️', art: 'Seria_Seeker_of_the_Lost_Souls', rarity: 'heroic', expansion: 'base',
    hp: 20, m: 1, g: 1, d: 2, schools: ['Ténèbres', 'Eau'], power: null, passive: null,
  },
  {
    id: 'belias', faction: 'inferno',
    name: 'Belias, seigneur des chenils', icon: '🐺', art: 'Belias_Lord_of_the_Kennels', rarity: 'heroic', expansion: 'base',
    hp: 20, m: 1, g: 1, d: 1, schools: ['Primordiale', 'Ténèbres'], passive: null,
    power: {
      name: 'Morsure', cost: 0, text: 'Défaussez une carte : infligez 1 dégât au héros ennemi.',
      effect: effect([discardStep], (g, pi, { taken }) => {
        g.discard(pi, taken);
        g.damageHero(other(pi), 1);
      }),
    },
  },
  {
    id: 'garant', faction: 'inferno',
    name: 'Garant, en quête de discorde', icon: '😈', art: 'Garant_Seeker_of_Discord', rarity: 'heroic', expansion: 'base',
    hp: 20, m: 1, g: 1, d: 2, schools: ['Primordiale', 'Feu'], power: null, passive: null,
  },
  {
    id: 'xorm', faction: 'inferno',
    name: 'Xorm, champion de l\'Abîme', icon: '👿', art: 'Xorm_Champion_of_the_Abyss', rarity: 'heroic', expansion: 'base',
    hp: 20, m: 2, g: 0, d: 1, schools: ['Feu'], passive: null,
    power: {
      name: 'Assaut de l\'Abîme', cost: 2, text: 'Vos créatures de mêlée gagnent +1 en attaque jusqu\'à la fin du tour.',
      effect: effect([], (g, pi) => g.units(pi).filter(x => x.unit.attackType === 'melee').forEach(x => g.boostUntilEndOfTurn(x.unit.uid, 1))),
    },
  },
  {
    id: 'acamas', faction: 'bastion',
    name: 'Acamas, champion de la Corne sanglante', icon: '🐂', art: 'Acamas_Champion_of_the_Bloodhorn', rarity: 'heroic', expansion: 'base',
    hp: 20, m: 2, g: 0, d: 1, schools: ['Terre'], passive: null,
    power: {
      name: 'Corne sanglante', cost: 0, text: 'Vos créatures avec Rage furibonde subissent 1 dégât et gagnent +1 en attaque jusqu\'à la fin du tour.',
      effect: effect([], (g, pi) => g.units(pi).filter(x => g.keywordsOf(x.unit).enrage).forEach(x => {
        g.damageUnit(x.unit.uid, 1, { magic: false });
        g.boostUntilEndOfTurn(x.unit.uid, 1);
      })),
    },
  },
  {
    id: 'kelthor', faction: 'bastion',
    name: 'Kelthor, seigneur de la fureur', icon: '🪓', art: 'Kelthor_Lord_of_Fury', rarity: 'heroic', expansion: 'base',
    hp: 20, m: 1, g: 1, d: 1, schools: ['Air', 'Feu'], passive: null,
    power: {
      name: 'Fureur', cost: 0, text: 'Choisissez une créature alliée : infligez à une autre créature ciblée autant de dégâts qu\'elle a de marqueurs de rage.',
      effect: effect([
        {
          prompt: 'Choisissez la créature alliée enragée.', emptyReason: 'Aucune créature alliée avec des marqueurs de rage.',
          options: (g, pi) => g.units(pi).filter(x => x.unit.enrage > 0 && g.isTargetable(x.unit.uid)).map((x): Choice => ({ kind: 'unit', uid: x.unit.uid })),
        },
        creatureStep('Choisissez la créature à frapper.', 'any', undefined, 0),
      ], (g, _pi, { choices }) => {
        const rage = g.locate(unitChoice(choices[0]))?.unit.enrage ?? 0;
        if (rage) g.damageUnit(unitChoice(choices[1]), rage, { magic: false });
      }),
    },
  },
  {
    id: 'shaar', faction: 'bastion',
    name: 'Shaar, invocateur des cieux', icon: '🦅', art: 'Shaar_Invoker_of_the_Skies', rarity: 'heroic', expansion: 'base',
    hp: 18, m: 0, g: 2, d: 1, schools: ['Terre', 'Air', 'Feu'], passive: null,
    power: {
      name: 'Vents des cieux', cost: 0, text: 'Défaussez une carte : deux créatures alliées ciblées gagnent +1 en attaque jusqu\'à la fin du tour.',
      effect: effect([
        discardStep,
        creatureStep('Choisissez la première créature alliée.', 'ally'),
        creatureStep('Choisissez la seconde créature alliée.', 'ally', undefined, 1),
      ], (g, pi, { choices, taken }) => {
        g.discard(pi, taken);
        g.boostUntilEndOfTurn(unitChoice(choices[1]), 1);
        g.boostUntilEndOfTurn(unitChoice(choices[2]), 1);
      }),
    },
  },
];

const HEROES: ReadonlyMap<string, Hero> = new Map(HERO_LIST.map(h => [h.id, h]));

export const allHeroes = (): readonly Hero[] => HERO_LIST;

/** Le héros, ou undefined si l'identifiant est inconnu. */
export const findHero = (id: string): Hero | undefined => HEROES.get(id);

export function getHero(id: string): Hero {
  const hero = HEROES.get(id);
  if (!hero) throw new Error(`Héros inconnu : ${id}`);
  return hero;
}
