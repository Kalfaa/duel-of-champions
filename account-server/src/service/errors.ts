export class InvalidCredentialsError extends Error {
  constructor() {
    super('Pseudo ou mot de passe incorrect.');
    this.name = 'InvalidCredentialsError';
  }
}

export class UnauthenticatedError extends Error {
  constructor() {
    super('Session invalide ou expirée : reconnectez-vous.');
    this.name = 'UnauthenticatedError';
  }
}

export class AccountNotFoundError extends Error {
  constructor(accountId: string) {
    super(`Compte inconnu : ${accountId}`);
    this.name = 'AccountNotFoundError';
  }
}

/** Le même identifiant de partie a déjà été enregistré avec un autre résultat. */
export class ConflictingMatchError extends Error {
  constructor(gameId: string) {
    super(`La partie ${gameId} a déjà été enregistrée avec un autre résultat.`);
    this.name = 'ConflictingMatchError';
  }
}
