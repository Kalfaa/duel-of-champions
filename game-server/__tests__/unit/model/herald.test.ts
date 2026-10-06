import { describe, expect, it } from 'vitest';
import { getCard } from '../../../src/model/cards';
import { buildPlayerView } from '../../../src/model/game-view';
import { newGame, place, playNow, powerNow, readyToPlay, setEvents, slot, state, unit } from './helpers';

const revealed = (cardId: string) => ({ kind: 'card' as const, zone: 'revealed' as const, cardId });
const hero = (player: 0 | 1) => ({ kind: 'hero' as const, player });

describe('Héraut du vide — capacités de combat', () => {
  it('Peur : ne peut pas être attaquée par une créature qui exige peu de Puissance', () => {
    const { game, a, b } = newGame();
    const weak = place(game, a, 'gouleMiserable', 0, 0); // Puissance 1
    const strong = place(game, a, 'seigneurAbyssal', 0, 1); // Puissance 6
    const lurker = place(game, b, 'rodeurTenebres', 0, 0); // Peur 2
    place(game, b, 'griffonLoyal', 0, 1);
    expect(game.attackTargets(a, weak.uid)).toEqual([]);
    state(game, b).board[0]![1] = null;
    state(game, b).board[0]![1] = lurker;
    state(game, b).board[0]![0] = null;
    expect(game.attackTargets(a, strong.uid)).toEqual([unit(lurker)]);
  });

  it('Imposante : les autres créatures alliées du couloir ne peuvent être ni attaquées ni blessées au combat', () => {
    const { game, a, b } = newGame();
    const archer = place(game, a, 'arbaletrierImperial', 1, 0);
    place(game, b, 'sylvestreBoisSombre', 0, 0);
    const behind = place(game, b, 'archerSquelette', 1, 0);
    expect(game.attackTargets(a, archer.uid)).not.toContainEqual(unit(behind));
  });

  it('Rapide : la créature peut attaquer puis se déplacer', () => {
    const { game, a, b } = newGame();
    const spearman = place(game, a, 'lancierGriffon', 0, 0);
    game.attack(a, spearman.uid, hero(b));
    expect(game.moveDestinations(a, spearman.uid)).toContainEqual({ row: 0, lane: 1 });
    const ghoul = place(game, a, 'gouleMiserable', 0, 3);
    game.attack(a, ghoul.uid, hero(b));
    expect(game.moveDestinations(a, ghoul.uid)).toEqual([]);
  });

  it('Riposte parfaite : ignore les gardes et l\'armure de l\'attaquant', () => {
    const { game, a, b } = newGame();
    const attacker = place(game, a, 'gouleMiserable', 0, 0); // 2 PV
    attacker.keywords = { armor: 1 };
    const guard = place(game, b, 'gardeLoup', 0, 0); // riposte 2, Riposte parfaite
    game.attack(a, attacker.uid, unit(guard));
    game.resolveRetaliation();
    expect(game.locate(attacker.uid)).toBeNull();
  });

  it('Guerrier shinje : détruit la créature qui l\'attaque', () => {
    const { game, a, b } = newGame();
    const lord = place(game, a, 'seigneurAbyssal', 0, 0);
    const shinje = place(game, b, 'guerrierShinje', 0, 0);
    shinje.hpCur = 9;
    game.attack(a, lord.uid, unit(shinje));
    expect(game.locate(lord.uid)).toBeNull();
  });

  it('Maniaque des flammes : rend les ennemis de son couloir berserk et blesse ses attaquants', () => {
    const { game, a, b } = newGame();
    const ghoul = place(game, a, 'gouleMiserable', 0, 0);
    ghoul.hpCur = 5;
    ghoul.hpMax = 5;
    place(game, b, 'maniaqueFlammes', 0, 0);
    expect(game.keywordsOf(ghoul).berserk).toBe(true);
    game.attack(a, ghoul.uid, { kind: 'unit', uid: game.player(b).board[0]![0]!.uid });
    expect(ghoul.hpCur).toBe(1);
  });

  it('Berserk : la créature attaque d\'office au début de la phase d\'action', () => {
    const { game, a, b } = newGame();
    place(game, b, 'executeurUrKhrag', 0, 2); // 4 en attaque, Berserk
    game.endTurn(a);
    expect(game.player(a).hp).toBe(game.player(a).maxHp - 4);
    void b;
  });

  it('Soif de sang : gagne de la rage quand une créature ennemie meurt', () => {
    const { game, a, b } = newGame();
    const wyvern = place(game, a, 'wyverneFrenetique', 0, 0);
    game.destroyUnit(place(game, b, 'griffonLoyal', 0, 0).uid);
    expect(wyvern.enrage).toBe(1);
  });

  it('Protection contre les fortunes et contre les sorts ennemis : ces cartes ne peuvent pas cibler la créature', () => {
    const { game, a, b } = newGame();
    const kappa = place(game, b, 'kappaVenerable', 0, 0);
    const crusher = place(game, b, 'broyeurCraneNoir', 0, 1);
    const other = place(game, b, 'griffonLoyal', 0, 2);
    place(game, a, 'griffonLoyal', 0, 0);
    readyToPlay(game, a, ['traitFeu', 'attaqueSurprise']);
    expect(game.playSteps(a, 0)[0]!.options).toEqual(expect.arrayContaining([unit(kappa), unit(other)]));
    expect(game.playSteps(a, 0)[0]!.options).not.toContainEqual(unit(crusher));
    expect(game.playSteps(a, 1)[1]!.options).not.toContainEqual(unit(kappa));
  });

  it('Chaton guerrier : ne peut pas être ciblé', () => {
    const { game, a, b } = newGame();
    const kitten = place(game, b, 'guerrierChaton', 0, 0);
    readyToPlay(game, a, ['traitFeu']);
    expect(game.whyNotPlay(a, 0)).toBe('Aucune cible valide.');
    expect(game.isTargetable(kitten.uid)).toBe(false);
  });

  it('Canal magique, Sans marqueurs, Résistance aux sorts, Soin par la terre, Garde volants', () => {
    const { game, a, b } = newGame();
    const magic = game.statOf(a, 'g');
    place(game, a, 'arbitreNeant', 1, 0);
    expect(game.statOf(a, 'g')).toBe(magic + 2);
    const glory = place(game, a, 'gloireImmaculee', 0, 1);
    game.addCounters(glory, 'poison', 2);
    expect(glory.poison).toBe(0);
    const bramble = place(game, b, 'betePronces', 0, 0); // 5 PV
    readyToPlay(game, a, ['frappeFoudre']);
    playNow(game, a, 0, [unit(bramble)]);
    expect(bramble.hpCur).toBe(3);
    const elemental = place(game, b, 'elementaireTerreSuperieur', 0, 1);
    elemental.hpCur = 5;
    game.damageUnit(elemental.uid, 3, { magic: true, school: 'Terre', spell: true });
    expect(elemental.hpCur).toBe(8);
    const knight = place(game, b, 'chevalierGriffon', 0, 2); // Garde volants 2
    const griffin = place(game, a, 'griffonLoyal', 0, 2);
    game.attack(a, griffin.uid, unit(knight));
    expect(knight.hpCur).toBe(5);
  });
});

