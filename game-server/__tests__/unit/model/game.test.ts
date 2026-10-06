import { describe, expect, it } from 'vitest';
import { GameRuleError } from '../../../src/model/errors';
import { AI_PLAYER_NAME, Game, STARTING_HAND } from '../../../src/model/game';
import { DECKS, PLAYABLE_DECKS } from '../../../src/model/decks';
import { newGame, place, playNow, powerNow, readyToPlay, setEvents, slot, state, unit } from './helpers';

describe('Game — mise en place et ravitaillement', () => {
  it('chaque joueur pioche 6 cartes, puis le premier pioche au début de son tour', () => {
    const { game, a, b } = newGame();
    expect(game.player(a).hand).toHaveLength(STARTING_HAND + 1);
    expect(game.player(b).hand).toHaveLength(STARTING_HAND);
    expect(game.player(a).hp).toBe(20);
    expect(game.player(a).maxRes).toBe(1);
    expect(game.player(a).res).toBe(1);
    expect(game.phase).toBe('action');
    expect(game.turn).toBe(1);
  });

  it('les héros commencent avec leurs caractéristiques officielles', () => {
    const { game } = newGame(['siegfried', 'namtaru']);
    expect(game.player(0)).toMatchObject({ m: 2, g: 0, d: 1 });
    expect(game.player(1)).toMatchObject({ m: 0, g: 2, d: 1 });
  });

  it('est déterministe pour une même graine', () => {
    const g1 = newGame(['siegfried', 'kalAzaar'], 7).game;
    const g2 = newGame(['siegfried', 'kalAzaar'], 7).game;
    expect(g1.current).toBe(g2.current);
    expect(g1.player(0).hand).toEqual(g2.player(0).hand);
  });

  it('donne à l\'IA un deck d\'une autre faction que celui du joueur', () => {
    for (let seed = 0; seed < 20; seed++) {
      const game = Game.createAgainstAi({ id: 'g', seed, player: { id: 'p', deck: 'kaiko', accountId: 'acc', name: 'Joueur' } });
      expect(game.player(1).isAi).toBe(true);
      expect(game.player(1).faction).not.toBe('sanctuaire');
      expect(PLAYABLE_DECKS).toContain(game.player(1).deckId);
    }
  });

  it('chaque héros commence avec ses PV officiels', () => {
    const { game, a, b } = newGame(['kaiko', 'ishuma']);
    expect([game.player(a).hp, game.player(b).hp]).toEqual([18, 20]);
  });

  it('au tour suivant : production +1, ressources rechargées, une carte piochée', () => {
    const { game, a, b } = newGame();
    game.endTurn(a);
    expect(game.current).toBe(b);
    expect(game.player(b).maxRes).toBe(1);
    expect(game.player(b).hand).toHaveLength(STARTING_HAND + 1);
    game.endTurn(b);
    expect(game.player(a).maxRes).toBe(2);
    expect(game.player(a).res).toBe(2);
  });

  it('perd 1 PV par carte manquante quand la bibliothèque est vide', () => {
    const { game, a } = newGame();
    state(game, a).deck = [];
    game.draw(a, 3);
    expect(game.player(a).hp).toBe(game.player(a).maxHp - 3);
  });

  it('une copie simulée n\'affecte pas la partie d\'origine', () => {
    const { game, a, b } = newGame();
    const enemy = place(game, b, 'griffonLoyal', 0, 0);
    const copy = game.clone();
    copy.damageUnit(enemy.uid, 3, { magic: true });
    copy.endTurn(a);
    expect(enemy.hpCur).toBe(4);
    expect(game.current).toBe(a);
  });
});

describe('Game — action du héros', () => {
  it('augmente gratuitement la caractéristique choisie', () => {
    const { game, a } = newGame();
    const before = game.player(a).g;
    game.develop(a, 'g');
    expect(game.player(a).g).toBe(before + 1);
    expect(game.player(a).res).toBe(1);
  });

  it('peut piocher une carte à la place, pour 1 ressource', () => {
    const { game, a } = newGame();
    const before = game.player(a).hand.length;
    game.develop(a, 'draw');
    expect(game.player(a).hand).toHaveLength(before + 1);
    expect(game.player(a).res).toBe(0);
  });

  it('refuse de piocher sans ressource', () => {
    const { game, a } = newGame();
    state(game, a).res = 0;
    expect(game.whyNotDevelop(a, 'draw')).toBe('Piocher coûte 1 ressource.');
    expect(game.whyNotDevelop(a, 'm')).toBeNull();
  });

  it('n\'autorise qu\'une action du héros par tour, pouvoir compris', () => {
    const { game, a } = newGame(['siegfried', 'kalAzaar']);
    readyToPlay(game, a, []);
    game.develop(a, 'm');
    expect(() => game.develop(a, 'g')).toThrow('Votre héros a déjà agi ce tour-ci.');
    expect(game.whyNotPower(a)).toBe('Votre héros a déjà agi ce tour-ci.');
  });

  it('Kal-Azaar : défaussez une carte pour infliger 2 dégâts à une créature ; cela compte comme l\'action du héros', () => {
    const { game, a, b } = newGame(['kalAzaar', 'siegfried']);
    readyToPlay(game, a, ['traitFeu', 'bouleFeu']);
    const enemy = place(game, b, 'griffonLoyal', 0, 0);
    powerNow(game, a, [{ kind: 'hand', index: 0 }, unit(enemy)]);
    expect(enemy.hpCur).toBe(2);
    expect(game.player(a).hand).toEqual(['bouleFeu']);
    expect(game.player(a).grave).toEqual(['traitFeu']);
    expect(() => game.develop(a, 'm')).toThrow('Votre héros a déjà agi ce tour-ci.');
  });

  it('un pouvoir qui demande de défausser est impossible main vide', () => {
    const { game, a, b } = newGame(['kalAzaar', 'siegfried']);
    readyToPlay(game, a, []);
    place(game, b, 'griffonLoyal', 0, 0);
    expect(game.whyNotPower(a)).toBe('Aucune carte à choisir dans votre main.');
  });

  it('Mère Namtaru : détruit une créature ennemie coûtant 2 ou moins', () => {
    const { game, a, b } = newGame(['namtaru', 'siegfried']);
    readyToPlay(game, a, ['faiblesse']);
    const cheap = place(game, b, 'griffonLoyal', 0, 0);
    place(game, b, 'cavalierSolaire', 0, 1);
    expect(game.powerSteps(a)[1]!.options).toEqual([unit(cheap)]);
    powerNow(game, a, [{ kind: 'hand', index: 0 }, unit(cheap)]);
    expect(game.locate(cheap.uid)).toBeNull();
  });

  it('Siegfried : les créatures de mêlée déployées ce tour-ci gagnent +1 PV', () => {
    const { game, a, b } = newGame(['siegfried', 'kalAzaar']);
    readyToPlay(game, a, ['ecuyerElite', 'griffonLoyal', 'ecuyerElite']);
    powerNow(game, a, []);
    playNow(game, a, 0, [slot(0, 0)]);
    playNow(game, a, 0, [slot(1, 0)]);
    expect(game.player(a).board[0]![0]).toMatchObject({ hpCur: 4, hpMax: 4 });
    expect(game.player(a).board[1]![0]).toMatchObject({ hpCur: 4, hpMax: 4 });
    game.endTurn(a);
    game.endTurn(b);
    readyToPlay(game, a, ['ecuyerElite']);
    playNow(game, a, 0, [slot(0, 1)]);
    expect(game.player(a).board[0]![1]!.hpMax).toBe(3);
  });

  it('refuse d\'agir hors de son tour', () => {
    const { game, b } = newGame();
    expect(() => game.develop(b, 'm')).toThrow(GameRuleError);
  });
});

