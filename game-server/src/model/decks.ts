import { GameRuleError } from './errors';
import { getHero } from './heroes';
import type { DeckId, FactionId } from './types';

/** Deck prédéfini : un héros, ses cartes et ses événements. */
export interface Deck {
  id: DeckId;
  /** Identifiant du héros (voir heroes.ts). */
  hero: string;
  description: string;
  /** Nombre d'exemplaires de chaque carte. */
  cards: Readonly<Record<string, number>>;
  /** Les 8 événements apportés à la partie (mélangés avec ceux de l'adversaire). */
  events: readonly string[];
}

/** Decks proposés aux joueurs et à l'IA : un par faction pour l'instant. Les autres restent définis mais ne sont pas jouables. */
export const PLAYABLE_DECKS: readonly DeckId[] = ['siegfried', 'namtaru', 'kalAzaar', 'kaiko', 'kat'];

export function assertPlayableDeck(id: DeckId): void {
  if (!PLAYABLE_DECKS.includes(id)) throw new GameRuleError('Ce deck n\'est pas disponible.');
}

/** Faction d'un deck prédéfini : celle de son héros. */
export const deckFaction = (id: DeckId): FactionId => getHero(DECKS[id].hero).faction;

export const DECKS: Readonly<Record<DeckId, Deck>> = {
  siegfried: {
    id: 'siegfried', hero: 'siegfried', description: 'Soldats qui se protègent les uns les autres, soigneurs et cavaliers.',
    cards: { ecuyerElite: 3, arbaletrierImperial: 3, sentinelleImperiale: 3, soeurDevouee: 2, griffonLoyal: 3, vestale: 2, cavalierSolaire: 2, seraphinGuerrier: 2, soin: 2, benediction: 2, paroleLumiere: 2, appelDevoir: 2, avantPoste: 2 },
    events: ['celebration', 'dayOfFortune', 'conscriptionDay', 'weaponsmiths', 'emeraldSong', 'fallenWolf', 'hailStorm', 'weekOfTaxes'],
  },
  namtaru: {
    id: 'namtaru', hero: 'namtaru', description: 'Morts-vivants qui empoisonnent, drainent la vie et se jouent des coups physiques.',
    cards: { squeletteLancier: 3, squelettePestifere: 3, gouleMiserable: 3, licheNeophyte: 2, fantomeErrant: 2, chevalierVampire: 3, archiliche: 2, dragonSpectral: 1, etreinteVampirique: 3, faiblesse: 2, fosseCommune: 2, ruinesShantiri: 2, maledictionNeant: 2 },
    events: ['celebration', 'dayOfFortune', 'marketOfShadows', 'emeraldSong', 'fallenWolf', 'hailStorm', 'manaStorm', 'weekOfTaxes'],
  },
  kalAzaar: {
    id: 'kalAzaar', hero: 'kalAzaar', description: 'Démons qui frappent en zone et magie du feu dévastatrice.',
    cards: { diablotinChaos: 3, cerbere: 3, tourmenteur: 2, succube: 3, lacerateur: 3, sorciereChaos: 2, seigneurFosses: 2, seigneurAbyssal: 1, traitFeu: 3, bouleFeu: 2, tempeteFeu: 1, frenesie: 2, autelDestruction: 2 },
    events: ['celebration', 'dayOfFortune', 'marketOfShadows', 'conscriptionDay', 'weaponsmiths', 'fallenWolf', 'hailStorm', 'manaStorm'],
  },
  ishuma: {
    id: 'ishuma', hero: 'ishuma', description: 'Esprits des glaces qui hypnotisent et gèlent l\'ennemi, que le dragon achève.',
    cards: { demoiselleNeiges: 3, yukiOnna: 2, gardeShanriya: 3, pretresseShanriya: 2, kirin: 3, kirinSacre: 1, espritSource: 3, gardeRequin: 2, labyrintheGele: 2, avalanche: 1, angeGardien: 2, murEau: 2, soin: 2, mousson: 1, gardeTenebres: 1 },
    events: ['celebration', 'dayOfFortune', 'marketOfShadows', 'emeraldSong', 'fallenWolf', 'hailStorm', 'manaStorm', 'weekOfTaxes'],
  },
  kaiko: {
    id: 'kaiko', hero: 'kaiko', description: 'Prêtresses nagas qui déplacent l\'ennemi en arrivant, et marées qui les ramènent en main.',
    cards: { pretresseCorail: 3, kappaShoya: 3, maitreMareesNaga: 2, pretressePerle: 2, nyoraiSairensa: 1, mizuKami: 2, espritSource: 3, renardBlanc: 2, ventPorteur: 2, flechesTempete: 2, tempeteSable: 1, rafale: 2, frappeFoudre: 1, tourbillon: 2, forteresseSousMarine: 2 },
    events: ['celebration', 'dayOfFortune', 'marketOfShadows', 'conscriptionDay', 'emeraldSong', 'hailStorm', 'manaStorm', 'weekOfTaxes'],
  },
  takana: {
    id: 'takana', hero: 'takana', description: 'Guerriers nagas qui renforcent leurs voisins par l\'Honneur.',
    cards: { kenshi: 2, kensei: 1, guerrierNaga: 3, wanizame: 3, gardeRequin: 3, kappa: 3, renardBlanc: 2, yetiMontagnes: 1, loupRedoutable: 2, terreHonoree: 2, salleDefis: 2, tourTemple: 2, tourbillon: 2, murEau: 2 },
    events: ['celebration', 'dayOfFortune', 'conscriptionDay', 'weaponsmiths', 'emeraldSong', 'fallenWolf', 'hailStorm', 'weekOfTaxes'],
  },
  yukiko: {
    id: 'yukiko', hero: 'yukiko', description: 'Espions et fortunes : sanctuaires, temples et ressources volées.',
    cards: { shinobiMaitreChanteur: 3, renardBlanc: 3, kappa: 3, gardeRequin: 3, tortueMontagnes: 2, frereAveugle: 1, vautourNoir: 2, sanctuaireYukiko: 1, templeCache: 2, pilierClairvoyance: 2, tourTemple: 2, forteresseSousMarine: 2, avalanche: 2, provisionsVolees: 2 },
    events: ['celebration', 'dayOfFortune', 'marketOfShadows', 'conscriptionDay', 'weaponsmiths', 'fallenWolf', 'manaStorm', 'weekOfTaxes'],
  },
  kat: {
    id: 'kat', hero: 'kat', description: 'Archers gobelins, cyclopes à double attaque et fortunes qui frappent vite.',
    cards: { eclaireurGobelin: 3, chasseurGobelin: 3, harpieRanaar: 3, archerCentaure: 2, guerrierPanthere: 2, maraudeurCentaure: 2, cyclopeBagarreur: 2, orcCorrompu: 2, grandFinalKat: 1, dernierCarre: 2, arene: 2, bassinSang: 2, hutteChaman: 2, autelSacrificiel: 2 },
    events: ['celebration', 'dayOfFortune', 'marketOfShadows', 'conscriptionDay', 'weaponsmiths', 'fallenWolf', 'hailStorm', 'weekOfTaxes'],
  },
  alia: {
    id: 'alia', hero: 'alia', description: 'Griffons et chevaliers qui ripostent sans faiblir, et une héroïne qui soigne toute son armée.',
    cards: { pretreBatailleGriffon: 1, gloireImmaculee: 2, angeMisericorde: 2, chevalierGriffon: 3, lancierGriffon: 3, elusElrath: 3, tireurGriffon: 3, gardeLoup: 3, resolution: 2, celerite: 2, postureOffensive: 1, forceNombre: 2, benedictionElrath: 1, tenteSoeurs: 2 },
    events: ['celebration', 'dayOfFortune', 'conscriptionDay', 'weaponsmiths', 'emeraldSong', 'blindArbiters', 'dayOfSanctuary', 'weekOfTaxes'],
  },
  adarMalik: {
    id: 'adarMalik', hero: 'adarMalik', description: 'Poisons du Bois sombre, arbres et liches, et un nécromant qui reprend les morts du tour.',
    cards: { canalisatriceNamtaru: 1, cauchemarVivant: 2, ermiteBoisSombre: 2, cracheurPourriture: 3, licheDevoreuse: 2, arbrePendu: 3, archerSquelette: 3, spectreIndompte: 3, chainesMaudites: 2, mortSilencieuse: 1, vagueChaleur: 2, dernierOrdreSeria: 1, tombePrecoce: 2, consumerServiteurs: 1, riteRestauration: 2 },
    events: ['celebration', 'dayOfFortune', 'marketOfShadows', 'emeraldSong', 'fallenWolf', 'hailStorm', 'cosmicBalance', 'weekOfTaxes'],
  },
  dhamiria: {
    id: 'dhamiria', hero: 'dhamiria', description: 'Démons berserks et défausses forcées : la folie vide la main de l\'adversaire.',
    cards: { voyantChaos: 1, arbitreNeant: 1, plieurDestin: 2, lacerateurChaos: 3, maniaqueFlammes: 2, rodeurTenebres: 3, gonfleurFlammes: 2, esclaveFlammes: 3, executeurUrKhrag: 2, rageArdente: 2, vagueChaleur: 2, flammeInterdite: 1, failleNeant: 1, jugementNeant: 1, chambreDemence: 2, sallesInertie: 2 },
    events: ['celebration', 'dayOfFortune', 'marketOfShadows', 'conscriptionDay', 'weaponsmiths', 'hailStorm', 'cosmicBalance', 'manaStorm'],
  },
  noboru: {
    id: 'noboru', hero: 'noboru', description: 'Nagas et esprits qui contrôlent le champ de bataille, guidés par un héros qui déplace l\'ennemi.',
    cards: { guerrierShinje: 1, kappaVenerable: 2, kabukiTei: 2, chanteuseRuisseau: 3, nagaYokujin: 3, okaneNoOkane: 2, gardiensCascade: 3, espritSource: 2, intimidation: 2, celerite: 2, transeCombat: 1, bassinDivination: 2, salleFortune: 2, rapportEspion: 2, tourbillon: 1 },
    events: ['celebration', 'dayOfFortune', 'marketOfShadows', 'emeraldSong', 'blindArbiters', 'dayOfSanctuary', 'manaStorm', 'weekOfTaxes'],
  },
  zardoc: {
    id: 'zardoc', hero: 'zardoc', description: 'Orcs du Crâne noir rapides et résistants, menés par un chef qui lance la charge.',
    cards: { cyclopeCraneNoir: 1, wyverneFrenetique: 2, broyeurCraneNoir: 2, dechiqueteurCraneNoir: 3, briseSortsCraneNoir: 2, centaureCraneNoir: 3, betePronces: 3, guerrierChaton: 3, oliphantGuerre: 3, ancrage: 2, resolution: 2, sangTribu: 1, debandade: 2, armurerieOrc: 1 },
    events: ['celebration', 'dayOfFortune', 'conscriptionDay', 'weaponsmiths', 'fallenWolf', 'hailStorm', 'blindArbiters', 'cosmicBalance'],
  },
};
