import type { GameView } from '../api/protocol';
import type { TurnBanner } from '../game/turns';
import { cls, FactionIcon } from './common';

/** Bandeau qui traverse l'écran quand la main passe à l'autre joueur. */
export function TurnBannerView({ view, banner }: { view: GameView; banner: TurnBanner }) {
  const mine = banner.player === view.you;
  const p = view.players[banner.player];
  return (
    <div className={cls('turn-banner', mine ? 'p0' : 'p1')}>
      <div className="turn-banner-band">
        <div className="turn-banner-title">{mine ? 'Votre tour' : 'Tour adverse'}</div>
        <div className="turn-banner-sub"><FactionIcon faction={p.faction} label={p.factionLabel} /> {p.hero.name} · Tour {Math.ceil(view.turn / 2)}</div>
      </div>
    </div>
  );
}
