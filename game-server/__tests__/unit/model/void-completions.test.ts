import { describe, expect, it } from 'vitest';
import { getCard } from '../../../src/model/cards';
import { newGame, place, playNow, readyToPlay, setEvents, slot, state, unit } from './helpers';

describe('Ascension et Héraut du vide — compléments', () => {
  it('Vol de sort s\'empare d\'un sort resté en jeu', () => {
    const { game, a, b } = newGame();
    const griffin = place(game, a, 'griffonLoyal', 0, 0);
    game.endTurn(a);
    readyToPlay(game, b, ['regenerationMasse']);
    playNow(game, b, 0, []);
    game.endTurn(b);
    expect(game.keywordsOf(griffin).regen).toBeUndefined();
    readyToPlay(game, a, ['volSort']);
    playNow(game, a, 0, [{ kind: 'lasting', index: 0 }, { kind: 'mode', index: 0 }]);
    expect(game.lasting[0]?.owner).toBe(a);
    expect(game.keywordsOf(griffin).regen).toBe(1);
  });

  it('Vol de sort déplace le dernier enchantement d\'une créature sur la créature choisie', () => {
    const { game, a, b } = newGame();
    const enemy = place(game, b, 'griffonLoyal', 0, 0);
    const ally = place(game, a, 'gouleMiserable', 0, 0);
    game.enchant(enemy.uid, 'benediction', b, { atk: 2 });
    readyToPlay(game, a, ['volSort']);
    playNow(game, a, 0, [unit(enemy), unit(ally)]);
    expect([game.attackOf(enemy), game.attackOf(ally)]).toEqual([2, 4]);
    expect(ally.enchantments[0]?.owner).toBe(a);
  });

  it('Unmei-kami : en blessant le héros ennemi, son joueur prend un sort adverse, qui y retourne s\'il n\'est pas joué', () => {
    const { game, a, b } = newGame();
    const kami = place(game, a, 'unmeiKami', 0, 0);
    readyToPlay(game, a, [], 5);
    state(game, b).hand = ['eclair', 'cerbere'];
    game.attack(a, kami.uid, { kind: 'hero', player: b });
    expect(game.pendingPick?.options).toEqual([{ kind: 'mode', index: 0 }, { kind: 'card', zone: 'revealed', cardId: 'eclair' }]);
    game.pick(a, { kind: 'card', zone: 'revealed', cardId: 'eclair' });
    expect(game.player(a).hand).toEqual(['eclair']);
    expect(game.cardCost(a, getCard('eclair'))).toBe(4);
    game.endTurn(a);
    expect(game.player(b).hand).toContain('eclair');
  });

  it('Chemin des ancêtres : les créatures qui arrivent ne peuvent pas être ciblées jusqu\'au prochain tour de leur propriétaire', () => {
    const { game, a, b } = newGame();
    setEvents(game, ['pathOfAncestors', 'celebration']);
    readyToPlay(game, a, ['griffonLoyal']);
    playNow(game, a, 0, [slot(0, 0)]);
    const griffin = game.player(a).board[0]![0]!;
    expect(game.isTargetable(griffin.uid)).toBe(false);
    game.endTurn(a);
    game.endTurn(b);
    expect(game.isTargetable(griffin.uid)).toBe(true);
  });

  it('Semaine d\'austérité : une créature coûtant 4 ou plus coûte 1 ressource de plus, ou 1 dégât au héros', () => {
    const { game, a } = newGame();
    setEvents(game, ['weekOfAusterity', 'celebration']);
    readyToPlay(game, a, ['seraphinGuerrier', 'seraphinGuerrier'], 9);
    playNow(game, a, 0, [slot(0, 0)]);
    expect(game.player(a).res).toBe(4);
    const hp = game.player(a).hp;
    state(game, a).res = 4;
    playNow(game, a, 0, [slot(0, 1)]);
    expect([game.player(a).res, game.player(a).hp]).toEqual([0, hp - 1]);
  });

  it('Semaines des esprits : les créatures magiques gagnent +1 en attaque, jusqu\'à la fin du tour ou au prochain tour', () => {
    const { game, a, b } = newGame();
    const magic = place(game, b, 'succube', 1, 0); // magique, 2 en attaque
    const plain = place(game, b, 'cerbere', 0, 0);
    setEvents(game, ['weekOfWildSpirits', 'weekOfTamedSpirits']);
    state(game, a).res = 6;
    game.useEvent(a, 0, []);
    game.resolvePending();
    game.useEvent(a, 1, []);
    game.resolvePending();
    expect([game.attackOf(magic), game.attackOf(plain)]).toEqual([4, 3]);
    game.endTurn(a);
    expect(game.attackOf(magic)).toBe(3);
    game.endTurn(b);
    expect(game.attackOf(magic)).toBe(2);
  });
});
