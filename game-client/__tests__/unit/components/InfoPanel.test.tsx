import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { InfoPanel, type Hover } from '../../../src/components/InfoPanel';
import { card, player, view } from '../fixtures';

const render = (hover: Hover | null) =>
  renderToStaticMarkup(
    <InfoPanel view={view({ players: [player({ hand: [card({ name: 'Cavalier solaire' })] }), player({ hand: null })] })}
      message="" hover={hover} onClick={() => {}} onInspect={() => {}} />,
  );

describe('InfoPanel', () => {
  it('n\'affiche que les consignes et actions du tour, sans description de carte', () => {
    const html = render({ kind: 'hand', index: 0 });
    expect(html).toContain('Cliquez sur votre héros');
    expect(html).not.toContain('Cavalier solaire');
  });

  it('propose d\'afficher en grand la dernière carte touchée (écrans tactiles sans clic droit)', () => {
    expect(render({ kind: 'hand', index: 0 })).toContain('class="izoom"');
    expect(render(null)).not.toContain('izoom');
  });
});
