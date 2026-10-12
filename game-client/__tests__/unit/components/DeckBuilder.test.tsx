import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { HeroSummary } from '../../../src/api/protocol';
import { CardZoom } from '../../../src/components/CardInspector';
import { EventPicker, HeroPicker } from '../../../src/components/DeckBuilder';
import { card, gameEvent, player } from '../fixtures';

const hero = (id: string, name: string, schools: string[], faction: HeroSummary['faction'] = 'havre', factionLabel = 'Havre'): HeroSummary => ({
  id, faction, factionLabel, factionIcon: '🦅', hero: { ...player().hero, name, schools },
});

describe('HeroPicker', () => {
  it('range les héros par onglet de faction, la première ouverte', () => {
    const html = renderToStaticMarkup(<HeroPicker onPick={() => {}} onCancel={() => {}} heroes={[
      hero('siegfried', 'Siegfried', ['Lumière']), hero('kalAzaar', 'Kal-Azaar', ['Feu'], 'inferno', 'Inferno'), hero('alia', 'Alia', ['Lumière', 'Feu']),
    ]} />);
    expect(html.match(/role="tab"/g)).toHaveLength(2);
    expect(html).toContain('Havre (2)');
    expect(html).toContain('Inferno (1)');
    expect(html).toMatch(/aria-selected="true" class="on">.*Havre/);
    expect(html).toContain('Siegfried');
    expect(html).not.toContain('Kal-Azaar,');
    expect(html.match(/class="fac"/g)).toHaveLength(2);
  });

  it('propose tous les héros d\'une faction, avec leurs écoles de magie et leurs caractéristiques', () => {
    const html = renderToStaticMarkup(<HeroPicker onPick={() => {}} onCancel={() => {}} heroes={[
      hero('siegfried', 'Siegfried', ['Lumière']), hero('alia', 'Alia', ['Lumière', 'Feu']),
    ]} />);
    expect(html).toContain('Choisissez votre héros');
    expect(html.match(/class="fac"/g)).toHaveLength(2);
    expect(html).toContain('Siegfried');
    expect(html).toContain('Alia');
    expect(html).toContain('Puissance 2 · Magie 0 · Destinée 1');
  });
});

describe('EventPicker', () => {
  it('affiche le nombre d\'exemplaires choisis, et grise les autres événements quand le deck en a déjà 8', () => {
    const events = [gameEvent(), gameEvent({ id: 'hailStorm', name: 'Tempête de grêle' })];
    const html = renderToStaticMarkup(
      <EventPicker events={events} chosen={['celebration', 'celebration']} max={2} maxCopies={4} onAdd={() => {}} onRemove={() => {}} onInspect={() => {}} />,
    );
    expect(html).toContain('aria-pressed="true" class="event-card builder-event in-deck"');
    expect(html).toContain('2/4');
    expect(html).toContain('aria-pressed="false" class="event-card builder-event off"');
    expect(html).toContain('Tempête de grêle');
  });
});

describe('CardZoom', () => {
  it('affiche en grand une carte ou un événement du catalogue', () => {
    expect(renderToStaticMarkup(<CardZoom item={{ card: card({ name: 'Griffon loyal' }) }} onClose={() => {}} />)).toContain('Griffon loyal');
    expect(renderToStaticMarkup(<CardZoom item={{ event: gameEvent({ name: 'Fête' }) }} onClose={() => {}} />)).toContain('Fête');
  });
});
