import type { ExpansionId } from './types';

export interface Expansion {
  id: ExpansionId;
  name: string;
  /** Nom de l'icône dans img/expansion/ (sans extension). */
  image: string;
}

export const EXPANSIONS: Readonly<Record<ExpansionId, Expansion>> = {
  base: { id: 'base', name: 'Édition de base', image: 'base' },
  voidRising: { id: 'voidRising', name: 'Ascension du vide', image: 'void-rising' },
  heraldOfTheVoid: { id: 'heraldOfTheVoid', name: 'Herald of the Void', image: 'herald-of-the-void' },
};
