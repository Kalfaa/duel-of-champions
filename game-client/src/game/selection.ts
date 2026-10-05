import {
  sameChoice,
  type Choice, type DevelopChoice, type GameAction, type GameView, type PlayerIndex, type StepView, type Target, type TurnOptions,
} from '../api/protocol';

export type Selection =
  /** Une carte de la main, avec les choix déjà faits pour la jouer. */
  | { kind: 'hand'; index: number; choices: Choice[] }
  /** Le pouvoir du héros, avec les choix déjà faits. */
  | { kind: 'power'; choices: Choice[] }
  /** Un événement en jeu, avec les choix déjà faits. */
  | { kind: 'event'; slot: number; choices: Choice[] }
  /** Une de ses créatures, pour l'attaque ou le déplacement. */
  | { kind: 'unit'; uid: number }
  /** Son héros : la fenêtre des actions du héros (caractéristique, pioche, pouvoir) est ouverte. */
  | { kind: 'heroMenu' }
  | null;

export interface UiState {
  selection: Selection;
  message: string;
}

export const EMPTY_UI: UiState = { selection: null, message: '' };

export type Click =
  | { kind: 'hand'; index: number }
  | { kind: 'slot'; player: PlayerIndex; row: number; lane: number }
  | { kind: 'hero'; player: PlayerIndex }
  | { kind: 'power' }
  | { kind: 'event'; slot: number }
  /** Une option choisie dans la fenêtre de choix (mode, carte de la bibliothèque ou du cimetière). */
  | { kind: 'choose'; choice: Choice }
  | { kind: 'develop'; choice: DevelopChoice }
  | { kind: 'endTurn' }
  | { kind: 'cancel' };

export interface ClickResult {
  ui: UiState;
  /** Action à envoyer au serveur, s'il y en a une. */
  action: GameAction | null;
}

type Casting = Extract<Selection, { choices: Choice[] }>;

const includes = (list: readonly Choice[], c: Choice): boolean => list.some(x => sameChoice(x, c));
const act = (action: GameAction): ClickResult => ({ ui: EMPTY_UI, action });
const say = (message: string, selection: Selection = null): ClickResult => ({ ui: { selection, message }, action: null });

function stepsOf(options: TurnOptions, selection: Casting): StepView[] {
  switch (selection.kind) {
    case 'hand': return options.hand[selection.index]?.steps ?? [];
    case 'event': return options.events[selection.slot]?.steps ?? [];
    case 'power': return options.power.steps;
  }
}

function castAction(selection: Casting, choices: Choice[]): GameAction {
  switch (selection.kind) {
    case 'hand': return { type: 'play', handIndex: selection.index, choices };
    case 'event': return { type: 'event', slot: selection.slot, choices };
    case 'power': return { type: 'power', choices };
  }
}

/** Étape de choix en cours pour la carte ou le pouvoir sélectionné. */
export function currentStep(view: GameView, selection: Selection): StepView | null {
  if (!view.options || !selection || !('choices' in selection)) return null;
  return stepsOf(view.options, selection)[selection.choices.length] ?? null;
}

const allowed = (step: StepView, choices: readonly Choice[], c: Choice): boolean =>
  includes(step.options, c) && (step.distinctFrom === null || !sameChoice(c, choices[step.distinctFrom]!));

/** Ajoute un choix : l'action est envoyée quand toutes les étapes sont remplies, sinon la suivante est demandée. */
function advance(options: TurnOptions, selection: Casting, choice: Choice | null): ClickResult {
  const choices = choice ? [...selection.choices, choice] : selection.choices;
  const steps = stepsOf(options, selection);
  const next = steps[choices.length];
  if (!next) return act(castAction(selection, choices));
  return say(`${next.prompt} (clic droit pour annuler)`, { ...selection, choices });
}

