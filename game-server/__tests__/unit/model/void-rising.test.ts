import { describe, expect, it } from 'vitest';
import { newGame, place, playNow, readyToPlay, setEvents, slot, state, unit } from './helpers';

describe('Ascension du vide — capacités de combat', () => {
  it('Rétribution : la créature riposte même si elle meurt de l\'attaque', () => {
    const { game, a, b } = newGame();
    const attacker = place(game, a, 'gouleMiserable', 0, 0); // 2/1/2
    const praetorian = place(game, b, 'pretorienLoup', 0, 0); // 2/4/6
    praetorian.hpCur = 1;
    game.attack(a, attacker.uid, unit(praetorian));
    expect(game.locate(praetorian.uid)).toBeNull();
    expect(game.hasPendingRetaliation).toBe(true);
    game.resolveRetaliation();
    expect(game.locate(attacker.uid)).toBeNull();
  });

  it('Frappe préventive : la créature riposte avant de subir l\'attaque', () => {
    const { game, a, b } = newGame();
    const attacker = place(game, a, 'gouleMiserable', 0, 0); // 2/1/2
    const turtle = place(game, b, 'tortueMontagnes', 0, 0); // 1/3/5
    game.attack(a, attacker.uid, unit(turtle));
    expect(game.locate(attacker.uid)).toBeNull();
    expect(turtle.hpCur).toBe(5);
    expect(game.hasPendingRetaliation).toBe(false);
  });

  it('Frappe préventive n\'a pas d\'effet contre une créature immunisée contre la riposte', () => {
    const { game, a, b } = newGame();
    const archer = place(game, a, 'arbaletrierImperial', 1, 0); // 1/0/2, immunisé
    const turtle = place(game, b, 'tortueMontagnes', 0, 0);
    game.attack(a, archer.uid, unit(turtle));
    expect([archer.hpCur, turtle.hpCur]).toEqual([2, 4]);
  });

  it('Capitaine du Loup : +1 en attaque et en riposte par créature alliée adjacente', () => {
    const { game, a } = newGame();
    const captain = place(game, a, 'capitaineLoup', 0, 1); // 1/0/5
    place(game, a, 'griffonLoyal', 0, 0);
    place(game, a, 'griffonLoyal', 0, 2);
    expect([game.attackOf(captain), game.retaliationOf(captain)]).toEqual([3, 2]);
  });

  it('Justicier du Loup : les autres créatures alliées gagnent +2 en riposte', () => {
    const { game, a, b } = newGame();
    const justicar = place(game, a, 'justicierLoup', 1, 0); // 2/3/7
    const griffin = place(game, a, 'griffonLoyal', 0, 3); // 2/1/4
    const enemy = place(game, b, 'griffonLoyal', 0, 0);
    expect([game.retaliationOf(griffin), game.retaliationOf(justicar), game.retaliationOf(enemy)]).toEqual([3, 3, 1]);
  });

  it('Estropiement : les dégâts d\'attaque posent des marqueurs qui réduisent attaque et riposte', () => {
    const { game, a, b } = newGame();
    const skeleton = place(game, a, 'squeletteSoieLunaire', 0, 0); // 2/1/3, Estropiement 1
    const griffin = place(game, b, 'griffonLoyal', 0, 0); // 2/1/4
    game.attack(a, skeleton.uid, unit(griffin));
    expect(griffin.cripple).toBe(1);
    expect([game.attackOf(griffin), game.retaliationOf(griffin)]).toEqual([1, 0]);
    game.resolveRetaliation();
    expect(skeleton.hpCur).toBe(3);
  });

  it('Assassin vampire : détruit la créature à qui il inflige des dégâts de combat', () => {
    const { game, a, b } = newGame();
    const assassin = place(game, a, 'assassinVampire', 0, 0); // 1/2/4
    const lord = place(game, b, 'seigneurAbyssal', 0, 0); // 5/4/9
    game.attack(a, assassin.uid, unit(lord));
    expect(game.locate(lord.uid)).toBeNull();
    expect(game.hasPendingRetaliation).toBe(false);
  });

  it('Gobelin du Crâne noir : détruit dès qu\'il n\'a plus de créature alliée adjacente', () => {
    const { game, a } = newGame();
    const goblin = place(game, a, 'gobelinCraneNoir', 1, 1);
    const friend = place(game, a, 'griffonLoyal', 0, 1);
    readyToPlay(game, a, ['gobelinCraneNoir']);
    playNow(game, a, 0, [slot(1, 3)]);
    expect(game.player(a).board[1]![3]).toBeNull();
    game.destroyUnit(friend.uid);
    expect(game.locate(goblin.uid)).toBeNull();
  });

  it('Mastodonte : l\'excédent de dégâts sur la créature détruite touche le héros ennemi', () => {
    const { game, a, b } = newGame();
    const juggernaut = place(game, a, 'mastodonteFlammes', 0, 0); // 7/3/3
    const griffin = place(game, b, 'griffonLoyal', 0, 0); // 4 PV
    game.attack(a, juggernaut.uid, unit(griffin));
    expect(game.locate(griffin.uid)).toBeNull();
    expect(game.player(b).hp).toBe(game.player(b).maxHp - 3);
  });
});

