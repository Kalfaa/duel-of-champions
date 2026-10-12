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

export class DeckNotFoundError extends Error {
  constructor() {
    super('Ce deck n\'existe pas.');
    this.name = 'DeckNotFoundError';
  }
}

/** Le serveur de comptes a refusé d'enregistrer le deck (nom invalide, trop de decks…). */
export class DeckRejectedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DeckRejectedError';
  }
}

/** Les decks ne peuvent pas être lus ou enregistrés pour l'instant. */
export class DeckStorageUnavailableError extends Error {
  constructor() {
    super('Les decks sont indisponibles pour l\'instant : réessayez dans un instant.');
    this.name = 'DeckStorageUnavailableError';
  }
}
