/** Action refusée par les règles du jeu. Le message est destiné au joueur. */
export class GameRuleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GameRuleError';
  }
}