describe('Game — déploiement', () => {
  it('déploie une créature et dépense les ressources', () => {
    const { game, a } = newGame();
    readyToPlay(game, a, ['cavalierSolaire'], 6);
    playNow(game, a, 0, [slot(0, 2)]);
    expect(game.player(a).board[0]![2]?.cardId).toBe('cavalierSolaire');
    expect(game.player(a).res).toBe(3);
    expect(game.player(a).hand).toEqual([]);
  });

  it('la mêlée ne se déploie que sur la ligne avant, les tireurs que sur la ligne arrière', () => {
    const { game, a } = newGame();
    readyToPlay(game, a, ['ecuyerElite', 'arbaletrierImperial']);
    expect(game.playSteps(a, 0)[0]!.options.every(t => t.kind === 'slot' && t.row === 0)).toBe(true);
    expect(game.playSteps(a, 1)[0]!.options.every(t => t.kind === 'slot' && t.row === 1)).toBe(true);
    expect(() => game.playCard(a, 0, [slot(1, 0)])).toThrow('Choisissez un emplacement autorisé.');
    expect(() => game.playCard(a, 1, [slot(0, 0)])).toThrow('Choisissez un emplacement autorisé.');
  });

  it('un volant se déploie sur l\'une ou l\'autre ligne', () => {
    const { game, a } = newGame();
    readyToPlay(game, a, ['griffonLoyal']);
    expect(game.playSteps(a, 0)[0]!.options).toHaveLength(8);
  });

  it('refuse une créature de mêlée quand la ligne avant est pleine', () => {
    const { game, a } = newGame();
    for (let lane = 0; lane < 4; lane++) place(game, a, 'ecuyerElite', 0, lane);
    readyToPlay(game, a, ['ecuyerElite']);
    expect(game.whyNotPlay(a, 0)).toBe('Aucun emplacement libre sur la ligne avant.');
  });

  it('refuse une carte trop chère', () => {
    const { game, a } = newGame();
    readyToPlay(game, a, ['cavalierSolaire'], 2);
    expect(() => game.playCard(a, 0, [slot(0, 0)])).toThrow('Pas assez de ressources.');
  });

  it('refuse une carte dont la condition de caractéristique n\'est pas remplie', () => {
    const { game, a } = newGame();
    readyToPlay(game, a, ['paroleLumiere']);
    state(game, a).g = 3;
    expect(game.whyNotPlay(a, 0)).toBe('Il faut Magie 4.');
  });

  it('Empilable : une créature se déploie sur une autre du même nom et multiplie ses caractéristiques', () => {
    const { game, a } = newGame();
    const base = place(game, a, 'arbaletrierImperial', 1, 0);
    readyToPlay(game, a, ['arbaletrierImperial']);
    expect(game.playSteps(a, 0)[0]!.options).toContainEqual(slot(1, 0));
    playNow(game, a, 0, [slot(1, 0)]);
    expect(game.player(a).board[1]![0]).toBe(base);
    expect(base).toMatchObject({ stack: 2, atk: 2, ret: 0, hpCur: 4, hpMax: 4 });
  });

  it('une pile détruite envoie toutes ses cartes au cimetière', () => {
    const { game, a } = newGame();
    const stack = place(game, a, 'sentinelleImperiale', 0, 0);
    stack.stack = 2;
    game.destroyUnit(stack.uid);
    expect(game.player(a).grave).toEqual(['sentinelleImperiale', 'sentinelleImperiale']);
  });

  it('Diablotin du chaos : chaque carte jouée par l\'adversaire lui fait défausser une carte', () => {
    const { game, a, b } = newGame(['siegfried', 'kalAzaar']);
    place(game, b, 'diablotinChaos', 1, 0);
    readyToPlay(game, a, ['griffonLoyal', 'soin', 'benediction']);
    game.playCard(a, 0, [slot(0, 0)]);
    expect(game.player(a).hand).toHaveLength(1);
    expect(game.player(a).grave).toHaveLength(1);
  });
});

