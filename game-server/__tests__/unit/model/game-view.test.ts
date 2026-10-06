import { describe, expect, it } from 'vitest';
import { buildPlayerView } from '../../../src/model/game-view';
import { STARTING_HAND } from '../../../src/model/game';
import { DECKS } from '../../../src/model/decks';
import { newGame, place, readyToPlay, setEvents, state, unit } from './helpers';

describe('buildPlayerView', () => {
  it('montre sa propre main et cache celle de l\'adversaire', () => {
    const { game, a, b } = newGame();
    const view = buildPlayerView(game, a);
    expect(view.you).toBe(a);
    expect(view.players[a].hand).toHaveLength(STARTING_HAND + 1);
    expect(view.players[b].hand).toBeNull();
    expect(view.players[b].handCount).toBe(STARTING_HAND);
  });

  it('affiche le nom des deux joueurs', () => {
    const { game, a } = newGame();
    expect(buildPlayerView(game, a).players.map(p => p.name)).toEqual(['Joueur 0', 'Joueur 1']);
  });

  it('montre les cimetières des deux joueurs', () => {
    const { game, a, b } = newGame();
    state(game, b).grave = ['traitFeu', 'cerbere'];
    for (const pi of [a, b]) {
      expect(buildPlayerView(game, pi).players[b].grave.map(c => c.name)).toEqual(['Trait de feu', 'Cerbère']);
    }
  });

  it('indique la rareté, la faction et l\'extension des cartes', () => {
    const { game, a } = newGame();
    state(game, a).grave = ['traitFeu', 'autelDestruction'];
    const [spell, fortune] = buildPlayerView(game, a).players[a].grave;
    expect(spell).toMatchObject({ rarity: 'common', faction: null, school: 'Feu', expansion: { name: 'Édition de base' } });
    expect(fortune).toMatchObject({ rarity: 'common', faction: { id: 'inferno', label: 'Inferno', icon: '🔥' } });
  });

  it('montre l\'attaque et la riposte actuelles des créatures, estropiement et bonus compris', () => {
    const { game, a } = newGame();
    const captain = place(game, a, 'capitaineLoup', 0, 1);
    place(game, a, 'griffonLoyal', 0, 0);
    captain.cripple = 1;
    const view = buildPlayerView(game, a).players[a].board[0]![1]!;
    expect(view).toMatchObject({ atk: 1, ret: 0, cripple: 1 });
  });

  it('indique la rareté et l\'extension de chaque héros', () => {
    const { game, a, b } = newGame();
    for (const pi of [a, b]) {
      expect(buildPlayerView(game, a).players[pi].hero).toMatchObject({ rarity: 'heroic', expansion: { name: 'Édition de base' } });
    }
  });

  it('indique les écoles de magie de chaque héros', () => {
    const { game, a, b } = newGame();
    const view = buildPlayerView(game, a);
    for (const pi of [a, b]) {
      expect(view.players[pi].hero.schools).toEqual([...DECKS[state(game, pi).deckId].hero.schools]);
    }
  });

  it('ne donne des options qu\'au joueur actif', () => {
    const { game, a, b } = newGame();
    expect(buildPlayerView(game, a).options?.heroAction).toEqual({ available: true, reason: null, drawReason: null });
    expect(buildPlayerView(game, b).options).toBeNull();
  });

  it('liste les coups légaux : cartes et leurs choix, attaques et déplacements', () => {
    const { game, a, b } = newGame();
    const enemy = place(game, b, 'gouleMiserable', 0, 1);
    const ally = place(game, a, 'gouleMiserable', 0, 1);
    readyToPlay(game, a, ['soin', 'paroleLumiere', 'avantPoste'], 4);
    const options = buildPlayerView(game, a).options!;

    expect(options.canEndTurn).toBe(true);
    expect(options.hand[0]).toEqual({
      cost: 1, playable: true, reason: null,
      steps: [{ prompt: 'Choisissez la créature à soigner.', options: [unit(ally), unit(enemy)], labels: null, cards: null, distinctFrom: null, after: null }],
    });
    expect(options.hand[1]).toMatchObject({ playable: true, steps: [] });
    expect(options.hand[2]!.steps[0]).toMatchObject({ labels: ['Piocher une carte', 'Gagner 4 ressources'], options: [{ kind: 'mode', index: 0 }] });
    expect(options.units).toEqual([{
      uid: ally.uid, reason: null,
      attackTargets: [unit(enemy)],
      moveSlots: [{ row: 0, lane: 0 }, { row: 0, lane: 2 }],
    }]);
  });

  it('montre les cartes proposées par un choix dans la bibliothèque', () => {
    const { game, a } = newGame();
    readyToPlay(game, a, ['appelDevoir']);
    state(game, a).deck = ['griffonLoyal', 'soin'];
    const step = buildPlayerView(game, a).options!.hand[0]!.steps[0]!;
    expect(step.cards?.map(c => c.name)).toEqual(['Griffon loyal']);
  });

  it('montre les piles, le poison et les enchantements des créatures', () => {
    const { game, a } = newGame();
    const stack = place(game, a, 'arbaletrierImperial', 1, 0);
    stack.stack = 2;
    stack.poison = 1;
    stack.enchantments = [{ cardId: 'benediction', owner: a, atk: 2, ret: 0, keywords: {} }];
    expect(buildPlayerView(game, a).players[a].board[1]![0]).toMatchObject({ stack: 2, poison: 1, enchantments: ['Bénédiction'] });
  });

  it('signale l\'action du héros déjà utilisée et les créatures épuisées', () => {
    const { game, a, b } = newGame();
    const ally = place(game, a, 'arbaletrierImperial', 1, 0);
    game.develop(a, 'm');
    game.attack(a, ally.uid, { kind: 'hero', player: b });
    const view = buildPlayerView(game, a);
    expect(view.options!.heroAction).toMatchObject({ available: false, reason: 'Votre héros a déjà agi ce tour-ci.' });
    expect(view.options!.power.usable).toBe(false);
    expect(view.players[a].board[1]![0]!.exhausted).toBe(true);
  });

  it('montre à chaque joueur la carte jouée en attente, sans options pendant ce temps', () => {
    const { game, a, b } = newGame(['kalAzaar', 'siegfried']);
    const enemy = place(game, b, 'griffonLoyal', 0, 0);
    readyToPlay(game, a, ['traitFeu']);
    game.playCard(a, 0, [unit(enemy)]);
    for (const pi of [a, b]) {
      const view = buildPlayerView(game, pi);
      expect(view.pending).toMatchObject({ kind: 'card', player: a, card: { id: 'traitFeu', name: 'Trait de feu' }, choices: [unit(enemy)] });
      expect(view.options).toBeNull();
    }
  });

  it('montre le pouvoir du héros en attente de résolution', () => {
    const { game, a, b } = newGame(['kalAzaar', 'siegfried']);
    const enemy = place(game, b, 'griffonLoyal', 0, 0);
    readyToPlay(game, a, ['traitFeu']);
    game.usePower(a, [{ kind: 'hand', index: 0 }, unit(enemy)]);
    expect(buildPlayerView(game, b).pending).toEqual({
      kind: 'power', player: a, choices: [unit(enemy)],
      power: { name: 'Agonie', cost: 0, text: 'Défaussez une carte : infligez 2 dégâts à une créature ciblée.' },
    });
  });

  it('ne révèle pas les cartes choisies dans la main', () => {
    const { game, a, b } = newGame(['kalAzaar', 'siegfried']);
    readyToPlay(game, a, ['traitFeu', 'autelDestruction']);
    game.playCard(a, 1, [{ kind: 'hand', index: 0 }]);
    expect(buildPlayerView(game, b).pending?.choices).toEqual([]);
  });

  it('explique pourquoi une carte n\'est pas jouable', () => {
    const { game, a } = newGame();
    readyToPlay(game, a, ['cavalierSolaire'], 1);
    const option = buildPlayerView(game, a).options!.hand[0]!;
    expect(option.playable).toBe(false);
    expect(option.reason).toBe('Pas assez de ressources.');
    expect(option.steps).toEqual([]);
  });

  it('indique l\'extension d\'où vient chaque événement', () => {
    const { game, a } = newGame();
    setEvents(game, ['fallenWolf', 'hailStorm']);
    expect(buildPlayerView(game, a).events.map(e => e.expansion.name)).toEqual(['Ascension du vide', 'Herald of the Void']);
  });

  it('montre les événements en jeu, leur utilisation et l\'événement révélé', () => {
    const { game, a } = newGame();
    setEvents(game, ['celebration', 'manaStorm']);
    state(game, a).res = 5;
    let view = buildPlayerView(game, a);
    expect(view.events).toEqual([
      {
        id: 'celebration', name: 'Fête', rarity: 'common', expansion: { name: 'Édition de base', image: 'base' },
        icon: '🎉', art: 'Celebrations', text: 'Chaque joueur pioche une carte.', cost: 2, ongoing: false, used: false,
      },
      expect.objectContaining({ id: 'manaStorm', cost: null, ongoing: true }),
    ]);
    expect(view.eventDeckCount).toBe(14);
    expect(view.options!.events[0]).toEqual({ usable: true, reason: null, steps: [] });
    expect(view.options!.events[1]!.usable).toBe(false);

    game.useEvent(a, 0, []);
    view = buildPlayerView(game, a);
    expect(view.pending).toMatchObject({ kind: 'event', player: a, event: { id: 'celebration' } });
    game.resolvePending();
    expect(buildPlayerView(game, a).events[0]!.used).toBe(true);
  });
});
