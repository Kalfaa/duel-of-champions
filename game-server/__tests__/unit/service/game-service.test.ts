import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import type { AiStrategy } from '../../../src/model/ai-player';
import { GameRuleError } from '../../../src/model/errors';
import type { Game, PlayerState } from '../../../src/model/game';
import type { IMatchmakingQueue } from '../../../src/model/matchmaking-queue';
import type { IGameRepository } from '../../../src/repository/game-repository';
import { AlreadyInGameError, NotInGameError } from '../../../src/service/errors';
import { GameService } from '../../../src/service/game-service';
import type { GameNotification, IPlayerChannel } from '../../../src/service/ports';
import { place } from '../model/helpers';

function mockRepository() {
  const games = new Map<string, Game>();
  return {
    games,
    repo: {
      get: vi.fn(async (id: string) => games.get(id) ?? null),
      findByPlayer: vi.fn(async (playerId: string) => [...games.values()].find(g => g.indexOf(playerId) !== null) ?? null),
      save: vi.fn(async (game: Game) => { games.set(game.id, game); }),
      delete: vi.fn(async (id: string) => { games.delete(id); }),
    } satisfies IGameRepository,
  };
}

function mockChannel() {
  const received: GameNotification[] = [];
  const channel: IPlayerChannel = { send: n => received.push(n) };
  const lastState = () => {
    const states = received.filter(n => n.type === 'state');
    const last = states[states.length - 1];
    if (!last || last.type !== 'state') throw new Error('Aucun état reçu');
    return last.view;
  };
  return { channel, received, lastState };
}

