import { describe, expect, it } from 'vitest';
import { getCard } from '../../../src/model/cards';
import type { Choice } from '../../../src/model/types';
import { newGame, place, playNow, powerNow, readyToPlay, setEvents, slot, state, unit, withHero } from './helpers';

const lane = (n: number): Choice => ({ kind: 'lane', lane: n });
const mode = (index: number): Choice => ({ kind: 'mode', index });
const revealed = (cardId: string): Choice => ({ kind: 'card', zone: 'revealed', cardId });
const grave = (cardId: string): Choice => ({ kind: 'card', zone: 'grave', cardId });

describe('Édition de base — créatures', () => {
  it('Percepteur de la dîme : son propriétaire reçoit 1 ressource de plus à son ravitaillement', () => {
    const { game, a, b } = newGame();
    place(game, a, 'percepteurDime', 0, 0);
    game.endTurn(a);
    game.endTurn(b);
    const p = game.player(a);
    expect(p.res).toBe(p.maxRes + 1);
  });

  it('Araignée de soie lunaire : les sorts de son propriétaire coûtent 1 de moins', () => {
    const { game, a } = newGame();
    place(game, a, 'araigneeSoieLunaire', 1, 0);
    expect(game.cardCost(a, getCard('eclair'))).toBe(3);
    expect(game.cardCost(a, getCard('griffonLoyal'))).toBe(2);
  });

  it('Gloire ardente : une créature alliée soignée gagne +1 en attaque jusqu\'à la fin du tour', () => {
    const { game, a } = newGame();
    place(game, a, 'gloireArdente', 1, 0);
    const griffin = place(game, a, 'griffonLoyal', 0, 1);
    griffin.hpCur = 1;
    readyToPlay(game, a, ['soin']);
    playNow(game, a, 0, [unit(griffin)]);
    expect(game.attackOf(griffin)).toBe(3);
  });

  it('Mère couveuse : une couveuse alliée qui meurt laisse une larve, qui ne va pas au cimetière', () => {
    const { game, a } = newGame();
    place(game, a, 'mereCouveuse', 1, 0);
    const breeder = place(game, a, 'couveuseGravide', 1, 1);
    game.destroyUnit(breeder.uid);
    const larva = game.player(a).board[1]![1]!;
    expect(larva.cardId).toBe('larveCouveuseTireur');
    expect(game.player(a).grave).toEqual(['couveuseGravide']);
    game.destroyUnit(larva.uid);
    expect(game.player(a).board[1]![1]).toBeNull();
    expect(game.player(a).grave).toEqual(['couveuseGravide']);
  });

  it('Traqueur de mort pao : il attaque le tour de son déploiement et meurt à la fin du tour', () => {
    const { game, a } = newGame();
    readyToPlay(game, a, ['traqueurMortPao']);
    playNow(game, a, 0, [slot(0, 0)]);
    const hunter = game.player(a).board[0]![0]!;
    expect(game.whyNotAttack(a, hunter.uid)).toBeNull();
    game.endTurn(a);
    expect(game.locate(hunter.uid)).toBeNull();
    expect(game.player(a).grave).toContain('traqueurMortPao');
  });

  it('Croisé solaire : la première créature détruite par un chevalier allié fait grandir toutes les piles alliées', () => {
    const { game, a, b } = newGame();
    const crusader = place(game, a, 'croiseSolaire', 0, 0);
    const rider = place(game, a, 'cavalierSolaire', 0, 1); // chevalier 2/1/5
    const ghoul = place(game, b, 'gouleMiserable', 0, 1); // 2/1/2
    game.attack(a, rider.uid, unit(ghoul));
    expect(game.locate(ghoul.uid)).toBeNull();
    expect([crusader.stack, game.attackOf(crusader), crusader.hpMax]).toEqual([2, 8, 14]);
    expect(rider.stack).toBe(2);
  });

  it('Assassin des ténèbres : quand il attaque, son héros subit 1 dégât', () => {
    const { game, a, b } = newGame();
    const assassin = place(game, a, 'assassinTenebres', 0, 0);
    const [hpA, hpB] = [game.player(a).hp, game.player(b).hp];
    game.attack(a, assassin.uid, { kind: 'hero', player: b });
    expect([game.player(a).hp, game.player(b).hp]).toEqual([hpA - 1, hpB - 4]);
  });

  it('Porteur de destruction : quand il meurt, toutes les créatures sont détruites', () => {
    const { game, a, b } = newGame();
    const doom = place(game, a, 'porteurDestruction', 0, 0);
    place(game, a, 'griffonLoyal', 0, 1);
    place(game, b, 'cerbere', 0, 2);
    game.destroyUnit(doom.uid);
    expect([...game.units(a), ...game.units(b)]).toEqual([]);
  });

  it('Éléonore : au début du tour de son propriétaire, les créatures alliées sont entièrement soignées', () => {
    const { game, a, b } = newGame();
    place(game, a, 'eleonore', 1, 0);
    const griffin = place(game, a, 'griffonLoyal', 0, 1);
    griffin.hpCur = 1;
    game.endTurn(a);
    game.endTurn(b);
    expect(griffin.hpCur).toBe(4);
  });

  it('Garde impériale : elle subit les dégâts infligés à son héros', () => {
    const { game, a } = newGame();
    const guard = place(game, a, 'gardeImperiale', 1, 0);
    const hp = game.player(a).hp;
    game.damageHero(a, 3);
    expect([game.player(a).hp, guard.hpCur]).toEqual([hp, 5]);
  });

  it('Mercenaire voyou : attaquer avec lui coûte 1 ressource', () => {
    const { game, a, b } = newGame();
    const mercenary = place(game, a, 'mercenaireVoyou', 0, 0);
    state(game, a).res = 0;
    expect(game.whyNotAttack(a, mercenary.uid)).toBe('Attaquer avec cette créature coûte 1 ressource.');
    state(game, a).res = 1;
    game.attack(a, mercenary.uid, { kind: 'hero', player: b });
    expect(game.player(a).res).toBe(0);
  });

  it('Céleste : l\'attaque et la riposte des créatures ennemies de son couloir sont d\'au plus 2', () => {
    const { game, a, b } = newGame();
    place(game, a, 'celeste', 0, 0);
    const near = place(game, b, 'ravageur', 0, 0); // 6/4/4
    const far = place(game, b, 'ravageur', 0, 1);
    expect([game.attackOf(near), game.retaliationOf(near), game.attackOf(far)]).toEqual([2, 2, 6]);
  });

  it('La Banshee détruit une créature ennemie ciblée en arrivant', () => {
    const { game, a, b } = newGame();
    const griffin = place(game, b, 'griffonLoyal', 0, 0);
    readyToPlay(game, a, ['banshee']);
    playNow(game, a, 0, [slot(0, 1), unit(griffin)]);
    expect(game.locate(griffin.uid)).toBeNull();
  });

  it('Atropos reprend en main deux créatures du cimetière en arrivant', () => {
    const { game, a } = newGame();
    readyToPlay(game, a, ['atropos']);
    state(game, a).grave = ['griffonLoyal', 'soin', 'gouleMiserable'];
    playNow(game, a, 0, [slot(1, 0), grave('griffonLoyal'), grave('gouleMiserable')]);
    expect(game.player(a).hand).toEqual(['griffonLoyal', 'gouleMiserable']);
    expect(game.player(a).grave).toEqual(['soin']);
  });

  it('une créature dont l\'effet à l\'arrivée n\'a aucune cible est déployée sans cet effet (Colporteur de magie, Banshee)', () => {
    const { game, a } = newGame();
    readyToPlay(game, a, ['colporteurMagie', 'banshee']);
    state(game, a).deck = ['soin', 'griffonLoyal'];
    expect(game.playSteps(a, 0)).toHaveLength(1);
    playNow(game, a, 0, [slot(0, 0)]);
    playNow(game, a, 0, [slot(0, 1)]);
    expect(game.player(a).board[0]!.slice(0, 2).map(u => u?.cardId)).toEqual(['colporteurMagie', 'banshee']);
    expect(game.player(a).hand).toEqual([]);
    expect(game.pending).toBeNull();
  });

  it('Bibliothécaire hélexien pioche une carte, Barde errant cherche une créature unique', () => {
    const { game, a } = newGame();
    readyToPlay(game, a, ['bibliothecaireHelexien', 'bardeErrant']);
    state(game, a).deck = ['gardeImperiale', 'soin', 'griffonLoyal'];
    playNow(game, a, 0, [slot(0, 0)]);
    expect(game.player(a).hand).toEqual(['bardeErrant', 'griffonLoyal']);
    playNow(game, a, 0, [slot(0, 1), { kind: 'card', zone: 'library', cardId: 'gardeImperiale' }]);
    expect(game.player(a).hand).toEqual(['griffonLoyal', 'gardeImperiale']);
  });
});