describe('Héraut du vide — créatures à effet', () => {
  it('Voyant du chaos : chaque joueur garde 6 cartes au plus au début de son tour, et son départ fait défausser', () => {
    const { game, a, b } = newGame();
    const seer = place(game, a, 'voyantChaos', 1, 0);
    state(game, b).hand = Array<string>(9).fill('soin');
    game.endTurn(a);
    expect(game.player(b).hand).toHaveLength(7); // 6 gardées, puis la pioche du tour
    game.destroyUnit(seer.uid);
    expect(game.player(b).hand).toHaveLength(6);
  });

  it('Lacérateur du chaos : s\'il meurt pendant votre tour, l\'adversaire défausse une carte', () => {
    const { game, a, b } = newGame();
    const lacerator = place(game, a, 'lacerateurChaos', 0, 0);
    state(game, b).hand = ['soin', 'soin'];
    game.destroyUnit(lacerator.uid);
    expect(game.player(b).hand).toHaveLength(1);
  });

  it('Prêtre de bataille griffon : soigne votre héros au début de votre tour', () => {
    const { game, a, b } = newGame();
    place(game, a, 'pretreBatailleGriffon', 1, 0);
    state(game, a).hp = 10;
    game.endTurn(a);
    game.endTurn(b);
    expect(game.player(a).hp).toBe(11);
  });

  it('Canalisatrice namtaru : +1/+1 par sort permanent en jeu ; Ermite : +1 Infection aux autres', () => {
    const { game, a } = newGame();
    const channeler = place(game, a, 'canalisatriceNamtaru', 0, 0); // 1/0, Infection 1
    readyToPlay(game, a, ['resolution']);
    playNow(game, a, 0, []);
    expect(game.attackOf(channeler)).toBe(2);
    place(game, a, 'ermiteBoisSombre', 1, 1);
    expect(game.keywordsOf(channeler).infect).toBe(2);
  });

  it('Arbitre du Néant : personne ne pioche en dehors de sa phase de ravitaillement', () => {
    const { game, a } = newGame();
    place(game, a, 'arbitreNeant', 1, 0);
    const hand = game.player(a).hand.length;
    game.draw(a, 2);
    expect(game.player(a).hand).toHaveLength(hand);
  });

  it('Gardien du Néant : les créatures qui meurent sont bannies', () => {
    const { game, a, b } = newGame();
    place(game, a, 'gardienNeant', 1, 0);
    game.destroyUnit(place(game, b, 'griffonLoyal', 0, 0).uid);
    expect(game.player(b).grave).toEqual([]);
  });

  it('Liche dévoreuse d\'âmes : se soigne quand une créature meurt', () => {
    const { game, a, b } = newGame();
    const lich = place(game, a, 'licheDevoreuse', 0, 0);
    lich.hpCur = 3;
    game.destroyUnit(place(game, b, 'griffonLoyal', 0, 0).uid);
    expect(lich.hpCur).toBe(5);
  });

  it('Okane no okane : les cartes ne font plus gagner de ressources', () => {
    const { game, a } = newGame();
    place(game, a, 'okaneNoOkane', 1, 0);
    const res = game.player(a).res;
    game.gainResources(a, 3);
    expect(game.player(a).res).toBe(res);
  });

  it('Plieur de destin : +2 en attaque si l\'adversaire a défaussé ce tour-ci', () => {
    const { game, a, b } = newGame();
    const bender = place(game, a, 'plieurDestin', 1, 0);
    state(game, b).hand = ['soin'];
    game.discardRandom(b);
    expect(game.attackOf(bender)).toBe(4);
  });

  it('Ange de miséricorde et Cracheur de pourriture : effets à l\'arrivée', () => {
    const { game, a, b } = newGame();
    readyToPlay(game, a, ['angeMisericorde', 'cracheurPourriture']);
    state(game, a).grave = ['griffonLoyal'];
    playNow(game, a, 0, [slot(0, 0)]);
    expect(game.player(a).hand).toContain('griffonLoyal');
    const enemy = place(game, b, 'griffonLoyal', 0, 0);
    playNow(game, a, 0, [slot(1, 1), unit(enemy)]);
    expect(enemy.poison).toBe(2);
  });

  it('Kabuki tei : se déploie à la place d\'une créature alliée, qui retourne en main', () => {
    const { game, a } = newGame();
    const ghoul = place(game, a, 'gouleMiserable', 0, 0);
    readyToPlay(game, a, ['kabukiTei']);
    playNow(game, a, 0, [slot(0, 0)]);
    expect(game.locate(ghoul.uid)).toBeNull();
    expect(game.player(a).hand).toEqual(['gouleMiserable']);
    expect(game.player(a).board[0]![0]?.cardId).toBe('kabukiTei');
  });

  it('Chanteuse du ruisseau : renvoie une carte permanente dans la main de son propriétaire', () => {
    const { game, a } = newGame();
    readyToPlay(game, a, ['resolution', 'chanteuseRuisseau']);
    playNow(game, a, 0, []);
    playNow(game, a, 0, [slot(1, 0), { kind: 'lasting', index: 0 }]);
    expect(game.lasting).toEqual([]);
    expect(game.player(a).hand).toEqual(['resolution']);
  });
});

