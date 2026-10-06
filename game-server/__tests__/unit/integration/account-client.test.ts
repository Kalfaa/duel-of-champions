import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { HttpAccountClient, type FetchFn, type MatchReport, type WarningLogger } from '../../../src/integration/account-client';

const report: MatchReport = { gameId: 'g1', mode: 'pvp', winnerId: 'a', loserId: 'b' };

describe('HttpAccountClient', () => {
  let fetchFn: Mock<FetchFn>;
  let logger: { warn: Mock<WarningLogger['warn']> };
  let wait: Mock<(ms: number) => Promise<void>>;
  let client: HttpAccountClient;

  beforeEach(() => {
    fetchFn = vi.fn<FetchFn>(async () => ({ ok: true, status: 200 }));
    logger = { warn: vi.fn<WarningLogger['warn']>() };
    wait = vi.fn(async (_ms: number) => {});
    client = new HttpAccountClient('http://comptes', 'cle-interne', fetchFn, logger, wait, [10, 20]);
  });

  it('envoie le résultat avec la clé interne', async () => {
    await client.reportMatch(report);
    expect(fetchFn).toHaveBeenCalledExactlyOnceWith('http://comptes/internal/matches', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-internal-key': 'cle-interne' },
      body: JSON.stringify(report),
    });
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('retente après une erreur réseau ou serveur', async () => {
    fetchFn.mockRejectedValueOnce(new Error('ECONNREFUSED')).mockResolvedValueOnce({ ok: false, status: 503 });
    await client.reportMatch(report);
    expect(fetchFn).toHaveBeenCalledTimes(3);
    expect(wait.mock.calls).toEqual([[10], [20]]);
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('abandonne et journalise après la dernière tentative, sans lever d\'erreur', async () => {
    fetchFn.mockRejectedValue(new Error('ECONNREFUSED'));
    await expect(client.reportMatch(report)).resolves.toBeUndefined();
    expect(fetchFn).toHaveBeenCalledTimes(3);
    expect(logger.warn).toHaveBeenCalledOnce();
  });

  it('ne retente pas un résultat refusé', async () => {
    fetchFn.mockResolvedValue({ ok: false, status: 404 });
    await client.reportMatch(report);
    expect(fetchFn).toHaveBeenCalledOnce();
    expect(logger.warn).toHaveBeenCalledWith({ report, status: 404 }, expect.any(String));
  });
});
