import { useEffect, useMemo, useState, type MouseEvent } from 'react';
import { deleteDeck, fetchCatalog, saveDeck } from '../api/decks';
import type { CardView, Catalog, DeckDraft, EventView, HeroSummary, SavedDeck } from '../api/protocol';
import {
  addCard, availableCards, availableEvents, heroFactions, changeHero, deckEntries, deckSize, draftProblems, emptyDraft, maxCopies, removeCard, addEvent, removeEvent, typeCounts,
  type CardFilter,
} from '../game/deck-builder';
import { CardDetails } from './CardDetails';
import { CardZoom } from './CardInspector';
import { ArtFallback, artStyle, CardFace, cls, FactionIcon, SchoolBadges } from './common';

interface Props {
  token: string;
  /** Deck à modifier ; null pour en créer un. */
  deck: SavedDeck | null;
  onClose(): void;
}

const FILTERS: { id: CardFilter; label: string }[] = [
  { id: 'all', label: 'Toutes' }, { id: 'creature', label: 'Créatures' }, { id: 'spell', label: 'Sorts' }, { id: 'fortune', label: 'Fortunes' },
];

const toDraft = (deck: SavedDeck): DeckDraft => ({ name: deck.name, hero: deck.hero, cards: { ...deck.cards }, events: [...deck.events] });

