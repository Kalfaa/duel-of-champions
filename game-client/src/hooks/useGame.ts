import { useCallback, useEffect, useRef, useState } from 'react';
import { GameSocket, openBrowserSocket, UNAUTHENTICATED_CLOSE_CODE, type SocketLike } from '../api/game-socket';
import type { DeckId, GameView } from '../api/protocol';
import { countDrawnCards, type Draw } from '../game/draws';
import { createFlashes, mergeFlashes, removeFlashes, type FlashMap } from '../game/flashes';
import { findRemovedUnits, type Ghost } from '../game/ghosts';
import { EMPTY_UI, handleClick, type Click, type UiState } from '../game/selection';
import { turnTaker, type TurnBanner } from '../game/turns';

export type Screen = 'menu' | 'waiting' | 'game';
export type GameMode = 'ai' | 'pvp';

const FLASH_DURATION_MS = 900;
/** Durée de l'animation d'attaque ou de riposte (aller-retour), à garder alignée avec l'animation CSS « lunge ». */
const ATTACK_DURATION_MS = 500;
/** Durée pendant laquelle une créature détruite reste affichée, alignée avec l'animation CSS « dying ». */
const DEATH_DURATION_MS = 700;
/** Durée d'affichage du bandeau de changement de tour, alignée avec l'animation CSS « turn-banner ». */
const TURN_BANNER_DURATION_MS = 1600;
/** Durée maximale de l'animation des cartes piochées (vol depuis la bibliothèque, décalé carte par carte). */
const DRAW_DURATION_MS = 1500;

/** Créature en train de frapper : une attaque, ou la riposte d'un défenseur. */
export interface Lunge {
  uid: number;
  riposte: boolean;
}

export interface GameController {
  screen: Screen;
  view: GameView | null;
  ui: UiState;
  flashes: FlashMap;
  /** Créature en train d'attaquer ou de riposter, le temps de son animation. */
  attacking: Lunge | null;
  /** Créatures qui viennent d'être détruites, le temps de leur animation de mort. */
  ghosts: readonly Ghost[];
  /** Bandeau annonçant le joueur qui vient de prendre la main, le temps de son animation. */
  turnBanner: TurnBanner | null;
  /** Cartes qui viennent d'être piochées, le temps de leur animation. */
  drawn: Draw | null;
  connectionError: string | null;
  start(mode: GameMode, deck: DeckId): void;
  leave(): void;
  click(click: Click): void;
}

/**
 * Partie en cours du joueur connecté. `onUnauthorized` est appelé si le serveur de jeu refuse
 * le jeton d'accès (session expirée).
 */
export function useGame(token: string, onUnauthorized: () => void, openSocket: (token: string) => SocketLike = openBrowserSocket): GameController {
  const [screen, setScreen] = useState<Screen>('menu');
  const [view, setView] = useState<GameView | null>(null);
  const [ui, setUi] = useState<UiState>(EMPTY_UI);
  const [flashes, setFlashes] = useState<FlashMap>(new Map());
  const [attacking, setAttacking] = useState<Lunge | null>(null);
  const [ghosts, setGhosts] = useState<readonly Ghost[]>([]);
  const [turnBanner, setTurnBanner] = useState<TurnBanner | null>(null);
  const bannerIdRef = useRef(0);
  const [drawn, setDrawn] = useState<Draw | null>(null);
  const drawIdRef = useRef(0);
  const lastViewRef = useRef<GameView | null>(null);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const socketRef = useRef<GameSocket | null>(null);

  const reset = useCallback(() => {
    setScreen('menu');
    setView(null);
    setUi(EMPTY_UI);
    setFlashes(new Map());
    setAttacking(null);
    setGhosts([]);
    setTurnBanner(null);
    setDrawn(null);
    lastViewRef.current = null;
  }, []);

  const start = useCallback((mode: GameMode, deck: DeckId) => {
    socketRef.current?.close();
    const socket = new GameSocket(openSocket(token));
    socketRef.current = socket;
    setConnectionError(null);

    socket.onMessage(message => {
      if (socketRef.current !== socket) return;
      switch (message.type) {
        case 'waiting':
          setScreen('waiting');
          break;
        case 'state': {
          const removed = findRemovedUnits(lastViewRef.current, message.view);
          const taker = turnTaker(lastViewRef.current, message.view);
          const prevView = lastViewRef.current;
          const mine = countDrawnCards(prevView, message.view);
          const theirs = countDrawnCards(prevView, message.view, message.view.you === 0 ? 1 : 0);
          lastViewRef.current = message.view;
          setView(message.view);
          setScreen('game');
          setUi(EMPTY_UI);
          const hit = message.events.find(e => e.kind === 'attack' || e.kind === 'retaliate');
          if (hit) {
            const lunge: Lunge = { uid: hit.attacker, riposte: hit.kind === 'retaliate' };
            setAttacking(lunge);
            setTimeout(() => setAttacking(current => (current === lunge ? null : current)), ATTACK_DURATION_MS);
          }
          if (taker !== null) {
            const banner: TurnBanner = { id: ++bannerIdRef.current, player: taker };
            setTurnBanner(banner);
            setTimeout(() => setTurnBanner(current => (current === banner ? null : current)), TURN_BANNER_DURATION_MS);
          }
          if (mine > 0 || theirs > 0) {
            const draw: Draw = { id: ++drawIdRef.current, mine, theirs };
            setDrawn(draw);
            setTimeout(() => setDrawn(current => (current === draw ? null : current)), DRAW_DURATION_MS);
          }
          if (removed.length) {
            setGhosts(current => [...current, ...removed]);
            setTimeout(() => setGhosts(current => current.filter(g => !removed.includes(g))), DEATH_DURATION_MS);
          }
          if (message.events.length) {
            const created = createFlashes(message.events);
            const ids = new Set(created.map(([, f]) => f.id));
            setFlashes(current => mergeFlashes(current, created));
            setTimeout(() => setFlashes(current => removeFlashes(current, ids)), FLASH_DURATION_MS);
          }
          break;
        }
        case 'error':
          setUi(current => ({ ...current, message: message.message }));
          break;
      }
    });
    socket.onClose(code => {
      if (socketRef.current !== socket) return;
      socketRef.current = null;
      reset();
      if (code === UNAUTHENTICATED_CLOSE_CODE) onUnauthorized();
      else setConnectionError('Connexion au serveur perdue.');
    });

    socket.send(mode === 'ai' ? { type: 'startAi', deck } : { type: 'findMatch', deck });
  }, [token, onUnauthorized, openSocket, reset]);

  const leave = useCallback(() => {
    const socket = socketRef.current;
    socketRef.current = null;
    socket?.send({ type: 'leave' });
    socket?.close();
    reset();
  }, [reset]);

  const click = useCallback((c: Click) => {
    if (!view) return;
    const result = handleClick(view, ui, c);
    setUi(result.ui);
    if (result.action) socketRef.current?.send({ type: 'action', action: result.action });
  }, [view, ui]);

  useEffect(() => () => socketRef.current?.close(), []);

  return { screen, view, ui, flashes, attacking, ghosts, turnBanner, drawn, connectionError, start, leave, click };
}
