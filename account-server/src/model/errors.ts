/** Erreur levée quand une règle métier des comptes n'est pas respectée. */
export class AccountRuleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AccountRuleError';
  }
}

export class InvalidUsernameError extends AccountRuleError {
  constructor() {
    super('Le pseudo doit faire de 3 à 20 caractères : lettres, chiffres, « _ » ou « - ».');
    this.name = 'InvalidUsernameError';
  }
}

export class UsernameTakenError extends AccountRuleError {
  constructor(username: string) {
    super(`Le pseudo « ${username} » est déjà pris.`);
    this.name = 'UsernameTakenError';
  }
}

export class SelfMatchError extends AccountRuleError {
  constructor() {
    super('Un joueur ne peut pas jouer contre lui-même.');
    this.name = 'SelfMatchError';
  }
}