describe('Game — sorts et fortunes', () => {
  it('applique un sort ciblé et le place au cimetière', () => {
    const { game, a, b } = newGame();
    const enemy = place(game, b, 'gouleMiserable', 0, 1);
    readyToPlay(game, a, ['traitFeu']);
    playNow(game, a, 0, [unit(enemy)]);
    expect(game.locate(enemy.uid)).toBeNull();
    expect(game.player(b).grave).toContain('gouleMiserable');
    expect(game.player(a).grave).toContain('traitFeu');
  });

  it('refuse un choix invalide, et une carte sans cible possible', () => {
    const { game, a, b } = newGame();
    readyToPlay(game, a, ['traitFeu']);
    expect(game.whyNotPlay(a, 0)).toBe('Aucune cible valide.');
    place(game, b, 'gouleMiserable', 0, 1);
    expect(() => game.playCard(a, 0, [{ kind: 'hero', player: b }])).toThrow('Choix invalide.');
    expect(() => game.playCard(a, 0, [])).toThrow('Choix invalide.');
  });

  it('Parole de lumière : 2 dégâts à toutes les créatures ennemies', () => {
    const { game, a, b } = newGame();
    const e1 = place(game, b, 'griffonLoyal', 0, 0);
    const e2 = place(game, b, 'succube', 1, 3);
    const ally = place(game, a, 'griffonLoyal', 0, 0);
    readyToPlay(game, a, ['paroleLumiere']);
    playNow(game, a, 0, []);
    expect([e1.hpCur, e2.hpCur, ally.hpCur]).toEqual([2, 2, 4]);
  });

  it('Boule de feu : 4 dégâts à la cible et aux créatures adjacentes', () => {
    const { game, a, b } = newGame(['kalAzaar', 'siegfried']);
    const center = place(game, b, 'seigneurAbyssal', 0, 1);
    const left = place(game, b, 'seigneurAbyssal', 0, 0);
    const behind = place(game, b, 'seigneurAbyssal', 1, 1);
    const diagonal = place(game, b, 'seigneurAbyssal', 1, 2);
    readyToPlay(game, a, ['bouleFeu']);
    playNow(game, a, 0, [unit(center)]);
    expect([center.hpCur, left.hpCur, behind.hpCur, diagonal.hpCur]).toEqual([5, 5, 5, 9]);
  });

  it('Tempête de feu : 4 dégâts à toutes les créatures de la ligne ciblée', () => {
    const { game, a, b } = newGame(['kalAzaar', 'siegfried']);
    const front = place(game, b, 'seigneurAbyssal', 0, 0);
    const front2 = place(game, b, 'seigneurAbyssal', 0, 3);
    const back = place(game, b, 'seigneurAbyssal', 1, 0);
    readyToPlay(game, a, ['tempeteFeu']);
    playNow(game, a, 0, [{ kind: 'line', player: b, row: 0 }]);
    expect([front.hpCur, front2.hpCur, back.hpCur]).toEqual([5, 5, 9]);
  });

  it('Frénésie : une créature inflige son attaque à une autre', () => {
    const { game, a, b } = newGame(['kalAzaar', 'siegfried']);
    const source = place(game, a, 'seigneurAbyssal', 0, 0);
    const target = place(game, b, 'griffonLoyal', 0, 0);
    readyToPlay(game, a, ['frenesie']);
    expect(() => game.playCard(a, 0, [unit(source), unit(source)])).toThrow('Choix invalide.');
    playNow(game, a, 0, [unit(source), unit(target)]);
    expect(game.locate(target.uid)).toBeNull();
    expect(source.hpCur).toBe(9);
  });

  it('Bénédiction : +2 en attaque, et le sort rejoint le cimetière quand la créature meurt', () => {
    const { game, a } = newGame();
    const ally = place(game, a, 'griffonLoyal', 0, 0);
    readyToPlay(game, a, ['benediction']);
    playNow(game, a, 0, [unit(ally)]);
    expect(game.attackOf(ally)).toBe(4);
    expect(ally.enchantments).toEqual([{ cardId: 'benediction', owner: a, atk: 2, ret: 0, hp: 0, keywords: {} }]);
    expect(game.player(a).grave).toEqual([]);
    game.destroyUnit(ally.uid);
    expect(game.player(a).grave).toEqual(['griffonLoyal', 'benediction']);
  });

  it('Faiblesse : -2 en attaque et en riposte, sans descendre sous 0', () => {
    const { game, a, b } = newGame(['namtaru', 'siegfried']);
    const enemy = place(game, b, 'griffonLoyal', 0, 0);
    readyToPlay(game, a, ['faiblesse']);
    playNow(game, a, 0, [unit(enemy)]);
    expect([game.attackOf(enemy), game.retaliationOf(enemy)]).toEqual([0, 0]);
  });

  it('Étreinte vampirique : la créature gagne Drain de vie 2', () => {
    const { game, a } = newGame(['namtaru', 'siegfried']);
    const ally = place(game, a, 'gouleMiserable', 0, 0);
    readyToPlay(game, a, ['etreinteVampirique']);
    playNow(game, a, 0, [unit(ally)]);
    expect(game.keywordsOf(ally).lifeDrain).toBe(2);
  });

  it('Appel du devoir : cherche une créature dans la bibliothèque', () => {
    const { game, a } = newGame();
    readyToPlay(game, a, ['appelDevoir']);
    state(game, a).deck = ['soin', 'griffonLoyal', 'cavalierSolaire', 'griffonLoyal'];
    expect(game.playSteps(a, 0)[0]!.options).toEqual([
      { kind: 'card', zone: 'library', cardId: 'cavalierSolaire' },
      { kind: 'card', zone: 'library', cardId: 'griffonLoyal' },
    ]);
    playNow(game, a, 0, [{ kind: 'card', zone: 'library', cardId: 'cavalierSolaire' }]);
    expect(game.player(a).hand).toEqual(['cavalierSolaire']);
    expect([...game.player(a).deck].sort()).toEqual(['griffonLoyal', 'griffonLoyal', 'soin']);
  });

  it('Avant-poste fortifié : gagner 4 ressources n\'est possible qu\'en infériorité numérique', () => {
    const { game, a, b } = newGame();
    readyToPlay(game, a, ['avantPoste'], 2);
    expect(game.playSteps(a, 0)[0]!.options).toEqual([{ kind: 'mode', index: 0 }]);
    place(game, b, 'griffonLoyal', 0, 0);
    expect(game.playSteps(a, 0)[0]!.options).toHaveLength(2);
    playNow(game, a, 0, [{ kind: 'mode', index: 1 }]);
    expect(game.player(a).res).toBe(4);
  });

  it('Fosse commune : remet une carte sur la bibliothèque et détruit une créature coûtant 2 ou moins', () => {
    const { game, a, b } = newGame(['namtaru', 'siegfried']);
    const cheap = place(game, b, 'griffonLoyal', 0, 0);
    const dear = place(game, b, 'cavalierSolaire', 0, 1);
    readyToPlay(game, a, ['fosseCommune', 'faiblesse']);
    expect(game.playSteps(a, 0)[1]!.options).toEqual([unit(cheap)]);
    playNow(game, a, 0, [{ kind: 'hand', index: 1 }, unit(cheap)]);
    expect(game.locate(cheap.uid)).toBeNull();
    expect(game.locate(dear.uid)).not.toBeNull();
    expect(game.player(a).hand).toEqual([]);
    expect(game.player(a).deck.at(-1)).toBe('faiblesse');
  });

  it('Ruines shantiri : défausse un sort et en reprend un du cimetière', () => {
    const { game, a } = newGame(['namtaru', 'siegfried']);
    readyToPlay(game, a, ['ruinesShantiri', 'gouleMiserable', 'faiblesse']);
    state(game, a).grave = ['maledictionNeant'];
    expect(game.playSteps(a, 0)[0]!.options).toEqual([{ kind: 'hand', index: 2 }]);
    playNow(game, a, 0, [{ kind: 'hand', index: 2 }, { kind: 'card', zone: 'grave', cardId: 'maledictionNeant' }]);
    expect(game.player(a).hand).toEqual(['gouleMiserable', 'maledictionNeant']);
    expect(game.player(a).grave).toEqual(['faiblesse', 'ruinesShantiri']);
  });

  it('Autel de destruction : remet une carte sur la bibliothèque et inflige 2 dégâts au héros ennemi', () => {
    const { game, a, b } = newGame(['kalAzaar', 'siegfried']);
    readyToPlay(game, a, ['traitFeu', 'autelDestruction']);
    playNow(game, a, 1, [{ kind: 'hand', index: 0 }]);
    expect(game.player(b).hp).toBe(game.player(b).maxHp - 2);
    expect(game.player(a).deck.at(-1)).toBe('traitFeu');
  });

  it('Malédiction du Néant : 3 dégâts aux ennemis, soigne 3 aux alliés', () => {
    const { game, a, b } = newGame(['namtaru', 'siegfried']);
    const enemy = place(game, b, 'cavalierSolaire', 0, 0);
    const ally = place(game, a, 'chevalierVampire', 0, 0);
    ally.hpCur = 1;
    readyToPlay(game, a, ['maledictionNeant']);
    playNow(game, a, 0, []);
    expect([enemy.hpCur, ally.hpCur]).toEqual([2, 4]);
  });
});