describe('Héraut du vide — choix après résolution', () => {
  it('Dhamiria : choisit un sort dans la main adverse, défaussé avec ses homonymes ; rien d\'autre n\'est possible avant', () => {
    const { game, a, b } = newGame(['dhamiria', 'siegfried']);
    readyToPlay(game, a, []);
    state(game, b).hand = ['soin', 'soin', 'griffonLoyal', 'appelDevoir'];
    powerNow(game, a, []);
    expect(game.pendingPick?.options).toEqual([revealed('soin'), revealed('appelDevoir')]);
    expect(buildPlayerView(game, a).pick?.cards.map(c => c.id)).toEqual(['soin', 'appelDevoir']);
    expect(buildPlayerView(game, b).pick).toBeNull();
    expect(() => game.endTurn(a)).toThrow('Faites d\'abord votre choix parmi les cartes proposées.');
    game.pick(a, revealed('soin'));
    expect(game.player(b).hand).toEqual(['griffonLoyal', 'appelDevoir']);
  });

  it('Faille du Néant : détruit aussi les cartes de ce nom en jeu', () => {
    const { game, a, b } = newGame();
    place(game, b, 'griffonLoyal', 0, 0);
    state(game, b).hand = ['griffonLoyal'];
    readyToPlay(game, a, ['failleNeant']);
    playNow(game, a, 0, []);
    game.pick(a, revealed('griffonLoyal'));
    expect(game.units(b)).toEqual([]);
    expect(game.player(b).hand).toEqual([]);
  });

  it('Salle de la fortune : une des 3 cartes du dessus en main, les deux autres dessous', () => {
    const { game, a } = newGame();
    readyToPlay(game, a, ['salleFortune']);
    state(game, a).deck = ['x', 'soin', 'griffonLoyal', 'cerbere'];
    playNow(game, a, 0, []);
    game.pick(a, revealed('griffonLoyal'));
    expect(game.player(a).hand).toEqual(['griffonLoyal']);
    expect(game.player(a).deck).toEqual(['cerbere', 'soin', 'x']);
  });

  it('Bassin de divination : remet les cartes du dessus dans l\'ordre choisi', () => {
    const { game, a } = newGame();
    readyToPlay(game, a, ['bassinDivination']);
    state(game, a).deck = ['soin', 'cerbere', 'griffonLoyal'];
    playNow(game, a, 0, []);
    game.pick(a, revealed('griffonLoyal'));
    game.pick(a, revealed('soin'));
    game.pick(a, revealed('cerbere'));
    expect(game.player(a).deck).toEqual(['griffonLoyal', 'soin', 'cerbere']);
  });

  it('Salles de l\'amnésie : met au cimetière un sort de la bibliothèque adverse', () => {
    const { game, a, b } = newGame();
    readyToPlay(game, a, ['sallesAmnesie']);
    state(game, b).deck = ['griffonLoyal', 'traitFeu'];
    playNow(game, a, 0, [{ kind: 'mode', index: 1 }]);
    game.pick(a, revealed('traitFeu'));
    expect(game.player(b).grave).toEqual(['traitFeu']);
  });

  it('Le chant des perdus : déplace des créatures ennemies jusqu\'à ce que le joueur arrête', () => {
    const { game, a, b } = newGame();
    const first = place(game, b, 'griffonLoyal', 0, 0);
    const second = place(game, b, 'griffonLoyal', 0, 1);
    readyToPlay(game, a, ['chantPerdus']);
    playNow(game, a, 0, []);
    game.pick(a, unit(first));
    game.pick(a, { kind: 'cell', player: b, row: 1, lane: 3 });
    game.pick(a, unit(second));
    game.pick(a, { kind: 'cell', player: b, row: 1, lane: 2 });
    game.pick(a, { kind: 'mode', index: 0 });
    expect(game.pendingPick).toBeNull();
    expect([game.locate(first.uid), game.locate(second.uid)]).toMatchObject([{ row: 1, lane: 3 }, { row: 1, lane: 2 }]);
  });

  it('Brise-sorts du Crâne noir : en attaquant, détruit un sort permanent choisi', () => {
    const { game, a, b } = newGame();
    const smasher = place(game, a, 'briseSortsCraneNoir', 0, 0);
    readyToPlay(game, a, ['resolution']);
    playNow(game, a, 0, []);
    game.attack(a, smasher.uid, hero(b));
    game.pick(a, { kind: 'lasting', index: 0 });
    expect(game.lasting).toEqual([]);
  });
});