describe('Édition de base — sorts', () => {
  it('Armageddon, Tsunami, Nuée d\'insectes et Tremblement de terre frappent les créatures', () => {
    const { game, a, b } = newGame();
    const flyer = place(game, b, 'seraphinGuerrier', 0, 0); // 3/2/6 volant
    const walker = place(game, b, 'tourmenteur', 0, 1); // 2/2/5
    readyToPlay(game, a, ['tremblementTerre', 'nueeInsectes']);
    playNow(game, a, 0, []);
    expect([flyer.hpCur, walker.hpCur]).toEqual([6, 3]);
    playNow(game, a, 0, []);
    expect([flyer.hpCur, game.locate(walker.uid)]).toEqual([3, null]);
  });

  it('Blizzard frappe la créature au début de chaque tour puis passe sur une voisine', () => {
    const { game, a, b } = newGame();
    const griffin = place(game, b, 'griffonLoyal', 0, 0); // 2/1/4
    const ghoul = place(game, b, 'gouleMiserable', 0, 1);
    readyToPlay(game, a, ['blizzard']);
    playNow(game, a, 0, [unit(griffin)]);
    game.endTurn(a);
    expect(griffin.hpCur).toBe(1);
    expect(griffin.enchantments).toEqual([]);
    expect(ghoul.enchantments.map(e => e.cardId)).toEqual(['blizzard']);
  });

  it('Contagion empoisonne la créature au début de chaque tour', () => {
    const { game, a, b } = newGame();
    const griffin = place(game, b, 'griffonLoyal', 0, 0);
    readyToPlay(game, a, ['contagion']);
    playNow(game, a, 0, [unit(griffin)]);
    game.endTurn(a);
    expect(griffin.hpCur).toBe(3); // 1 marqueur de poison, puis le poison du ravitaillement
  });

  it('Armure céleste empêche les dégâts, puis est détruite en fin de tour si elle a servi', () => {
    const { game, a, b } = newGame();
    const griffin = place(game, a, 'griffonLoyal', 0, 0);
    readyToPlay(game, a, ['armureCeleste']);
    playNow(game, a, 0, []);
    const hp = game.player(a).hp;
    game.damageHero(a, 4);
    game.damageUnit(griffin.uid, 2, { magic: false, owner: b });
    expect([game.player(a).hp, griffin.hpCur]).toEqual([hp, 4]);
    game.endTurn(a);
    expect(game.lasting).toEqual([]);
    expect(game.player(a).grave).toContain('armureCeleste');
  });

  it('Bouclier de pierre n\'empêche que les dégâts au héros', () => {
    const { game, a } = newGame();
    const griffin = place(game, a, 'griffonLoyal', 0, 0);
    readyToPlay(game, a, ['bouclierPierre']);
    playNow(game, a, 0, []);
    const hp = game.player(a).hp;
    game.damageHero(a, 4);
    game.damageUnit(griffin.uid, 2, { magic: false });
    expect([game.player(a).hp, griffin.hpCur]).toEqual([hp, 2]);
  });

  it('Intervention divine détruit les sorts permanents ennemis et soigne les créatures alliées', () => {
    const { game, a, b } = newGame();
    const griffin = place(game, a, 'griffonLoyal', 0, 0);
    griffin.hpCur = 1;
    game.enchant(griffin.uid, 'faiblesse', b, { atk: -2, ret: -2 });
    game.enchant(griffin.uid, 'benediction', a, { atk: 2 });
    readyToPlay(game, a, ['interventionDivine']);
    playNow(game, a, 0, []);
    expect(griffin.enchantments.map(e => e.cardId)).toEqual(['benediction']);
    expect(griffin.hpCur).toBe(4);
    expect(game.player(b).grave).toContain('faiblesse');
  });

  it('Courroux du Père Ciel renvoie une créature ennemie, puis frappe les volants ennemis', () => {
    const { game, a, b } = newGame();
    const target = place(game, b, 'cerbere', 0, 0);
    const flyer = place(game, b, 'seraphinGuerrier', 0, 1); // 6 PV
    readyToPlay(game, a, ['courrouxPereCiel']);
    playNow(game, a, 0, [unit(target)]);
    expect(game.player(b).hand).toContain('cerbere');
    expect(game.locate(flyer.uid)).toBeNull();
  });

  it('Voile de brume : les tireurs et volants ennemis ne peuvent pas attaquer', () => {
    const { game, a, b } = newGame();
    const shooter = place(game, b, 'succube', 1, 0);
    const melee = place(game, b, 'cerbere', 0, 1);
    readyToPlay(game, a, ['voileBrume']);
    playNow(game, a, 0, []);
    game.endTurn(a);
    expect([game.cannotAttack(shooter), game.cannotAttack(melee)]).toEqual([true, false]);
  });

  it('Pour qui sonne le glas détruit toutes les créatures au début du tour de son lanceur', () => {
    const { game, a, b } = newGame();
    place(game, a, 'griffonLoyal', 0, 0);
    place(game, b, 'cerbere', 0, 1);
    readyToPlay(game, a, ['glas']);
    playNow(game, a, 0, []);
    game.endTurn(a);
    expect(game.units(b)).toHaveLength(1);
    game.endTurn(b);
    expect([...game.units(a), ...game.units(b)]).toEqual([]);
    expect(game.lasting).toEqual([]);
  });

  it('Geyser frappe la cible et ses voisines, Explosion solaire tout un couloir', () => {
    const { game, a, b } = newGame();
    const center = place(game, b, 'griffonLoyal', 0, 1);
    const side = place(game, b, 'griffonLoyal', 0, 2);
    const back = place(game, b, 'griffonLoyal', 1, 1);
    const ally = place(game, a, 'seraphinGuerrier', 0, 2);
    readyToPlay(game, a, ['geyser', 'explosionSolaire']);
    playNow(game, a, 0, [unit(center)]);
    expect([center.hpCur, side.hpCur, back.hpCur]).toEqual([1, 1, 1]);
    playNow(game, a, 0, [lane(2)]);
    expect([game.locate(side.uid), ally.hpCur]).toEqual([null, 3]);
  });

  it('Persistant : le sort passe à une autre créature alliée quand la créature enchantée quitte le jeu', () => {
    const { game, a } = newGame();
    const griffin = place(game, a, 'griffonLoyal', 0, 0);
    const other = place(game, a, 'gouleMiserable', 0, 1);
    readyToPlay(game, a, ['vitesseEclair']);
    playNow(game, a, 0, [unit(griffin)]);
    game.destroyUnit(griffin.uid);
    expect(game.keywordsOf(other).swift).toBe(true);
    expect(game.player(a).grave).toEqual(['griffonLoyal']);
  });

  it('Régénération de masse donne Régénération 1 aux créatures alliées', () => {
    const { game, a, b } = newGame();
    const griffin = place(game, a, 'griffonLoyal', 0, 0);
    readyToPlay(game, a, ['regenerationMasse']);
    playNow(game, a, 0, []);
    griffin.hpCur = 1;
    game.endTurn(a);
    game.endTurn(b);
    expect(griffin.hpCur).toBe(2);
  });

  it('Immolation brûle toutes les créatures à chaque tour et disparaît quand il n\'y en a plus', () => {
    const { game, a, b } = newGame();
    const ghoul = place(game, b, 'gouleMiserable', 0, 0); // 2 PV
    readyToPlay(game, a, ['immolation']);
    playNow(game, a, 0, []);
    game.endTurn(a);
    expect(ghoul.hpCur).toBe(1);
    game.endTurn(b);
    expect(game.locate(ghoul.uid)).toBeNull();
    expect(game.lasting).toEqual([]);
  });

  it('Maître des marionnettes prend le contrôle d\'une créature ennemie', () => {
    const { game, a, b } = newGame();
    const griffin = place(game, b, 'griffonLoyal', 0, 0);
    readyToPlay(game, a, ['maitreMarionnettes']);
    playNow(game, a, 0, [unit(griffin), slot(1, 3)]);
    expect(game.locate(griffin.uid)).toMatchObject({ owner: a, row: 1, lane: 3 });
    expect(game.whyNotAttack(a, griffin.uid)).toBe('Une créature ne peut pas agir le tour de son déploiement.');
  });

  it('Résurrection déploie gratuitement une créature du cimetière', () => {
    const { game, a } = newGame();
    readyToPlay(game, a, ['resurrection']);
    state(game, a).grave = ['seraphinGuerrier'];
    playNow(game, a, 0, [grave('seraphinGuerrier'), slot(1, 2)]);
    expect(game.player(a).board[1]![2]?.cardId).toBe('seraphinGuerrier');
  });

  it('Image fantôme copie une créature ennemie ; la copie disparaît au premier dégât', () => {
    const { game, a, b } = newGame();
    const ravager = place(game, b, 'ravageur', 0, 0);
    readyToPlay(game, a, ['imageFantome']);
    playNow(game, a, 0, [unit(ravager), slot(0, 2)]);
    const copy = game.player(a).board[0]![2]!;
    expect(copy.cardId).toBe('ravageur');
    expect(game.whyNotAttack(a, copy.uid)).toBeNull();
    game.damageUnit(copy.uid, 1, { magic: false });
    expect(game.locate(copy.uid)).toBeNull();
    expect(game.player(a).grave).toEqual(['imageFantome']);
  });

  it('Tordeur de sorts : le sort pris est gratuit, et retourne au cimetière adverse s\'il n\'est pas joué', () => {
    const { game, a, b } = newGame();
    readyToPlay(game, a, ['tordeurSorts']);
    state(game, b).hand = ['eclair', 'griffonLoyal'];
    playNow(game, a, 0, []);
    game.pick(a, revealed('eclair'));
    expect(game.player(a).hand).toEqual(['eclair']);
    expect(game.cardCost(a, getCard('eclair'))).toBe(0);
    game.endTurn(a);
    expect(game.player(a).hand).not.toContain('eclair');
    expect(game.player(b).grave).toContain('eclair');
  });

  it('Saut temporel : le joueur rejoue un tour, sans produire de ressources', () => {
    const { game, a } = newGame();
    readyToPlay(game, a, ['sautTemporel'], 8);
    playNow(game, a, 0, []);
    const { maxRes } = game.player(a);
    game.endTurn(a);
    expect(game.current).toBe(a);
    expect([game.player(a).res, game.player(a).maxRes]).toEqual([2, maxRes]);
  });

  it('Chaîne d\'éclairs frappe les créatures adjacentes à une case vide', () => {
    const { game, a, b } = newGame();
    const left = place(game, b, 'griffonLoyal', 0, 0);
    const right = place(game, b, 'griffonLoyal', 0, 2);
    const far = place(game, b, 'griffonLoyal', 0, 3);
    readyToPlay(game, a, ['chaineEclairs']);
    playNow(game, a, 0, [{ kind: 'cell', player: b, row: 0, lane: 1 }]);
    expect([left.hpCur, right.hpCur, far.hpCur]).toEqual([1, 1, 4]);
  });

  it('Hiver éternel immobilise la créature et la blesse au début du tour de son propriétaire', () => {
    const { game, a, b } = newGame();
    const griffin = place(game, b, 'griffonLoyal', 0, 0);
    readyToPlay(game, a, ['hiverEternel']);
    playNow(game, a, 0, [unit(griffin)]);
    expect(game.isImmobilized(griffin)).toBe(true);
    game.endTurn(a);
    expect(griffin.hpCur).toBe(3);
  });

  it('Sol gelé et Mur de glace bloquent les créatures d\'un couloir', () => {
    const { game, a, b } = newGame();
    const frozen = place(game, b, 'cerbere', 0, 0);
    const walled = place(game, b, 'cerbere', 0, 1);
    const flyer = place(game, b, 'griffonLoyal', 1, 1);
    readyToPlay(game, a, ['solGele', 'murGlace']);
    playNow(game, a, 0, [lane(0)]);
    playNow(game, a, 0, [lane(1)]);
    game.endTurn(a);
    expect([game.cannotAttack(frozen), game.isImmobilized(frozen)]).toEqual([true, true]);
    expect([game.cannotAttack(walled), game.cannotAttack(flyer)]).toEqual([true, false]);
  });

  it('Piques de glace frappent une ligne, Cyclone l\'empêche aussi d\'attaquer', () => {
    const { game, a, b } = newGame();
    const front = place(game, b, 'cerbere', 0, 0); // 3 PV
    const back = place(game, b, 'succube', 1, 0); // 4 PV
    readyToPlay(game, a, ['piquesGlace', 'cyclone']);
    playNow(game, a, 0, [{ kind: 'line', player: b, row: 0 }]);
    playNow(game, a, 0, [{ kind: 'line', player: b, row: 1 }]);
    expect([front.hpCur, back.hpCur]).toEqual([1, 3]);
    game.endTurn(a);
    expect([game.cannotAttack(front), game.cannotAttack(back)]).toEqual([false, true]);
  });

  it('Feu intérieur donne +2/+2 jusqu\'au prochain tour du lanceur', () => {
    const { game, a, b } = newGame();
    const griffin = place(game, a, 'griffonLoyal', 0, 0);
    readyToPlay(game, a, ['feuInterieur']);
    playNow(game, a, 0, [unit(griffin)]);
    expect([game.attackOf(griffin), game.retaliationOf(griffin)]).toEqual([4, 3]);
    game.endTurn(a);
    expect(game.attackOf(griffin)).toBe(4);
    game.endTurn(b);
    expect(game.attackOf(griffin)).toBe(2);
    expect(game.player(a).grave).toContain('feuInterieur');
  });

  it('Martyr empêche les dégâts adverses, puis la créature enchantée meurt en fin de tour', () => {
    const { game, a, b } = newGame();
    const martyr = place(game, a, 'gouleMiserable', 0, 0);
    const griffin = place(game, a, 'griffonLoyal', 0, 1);
    readyToPlay(game, a, ['martyr']);
    playNow(game, a, 0, [unit(martyr)]);
    game.damageUnit(griffin.uid, 3, { magic: false, owner: b });
    expect(griffin.hpCur).toBe(4);
    game.endTurn(a);
    expect(game.locate(martyr.uid)).toBeNull();
  });

  it('Siphon d\'âmes rend gratuit un sort qui coûte au plus le nombre de créatures ennemies', () => {
    const { game, a, b } = newGame();
    for (const lane of [0, 1, 2]) place(game, b, 'gouleMiserable', 0, lane);
    readyToPlay(game, a, ['siphonAmes', 'eclair', 'geyser']);
    expect(game.playSteps(a, 0)[0]!.options).toEqual([{ kind: 'hand', index: 2 }]);
    playNow(game, a, 0, [{ kind: 'hand', index: 2 }]);
    expect(game.player(a).hand).toEqual(['eclair', 'geyser']);
    expect(game.cardCost(a, getCard('geyser'))).toBe(0);
  });

  it('Peau de pierre et Bouclier de vent réduisent les dégâts de combat', () => {
    const { game, a, b } = newGame();
    const skin = place(game, a, 'seraphinGuerrier', 0, 0); // 6 PV
    const shield = place(game, a, 'seraphinGuerrier', 0, 1);
    readyToPlay(game, a, ['peauPierre', 'bouclierVent']);
    playNow(game, a, 0, [unit(skin)]);
    playNow(game, a, 0, [unit(shield)]);
    game.endTurn(a);
    const ravager = place(game, b, 'ravageur', 0, 0); // 6 en attaque
    const archer = place(game, b, 'archerElfeMarin', 1, 1); // 3 en attaque, tireur
    game.attack(b, ravager.uid, unit(skin));
    game.resolveRetaliation();
    game.attack(b, archer.uid, unit(shield));
    expect([skin.hpCur, shield.hpCur]).toEqual([3, 5]);
  });

  it('Sceau de mort : la créature meurt dès qu\'elle subit des dégâts de combat', () => {
    const { game, a, b } = newGame();
    const attacker = place(game, a, 'gouleMiserable', 0, 0);
    const sealed = place(game, b, 'seraphinGuerrier', 0, 0);
    readyToPlay(game, a, ['sceauMort']);
    playNow(game, a, 0, [unit(sealed)]);
    game.attack(a, attacker.uid, unit(sealed));
    expect(game.locate(sealed.uid)).toBeNull();
  });

  it('Dissipation de la magie détruit un sort en jeu ou le dernier enchantement d\'une créature', () => {
    const { game, a, b } = newGame();
    const griffin = place(game, b, 'griffonLoyal', 0, 0);
    game.enchant(griffin.uid, 'benediction', b, { atk: 2 });
    readyToPlay(game, a, ['dissipation', 'dissipation']);
    playNow(game, a, 0, [unit(griffin)]);
    expect(griffin.enchantments).toEqual([]);
  });

  it('Bouclier de feu renvoie les dégâts d\'attaque à l\'attaquant', () => {
    const { game, a, b } = newGame();
    const attacker = place(game, a, 'cerbere', 0, 0); // 3/1/3
    const target = place(game, b, 'seraphinGuerrier', 0, 0);
    game.enchant(target.uid, 'bouclierFeu', b, { keywords: { fireShield: true } });
    game.attack(a, attacker.uid, unit(target));
    expect(game.locate(attacker.uid)).toBeNull();
  });

  it('Piège de feu brûle la première créature de mêlée qui attaque dans son couloir', () => {
    const { game, a, b } = newGame();
    readyToPlay(game, a, ['piegeFeu']);
    playNow(game, a, 0, [lane(0)]);
    game.endTurn(a);
    const attacker = place(game, b, 'seraphinGuerrier', 0, 0); // volant, 6 PV
    game.attack(b, attacker.uid, { kind: 'hero', player: a });
    expect(attacker.hpCur).toBe(3);
    expect(game.lasting).toEqual([]);
  });

  it('Mur de pierre : l\'attaque d\'une créature de mêlée de son couloir n\'inflige aucun dégât', () => {
    const { game, a, b } = newGame();
    const defender = place(game, a, 'griffonLoyal', 0, 0);
    readyToPlay(game, a, ['murPierre']);
    playNow(game, a, 0, [lane(0)]);
    game.endTurn(a);
    const attacker = place(game, b, 'ravageur', 0, 0);
    game.attack(b, attacker.uid, unit(defender));
    expect([defender.hpCur, attacker.hpCur, game.hasPendingRetaliation]).toEqual([4, 4, false]);
    expect(game.lasting).toEqual([]);
  });

  it('Lenteur empêche la créature d\'attaquer et de bouger jusqu\'au prochain tour du lanceur', () => {
    const { game, a, b } = newGame();
    const griffin = place(game, b, 'griffonLoyal', 0, 0);
    readyToPlay(game, a, ['lenteur']);
    playNow(game, a, 0, [unit(griffin)]);
    game.endTurn(a);
    expect([game.cannotAttack(griffin), game.isImmobilized(griffin)]).toEqual([true, true]);
    game.endTurn(b);
    expect([game.cannotAttack(griffin), game.isImmobilized(griffin)]).toEqual([false, false]);
  });

  it('Téléportation déplace une créature alliée', () => {
    const { game, a } = newGame();
    const griffin = place(game, a, 'griffonLoyal', 0, 0);
    readyToPlay(game, a, ['teleportation']);
    playNow(game, a, 0, [unit(griffin), { kind: 'cell', player: a, row: 1, lane: 3 }]);
    expect(game.locate(griffin.uid)).toMatchObject({ row: 1, lane: 3 });
  });

  it('Cristal de puissance double les dégâts des sorts jusqu\'à la fin du tour', () => {
    const { game, a, b } = newGame();
    const target = place(game, b, 'celeste', 0, 0); // 8 PV
    readyToPlay(game, a, ['cristalPuissance', 'eclair']);
    playNow(game, a, 0, []);
    playNow(game, a, 0, [unit(target)]);
    expect(game.locate(target.uid)).toBeNull();
  });
});