describe('Game — révélation d\'une carte jouée', () => {
  it('une carte jouée est payée et révélée, mais résolue seulement ensuite', () => {
    const { game, a, b } = newGame();
    const enemy = place(game, b, 'gouleMiserable', 0, 1);
    readyToPlay(game, a, ['traitFeu'], 5);
    game.playCard(a, 0, [unit(enemy)]);
    expect(game.pending).toEqual({ kind: 'card', player: a, cardId: 'traitFeu', choices: [unit(enemy)], taken: [] });
    expect(game.player(a).res).toBe(4);
    expect(game.player(a).hand).toEqual([]);
    expect(game.locate(enemy.uid)).not.toBeNull();
    game.resolvePending();
    expect(game.pending).toBeNull();
    expect(game.locate(enemy.uid)).toBeNull();
    expect(game.player(a).grave).toEqual(['traitFeu']);
  });

  it('une créature jouée n\'apparaît sur le plateau qu\'à la résolution', () => {
    const { game, a } = newGame();
    readyToPlay(game, a, ['ecuyerElite']);
    game.playCard(a, 0, [slot(0, 3)]);
    expect(game.player(a).board[0]![3]).toBeNull();
    game.resolvePending();
    expect(game.player(a).board[0]![3]?.cardId).toBe('ecuyerElite');
  });

  it('bloque toute autre action tant que la carte n\'est pas résolue', () => {
    const { game, a } = newGame();
    readyToPlay(game, a, ['ecuyerElite', 'ecuyerElite']);
    game.playCard(a, 0, [slot(0, 0)]);
    expect(game.whyNotPlay(a, 0)).toBe('Une carte est en cours de résolution.');
    expect(() => game.endTurn(a)).toThrow('Une carte est en cours de résolution.');
    expect(() => game.develop(a, 'm')).toThrow('Une carte est en cours de résolution.');
  });

  it('le pouvoir du héros est payé et révélé, puis résolu seulement ensuite', () => {
    const { game, a, b } = newGame(['kalAzaar', 'siegfried']);
    readyToPlay(game, a, ['traitFeu']);
    const enemy = place(game, b, 'griffonLoyal', 0, 0);
    game.usePower(a, [{ kind: 'hand', index: 0 }, unit(enemy)]);
    expect(game.pending).toEqual({ kind: 'power', player: a, choices: [{ kind: 'hand', index: 0 }, unit(enemy)], taken: ['traitFeu'] });
    expect(game.player(a).hand).toEqual([]);
    expect(game.player(a).heroActionUsed).toBe(true);
    expect(enemy.hpCur).toBe(4);
    expect(game.whyNotPlay(a, 0)).toBe('Un pouvoir est en cours de résolution.');
    game.resolvePending();
    expect(enemy.hpCur).toBe(2);
    expect(game.player(a).grave).toEqual(['traitFeu']);
  });

  it('refuse de résoudre quand aucune carte n\'est en attente', () => {
    const { game } = newGame();
    expect(() => game.resolvePending()).toThrow('Aucune carte à résoudre.');
  });

  it('abandonner pendant la révélation annule la carte', () => {
    const { game, a } = newGame();
    readyToPlay(game, a, ['ecuyerElite']);
    game.playCard(a, 0, [slot(0, 0)]);
    game.leave(a);
    expect(game.pending).toBeNull();
    expect(game.player(a).board[0]![0]).toBeNull();
  });
});