describe('Ascension du vide — dégâts de feu et de ténèbres', () => {
  it('Explosion de feu : à sa mort, la créature blesse les créatures de son couloir, des deux côtés', () => {
    const { game, a, b } = newGame();
    const imp = place(game, a, 'diablotinFlammes', 0, 0);
    const behind = place(game, a, 'soeurDevouee', 1, 0);
    const facing = place(game, b, 'griffonLoyal', 0, 0);
    const otherLane = place(game, a, 'griffonLoyal', 0, 1);
    game.destroyUnit(imp.uid);
    expect([behind.hpCur, facing.hpCur, otherLane.hpCur]).toEqual([3, 3, 4]);
  });

  it('Soin par le feu : les dégâts d\'un sort de feu soignent la créature', () => {
    const { game, a } = newGame();
    const elemental = place(game, a, 'elementaireFeuSuperieur', 1, 0); // 5 PV
    elemental.hpCur = 2;
    readyToPlay(game, a, ['traitFeu']);
    playNow(game, a, 0, [unit(elemental)]);
    expect(elemental.hpCur).toBe(4);
  });

  it('Protection contre les ténèbres : ni ciblée ni blessée par les sorts de Ténèbres', () => {
    const { game, a, b } = newGame();
    const wyvern = place(game, b, 'shiNoShi', 0, 0);
    const griffin = place(game, b, 'griffonLoyal', 0, 1);
    readyToPlay(game, a, ['faiblesse', 'maledictionNeant']);
    expect(game.playSteps(a, 0)[0]!.options).toEqual([unit(griffin)]);
    playNow(game, a, 1, []);
    expect([wyvern.hpCur, griffin.hpCur]).toEqual([6, 1]);
  });
});

describe('Ascension du vide — effets à la mort et au ravitaillement', () => {
  it('Shi-no-shi : retourne dans la bibliothèque au lieu du cimetière', () => {
    const { game, b } = newGame();
    const wyvern = place(game, b, 'shiNoShi', 0, 0);
    const deckSize = game.player(b).deck.length;
    game.destroyUnit(wyvern.uid);
    expect(game.player(b).grave).not.toContain('shiNoShi');
    expect(game.player(b).deck).toHaveLength(deckSize + 1);
    expect(game.player(b).deck).toContain('shiNoShi');
  });

  it('Spectre du Néant : s\'il meurt pendant le tour adverse, blesse le héros ennemi', () => {
    const { game, a, b } = newGame();
    const enemyWraith = place(game, b, 'spectreNeant', 0, 0);
    const ownWraith = place(game, a, 'spectreNeant', 0, 0);
    game.destroyUnit(enemyWraith.uid);
    game.destroyUnit(ownWraith.uid);
    expect(game.player(a).hp).toBe(game.player(a).maxHp - 3);
    expect(game.player(b).hp).toBe(game.player(b).maxHp);
  });

  it('Scelleuse de destin : son propriétaire pioche quand elle ou une autre créature alliée meurt', () => {
    const { game, a } = newGame();
    const sealer = place(game, a, 'scelleuseDestin', 1, 0);
    const griffin = place(game, a, 'griffonLoyal', 0, 0);
    const hand = game.player(a).hand.length;
    game.destroyUnit(griffin.uid);
    game.destroyUnit(sealer.uid);
    expect(game.player(a).hand).toHaveLength(hand + 2);
  });

  it('au ravitaillement, l\'Invocatrice blesse le héros ennemi et le Frère aveugle fait piocher une carte de plus', () => {
    const { game, a, b } = newGame();
    place(game, a, 'invocatriceNeant', 1, 0);
    place(game, a, 'frereAveugle', 1, 1);
    game.endTurn(a);
    const hand = game.player(a).hand.length;
    game.endTurn(b);
    expect(game.player(b).hp).toBe(game.player(b).maxHp - 1);
    expect(game.player(a).hand).toHaveLength(hand + 2);
  });
});

