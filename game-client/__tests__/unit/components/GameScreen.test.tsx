import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { GameScreen } from '../../../src/components/GameScreen';
import { logClass } from '../../../src/components/GameLog';
import { EMPTY_UI } from '../../../src/game/selection';
import { card, mainOptions, playable, player, step, unit, view } from '../fixtures';

const render = (v = view()) =>
  renderToStaticMarkup(<GameScreen view={v} ui={EMPTY_UI} flashes={new Map()} attacking={null} ghosts={[]} onClick={() => {}} onLeave={() => {}} />);

describe('GameScreen', () => {
  it('affiche la main du joueur, les créatures et le journal', () => {
    const board = [[unit(1), null, null, null], [null, null, null, null]];
    const html = render(view({
      players: [player({ hand: [card({ name: 'Cavalier solaire' })], handCount: 1, board }), player({ hand: null })],
      options: mainOptions({ hand: [playable(step([]))] }),
    }));
    expect(html).toContain('Cavalier solaire');
    expect(html).toContain('card creature playable');
    expect(html).toContain('/img/art/Elite_squire.webp');
    expect(html).toContain('— Tour de Siegfried —');
  });

  it('remplit les ronds de vie selon les PV restants', () => {
    const board = [[unit(1, { hpCur: 1, hpMax: 4 }), null, null, null], [null, null, null, null]];
    const html = render(view({
      players: [player({ board, hp: 5, maxHp: 20, hand: [card({ hp: 3 })] }), player({ hand: null })],
    }));
    expect(html).toContain('class="b hp dmg" style="--hp:0.25" title="Points de vie : 1/4"');
    expect(html).toContain('class="herohp" style="--hp:0.25"');
    expect(html).toContain('class="herohp" style="--hp:1"');
    expect(html).toContain('class="b hp" style="--hp:1" title="Points de vie : 3/3"');
  });

  it('anime seulement la créature qui attaque', () => {
    const board = [[unit(1), unit(2), null, null], [null, null, null, null]];
    const v = view({ players: [player({ board }), player({ hand: null })] });
    const html = renderToStaticMarkup(
      <GameScreen view={v} ui={EMPTY_UI} flashes={new Map()} attacking={{ uid: 2, riposte: false }} ghosts={[]} onClick={() => {}} onLeave={() => {}} />,
    );
    expect(html.match(/unit p0 attacking/g)).toHaveLength(1);
    expect(render(v)).not.toContain('attacking');
  });

  it('anime la riposte et garde un instant la créature détruite', () => {
    const board = [[unit(1), null, null, null], [null, null, null, null]];
    const v = view({ players: [player(), player({ hand: null, board })] });
    const html = renderToStaticMarkup(
      <GameScreen view={v} ui={EMPTY_UI} flashes={new Map([['unit-5', { id: 1, text: '-2', heal: false }]])}
        attacking={{ uid: 1, riposte: true }} ghosts={[{ unit: unit(5), player: 0, row: 0, lane: 0 }]}
        onClick={() => {}} onLeave={() => {}} />,
    );
    expect(html).toContain('unit p1 attacking riposte');
    expect(html).toContain('unit p0 dying');
    expect(html).toContain('<div class="flash">-2</div>');
  });

  it('propose l\'action du héros tant qu\'elle est disponible', () => {
    const html = render(view());
    expect(html).toContain('+1 Puissance');
    expect(html).toContain('🂠 Piocher');
    const used = render(view({ options: mainOptions({ heroAction: { available: false, reason: 'Votre héros a déjà agi ce tour-ci.', drawReason: null } }) }));
    expect(used).not.toContain('+1 Puissance');
  });

  it('indique le tour adverse quand le joueur n\'a pas la main', () => {
    const html = render(view({ current: 1, options: null }));
    expect(html).toContain('Tour adverse');
    expect(html).toContain('L&#x27;adversaire réfléchit…');
  });

  it('affiche la carte jouée par l\'adversaire avant sa résolution', () => {
    const html = render(view({
      current: 1, options: null,
      pending: { kind: 'card', player: 1, card: card({ id: 'autelDestruction', name: 'Autel de destruction', type: 'fortune', text: 'Inflige 2 dégâts au héros ennemi.' }), choices: [{ kind: 'hero', player: 0 }] },
    }));
    expect(html).toContain('class="reveal p1"');
    expect(html).toContain('Siegfried joue');
    expect(html).toContain('Autel de destruction');
    expect(html).toContain('Inflige 2 dégâts au héros ennemi.');
    expect(html).toContain('herocard p0 target');
  });

  it('affiche la pile, le poison et les enchantements d\'une créature', () => {
    const board = [[unit(1, { stack: 2, poison: 1, enchantments: ['Bénédiction'], keywords: { noret: true } }), null, null, null], [null, null, null, null]];
    const html = render(view({ players: [player({ board }), player({ hand: null })] }));
    expect(html).toContain('×2');
    expect(html).toContain('☠1');
    expect(html).toContain('title="Bénédiction"');
    expect(html).toContain('🪶');
  });

  it('ouvre la fenêtre de choix pour une option « au choix » ou une carte de la bibliothèque', () => {
    const modes = step([{ kind: 'mode', index: 0 }, { kind: 'mode', index: 1 }], { prompt: 'Choisissez un effet.', labels: ['Piocher une carte', 'Gagner 4 ressources'] });
    const v = view({ options: mainOptions({ hand: [playable(modes)] }) });
    const html = renderToStaticMarkup(
      <GameScreen view={v} ui={{ selection: { kind: 'hand', index: 0, choices: [] }, message: '' }} flashes={new Map()} attacking={null} ghosts={[]} onClick={() => {}} onLeave={() => {}} />,
    );
    expect(html).toContain('class="chooser"');
    expect(html).toContain('Gagner 4 ressources');
    const library = step([{ kind: 'card', zone: 'library', cardId: 'griffonLoyal' }], { cards: [card({ name: 'Griffon loyal', art: 'Loyal_griffin' })] });
    const withCards = renderToStaticMarkup(
      <GameScreen view={view({ options: mainOptions({ hand: [playable(library)] }) })} ui={{ selection: { kind: 'hand', index: 0, choices: [] }, message: '' }}
        flashes={new Map()} attacking={null} ghosts={[]} onClick={() => {}} onLeave={() => {}} />,
    );
    expect(withCards).toContain('Griffon loyal');
    expect(withCards).toContain('/img/art/Loyal_griffin.webp');
    expect(render(v)).not.toContain('class="chooser"');
  });

  it('affiche en grand le héros et l\'effet de son pouvoir pendant sa résolution', () => {
    const html = render(view({
      current: 1, options: null,
      pending: { kind: 'power', player: 1, power: { name: 'Agonie', cost: 0, text: 'Défaussez une carte : infligez 2 dégâts à une créature ciblée.' }, choices: [{ kind: 'hero', player: 0 }] },
    }));
    expect(html).toContain('class="reveal p1"');
    expect(html).toContain('class="card power"');
    expect(html).toContain('/img/art/Siegfried_Champion_of_Faith.webp');
    expect(html).toContain('✨ Agonie');
    expect(html).toContain('infligez 2 dégâts');
    expect(html).toContain('Siegfried utilise Agonie…');
  });

  it('affiche le bandeau de changement de tour', () => {
    const banner = (player: 0 | 1) => renderToStaticMarkup(
      <GameScreen view={view()} ui={EMPTY_UI} flashes={new Map()} attacking={null} ghosts={[]} turnBanner={{ id: 1, player }} onClick={() => {}} onLeave={() => {}} />,
    );
    expect(banner(0)).toContain('class="turn-banner p0"');
    expect(banner(0)).toContain('Votre tour');
    expect(banner(1)).toContain('Tour adverse');
    expect(render()).not.toContain('turn-banner');
  });

  it('affiche la victoire en fin de partie', () => {
    expect(render(view({ phase: 'over', winner: 0, options: null }))).toContain('Victoire');
    expect(render(view({ phase: 'over', winner: 1, options: null }))).toContain('Défaite');
  });
});

describe('logClass', () => {
  it('colore les actions selon le joueur qui les fait', () => {
    expect(logClass({ text: '', tone: 'action', player: 1 }, 1)).toBe('p0');
    expect(logClass({ text: '', tone: 'action', player: 0 }, 1)).toBe('p1');
    expect(logClass({ text: '', tone: 'damage', player: null }, 0)).toBe('dmg');
  });
});