describe('Game — attaques', () => {
  it('une créature fraîchement déployée ne peut ni attaquer ni se déplacer', () => {
    const { game, a } = newGame();
    readyToPlay(game, a, ['ecuyerElite']);
    playNow(game, a, 0, [slot(0, 0)]);
    const uid = game.player(a).board[0]![0]!.uid;
    expect(game.whyNotAttack(a, uid)).toBe('Une créature ne peut pas agir le tour de son déploiement.');
    expect(game.moveDestinations(a, uid)).toEqual([]);
  });

  it('l\'attaque est choisie par le joueur, et le défenseur qui survit riposte', () => {
    const { game, a, b } = newGame();
    const attacker = place(game, a, 'gouleMiserable', 0, 0); // 2/1/2
    const defender = place(game, b, 'griffonLoyal', 0, 0); // 2/1/4
    game.attack(a, attacker.uid, unit(defender));
    expect(defender.hpCur).toBe(2);
    expect(attacker.hpCur).toBe(2); // la riposte est une étape à part
    expect(game.hasPendingRetaliation).toBe(true);
    game.resolveRetaliation();
    expect(attacker.hpCur).toBe(1);
    expect(() => game.attack(a, attacker.uid, { kind: 'unit', uid: defender.uid })).toThrow('Cette créature a déjà agi ce tour-ci.');
  });

  it('un défenseur détruit ne riposte pas', () => {
    const { game, a, b } = newGame();
    const attacker = place(game, a, 'seigneurAbyssal', 0, 0); // 5/4/9
    const defender = place(game, b, 'griffonLoyal', 0, 0); // 2/1/4
    game.attack(a, attacker.uid, { kind: 'unit', uid: defender.uid });
    expect(game.locate(defender.uid)).toBeNull();
    expect(game.hasPendingRetaliation).toBe(false);
    expect(attacker.hpCur).toBe(9);
  });

  it('la riposte est diffusée comme un événement, même quand elle détruit l\'attaquant', () => {
    const { game, a, b } = newGame();
    const attacker = place(game, a, 'gouleMiserable', 0, 0); // 2/1/2
    const defender = place(game, b, 'ecuyerElite', 0, 0); // 1/2/3
    game.attack(a, attacker.uid, { kind: 'unit', uid: defender.uid });
    expect(game.drainEvents()).toEqual([
      { kind: 'attack', attacker: attacker.uid, target: { kind: 'unit', uid: defender.uid } },
      { kind: 'damage', target: { kind: 'unit', uid: defender.uid }, amount: 2 },
    ]);
    game.resolveRetaliation();
    expect(game.drainEvents()).toEqual([
      { kind: 'retaliate', attacker: defender.uid, target: { kind: 'unit', uid: attacker.uid } },
      { kind: 'damage', target: { kind: 'unit', uid: attacker.uid }, amount: 2 },
    ]);
    expect(game.locate(attacker.uid)).toBeNull();
  });

  it('bloque toute action tant que la riposte n\'est pas résolue', () => {
    const { game, a, b } = newGame();
    const attacker = place(game, a, 'gouleMiserable', 0, 0);
    const other = place(game, a, 'gouleMiserable', 0, 1);
    const defender = place(game, b, 'griffonLoyal', 0, 0);
    game.attack(a, attacker.uid, { kind: 'unit', uid: defender.uid });
    expect(game.whyNotAttack(a, other.uid)).toBe('Une riposte est en cours.');
    expect(() => game.endTurn(a)).toThrow('Une riposte est en cours.');
    game.resolveRetaliation();
    expect(() => game.resolveRetaliation()).toThrow('Aucune riposte à résoudre.');
    expect(game.whyNotAttack(a, other.uid)).toBeNull();
  });

  it('Immunisé contre la riposte : aucune riposte n\'est subie', () => {
    const { game, a, b } = newGame();
    const rider = place(game, a, 'cavalierSolaire', 0, 0); // 2/1/5
    place(game, b, 'griffonLoyal', 0, 0);
    game.attack(a, rider.uid, game.attackTargets(a, rider.uid)[0]!);
    expect(game.hasPendingRetaliation).toBe(false);
    expect(rider.hpCur).toBe(5);
  });

  it('la mêlée et les volants frappent la ligne avant, les tireurs choisissent', () => {
    const { game, a, b } = newGame();
    const melee = place(game, a, 'gouleMiserable', 0, 2);
    const flyer = place(game, a, 'griffonLoyal', 1, 2);
    const shooter = place(game, a, 'arbaletrierImperial', 1, 3);
    const front = place(game, b, 'gouleMiserable', 0, 2);
    place(game, b, 'succube', 1, 2);
    const front3 = place(game, b, 'gouleMiserable', 0, 3);
    const back3 = place(game, b, 'succube', 1, 3);
    expect(game.attackTargets(a, melee.uid)).toEqual([unit(front)]);
    expect(game.attackTargets(a, flyer.uid)).toEqual([unit(front)]);
    expect(game.attackTargets(a, shooter.uid)).toEqual([unit(front3), unit(back3)]);
  });

  it('la mêlée atteint la ligne arrière quand la ligne avant du couloir est vide', () => {
    const { game, a, b } = newGame();
    const melee = place(game, a, 'gouleMiserable', 0, 0);
    const back = place(game, b, 'succube', 1, 0);
    expect(game.attackTargets(a, melee.uid)).toEqual([unit(back)]);
  });

  it('frappe le héros seulement quand le couloir adverse est vide', () => {
    const { game, a, b } = newGame();
    const shooter = place(game, a, 'arbaletrierImperial', 1, 2);
    expect(game.attackTargets(a, shooter.uid)).toEqual([{ kind: 'hero', player: b }]);
    game.attack(a, shooter.uid, { kind: 'hero', player: b });
    expect(game.player(b).hp).toBe(game.player(b).maxHp - 1);
  });

  it('refuse une cible hors du couloir', () => {
    const { game, a, b } = newGame();
    const melee = place(game, a, 'gouleMiserable', 0, 0);
    const other = place(game, b, 'gouleMiserable', 0, 1);
    expect(() => game.attack(a, melee.uid, { kind: 'unit', uid: other.uid })).toThrow('Cette cible est hors de portée.');
  });

  it('termine la partie quand un héros tombe à 0 PV', () => {
    const { game, a, b } = newGame();
    state(game, b).hp = 1;
    const shooter = place(game, a, 'arbaletrierImperial', 1, 0);
    game.apply(a, { type: 'attack', uid: shooter.uid, target: { kind: 'hero', player: b } });
    expect(game.drainEvents()).toEqual([
      { kind: 'attack', attacker: shooter.uid, target: { kind: 'hero', player: b } },
      { kind: 'damage', target: { kind: 'hero', player: b }, amount: 1 },
    ]);
    expect(game.isOver).toBe(true);
    expect(game.winner).toBe(a);
  });

  it('les créatures peuvent de nouveau agir au tour suivant de leur propriétaire', () => {
    const { game, a, b } = newGame();
    const shooter = place(game, a, 'arbaletrierImperial', 1, 0);
    game.attack(a, shooter.uid, { kind: 'hero', player: b });
    game.endTurn(a);
    game.endTurn(b);
    expect(game.whyNotAttack(a, shooter.uid)).toBeNull();
  });
});

