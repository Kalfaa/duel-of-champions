import type { FactionId } from './types';

export interface Faction {
  id: FactionId;
  label: string;
  icon: string;
}

export const FACTIONS: Readonly<Record<FactionId, Faction>> = {
  havre: { id: 'havre', label: 'Havre', icon: '🦅' },
  necropole: { id: 'necropole', label: 'Nécropole', icon: '💀' },
  inferno: { id: 'inferno', label: 'Inferno', icon: '🔥' },
  sanctuaire: { id: 'sanctuaire', label: 'Sanctuaire', icon: '🪷' },
  bastion: { id: 'bastion', label: 'Bastion', icon: '🪓' },
};