describe('Héraut du vide — sorts', () => {
  it('La flamme interdite : dégâts égaux au double de votre Magie', () => {
    const { game, a, b } = newGame();
    const lord = place(game, b, 'seigneurAbyssal', 0, 0);
    readyToPlay(game, a, ['flammeInterdite']);
    state(game, a).g = 4;
    playNow(game, a, 0, []);
    expect(lord.hpCur).toBe(1);
  });

  it('La porte vers nulle part : une créature ennemie qui attaque depuis le couloir est bannie', () => {
    const { game, a, b } = newGame();
    readyToPlay(game, a, ['porteNulle']);
    playNow(game, a, 0, [{ kind: 'lane', lane: 0 }]);
    game.endTurn(a);
    const ghoul = place(game, b, 'gouleMiserable', 0, 0);
    game.attack(b, ghoul.uid, hero(a));
    expect(game.locate(ghoul.uid)).toBeNull();
    expect(game.player(b).grave).toEqual([]);
  });

  it('La lumière de demain : une créature non unique revient du cimetière à chaque tour', () => {
    const { game, a, b } = newGame();
    readyToPlay(game, a, ['lumiereLendemain']);
    playNow(game, a, 0, []);
    state(game, a).grave = ['griffonLoyal', 'diablotinChaos'];
    game.endTurn(a);
    game.endTurn(b);
    expect(game.player(a).hand).toContain('griffonLoyal');
    expect(game.player(a).grave).toEqual(['diablotinChaos']);
  });

  it('La force de la nature : les dégâts subis par vos créatures de la ligne avant sont divisés par deux', () => {
    const { game, a } = newGame();
    const front = place(game, a, 'seigneurAbyssal', 0, 0);
    const back = place(game, a, 'archerSquelette', 1, 1);
    readyToPlay(game, a, ['forceNature']);
    playNow(game, a, 0, []);
    game.damageUnit(front.uid, 4, { magic: false });
    game.damageUnit(back.uid, 4, { magic: false });
    expect([front.hpCur, back.hpCur]).toEqual([7, 1]);
  });

  it('La mort silencieuse : au début de votre tour, la créature meurt et le sort revient en main', () => {
    const { game, a, b } = newGame();
    const lord = place(game, b, 'seigneurAbyssal', 0, 0);
    readyToPlay(game, a, ['mortSilencieuse']);
    playNow(game, a, 0, [unit(lord)]);
    game.endTurn(a);
    game.endTurn(b);
    expect(game.locate(lord.uid)).toBeNull();
    expect(game.player(a).hand).toContain('mortSilencieuse');
  });

  it('Chaînes maudites et Rage ardente', () => {
    const { game, a, b } = newGame();
    const enemy = place(game, b, 'griffonLoyal', 0, 0);
    const mine = place(game, a, 'gouleMiserable', 0, 1);
    readyToPlay(game, a, ['chainesMaudites', 'rageArdente']);
    playNow(game, a, 0, [unit(enemy)]);
    playNow(game, a, 0, [unit(mine)]);
    expect([game.attackOf(mine), game.keywordsOf(mine).berserk]).toEqual([3, true]);
    game.endTurn(a);
    expect(game.player(b).hp).toBe(game.player(b).maxHp - 1);
  });

  it('Éclats de glace : une créature déployée dans le couloir subit 2 dégâts', () => {
    const { game, a } = newGame();
    readyToPlay(game, a, ['eclatsGlace', 'griffonLoyal']);
    playNow(game, a, 0, [{ kind: 'lane', lane: 1 }]);
    playNow(game, a, 0, [slot(0, 1)]);
    expect(game.player(a).board[0]![1]?.hpCur).toBe(2);
  });

  it('Étreinte de Sylanna : +2 PV et Régénération, retirés avec l\'enchantement', () => {
    const { game, a } = newGame();
    const griffin = place(game, a, 'griffonLoyal', 0, 0);
    readyToPlay(game, a, ['etreinteSylanna']);
    playNow(game, a, 0, [unit(griffin)]);
    expect([griffin.hpCur, griffin.hpMax, game.keywordsOf(griffin).regen]).toEqual([6, 6, 1]);
    game.dispelUnit(griffin.uid);
    expect([griffin.hpCur, griffin.hpMax]).toEqual([4, 4]);
  });

  it('Rafale : déplace une créature ennemie puis la blesse avec ses voisines', () => {
    const { game, a, b } = newGame();
    const target = place(game, b, 'griffonLoyal', 0, 0);
    const neighbour = place(game, b, 'griffonLoyal', 0, 2);
    readyToPlay(game, a, ['rafale']);
    playNow(game, a, 0, [unit(target), { kind: 'cell', player: b, row: 0, lane: 1 }]);
    expect([target.hpCur, neighbour.hpCur]).toEqual([3, 3]);
  });

  it('Ancrage et Carapace de glace : la créature ne peut plus être déplacée ; la carapace absorbe les prochains dégâts', () => {
    const { game, a } = newGame();
    const griffin = place(game, a, 'griffonLoyal', 0, 0);
    readyToPlay(game, a, ['carapaceGlace']);
    playNow(game, a, 0, [unit(griffin)]);
    expect(game.moveDestinations(a, griffin.uid)).toEqual([]);
    game.damageUnit(griffin.uid, 3, { magic: false });
    game.damageUnit(griffin.uid, 1, { magic: false });
    expect([griffin.hpCur, griffin.enchantments]).toEqual([3, []]);
  });

  it('Célérité, Intimidation, Rappel mineur, Vague de chaleur, La force de la mer', () => {
    const { game, a, b } = newGame();
    const griffin = place(game, a, 'griffonLoyal', 0, 0);
    const lonely = place(game, b, 'griffonLoyal', 0, 3);
    readyToPlay(game, a, ['celerite', 'intimidation', 'forceMer', 'rappelMineur', 'vagueChaleur'], 20);
    playNow(game, a, 0, [unit(griffin)]);
    expect(game.keywordsOf(griffin).preemptive).toBe(true);
    playNow(game, a, 0, []);
    expect(game.cannotAttack(lonely)).toBe(true);
    playNow(game, a, 0, []);
    expect([game.attackOf(griffin), game.keywordsOf(griffin).fortuneWard]).toEqual([3, true]);
    playNow(game, a, 0, [{ kind: 'lasting', index: 1 }]);
    expect(game.player(a).hand).toEqual(['vagueChaleur', 'forceMer']);
    playNow(game, a, 0, []);
    expect(lonely.hpCur).toBe(3);
  });
});

