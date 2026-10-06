import { describe, expect, it } from 'vitest';
import { getCard, getCreature } from '../../../src/model/cards';
import { buildPlayerView } from '../../../src/model/game-view';
import { newGame, place, playNow, powerNow, readyToPlay, slot, state, unit } from './helpers';

const lane = (n: number) => ({ kind: 'lane' as const, lane: n });

describe('Ascension du vide — créatures de Sanctuaire', () => {
  it('Honneur : les créatures alliées adjacentes gagnent +N en attaque et en riposte', () => {
    const { game, a } = newGame();
    place(game, a, 'kenshi', 0, 1); // Honneur 2
    const near = place(game, a, 'gardeRequin', 0, 0); // 2/1/2
    const far = place(game, a, 'gardeRequin', 0, 3);
    expect([game.attackOf(near), game.retaliationOf(near), game.attackOf(far)]).toEqual([4, 3, 2]);
  });

  it('Voie de l\'honneur (Takana) : les créatures avec Honneur gagnent +1 en attaque', () => {
    const { game, a } = newGame(['takana', 'kalAzaar']);
    const naga = place(game, a, 'guerrierNaga', 0, 0); // 2/1/6, Honneur 1
    const kappa = place(game, a, 'kappa', 0, 3);
    expect([game.attackOf(naga), game.attackOf(kappa)]).toEqual([3, 2]);
  });

  it('Hypnose : les créatures ennemies du couloir sont immobilisées, et Ishuma peut les frapper', () => {
    const { game, a, b } = newGame(['ishuma', 'kalAzaar']);
    place(game, a, 'demoiselleNeiges', 1, 1);
    const hypnotized = place(game, b, 'cerbere', 0, 1); // 3/1/3
    const free = place(game, b, 'cerbere', 0, 2);
    expect([game.isImmobilized(hypnotized), game.isImmobilized(free)]).toEqual([true, false]);
    expect(game.powerSteps(a)[0]!.options).toEqual([unit(hypnotized)]);
    powerNow(game, a, [unit(hypnotized)]);
    expect(hypnotized.hpCur).toBe(1);
  });

  it('Toucher glacé : la créature blessée ne peut ni attaquer ni bouger jusqu\'au prochain tour de l\'attaquant', () => {
    const { game, a, b } = newGame();
    const guard = place(game, a, 'gardeShanriya', 1, 0); // 2/0/4, immunisée contre la riposte
    const enemy = place(game, b, 'griffonLoyal', 0, 0);
    game.attack(a, guard.uid, unit(enemy));
    game.endTurn(a);
    expect(game.whyNotAttack(b, enemy.uid)).toBe('Cette créature ne peut pas attaquer ce tour-ci.');
    expect(game.moveDestinations(b, enemy.uid)).toEqual([]);
    game.endTurn(b);
    expect([game.cannotAttack(enemy), game.isImmobilized(enemy)]).toEqual([false, false]);
  });

  it('Bouclier magique : ignore les dégâts des sorts et des créatures magiques', () => {
    const { game, a, b } = newGame();
    const kami = place(game, b, 'mizuKami', 0, 0); // 5 PV
    const lich = place(game, a, 'licheNeophyte', 1, 0); // tireur magique
    const ghoul = place(game, a, 'gouleMiserable', 0, 0); // mêlée non magique, 2 en attaque
    readyToPlay(game, a, ['traitFeu']);
    playNow(game, a, 0, [unit(kami)]);
    game.attack(a, lich.uid, unit(kami));
    expect(kami.hpCur).toBe(5);
    game.attack(a, ghoul.uid, unit(kami));
    expect(kami.hpCur).toBe(3);
  });

  it('Renard blanc : la Destinée de son propriétaire augmente de 1', () => {
    const { game, a } = newGame();
    const destiny = game.statOf(a, 'd');
    place(game, a, 'renardBlanc', 0, 0);
    expect(game.statOf(a, 'd')).toBe(destiny + 1);
  });

  it('Yéti : +1 en attaque et en riposte par créature ennemie', () => {
    const { game, a, b } = newGame();
    const yeti = place(game, a, 'yetiMontagnes', 0, 0); // 2/0/6
    place(game, b, 'griffonLoyal', 0, 0);
    place(game, b, 'griffonLoyal', 0, 1);
    expect([game.attackOf(yeti), game.retaliationOf(yeti)]).toEqual([4, 2]);
  });

  it('Nyorai sairensa : l\'adversaire ne peut pas déployer de créature dans son couloir', () => {
    const { game, a, b } = newGame();
    place(game, a, 'nyoraiSairensa', 0, 2);
    expect(game.deploySlots(b, getCreature('gardeRequin')).map(s => s.lane)).toEqual([0, 1, 3]);
  });

  it('Déjouer : en arrivant, la créature déplace une créature ennemie choisie', () => {
    const { game, a, b } = newGame();
    const enemy = place(game, b, 'griffonLoyal', 0, 0);
    readyToPlay(game, a, ['pretresseCorail']);
    const steps = game.playSteps(a, 0);
    expect(steps).toHaveLength(3);
    const to = { kind: 'cell' as const, player: b, row: 1, lane: 3 };
    expect(steps[2]!.after).toContainEqual({ previous: [slot(1, 0), unit(enemy)], options: expect.arrayContaining([to]) });
    playNow(game, a, 0, [slot(1, 0), unit(enemy), to]);
    expect(game.locate(enemy.uid)).toMatchObject({ row: 1, lane: 3 });
  });

  it('Déjouer : sans créature ennemie, seul l\'emplacement est demandé', () => {
    const { game, a } = newGame();
    readyToPlay(game, a, ['pretresseCorail']);
    expect(game.playSteps(a, 0)).toHaveLength(1);
  });

  it('Kirin sacré : les autres créatures alliées de l\'Eau gagnent Explosion 1', () => {
    const { game, a } = newGame();
    place(game, a, 'kirinSacre', 1, 0);
    const kirin = place(game, a, 'kirin', 1, 1); // Explosion 2
    const spirit = place(game, a, 'espritSource', 0, 0);
    const shark = place(game, a, 'gardeRequin', 0, 1);
    expect([game.keywordsOf(kirin).areaBlast, game.keywordsOf(spirit).areaBlast, game.keywordsOf(shark).areaBlast]).toEqual([2, 1, undefined]);
  });

  it('Shinobi maître chanteur : la première frappe sur le héros du tour augmente la production', () => {
    const { game, a, b } = newGame();
    const first = place(game, a, 'shinobiMaitreChanteur', 1, 0);
    const second = place(game, a, 'shinobiMaitreChanteur', 1, 1);
    const production = game.player(a).maxRes;
    game.attack(a, first.uid, { kind: 'hero', player: b });
    game.attack(a, second.uid, { kind: 'hero', player: b });
    expect(game.player(a).maxRes).toBe(production + 1);
  });

  it('Kaiko : défausse une carte pour renvoyer une créature alliée dans la main', () => {
    const { game, a } = newGame(['kaiko', 'kalAzaar']);
    const griffin = place(game, a, 'griffonLoyal', 0, 0);
    readyToPlay(game, a, ['soin']);
    powerNow(game, a, [{ kind: 'hand', index: 0 }, unit(griffin)]);
    expect(game.locate(griffin.uid)).toBeNull();
    expect(game.player(a).hand).toEqual(['griffonLoyal']);
    expect(game.player(a).grave).toEqual(['soin']);
  });

  it('Yukiko n\'a pas de pouvoir', () => {
    const { game, a } = newGame(['yukiko', 'kalAzaar']);
    expect(game.whyNotPower(a)).toBe('Votre héros n\'a pas de pouvoir.');
  });
});

