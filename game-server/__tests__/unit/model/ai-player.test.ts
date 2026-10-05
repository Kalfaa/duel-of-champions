import { describe, expect, it } from 'vitest';
import { AiPlayer } from '../../../src/model/ai-player';
import { newGame, place, readyToPlay, setEvents, state, unit } from './helpers';

describe('AiPlayer', () => {
  const ai = new AiPlayer();

  it('commence par développer la caractéristique qui lui manque', () => {
    const { game, a } = newGame();
    const p = state(game, a);
    p.hand = ['paroleLumiere', 'soin'];
    p.m = 1; p.g = 0;
    expect(ai.chooseAction(game, a)).toEqual({ type: 'develop', choice: 'g' });
  });

  it('préfère le pouvoir héroïque quand il est rentable', () => {
    const { game, a, b } = newGame(['inferno', 'havre']);
    readyToPlay(game, a, ['traitFeu']);
    const wounded = place(game, b, 'griffonLoyal', 0, 0);
    wounded.hpCur = 2;
    expect(ai.chooseAction(game, a)).toEqual({ type: 'power', choices: [{ kind: 'hand', index: 0 }, unit(wounded)] });
  });

  it('déploie une créature de mêlée à l\'avant une fois son héros utilisé', () => {
    const { game, a } = newGame();
    readyToPlay(game, a, ['cavalierSolaire']);
    state(game, a).heroActionUsed = true;
    expect(ai.chooseAction(game, a)).toMatchObject({ type: 'play', handIndex: 0, choices: [{ kind: 'slot', row: 0 }] });
  });

  it('achève le héros adverse avec une carte quand il le peut', () => {
    const { game, a, b } = newGame(['inferno', 'havre']);
    place(game, b, 'griffonLoyal', 0, 0);
    readyToPlay(game, a, ['autelDestruction', 'traitFeu']);
    state(game, a).heroActionUsed = true;
    state(game, b).hp = 2;
    expect(ai.chooseAction(game, a)).toEqual({ type: 'play', handIndex: 0, choices: [{ kind: 'hand', index: 1 }] });
  });

  it('attaque en priorité une créature qu\'elle peut détruire', () => {
    const { game, a, b } = newGame();
    const shooter = place(game, a, 'arbaletrierImperial', 1, 0); // 1 attaque
    place(game, b, 'griffonLoyal', 0, 0); // 4 PV
    const weak = place(game, b, 'diablotinChaos', 1, 0); // 1 PV
    readyToPlay(game, a, [], 0);
    state(game, a).heroActionUsed = true;
    expect(ai.chooseAction(game, a)).toEqual({ type: 'attack', uid: shooter.uid, target: unit(weak) });
  });

  it('n\'attaque pas quand la riposte tuerait sa créature pour rien', () => {
    const { game, a, b } = newGame();
    place(game, a, 'gouleMiserable', 0, 0); // 2/1/2
    place(game, b, 'ecuyerElite', 0, 0); // riposte 2, 3 PV
    readyToPlay(game, a, [], 0);
    state(game, a).heroActionUsed = true;
    expect(ai.chooseAction(game, a)).toEqual({ type: 'endTurn' });
  });

  it.each([
    ['necropole', 'inferno'],
    ['havre', 'necropole'],
    ['inferno', 'havre'],
  ] as const)('joue une partie complète %s contre %s sans coup illégal', (f1, f2) => {
    const { game } = newGame([f1, f2], 123);
    for (let i = 0; i < 3000 && !game.isOver; i++) {
      game.apply(game.current, ai.chooseAction(game, game.current));
      if (game.pending) game.resolvePending();
      if (game.hasPendingRetaliation) game.resolveRetaliation();
    }
    expect(game.isOver).toBe(true);
    expect(game.winner).not.toBeNull();
  });

  it('utilise un événement quand il est rentable', () => {
    const { game, a, b } = newGame();
    setEvents(game, ['hailStorm', 'manaStorm']);
    readyToPlay(game, a, [], 4);
    state(game, a).heroActionUsed = true;
    place(game, b, 'diablotinChaos', 1, 0);
    place(game, b, 'diablotinChaos', 1, 1);
    expect(ai.chooseAction(game, a)).toEqual({ type: 'event', slot: 0, choices: [] });
  });
});
