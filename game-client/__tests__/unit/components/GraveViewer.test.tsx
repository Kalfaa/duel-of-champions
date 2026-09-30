import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { GraveViewer } from '../../../src/components/GraveViewer';
import { card, player, view } from '../fixtures';

const render = (v: ReturnType<typeof view>, p: 0 | 1) => renderToStaticMarkup(<GraveViewer view={v} player={p} onClose={() => {}} />);

describe('GraveViewer', () => {
  it('liste les cartes du cimetière adverse, la plus récente en premier, avec les détails de la dernière', () => {
    const grave = [card({ name: 'Trait de feu', type: 'spell', text: 'Inflige 2 dégâts à une créature ciblée.' }), card({ name: 'Cerbère' })];
    const html = render(view({ players: [player(), player({ hand: null, grave, hero: { ...player().hero, name: 'Kal-Azaar' } })] }), 1);
    expect(html).toContain('Cimetière de Kal-Azaar · 2 cartes');
    expect(html.indexOf('Cerbère')).toBeLessThan(html.indexOf('Trait de feu'));
    expect(html).toContain('class="card creature sel"');
    expect(html).toContain('class="iname">Cerbère');
  });

  it('indique un cimetière vide', () => {
    const html = render(view(), 0);
    expect(html).toContain('Votre cimetière · 0 carte');
    expect(html).toContain('Le cimetière est vide.');
  });
});
