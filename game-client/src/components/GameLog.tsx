import type { LogEntry, PlayerIndex } from '../api/protocol';

export function logClass(entry: LogEntry, you: PlayerIndex): string {
  switch (entry.tone) {
    case 'turn': return 'turn';
    case 'damage': return 'dmg';
    case 'action': return entry.player === you ? 'p0' : 'p1';
    case 'info': return '';
  }
}

/** Journal de la partie, le plus récent en haut. */
export function GameLog({ log, you }: { log: LogEntry[]; you: PlayerIndex }) {
  return (
    <div className="log">
      {log.map((entry, i) => ({ entry, i })).reverse().map(({ entry, i }) => (
        <div key={i} className={logClass(entry, you)}>{entry.text}</div>
      ))}
    </div>
  );
}
