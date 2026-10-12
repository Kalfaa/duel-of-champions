import type { AddressInfo } from 'node:net';
import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { SignJWT } from 'jose';
import WebSocket from 'ws';
import { buildApp } from '../../src/container';
import type { DeckContent, IDeckStore, StoredDeck } from '../../src/integration/deck-store';
import type { Catalog, SavedDeck } from '../../src/service/deck-service';
import type { ServerMessage } from '../../src/route/protocol';

const JWT_SECRET = 'secret-de-test';
const tokenFor = (accountId: string) =>
  new SignJWT({ name: accountId }).setProtectedHeader({ alg: 'HS256' }).setSubject(accountId).setIssuer('duel-of-champions')
    .setExpirationTime('1h').sign(new TextEncoder().encode(JWT_SECRET));

/** Faux serveur de comptes : decks gardés en mémoire, par compte. */
class InMemoryDeckStore implements IDeckStore {
  private readonly decks = new Map<string, StoredDeck & { accountId: string }>();
  private next = 0;

  async list(accountId: string) { return [...this.decks.values()].filter(d => d.accountId === accountId).map(({ accountId: _, ...d }) => d); }
  async get(accountId: string, id: string) {
    const deck = this.decks.get(id);
    if (!deck || deck.accountId !== accountId) return null;
    const { accountId: _, ...rest } = deck;
    return rest;
  }
  async create(accountId: string, content: DeckContent) {
    const deck = { ...content, id: `deck-${++this.next}`, updatedAt: new Date().toISOString() };
    this.decks.set(deck.id, { ...deck, accountId });
    return deck;
  }
  async update(accountId: string, id: string, content: DeckContent) {
    if (!await this.get(accountId, id)) return null;
    const deck = { ...content, id, updatedAt: new Date().toISOString() };
    this.decks.set(id, { ...deck, accountId });
    return deck;
  }
  async delete(accountId: string, id: string) { return !!await this.get(accountId, id) && this.decks.delete(id); }
}

describe('construction de decks', () => {
  let app: FastifyInstance;
  let httpUrl: string;
  let wsUrl: string;
  const sockets: WebSocket[] = [];

  const api = async (method: string, path: string, accountId: string | null, body?: object) => {
    const headers: Record<string, string> = accountId ? { authorization: `Bearer ${await tokenFor(accountId)}` } : {};
    if (body) headers['content-type'] = 'application/json';
    return fetch(`${httpUrl}${path}`, { method, headers, ...(body ? { body: JSON.stringify(body) } : {}) });
  };

  /** Deck d'Ishuma construit à partir du catalogue, comme le ferait le client. */
  const ishumaDeck = (catalog: Catalog) => {
    const hero = catalog.heroes.find(h => h.id === 'ishuma')!;
    const allowed = catalog.cards.filter(c => (c.type === 'spell'
      ? !!c.school && hero.hero.schools.includes(c.school)
      : c.faction === null || c.faction.id === hero.faction));
    const cards: Record<string, number> = {};
    let total = 0;
    for (const card of allowed) {
      if (total >= 50) break;
      const n = Math.min(card.rarity === 'unique' ? 1 : 4, 50 - total);
      cards[card.id] = n;
      total += n;
    }
    return { name: 'Dragons', hero: 'ishuma', cards, events: catalog.events.slice(0, 8).map(e => e.id) };
  };

  beforeEach(async () => {
    app = buildApp({
      delays: { aiAction: 0, turnStart: 0, cardReveal: 0, retaliation: 0 },
      seeds: { next: () => 1 },
      jwtSecret: JWT_SECRET,
      accountServer: { url: 'http://comptes.invalid', internalKey: 'cle' },
      accountClient: { reportMatch: async () => {} },
      deckStore: new InMemoryDeckStore(),
    });
    await app.listen({ port: 0, host: '127.0.0.1' });
    const { port } = app.server.address() as AddressInfo;
    httpUrl = `http://127.0.0.1:${port}`;
    wsUrl = `ws://127.0.0.1:${port}/ws`;
  });

  afterEach(async () => {
    sockets.splice(0).forEach(s => s.close());
    await app.close();
  });

  it('construit un deck à partir du catalogue, l\'enregistre puis le joue contre l\'IA', async () => {
    const catalog = (await (await api('GET', '/api/catalog', null)).json()) as Catalog;
    expect(catalog.heroes.length).toBeGreaterThanOrEqual(25);

    const created = await api('POST', '/api/my-decks', 'acc-alice', ishumaDeck(catalog));
    expect(created.status).toBe(201);
    const deck = (await created.json()) as SavedDeck;
    expect(deck.problems).toEqual([]);
    expect(((await (await api('GET', '/api/my-decks', 'acc-alice')).json()) as SavedDeck[]).map(d => d.id)).toEqual([deck.id]);
    expect((await (await api('GET', '/api/my-decks', 'acc-bob')).json())).toEqual([]);

    const socket = new WebSocket(`${wsUrl}?token=${await tokenFor('acc-alice')}`);
    sockets.push(socket);
    const state = new Promise<ServerMessage>(resolve => socket.on('message', data => {
      const message = JSON.parse(data.toString()) as ServerMessage;
      if (message.type !== 'waiting') resolve(message);
    }));
    await new Promise(resolve => socket.once('open', resolve));
    socket.send(JSON.stringify({ type: 'startAi', deck: { custom: deck.id } }));
    const message = await state;
    expect(message.type).toBe('state');
    if (message.type === 'state') expect(message.view.players[message.view.you].hero.name).toBe('Ishuma, seigneur des dragons');
  });

  it('enregistre un deck incomplet, mais refuse de le jouer', async () => {
    const created = await api('POST', '/api/my-decks', 'acc-alice', { name: 'Brouillon', hero: 'kat', cards: { eclaireurGobelin: 2 }, events: [] });
    const deck = (await created.json()) as SavedDeck;
    expect(deck.problems.length).toBeGreaterThan(0);

    const socket = new WebSocket(`${wsUrl}?token=${await tokenFor('acc-alice')}`);
    sockets.push(socket);
    const reply = new Promise<ServerMessage>(resolve => socket.once('message', data => resolve(JSON.parse(data.toString()) as ServerMessage)));
    await new Promise(resolve => socket.once('open', resolve));
    socket.send(JSON.stringify({ type: 'startAi', deck: { custom: deck.id } }));
    expect(await reply).toEqual({ type: 'error', message: expect.stringContaining('Le deck « Brouillon » n\'est pas jouable.') });
  });

  it('exige d\'être connecté pour gérer ses decks', async () => {
    expect((await api('GET', '/api/my-decks', null)).status).toBe(401);
  });
});