describe('Édition de base — fortunes', () => {
  it('Autel d\'Asha : détruire une créature alliée et une ennemie, ou ressusciter', () => {
    const { game, a, b } = newGame();
    const ally = place(game, a, 'gouleMiserable', 0, 0);
    const enemy = place(game, b, 'griffonLoyal', 0, 0);
    readyToPlay(game, a, ['autelAsha', 'autelAsha']);
    playNow(game, a, 0, [mode(0), unit(ally), unit(enemy)]);
    expect([game.locate(ally.uid), game.locate(enemy.uid)]).toEqual([null, null]);
    const second = place(game, a, 'cerbere', 0, 1);
    state(game, a).grave = ['seraphinGuerrier'];
    playNow(game, a, 0, [mode(1), unit(second), mode(0)]);
    game.pick(a, revealed('seraphinGuerrier'));
    expect(game.player(a).board[0]![1]?.cardId).toBe('seraphinGuerrier');
  });

  it('Dévotion impériale de Cassandra : 1 ressource et 1 soin par créature en jeu', () => {
    const { game, a, b } = newGame();
    place(game, a, 'griffonLoyal', 0, 0);
    place(game, b, 'cerbere', 0, 0);
    place(game, b, 'cerbere', 0, 1);
    readyToPlay(game, a, ['devotionCassandra'], 4);
    state(game, a).hp = 10;
    playNow(game, a, 0, []);
    expect([game.player(a).res, game.player(a).hp]).toEqual([3, 13]);
  });

  it('Purge de Garant met au cimetière toutes les cartes du nom choisi, bibliothèque et main', () => {
    const { game, a, b } = newGame();
    readyToPlay(game, a, ['purgeGarant']);
    state(game, b).deck = ['griffonLoyal', 'soin', 'griffonLoyal'];
    state(game, b).hand = ['griffonLoyal', 'cerbere'];
    playNow(game, a, 0, []);
    game.pick(a, revealed('griffonLoyal'));
    expect(game.player(b).deck).toEqual(['soin']);
    expect(game.player(b).hand).toEqual(['cerbere']);
    expect(game.player(b).grave.filter(id => id === 'griffonLoyal')).toHaveLength(3);
  });

  it('Autel de la servitude éternelle reprend les créatures mortes depuis le dernier tour', () => {
    const { game, a } = newGame();
    const griffin = place(game, a, 'griffonLoyal', 0, 0);
    game.destroyUnit(griffin.uid);
    readyToPlay(game, a, ['autelServitude']);
    playNow(game, a, 0, []);
    expect(game.player(a).hand).toEqual(['griffonLoyal']);
  });

  it('Caverne de cristal double les ressources, une fois par tour', () => {
    const { game, a } = newGame();
    readyToPlay(game, a, ['caverneCristal', 'caverneCristal'], 10);
    playNow(game, a, 0, []);
    expect(game.player(a).res).toBe(12);
    expect(game.whyNotPlay(a, 0)).toBe('Une Caverne de cristal a déjà été jouée ce tour-ci.');
  });

  it('Salle des tourments : l\'adversaire qui ne joue pas de carte du type choisi subit 3 dégâts', () => {
    const { game, a, b } = newGame();
    readyToPlay(game, a, ['salleTourments']);
    playNow(game, a, 0, [mode(0)]);
    game.endTurn(a);
    const hp = game.player(b).hp;
    game.endTurn(b);
    expect(game.player(b).hp).toBe(hp - 3);
  });

  it('Prison : l\'adversaire ne produit pas de ressources à son prochain ravitaillement', () => {
    const { game, a, b } = newGame();
    readyToPlay(game, a, ['prison']);
    playNow(game, a, 0, []);
    game.endTurn(a);
    expect(game.player(b).res).toBe(0);
  });

  it('Renforts déploie gratuitement une créature de même nom depuis la main', () => {
    const { game, a } = newGame();
    const griffin = place(game, a, 'griffonLoyal', 0, 0);
    readyToPlay(game, a, ['renforts', 'griffonLoyal'], 3);
    playNow(game, a, 0, [unit(griffin), slot(0, 1)]);
    expect(game.player(a).board[0]![1]?.cardId).toBe('griffonLoyal');
    expect([game.player(a).hand, game.player(a).res]).toEqual([[], 0]);
  });

  it('Terres désolées interdit à l\'adversaire de jouer le type de carte choisi', () => {
    const { game, a, b } = newGame();
    readyToPlay(game, a, ['terresDesolees']);
    playNow(game, a, 0, [mode(1)]);
    game.endTurn(a);
    readyToPlay(game, b, ['eclair', 'cerbere']);
    expect(game.whyNotPlay(b, 0)).toBe('Vous ne pouvez pas jouer ce type de carte ce tour-ci.');
    expect(game.whyNotPlay(b, 1)).toBeNull();
  });

  it('Autel des ombres : les ennemis ne peuvent pas attaquer, et son joueur ne joue plus de carte ce tour-ci', () => {
    const { game, a, b } = newGame();
    const enemy = place(game, b, 'cerbere', 0, 0);
    readyToPlay(game, a, ['soin', 'autelOmbres', 'soin']);
    place(game, a, 'griffonLoyal', 0, 3);
    playNow(game, a, 0, [unit(game.units(a)[0]!.unit)]);
    expect(game.whyNotPlay(a, 0)).toBe('Vous avez déjà joué une carte ce tour-ci.');
    state(game, a).cardsPlayedThisTurn = 0;
    playNow(game, a, 0, []);
    expect(game.whyNotPlay(a, 0)).toBe('Vous ne pouvez plus jouer de carte ce tour-ci.');
    game.endTurn(a);
    expect(game.cannotAttack(enemy)).toBe(true);
  });

  it('Pont brisé renvoie en main toutes les créatures d\'un couloir', () => {
    const { game, a, b } = newGame();
    place(game, a, 'griffonLoyal', 0, 2);
    place(game, b, 'cerbere', 0, 2);
    readyToPlay(game, a, ['pontBrise']);
    playNow(game, a, 0, [lane(2)]);
    expect([game.player(a).hand, game.player(b).hand.includes('cerbere')]).toEqual([['griffonLoyal'], true]);
  });

  it('Fontaine de jouvence soigne, Maison de la folie fait défausser, quand l\'adversaire joue', () => {
    const { game, a, b } = newGame();
    readyToPlay(game, a, ['fontaineJouvence', 'maisonFolie']);
    playNow(game, a, 0, []);
    playNow(game, a, 0, []);
    state(game, a).hp = 10;
    game.endTurn(a);
    readyToPlay(game, b, ['tasOr', 'cerbere', 'soin']);
    playNow(game, b, 0, []);
    expect(game.player(a).hp).toBe(12);
    expect(game.player(b).hand).toHaveLength(1);
  });

  it('Fosse de la haine : si la main est vide après l\'avoir jouée, l\'adversaire défausse toute sa main', () => {
    const { game, a, b } = newGame();
    readyToPlay(game, a, ['fosseHaine']);
    state(game, b).hand = ['cerbere', 'soin'];
    playNow(game, a, 0, []);
    expect(game.player(b).hand).toEqual([]);
  });

  it('Lieu d\'embuscade : les créatures de mêlée peuvent attaquer la ligne arrière', () => {
    const { game, a, b } = newGame();
    const attacker = place(game, a, 'cerbere', 0, 0);
    place(game, b, 'griffonLoyal', 0, 0);
    const back = place(game, b, 'succube', 1, 0);
    readyToPlay(game, a, ['embuscade']);
    expect(game.attackTargets(a, attacker.uid)).not.toContainEqual(unit(back));
    playNow(game, a, 0, []);
    expect(game.attackTargets(a, attacker.uid)).toContainEqual(unit(back));
  });

  it('Faille du chaos fait défausser deux cartes si la main de son joueur est plus petite', () => {
    const { game, a, b } = newGame();
    readyToPlay(game, a, ['failleChaos']);
    state(game, b).hand = ['cerbere', 'soin', 'tasOr'];
    playNow(game, a, 0, [mode(1)]);
    expect(game.player(b).hand).toHaveLength(1);
  });

  it('Cimetière reprend une créature si l\'adversaire en a plus en jeu', () => {
    const { game, a, b } = newGame();
    place(game, b, 'cerbere', 0, 0);
    readyToPlay(game, a, ['cimetiere']);
    state(game, a).grave = ['griffonLoyal'];
    playNow(game, a, 0, [mode(1)]);
    game.pick(a, revealed('griffonLoyal'));
    expect(game.player(a).hand).toEqual(['griffonLoyal']);
  });

  it('Pas de repos pour les méchants exige d\'avoir ensuite moins de cartes que l\'adversaire', () => {
    const { game, a, b } = newGame();
    readyToPlay(game, a, ['pasDeRepos', 'soin']);
    state(game, a).grave = ['griffonLoyal'];
    state(game, b).hand = ['cerbere'];
    expect(game.whyNotPlay(a, 0)).toBe('Vous devez avoir ensuite moins de cartes en main que l\'adversaire.');
    state(game, b).hand = ['cerbere', 'soin'];
    playNow(game, a, 0, [grave('griffonLoyal')]);
    expect(game.player(a).hand).toEqual(['soin', 'griffonLoyal']);
  });

  it('Drapeau de ralliement augmente la Puissance de 2 jusqu\'à la fin du tour', () => {
    const { game, a, b } = newGame();
    readyToPlay(game, a, ['drapeauRalliement']);
    playNow(game, a, 0, []);
    expect(game.statOf(a, 'm')).toBe(9);
    game.endTurn(a);
    game.endTurn(b);
    expect(game.statOf(a, 'm')).toBe(7);
  });
});

