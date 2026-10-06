export class NotInGameError extends Error {
  constructor() {
    super('Vous n\'êtes dans aucune partie.');
    this.name = 'NotInGameError';
  }
}

export class AlreadyInGameError extends Error {
  constructor() {
    super('Vous êtes déjà dans une partie ou en recherche d\'adversaire.');
    this.name = 'AlreadyInGameError';
  }
}

export class UnknownPlayerError extends Error {
  constructor(playerId: string) {
    super(`Joueur inconnu : ${playerId}`);
    this.name = 'UnknownPlayerError';
  }
}

export class UnauthenticatedError extends Error {
  constructor() {
    super('Session invalide ou expirée : reconnectez-vous.');
    this.name = 'UnauthenticatedError';
  }
}
