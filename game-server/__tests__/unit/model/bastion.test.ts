import { describe, expect, it } from 'vitest';
import { getCard } from '../../../src/model/cards';
import { newGame, place, playNow, readyToPlay, state, unit } from './helpers';

describe('Bastion — mécaniques', () => {
  it('Rage : la créature gagne des marqueurs quand une créature alliée meurt, et les perd après avoir attaqué', () => {
    const { game, a, b } = newGame();
    const raging = place(game, a, 'gouleMiserable', 0, 0); // 2/1/2
    raging.keywords = { enrage: 2 };
    const friend = place(game, a, 'griffonLoyal', 0, 1);
    game.destroyUnit(friend.uid);
    expect([raging.enrage, game.attackOf(raging), game.retaliationOf(raging)]).toEqual([2, 4, 3]);
    game.attack(a, raging.uid, { kind: 'hero', player: b });
    expect(game.player(b).hp).toBe(game.player(b).maxHp - 4);
    expect(raging.enrage).toBe(0);
  });

  it('Appel de la Corne sanglante : la rage est gardée après l\'attaque, et la carte disparaît à la mort d\'une créature enragée', () => {
    const { game, a, b } = newGame();
    const raging = place(game, a, 'gouleMiserable', 0, 0);
    raging.keywords = { enrage: 1 };
    raging.enrage = 3;
    readyToPlay(game, a, ['appelCorneSanglante']);
    playNow(game, a, 0, []);
    game.attack(a, raging.uid, { kind: 'hero', player: b });
    expect(raging.enrage).toBe(3);
    game.destroyUnit(raging.uid);
    expect(game.lasting).toEqual([]);
    expect(game.player(a).grave).toContain('appelCorneSanglante');
  });

  it('Chantre de guerre : en fin de tour, vos créatures avec Rage reçoivent un marqueur', () => {
    const { game, a } = newGame();
    place(game, a, 'chantreGuerre', 0, 0);
    const raging = place(game, a, 'gouleMiserable', 0, 1);
    raging.keywords = { enrage: 1 };
    const calm = place(game, a, 'gouleMiserable', 0, 2);
    game.endTurn(a);
    expect([raging.enrage, calm.enrage]).toEqual([1, 0]);
  });

  it('Résistance à la magie : les dégâts des sorts et des créatures magiques sont divisés par deux', () => {
    const { game, a, b } = newGame();
    const resistant = place(game, b, 'griffonLoyal', 0, 0); // 4 PV
    resistant.keywords = { magicResist: true };
    readyToPlay(game, a, ['traitFeu']);
    playNow(game, a, 0, [unit(resistant)]);
    expect(resistant.hpCur).toBe(3);
    const ghoul = place(game, a, 'gouleMiserable', 0, 0); // dégâts non magiques
    game.attack(a, ghoul.uid, unit(resistant));
    expect(resistant.hpCur).toBe(1);
  });

  it('Double attaque : la créature attaque une seconde fois après la riposte, puis une autre cible si la première est morte', () => {
    const { game, a, b } = newGame();
    const ghoul = place(game, a, 'gouleMiserable', 0, 0); // 2/1/2
    ghoul.keywords = { doubleAttack: true };
    const griffin = place(game, b, 'griffonLoyal', 0, 0); // 2/1/4
    game.attack(a, ghoul.uid, unit(griffin));
    expect(griffin.hpCur).toBe(2);
    game.resolveRetaliation();
    expect(game.locate(griffin.uid)).toBeNull();
    expect(ghoul.hpCur).toBe(1);
    expect(game.hasPendingRetaliation).toBe(false);
  });

  it('Double attaque : frappe deux fois le héros', () => {
    const { game, a, b } = newGame();
    const ghoul = place(game, a, 'gouleMiserable', 0, 0);
    ghoul.keywords = { doubleAttack: true };
    game.attack(a, ghoul.uid, { kind: 'hero', player: b });
    expect(game.player(b).hp).toBe(game.player(b).maxHp - 4);
  });

  it('Attaque rapide : la créature agit le tour de son déploiement, sauf sous Étreinte de la terre', () => {
    const { game, a, b } = newGame();
    const quick = place(game, a, 'gouleMiserable', 0, 0);
    quick.keywords = { quickAttack: true };
    Object.assign(quick, { deployedTurn: game.turn });
    expect(game.attackTargets(a, quick.uid)).toEqual([{ kind: 'hero', player: b }]);
    readyToPlay(game, a, ['etreinteTerre']);
    playNow(game, a, 0, []);
    expect(game.whyNotAttack(a, quick.uid)).toBe('Une créature ne peut pas agir le tour de son déploiement.');
  });

  it('Armure : retire N aux dégâts de combat, pas aux dégâts des sorts', () => {
    const { game, a, b } = newGame();
    const armored = place(game, b, 'griffonLoyal', 0, 0); // 4 PV
    armored.keywords = { armor: 1 };
    const ghoul = place(game, a, 'gouleMiserable', 0, 0); // 2 en attaque
    game.attack(a, ghoul.uid, unit(armored));
    expect(armored.hpCur).toBe(3);
    game.resolveRetaliation();
    readyToPlay(game, a, ['traitFeu']);
    playNow(game, a, 0, [unit(armored)]);
    expect(armored.hpCur).toBe(1);
  });
});