describe('Game — capacités de combat', () => {
  it('Drain de vie : soigne l\'attaquant quand il inflige des dégâts d\'attaque', () => {
    const { game, a, b } = newGame(['namtaru', 'siegfried']);
    const knight = place(game, a, 'chevalierVampire', 0, 0); // 2/0/5
    knight.hpCur = 2;
    place(game, b, 'griffonLoyal', 0, 0);
    game.attack(a, knight.uid, game.attackTargets(a, knight.uid)[0]!);
    expect(knight.hpCur).toBe(4);
  });

  it('Garde distance : protège la créature et ses voisines', () => {
    const { game, a, b } = newGame();
    const squire = place(game, b, 'ecuyerElite', 0, 1); // garde 2 contre les tireurs
    const neighbour = place(game, b, 'griffonLoyal', 0, 2);
    const lich = place(game, a, 'licheNeophyte', 1, 2); // tireur 2 attaque
    const ghoul = place(game, a, 'gouleMiserable', 0, 1); // mêlée 2 attaque
    game.attack(a, lich.uid, unit(neighbour));
    expect(neighbour.hpCur).toBe(4);
    game.attack(a, ghoul.uid, { kind: 'unit', uid: squire.uid });
    expect(squire.hpCur).toBe(1);
  });

  it('Garde mêlée : réduit l\'attaque et la riposte des créatures de mêlée', () => {
    const { game, a, b } = newGame();
    const sentinel = place(game, b, 'sentinelleImperiale', 0, 1); // 1/1/2, garde 1 contre la mêlée
    const ghoul = place(game, a, 'gouleMiserable', 0, 1); // 2/1/2
    game.attack(a, ghoul.uid, { kind: 'unit', uid: sentinel.uid });
    expect(sentinel.hpCur).toBe(1);
    game.resolveRetaliation();
    expect(ghoul.hpCur).toBe(1);
  });

  it('Intangible : les dégâts non magiques sont divisés par deux', () => {
    const { game, a, b } = newGame(['siegfried', 'namtaru']);
    const ghost = place(game, b, 'fantomeErrant', 0, 0); // 2/1/3
    const ghoul = place(game, a, 'gouleMiserable', 0, 0);
    game.attack(a, ghoul.uid, { kind: 'unit', uid: ghost.uid });
    expect(ghost.hpCur).toBe(2);
    game.resolveRetaliation();
    game.damageUnit(ghost.uid, 2, { magic: true });
    expect(game.locate(ghost.uid)).toBeNull();
  });

  it('Charge : attaque aussi l\'autre créature du couloir', () => {
    const { game, a, b } = newGame();
    const rider = place(game, a, 'cavalierSolaire', 0, 0); // 2 attaque
    const front = place(game, b, 'seigneurAbyssal', 0, 0);
    const back = place(game, b, 'seigneurAbyssal', 1, 0);
    const aside = place(game, b, 'seigneurAbyssal', 0, 1);
    game.attack(a, rider.uid, { kind: 'unit', uid: front.uid });
    expect([front.hpCur, back.hpCur, aside.hpCur]).toEqual([7, 7, 9]);
  });

  it('Attaque en balayage : attaque aussi les voisines de la cible sur sa ligne', () => {
    const { game, a, b } = newGame(['kalAzaar', 'siegfried']);
    const hound = place(game, a, 'cerbere', 0, 1); // 3 attaque
    const target = place(game, b, 'seigneurAbyssal', 0, 1);
    const left = place(game, b, 'seigneurAbyssal', 0, 0);
    const right = place(game, b, 'seigneurAbyssal', 0, 2);
    const behind = place(game, b, 'seigneurAbyssal', 1, 1);
    game.attack(a, hound.uid, { kind: 'unit', uid: target.uid });
    expect([target.hpCur, left.hpCur, right.hpCur, behind.hpCur]).toEqual([6, 6, 6, 9]);
  });

  it('Explosion : inflige des dégâts aux créatures adjacentes à la cible', () => {
    const { game, a, b } = newGame(['kalAzaar', 'siegfried']);
    const tormentor = place(game, a, 'tourmenteur', 0, 1); // 2 attaque, explosion 2
    const target = place(game, b, 'seigneurAbyssal', 0, 1);
    const behind = place(game, b, 'seigneurAbyssal', 1, 1);
    const far = place(game, b, 'seigneurAbyssal', 0, 3);
    game.attack(a, tormentor.uid, { kind: 'unit', uid: target.uid });
    expect([target.hpCur, behind.hpCur, far.hpCur]).toEqual([7, 7, 9]);
  });

  it('Ubiquité : toute créature ennemie, le héros seulement si son couloir est vide', () => {
    const { game, a, b } = newGame(['kalAzaar', 'siegfried']);
    const lord = place(game, a, 'seigneurAbyssal', 0, 0);
    const far = place(game, b, 'griffonLoyal', 1, 3);
    expect(game.attackTargets(a, lord.uid)).toEqual([unit(far), { kind: 'hero', player: b }]);
    const facing = place(game, b, 'gouleMiserable', 0, 0);
    expect(game.attackTargets(a, lord.uid)).toEqual([unit(facing), unit(far)]);
  });

  it('Séraphin guerrier : les créatures ennemies doivent l\'attaquer si elles le peuvent', () => {
    const { game, a, b } = newGame(['kalAzaar', 'siegfried']);
    const shooter = place(game, a, 'succube', 1, 0);
    const lord = place(game, a, 'seigneurAbyssal', 0, 2);
    place(game, b, 'gouleMiserable', 0, 0);
    const seraph = place(game, b, 'seraphinGuerrier', 1, 0);
    expect(game.attackTargets(a, shooter.uid)).toEqual([unit(seraph)]);
    expect(game.attackTargets(a, lord.uid)).toEqual([unit(seraph)]);
  });

  it('Infection : les dégâts d\'attaque posent du poison, qui blesse au ravitaillement', () => {
    const { game, a, b } = newGame(['namtaru', 'siegfried']);
    const plague = place(game, a, 'squelettePestifere', 1, 0); // 1 attaque, infection 1
    const target = place(game, b, 'griffonLoyal', 0, 0);
    game.attack(a, plague.uid, { kind: 'unit', uid: target.uid });
    expect(target).toMatchObject({ hpCur: 3, poison: 1 });
    game.endTurn(a);
    expect(target.hpCur).toBe(2);
  });
});

