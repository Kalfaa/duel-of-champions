import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GameRuleError } from '../../../src/model/errors';
import { handleClientMessage, type MessageSink } from '../../../src/route/game-socket';
import type { ServerMessage } from '../../../src/route/protocol';
import { NotInGameError } from '../../../src/service/errors';
import type { IGameService } from '../../../src/service/game-service';

describe('handleClientMessage', () => {
  let service: { [K in keyof IGameService]: ReturnType<typeof vi.fn> };
  let sent: ServerMessage[];
  let sink: MessageSink;
  const call = (message: unknown) =>
    handleClientMessage(typeof message === 'string' ? message : JSON.stringify(message), 'p1', service as unknown as IGameService, sink);

  beforeEach(() => {
    service = {
      listDecks: vi.fn(), connect: vi.fn(), disconnect: vi.fn(),
      startAiGame: vi.fn(async () => {}), findMatch: vi.fn(async () => {}), act: vi.fn(async () => {}), leave: vi.fn(async () => {}),
    };
    sent = [];
    sink = { send: m => sent.push(m) };
  });

  it('démarre une partie contre l\'IA', async () => {
    await call({ type: 'startAi', deck: 'kalAzaar' });
    expect(service.startAiGame).toHaveBeenCalledWith('p1', 'kalAzaar');
  });

  it('lance la recherche d\'adversaire', async () => {
    await call({ type: 'findMatch', deck: 'siegfried' });
    expect(service.findMatch).toHaveBeenCalledWith('p1', 'siegfried');
  });

  it('transmet une action de jeu valide', async () => {
    const action = { type: 'play', handIndex: 2, choices: [{ kind: 'slot', row: 1, lane: 3 }] };
    await call({ type: 'action', action });
    expect(service.act).toHaveBeenCalledWith('p1', action);
  });

  it('quitte la partie', async () => {
    await call({ type: 'leave' });
    expect(service.leave).toHaveBeenCalledWith('p1');
  });

  it('rejette un message qui n\'est pas du JSON', async () => {
    await call('pas du json');
    expect(sent).toEqual([{ type: 'error', message: 'Message illisible.' }]);
  });

  it.each([
    { type: 'startAi', deck: 'sylvan' },
    { type: 'action', action: { type: 'move', uid: 1, to: { row: 2, lane: 0 } } },
    { type: 'inconnu' },
  ])('rejette un message invalide : %j', async message => {
    await call(message);
    expect(sent).toEqual([{ type: 'error', message: 'Message invalide.' }]);
    expect(service.act).not.toHaveBeenCalled();
  });

  it('renvoie au joueur les erreurs de règle et de service', async () => {
    service.act.mockRejectedValueOnce(new GameRuleError('Pas assez de ressources.'));
    await call({ type: 'action', action: { type: 'endTurn' } });
    service.act.mockRejectedValueOnce(new NotInGameError());
    await call({ type: 'action', action: { type: 'endTurn' } });
    expect(sent).toEqual([
      { type: 'error', message: 'Pas assez de ressources.' },
      { type: 'error', message: 'Vous n\'êtes dans aucune partie.' },
    ]);
  });

  it('laisse remonter les erreurs inattendues', async () => {
    service.leave.mockRejectedValueOnce(new Error('boom'));
    await expect(call({ type: 'leave' })).rejects.toThrow('boom');
  });
});