describe('Édition de base — héros', () => {
  it('Xorm : ses créatures de mêlée gagnent +1 en attaque jusqu\'à la fin du tour', () => {
    const { game, a } = newGame([withHero('kalAzaar', 'xorm'), 'siegfried']);
    const melee = place(game, a, 'cerbere', 0, 0);
    const shooter = place(game, a, 'succube', 1, 0);
    state(game, a).res = 2;
    powerNow(game, a, []);
    expect([game.attackOf(melee), game.attackOf(shooter)]).toEqual([4, 2]);
  });

  it('Fleshbane déploie un vampire du cimetière', () => {
    const { game, a } = newGame([withHero('namtaru', 'fleshbane'), 'siegfried']);
    state(game, a).res = 3;
    state(game, a).grave = ['chevalierVampire', 'seigneurVampire'];
    expect(game.powerSteps(a)[0]!.options).toEqual([grave('chevalierVampire')]);
    powerNow(game, a, [grave('chevalierVampire'), slot(1, 0)]);
    expect(game.player(a).board[1]![0]?.cardId).toBe('chevalierVampire');
  });

  it('Nergal empoisonne, Belias blesse le héros ennemi, Kelthor frappe selon la rage', () => {
    const { game, a, b } = newGame([withHero('namtaru', 'nergal'), withHero('kalAzaar', 'kelthor')]);
    const target = place(game, b, 'cerbere', 0, 0);
    state(game, a).res = 1;
    powerNow(game, a, [unit(target)]);
    expect(target.poison).toBe(1);
    game.endTurn(a);
    const enraged = place(game, b, 'cerbere', 0, 1);
    enraged.enrage = 2;
    const victim = place(game, a, 'seraphinGuerrier', 0, 0);
    powerNow(game, b, [unit(enraged), unit(victim)]);
    expect(victim.hpCur).toBe(4);
  });
});

