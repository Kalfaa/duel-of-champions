import type { AddressInfo } from 'node:net';
import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import WebSocket from 'ws';
import { buildApp } from '../../src/container';
import type { PlayerGameView } from '../../src/model/game-view';
import type { ServerMessage } from '../../src/route/protocol';

/** Client de test : garde tous les messages reçus et permet d'attendre une condition. */
class TestClient {
  readonly messages: ServerMessage[] = [];
  private waiters: (() => void)[] = [];

  private constructor(private readonly socket: WebSocket) {
    socket.on('message', data => {
      this.messages.push(JSON.parse(data.toString()) as ServerMessage);
      this.waiters.forEach(w => w());
    });
  }

  static async connect(url: string): Promise<TestClient> {
    const socket = new WebSocket(url);
    await new Promise<void>((resolve, reject) => { socket.once('open', () => resolve()); socket.once('error', reject); });
    return new TestClient(socket);
  }

  send(message: unknown): void {
    this.socket.send(JSON.stringify(message));
  }

  get state(): PlayerGameView | null {
    for (let i = this.messages.length - 1; i >= 0; i--) {
      const m = this.messages[i]!;
      if (m.type === 'state') return m.view;
    }
    return null;
  }

  waitFor(predicate: (client: TestClient) => boolean, timeoutMs = 2000): Promise<void> {
    if (predicate(this)) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Délai dépassé en attendant le serveur : ' + JSON.stringify(this.messages.slice(-3).map(m => m.type === 'state' ? { phase: m.view.phase, current: m.view.current, you: m.view.you, options: m.view.options !== null, pending: m.view.pending, events: m.events } : m)))), timeoutMs);
      const check = () => {
        if (!predicate(this)) return;
        clearTimeout(timer);
        this.waiters = this.waiters.filter(w => w !== check);
        resolve();
      };
      this.waiters.push(check);
    });
  }

  /** Attend que ce soit à ce joueur d'agir. */
  waitForTurn(): Promise<void> {
    return this.waitFor(c => {
      const s = c.state;
      return !!s && s.current === s.you && s.options !== null;
    });
  }

  close(): void {
    this.socket.close();
  }
}

describe('parties via WebSocket', () => {
  let app: FastifyInstance;
  let wsUrl: string;
  let httpUrl: string;
  const clients: TestClient[] = [];
  const connect = async () => {
    const client = await TestClient.connect(wsUrl);
    clients.push(client);
    return client;
  };

  beforeEach(async () => {
    let seed = 1;
    app = buildApp({ delays: { aiAction: 0, turnStart: 0, cardReveal: 0, retaliation: 0 }, seeds: { next: () => seed++ } });
    await app.listen({ port: 0, host: '127.0.0.1' });
    const { port } = app.server.address() as AddressInfo;
    wsUrl = `ws://127.0.0.1:${port}/ws`;
    httpUrl = `http://127.0.0.1:${port}`;
  });

  afterEach(async () => {
    clients.splice(0).forEach(c => c.close());
    await app.close();
  });

  it('GET /api/factions liste les factions jouables', async () => {
    const response = await fetch(`${httpUrl}/api/factions`);
    const factions = (await response.json()) as { id: string }[];
    expect(factions.map(f => f.id)).toEqual(['havre', 'necropole', 'inferno']);
  });

  it('joue plusieurs tours contre l\'IA', async () => {
    const player = await connect();
    player.send({ type: 'startAi', faction: 'havre' });
    await player.waitForTurn();

    for (let i = 0; i < 5; i++) {
      const res = player.state!.players[player.state!.you].res;
      player.send({ type: 'action', action: { type: 'develop', choice: 'm' } });
      await player.waitFor(c => !c.state!.options!.heroAction.available);
      const options = player.state!.options!;
      const playable = options.hand.findIndex(h => h.playable && h.steps.length === 1 && h.steps[0]!.options[0]?.kind === 'slot');
      if (playable !== -1) {
        player.send({ type: 'action', action: { type: 'play', handIndex: playable, choices: [options.hand[playable]!.steps[0]!.options[0]!] } });
        await player.waitFor(c => c.state!.players[c.state!.you].res < res && c.state!.pending === null);
      }
      const attacker = player.state!.options!.units.find(u => u.attackTargets.length);
      if (attacker) {
        const sent = player.messages.length;
        player.send({ type: 'action', action: { type: 'attack', uid: attacker.uid, target: attacker.attackTargets[0]! } });
        // Attend la fin de l'attaque (et de l'éventuelle riposte) : les options reviennent
        await player.waitFor(c => c.messages.slice(sent).some(m => m.type === 'state' && m.events.some(e => e.kind === 'attack'))
          && (c.state!.options !== null || c.state!.phase === 'over'));
      }
      const turn = player.state!.turn;
      player.send({ type: 'action', action: { type: 'endTurn' } });
      await player.waitFor(c => c.state!.turn >= turn + 2 || c.state!.phase === 'over');
      if (player.state!.phase === 'over') break;
      await player.waitForTurn();
    }

    const view = player.state!;
    const aiHero = view.players[view.you === 0 ? 1 : 0].hero.name;
    expect(view.log.some(l => l.text === `— Tour de ${aiHero} —`)).toBe(true);
    expect(view.players[view.you === 0 ? 1 : 0].hand).toBeNull();
  });

  it('renvoie une erreur pour une action illégale', async () => {
    const player = await connect();
    player.send({ type: 'startAi', faction: 'inferno' });
    await player.waitForTurn();
    player.send({ type: 'action', action: { type: 'develop', choice: 'm' } });
    player.send({ type: 'action', action: { type: 'develop', choice: 'g' } });
    await player.waitFor(c => c.messages.some(m => m.type === 'error'));
    expect(player.messages.find(m => m.type === 'error')).toEqual({ type: 'error', message: 'Votre héros a déjà agi ce tour-ci.' });
  });

  it('apparie deux joueurs et fait gagner celui qui reste quand l\'autre se déconnecte', async () => {
    const alice = await connect();
    const bob = await connect();
    alice.send({ type: 'findMatch', faction: 'havre' });
    await alice.waitFor(c => c.messages.some(m => m.type === 'waiting'));
    bob.send({ type: 'findMatch', faction: 'necropole' });
    await alice.waitFor(c => c.state !== null);
    await bob.waitFor(c => c.state !== null);

    expect(alice.state!.you).toBe(0);
    expect(bob.state!.you).toBe(1);

    // Le premier joueur termine son tour : la main passe à l'autre
    const [first, second] = alice.state!.current === 0 ? [alice, bob] : [bob, alice];
    await first.waitForTurn();
    first.send({ type: 'action', action: { type: 'develop', choice: 'g' } });
    first.send({ type: 'action', action: { type: 'endTurn' } });
    await second.waitForTurn();

    first.close();
    await second.waitFor(c => c.state!.phase === 'over');
    expect(second.state!.winner).toBe(second.state!.you);
  });
});