describe('GameService', () => {
  let repository: ReturnType<typeof mockRepository>;
  let queue: { [K in keyof IMatchmakingQueue]: ReturnType<typeof vi.fn> };
  let ai: { chooseAction: ReturnType<typeof vi.fn> };
  let service: GameService;
  let wait: Mock<(ms: number) => Promise<void>>;
  let idCounter: number;

  beforeEach(() => {
    repository = mockRepository();
    queue = { join: vi.fn(() => null), leave: vi.fn(() => false), has: vi.fn(() => false) };
    // L'IA se contente de développer puis de terminer son tour
    ai = { chooseAction: vi.fn((game: Game) => (game.player(game.current).heroActionUsed ? { type: 'endTurn' } : { type: 'develop', choice: 'm' })) };
    idCounter = 0;
    wait = vi.fn(async () => {});
    service = new GameService(
      repository.repo,
      queue as unknown as IMatchmakingQueue,
      ai as unknown as AiStrategy,
      { wait },
      { next: () => `id${++idCounter}` },
      { next: () => 42 },
      { aiAction: 5, turnStart: 1600, cardReveal: 1000, retaliation: 500 },
    );
  });

  it('liste les trois factions', () => {
    expect(service.listFactions().map(f => f.id)).toEqual(['havre', 'necropole', 'inferno']);
  });

  it('démarre une partie contre l\'IA, la sauvegarde et envoie l\'état au joueur', async () => {
    const player = mockChannel();
    const playerId = service.connect(player.channel);
    await service.startAiGame(playerId, 'havre');

    expect(repository.repo.save).toHaveBeenCalled();
    const view = player.lastState();
    expect(view.players[view.you].faction).toBe('havre');
    // Quel que soit le premier joueur, l'IA a joué et c'est maintenant au joueur d'agir
    expect(view.current).toBe(view.you);
    expect(view.options?.heroAction.available).toBe(true);
  });

  it('fait jouer l\'IA après la fin du tour du joueur', async () => {
    const player = mockChannel();
    const playerId = service.connect(player.channel);
    await service.startAiGame(playerId, 'havre');
    const turn = player.lastState().turn;

    await service.act(playerId, { type: 'develop', choice: 'm' });
    wait.mockClear();
    await service.act(playerId, { type: 'endTurn' });

    expect(ai.chooseAction).toHaveBeenCalled();
    // L'IA attend la fin du bandeau de changement de tour avant sa première action, puis joue à son rythme
    expect(wait.mock.calls[0]).toEqual([1600]);
    expect(wait.mock.calls.slice(1).every(([ms]) => ms !== 1600)).toBe(true);
    const view = player.lastState();
    expect(view.turn).toBe(turn + 2);
    expect(view.current).toBe(view.you);
  });

  it('affiche une carte jouée avant de la résoudre', async () => {
    const player = mockChannel();
    const playerId = service.connect(player.channel);
    await service.startAiGame(playerId, 'havre');
    const you = player.lastState().you;
    const game = repository.games.values().next().value!;
    const p = game.player(you) as PlayerState;
    p.hand = ['soin'];
    p.g = 1;
    p.res = 1;
    const ally = place(game, you, 'griffonLoyal', 0, 0);
    const before = player.received.length;
    wait.mockClear();

    await service.act(playerId, { type: 'play', handIndex: 0, choices: [{ kind: 'unit', uid: ally.uid }] });

    const states = player.received.slice(before).flatMap(n => (n.type === 'state' ? [n.view] : []));
    expect(states).toHaveLength(2);
    expect(states[0]!.pending).toMatchObject({ kind: 'card', card: { id: 'soin' } });
    expect(states[0]!.options).toBeNull();
    expect(states[1]!.pending).toBeNull();
    expect(states[1]!.options).not.toBeNull();
    expect(wait).toHaveBeenCalledWith(1000);
  });

  it('diffuse l\'attaque, puis la riposte du défenseur après une pause', async () => {
    const player = mockChannel();
    const playerId = service.connect(player.channel);
    await service.startAiGame(playerId, 'havre');
    const game = repository.games.values().next().value!;
    const you = player.lastState().you;
    const attacker = place(game, you, 'gouleMiserable', 0, 0);
    const defender = place(game, you === 0 ? 1 : 0, 'griffonLoyal', 0, 0);
    const before = player.received.length;
    wait.mockClear();

    await service.act(playerId, { type: 'attack', uid: attacker.uid, target: { kind: 'unit', uid: defender.uid } });

    const states = player.received.slice(before).flatMap(n => (n.type === 'state' ? [n] : []));
    expect(states.map(n => n.events.map(e => e.kind))).toEqual([['attack', 'damage'], ['retaliate', 'damage']]);
    expect(states[0]!.view.options).toBeNull();
    expect(states[1]!.view.options).not.toBeNull();
    expect(wait).toHaveBeenCalledWith(500);
  });

  it('refuse de démarrer une seconde partie en cours', async () => {
    const playerId = service.connect(mockChannel().channel);
    await service.startAiGame(playerId, 'havre');
    await expect(service.startAiGame(playerId, 'inferno')).rejects.toThrow(AlreadyInGameError);
  });

  it('refuse une action hors partie', async () => {
    const playerId = service.connect(mockChannel().channel);
    await expect(service.act(playerId, { type: 'endTurn' })).rejects.toThrow(NotInGameError);
  });

  it('propage les erreurs de règle', async () => {
    const player = mockChannel();
    const playerId = service.connect(player.channel);
    await service.startAiGame(playerId, 'havre');
    await service.act(playerId, { type: 'develop', choice: 'm' });
    await expect(service.act(playerId, { type: 'develop', choice: 'g' })).rejects.toThrow(GameRuleError);
  });

  it('met le joueur en attente quand personne ne cherche d\'adversaire', async () => {
    const player = mockChannel();
    const playerId = service.connect(player.channel);
    await service.findMatch(playerId, 'havre');
    expect(queue.join).toHaveBeenCalledWith({ playerId, faction: 'havre' });
    expect(player.received).toEqual([{ type: 'waiting' }]);
  });

  it('crée une partie entre deux joueurs appariés et envoie à chacun sa vue', async () => {
    const alice = mockChannel();
    const bob = mockChannel();
    const aliceId = service.connect(alice.channel);
    const bobId = service.connect(bob.channel);
    queue.join.mockReturnValueOnce([{ playerId: aliceId, faction: 'havre' }, { playerId: bobId, faction: 'inferno' }]);

    await service.findMatch(bobId, 'inferno');

    expect(alice.lastState().you).toBe(0);
    expect(bob.lastState().you).toBe(1);
    expect(alice.lastState().players[1].hand).toBeNull();
  });

  it('un joueur qui quitte une partie contre l\'IA l\'abandonne et la partie est supprimée', async () => {
    const playerId = service.connect(mockChannel().channel);
    await service.startAiGame(playerId, 'havre');
    await service.leave(playerId);
    expect(queue.leave).toHaveBeenCalledWith(playerId);
    expect(repository.repo.delete).toHaveBeenCalled();
    expect(repository.games.size).toBe(0);
  });

  it('un joueur qui se déconnecte fait gagner son adversaire', async () => {
    const alice = mockChannel();
    const bob = mockChannel();
    const aliceId = service.connect(alice.channel);
    const bobId = service.connect(bob.channel);
    queue.join.mockReturnValueOnce([{ playerId: aliceId, faction: 'havre' }, { playerId: bobId, faction: 'inferno' }]);
    await service.findMatch(bobId, 'inferno');

    await service.disconnect(aliceId);

    expect(bob.lastState().phase).toBe('over');
    expect(bob.lastState().winner).toBe(1);
  });

  it('permet de rejouer une fois la partie précédente terminée', async () => {
    const alice = mockChannel();
    const bob = mockChannel();
    const aliceId = service.connect(alice.channel);
    const bobId = service.connect(bob.channel);
    queue.join.mockReturnValueOnce([{ playerId: aliceId, faction: 'havre' }, { playerId: bobId, faction: 'inferno' }]);
    await service.findMatch(bobId, 'inferno');
    await service.leave(aliceId);

    await service.startAiGame(bobId, 'necropole');

    expect(bob.lastState().players[bob.lastState().you].faction).toBe('necropole');
  });
});
