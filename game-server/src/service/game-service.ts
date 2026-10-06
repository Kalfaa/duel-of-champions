import type { AiStrategy } from '../model/ai-player';
import { assertPlayableDeck, DECKS, PLAYABLE_DECKS } from '../model/decks';
import { FACTIONS } from '../model/factions';
import { Game } from '../model/game';
import { buildPlayerView, toHeroView, type HeroView } from '../model/game-view';
import type { IMatchmakingQueue } from '../model/matchmaking-queue';
import { type DeckId, type FactionId, type GameAction, type PlayerIndex } from '../model/types';
import type { IAccountClient } from '../integration/account-client';
import type { IGameRepository } from '../repository/game-repository';
import { AlreadyInGameError, NotInGameError, UnknownPlayerError } from './errors';
import type { IDelay, IIdGenerator, IPlayerChannel, ISeedSource, PlayerIdentity } from './ports';

/** Deck jouable, tel que proposé au joueur. */
export interface DeckSummary {
  id: DeckId;
  faction: FactionId;
  factionLabel: string;
  factionIcon: string;
  description: string;
  hero: HeroView;
}

export interface IGameService {
  listDecks(): DeckSummary[];
  /** Enregistre la connexion d'un joueur authentifié et retourne son identifiant de connexion. */
  connect(channel: IPlayerChannel, identity: PlayerIdentity): string;
  disconnect(playerId: string): Promise<void>;
  startAiGame(playerId: string, deck: DeckId): Promise<void>;
  findMatch(playerId: string, deck: DeckId): Promise<void>;
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

interface Connection {
  channel: IPlayerChannel;
  identity: PlayerIdentity;
}

export class GameService implements IGameService {
  private readonly connections = new Map<string, Connection>();

  constructor(
    private readonly games: IGameRepository,
    private readonly queue: IMatchmakingQueue,
    private readonly ai: AiStrategy,
    private readonly delay: IDelay,
    private readonly ids: IIdGenerator,
    private readonly seeds: ISeedSource,
    private readonly accounts: IAccountClient,
    private readonly delays: PacingDelays = DEFAULT_DELAYS,
  ) {}

  listDecks(): DeckSummary[] {
    return PLAYABLE_DECKS.map(id => {
      const deck = DECKS[id];
      const faction = FACTIONS[deck.faction];
      return {
        id, faction: deck.faction, factionLabel: faction.label, factionIcon: faction.icon,
        description: deck.description, hero: toHeroView(deck.hero),
      };
    });
  }

  connect(channel: IPlayerChannel, identity: PlayerIdentity): string {
    const playerId = this.ids.next();
    this.connections.set(playerId, { channel, identity });
    return playerId;
  }

  async disconnect(playerId: string): Promise<void> {
    await this.leave(playerId);
    this.connections.delete(playerId);
  }

  async startAiGame(playerId: string, deck: DeckId): Promise<void> {
    assertPlayableDeck(deck);
    const { accountId, name } = this.identity(playerId);
    await this.ensureAvailable(playerId);
    const game = Game.createAgainstAi({ id: this.ids.next(), seed: this.seeds.next(), player: { id: playerId, deck, accountId, name } });
    await this.publish(game);
    await this.advance(game);
  }

  async findMatch(playerId: string, deck: DeckId): Promise<void> {
    assertPlayableDeck(deck);
    const { accountId, name } = this.identity(playerId);
    await this.ensureAvailable(playerId);
    const pair = this.queue.join({ playerId, accountId, name, deck });
    if (!pair) {
      this.connections.get(playerId)?.channel.send({ type: 'waiting' });
      return;
    }
    const [a, b] = pair;
    const seat = (t: typeof a) => ({ id: t.playerId, deck: t.deck, isAi: false, accountId: t.accountId, name: t.name });
    const game = Game.create({ id: this.ids.next(), seed: this.seeds.next(), players: [seat(a), seat(b)] });
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

  private identity(playerId: string): PlayerIdentity {
    const connection = this.connections.get(playerId);
    if (!connection) throw new UnknownPlayerError(playerId);
    return connection.identity;
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
    const wasOver = game.isOver;
    game.leave(pi);
    if (game.isAbandoned) await this.games.delete(game.id);
    else await this.publish(game);
    if (!wasOver) await this.reportOutcome(game);
  }

  /** Transmet l'issue d'une partie qui vient de se terminer au serveur de comptes (classement et statistiques). */
  private async reportOutcome(game: Game): Promise<void> {
    const outcome = game.outcome();
    if (outcome) await this.accounts.reportMatch(outcome);
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
    const wasOver = game.isOver;
    await this.resolve(game, pi, action);
    if (!wasOver && game.isOver) await this.reportOutcome(game);
  }

  private async resolve(game: Game, pi: PlayerIndex, action: GameAction): Promise<void> {
    game.apply(pi, action);
    await this.publish(game);
    if (game.pending) {
      await this.delay.wait(this.delays.cardReveal);
      if (game.isOver) return;
      game.resolvePending();
      await this.publish(game);
    }
    // Une Double attaque peut entraîner une seconde riposte après la première
    while (game.hasPendingRetaliation) {
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
      this.connections.get(game.player(pi).id)?.channel.send({ type: 'state', view: buildPlayerView(game, pi), events });
    }
  }
}