describe('Ascension du vide — sorts', () => {
  it('Feu intérieur collectif : +2/+2 pour vos créatures jusqu\'à votre prochain tour', () => {
    const { game, a, b } = newGame();
    const griffin = place(game, a, 'griffonLoyal', 0, 0); // 2/1/4
    readyToPlay(game, a, ['feuInterieurCollectif']);
    playNow(game, a, 0, []);
    game.endTurn(a);
    expect([game.attackOf(griffin), game.retaliationOf(griffin)]).toEqual([4, 3]);
    game.endTurn(b);
    expect(game.attackOf(griffin)).toBe(2);
    expect(game.lasting).toEqual([]);
    expect(game.player(a).grave).toContain('feuInterieurCollectif');
  });

  it('Tempête de sable : les créatures ennemies de mêlée et volantes ne peuvent pas attaquer', () => {
    const { game, a, b } = newGame();
    const griffin = place(game, b, 'griffonLoyal', 0, 0);
    const archer = place(game, b, 'arbaletrierImperial', 1, 1);
    readyToPlay(game, a, ['tempeteSable']);
    playNow(game, a, 0, []);
    game.endTurn(a);
    expect(game.whyNotAttack(b, griffin.uid)).toBe('Cette créature ne peut pas attaquer ce tour-ci.');
    expect(game.whyNotAttack(b, archer.uid)).toBeNull();
  });

  it('Mur d\'eau : les créatures qui ont 2 ou moins en attaque ne peuvent pas attaquer', () => {
    const { game, a, b } = newGame();
    const griffin = place(game, b, 'griffonLoyal', 0, 0);
    const lord = place(game, b, 'seigneurAbyssal', 0, 1);
    readyToPlay(game, a, ['murEau']);
    playNow(game, a, 0, []);
    game.endTurn(a);
    expect([game.cannotAttack(griffin), game.cannotAttack(lord)]).toEqual([true, false]);
  });

  it('Garde contre les ténèbres : protège vos créatures, et disparaît quand vous n\'en avez plus', () => {
    const { game, a } = newGame();
    const griffin = place(game, a, 'griffonLoyal', 0, 0);
    readyToPlay(game, a, ['gardeTenebres']);
    playNow(game, a, 0, []);
    expect(game.keywordsOf(griffin).darkWard).toBe(true);
    game.destroyUnit(griffin.uid);
    expect(game.lasting).toEqual([]);
    expect(game.player(a).grave).toContain('gardeTenebres');
  });

  it('Arme ardente : la créature gagne un marqueur +1 en attaque chaque fois qu\'elle attaque', () => {
    const { game, a, b } = newGame();
    const griffin = place(game, a, 'griffonLoyal', 0, 0);
    readyToPlay(game, a, ['armeArdente']);
    playNow(game, a, 0, [unit(griffin)]);
    game.attack(a, griffin.uid, { kind: 'hero', player: b });
    expect(griffin.boost).toBe(1);
    expect(game.player(b).hp).toBe(game.player(b).maxHp - 3);
  });

  it('Combustion : la créature subit 1 dégât au début du tour de chaque joueur', () => {
    const { game, a, b } = newGame();
    const griffin = place(game, b, 'griffonLoyal', 0, 0);
    readyToPlay(game, a, ['combustion']);
    playNow(game, a, 0, [unit(griffin)]);
    game.endTurn(a);
    game.endTurn(b);
    expect(griffin.hpCur).toBe(2);
  });

  it('Dissipation de masse : détruit tous les sorts permanents', () => {
    const { game, a } = newGame();
    const griffin = place(game, a, 'griffonLoyal', 0, 0);
    readyToPlay(game, a, ['benediction', 'feuInterieurCollectif', 'dissipationMasse']);
    playNow(game, a, 0, [unit(griffin)]);
    playNow(game, a, 0, []);
    playNow(game, a, 0, []);
    expect(griffin.enchantments).toEqual([]);
    expect(game.lasting).toEqual([]);
    expect(game.player(a).grave).toEqual(expect.arrayContaining(['benediction', 'feuInterieurCollectif', 'dissipationMasse']));
  });

  it('Mousson : les sorts de Feu infligent moitié moins de dégâts', () => {
    const { game, a, b } = newGame();
    const griffin = place(game, b, 'griffonLoyal', 0, 0);
    readyToPlay(game, a, ['mousson', 'traitFeu']);
    playNow(game, a, 0, []);
    playNow(game, a, 0, [unit(griffin)]);
    expect(griffin.hpCur).toBe(3);
  });

  it('Pureté : retire les marqueurs de vos créatures et empêche d\'en poser', () => {
    const { game, a } = newGame();
    const griffin = place(game, a, 'griffonLoyal', 0, 0);
    griffin.poison = 2;
    griffin.cripple = 1;
    readyToPlay(game, a, ['purete']);
    playNow(game, a, 0, []);
    game.addCounters(griffin, 'poison', 1);
    expect([griffin.poison, griffin.cripple]).toEqual([0, 0]);
  });

  it('Nuage toxique : un marqueur de poison sur chaque créature', () => {
    const { game, a, b } = newGame();
    const mine = place(game, a, 'griffonLoyal', 0, 0);
    const theirs = place(game, b, 'griffonLoyal', 0, 0);
    readyToPlay(game, a, ['nuageToxique']);
    playNow(game, a, 0, []);
    expect([mine.poison, theirs.poison]).toEqual([1, 1]);
  });

  it('Flèches de tempête : vos tireurs gagnent Ubiquité jusqu\'à la fin du tour', () => {
    const { game, a, b } = newGame();
    const archer = place(game, a, 'arbaletrierImperial', 1, 0);
    const facing = place(game, b, 'cerbere', 0, 0);
    const elsewhere = place(game, b, 'griffonLoyal', 0, 3);
    readyToPlay(game, a, ['flechesTempete']);
    expect(game.attackTargets(a, archer.uid)).toEqual([unit(facing)]);
    playNow(game, a, 0, []);
    expect(game.attackTargets(a, archer.uid)).toEqual(expect.arrayContaining([unit(facing), unit(elsewhere)]));
    game.endTurn(a);
    expect(game.lasting).toEqual([]);
  });

  it('Ange gardien : les créatures du couloir ne peuvent pas être ciblées', () => {
    const { game, a, b } = newGame();
    place(game, b, 'griffonLoyal', 0, 0);
    const other = place(game, b, 'cerbere', 0, 1);
    readyToPlay(game, a, ['angeGardien', 'traitFeu']);
    playNow(game, a, 0, [lane(0)]);
    expect(game.playSteps(a, 0)[0]!.options).toEqual([unit(other)]);
  });

  it('Vent porteur : échange deux créatures alliées qui peuvent occuper la case de l\'autre', () => {
    const { game, a } = newGame();
    const ghoul = place(game, a, 'gouleMiserable', 0, 0);
    const griffin = place(game, a, 'griffonLoyal', 0, 2);
    place(game, a, 'arbaletrierImperial', 1, 1);
    readyToPlay(game, a, ['ventPorteur']);
    const second = game.playSteps(a, 0)[1]!.after!.find(x => x.previous[0]!.kind === 'unit' && x.previous[0]!.uid === ghoul.uid);
    expect(second?.options).toEqual([unit(griffin)]);
    playNow(game, a, 0, [unit(ghoul), unit(griffin)]);
    expect([game.locate(ghoul.uid)?.lane, game.locate(griffin.uid)?.lane]).toEqual([2, 0]);
  });

  it('Entraves de soie lunaire : un marqueur d\'estropiement sur deux créatures', () => {
    const { game, a, b } = newGame();
    const first = place(game, b, 'griffonLoyal', 0, 0);
    const second = place(game, b, 'griffonLoyal', 0, 1);
    readyToPlay(game, a, ['entravesSoieLunaire']);
    playNow(game, a, 0, [unit(first), unit(second)]);
    expect([first.cripple, second.cripple]).toEqual([1, 1]);
  });

  it('Négation de la magie : retire les marqueurs et les enchantements d\'une créature', () => {
    const { game, a, b } = newGame();
    const griffin = place(game, b, 'griffonLoyal', 0, 0);
    game.enchant(griffin.uid, 'faiblesse', b, { atk: -2, ret: -2 });
    griffin.poison = 2;
    readyToPlay(game, a, ['negationMagie']);
    playNow(game, a, 0, [unit(griffin)]);
    expect([griffin.enchantments, griffin.poison, game.attackOf(griffin)]).toEqual([[], 0, 2]);
    expect(game.player(b).grave).toContain('faiblesse');
  });

  it('Bulbe vénéneux : la créature de mêlée qui attaque depuis le couloir est empoisonnée, et le bulbe détruit', () => {
    const { game, a, b } = newGame();
    const ghoul = place(game, b, 'gouleMiserable', 0, 0);
    readyToPlay(game, a, ['bulbeVenimeux']);
    playNow(game, a, 0, [lane(0)]);
    game.endTurn(a);
    game.attack(b, ghoul.uid, { kind: 'hero', player: a });
    expect(ghoul.poison).toBe(2);
    expect(game.lasting).toEqual([]);
    expect(game.player(a).grave).toContain('bulbeVenimeux');
  });

  it('Malédiction du pénitent : chaque créature perd la moitié de ses PV restants, arrondie au supérieur', () => {
    const { game, a, b } = newGame();
    const griffin = place(game, b, 'griffonLoyal', 0, 0); // 4 PV
    const lord = place(game, a, 'seigneurAbyssal', 0, 0); // 9 PV
    readyToPlay(game, a, ['maledictionPenitent']);
    playNow(game, a, 0, []);
    expect([griffin.hpCur, lord.hpCur]).toEqual([2, 4]);
  });

  it('Désespoir : 2 dégâts aux créatures ennemies sans voisine alliée', () => {
    const { game, a, b } = newGame();
    const alone = place(game, b, 'griffonLoyal', 0, 0);
    const paired = place(game, b, 'cerbere', 0, 2);
    place(game, b, 'arbaletrierImperial', 1, 2);
    readyToPlay(game, a, ['desespoir']);
    playNow(game, a, 0, []);
    expect([alone.hpCur, paired.hpCur]).toEqual([2, 3]);
  });
});

