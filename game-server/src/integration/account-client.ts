/** Résultat d'une partie terminée, tel qu'attendu par le serveur de comptes. */
export type MatchReport =
  | { gameId: string; mode: 'pvp'; winnerId: string; loserId: string }
  | { gameId: string; mode: 'ai'; accountId: string; won: boolean };

export interface IAccountClient {
  /** Envoie le résultat ; ne lève jamais : un échec définitif est journalisé. */
  reportMatch(report: MatchReport): Promise<void>;
}

export interface WarningLogger {
  warn(details: object, message: string): void;
}

export type FetchFn = (url: string, init: { method: string; headers: Record<string, string>; body: string }) => Promise<{ ok: boolean; status: number }>;

const DEFAULT_RETRY_DELAYS_MS = [500, 2000];

/**
 * Client HTTP du serveur de comptes. Les erreurs réseau et 5xx sont retentées (le serveur de comptes
 * ignore un résultat déjà reçu), les autres refus (4xx) sont définitifs.
 */
export class HttpAccountClient implements IAccountClient {
  constructor(
    private readonly baseUrl: string,
    private readonly internalKey: string,
    private readonly fetchFn: FetchFn,
    private readonly logger: WarningLogger,
    private readonly wait: (ms: number) => Promise<void> = ms => new Promise(resolve => setTimeout(resolve, ms)),
    private readonly retryDelaysMs: readonly number[] = DEFAULT_RETRY_DELAYS_MS,
  ) {}

  async reportMatch(report: MatchReport): Promise<void> {
    const body = JSON.stringify(report);
    for (let attempt = 0; ; attempt++) {
      let failure: object;
      try {
        const response = await this.fetchFn(`${this.baseUrl}/internal/matches`, {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'x-internal-key': this.internalKey },
          body,
        });
        if (response.ok) return;
        failure = { status: response.status };
        if (response.status < 500) {
          this.logger.warn({ report, ...failure }, 'Résultat de partie refusé par le serveur de comptes');
          return;
        }
      } catch (error) {
        failure = { err: error };
      }
      const delay = this.retryDelaysMs[attempt];
      if (delay === undefined) {
        this.logger.warn({ report, ...failure }, 'Résultat de partie non transmis au serveur de comptes');
        return;
      }
      await this.wait(delay);
    }
  }
}