describe('Héraut du vide — fortunes', () => {
  it('Autel des souhaits : la carte du dessus va en main et ne coûte rien si vous en remplissez les conditions', () => {
    const { game, a } = newGame();
    readyToPlay(game, a, ['autelVoeux']);
    state(game, a).deck = ['seigneurAbyssal'];
    playNow(game, a, 0, []);
    expect(game.player(a).hand).toEqual(['seigneurAbyssal']);
    expect(game.cardCost(a, getCard('seigneurAbyssal'))).toBe(0);
  });

  it('Transe de combat, Tombe précoce, Tactiques révisées, Tente des sœurs', () => {
    const { game, a } = newGame();
    readyToPlay(game, a, ['transeCombat', 'tombePrecoce', 'tactiquesRevisees', 'tenteSoeurs']);
    state(game, a).deck = ['soin', 'griffonLoyal', 'cerbere', 'traitFeu', 'benediction'];
    playNow(game, a, 0, [{ kind: 'card', zone: 'library', cardId: 'soin' }]);
    expect(game.player(a).deck.at(-1)).toBe('soin');
    playNow(game, a, 0, [{ kind: 'card', zone: 'library', cardId: 'griffonLoyal' }]);
    expect(game.player(a).grave).toContain('griffonLoyal');
    playNow(game, a, 0, ['cerbere', 'traitFeu', 'benediction'].map(cardId => ({ kind: 'card' as const, zone: 'library' as const, cardId })));
    expect(game.player(a).deck).toEqual([]);
    expect(game.player(a).hand).toEqual(['tenteSoeurs', 'soin']);
    playNow(game, a, 0, [{ kind: 'card', zone: 'grave', cardId: 'griffonLoyal' }]);
    expect(game.player(a).deck).toEqual(['griffonLoyal']);
  });

  it('Le sang de ma tribu, Armurerie orc, Savoir supérieur', () => {
    const { game, a } = newGame();
    readyToPlay(game, a, ['sangTribu', 'armurerieOrc', 'savoirSuperieur']);
    playNow(game, a, 0, []);
    game.destroyUnit(place(game, a, 'griffonLoyal', 0, 0).uid);
    expect(game.player(a).m).toBe(8);
    playNow(game, a, 0, []);
    playNow(game, a, 0, []);
    expect(game.player(a)).toMatchObject({ m: 11, g: 8, d: 8 });
  });

  it('Le dernier ordre de Seria : déploie une créature du cimetière pour un tour, puis la bannit', () => {
    const { game, a } = newGame();
    readyToPlay(game, a, ['dernierOrdreSeria']);
    state(game, a).grave = ['griffonLoyal'];
    playNow(game, a, 0, [{ kind: 'card', zone: 'grave', cardId: 'griffonLoyal' }, slot(0, 0)]);
    const griffin = game.player(a).board[0]![0]!;
    expect(game.whyNotAttack(a, griffin.uid)).toBeNull();
    game.endTurn(a);
    expect(game.locate(griffin.uid)).toBeNull();
    expect(game.player(a).grave).toEqual(['dernierOrdreSeria']);
  });

  it('Renégats, Mine d\'or, Débandade, Force du nombre, Jugement du Néant', () => {
    const { game, a, b } = newGame();
    state(game, a).maxRes = 4;
    state(game, b).maxRes = 4;
    readyToPlay(game, a, ['renegats', 'mineOr', 'debandade', 'forceNombre', 'jugementNeant']);
    playNow(game, a, 0, []);
    playNow(game, a, 0, []);
    expect([game.player(a).maxRes, game.player(b).maxRes]).toEqual([4, 3]);
    expect(game.whyNotPlay(a, 0)).toBe('Il faut avoir déployé 2 créatures ce tour-ci.');
    state(game, a).hp = 10;
    place(game, a, 'griffonLoyal', 0, 0);
    playNow(game, a, 1, []);
    expect(game.player(a).hp).toBe(11);
    state(game, b).grave = ['soin'];
    playNow(game, a, 1, []);
    expect([game.player(a).grave, game.player(b).grave]).toEqual([['jugementNeant'], []]);
  });

  it('Chambre de la démence : l\'adversaire qui joue le type choisi défausse une carte', () => {
    const { game, a, b } = newGame();
    readyToPlay(game, a, ['chambreDemence']);
    playNow(game, a, 0, [{ kind: 'mode', index: 1 }]);
    game.endTurn(a);
    readyToPlay(game, b, ['traitFeu', 'soin', 'soin']);
    place(game, a, 'griffonLoyal', 0, 0);
    playNow(game, b, 0, [{ kind: 'unit', uid: game.player(a).board[0]![0]!.uid }]);
    expect(game.player(b).hand).toHaveLength(1);
  });

  it('Consumer les serviteurs, Bénédiction d\'Elrath, Rite de restauration, Caverne oubliée, Salles de l\'inertie', () => {
    const { game, a } = newGame();
    const fodder = place(game, a, 'griffonLoyal', 0, 0);
    const hurt = place(game, a, 'seigneurAbyssal', 0, 1);
    hurt.hpCur = 2;
    readyToPlay(game, a, ['consumerServiteurs', 'benedictionElrath', 'riteRestauration', 'caverneOubliee', 'sallesInertie']);
    state(game, a).hp = 4;
    playNow(game, a, 0, [unit(fodder)]);
    expect(game.player(a).hp).toBe(7);
    expect(game.whyNotPlay(a, 0)).toBe('Votre héros doit avoir 5 PV ou moins.');
    const sacrificed = place(game, a, 'griffonLoyal', 0, 2);
    playNow(game, a, 1, [unit(sacrificed), unit(hurt)]);
    expect(hurt.hpCur).toBe(9);
    state(game, a).deck = ['soin', 'soin', 'soin'];
    playNow(game, a, 1, []);
    expect(game.player(a).deck).toHaveLength(1);
    playNow(game, a, 1, []);
    game.draw(a, 1);
    expect(game.player(a).deck).toHaveLength(1);
  });
});