describe('Ascension du vide — fortunes', () => {
  it('Sanctuaire de Yukiko : vos créatures non uniques coûtent 2 tant que vous en avez moins que l\'adversaire', () => {
    const { game, a, b } = newGame();
    place(game, b, 'griffonLoyal', 0, 0);
    readyToPlay(game, a, ['sanctuaireYukiko']);
    playNow(game, a, 0, []);
    expect(game.cardCost(a, getCard('seigneurAbyssal'))).toBe(2);
    expect(game.cardCost(a, getCard('diablotinChaos'))).toBe(4);
    game.endTurn(a);
    expect(game.lasting).toEqual([]);
  });

  it('Terre honorée : vos créatures gagnent leur valeur d\'Honneur en attaque et en riposte', () => {
    const { game, a } = newGame();
    const naga = place(game, a, 'guerrierNaga', 0, 0); // 2/1, Honneur 1
    readyToPlay(game, a, ['terreHonoree']);
    playNow(game, a, 0, []);
    expect([game.attackOf(naga), game.retaliationOf(naga)]).toEqual([3, 2]);
  });

  it('Temple caché : une carte retourne sur la bibliothèque, et les créatures coûtent 1 de moins', () => {
    const { game, a } = newGame();
    readyToPlay(game, a, ['templeCache', 'soin', 'griffonLoyal']);
    playNow(game, a, 0, [{ kind: 'hand', index: 1 }]);
    expect(game.player(a).deck.at(-1)).toBe('soin');
    expect(game.cardCost(a, getCard('griffonLoyal'))).toBe(1);
  });

  it('Avalanche : l\'adversaire ne peut pas déployer de créature jusqu\'à votre prochain tour', () => {
    const { game, a, b } = newGame();
    readyToPlay(game, a, ['avalanche']);
    playNow(game, a, 0, []);
    game.endTurn(a);
    state(game, b).hand = ['gardeRequin'];
    expect(game.whyNotPlay(b, 0)).toBe('Vous ne pouvez pas déployer de créature ce tour-ci.');
  });

  it('Labyrinthe gelé : deux créatures ennemies ne peuvent pas attaquer', () => {
    const { game, a, b } = newGame();
    const first = place(game, b, 'griffonLoyal', 0, 0);
    const second = place(game, b, 'cerbere', 0, 1);
    readyToPlay(game, a, ['labyrintheGele']);
    playNow(game, a, 0, [unit(first), unit(second)]);
    game.endTurn(a);
    expect([game.cannotAttack(first), game.cannotAttack(second)]).toEqual([true, true]);
  });

  it('Salle des défis : une seule créature ennemie par ligne peut attaquer', () => {
    const { game, a, b } = newGame();
    const first = place(game, b, 'gouleMiserable', 0, 0);
    const second = place(game, b, 'gouleMiserable', 0, 1);
    readyToPlay(game, a, ['salleDefis']);
    playNow(game, a, 0, []);
    game.endTurn(a);
    game.attack(b, first.uid, { kind: 'hero', player: a });
    expect(game.whyNotAttack(b, second.uid)).toBe('Cette créature ne peut pas attaquer ce tour-ci.');
  });

  it('Pilier de clairvoyance : montre la main adverse jusqu\'à la fin du tour et fait piocher', () => {
    const { game, a, b } = newGame();
    readyToPlay(game, a, ['pilierClairvoyance']);
    playNow(game, a, 0, []);
    expect(buildPlayerView(game, a).players[b].hand).toHaveLength(game.player(b).hand.length);
    expect(game.player(a).hand).toHaveLength(1);
    game.endTurn(a);
    expect(buildPlayerView(game, a).players[b].hand).toBeNull();
  });

  it('Tour du temple : la caractéristique n\'est proposée qu\'avec moins de créatures que l\'adversaire', () => {
    const { game, a, b } = newGame();
    readyToPlay(game, a, ['tourTemple']);
    expect(game.playSteps(a, 0)[0]!.options).toHaveLength(1);
    place(game, b, 'griffonLoyal', 0, 0);
    expect(game.playSteps(a, 0)[0]!.options).toHaveLength(4);
    const magic = game.player(a).g;
    playNow(game, a, 0, [{ kind: 'mode', index: 2 }]);
    expect(game.player(a).g).toBe(magic + 1);
  });

  it('Forteresse sous-marine : cherche un exemplaire de la créature, qui coûte 2 de moins ce tour-ci', () => {
    const { game, a } = newGame();
    const griffin = place(game, a, 'griffonLoyal', 0, 0);
    readyToPlay(game, a, ['forteresseSousMarine']);
    state(game, a).deck = ['soin', 'griffonLoyal'];
    playNow(game, a, 0, [unit(griffin)]);
    expect(game.player(a).hand).toEqual(['griffonLoyal']);
    expect(game.cardCost(a, getCard('griffonLoyal'))).toBe(0);
  });

  it('Tourbillon : renvoie une créature alliée en main et rapporte 2 ressources', () => {
    const { game, a } = newGame();
    const griffin = place(game, a, 'griffonLoyal', 0, 0);
    readyToPlay(game, a, ['tourbillon'], 2);
    playNow(game, a, 0, [unit(griffin)]);
    expect(game.player(a).hand).toEqual(['griffonLoyal']);
    expect(game.player(a).res).toBe(2);
  });

  it('Phalange impériale : sans attaque de mêlée, vos créatures gagnent Rétribution et +1 en riposte jusqu\'à votre prochain tour', () => {
    const { game, a, b } = newGame();
    const archer = place(game, a, 'arbaletrierImperial', 1, 0); // riposte 0
    readyToPlay(game, a, ['phalangeImperiale']);
    playNow(game, a, 0, []);
    expect(game.retaliationOf(archer)).toBe(0);
    game.endTurn(a);
    expect(game.retaliationOf(archer)).toBe(1);
    expect(game.keywordsOf(archer).retribution).toBe(true);
    game.endTurn(b);
    expect(game.retaliationOf(archer)).toBe(0);
  });

  it('Arbre de vérité : détruit une fortune permanente ciblée', () => {
    const { game, a } = newGame();
    readyToPlay(game, a, ['salleDefis', 'arbreVerite']);
    playNow(game, a, 0, []);
    playNow(game, a, 0, [{ kind: 'lasting', index: 0 }]);
    expect(game.lasting).toEqual([]);
    expect(game.player(a).grave).toEqual(['salleDefis', 'arbreVerite']);
  });

  it('Trêve d\'Elrath : l\'attaque de chaque créature est égale à sa riposte', () => {
    const { game, a } = newGame();
    const griffin = place(game, a, 'griffonLoyal', 0, 0); // 2/1
    readyToPlay(game, a, ['treveElrath']);
    playNow(game, a, 0, []);
    expect(game.attackOf(griffin)).toBe(1);
  });

  it('Rite de transfert nécromantique : sacrifie une créature et déploie une créature moins chère du cimetière', () => {
    const { game, a } = newGame();
    const lord = place(game, a, 'seigneurAbyssal', 0, 0);
    readyToPlay(game, a, ['riteTransfert']);
    state(game, a).grave = ['griffonLoyal'];
    playNow(game, a, 0, [unit(lord), { kind: 'card', zone: 'grave', cardId: 'griffonLoyal' }, slot(0, 0)]);
    expect(game.player(a).board[0]![0]?.cardId).toBe('griffonLoyal');
    expect(game.player(a).grave).toEqual(['seigneurAbyssal', 'riteTransfert']);
  });

  it('Pillage : l\'adversaire ne reçoit que la moitié de sa production au ravitaillement', () => {
    const { game, a, b } = newGame();
    state(game, b).maxRes = 5;
    readyToPlay(game, a, ['pillage']);
    playNow(game, a, 0, []);
    game.endTurn(a);
    expect(game.player(b).res).toBe(3);
  });
});
