import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { CardInspector, resolveInspect, type Inspect } from '../../../src/components/CardInspector';
import { card, gameEvent, player, unit, view } from '../fixtures';

const render = (v: ReturnType<typeof view>, target: Inspect) =>
  renderToStaticMarkup(<CardInspector view={v} target={target} onClose={() => {}} />);

describe('CardInspector', () => {
  it('affiche en grand une carte de la main avec le texte complet de ses capacités', () => {
    const seraphin = card({ name: 'Séraphin guerrier', attackType: 'flyer', req: { m: 3, g: 1 }, keywords: { regen: 2 }, text: 'Bénit ses voisines.' });
    const html = render(view({ players: [player({ hand: [seraphin], m: 3, g: 0 }), player({ hand: null })] }), { kind: 'hand', index: 0 });
    expect(html).toContain('class="icard creature"');
    expect(html).toContain('Séraphin guerrier');
    expect(html).toContain('Créature – 🪽 Volant');
    expect(html).toContain('<b>Régénération 2</b> (Au ravitaillement, soigne 2.)');
    expect(html).toContain('Bénit ses voisines.');
    expect(html).toContain('class="sb g miss"');
  });

  it('montre les caractéristiques actuelles et l\'état d\'une créature du plateau', () => {
    const board = [[null, unit(7, { atk: 4, hpCur: 1, hpMax: 3, poison: 2 }), null, null], [null, null, null, null]];
    const html = render(view({ players: [player(), player({ hand: null, board })] }), { kind: 'unit', uid: 7 });
    expect(html).toContain('<span class="b atk" title="Attaque">4</span>');
    expect(html).toContain('title="Points de vie : 1/3"');
    expect(html).toContain('☠️ Poison 2');
  });

  it('affiche le héros, ses caractéristiques de départ non nulles et son pouvoir', () => {
    const html = render(view(), { kind: 'hero', player: 1 });
    expect(html).toContain('class="icard hero"');
    expect(html).toContain('Héros – Inferno');
    expect(html).toContain('✨ Ferveur · 0💎');
    expect(html).toContain('<span class="sb m" title="Puissance 2">2</span>');
    expect(html).toContain('<span class="sb d" title="Destinée 1">1</span>');
    expect(html).not.toContain('title="Magie 0"');
  });

  it('ne s\'affiche plus quand la carte inspectée a disparu', () => {
    expect(resolveInspect(view(), { kind: 'unit', uid: 99 })).toBeNull();
    expect(render(view(), { kind: 'hand', index: 3 })).toBe('');
  });

  it('affiche un événement en grand avec sa règle', () => {
    const html = render(view({ events: [gameEvent(), gameEvent({ id: 'manaStorm', name: 'Tempête de mana', cost: null, ongoing: true, text: 'Permanent : les sorts coûtent 1 ressource de plus.' })] }), { kind: 'event', slot: 0 });
    expect(html).toContain('class="icard event"');
    expect(html).toContain('Chaque joueur pioche une carte.');
    expect(html).toContain('Quitte le jeu à la fin du tour.');
    const ongoing = render(view({ events: [gameEvent(), gameEvent({ cost: null, ongoing: true })] }), { kind: 'event', slot: 1 });
    expect(ongoing).toContain('Événement – Permanent');
    expect(ongoing).not.toContain('icard-cost');
  });
});
