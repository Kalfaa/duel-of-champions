import type { CardView, HandOption } from '../api/protocol';

/**
 * Indices des cartes de la main dans l'ordre d'affichage : de la moins chère à la plus chère.
 * Le coût réel (modifié par les événements) prime sur le coût imprimé ; à coût égal, l'ordre de la main est conservé.
 */
export function handOrder(hand: readonly CardView[], options?: readonly (HandOption | undefined)[]): number[] {
  const cost = (i: number) => options?.[i]?.cost ?? hand[i]!.cost;
  return hand.map((_, i) => i).sort((a, b) => cost(a) - cost(b) || a - b);
}
