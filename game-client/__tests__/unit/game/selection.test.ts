import { describe, expect, it } from 'vitest';
import { EMPTY_UI, handleClick, highlights, type UiState } from '../../../src/game/selection';
import { card, mainOptions, playable, player, step, unit, view } from '../fixtures';

describe('handleClick', () => {
  it('ne fait rien quand ce n\'est pas au joueur d\'agir', () => {
    const v = view({ options: null });
    expect(handleClick(v, EMPTY_UI, { kind: 'endTurn' })).toEqual({ ui: EMPTY_UI, action: null });
  });

  it('envoie l\'action du héros choisie', () => {
    expect(handleClick(view(), EMPTY_UI, { kind: 'develop', choice: 'g' }).action).toEqual({ type: 'develop', choice: 'g' });
  });

  it('refuse une seconde action du héros en expliquant pourquoi', () => {
    const v = view({ options: mainOptions({ heroAction: { available: false, reason: 'Votre héros a déjà agi ce tour-ci.', drawReason: null } }) });
    const result = handleClick(v, EMPTY_UI, { kind: 'develop', choice: 'm' });
    expect(result.action).toBeNull();
    expect(result.ui.message).toBe('Votre héros a déjà agi ce tour-ci.');
  });

  it('refuse la pioche sans ressource, mais autorise le développement', () => {
    const v = view({ options: mainOptions({ heroAction: { available: true, reason: null, drawReason: 'Piocher coûte 1 ressource.' } }) });
    expect(handleClick(v, EMPTY_UI, { kind: 'develop', choice: 'draw' }).ui.message).toBe('Piocher coûte 1 ressource.');
    expect(handleClick(v, EMPTY_UI, { kind: 'develop', choice: 'm' }).action).toEqual({ type: 'develop', choice: 'm' });
  });

  it('affiche la raison pour laquelle une carte est injouable', () => {
    const v = view({ options: mainOptions({ hand: [{ playable: false, reason: 'Pas assez de ressources.', steps: [] }] }) });
    expect(handleClick(v, EMPTY_UI, { kind: 'hand', index: 0 }).ui).toEqual({ selection: null, message: 'Pas assez de ressources.' });
  });

  it('joue directement une carte sans choix', () => {
    const v = view({ options: mainOptions({ hand: [playable()] }) });
    expect(handleClick(v, EMPTY_UI, { kind: 'hand', index: 0 }).action).toEqual({ type: 'play', handIndex: 0, choices: [] });
  });

  it('sélectionne une créature puis la déploie sur une case proposée', () => {
    const v = view({ options: mainOptions({ hand: [playable(step([{ kind: 'slot', row: 0, lane: 2 }], { prompt: 'Choisissez un emplacement libre.' }))] }) });
    const selected = handleClick(v, EMPTY_UI, { kind: 'hand', index: 0 });
    expect(selected.ui).toEqual({ selection: { kind: 'hand', index: 0, choices: [] }, message: 'Choisissez un emplacement libre. (clic droit pour annuler)' });
    expect(selected.action).toBeNull();

    expect(handleClick(v, selected.ui, { kind: 'slot', player: 0, row: 0, lane: 1 }).action).toBeNull();
    expect(handleClick(v, selected.ui, { kind: 'slot', player: 0, row: 0, lane: 2 }).action)
      .toEqual({ type: 'play', handIndex: 0, choices: [{ kind: 'slot', row: 0, lane: 2 }] });
  });

  it('empile une créature sur une case occupée proposée', () => {
    const board = [[unit(4), null, null, null], [null, null, null, null]];
    const v = view({
      players: [player({ board }), player({ hand: null })],
      options: mainOptions({ hand: [playable(step([{ kind: 'slot', row: 0, lane: 0 }]))] }),
    });
    const ui: UiState = { selection: { kind: 'hand', index: 0, choices: [] }, message: '' };
    expect(handleClick(v, ui, { kind: 'slot', player: 0, row: 0, lane: 0 }).action)
      .toEqual({ type: 'play', handIndex: 0, choices: [{ kind: 'slot', row: 0, lane: 0 }] });
  });

  it('désélectionne une carte cliquée deux fois', () => {
    const v = view({ options: mainOptions({ hand: [playable(step([]))] }) });
    const ui: UiState = { selection: { kind: 'hand', index: 0, choices: [] }, message: 'x' };
    expect(handleClick(v, ui, { kind: 'hand', index: 0 }).ui).toEqual(EMPTY_UI);
  });

  it('lance un sort sur une créature ciblable', () => {
    const board = [[unit(7), null, null, null], [null, null, null, null]];
    const v = view({
      players: [player(), player({ board, hand: null })],
      options: mainOptions({ hand: [playable(step([{ kind: 'unit', uid: 7 }]))] }),
    });
    const ui: UiState = { selection: { kind: 'hand', index: 0, choices: [] }, message: '' };
    expect(handleClick(v, ui, { kind: 'slot', player: 1, row: 0, lane: 0 }).action)
      .toEqual({ type: 'play', handIndex: 0, choices: [{ kind: 'unit', uid: 7 }] });
  });

  it('cible une ligne entière en cliquant sur une de ses cases', () => {
    const v = view({ options: mainOptions({ hand: [playable(step([{ kind: 'line', player: 1, row: 0 }, { kind: 'line', player: 1, row: 1 }]))] }) });
    const ui: UiState = { selection: { kind: 'hand', index: 0, choices: [] }, message: '' };
    expect(handleClick(v, ui, { kind: 'slot', player: 1, row: 1, lane: 3 }).action)
      .toEqual({ type: 'play', handIndex: 0, choices: [{ kind: 'line', player: 1, row: 1 }] });
  });

  it('enchaîne plusieurs choix : une carte de la main, puis une cible', () => {
    const board = [[unit(7), null, null, null], [null, null, null, null]];
    const v = view({
      players: [player(), player({ board, hand: null })],
      options: mainOptions({
        hand: [
          playable(step([{ kind: 'hand', index: 1 }], { prompt: 'Carte à remettre ?' }), step([{ kind: 'unit', uid: 7 }], { prompt: 'Créature à détruire ?' })),
          playable(),
        ],
      }),
    });
    const selected = handleClick(v, EMPTY_UI, { kind: 'hand', index: 0 });
    const second = handleClick(v, selected.ui, { kind: 'hand', index: 1 });
    expect(second.action).toBeNull();
    expect(second.ui).toEqual({ selection: { kind: 'hand', index: 0, choices: [{ kind: 'hand', index: 1 }] }, message: 'Créature à détruire ? (clic droit pour annuler)' });
    expect(handleClick(v, second.ui, { kind: 'slot', player: 1, row: 0, lane: 0 }).action)
      .toEqual({ type: 'play', handIndex: 0, choices: [{ kind: 'hand', index: 1 }, { kind: 'unit', uid: 7 }] });
  });

  it('refuse de choisir deux fois la même créature quand l\'étape l\'interdit', () => {
    const board = [[unit(7), unit(8), null, null], [null, null, null, null]];
    const targets = [{ kind: 'unit' as const, uid: 7 }, { kind: 'unit' as const, uid: 8 }];
    const v = view({
      players: [player(), player({ board, hand: null })],
      options: mainOptions({ hand: [playable(step(targets), step(targets, { distinctFrom: 0 }))] }),
    });
    const ui: UiState = { selection: { kind: 'hand', index: 0, choices: [{ kind: 'unit', uid: 7 }] }, message: '' };
    expect(handleClick(v, ui, { kind: 'slot', player: 1, row: 0, lane: 0 }).action).toBeNull();
    expect(handleClick(v, ui, { kind: 'slot', player: 1, row: 0, lane: 1 }).action)
      .toEqual({ type: 'play', handIndex: 0, choices: [{ kind: 'unit', uid: 7 }, { kind: 'unit', uid: 8 }] });
  });

  it('choisit une option dans la fenêtre de choix', () => {
    const v = view({ options: mainOptions({ hand: [playable(step([{ kind: 'mode', index: 0 }], { labels: ['Piocher', 'Ressources'] }))] }) });
    const ui: UiState = { selection: { kind: 'hand', index: 0, choices: [] }, message: '' };
    expect(handleClick(v, ui, { kind: 'choose', choice: { kind: 'mode', index: 1 } }).action).toBeNull();
    expect(handleClick(v, ui, { kind: 'choose', choice: { kind: 'mode', index: 0 } }).action)
      .toEqual({ type: 'play', handIndex: 0, choices: [{ kind: 'mode', index: 0 }] });
  });

  it('utilise le pouvoir héroïque : défausse puis cible', () => {
    const board = [[unit(7), null, null, null], [null, null, null, null]];
    const v = view({
      players: [player(), player({ board, hand: null })],
      options: mainOptions({ power: { usable: true, reason: null, steps: [step([{ kind: 'hand', index: 0 }]), step([{ kind: 'unit', uid: 7 }])] } }),
    });
    const selected = handleClick(v, EMPTY_UI, { kind: 'power' });
    expect(selected.ui.selection).toEqual({ kind: 'power', choices: [] });
    const discarded = handleClick(v, selected.ui, { kind: 'hand', index: 0 });
    expect(discarded.ui.selection).toEqual({ kind: 'power', choices: [{ kind: 'hand', index: 0 }] });
    expect(handleClick(v, discarded.ui, { kind: 'hero', player: 1 }).action).toBeNull();
    expect(handleClick(v, discarded.ui, { kind: 'slot', player: 1, row: 0, lane: 0 }).action)
      .toEqual({ type: 'power', choices: [{ kind: 'hand', index: 0 }, { kind: 'unit', uid: 7 }] });
  });

  it('utilise directement un pouvoir sans choix', () => {
    const v = view({ options: mainOptions({ power: { usable: true, reason: null, steps: [] } }) });
    expect(handleClick(v, EMPTY_UI, { kind: 'power' }).action).toEqual({ type: 'power', choices: [] });
  });

  describe('créatures du joueur', () => {
    const myBoard = [[unit(3), null, null, null], [null, null, null, null]];
    const enemyBoard = [[unit(9), null, null, null], [null, null, null, null]];
    const v = view({
      players: [player({ board: myBoard }), player({ board: enemyBoard, hand: null })],
      options: mainOptions({ units: [{ uid: 3, reason: null, attackTargets: [{ kind: 'unit', uid: 9 }], moveSlots: [{ row: 0, lane: 1 }] }] }),
    });
    const selected = handleClick(v, EMPTY_UI, { kind: 'slot', player: 0, row: 0, lane: 0 });

    it('sélectionne une créature prête à agir', () => {
      expect(selected.ui.selection).toEqual({ kind: 'unit', uid: 3 });
    });

    it('attaque une cible de son couloir', () => {
      expect(handleClick(v, selected.ui, { kind: 'slot', player: 1, row: 0, lane: 0 }).action)
        .toEqual({ type: 'attack', uid: 3, target: { kind: 'unit', uid: 9 } });
    });

    it('refuse une attaque sur le héros quand un défenseur bloque', () => {
      expect(handleClick(v, selected.ui, { kind: 'hero', player: 1 }).action).toBeNull();
    });

    it('se déplace vers une case proposée', () => {
      expect(handleClick(v, selected.ui, { kind: 'slot', player: 0, row: 0, lane: 1 }).action)
        .toEqual({ type: 'move', uid: 3, to: { row: 0, lane: 1 } });
      expect(handleClick(v, selected.ui, { kind: 'slot', player: 0, row: 1, lane: 3 }).action).toBeNull();
    });

    it('désélectionne la créature cliquée deux fois', () => {
      expect(handleClick(v, selected.ui, { kind: 'slot', player: 0, row: 0, lane: 0 }).ui).toEqual(EMPTY_UI);
    });
  });

  it('explique pourquoi une créature ne peut pas agir', () => {
    const board = [[unit(3, { exhausted: true }), null, null, null], [null, null, null, null]];
    const v = view({
      players: [player({ board }), player({ hand: null })],
      options: mainOptions({ units: [{ uid: 3, reason: 'Cette créature a déjà agi ce tour-ci.', attackTargets: [], moveSlots: [] }] }),
    });
    expect(handleClick(v, EMPTY_UI, { kind: 'slot', player: 0, row: 0, lane: 0 }).ui.message)
      .toBe('Cette créature a déjà agi ce tour-ci.');
  });

  it('annule la sélection', () => {
    const ui: UiState = { selection: { kind: 'power', choices: [] }, message: 'Choisissez' };
    expect(handleClick(view(), ui, { kind: 'cancel' }).ui).toEqual(EMPTY_UI);
  });
});

