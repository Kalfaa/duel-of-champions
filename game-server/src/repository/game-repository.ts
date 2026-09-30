import type { Game } from '../model/game';

export interface IGameRepository {
  get(id: string): Promise<Game | null>;
  /** Partie à laquelle participe encore ce joueur. */
  findByPlayer(playerId: string): Promise<Game | null>;
  save(game: Game): Promise<void>;
  delete(id: string): Promise<void>;
}

/**
 * Parties en mémoire : une partie ne survit pas à un redémarrage du serveur.
 * Les instances sont conservées telles quelles (pas de sérialisation), ce qui permet au service
 * de continuer à faire avancer une partie (combat, tour de l'IA) sur l'instance qu'il détient.
 */
export class InMemoryGameRepository implements IGameRepository {
  constructor(private readonly store: Map<string, Game>) {}

  async get(id: string): Promise<Game | null> {
    return this.store.get(id) ?? null;
  }

  async findByPlayer(playerId: string): Promise<Game | null> {
    for (const game of this.store.values()) if (game.indexOf(playerId) !== null) return game;
    return null;
  }

  async save(game: Game): Promise<void> {
    this.store.set(game.id, game);
  }

  async delete(id: string): Promise<void> {
    this.store.delete(id);
  }
}