describe('Game — capacités de ravitaillement et de fin de tour', () => {
  it('Soin : au ravitaillement, soigne les créatures alliées adjacentes', () => {
    const { game, a, b } = newGame();
    place(game, a, 'soeurDevouee', 1, 1);
    const near = place(game, a, 'griffonLoyal', 0, 1);
    const far = place(game, a, 'griffonLoyal', 0, 3);
    near.hpCur = 1;
    far.hpCur = 1;
    game.endTurn(a);
    game.endTurn(b);
    expect([near.hpCur, far.hpCur]).toEqual([3, 1]);
  });

  it('Régénération : au ravitaillement, la créature se soigne', () => {
    const { game, a, b } = newGame();
    const seraph = place(game, a, 'seraphinGuerrier', 0, 0);
    seraph.hpCur = 2;
    game.endTurn(a);
    game.endTurn(b);
    expect(seraph.hpCur).toBe(4);
  });

  it('Rétablissement : en fin de tour, soigne toutes les blessures si la créature n\'a pas attaqué', () => {
    const { game, a, b } = newGame();
    const resting = place(game, a, 'vestale', 1, 0);
    const fighting = place(game, a, 'vestale', 1, 1);
    resting.hpCur = 1;
    fighting.hpCur = 1;
    game.attack(a, fighting.uid, { kind: 'hero', player: b });
    game.endTurn(a);
    expect([resting.hpCur, fighting.hpCur]).toEqual([7, 1]);
  });
});

describe('Game — déplacements', () => {
  it('se déplace gratuitement vers une case adjacente, à la place de l\'attaque', () => {
    const { game, a } = newGame();
    const u = place(game, a, 'gouleMiserable', 0, 0);
    readyToPlay(game, a, [], 3);
    game.moveUnit(a, u.uid, { row: 0, lane: 1 });
    expect(game.player(a).board[0]![1]).toBe(u);
    expect(game.player(a).res).toBe(3);
    expect(game.whyNotAttack(a, u.uid)).toBe('Cette créature a déjà agi ce tour-ci.');
    expect(game.attackTargets(a, u.uid)).toEqual([]);
  });

  it('ne peut pas se déplacer après avoir attaqué', () => {
    const { game, a, b } = newGame();
    const u = place(game, a, 'gouleMiserable', 0, 0);
    game.attack(a, u.uid, { kind: 'hero', player: b });
    expect(() => game.moveUnit(a, u.uid, { row: 0, lane: 1 })).toThrow('Cette créature a déjà agi ce tour-ci.');
  });

  it('respecte la ligne autorisée : la mêlée ne recule pas', () => {
    const { game, a } = newGame();
    const melee = place(game, a, 'gouleMiserable', 0, 1);
    const flyer = place(game, a, 'griffonLoyal', 0, 3);
    expect(game.moveDestinations(a, melee.uid)).toEqual([{ row: 0, lane: 0 }, { row: 0, lane: 2 }]);
    expect(game.moveDestinations(a, flyer.uid)).toEqual([{ row: 0, lane: 2 }, { row: 1, lane: 3 }]);
    expect(() => game.moveUnit(a, melee.uid, { row: 1, lane: 1 })).toThrow('Choisissez une case adjacente libre et autorisée.');
  });
});

describe('Game — abandon et événements', () => {
  it('un joueur qui quitte une partie en cours l\'abandonne', () => {
    const { game, a, b } = newGame();
    game.leave(a);
    expect(game.isOver).toBe(true);
    expect(game.winner).toBe(b);
    expect(game.indexOf('p' + a)).toBeNull();
    expect(game.isAbandoned).toBe(false);
    game.leave(b);
    expect(game.isAbandoned).toBe(true);
  });

  it('décrit l\'issue d\'une partie classée une fois terminée', () => {
    const { game, a } = newGame();
    expect(game.outcome()).toBeNull();
    game.leave(a);
    expect(game.outcome()).toEqual({ gameId: 'g1', mode: 'pvp', winnerId: 'acc1', loserId: 'acc0' });
  });

  it('décrit l\'issue d\'une partie contre l\'IA pour le joueur', () => {
    const game = Game.createAgainstAi({ id: 'g', seed: 1, player: { id: 'p', deck: 'siegfried', accountId: 'acc', name: 'Alice' } });
    expect(game.player(0).name).toBe('Alice');
    expect(game.player(1)).toMatchObject({ name: AI_PLAYER_NAME, accountId: null });
    game.leave(0);
    expect(game.outcome()).toEqual({ gameId: 'g', mode: 'ai', accountId: 'acc', won: false });
  });

  it('retourne les événements visuels une seule fois', () => {
    const { game, a, b } = newGame(['kalAzaar', 'siegfried']);
    readyToPlay(game, a, ['traitFeu', 'autelDestruction']);
    playNow(game, a, 1, [{ kind: 'hand', index: 0 }]);
    expect(game.drainEvents()).toEqual([{ kind: 'damage', target: { kind: 'hero', player: b }, amount: 2 }]);
    expect(game.drainEvents()).toEqual([]);
  });
});

