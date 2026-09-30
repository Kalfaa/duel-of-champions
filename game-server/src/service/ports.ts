import type { GameEvent } from '../model/game';
import type { PlayerGameView } from '../model/game-view';

/** Messages envoyés par le service à un joueur connecté. */
export type GameNotification =
  | { type: 'waiting' }
  | { type: 'state'; view: PlayerGameView; events: GameEvent[] };

/** Canal vers un joueur connecté (implémenté par la couche route au-dessus d'un WebSocket). */
export interface IPlayerChannel {
  send(notification: GameNotification): void;
}

export interface IDelay {
  wait(ms: number): Promise<void>;
}

export interface IIdGenerator {
  next(): string;
}

export interface ISeedSource {
  next(): number;
}
