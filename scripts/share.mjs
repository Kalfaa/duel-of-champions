// Ouvre un tunnel ngrok vers le client (qui relaie /api et /ws vers le serveur de jeu) et affiche l'URL publique.
// Le token est lu dans la variable NGROK_AUTHTOKEN (fichier .env à la racine, non versionné).
import ngrok from '@ngrok/ngrok';

const port = Number(process.env.SHARE_PORT ?? 4173);

if (!process.env.NGROK_AUTHTOKEN) {
  console.error('NGROK_AUTHTOKEN manquant : créez un fichier .env à la racine contenant NGROK_AUTHTOKEN=<votre token>.');
  process.exit(1);
}

const listener = await ngrok.forward({ addr: port, authtoken_from_env: true });
console.log(`\n  🌍 Duel of Champions est accessible sur : ${listener.url()}\n`);

// Garde le processus (et donc le tunnel) en vie jusqu'à Ctrl+C, même sans entrée standard (ex. sous concurrently)
const keepAlive = setInterval(() => {}, 60_000);
const stop = async () => {
  clearInterval(keepAlive);
  await listener.close();
  process.exit(0);
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
