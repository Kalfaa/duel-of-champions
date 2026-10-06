/** Résultat d'une partie terminée, envoyé par le serveur de jeu. */
export type MatchResult =
  | { gameId: string; mode: 'pvp'; winnerId: string; loserId: string }
  | { gameId: string; mode: 'ai'; accountId: string; won: boolean };

/** Les deux résultats décrivent la même issue de partie. */
export function sameMatchResult(a: MatchResult, b: MatchResult): boolean {
  if (a.gameId !== b.gameId) return false;
  if (a.mode === 'pvp') return b.mode === 'pvp' && a.winnerId === b.winnerId && a.loserId === b.loserId;
  return b.mode === 'ai' && a.accountId === b.accountId && a.won === b.won;
}

/** Partie déjà prise en compte : un même résultat envoyé deux fois n'est compté qu'une fois. */
export interface RecordedMatch {
  result: MatchResult;
  recordedAt: Date;
}