describe('highlights', () => {
  it('montre les choix de la carte en cours de révélation, même à l\'adversaire', () => {
    const v = view({ you: 0, current: 1, options: null, pending: { kind: 'card', player: 1, card: card(), choices: [{ kind: 'slot', row: 0, lane: 2 }] } });
    expect([...highlights(v, null).slots]).toEqual(['1-0-2']);
  });

  it('met en évidence les options de l\'étape en cours', () => {
    const v = view({
      options: mainOptions({ hand: [playable(step([{ kind: 'unit', uid: 4 }, { kind: 'hero', player: 1 }]))] }),
    });
    const h = highlights(v, { kind: 'hand', index: 0, choices: [] });
    expect([...h.units]).toEqual([4]);
    expect([...h.heroes]).toEqual([1]);
  });

  it('met en évidence toutes les cases d\'une ligne ciblable et les cartes de la main choisissables', () => {
    const v = view({
      options: mainOptions({ hand: [playable(step([{ kind: 'hand', index: 1 }]), step([{ kind: 'line', player: 1, row: 0 }]))] }),
    });
    expect([...highlights(v, { kind: 'hand', index: 0, choices: [] }).hand]).toEqual([1]);
    expect([...highlights(v, { kind: 'hand', index: 0, choices: [{ kind: 'hand', index: 1 }] }).slots]).toEqual(['1-0-0', '1-0-1', '1-0-2', '1-0-3']);
  });

  it('met en évidence les cibles d\'attaque et les cases de déplacement d\'une créature', () => {
    const v = view({
      you: 1, current: 1,
      options: mainOptions({ units: [{ uid: 3, reason: null, attackTargets: [{ kind: 'hero', player: 0 }], moveSlots: [{ row: 0, lane: 1 }] }] }),
    });
    const h = highlights(v, { kind: 'unit', uid: 3 });
    expect([...h.slots]).toEqual(['1-0-1']);
    expect([...h.heroes]).toEqual([0]);
  });
});
