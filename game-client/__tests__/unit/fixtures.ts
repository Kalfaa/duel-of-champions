import type { CardView, Choice, EventView, GameView, HandOption, PlayerView, StepView, TurnOptions, UnitView } from '../../src/api/protocol';

export const card = (over: Partial<CardView> = {}): CardView => ({
  id: 'ecuyerElite', name: 'Écuyer d\'élite', type: 'creature', cost: 2, req: { m: 2 }, icon: '🛡️', art: 'Elite_squire',
  rarity: 'common', faction: { id: 'havre', label: 'Havre', icon: '🦅' }, expansion: { name: 'Édition de base', image: 'base' },
  text: null, school: null, attackType: 'melee', magic: false, atk: 1, ret: 2, hp: 3, keywords: {}, ...over,
});

export const unit = (uid: number, over: Partial<UnitView> = {}): UnitView => ({
  uid, card: card(), atk: 1, ret: 1, hpCur: 3, hpMax: 3, keywords: {}, stack: 1, poison: 0, cripple: 0, boost: 0, enrage: 0, enchantments: [], exhausted: false,
  cannotAttack: false, immobilized: false, ...over,
});

const emptyBoard = (): (UnitView | null)[][] => [[null, null, null, null], [null, null, null, null]];

export const player = (over: Partial<PlayerView> = {}): PlayerView => ({
  name: 'Halospart1', faction: 'havre', factionLabel: 'Havre', factionIcon: '🦅',
  hero: { name: 'Siegfried', icon: '🤴', art: 'Siegfried_Champion_of_Faith', rarity: 'heroic', expansion: { name: 'Édition de base', image: 'base' }, base: { m: 2, g: 0, d: 1 }, schools: ['Lumière'], power: { name: 'Ferveur', cost: 0, text: '+1 PV.' }, passive: null },
  hp: 20, maxHp: 20, m: 1, g: 1, d: 0, res: 3, maxRes: 3, deckCount: 20, handCount: 0, hand: [],
  grave: [], board: emptyBoard(), lasting: [], heroActionUsed: false, ...over,
});

export const mainOptions = (over: Partial<TurnOptions> = {}): TurnOptions => ({
  heroAction: { available: true, reason: null, drawReason: null }, hand: [],
  power: { usable: false, reason: 'Pas assez de ressources.', steps: [] },
  events: [], units: [], canEndTurn: true, ...over,
});

export const view = (over: Partial<GameView> = {}): GameView => ({
  gameId: 'g1', you: 0, current: 0, phase: 'action', turn: 3, winner: null, pending: null,
  players: [player(), player({ faction: 'inferno', factionLabel: 'Inferno', hand: null, handCount: 5 })],
  events: [], eventDeckCount: 14,
  log: [{ text: '— Tour de Siegfried —', tone: 'turn', player: null }],
  options: mainOptions(), pick: null, ...over,
});

export const step = (options: Choice[], over: Partial<StepView> = {}): StepView => ({
  prompt: 'Choisissez.', options, labels: null, cards: null, distinctFrom: null, after: null, ...over,
});

export const playable = (...steps: StepView[]): HandOption => ({ cost: 2, playable: true, reason: null, steps });

export const gameEvent = (over: Partial<EventView> = {}): EventView => ({
  id: 'celebration', name: 'Fête', rarity: 'common', expansion: { name: 'Édition de base', image: 'base' }, icon: '🎉', art: 'Celebrations',
  text: 'Chaque joueur pioche une carte.', cost: 2, ongoing: false, used: false, ...over,
});
