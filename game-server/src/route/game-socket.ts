import type { IncomingMessage } from 'node:http';
import type { Duplex } from 'node:stream';
import type { FastifyInstance } from 'fastify';
import { WebSocketServer, type RawData, type WebSocket } from 'ws';
import { GameRuleError } from '../model/errors';
import type { IAuthService } from '../service/auth-service';
import { AlreadyInGameError, NotInGameError, UnauthenticatedError } from '../service/errors';
import type { IGameService } from '../service/game-service';
import type { PlayerIdentity } from '../service/ports';
import { clientMessageSchema, type ServerMessage } from './protocol';

export const GAME_SOCKET_PATH = '/ws';
/** Code de fermeture envoyé quand le jeton d'accès est absent ou invalide : le client doit se reconnecter. */
export const UNAUTHENTICATED_CLOSE_CODE = 4401;

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
      case 'startAi': return await service.startAiGame(playerId, message.deck);
      case 'findMatch': return await service.findMatch(playerId, message.deck);
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

/**
 * Branche le serveur WebSocket de jeu sur le serveur HTTP de fastify. Le navigateur ne pouvant pas
 * envoyer d'en-tête sur un WebSocket, le jeton d'accès est passé dans l'URL : `/ws?token=…`.
 */
export function registerGameSocket(app: FastifyInstance, service: IGameService, auth: IAuthService): void {
  const wss = new WebSocketServer({ noServer: true });

  wss.on('connection', (socket: WebSocket, identity: PlayerIdentity) => {
    const sink: MessageSink = {
      send: message => { if (socket.readyState === socket.OPEN) socket.send(JSON.stringify(message)); },
    };
    const playerId = service.connect(sink, identity);
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
    const url = new URL(request.url ?? '/', 'http://localhost');
    if (url.pathname !== GAME_SOCKET_PATH) {
      socket.destroy();
      return;
    }
    auth.authenticate(url.searchParams.get('token')).then(
      identity => wss.handleUpgrade(request, socket, head, ws => wss.emit('connection', ws, identity)),
      (error: unknown) => {
        if (!(error instanceof UnauthenticatedError)) {
          app.log.error({ err: error }, 'Erreur pendant l\'authentification');
          socket.destroy();
          return;
        }
        // Connexion acceptée puis refermée avec un code dédié, que le navigateur peut lire (contrairement à un refus HTTP)
        wss.handleUpgrade(request, socket, head, ws => ws.close(UNAUTHENTICATED_CLOSE_CODE, error.message));
      },
    );
  });

  app.addHook('onClose', (_instance, done) => {
    for (const client of wss.clients) client.terminate();
    wss.close(() => done());
  });
}
