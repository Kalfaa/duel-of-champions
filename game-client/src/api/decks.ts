import type { DeckSummary } from './protocol';

export async function fetchDecks(): Promise<DeckSummary[]> {
  const response = await fetch('/api/decks');
  if (!response.ok) throw new Error(`Le serveur a répondu ${response.status}.`);
  return (await response.json()) as DeckSummary[];
}
