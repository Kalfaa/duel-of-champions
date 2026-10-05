import type { DevelopChoice, GameView, StatKey } from '../api/protocol';
import type { Click, Selection } from '../game/selection';
import { ArtFallback, artStyle, cls, hpFillStyle, SchoolBadges, STAT } from './common';

interface Props {
  view: GameView;
  selection: Selection;
  onClick(click: Click): void;
}

const STATS: StatKey[] = ['m', 'g', 'd'];

/**
 * Actions du héros, proposées quand le joueur clique sur son héros : une seule par tour.
 * Panneau à gauche du plateau, sans voile, pour décider en gardant le champ de bataille sous les yeux.
 */
export function HeroMenu({ view, selection, onClick }: Props) {
  const options = view.options;
  if (selection?.kind !== 'heroMenu' || !options) return null;
  const me = view.players[view.you];
  const { power } = me.hero;
  const develop = (choice: DevelopChoice) => () => onClick({ kind: 'develop', choice });

  return (
    <aside className="hero-menu">
      <div className="hero-menu-head">
        <div className="hero-menu-portrait" style={artStyle(me.hero.art)}>
          <ArtFallback art={me.hero.art} icon={me.hero.icon} />
          <SchoolBadges schools={me.hero.schools} />
          <div className="herohp" style={hpFillStyle(me.hp, me.maxHp)} title={`Points de vie : ${me.hp}/${me.maxHp}`}>{me.hp}</div>
        </div>
        <div className="chooser-title">{me.hero.name} : choisissez son action du tour</div>
      </div>
      <div className="hero-menu-options">
        {STATS.map(k => (
          <button key={k} className="choice-mode hero-choice" onClick={develop(k)}>
            <span className={cls('sb', k)}>{me[k]}</span> +1 {STAT[k].name}
          </button>
        ))}
        <button className="choice-mode hero-choice" onClick={develop('draw')} disabled={!!options.heroAction.drawReason} title={options.heroAction.drawReason ?? undefined}>
          🂠 Piocher (1💎)
        </button>
        <button className="choice-mode hero-choice" onClick={() => onClick({ kind: 'power' })} disabled={!options.power.usable} title={options.power.reason ?? undefined}>
          ✨ {power.name} ({power.cost}💎)
        </button>
      </div>
      <div className="hero-power-text">✨ <b>{power.name}</b> : {power.text}</div>
      <button className="chooser-cancel" onClick={() => onClick({ kind: 'cancel' })}>Annuler</button>
    </aside>
  );
}