describe('Héraut du vide — événements et héros', () => {
  it('Arbitres aveugles : 3 cartes par tour au plus', () => {
    const { game, a } = newGame();
    setEvents(game, ['blindArbiters', 'celebration']);
    readyToPlay(game, a, ['caverneOubliee', 'caverneOubliee', 'caverneOubliee', 'caverneOubliee'], 20);
    playNow(game, a, 0, []);
    playNow(game, a, 0, []);
    playNow(game, a, 0, []);
    expect(game.whyNotPlay(a, 0)).toBe('Vous ne pouvez pas jouer plus de 3 cartes par tour.');
  });

  it('Jour du Sanctuaire : la créature ne peut pas être ciblée jusqu\'à votre prochain tour', () => {
    const { game, a } = newGame();
    setEvents(game, ['dayOfSanctuary', 'celebration']);
    const griffin = place(game, a, 'griffonLoyal', 0, 0);
    state(game, a).res = 5;
    game.useEvent(a, 0, [unit(griffin)]);
    game.resolvePending();
    expect(game.isTargetable(griffin.uid)).toBe(false);
  });

  it('Alia soigne vos créatures, Zardoc donne Rapide et Charge, Noboru déplace une créature ennemie', () => {
    const alia = newGame(['alia', 'kalAzaar']);
    const hurt = place(alia.game, alia.a, 'griffonLoyal', 0, 0);
    hurt.hpCur = 1;
    readyToPlay(alia.game, alia.a, []);
    powerNow(alia.game, alia.a, []);
    expect(hurt.hpCur).toBe(4);

    const zardoc = newGame(['zardoc', 'kalAzaar']);
    const orc = place(zardoc.game, zardoc.a, 'orcCorrompu', 0, 0);
    readyToPlay(zardoc.game, zardoc.a, []);
    powerNow(zardoc.game, zardoc.a, [unit(orc)]);
    expect(zardoc.game.keywordsOf(orc)).toMatchObject({ swift: true, charge: true });
    zardoc.game.endTurn(zardoc.a);
    expect(zardoc.game.keywordsOf(orc).swift).toBeUndefined();

    const noboru = newGame(['noboru', 'kalAzaar']);
    const enemy = place(noboru.game, noboru.b, 'griffonLoyal', 0, 0);
    readyToPlay(noboru.game, noboru.a, []);
    powerNow(noboru.game, noboru.a, [unit(enemy), { kind: 'cell', player: noboru.b, row: 1, lane: 2 }]);
    expect(noboru.game.locate(enemy.uid)).toMatchObject({ row: 1, lane: 2 });
  });

  it('Adar-Malik : reprend une créature mise au cimetière depuis la fin de son dernier tour', () => {
    const { game, a } = newGame(['adarMalik', 'kalAzaar']);
    game.destroyUnit(place(game, a, 'griffonLoyal', 0, 0).uid);
    readyToPlay(game, a, []);
    powerNow(game, a, [{ kind: 'card', zone: 'grave', cardId: 'griffonLoyal' }]);
    expect(game.player(a).hand).toEqual(['griffonLoyal']);
  });
});
