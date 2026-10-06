/** Classement de départ d'un nouveau compte. */
export const INITIAL_RATING = 1000;

/** Amplitude maximale d'un changement de classement en une partie. */
const K_FACTOR = 32;

/** Probabilité de victoire attendue du joueur classé `rating` face à `opponent`. */
export function expectedScore(rating: number, opponent: number): number {
  return 1 / (1 + 10 ** ((opponent - rating) / 400));
}

/**
 * Points gagnés par le vainqueur et perdus par le vaincu (somme nulle).
 * Battre un adversaire mieux classé rapporte davantage ; une victoire rapporte toujours au moins 1 point.
 */
export function ratingDelta(winnerRating: number, loserRating: number): number {
  return Math.max(1, Math.round(K_FACTOR * (1 - expectedScore(winnerRating, loserRating))));
}
