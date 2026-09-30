import type { FactionSummary } from './protocol';

export async function fetchFactions(): Promise<FactionSummary[]> {
  const response = await fetch('/api/factions');
  if (!response.ok) throw new Error(`Le serveur a répondu ${response.status}.`);
  return (await response.json()) as FactionSummary[];
}