/** Traduit un clic en nouvel état d'interface et, le cas échéant, en action de jeu. */
export function handleClick(view: GameView, ui: UiState, click: Click): ClickResult {
  const unchanged: ClickResult = { ui, action: null };
  if (click.kind === 'cancel') return { ui: EMPTY_UI, action: null };
  const options = view.options;
  if (!options) return unchanged;
  const selection = ui.selection;
  const casting = selection && 'choices' in selection ? selection : null;
  const step = casting ? currentStep(view, casting) : null;
  const selectedUnit = selection?.kind === 'unit' ? options.units.find(u => u.uid === selection.uid) : undefined;

  /** Utilise le premier candidat accepté par l'étape de choix en cours. */
  const choose = (...candidates: Choice[]): ClickResult | null => {
    if (!casting || !step) return null;
    const c = candidates.find(x => allowed(step, casting.choices, x));
    return c ? advance(options, casting, c) : null;
  };
  const attackOn = (target: Target): ClickResult | null =>
    selectedUnit && includes(selectedUnit.attackTargets, target) ? act({ type: 'attack', uid: selectedUnit.uid, target }) : null;

  switch (click.kind) {
    case 'develop': {
      const reason = options.heroAction.available ? (click.choice === 'draw' ? options.heroAction.drawReason : null) : options.heroAction.reason;
      return reason ? say(reason) : act({ type: 'develop', choice: click.choice });
    }

    case 'endTurn':
      return options.canEndTurn ? act({ type: 'endTurn' }) : unchanged;

    case 'choose':
      return choose(click.choice) ?? unchanged;

    case 'hand': {
      const chosen = choose({ kind: 'hand', index: click.index });
      if (chosen) return chosen;
      const hand = options.hand[click.index];
      if (!hand) return unchanged;
      if (!hand.playable) return say(hand.reason ?? 'Carte injouable.');
      if (selection?.kind === 'hand' && selection.index === click.index) return { ui: EMPTY_UI, action: null };
      return advance(options, { kind: 'hand', index: click.index, choices: [] }, null);
    }

    case 'power': {
      if (selection?.kind === 'power') return { ui: EMPTY_UI, action: null };
      if (!options.power.usable) return say(options.power.reason ?? 'Pouvoir indisponible.');
      return advance(options, { kind: 'power', choices: [] }, null);
    }

    case 'event': {
      if (selection?.kind === 'event' && selection.slot === click.slot) return { ui: EMPTY_UI, action: null };
      const event = options.events[click.slot];
      if (!event) return unchanged;
      if (!event.usable) return say(event.reason ?? 'Événement indisponible.');
      return advance(options, { kind: 'event', slot: click.slot, choices: [] }, null);
    }

    case 'hero': {
      const used = choose(click) ?? attackOn(click);
      if (used) return used;
      if (click.player !== view.you || casting) return unchanged;
      if (selection?.kind === 'heroMenu') return { ui: EMPTY_UI, action: null };
      if (!options.heroAction.available) return say(options.heroAction.reason ?? 'Votre héros ne peut pas agir.');
      return say('', { kind: 'heroMenu' });
    }

    case 'slot': {
      const { player, row, lane } = click;
      const unit = view.players[player].board[row]?.[lane] ?? null;
      const mine = player === view.you;
      if (casting) {
        const candidates: Choice[] = [];
        if (unit) candidates.push({ kind: 'unit', uid: unit.uid });
        if (mine) candidates.push({ kind: 'slot', row, lane });
        candidates.push({ kind: 'line', player, row });
        return choose(...candidates) ?? unchanged;
      }
      if (unit) {
        const attacked = attackOn({ kind: 'unit', uid: unit.uid });
        if (attacked) return attacked;
      }
      if (selectedUnit && mine && !unit) {
        return selectedUnit.moveSlots.some(s => s.row === row && s.lane === lane)
          ? act({ type: 'move', uid: selectedUnit.uid, to: { row, lane } })
          : unchanged;
      }
      if (mine && unit) {
        if (selection?.kind === 'unit' && selection.uid === unit.uid) return { ui: EMPTY_UI, action: null };
        const option = options.units.find(u => u.uid === unit.uid);
        if (!option || option.reason) return say(option?.reason ?? 'Cette créature ne peut pas agir.');
        return say('Choisissez une cible à attaquer ou une case adjacente où vous déplacer.', { kind: 'unit', uid: unit.uid });
      }
      return { ui: EMPTY_UI, action: null };
    }
  }
}

export interface Highlights {
  /** Clés `${joueur}-${rangée}-${couloir}` des cases à mettre en évidence. */
  slots: Set<string>;
  units: Set<number>;
  heroes: Set<PlayerIndex>;
  /** Cartes de la main que l'on peut choisir. */
  hand: Set<number>;
}

export const slotKey = (player: PlayerIndex, row: number, lane: number): string => `${player}-${row}-${lane}`;

const LANES = [0, 1, 2, 3] as const;

/** Cases, créatures, héros et cartes de la main à mettre en évidence pour la sélection en cours. */
export function highlights(view: GameView, selection: Selection): Highlights {
  const h: Highlights = { slots: new Set(), units: new Set(), heroes: new Set(), hand: new Set() };
  const add = (choices: readonly Choice[], slotOwner: PlayerIndex = view.you) => {
    for (const c of choices) {
      if (c.kind === 'slot') h.slots.add(slotKey(slotOwner, c.row, c.lane));
      else if (c.kind === 'unit') h.units.add(c.uid);
      else if (c.kind === 'hero') h.heroes.add(c.player);
      else if (c.kind === 'line') LANES.forEach(lane => h.slots.add(slotKey(c.player, c.row, lane)));
      else if (c.kind === 'hand') h.hand.add(c.index);
    }
  };
  // Pendant la révélation d'une carte, ses choix sont montrés aux deux joueurs
  if (view.pending) add(view.pending.choices, view.pending.player);
  const options = view.options;
  if (!options || !selection) return h;
  if (selection.kind === 'heroMenu') return h;
  if (selection.kind === 'unit') {
    const unit = options.units.find(u => u.uid === selection.uid);
    add(unit?.attackTargets ?? []);
    add(unit?.moveSlots.map(s => ({ kind: 'slot' as const, ...s })) ?? []);
    return h;
  }
  const step = currentStep(view, selection);
  if (step) add(step.options.filter(c => allowed(step, selection.choices, c)));
  return h;
}