/** Première étape d'un nouveau deck : le choix du héros, qui fixe la faction et les écoles de magie. */
export function HeroPicker({ heroes, onPick, onCancel }: { heroes: HeroSummary[]; onPick(hero: string): void; onCancel(): void }) {
  const factions = heroFactions(heroes);
  const [faction, setFaction] = useState(factions[0]?.id);
  return (
    <div className="menu">
      <h1>Nouveau deck</h1>
      <p>Choisissez votre héros : il détermine la faction de vos créatures et fortunes, et les écoles de magie de vos sorts.</p>
      <button onClick={onCancel}>← Menu</button>
      <div className="modes faction-tabs" role="tablist">
        {factions.map(f => (
          <button key={f.id} role="tab" aria-selected={f.id === faction} className={cls(f.id === faction && 'on')} onClick={() => setFaction(f.id)}>
            <FactionIcon faction={f.id} label={f.label} /> {f.label} ({f.count})
          </button>
        ))}
      </div>
      <div className="facs">
        {heroes.filter(h => h.faction === faction).map(h => (
          <div key={h.id} className="fac" role="button" style={artStyle(h.hero.art)} onClick={() => onPick(h.id)}>
            <div className="ftxt">
              <h2><FactionIcon faction={h.faction} label={h.factionLabel} /> {h.factionLabel}</h2>
              <div><b>{h.hero.name}</b></div>
              <SchoolBadges schools={h.hero.schools} />
              <div>Puissance {h.hero.base.m} · Magie {h.hero.base.g} · Destinée {h.hero.base.d}</div>
              {h.hero.power && <div>✨ <b>{h.hero.power.name}</b> ({h.hero.power.cost}💎) : {h.hero.power.text}</div>}
              {h.hero.passive && <div>♾️ <b>{h.hero.passive.name}</b> : {h.hero.passive.text}</div>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Rubrique des événements : les 8 événements du deck se choisissent en cliquant dessus. */
/** Clic droit : Ctrl + clic droit inspecte la carte en grand, sinon retire un exemplaire. */
const removeOrInspect = (remove: () => void, inspect: () => void) => (e: MouseEvent) => {
  e.preventDefault();
  e.stopPropagation();
  if (e.ctrlKey || e.metaKey) inspect();
  else remove();
};

export function EventPicker({ events, chosen, max, maxCopies, onAdd, onRemove, onInspect }: {
  events: EventView[];
  chosen: readonly string[];
  max: number;
  maxCopies: number;
  onAdd(id: string): void;
  onRemove(id: string): void;
  onInspect(event: EventView): void;
}) {
  const full = chosen.length >= max;
  return (
    <>
      <p className="builder-hint">Clic : ajouter un exemplaire ({maxCopies} au plus) · clic droit : en retirer un · Ctrl + clic droit : voir en grand. {chosen.length}/{max} événements.</p>
      <div className="builder-events-grid">
        {events.map(e => {
          const count = chosen.filter(id => id === e.id).length;
          const on = count > 0;
          return (
            <div
              key={e.id}
              role="button"
              aria-pressed={on}
              className={cls('event-card', 'builder-event', on && 'in-deck', count >= maxCopies && 'maxed', !on && full && 'off')}
              title={`${e.name} : ${count} / ${maxCopies}`}
              onClick={() => onAdd(e.id)}
              onContextMenu={removeOrInspect(() => onRemove(e.id), () => onInspect(e))}
            >
              <div className="ev-art" style={artStyle(e.art)}><ArtFallback art={e.art} icon={e.icon} /></div>
              {e.cost === null ? <div className="ev-tag">Permanent</div> : <div className="cost">{e.cost}</div>}
              {on && <div className="builder-copies">{count}/{maxCopies}</div>}
              <div className="ev-info">
                <div className="ev-name">{e.name}</div>
                <div className="ev-text">{e.text}</div>
              </div>
            </div>
          );
        })}
        {events.length === 0 && <p>Aucun événement ne correspond.</p>}
      </div>
    </>
  );
}

/** Construction d'un deck : héros, cartes autorisées et événements, enregistré sur le compte du joueur. */
export function DeckBuilder({ token, deck, onClose }: Props) {
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  /** null tant que le héros d'un nouveau deck n'est pas choisi. */
  const [draft, setDraft] = useState<DeckDraft | null>(() => (deck ? toDraft(deck) : null));
  const [deckId, setDeckId] = useState<string | undefined>(deck?.id);
  const [section, setSection] = useState<'cards' | 'events'>('cards');
  const [filter, setFilter] = useState<CardFilter>('all');
  const [factionOnly, setFactionOnly] = useState(false);
  const [search, setSearch] = useState('');
  const [preview, setPreview] = useState<CardView | null>(null);
  const [zoom, setZoom] = useState<{ card: CardView } | { event: EventView } | null>(null);
  const [status, setStatus] = useState<{ text: string; error: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (!zoom) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setZoom(null); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [zoom]);

  useEffect(() => {
    let cancelled = false;
    fetchCatalog()
      .then(c => { if (!cancelled) setCatalog(c); })
      .catch(() => { if (!cancelled) setStatus({ text: 'Impossible de charger les cartes.', error: true }); });
    return () => { cancelled = true; };
  }, []);

  const cards = useMemo(
    () => (catalog && draft ? availableCards(catalog, draft.hero, filter, search, factionOnly) : []),
    [catalog, draft?.hero, filter, search, factionOnly],
  );

  if (!catalog) {
    return (
      <div className="overlay">
        {status ? <p className="error">{status.text}</p> : <div className="spinner" />}
        <button onClick={onClose}>Retour</button>
      </div>
    );
  }

  if (!draft) return <HeroPicker heroes={catalog.heroes} onPick={hero => setDraft(emptyDraft(hero))} onCancel={onClose} />;

  const update = (next: DeckDraft) => {
    if (next === draft) return;
    setDraft(next);
    setDirty(true);
    setStatus(null);
  };

  const { rules } = catalog;
  const hero = catalog.heroes.find(h => h.id === draft.hero);
  const size = deckSize(draft);
  const problems = draftProblems(draft, rules);
  const entries = deckEntries(draft, catalog);
  const counts = typeCounts(entries);

  const save = async () => {
    setBusy(true);
    try {
      const saved = await saveDeck(token, draft, deckId);
      setDeckId(saved.id);
      setDraft(toDraft(saved));
      setDirty(false);
      setStatus({ text: saved.problems.length ? 'Deck enregistré, mais pas encore jouable.' : 'Deck enregistré : il est prêt à jouer.', error: false });
    } catch (error) {
      setStatus({ text: error instanceof Error ? error.message : 'Enregistrement impossible.', error: true });
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (deckId === undefined || !window.confirm(`Supprimer le deck « ${draft.name} » ?`)) return;
    setBusy(true);
    try {
      await deleteDeck(token, deckId);
      onClose();
    } catch (error) {
      setStatus({ text: error instanceof Error ? error.message : 'Suppression impossible.', error: true });
      setBusy(false);
    }
  };

  const close = () => {
    if (!dirty || window.confirm('Quitter sans enregistrer les modifications ?')) onClose();
  };

  return (
    <div className="builder">
      <header className="builder-head">
        <button onClick={close}>← Menu</button>
        <input
          className="builder-name" value={draft.name} maxLength={40} aria-label="Nom du deck"
          onChange={e => update({ ...draft, name: e.target.value })}
        />
        <select aria-label="Héros" value={draft.hero} onChange={e => update(changeHero(draft, e.target.value, catalog))}>
          {catalog.heroes.map(h => <option key={h.id} value={h.id}>{h.hero.name} ({h.factionLabel})</option>)}
        </select>
        <span className={cls('builder-count', (size < rules.minCards || size > rules.maxCards) && 'bad')} title={`De ${rules.minCards} à ${rules.maxCards} cartes`}>
          {size} cartes
        </span>
        <button onClick={() => void save()} disabled={busy || !draft.name.trim()}>Enregistrer</button>
        {deckId !== undefined && <button onClick={() => void remove()} disabled={busy}>Supprimer</button>}
      </header>
      {status && <div className={cls('builder-status', status.error && 'error')}>{status.text}</div>}

      <div className="builder-body">
        <section className="builder-catalog">
          <div className="modes builder-sections" role="tablist">
            <button role="tab" aria-selected={section === 'cards'} className={cls(section === 'cards' && 'on')} onClick={() => setSection('cards')}>
              Cartes ({size})
            </button>
            <button role="tab" aria-selected={section === 'events'} className={cls(section === 'events' && 'on')} onClick={() => setSection('events')}>
              Événements ({draft.events.length}/{rules.events})
            </button>
          </div>
          <div className="builder-filters">
            {section === 'cards' && (
              <div className="modes">
                {FILTERS.map(f => <button key={f.id} className={cls(filter === f.id && 'on')} onClick={() => setFilter(f.id)}>{f.label}</button>)}
              </div>
            )}
            {section === 'cards' && hero && (
              <button
                className={cls('builder-faction', factionOnly && 'on')} aria-pressed={factionOnly}
                title="Masquer les créatures et fortunes neutres"
                onClick={() => setFactionOnly(on => !on)}
              >
                <FactionIcon faction={hero.faction} label={hero.factionLabel} /> {hero.factionLabel} uniquement
              </button>
            )}
            <input type="search" placeholder={section === 'cards' ? 'Rechercher (nom, texte, école)…' : 'Rechercher un événement…'} value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          {section === 'events'
            ? (
              <EventPicker
                events={availableEvents(catalog, search)} chosen={draft.events} max={rules.events} maxCopies={rules.maxCopies}
                onAdd={id => update(addEvent(draft, id, rules))} onRemove={id => update(removeEvent(draft, id))} onInspect={event => setZoom({ event })}
              />
            )
            : (
              <>
          <p className="builder-hint">Clic : ajouter un exemplaire · clic droit : en retirer un · Ctrl + clic droit : voir en grand.</p>
          <div className="builder-grid">
            {cards.map(c => {
              const count = draft.cards[c.id] ?? 0;
              const max = maxCopies(c, rules);
              return (
                <div
                  key={c.id}
                  className={cls('card', c.type, count > 0 && 'in-deck', count >= max && 'maxed')}
                  title={`${c.name} : ${count} / ${max}`}
                  onClick={() => update(addCard(draft, c, rules))}
                  onContextMenu={removeOrInspect(() => update(removeCard(draft, c.id)), () => setZoom({ card: c }))}
                  onMouseEnter={() => setPreview(c)}
                >
                  <CardFace card={c} details />
                  {count > 0 && <div className="builder-copies">{count}/{max}</div>}
                </div>
              );
            })}
            {cards.length === 0 && <p>Aucune carte ne correspond.</p>}
          </div>
              </>
            )}
        </section>

        <aside className="builder-side">
          {hero && (
            <div className="builder-hero">
              <div className="builder-hero-art" style={artStyle(hero.hero.art)}>
                <SchoolBadges schools={hero.hero.schools} />
              </div>
              <div className="builder-hero-info">
                <h2><FactionIcon faction={hero.faction} label={hero.factionLabel} /> {hero.hero.name}</h2>
                <div className="builder-hero-stats">
                  <span>⚔️ Puissance {hero.hero.base.m}</span><span>🔮 Magie {hero.hero.base.g}</span><span>🍀 Destinée {hero.hero.base.d}</span>
                </div>
                {hero.hero.power && <div>✨ <b>{hero.hero.power.name}</b> ({hero.hero.power.cost}💎) : {hero.hero.power.text}</div>}
                {hero.hero.passive && <div>♾️ <b>{hero.hero.passive.name}</b> : {hero.hero.passive.text}</div>}
              </div>
            </div>
          )}

          {preview && <div className="inspector builder-preview"><CardDetails card={preview} hp={preview.type === 'creature' ? String(preview.hp) : null} /></div>}

          <h3>Cartes ({size})</h3>
          <div className="builder-types">
            <span title="Créatures">🗡️ {counts.creature} créature{counts.creature > 1 ? 's' : ''}</span>
            <span title="Sorts">✨ {counts.spell} sort{counts.spell > 1 ? 's' : ''}</span>
            <span title="Fortunes">🍀 {counts.fortune} fortune{counts.fortune > 1 ? 's' : ''}</span>
          </div>
          <ul className="builder-list">
            {entries.map(({ card, count }) => (
              <li key={card.id} onMouseEnter={() => setPreview(card)}>
                <span className="cost">{card.cost}</span>
                <span className="builder-list-name">{card.name}</span>
                <span>×{count}</span>
                <button onClick={() => update(removeCard(draft, card.id))} aria-label={`Retirer ${card.name}`}>−</button>
                <button onClick={() => update(addCard(draft, card, rules))} aria-label={`Ajouter ${card.name}`} disabled={count >= maxCopies(card, rules)}>+</button>
              </li>
            ))}
            {entries.length === 0 && <li className="builder-empty">Cliquez sur une carte pour l'ajouter.</li>}
          </ul>

          <div className={cls('builder-problems', problems.length === 0 && 'ok')}>
            {problems.length === 0
              ? '✔ Deck jouable.'
              : problems.map(p => <div key={p}>• {p}</div>)}
          </div>
        </aside>
      </div>
      {zoom && <CardZoom item={zoom} onClose={() => setZoom(null)} />}
    </div>
  );
}
