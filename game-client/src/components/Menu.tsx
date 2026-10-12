import { useEffect, useState } from 'react';
import { fetchLeaderboard } from '../api/accounts';
import { fetchDecks, fetchMyDecks } from '../api/decks';
import type { Account, ClientDeck, DeckSummary, LeaderboardEntry, SavedDeck } from '../api/protocol';
import type { GameMode } from '../hooks/useGame';
import { artStyle, cls, FactionIcon } from './common';

interface Props {
  token: string;
  account: Account;
  error: string | null;
  onStart(mode: GameMode, deck: ClientDeck): void;
  /** Ouvre la construction de deck : un deck du joueur à modifier, ou null pour en créer un. */
  onEditDeck(deck: SavedDeck | null): void;
  onLogout(): void;
}

/** Compte connecté : classement Elo et bilan des parties. */
export function Profile({ account, onLogout }: { account: Account; onLogout(): void }) {
  const { pvpWins, pvpLosses, aiWins, aiLosses } = account.stats;
  return (
    <div className="profile">
      <div className="profile-name">{account.username}</div>
      <div className="profile-rating" title="Classement Elo (parties contre d'autres joueurs)">🏆 {account.rating}</div>
      <div className="profile-stats">
        <span title="Victoires / défaites contre des joueurs">⚔️ {pvpWins} V – {pvpLosses} D</span>
        <span title="Victoires / défaites contre l'IA">🤖 {aiWins} V – {aiLosses} D</span>
      </div>
      <button className="profile-logout" onClick={onLogout}>Se déconnecter</button>
    </div>
  );
}

