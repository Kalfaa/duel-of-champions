import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Leaderboard, Profile } from '../../../src/components/Menu';
import type { Account } from '../../../src/api/protocol';

const account: Account = {
  id: 'a1', username: 'Halospart1', rating: 1032, createdAt: '2026-10-05T12:00:00.000Z',
  stats: { pvpWins: 3, pvpLosses: 1, aiWins: 5, aiLosses: 2 },
};

describe('Menu — compte', () => {
  it('affiche le pseudo, le classement Elo et le bilan des parties', () => {
    const html = renderToStaticMarkup(<Profile account={account} onLogout={() => {}} />);
    expect(html).toContain('Halospart1');
    expect(html).toContain('🏆 1032');
    expect(html).toContain('⚔️ 3 V – 1 D');
    expect(html).toContain('🤖 5 V – 2 D');
    expect(html).toContain('Se déconnecter');
  });

  it('liste le classement et met en avant le joueur connecté', () => {
    const html = renderToStaticMarkup(<Leaderboard username="Halospart1" entries={[
      { rank: 1, username: 'MoarSpartan', rating: 1100, pvpWins: 6, pvpLosses: 0 },
      { rank: 2, username: 'Halospart1', rating: 1032, pvpWins: 3, pvpLosses: 1 },
    ]} />);
    expect(html).toContain('<tr class=""><td>1</td><td>MoarSpartan</td><td>1100</td>');
    expect(html).toContain('<tr class="me"><td>2</td><td>Halospart1</td>');
  });

  it('explique comment apparaître dans un classement vide', () => {
    expect(renderToStaticMarkup(<Leaderboard username="x" entries={[]} />)).toContain('Aucune partie classée');
  });
});