describe('Ascension du vide — fortunes', () => {
  it('Autel de la Déesse araignée : sacrifie une créature et pioche la moitié de ses PV restants', () => {
    const { game, a } = newGame();
    const griffin = place(game, a, 'griffonLoyal', 0, 0);
    griffin.hpCur = 3;
    readyToPlay(game, a, ['autelDeesseAraignee']);
    playNow(game, a, 0, [unit(griffin)]);
    expect(game.locate(griffin.uid)).toBeNull();
    expect(game.player(a).hand).toHaveLength(2);
  });

  it('Antre d\'Ariana : défausse une créature et en reprend une du cimetière', () => {
    const { game, a } = newGame();
    readyToPlay(game, a, ['antreAriana', 'griffonLoyal']);
    state(game, a).grave = ['seigneurAbyssal'];
    playNow(game, a, 0, [{ kind: 'hand', index: 1 }, { kind: 'card', zone: 'grave', cardId: 'seigneurAbyssal' }]);
    expect(game.player(a).hand).toEqual(['seigneurAbyssal']);
    expect(game.player(a).grave).toEqual(['griffonLoyal', 'antreAriana']);
  });

  it('Pont des flammes infernales : défausse toute la main et pioche 3 cartes', () => {
    const { game, a } = newGame();
    readyToPlay(game, a, ['pontFlammes', 'soin', 'soin']);
    playNow(game, a, 0, []);
    expect(game.player(a).hand).toHaveLength(3);
    expect(game.player(a).grave).toEqual(['soin', 'soin', 'pontFlammes']);
  });

  it('Réalignement cosmique : chaque joueur défausse sa main et pioche 5 cartes', () => {
    const { game, a, b } = newGame();
    readyToPlay(game, a, ['realignementCosmique']);
    playNow(game, a, 0, []);
    expect([game.player(a).hand.length, game.player(b).hand.length]).toEqual([5, 5]);
  });

  it('Tour de l\'Oubli : chaque joueur garde 6 cartes au plus et son héros subit 1 dégât par carte défaussée', () => {
    const { game, a, b } = newGame();
    readyToPlay(game, a, ['tourOubli']);
    state(game, b).hand = Array<string>(8).fill('soin');
    playNow(game, a, 0, []);
    expect(game.player(b).hand).toHaveLength(6);
    expect(game.player(b).hp).toBe(game.player(b).maxHp - 2);
    expect(game.player(a).hp).toBe(game.player(a).maxHp);
  });

  it('Héritage : ne se joue que sans ressources, bannit une créature du cimetière et rapporte 3 ressources', () => {
    const { game, a } = newGame();
    readyToPlay(game, a, ['heritage'], 2);
    state(game, a).grave = ['griffonLoyal'];
    expect(game.whyNotPlay(a, 0)).toBe('Il ne doit plus vous rester de ressources.');
    state(game, a).res = 0;
    playNow(game, a, 0, [{ kind: 'card', zone: 'grave', cardId: 'griffonLoyal' }]);
    expect(game.player(a).grave).toEqual(['heritage']);
    expect(game.player(a).res).toBe(3);
  });

  it('Monastère d\'Hélexia : remélange tous les événements et en met 2 nouveaux en jeu', () => {
    const { game, a } = newGame();
    setEvents(game, ['manaStorm', 'weekOfTaxes']);
    readyToPlay(game, a, ['monastereHelexia']);
    const total = game.eventDeckCount + game.events.length;
    playNow(game, a, 0, []);
    expect(game.events).toHaveLength(2);
    expect(game.eventDeckCount + game.events.length).toBe(total);
  });

  it('Provisions volées : prend toutes les ressources de l\'adversaire', () => {
    const { game, a, b } = newGame();
    readyToPlay(game, a, ['provisionsVolees'], 1);
    state(game, b).res = 4;
    playNow(game, a, 0, []);
    expect([game.player(a).res, game.player(b).res]).toEqual([4, 0]);
  });

  it('Malédiction de négation : baisse la caractéristique adverse choisie', () => {
    const { game, a, b } = newGame();
    readyToPlay(game, a, ['maledictionNegation']);
    const magic = game.player(b).g;
    playNow(game, a, 0, [{ kind: 'mode', index: 1 }]);
    expect(game.player(b).g).toBe(Math.max(0, magic - 1));
  });

  it('Trône du renouveau : renvoie toutes les cartes du champ de bataille en main et vide les ressources', () => {
    const { game, a, b } = newGame();
    readyToPlay(game, a, ['troneRenouveau', 'benediction']);
    const griffin = place(game, a, 'griffonLoyal', 0, 0);
    playNow(game, a, 1, [unit(griffin)]);
    place(game, b, 'cerbere', 0, 0);
    state(game, b).hand = [];
    playNow(game, a, 0, []);
    expect(game.units(a)).toHaveLength(0);
    expect(game.units(b)).toHaveLength(0);
    expect(game.player(a).hand).toEqual(['griffonLoyal', 'benediction']);
    expect(game.player(b).hand).toEqual(['cerbere']);
    expect(game.player(a).res).toBe(0);
  });
});
