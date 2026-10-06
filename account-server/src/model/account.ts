import { INITIAL_RATING, ratingDelta } from './elo';
import { InvalidUsernameError, SelfMatchError } from './errors';

const USERNAME_PATTERN = /^[A-Za-z0-9_-]{3,20}$/;

export interface AccountStats {
  pvpWins: number;
  pvpLosses: number;
  aiWins: number;
  aiLosses: number;
}

export interface AccountState {
  id: string;
  username: string;
  passwordHash: string;
  rating: number;
  stats: AccountStats;
  createdAt: Date;
}

/** Évolution du classement d'un joueur après une partie classée. */
export interface RatingChange {
  accountId: string;
  before: number;
  after: number;
}

const NO_STATS: AccountStats = { pvpWins: 0, pvpLosses: 0, aiWins: 0, aiLosses: 0 };

/** Compte d'un joueur : identité, classement Elo et statistiques de jeu. */
export class Account {
  readonly id: string;
  readonly username: string;
  readonly passwordHash: string;
  readonly createdAt: Date;
  private currentRating: number;
  private readonly record: AccountStats;

  constructor(state: AccountState) {
    this.id = state.id;
    this.username = state.username;
    this.passwordHash = state.passwordHash;
    this.createdAt = state.createdAt;
    this.currentRating = state.rating;
    this.record = { ...state.stats };
  }

  /** Nouveau compte : le pseudo doit respecter le format autorisé. */
  static register(opts: { id: string; username: string; passwordHash: string; createdAt: Date }): Account {
    Account.assertValidUsername(opts.username);
    return new Account({ ...opts, rating: INITIAL_RATING, stats: NO_STATS });
  }

  static assertValidUsername(username: string): void {
    if (!USERNAME_PATTERN.test(username)) throw new InvalidUsernameError();
  }

  /** Forme normalisée d'un pseudo : deux pseudos qui ne diffèrent que par la casse sont identiques. */
  static usernameKey(username: string): string {
    return username.toLowerCase();
  }

  /** Classement Elo de la partie joueur contre joueur. */
  get rating(): number { return this.currentRating; }
  get stats(): AccountStats { return { ...this.record }; }
  get pvpGames(): number { return this.record.pvpWins + this.record.pvpLosses; }

  /** Partie contre l'IA : comptée dans les statistiques, sans effet sur le classement. */
  recordAiGame(won: boolean): void {
    if (won) this.record.aiWins++;
    else this.record.aiLosses++;
  }

  /** Partie classée : le vainqueur prend au vaincu des points de classement selon leur écart. */
  static settlePvp(winner: Account, loser: Account): [RatingChange, RatingChange] {
    if (winner.id === loser.id) throw new SelfMatchError();
    const delta = ratingDelta(winner.currentRating, loser.currentRating);
    const changes: [RatingChange, RatingChange] = [
      { accountId: winner.id, before: winner.currentRating, after: winner.currentRating + delta },
      { accountId: loser.id, before: loser.currentRating, after: loser.currentRating - delta },
    ];
    winner.currentRating += delta;
    winner.record.pvpWins++;
    loser.currentRating -= delta;
    loser.record.pvpLosses++;
    return changes;
  }
}