describe('Game — événements', () => {
  /** Utilise un événement et le résout immédiatement. */
  const eventNow = (game: Game, pi: 0 | 1, slotIndex: number, choices: Parameters<Game['useEvent']>[2] = []) => {
    game.useEvent(pi, slotIndex, choices);
    game.resolvePending();
  };

  it('mélange les 8 événements de chaque joueur et en met deux en jeu', () => {
    const game = Game.create({ id: 'g', seed: 3, players: [
      { id: 'p0', deck: 'siegfried', isAi: false, accountId: 'acc0', name: 'Joueur 0' },
      { id: 'p1', deck: 'kalAzaar', isAi: false, accountId: 'acc1', name: 'Joueur 1' },
    ] });
    expect(game.events).toHaveLength(2);
    expect(game.eventDeckCount).toBe(14);
    const brought = [...DECKS.siegfried.events, ...DECKS.kalAzaar.events];
    game.events.forEach(id => expect(brought).toContain(id));
  });

  it('en fin de tour, l\'événement de gauche sort, celui de droite prend sa place et un nouveau arrive', () => {
    const { game, a } = newGame();
    game.endTurn(a);
    expect(game.events[0]).toBe('dayOfFortune');
    expect(game.events).toHaveLength(2);
    expect(game.eventDeckCount).toBe(13);
  });

  it('remélange les événements sortis quand la pioche est vide', () => {
    const { game, a, b } = newGame();
    for (let i = 0; i < 20; i++) game.endTurn(i % 2 === 0 ? a : b);
    expect(game.events).toHaveLength(2);
    expect(game.eventDeckCount + game.events.length).toBeLessThanOrEqual(16);
  });

  it('un événement est payé et révélé, puis résolu ; chaque joueur peut l\'utiliser une fois par tour', () => {
    const { game, a, b } = newGame();
    readyToPlay(game, a, [], 5);
    state(game, b).hand = [];
    game.useEvent(a, 0, []);
    expect(game.pending).toMatchObject({ kind: 'event', player: a, eventId: 'celebration' });
    expect(game.player(a).res).toBe(3);
    expect(game.whyNotUseEvent(a, 1)).toBe('Un événement est en cours de résolution.');
    game.resolvePending();
    expect(game.player(a).hand).toHaveLength(1);
    expect(game.player(b).hand).toHaveLength(1);
    expect(game.whyNotUseEvent(a, 0)).toBe('Vous avez déjà utilisé cet événement ce tour-ci.');

    setEvents(game, ['celebration', 'celebration']);
    eventNow(game, a, 1);
    game.endTurn(a);
    setEvents(game, ['celebration', 'dayOfFortune']);
    state(game, b).res = 2;
    expect(game.whyNotUseEvent(b, 0)).toBeNull();
  });

  it('refuse un événement trop cher ou permanent', () => {
    const { game, a } = newGame();
    setEvents(game, ['hailStorm', 'manaStorm']);
    state(game, a).res = 3;
    expect(game.whyNotUseEvent(a, 0)).toBe('Pas assez de ressources.');
    expect(game.whyNotUseEvent(a, 1)).toMatch(/permanent/);
    expect(() => game.useEvent(a, 1, [])).toThrow(GameRuleError);
  });

  it('Jour de fortune : défausse la carte choisie puis pioche', () => {
    const { game, a } = newGame();
    readyToPlay(game, a, ['soin', 'traitFeu']);
    state(game, a).deck = ['cerbere'];
    eventNow(game, a, 1, [{ kind: 'hand', index: 1 }]);
    expect(game.player(a).hand).toEqual(['soin', 'cerbere']);
    expect(game.player(a).grave).toEqual(['traitFeu']);
  });

  it('Marché des ombres : 1 dégât à son héros et une carte', () => {
    const { game, a } = newGame();
    setEvents(game, ['marketOfShadows', 'celebration']);
    readyToPlay(game, a, []);
    eventNow(game, a, 0);
    expect(game.player(a).hp).toBe(game.player(a).maxHp - 1);
    expect(game.player(a).hand).toHaveLength(1);
  });

  it('Tempête de grêle : 1 dégât à chaque créature', () => {
    const { game, a, b } = newGame();
    setEvents(game, ['hailStorm', 'celebration']);
    state(game, a).res = 4;
    const mine = place(game, a, 'griffonLoyal', 0, 0);
    const theirs = place(game, b, 'cerbere', 0, 1);
    const fragile = place(game, b, 'diablotinChaos', 1, 1);
    eventNow(game, a, 0);
    expect(mine.hpCur).toBe(3);
    expect(theirs.hpCur).toBe(2);
    expect(game.locate(fragile.uid)).toBeNull();
  });

  it('Jour de la conscription : +1 Puissance pour les deux joueurs', () => {
    const { game, a, b } = newGame();
    setEvents(game, ['conscriptionDay', 'celebration']);
    state(game, a).res = 3;
    const before = [game.player(a).m, game.player(b).m];
    eventNow(game, a, 0);
    expect([game.player(a).m, game.player(b).m]).toEqual([before[0]! + 1, before[1]! + 1]);
  });

  it('les bonus de déploiement s\'appliquent à la prochaine créature déployée ce tour-ci seulement', () => {
    const { game, a } = newGame();
    setEvents(game, ['weaponsmiths', 'emeraldSong']);
    readyToPlay(game, a, ['griffonLoyal', 'griffonLoyal']);
    eventNow(game, a, 0);
    eventNow(game, a, 1);
    playNow(game, a, 0, [slot(0, 0)]);
    playNow(game, a, 0, [slot(0, 1)]);
    expect(game.player(a).board[0]![0]).toMatchObject({ atk: 3, hpCur: 6, hpMax: 6 });
    expect(game.player(a).board[0]![1]).toMatchObject({ atk: 2, hpCur: 4 });
  });

  it('Jour du loup déchu : +2 en riposte, perdu à la fin du tour s\'il n\'a pas servi', () => {
    const { game, a, b } = newGame();
    setEvents(game, ['fallenWolf', 'celebration']);
    readyToPlay(game, a, ['griffonLoyal']);
    eventNow(game, a, 0);
    playNow(game, a, 0, [slot(0, 0)]);
    expect(game.player(a).board[0]![0]!.ret).toBe(3);
    setEvents(game, ['fallenWolf', 'celebration']);
    state(game, a).res = 3;
    eventNow(game, a, 0);
    game.endTurn(a);
    game.endTurn(b);
    expect(game.player(a).nextDeployBonus).toEqual({ atk: 0, ret: 0, hp: 0 });
  });

  it('Tempête de mana et Semaine des impôts augmentent le coût des sorts et des fortunes', () => {
    const { game, a } = newGame();
    readyToPlay(game, a, ['traitFeu', 'autelDestruction', 'cerbere'], 1);
    setEvents(game, ['manaStorm', 'weekOfTaxes']);
    expect(game.whyNotPlay(a, 0)).toBe('Pas assez de ressources.');
    expect(game.whyNotPlay(a, 1)).toBe('Pas assez de ressources.');
    state(game, a).res = 2;
    const enemy = place(game, 1, 'cerbere', 0, 0);
    playNow(game, a, 0, [unit(enemy)]);
    expect(game.player(a).res).toBe(0);
  });
});
