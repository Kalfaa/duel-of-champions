import type { ClientMessage, ServerMessage } from './protocol';

/** Sous-ensemble de l'API WebSocket du navigateur utilisé par GameSocket (remplaçable dans les tests). */
export interface SocketLike {
  readonly readyState: number;
  send(data: string): void;
  close(): void;
  addEventListener(type: 'open' | 'close', listener: () => void): void;
  addEventListener(type: 'message', listener: (event: { data: unknown }) => void): void;
}

const OPEN = 1;

/** Connexion au serveur de jeu : envoie les messages une fois la connexion ouverte et décode les réponses. */
export class GameSocket {
  private readonly pending: string[] = [];
  private readonly messageListeners: ((message: ServerMessage) => void)[] = [];
  private readonly closeListeners: (() => void)[] = [];

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
    socket.addEventListener('close', () => this.closeListeners.forEach(l => l()));
  }

  send(message: ClientMessage): void {
    const data = JSON.stringify(message);
    if (this.socket.readyState === OPEN) this.socket.send(data);
    else this.pending.push(data);
  }

  onMessage(listener: (message: ServerMessage) => void): void {
    this.messageListeners.push(listener);
  }

  onClose(listener: () => void): void {
    this.closeListeners.push(listener);
  }

  close(): void {
    this.socket.close();
  }
}

export function openBrowserSocket(): SocketLike {
  const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
  return new WebSocket(`${protocol}://${window.location.host}/ws`);
}
