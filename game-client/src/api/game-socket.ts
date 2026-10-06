import type { ClientMessage, ServerMessage } from './protocol';

/** Sous-ensemble de l'API WebSocket du navigateur utilisé par GameSocket (remplaçable dans les tests). */
export interface SocketLike {
  readonly readyState: number;
  send(data: string): void;
  close(): void;
  addEventListener(type: 'open', listener: () => void): void;
  addEventListener(type: 'close', listener: (event: { code: number }) => void): void;
  addEventListener(type: 'message', listener: (event: { data: unknown }) => void): void;
}

const OPEN = 1;
/** Code de fermeture du serveur de jeu quand le jeton d'accès est absent ou invalide. */
export const UNAUTHENTICATED_CLOSE_CODE = 4401;

/** Connexion au serveur de jeu : envoie les messages une fois la connexion ouverte et décode les réponses. */
export class GameSocket {
  private readonly pending: string[] = [];
  private readonly messageListeners: ((message: ServerMessage) => void)[] = [];
  private readonly closeListeners: ((code: number) => void)[] = [];

  constructor(private readonly socket: SocketLike) {
    socket.addEventListener('open', () => {
      for (const data of this.pending.splice(0)) socket.send(data);
    });
    socket.addEventListener('message', event => {
      if (typeof event.data !== 'string') return;
      let message: ServerMessage;
      try {
        message = JSON.parse(event.data) as ServerMessage;
      } catch {
        return;
      }
      this.messageListeners.forEach(l => l(message));
    });
    socket.addEventListener('close', event => this.closeListeners.forEach(l => l(event.code)));
  }

  send(message: ClientMessage): void {
    const data = JSON.stringify(message);
    if (this.socket.readyState === OPEN) this.socket.send(data);
    else this.pending.push(data);
  }

  onMessage(listener: (message: ServerMessage) => void): void {
    this.messageListeners.push(listener);
  }

  /** Prévient de la fermeture, avec son code (voir UNAUTHENTICATED_CLOSE_CODE). */
  onClose(listener: (code: number) => void): void {
    this.closeListeners.push(listener);
  }

  close(): void {
    this.socket.close();
  }
}

/** Le navigateur ne pouvant pas ajouter d'en-tête à un WebSocket, le jeton d'accès est passé dans l'URL. */
export function openBrowserSocket(token: string): SocketLike {
  const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
  return new WebSocket(`${protocol}://${window.location.host}/ws?token=${encodeURIComponent(token)}`);
}
