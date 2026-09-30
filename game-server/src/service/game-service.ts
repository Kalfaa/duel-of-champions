import type { AiStrategy } from '../model/ai-player';
import { FACTIONS } from '../model/factions';
import { Game } from '../model/game';
import { buildPlayerView } from '../model/game-view';
import type { IMatchmakingQueue } from '../model/matchmaking-queue';
import { FACTION_IDS, type FactionId, type GameAction, type PlayerIndex } from '../model/types';
import type { IGameRepository } from '../repository/game-repository';
import { AlreadyInGameError, NotInGameError } from './errors';
import type { IDelay, IIdGenerator, IPlayerChannel, ISeedSource } from './ports';

export interface FactionSummary {
  id: FactionId;
  label: string;
  icon: string;
  description: string;
  hero: { name: string; icon: string; art: string; power: { name: string; cost: number; text: string } };
}

export interface IGameService {
  listFactions(): FactionSummary[];
  /** Enregistre un joueur connecté et retourne son identifiant. */
  connect(channel: IPlayerChannel): string;
  disconnect(playerId: string): Promise<void>;
  startAiGame(playerId: string, faction: FactionId): Promise<void>;
  findMatch(playerId: string, faction: FactionId): Promise<void>;
  act(playerId: string, action: GameAction): Promise<void>;
  /** Quitte la file d'attente ou la partie en cours (abandon si elle n'est pas terminée). */
  leave(playerId: string): Promise<void>;
}

/** Pauses (ms) laissées aux clients pour suivre la partie. */
export interface PacingDelays {
  /** Entre deux actions de l'IA. */
  aiAction: number;
  /** Avant la première action de l'IA à son tour : le temps que les clients affichent le bandeau de changement de tour. */
  turnStart: number;
  /** Durée pendant laquelle une carte jouée reste affichée avant d'être résolue. */
  cardReveal: number;
  /** Entre une attaque et la riposte du défenseur. */
  retaliation: number;
}

/** `turnStart` est aligné avec la durée du bandeau de changement de tour du client (1,6 s). */
export const DEFAULT_DELAYS: PacingDelays = { aiAction: 700, turnStart: 1600, cardReveal: 1000, retaliation: 500 };

/** Garde-fou contre une IA qui ne terminerait jamais son tour. */
const MAX_AI_ACTIONS_PER_TURN = 40;

export class GameService implements IGameService {
  private readonly channels = new Map<string, IPlayerChannel>();

  constructor(
    private readonly games: IGameRepository,
    private readonly queue: IMatchmakingQueue,
    private readonly ai: AiStrategy,
    private readonly delay: IDelay,
    private readonly ids: IIdGenerator,
    private readonly seeds: ISeedSource,
    private readonly delays: PacingDelays = DEFAULT_DELAYS,
  ) {}

  listFactions(): FactionSummary[] {
    return FACTION_IDS.map(id => {
      const f = FACTIONS[id];
      const { name, cost, text } = f.hero.power;
      return {
        id, label: f.label, icon: f.icon, description: f.description,
        hero: { name: f.hero.name, icon: f.hero.icon, art: f.hero.art, power: { name, cost, text } },
      };
    });
  }

  connect(channel: IPlayerChannel): string {
    const playerId = this.ids.next();
    this.channels.set(playerId, channel);
    return playerId;
  }

  async disconnect(playerId: string): Promise<void> {
    await this.leave(playerId);
    this.channels.delete(playerId);
  }

  async startAiGame(playerId: string, faction: FactionId): Promise<void> {
    await this.ensureAvailable(playerId);
    const game = Game.createAgainstAi({ id: this.ids.next(), seed: this.seeds.next(), playerId, faction });
    await this.publish(game);
    await this.advance(game);
  }

  async findMatch(playerId: string, faction: FactionId): Promise<void> {
    await this.ensureAvailable(playerId);
    const pair = this.queue.join({ playerId, faction });
    if (!pair) {
      this.channels.get(playerId)?.send({ type: 'waiting' });
      return;
    }
    const [a, b] = pair;
    const game = Game.create({
      id: this.ids.next(),
      seed: this.seeds.next(),
      players: [{ id: a.playerId, faction: a.faction, isAi: false }, { id: b.playerId, faction: b.faction, isAi: false }],
    });
    await this.publish(game);
    await this.advance(game);
  }

  async act(playerId: string, action: GameAction): Promise<void> {
    const game = await this.games.findByPlayer(playerId);
    const pi = game?.indexOf(playerId);
    if (!game || pi === null || pi === undefined) throw new NotInGameError();
    await this.perform(game, pi, action);
    await this.advance(game);
  }

  async leave(playerId: string): Promise<void> {
    this.queue.leave(playerId);
    const game = await this.games.findByPlayer(playerId);
    const pi = game?.indexOf(playerId);
    if (!game || pi === null || pi === undefined) return;
    await this.detach(game, pi);
  }

  private async ensureAvailable(playerId: string): Promise<void> {
    if (this.queue.has(playerId)) throw new AlreadyInGameError();
    const game = await this.games.findByPlayer(playerId);
    if (!game) return;
    if (!game.isOver) throw new AlreadyInGameError();
    // La partie précédente est terminée : le joueur peut en commencer une autre.
    await this.detach(game, game.indexOf(playerId)!);
  }

  private async detach(game: Game, pi: PlayerIndex): Promise<void> {
    game.leave(pi);
    if (game.isAbandoned) await this.games.delete(game.id);
    else await this.publish(game);
  }

  /**
   * Fait jouer l'IA tant que c'est son tour ; chaque action est précédée d'une pause, plus longue
   * au début de son tour pour laisser passer le bandeau de changement de tour.
   */
  private async advance(game: Game): Promise<void> {
    let aiActions = 0;
    let turnStart = true;
    while (!game.isOver && game.currentIsAi) {
      await this.delay.wait(turnStart ? this.delays.turnStart : this.delays.aiAction);
      turnStart = false;
      if (game.isOver) return;
      const action: GameAction = ++aiActions > MAX_AI_ACTIONS_PER_TURN ? { type: 'endTurn' } : this.ai.chooseAction(game, game.current);
      if (action.type === 'endTurn') aiActions = 0;
      await this.perform(game, game.current, action);
    }
  }

  /**
   * Applique une action et la diffuse. Une carte jouée reste affichée un instant avant d'être résolue,
   * et la riposte d'un défenseur est diffusée séparément, juste après l'attaque.
   */
  private async perform(game: Game, pi: PlayerIndex, action: GameAction): Promise<void> {
    game.apply(pi, action);
    await this.publish(game);
    if (game.pending) {
      await this.delay.wait(this.delays.cardReveal);
      if (game.isOver) return;
      game.resolvePending();
      await this.publish(game);
    }
    if (game.hasPendingRetaliation) {
      await this.delay.wait(this.delays.retaliation);
      if (game.isOver) return;
      game.resolveRetaliation();
      await this.publish(game);
    }
  }

  private async publish(game: Game): Promise<void> {
    await this.games.save(game);
    const events = game.drainEvents();
    for (const pi of game.humanPlayers()) {
      this.channels.get(game.player(pi).id)?.send({ type: 'state', view: buildPlayerView(game, pi), events });
    }
  }
}
