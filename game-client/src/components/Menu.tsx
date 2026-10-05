import { useEffect, useState } from 'react';
import { fetchFactions } from '../api/factions';
import type { FactionId, FactionSummary } from '../api/protocol';
import type { GameMode } from '../hooks/useGame';
import { artStyle, cls } from './common';

interface Props {
  error: string | null;
  onStart(mode: GameMode, faction: FactionId): void;
}

export function Menu({ error, onStart }: Props) {
  const [factions, setFactions] = useState<FactionSummary[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [mode, setMode] = useState<GameMode>('ai');

  useEffect(() => {
    let cancelled = false;
    fetchFactions()
      .then(f => { if (!cancelled) setFactions(f); })
      .catch(() => { if (!cancelled) setLoadError('Impossible de joindre le serveur de jeu.'); });
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="menu">
      <h1>Duel of Champions</h1>
      <div className="modes">
        <button className={cls(mode === 'ai' && 'on')} onClick={() => setMode('ai')}>Contre l'IA</button>
        <button className={cls(mode === 'pvp' && 'on')} onClick={() => setMode('pvp')}>Contre un joueur</button>
      </div>
      <div style={{ marginTop: 12 }}>
        {mode === 'ai'
          ? 'Choisissez votre faction — l\'IA en prendra une autre au hasard.'
          : 'Choisissez votre faction, puis attendez qu\'un adversaire vous rejoigne.'}
      </div>
      {(error ?? loadError) && <div className="error">{error ?? loadError}</div>}
      <div className="facs">
        {factions.map(f => (
          <div key={f.id} className="fac" style={artStyle(f.hero.art)} onClick={() => onStart(mode, f.id)}>
            <div className="ftxt">
              <h2>{f.icon} {f.label}</h2>
              <div><b>{f.hero.name}</b></div>
              <p style={{ margin: '4px 0' }}>{f.description}</p>
              <div>✨ <b>{f.hero.power.name}</b> ({f.hero.power.cost}💎) : {f.hero.power.text}</div>
            </div>
          </div>
        ))}
      </div>
      <div className="rules">
        <b>Règles</b><br />
        • Chaque héros a 20 PV. Réduisez ceux de l'adversaire à 0 pour gagner.<br />
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
