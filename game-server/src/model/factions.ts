import { costAtMost, creatureStep, effect, handStep, MAGIC, unitChoice, type Effect } from './cards';
import type { FactionId, StatKey } from './types';

export interface HeroPower {
  name: string;
  cost: number;
  text: string;
  effect: Effect;
}

export interface Hero extends Record<StatKey, number> {
  name: string;
  icon: string;
  art: string;
  /** Écoles de magie dont le héros utilise les sorts. */
  schools: readonly string[];
  power: HeroPower;
}

export interface Faction {
  id: FactionId;
  label: string;
  icon: string;
  description: string;
  hero: Hero;
  /** Nombre d'exemplaires de chaque carte dans le deck. */
  deck: Readonly<Record<string, number>>;
  /** Les 8 événements apportés à la partie (mélangés avec ceux de l'adversaire). */
  events: readonly string[];
}

const discardStep = handStep('Choisissez la carte à défausser.');

export const FACTIONS: Readonly<Record<FactionId, Faction>> = {
  havre: {
    id: 'havre', label: 'Havre', icon: '🦅', description: 'Soldats qui se protègent les uns les autres, soigneurs et cavaliers.',
    hero: {
      name: 'Siegfried, champion de la foi', icon: '🤴', art: 'Siegfried_Champion_of_Faith', m: 2, g: 0, d: 1, schools: ['Lumière'],
      power: {
        name: 'Ferveur', cost: 0, text: 'Les créatures de mêlée que vous déployez ce tour-ci gagnent +1 PV.',
        effect: effect([], (g, pi) => g.boostMeleeDeployments(pi, 1), {
          aiBonus: (g, pi) => 1.5 * g.player(pi).hand.filter(id => g.canAffordCreature(pi, id, 'melee')).length - 1,
        }),
      },
    },
    deck: { ecuyerElite: 3, arbaletrierImperial: 3, sentinelleImperiale: 3, soeurDevouee: 2, griffonLoyal: 3, vestale: 2, cavalierSolaire: 2, seraphinGuerrier: 2, soin: 2, benediction: 2, paroleLumiere: 2, appelDevoir: 2, avantPoste: 2 },
    events: ['celebration', 'dayOfFortune', 'conscriptionDay', 'weaponsmiths', 'emeraldSong', 'fallenWolf', 'hailStorm', 'weekOfTaxes'],
  },
  necropole: {
    id: 'necropole', label: 'Nécropole', icon: '💀', description: 'Morts-vivants qui empoisonnent, drainent la vie et se jouent des coups physiques.',
    hero: {
      name: 'Mère Namtaru, invocatrice de la mort', icon: '🧝‍♀️', art: 'Mother_Namtaru_Invoker_of_Death', m: 0, g: 2, d: 1, schools: ['Ténèbres'],
      power: {
        name: 'Faucheuse', cost: 0, text: 'Défaussez une carte : détruisez une créature ennemie ciblée coûtant 2 ressources ou moins.',
        effect: effect([discardStep, creatureStep('Choisissez la créature ennemie à détruire (coût 2 ou moins).', 'enemy', costAtMost(2))],
          (g, pi, { choices, taken }) => {
            g.discard(pi, taken);
            g.destroyUnit(unitChoice(choices[1]));
          }),
      },
    },
    deck: { squeletteLancier: 3, squelettePestifere: 3, gouleMiserable: 3, licheNeophyte: 2, fantomeErrant: 2, chevalierVampire: 3, archiliche: 2, dragonSpectral: 1, etreinteVampirique: 3, faiblesse: 2, fosseCommune: 2, ruinesShantiri: 2, maledictionNeant: 2 },
    events: ['celebration', 'dayOfFortune', 'marketOfShadows', 'emeraldSong', 'fallenWolf', 'hailStorm', 'manaStorm', 'weekOfTaxes'],
  },
  inferno: {
    id: 'inferno', label: 'Inferno', icon: '🔥', description: 'Démons qui frappent en zone et magie du feu dévastatrice.',
    hero: {
      name: 'Kal-Azaar, invocateur de l\'agonie', icon: '👺', art: 'Kal-Azaar_Invoker_of_Agony', m: 0, g: 2, d: 1, schools: ['Feu'],
      power: {
        name: 'Agonie', cost: 0, text: 'Défaussez une carte : infligez 2 dégâts à une créature ciblée.',
        effect: effect([discardStep, creatureStep('Choisissez la créature à frapper.', 'any')],
          (g, pi, { choices, taken }) => {
            g.discard(pi, taken);
            g.damageUnit(unitChoice(choices[1]), 2, MAGIC);
          }),
      },
    },
    deck: { diablotinChaos: 3, cerbere: 3, tourmenteur: 2, succube: 3, lacerateur: 3, sorciereChaos: 2, seigneurFosses: 2, seigneurAbyssal: 1, traitFeu: 3, bouleFeu: 2, tempeteFeu: 1, frenesie: 2, autelDestruction: 2 },
    events: ['celebration', 'dayOfFortune', 'marketOfShadows', 'conscriptionDay', 'weaponsmiths', 'fallenWolf', 'hailStorm', 'manaStorm'],
  },
};
