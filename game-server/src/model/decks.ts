import { GameRuleError } from './errors';
import { costAtMost, creatureStep, effect, handStep, MAGIC, RELOCATE_DESTINATION, RELOCATE_TARGET, unitChoice, type Effect, type Step } from './cards';
import { other, type Choice, type DeckId, type ExpansionId, type FactionId, type Rarity, type StatKey } from './types';

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

export interface Deck {
  id: DeckId;
  faction: FactionId;
  description: string;
  hero: Hero;
  /** Nombre d'exemplaires de chaque carte. */
  cards: Readonly<Record<string, number>>;
  /** Les 8 événements apportés à la partie (mélangés avec ceux de l'adversaire). */
  events: readonly string[];
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

/** Decks proposés aux joueurs et à l'IA : un par faction pour l'instant. Les autres restent définis mais ne sont pas jouables. */
export const PLAYABLE_DECKS: readonly DeckId[] = ['siegfried', 'namtaru', 'kalAzaar', 'kaiko', 'kat'];

export function assertPlayableDeck(id: DeckId): void {
  if (!PLAYABLE_DECKS.includes(id)) throw new GameRuleError('Ce deck n\'est pas disponible.');
}

/** Une créature ennemie immobilisée (Hypnotiser, Toucher gelé). */
const immobilizedEnemyStep: Step = {
  prompt: 'Choisissez la créature ennemie immobilisée à frapper.',
  emptyReason: 'Aucune créature ennemie immobilisée.',
  options: (game, pi) => game.units(other(pi))
    .filter(x => game.isImmobilized(x.unit) && game.isTargetable(x.unit.uid))
    .map((x): Choice => ({ kind: 'unit', uid: x.unit.uid })),
};

export const DECKS: Readonly<Record<DeckId, Deck>> = {
  siegfried: {
    id: 'siegfried', faction: 'havre', description: 'Soldats qui se protègent les uns les autres, soigneurs et cavaliers.',
    hero: {
      name: 'Siegfried, champion de la foi', icon: '🤴', art: 'Siegfried_Champion_of_Faith', rarity: 'heroic', expansion: 'base',
      hp: 20, m: 2, g: 0, d: 1, schools: ['Lumière'], passive: null,
      power: {
        name: 'Ferveur', cost: 0, text: 'Les créatures de mêlée que vous déployez ce tour-ci gagnent +1 PV.',
        effect: effect([], (g, pi) => g.boostMeleeDeployments(pi, 1), {
          aiBonus: (g, pi) => 1.5 * g.player(pi).hand.filter(id => g.canAffordCreature(pi, id, 'melee')).length - 1,
        }),
      },
    },
    cards: { ecuyerElite: 3, arbaletrierImperial: 3, sentinelleImperiale: 3, soeurDevouee: 2, griffonLoyal: 3, vestale: 2, cavalierSolaire: 2, seraphinGuerrier: 2, soin: 2, benediction: 2, paroleLumiere: 2, appelDevoir: 2, avantPoste: 2 },
    events: ['celebration', 'dayOfFortune', 'conscriptionDay', 'weaponsmiths', 'emeraldSong', 'fallenWolf', 'hailStorm', 'weekOfTaxes'],
  },
  namtaru: {
    id: 'namtaru', faction: 'necropole', description: 'Morts-vivants qui empoisonnent, drainent la vie et se jouent des coups physiques.',
    hero: {
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
    cards: { squeletteLancier: 3, squelettePestifere: 3, gouleMiserable: 3, licheNeophyte: 2, fantomeErrant: 2, chevalierVampire: 3, archiliche: 2, dragonSpectral: 1, etreinteVampirique: 3, faiblesse: 2, fosseCommune: 2, ruinesShantiri: 2, maledictionNeant: 2 },
    events: ['celebration', 'dayOfFortune', 'marketOfShadows', 'emeraldSong', 'fallenWolf', 'hailStorm', 'manaStorm', 'weekOfTaxes'],
  },
  kalAzaar: {
    id: 'kalAzaar', faction: 'inferno', description: 'Démons qui frappent en zone et magie du feu dévastatrice.',
    hero: {
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
    cards: { diablotinChaos: 3, cerbere: 3, tourmenteur: 2, succube: 3, lacerateur: 3, sorciereChaos: 2, seigneurFosses: 2, seigneurAbyssal: 1, traitFeu: 3, bouleFeu: 2, tempeteFeu: 1, frenesie: 2, autelDestruction: 2 },
    events: ['celebration', 'dayOfFortune', 'marketOfShadows', 'conscriptionDay', 'weaponsmiths', 'fallenWolf', 'hailStorm', 'manaStorm'],
  },
  ishuma: {
    id: 'ishuma', faction: 'sanctuaire', description: 'Esprits des glaces qui hypnotisent et gèlent l\'ennemi, que le dragon achève.',
    hero: {
      name: 'Ishuma, seigneur des dragons', icon: '🐉', art: 'Ishuma_Lord_of_Dragons', rarity: 'heroic', expansion: 'voidRising',
      hp: 20, m: 1, g: 1, d: 1, schools: ['Lumière', 'Eau'], passive: null,
      power: {
        name: 'Courroux du dragon', cost: 0, text: 'Infligez 2 dégâts à une créature ennemie immobilisée ciblée.',
        effect: effect([immobilizedEnemyStep], (g, _pi, { choices }) => g.damageUnit(unitChoice(choices[0]), 2, MAGIC)),
      },
    },
    cards: { demoiselleNeiges: 3, yukiOnna: 2, gardeShanriya: 3, pretresseShanriya: 2, kirin: 3, kirinSacre: 1, espritSource: 3, gardeRequin: 2, labyrintheGele: 2, avalanche: 1, angeGardien: 2, murEau: 2, soin: 2, mousson: 1, gardeTenebres: 1 },
    events: ['celebration', 'dayOfFortune', 'marketOfShadows', 'emeraldSong', 'fallenWolf', 'hailStorm', 'manaStorm', 'weekOfTaxes'],
  },
  kaiko: {
    id: 'kaiko', faction: 'sanctuaire', description: 'Prêtresses nagas qui déplacent l\'ennemi en arrivant, et marées qui les ramènent en main.',
    hero: {
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
    cards: { pretresseCorail: 3, kappaShoya: 3, maitreMareesNaga: 2, pretressePerle: 2, nyoraiSairensa: 1, mizuKami: 2, espritSource: 3, renardBlanc: 2, ventPorteur: 2, flechesTempete: 2, tempeteSable: 1, negationMagie: 2, dissipationMasse: 1, tourbillon: 2, forteresseSousMarine: 2 },
    events: ['celebration', 'dayOfFortune', 'marketOfShadows', 'conscriptionDay', 'emeraldSong', 'hailStorm', 'manaStorm', 'weekOfTaxes'],
  },
  takana: {
    id: 'takana', faction: 'sanctuaire', description: 'Guerriers nagas qui renforcent leurs voisins par l\'Honneur.',
    hero: {
      name: 'Takana Osore, champion des marées', icon: '🔱', art: 'Takana_Osore_Champion_of_the_Tides', rarity: 'heroic', expansion: 'voidRising',
      hp: 20, m: 2, g: 0, d: 1, schools: ['Eau'], power: null,
      passive: { name: 'Voie de l\'honneur', text: 'Permanent : vos créatures avec Honneur gagnent +1 en attaque.', honorAttack: 1 },
    },
    cards: { kenshi: 2, kensei: 1, guerrierNaga: 3, wanizame: 3, gardeRequin: 3, kappa: 3, renardBlanc: 2, yetiMontagnes: 1, loupRedoutable: 2, terreHonoree: 2, salleDefis: 2, tourTemple: 2, tourbillon: 2, murEau: 2 },
    events: ['celebration', 'dayOfFortune', 'conscriptionDay', 'weaponsmiths', 'emeraldSong', 'fallenWolf', 'hailStorm', 'weekOfTaxes'],
  },
  yukiko: {
    id: 'yukiko', faction: 'sanctuaire', description: 'Espions et fortunes : sanctuaires, temples et ressources volées.',
    hero: {
      name: 'Yukiko, en quête d\'honneur', icon: '🦊', art: 'Yukiko_Seeker_of_Honour', rarity: 'heroic', expansion: 'voidRising',
      hp: 20, m: 1, g: 1, d: 2, schools: ['Eau', 'Air'], power: null, passive: null,
    },
    cards: { shinobiMaitreChanteur: 3, renardBlanc: 3, kappa: 3, gardeRequin: 3, tortueMontagnes: 2, frereAveugle: 1, vautourNoir: 2, sanctuaireYukiko: 1, templeCache: 2, pilierClairvoyance: 2, tourTemple: 2, forteresseSousMarine: 2, avalanche: 2, provisionsVolees: 2 },
    events: ['celebration', 'dayOfFortune', 'marketOfShadows', 'conscriptionDay', 'weaponsmiths', 'fallenWolf', 'manaStorm', 'weekOfTaxes'],
  },
  kat: {
    id: 'kat', faction: 'bastion', description: 'Archers gobelins, cyclopes à double attaque et fortunes qui frappent vite.',
    hero: {
      name: 'Kat, en quête de liberté', icon: '🏹', art: 'Kat_Seeker_of_Freedom', rarity: 'heroic', expansion: 'base',
      hp: 20, m: 1, g: 1, d: 2, schools: ['Terre', 'Air'], power: null, passive: null,
    },
    cards: { eclaireurGobelin: 3, chasseurGobelin: 3, harpieRanaar: 3, archerCentaure: 2, guerrierPanthere: 2, maraudeurCentaure: 2, cyclopeBagarreur: 2, orcCorrompu: 2, grandFinalKat: 1, dernierCarre: 2, arene: 2, bassinSang: 2, hutteChaman: 2, autelSacrificiel: 2 },
    events: ['celebration', 'dayOfFortune', 'marketOfShadows', 'conscriptionDay', 'weaponsmiths', 'fallenWolf', 'hailStorm', 'weekOfTaxes'],
  },
  alia: {
    id: 'alia', faction: 'havre', description: 'Griffons et chevaliers qui ripostent sans faiblir, et une héroïne qui soigne toute son armée.',
    hero: {
      ...HERALD_HERO, name: 'Alia, appel de la foi', icon: '👼', art: 'Alia_Caller_of_Faith', schools: ['Lumière', 'Feu'],
      power: {
        name: 'Grâce d\'Elrath', cost: 6, text: 'Soignez toutes les blessures de vos créatures.',
        effect: effect([], (g, pi) => g.healAll(pi)),
      },
    },
    cards: { pretreBatailleGriffon: 1, gloireImmaculee: 2, angeMisericorde: 2, chevalierGriffon: 3, lancierGriffon: 3, elusElrath: 3, tireurGriffon: 3, gardeLoup: 3, resolution: 2, celerite: 2, postureOffensive: 1, forceNombre: 2, benedictionElrath: 1, tenteSoeurs: 2 },
    events: ['celebration', 'dayOfFortune', 'conscriptionDay', 'weaponsmiths', 'emeraldSong', 'blindArbiters', 'dayOfSanctuary', 'weekOfTaxes'],
  },
  adarMalik: {
    id: 'adarMalik', faction: 'necropole', description: 'Poisons du Bois sombre, arbres et liches, et un nécromant qui reprend les morts du tour.',
    hero: {
      ...HERALD_HERO, name: 'Adar-Malik, appel du destin', icon: '🧛', art: 'Adar-Malik_Caller_of_Doom', schools: ['Ténèbres', 'Feu'],
      power: {
        name: 'Rappel des morts', cost: 6, text: 'Reprenez en main une créature mise dans votre cimetière depuis la fin de votre dernier tour.',
        effect: effect([recentDeadStep], (g, pi, { choices }) => {
          const pick = choices[0];
          if (pick?.kind === 'card') g.returnFromGrave(pi, pick.cardId);
        }),
      },
    },
    cards: { canalisatriceNamtaru: 1, cauchemarVivant: 2, ermiteBoisSombre: 2, cracheurPourriture: 3, licheDevoreuse: 2, arbrePendu: 3, archerSquelette: 3, spectreIndompte: 3, chainesMaudites: 2, mortSilencieuse: 1, vagueChaleur: 2, dernierOrdreSeria: 1, tombePrecoce: 2, consumerServiteurs: 1, riteRestauration: 2 },
    events: ['celebration', 'dayOfFortune', 'marketOfShadows', 'emeraldSong', 'fallenWolf', 'hailStorm', 'cosmicBalance', 'weekOfTaxes'],
  },
  dhamiria: {
    id: 'dhamiria', faction: 'inferno', description: 'Démons berserks et défausses forcées : la folie vide la main de l\'adversaire.',
    hero: {
      ...HERALD_HERO, name: 'Dhamiria, appel de la folie', icon: '😈', art: 'Dhamiria_Caller_of_Madness', schools: ['Terre', 'Feu'],
      power: {
        name: 'Folie', cost: 6, text: 'Regardez la main de l\'adversaire et choisissez-y un sort ou une fortune : il la défausse avec toutes ses homonymes.',
        effect: effect([], (g, pi) => g.pickFromOpponentHand(pi, ['spell', 'fortune'], true)),
      },
    },
    cards: { voyantChaos: 1, arbitreNeant: 1, plieurDestin: 2, lacerateurChaos: 3, maniaqueFlammes: 2, rodeurTenebres: 3, gonfleurFlammes: 2, esclaveFlammes: 3, executeurUrKhrag: 2, rageArdente: 2, vagueChaleur: 2, flammeInterdite: 1, failleNeant: 1, jugementNeant: 1, chambreDemence: 2, sallesInertie: 2 },
    events: ['celebration', 'dayOfFortune', 'marketOfShadows', 'conscriptionDay', 'weaponsmiths', 'hailStorm', 'cosmicBalance', 'manaStorm'],
  },
  noboru: {
    id: 'noboru', faction: 'sanctuaire', description: 'Nagas et esprits qui contrôlent le champ de bataille, guidés par un héros qui déplace l\'ennemi.',
    hero: {
      ...HERALD_HERO, name: 'Noboru, appel du crépuscule', icon: '🌗', art: 'Noboru_Caller_of_Twilight', schools: ['Lumière', 'Ténèbres'],
      power: {
        name: 'Crépuscule', cost: 4, text: 'Déplacez une créature ennemie ciblée.',
        effect: effect([RELOCATE_TARGET, RELOCATE_DESTINATION], (g, _pi, { choices: [moved, to] }) => {
          if (to?.kind === 'cell') g.relocate(unitChoice(moved), to);
        }),
      },
    },
    cards: { guerrierShinje: 1, kappaVenerable: 2, kabukiTei: 2, chanteuseRuisseau: 3, nagaYokujin: 3, okaneNoOkane: 2, gardiensCascade: 3, espritSource: 2, intimidation: 2, celerite: 2, transeCombat: 1, bassinDivination: 2, salleFortune: 2, rapportEspion: 2, tourbillon: 1 },
    events: ['celebration', 'dayOfFortune', 'marketOfShadows', 'emeraldSong', 'blindArbiters', 'dayOfSanctuary', 'manaStorm', 'weekOfTaxes'],
  },
  zardoc: {
    id: 'zardoc', faction: 'bastion', description: 'Orcs du Crâne noir rapides et résistants, menés par un chef qui lance la charge.',
    hero: {
      ...HERALD_HERO, name: 'Zardoc, appel de la bravoure', icon: '🪓', art: 'Zardoc_Caller_of_Valor', schools: ['Lumière', 'Terre'],
      power: {
        name: 'Charge héroïque', cost: 6, text: 'Une créature ciblée gagne Vivacité et Charge jusqu\'à la fin du tour.',
        effect: effect([creatureStep('Choisissez la créature à lancer à la charge.', 'any')],
          (g, _pi, { choices }) => g.grantUntilEndOfTurn(unitChoice(choices[0]), { swift: true, charge: true })),
      },
    },
    cards: { cyclopeCraneNoir: 1, wyverneFrenetique: 2, broyeurCraneNoir: 2, dechiqueteurCraneNoir: 3, briseSortsCraneNoir: 2, centaureCraneNoir: 3, betePronces: 3, guerrierChaton: 3, oliphantGuerre: 3, ancrage: 2, resolution: 2, sangTribu: 1, debandade: 2, armurerieOrc: 1 },
    events: ['celebration', 'dayOfFortune', 'conscriptionDay', 'weaponsmiths', 'fallenWolf', 'hailStorm', 'blindArbiters', 'cosmicBalance'],
  },
};
