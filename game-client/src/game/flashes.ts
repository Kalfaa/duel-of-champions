import type { GameEvent, Target } from '../api/protocol';

/** Nombre flottant affiché brièvement au-dessus d'une créature ou d'un héros. */
export interface Flash {
  id: number;
  text: string;
  heal: boolean;
}

export type FlashMap = ReadonlyMap<string, Flash>;

export const flashKey = (t: Target): string => (t.kind === 'hero' ? `hero-${t.player}` : `unit-${t.uid}`);

let nextFlashId = 0;

/** Crée un flash par dégât, soin ou renforcement, indexé par sa cible (attaques et ripostes sont animées à part). */
export function createFlashes(events: readonly GameEvent[]): [string, Flash][] {
  return events.flatMap((e): [string, Flash][] => {
    if (e.kind === 'attack' || e.kind === 'retaliate') return [];
    const text = e.kind === 'damage' ? `-${e.amount}` : e.kind === 'heal' ? `+${e.amount}` : '▲';
    return [[flashKey(e.target), { id: ++nextFlashId, text, heal: e.kind !== 'damage' }]];
  });
}

/** Ajoute des flashs ; un nouveau flash remplace celui déjà affiché sur la même cible. */
export function mergeFlashes(current: FlashMap, created: readonly [string, Flash][]): Map<string, Flash> {
  return new Map([...current, ...created]);
}

/** Retire les flashs dont l'identifiant fait partie de `ids` (ceux qui n'ont pas été remplacés entre-temps). */
export function removeFlashes(current: FlashMap, ids: ReadonlySet<number>): Map<string, Flash> {
  return new Map([...current].filter(([, f]) => !ids.has(f.id)));
}
