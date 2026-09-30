/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const gameServer = process.env.GAME_SERVER_URL ?? 'http://localhost:3000';

/** Domaines des tunnels ngrok, autorisés pour partager la partie (voir `npm run share` à la racine). */
const tunnelHosts = ['.ngrok-free.app', '.ngrok-free.dev', '.ngrok.app', '.ngrok.dev', '.ngrok.io'];

export default defineConfig({
  plugins: [react()],
  // Le mode preview reprend le proxy de `server` (/api et /ws vers le serveur de jeu)
  server: {
    allowedHosts: tunnelHosts,
    proxy: {
      '/api': gameServer,
      '/ws': { target: gameServer.replace(/^http/, 'ws'), ws: true },
    },
  },
  preview: {
    allowedHosts: tunnelHosts,
  },
  test: {
    include: ['__tests__/**/*.test.{ts,tsx}'],
  },
});