describe('Édition de base — événements', () => {
  it('Semaine des morts : détruire une créature alliée rapporte la moitié de son coût', () => {
    const { game, a } = newGame();
    const seraph = place(game, a, 'seraphinGuerrier', 0, 0); // coût 4
    setEvents(game, ['weekOfDead', 'celebration']);
    state(game, a).res = 1;
    game.useEvent(a, 0, [unit(seraph)]);
    game.resolvePending();
    expect([game.locate(seraph.uid), game.player(a).res]).toEqual([null, 2]);
  });

  it('Semaine du savoir pioche une carte puis interdit de jouer', () => {
    const { game, a } = newGame();
    setEvents(game, ['weekOfKnowledge', 'celebration']);
    readyToPlay(game, a, ['soin']);
    game.useEvent(a, 0, []);
    game.resolvePending();
    expect(game.player(a).hand).toHaveLength(2);
    expect(game.whyNotPlay(a, 0)).toBe('Vous ne pouvez plus jouer de carte ce tour-ci.');
  });

  it('Mois des flammes dansantes : +1/+1 à toutes les créatures jusqu\'à la fin du tour', () => {
    const { game, a, b } = newGame();
    const griffin = place(game, b, 'griffonLoyal', 0, 0);
    setEvents(game, ['monthOfDancingFlames', 'celebration']);
    state(game, a).res = 5;
    game.useEvent(a, 0, []);
    game.resolvePending();
    expect([game.attackOf(griffin), game.retaliationOf(griffin)]).toEqual([3, 2]);
    game.endTurn(a);
    expect(game.attackOf(griffin)).toBe(2);
  });

  it('Semaine des mercenaires : bonus selon la carte du dessus de la bibliothèque', () => {
    const { game, a, b } = newGame();
    const ally = place(game, a, 'griffonLoyal', 0, 0);
    const enemy = place(game, b, 'griffonLoyal', 0, 0);
    setEvents(game, ['weekOfMercenaries', 'celebration']);
    state(game, a).res = 3;
    state(game, a).deck = ['soin', 'cerbere'];
    game.useEvent(a, 0, []);
    game.resolvePending();
    expect([game.attackOf(ally), game.retaliationOf(enemy)]).toEqual([3, 1]);
    state(game, a).deck = ['cerbere', 'soin'];
    expect([game.attackOf(ally), game.retaliationOf(enemy)]).toEqual([2, 2]);
  });

  it('Marché des merveilles : une des trois cartes du dessus en main, les autres au cimetière', () => {
    const { game, a } = newGame();
    setEvents(game, ['marketOfWonders', 'celebration']);
    readyToPlay(game, a, [], 5);
    state(game, a).deck = ['tasOr', 'cerbere', 'soin', 'griffonLoyal'];
    game.useEvent(a, 0, []);
    game.resolvePending();
    game.pick(a, revealed('soin'));
    expect(game.player(a).hand).toEqual(['soin']);
    expect(game.player(a).grave.sort()).toEqual(['cerbere', 'griffonLoyal']);
    expect(game.player(a).deck).toEqual(['tasOr']);
  });
});
