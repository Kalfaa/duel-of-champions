import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { GameScreen } from '../../../src/components/GameScreen';
import { logClass } from '../../../src/components/GameLog';
import { LogPanel } from '../../../src/components/LogPanel';
import { EMPTY_UI } from '../../../src/game/selection';
import { card, gameEvent, mainOptions, playable, player, step, unit, view } from '../fixtures';

const render = (v = view()) =>
  renderToStaticMarkup(<GameScreen view={v} ui={EMPTY_UI} flashes={new Map()} attacking={null} ghosts={[]} onClick={() => {}} onLeave={() => {}} />);

describe('GameScreen', () => {
  it('affiche la main du joueur et les créatures, sans l\'historique', () => {
    const board = [[unit(1), null, null, null], [null, null, null, null]];
    const html = render(view({
      players: [player({ hand: [card({ name: 'Cavalier solaire' })], handCount: 1, board }), player({ hand: null })],
      options: mainOptions({ hand: [playable(step([]))] }),
    }));
    expect(html).toContain('Cavalier solaire');
    expect(html).toContain('card creature playable');
    expect(html).toContain('/img/art/Elite_squire.webp');
    // L'historique n'est plus affiché en permanence : il s'ouvre depuis le bouton 📜
    expect(html).not.toContain('— Tour de Siegfried —');
    expect(html).toContain('title="Historique de la partie"');
  });

  it('inclut le type et le texte des cartes en main, pour les lire au survol', () => {
    const html = render(view({
      players: [player({ hand: [card({ name: 'Boule de feu', type: 'spell', school: 'Feu', text: 'Inflige 3 dégâts.' })], handCount: 1 }), player({ hand: null })],
    }));
    expect(html).toContain('<div class="itype">Sort – Feu</div>');
    expect(html).toContain('<div class="ctext">Inflige 3 dégâts.</div>');
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

  it('affiche les écoles de magie de chaque héros', () => {
    const html = render(view({
      players: [player(), player({ hand: null, hero: { ...player().hero, schools: ['Feu'] } })],
    }));
    expect(html).toContain('<span class="school" title="Magie : Lumière">☀️</span>');
    expect(html).toContain('<span class="school" title="Magie : Feu">🔥</span>');
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

  it('fait briller le héros tant qu\'il peut agir, et propose ses actions quand on clique dessus', () => {
    expect(render(view())).toContain('herocard p0 active ready');
    expect(render(view())).not.toContain('+1 Puissance');
    const menu = renderToStaticMarkup(
      <GameScreen view={view({ options: mainOptions({ power: { usable: false, reason: 'Pas assez de ressources.', steps: [] } }) })}
        ui={{ selection: { kind: 'heroMenu' }, message: '' }} flashes={new Map()} attacking={null} ghosts={[]} onClick={() => {}} onLeave={() => {}} />,
    );
    for (const label of ['+1 Puissance', '+1 Magie', '+1 Destinée', '🂠 Piocher']) expect(menu).toContain(label);
    // Panneau latéral sans voile : le champ de bataille reste visible pendant le choix
    expect(menu).toContain('class="hero-menu"');
    expect(menu).not.toContain('class="chooser"');
    expect(menu).toContain('disabled="" title="Pas assez de ressources."');
    const used = render(view({ options: mainOptions({ heroAction: { available: false, reason: 'Votre héros a déjà agi ce tour-ci.', drawReason: null } }) }));
    expect(used).not.toContain('ready');
  });

  it('indique le tour adverse quand le joueur n\'a pas la main', () => {
    const html = render(view({ current: 1, options: null }));
    expect(html).toContain('Tour adverse');
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

  it('affiche les événements en jeu, utilisables, déjà utilisés ou permanents', () => {
    const html = render(view({
      events: [gameEvent({ used: true }), gameEvent({ id: 'manaStorm', name: 'Tempête de mana', cost: null, ongoing: true, art: 'Mana_Storm' })],
      options: mainOptions({ events: [{ usable: false, reason: 'Déjà utilisé.', steps: [] }, { usable: false, reason: 'Permanent.', steps: [] }] }),
    }));
    expect(html).toContain('<div class="events-deck" title="Événements restants dans la pioche commune : 14">14</div>');
    expect(html).toContain('class="event-card used"');
    expect(html).toContain('Tempête de mana');
    expect(html).toContain('<div class="ev-tag">Permanent</div>');
    expect(html).toContain('title="Quitte le jeu à la fin du tour"');
    // Texte inclus pour être lu au survol
    expect(html).toContain('<div class="ev-text">Chaque joueur pioche une carte.</div>');
  });

  it('montre le coût augmenté d\'une carte de la main', () => {
    const html = render(view({
      players: [player({ hand: [card({ type: 'spell', cost: 1 })] }), player({ hand: null })],
      options: mainOptions({ hand: [{ ...playable(), cost: 2 }] }),
    }));
    expect(html).toContain('class="cost up"');
  });

  it('révèle l\'événement utilisé par l\'adversaire', () => {
    const html = render(view({ current: 1, options: null, pending: { kind: 'event', player: 1, event: gameEvent({ used: true }), choices: [] } }));
    expect(html).toContain('class="card event"');
    expect(html).toContain('utilise l&#x27;événement');
  });

  it('montre la main adverse face cachée, avec le dos de sa faction', () => {
    const html = render(view());
    expect(html).toContain('Main adverse · 5');
    expect(html.match(/class="card-back"/g)).toHaveLength(5);
    expect(html).toContain("/img/back/inferno.webp");
  });
});

describe('logClass', () => {
  it('colore les actions selon le joueur qui les fait', () => {
    expect(logClass({ text: '', tone: 'action', player: 1 }, 1)).toBe('p0');
    expect(logClass({ text: '', tone: 'action', player: 0 }, 1)).toBe('p1');
    expect(logClass({ text: '', tone: 'damage', player: null }, 0)).toBe('dmg');
  });
});

describe('LogPanel', () => {
  it('affiche l\'historique, le plus récent en haut', () => {
    const html = renderToStaticMarkup(<LogPanel view={view({ log: [{ text: 'Premier', tone: 'info', player: null }, { text: 'Second', tone: 'turn', player: null }] })} onClose={() => {}} />);
    expect(html).toContain('📜 Historique');
    expect(html.indexOf('Second')).toBeLessThan(html.indexOf('Premier'));
  });
});