describe('Bastion — cartes d\'Ascension du vide', () => {
  it('Seigneur de guerre du Crâne noir : attaque et riposte égales à la Puissance de son propriétaire', () => {
    const { game, a } = newGame();
    const warlord = place(game, a, 'seigneurCraneNoir', 0, 0);
    state(game, a).m = 4;
    expect([game.attackOf(warlord), game.retaliationOf(warlord)]).toEqual([4, 4]);
  });

  it('Chevaucheur de vautour : coûte 1 de moins par créature mise au cimetière ce tour-ci', () => {
    const { game, a, b } = newGame();
    const rider = getCard('chevaucheurVautour');
    expect(game.cardCost(a, rider)).toBe(5);
    game.destroyUnit(place(game, b, 'griffonLoyal', 0, 0).uid);
    game.destroyUnit(place(game, a, 'griffonLoyal', 0, 0).uid);
    expect(game.cardCost(a, rider)).toBe(3);
    game.endTurn(a);
    expect(game.cardCost(b, rider)).toBe(5);
  });

  it('Attaque surprise : inflige à une créature ennemie l\'attaque d\'une créature alliée', () => {
    const { game, a, b } = newGame();
    const lord = place(game, a, 'seigneurAbyssal', 0, 0); // 5 en attaque
    const enemy = place(game, b, 'seigneurAbyssal', 0, 0); // 9 PV
    readyToPlay(game, a, ['attaqueSurprise']);
    playNow(game, a, 0, [unit(lord), unit(enemy)]);
    expect(enemy.hpCur).toBe(4);
  });

  it('Rituel des plumes de sang : retire les marqueurs et soigne d\'autant', () => {
    const { game, a } = newGame();
    const griffin = place(game, a, 'griffonLoyal', 0, 0);
    griffin.hpCur = 1;
    griffin.poison = 1;
    griffin.cripple = 1;
    readyToPlay(game, a, ['ritePlumesSang']);
    playNow(game, a, 0, [unit(griffin)]);
    expect([griffin.poison, griffin.cripple, griffin.hpCur]).toEqual([0, 0, 3]);
  });
});

