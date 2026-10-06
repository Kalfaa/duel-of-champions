import { describe, expect, it, vi } from 'vitest';
import { GameSocket, type SocketLike } from '../../../src/api/game-socket';

class FakeSocket implements SocketLike {
  readyState = 0;
  sent: string[] = [];
  closed = false;
  private listeners: Record<string, ((event: { data: unknown; code: number }) => void)[]> = {};

  send(data: string): void { this.sent.push(data); }
  close(): void { this.closed = true; }
  addEventListener(type: string, listener: (event: { data: unknown; code: number }) => void): void {
    (this.listeners[type] ??= []).push(listener);
  }
  emit(type: string, data?: unknown, code = 1000): void {
    if (type === 'open') this.readyState = 1;
    this.listeners[type]?.forEach(l => l({ data, code }));
  }
}

describe('GameSocket', () => {
  it('met en attente les messages jusqu\'à l\'ouverture de la connexion', () => {
    const fake = new FakeSocket();
    const socket = new GameSocket(fake);
    socket.send({ type: 'startAi', deck: 'siegfried' });
    expect(fake.sent).toEqual([]);
    fake.emit('open');
    expect(fake.sent).toEqual(['{"type":"startAi","deck":"siegfried"}']);
    socket.send({ type: 'leave' });
    expect(fake.sent).toHaveLength(2);
  });

  it('décode les messages du serveur et ignore ceux qui sont illisibles', () => {
    const fake = new FakeSocket();
    const socket = new GameSocket(fake);
    const listener = vi.fn();
    socket.onMessage(listener);
    fake.emit('message', 'pas du json');
    fake.emit('message', '{"type":"waiting"}');
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith({ type: 'waiting' });
  });

  it('prévient de la fermeture et ferme la connexion à la demande', () => {
    const fake = new FakeSocket();
    const socket = new GameSocket(fake);
    const onClose = vi.fn();
    socket.onClose(onClose);
    fake.emit('close', undefined, 4401);
    expect(onClose).toHaveBeenCalledWith(4401);
    socket.close();
    expect(fake.closed).toBe(true);
  });
});
