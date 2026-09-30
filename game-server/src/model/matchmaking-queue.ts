import { GameRuleError } from './errors';
import type { FactionId } from './types';

export interface QueueTicket {
  playerId: string;
  faction: FactionId;
}

export interface IMatchmakingQueue {
  join(ticket: QueueTicket): [QueueTicket, QueueTicket] | null;
  leave(playerId: string): boolean;
  has(playerId: string): boolean;
}

/** File d'attente joueur contre joueur : apparie les joueurs dans leur ordre d'arrivée. */
export class MatchmakingQueue implements IMatchmakingQueue {
  private readonly waiting: QueueTicket[] = [];

  /** Ajoute le joueur ; retourne la paire formée si un adversaire attendait déjà. */
  join(ticket: QueueTicket): [QueueTicket, QueueTicket] | null {
    if (this.has(ticket.playerId)) throw new GameRuleError('Vous êtes déjà en recherche d\'adversaire.');
    const opponent = this.waiting.shift();
    if (!opponent) {
      this.waiting.push(ticket);
      return null;
    }
    return [opponent, ticket];
  }

  leave(playerId: string): boolean {
    const i = this.waiting.findIndex(t => t.playerId === playerId);
    if (i === -1) return false;
    this.waiting.splice(i, 1);
    return true;
  }

  has(playerId: string): boolean {
    return this.waiting.some(t => t.playerId === playerId);
  }
}