describe('Bastion — cartes du Base set 1', () => {
  it('Appeleur de sang : sacrifie deux créatures alliées et prend leurs PV restants en attaque et riposte', () => {
    const { game, a } = newGame();
    const first = place(game, a, 'griffonLoyal', 0, 0); // 4 PV
    const second = place(game, a, 'gouleMiserable', 0, 1);
    second.hpCur = 1;
    readyToPlay(game, a, ['appeleurSang']);
    playNow(game, a, 0, [{ kind: 'slot', row: 0, lane: 3 }, unit(first), unit(second)]);
    const caller = game.player(a).board[0]![3]!;
    expect([game.attackOf(caller), game.retaliationOf(caller)]).toEqual([5, 5]);
    expect([game.locate(first.uid), game.locate(second.uid)]).toEqual([null, null]);
  });

  it('Appeleur de sang : il faut deux autres créatures alliées', () => {
    const { game, a } = newGame();
    place(game, a, 'griffonLoyal', 0, 0);
    readyToPlay(game, a, ['appeleurSang']);
    expect(game.whyNotPlay(a, 0)).toBe('Il faut deux autres créatures alliées à sacrifier.');
  });

  it('Grand final de Kat : déploie gratuitement une créature de la main, qui attaque aussitôt et meurt en fin de tour', () => {
    const { game, a, b } = newGame(['kat', 'kalAzaar']);
    readyToPlay(game, a, ['grandFinalKat', 'orcCorrompu'], 5);
    playNow(game, a, 0, [{ kind: 'hand', index: 1 }, { kind: 'slot', row: 0, lane: 0 }]);
    const orc = game.player(a).board[0]![0]!;
    expect(game.player(a).res).toBe(0);
    expect(game.attackTargets(a, orc.uid)).toEqual([{ kind: 'hero', player: b }]);
    game.endTurn(a);
    expect(game.locate(orc.uid)).toBeNull();
  });

  it('Le dernier carré : vos créatures gagnent Ubiquité jusqu\'à la fin du tour', () => {
    const { game, a, b } = newGame();
    const ghoul = place(game, a, 'gouleMiserable', 0, 0);
    const far = place(game, b, 'griffonLoyal', 0, 3);
    readyToPlay(game, a, ['dernierCarre']);
    playNow(game, a, 0, []);
    expect(game.attackTargets(a, ghoul.uid)).toContainEqual(unit(far));
  });

  it('Camp orc : chaque créature reçoit autant de marqueurs de rage que sa valeur de Rage', () => {
    const { game, a } = newGame();
    const rider = place(game, a, 'chevaucheurWyverne', 0, 0); // Rage 2
    const orc = place(game, a, 'orcCorrompu', 0, 1);
    readyToPlay(game, a, ['campOrc']);
    playNow(game, a, 0, []);
    expect([rider.enrage, orc.enrage]).toEqual([2, 0]);
  });

  it('Arène : 3 dégâts au héros ennemi seulement si le vôtre a moins de PV', () => {
    const { game, a, b } = newGame(['siegfried', 'siegfried']);
    readyToPlay(game, a, ['arene']);
    expect(game.playSteps(a, 0)[0]!.options).toHaveLength(1);
    state(game, a).hp = 10;
    playNow(game, a, 0, [{ kind: 'mode', index: 1 }]);
    expect(game.player(b).hp).toBe(game.player(b).maxHp - 3);
  });

  it('Bassin de sang : votre héros subit 2 dégâts, vos créatures gagnent +1 en attaque jusqu\'à la fin du tour', () => {
    const { game, a } = newGame();
    const griffin = place(game, a, 'griffonLoyal', 0, 0);
    readyToPlay(game, a, ['bassinSang']);
    playNow(game, a, 0, []);
    expect(game.player(a).hp).toBe(game.player(a).maxHp - 2);
    expect(game.attackOf(griffin)).toBe(3);
    game.endTurn(a);
    expect(game.attackOf(griffin)).toBe(2);
  });

  it('Hutte du chaman de sang : +2 en attaque jusqu\'à la fin du tour, et une carte retourne sur la bibliothèque', () => {
    const { game, a } = newGame();
    const griffin = place(game, a, 'griffonLoyal', 0, 0);
    readyToPlay(game, a, ['hutteChaman', 'soin']);
    playNow(game, a, 0, [unit(griffin), { kind: 'hand', index: 1 }]);
    expect(game.attackOf(griffin)).toBe(4);
    expect(game.player(a).deck.at(-1)).toBe('soin');
    game.endTurn(a);
    expect(game.attackOf(griffin)).toBe(2);
  });

  it('Autel sacrificiel : inflige les PV restants d\'une créature alliée à une autre, puis la détruit', () => {
    const { game, a, b } = newGame();
    const orc = place(game, a, 'orcCorrompu', 0, 0); // 7 PV
    const lord = place(game, b, 'seigneurAbyssal', 0, 0); // 9 PV
    readyToPlay(game, a, ['autelSacrificiel']);
    playNow(game, a, 0, [unit(orc), unit(lord)]);
    expect(lord.hpCur).toBe(2);
    expect(game.locate(orc.uid)).toBeNull();
  });
});
