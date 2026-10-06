import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { CardInspector, CardPreview, resolveInspect, type Inspect } from '../../../src/components/CardInspector';
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

  it('affiche la rareté, la faction et l\'extension de la carte', () => {
    const html = render(view(), { kind: 'card', card: card({ rarity: 'rare' }) });
    expect(html).toContain('<span class="rarity rare" title="Rareté : Rare"></span>');
    expect(html).toContain('<div class="crest" title="Faction : Havre"><img class="faction-icon" src="/img/faction/havre.webp" alt="Havre"/></div>');
    expect(html).toContain('<img class="expansion" src="/img/expansion/base.png" alt="Édition de base" title="Extension : Édition de base"/>');
  });

  it('marque une carte sans faction comme neutre', () => {
    const html = render(view(), { kind: 'card', card: card({ type: 'fortune', faction: null }) });
    expect(html).toContain('<div class="crest" title="Faction : Neutre"><img class="faction-icon" src="/img/faction/neutre.webp" alt="Neutre"/></div>');
  });

  it('montre l\'école de magie d\'un sort à la place de la faction', () => {
    const html = render(view(), { kind: 'card', card: card({ type: 'spell', school: 'Feu', faction: null }) });
    expect(html).toContain('<div class="crest school-crest" title="École de magie : Feu"><img class="school-icon" src="/img/school/feu.webp" alt="Feu"/></div>');
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
    expect(html).toContain('<span class="rarity heroic" title="Rareté : Héroïque"></span>');
    expect(html).toContain('title="Faction : Inferno"><img class="faction-icon" src="/img/faction/inferno.webp"');
    expect(html).toContain('title="Extension : Édition de base"');
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
    expect(html).toContain('<span class="rarity common" title="Rareté : Commune"></span>');
    expect(html).toContain('title="Extension : Édition de base"');
    const ongoing = render(view({ events: [gameEvent(), gameEvent({ cost: null, ongoing: true })] }), { kind: 'event', slot: 1 });
    expect(ongoing).toContain('Événement – Permanent');
    expect(ongoing).not.toContain('icard-cost');
  });

  it('affiche au survol un aperçu identique à l\'inspection, sans pouvoir être cliqué', () => {
    const v = view({ players: [player({ hand: [card({ name: 'Griffon loyal' })], handCount: 1 }), player({ hand: null })] });
    const html = renderToStaticMarkup(<CardPreview view={v} target={{ kind: 'hand', index: 0 }} />);
    expect(html).toContain('class="hover-preview"');
    expect(html).toContain('class="icard creature"');
    expect(html).toContain('Griffon loyal');
    expect(renderToStaticMarkup(<CardPreview view={v} target={{ kind: 'hand', index: 5 }} />)).toBe('');
  });
});
