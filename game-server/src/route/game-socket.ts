import type { IncomingMessage } from 'node:http';
import type { Duplex } from 'node:stream';
import type { FastifyInstance } from 'fastify';
import { WebSocketServer, type RawData, type WebSocket } from 'ws';
import { GameRuleError } from '../model/errors';
import { AlreadyInGameError, NotInGameError } from '../service/errors';
import type { IGameService } from '../service/game-service';
import { clientMessageSchema, type ServerMessage } from './protocol';

export const GAME_SOCKET_PATH = '/ws';

export interface MessageSink {
  send(message: ServerMessage): void;
}

/** Valide un message client, appelle le service et renvoie les erreurs au joueur. */
export async function handleClientMessage(raw: string, playerId: string, service: IGameService, sink: MessageSink): Promise<void> {
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    sink.send({ type: 'error', message: 'Message illisible.' });
    return;
  }
  const parsed = clientMessageSchema.safeParse(json);
  if (!parsed.success) {
    sink.send({ type: 'error', message: 'Message invalide.' });
    return;
  }
  const message = parsed.data;
  try {
    switch (message.type) {
      case 'startAi': return await service.startAiGame(playerId, message.faction);
      case 'findMatch': return await service.findMatch(playerId, message.faction);
      case 'action': return await service.act(playerId, message.action);
      case 'leave': return await service.leave(playerId);
    }
  } catch (error) {
    if (error instanceof GameRuleError || error instanceof NotInGameError || error instanceof AlreadyInGameError) {
      sink.send({ type: 'error', message: error.message });
      return;
    }
    throw error;
  }
}

function toText(data: RawData): string {
  if (Array.isArray(data)) return Buffer.concat(data).toString('utf8');
  return Buffer.from(data as ArrayBuffer).toString('utf8');
}

/** Branche le serveur WebSocket de jeu sur le serveur HTTP de fastify. */
export function registerGameSocket(app: FastifyInstance, service: IGameService): void {
  const wss = new WebSocketServer({ noServer: true });

  wss.on('connection', (socket: WebSocket) => {
    const sink: MessageSink = {
      send: message => { if (socket.readyState === socket.OPEN) socket.send(JSON.stringify(message)); },
    };
    const playerId = service.connect(sink);
    socket.on('message', data => {
      handleClientMessage(toText(data), playerId, service, sink).catch((error: unknown) => {
        app.log.error({ err: error, playerId }, 'Erreur pendant le traitement d\'un message');
        sink.send({ type: 'error', message: 'Erreur interne du serveur.' });
      });
    });
    socket.on('close', () => {
      service.disconnect(playerId).catch((error: unknown) => app.log.error({ err: error, playerId }, 'Erreur à la déconnexion'));
    });
  });

  app.server.on('upgrade', (request: IncomingMessage, socket: Duplex, head: Buffer) => {
    const { pathname } = new URL(request.url ?? '/', 'http://localhost');
    if (pathname !== GAME_SOCKET_PATH) {
      socket.destroy();
      return;
    }
    wss.handleUpgrade(request, socket, head, ws => wss.emit('connection', ws, request));
  });

  app.addHook('onClose', (_instance, done) => {
    for (const client of wss.clients) client.terminate();
    wss.close(() => done());
  });
}