/** Meilleurs joueurs classés ; le joueur connecté est mis en avant. */
export function Leaderboard({ entries, username }: { entries: LeaderboardEntry[]; username: string }) {
  return (
    <div className="leaderboard">
      <b>Classement</b>
      {entries.length === 0
        ? <p>Aucune partie classée pour l'instant : jouez contre un joueur pour apparaître ici.</p>
        : (
          <table>
            <tbody>
              {entries.map(e => (
                <tr key={e.username} className={cls(e.username === username && 'me')}>
                  <td>{e.rank}</td>
                  <td>{e.username}</td>
                  <td>{e.rating}</td>
                  <td>{e.pvpWins} V – {e.pvpLosses} D</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
    </div>
  );
}

/** Decks construits par le joueur : à jouer, à modifier, ou un nouveau à créer. */
export function MyDecks({ decks, onPlay, onEdit }: {
  decks: SavedDeck[];
  onPlay(deck: SavedDeck): void;
  onEdit(deck: SavedDeck | null): void;
}) {
  return (
    <div className="my-decks">
      {decks.map(d => {
        const art = d.heroView?.art;
        const size = Object.values(d.cards).reduce((sum, n) => sum + n, 0);
        return (
          <div key={d.id} className="my-deck" style={artStyle(art)}>
            <div className="ftxt">
              <h3 title={d.name}>{d.name}</h3>
              {d.heroView && <div>{d.heroView.name}</div>}
              <div>{size} cartes · {d.events.length} événements</div>
              {d.problems[0] && <div className="my-deck-problem" title={d.problems.join('\n')}>Non jouable : {d.problems[0]}</div>}
              <div className="my-deck-actions">
                <button onClick={() => onPlay(d)} disabled={d.problems.length > 0}>Jouer</button>
                <button onClick={() => onEdit(d)}>Modifier</button>
              </div>
            </div>
          </div>
        );
      })}
      <div className="my-deck new" role="button" onClick={() => onEdit(null)}>＋ Créer un deck</div>
    </div>
  );
}

export function Menu({ token, account, error, onStart, onEditDeck, onLogout }: Props) {
  const [decks, setDecks] = useState<DeckSummary[]>([]);
  const [myDecks, setMyDecks] = useState<SavedDeck[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [mode, setMode] = useState<GameMode>('ai');

  useEffect(() => {
    let cancelled = false;
    fetchDecks()
      .then(d => { if (!cancelled) setDecks(d); })
      .catch(() => { if (!cancelled) setLoadError('Impossible de joindre le serveur de jeu.'); });
    fetchMyDecks(token)
      .then(d => { if (!cancelled) setMyDecks(d); })
      .catch(() => { if (!cancelled) setLoadError('Impossible de charger vos decks.'); });
    // Le classement est secondaire : le menu reste utilisable s'il ne se charge pas
    fetchLeaderboard()
      .then(l => { if (!cancelled) setLeaderboard(l); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [token]);

  return (
    <div className="menu">
      <h1>Duel of Champions</h1>
      <Profile account={account} onLogout={onLogout} />
      <div className="modes">
        <button className={cls(mode === 'ai' && 'on')} onClick={() => setMode('ai')}>Contre l'IA</button>
        <button className={cls(mode === 'pvp' && 'on')} onClick={() => setMode('pvp')}>Contre un joueur</button>
      </div>
      <div style={{ marginTop: 12 }}>
        {mode === 'ai'
          ? 'Choisissez votre héros et son deck — l\'IA en prendra un d\'une autre faction, au hasard.'
          : 'Choisissez votre héros et son deck, puis attendez qu\'un adversaire vous rejoigne. La partie compte pour le classement.'}
      </div>
      {(error ?? loadError) && <div className="error">{error ?? loadError}</div>}
      <div className="facs">
        {decks.map(d => (
          <div key={d.id} className="fac" style={artStyle(d.hero.art)} onClick={() => onStart(mode, d.id)}>
            <div className="ftxt">
              <h2><FactionIcon faction={d.faction} label={d.factionLabel} /> {d.factionLabel}</h2>
              <div><b>{d.hero.name}</b></div>
              <p style={{ margin: '4px 0' }}>{d.description}</p>
              {d.hero.power && <div>✨ <b>{d.hero.power.name}</b> ({d.hero.power.cost}💎) : {d.hero.power.text}</div>}
              {d.hero.passive && <div>♾️ <b>{d.hero.passive.name}</b> : {d.hero.passive.text}</div>}
            </div>
          </div>
        ))}
      </div>
      <h2 className="my-decks-title">Mes decks</h2>
      <MyDecks decks={myDecks} onPlay={d => onStart(mode, { custom: d.id })} onEdit={onEditDeck} />
      {leaderboard && <Leaderboard entries={leaderboard} username={account.username} />}
      <div className="rules">
        <b>Règles</b><br />
        • Chaque héros a ses propres PV (18 ou 20). Réduisez ceux de l'adversaire à 0 pour gagner.<br />
        • Chaque camp possède 2 colonnes (avant / arrière) de 4 couloirs, face à face.<br />
        • Chaque joueur commence avec 6 cartes. Début de tour : +1 ressource max (jusqu'à 10), ressources rechargées, pioche d'une carte. Si la bibliothèque est vide, le héros perd 1 PV par carte manquante.<br />
        • Votre <b>héros agit une fois par tour</b> (facultatif) : +1 Puissance, Magie ou Destinée, piocher une carte, ou utiliser son pouvoir : cliquez sur votre héros pour choisir. Chaque carte exige un coût 💎 et un niveau minimum dans ces caractéristiques.<br />
        • <b>Mêlée</b> 🗡️ : se déploie sur la ligne avant. <b>Tireur</b> 🏹 : sur la ligne arrière. <b>Volant</b> 🪽 : sur l'une ou l'autre.<br />
        • Chaque créature présente au début de votre tour peut, une fois, <b>attaquer</b> ou <b>se déplacer</b> vers une case adjacente. Une créature qui vient d'être déployée doit attendre le tour suivant.<br />
        • Une créature n'attaque que dans son couloir. Mêlée et volants frappent la ligne avant adverse si elle est occupée ; les tireurs choisissent leur cible. Sans créature adverse dans le couloir, l'attaque touche le héros.<br />
        • Si le défenseur survit, il <b>riposte</b> avec sa valeur de riposte.<br />
        • Cliquez sur une de vos créatures, puis sur sa cible ou sur une case où la déplacer.<br />
        • Clic droit ou Échap pour annuler une sélection, Espace pour finir le tour.
      </div>
    </div>
  );
}
