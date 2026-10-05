/** Durée du vol d'une carte, et décalage entre deux cartes piochées ensemble. */
const DRAW_FLIGHT_MS = 600;
const DRAW_STAGGER_MS = 150;

/** Fait voler les cartes depuis la bibliothèque (`deck`) jusqu'à leur place dans la main, l'une après l'autre. */
export function animateDraw(cards: readonly HTMLElement[], deck: HTMLElement | null): void {
  if (!deck || !cards.length || typeof cards[0]!.animate !== 'function') return;
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
  const from = deck.getBoundingClientRect();
  cards.forEach((card, i) => {
    const to = card.getBoundingClientRect();
    const dx = from.left + from.width / 2 - (to.left + to.width / 2);
    const dy = from.top + from.height / 2 - (to.top + to.height / 2);
    const scale = Math.min(1, from.width / to.width);
    card.animate([
      { transform: `translate(${dx}px, ${dy}px) scale(${scale}) rotate(-14deg)`, filter: 'brightness(.35)', opacity: 0.4 },
      { transform: `translate(${dx * 0.35}px, ${dy * 0.35 - 40}px) scale(1.1) rotate(-4deg)`, filter: 'brightness(1)', opacity: 1, offset: 0.6 },
      { transform: 'none', filter: 'none', opacity: 1 },
    ], { duration: DRAW_FLIGHT_MS, delay: i * DRAW_STAGGER_MS, easing: 'cubic-bezier(.25,.8,.3,1)', fill: 'backwards' });
  });
}

/** Les `count` dernières cartes d'une main (les cartes piochées sont ajoutées à la fin). */
export const lastCards = (container: HTMLElement, selector: string, count: number): HTMLElement[] =>
  count > 0 ? [...container.querySelectorAll<HTMLElement>(selector)].slice(-count) : [];
