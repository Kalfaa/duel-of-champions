import { Account, type RatingChange } from '../model/account';
import { sameMatchResult, type MatchResult } from '../model/match';
import type { IAccountRepository } from '../repository/account-repository';
import type { IMatchRepository } from '../repository/match-repository';
import type { ITransactionRunner } from '../repository/transaction';
import { AccountNotFoundError, ConflictingMatchError } from './errors';
import type { IClock } from './ports';

export interface MatchOutcome {
  /** false si la partie avait déjà été enregistrée (renvoi du même résultat). */
  recorded: boolean;
  /** Évolution des classements (parties classées uniquement). */
  ratings: RatingChange[];
}

export interface IMatchService {
  record(result: MatchResult): Promise<MatchOutcome>;
}

export class MatchService implements IMatchService {
  constructor(
    private readonly accounts: IAccountRepository,
    private readonly matches: IMatchRepository,
    private readonly transactions: ITransactionRunner,
    private readonly clock: IClock,
  ) {}

  /** Met à jour classements et statistiques ; un résultat renvoyé (nouvelle tentative) n'est compté qu'une fois. */
  async record(result: MatchResult): Promise<MatchOutcome> {
    return this.transactions.run(async () => {
      const existing = await this.matches.get(result.gameId);
      if (existing) {
        if (!sameMatchResult(existing.result, result)) throw new ConflictingMatchError(result.gameId);
        return { recorded: false, ratings: [] };
      }

      let ratings: RatingChange[] = [];
      if (result.mode === 'pvp') {
        const winner = await this.load(result.winnerId);
        const loser = await this.load(result.loserId);
        ratings = Account.settlePvp(winner, loser);
        await this.accounts.save(winner);
        await this.accounts.save(loser);
      } else {
        const account = await this.load(result.accountId);
        account.recordAiGame(result.won);
        await this.accounts.save(account);
      }
      await this.matches.save({ result, recordedAt: this.clock.now() });
      return { recorded: true, ratings };
    });
  }

  private async load(accountId: string): Promise<Account> {
    const account = await this.accounts.get(accountId);
    if (!account) throw new AccountNotFoundError(accountId);
    return account;
  }
}
