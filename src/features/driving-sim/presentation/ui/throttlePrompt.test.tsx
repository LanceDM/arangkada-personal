// @vitest-environment jsdom
/**
 * What the road prompt says while the throttle is jammed.
 *
 * The playtest report was "the car suddenly accelerates and I do not know
 * whether this is a bug", and the prompt was a large part of why: this event
 * declares no lane, gap, line or coast requirement, so the panel's single
 * metric slot rendered empty and nothing on screen said a failure had happened.
 * The instruction, meanwhile, named a control the car does not have.
 *
 * Rendered to markup rather than mounted: none of this has behaviour.
 */
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import RoadEventPrompt from './RoadEventPrompt';
import { LEVELS } from '@/features/driving-sim/domain/scenario/levelCatalog';
import type { ThrottleCue } from '@/features/driving-sim/domain/world/GameWorld';
import type { SupportLevel } from '@/domain/learner/competency';

const level9 = LEVELS.find(level => level.id === 9)!;
const jam = level9.events.find(event => event.id === 'level9.throttle-sticks-open')!;

const promptWith = (throttleCue: ThrottleCue | null, support: SupportLevel = 'full') =>
  renderToStaticMarkup(
    <RoadEventPrompt
      level={level9}
      support={support}
      activeEvent={jam}
      eventPhase="react"
      eventApproach={0.3}
      laneCue={null}
      gapCue={null}
      holdCue={null}
      bayCue={null}
      coastCue={null}
      throttleCue={throttleCue}
    />
  );

describe('the prompt while the throttle is jammed', () => {
  it('names the failure rather than leaving the reading empty', () => {
    expect(promptWith({ phase: 'stuck', dropping: false })).toContain('Throttle stuck');
  });

  it('reports the recovery as it happens', () => {
    expect(promptWith({ phase: 'braking', dropping: true })).toContain('Speed dropping');
    expect(promptWith({ phase: 'braking', dropping: false })).toContain('Brake held');
    expect(promptWith({ phase: 'freed', dropping: false })).toContain('Under control');
  });

  it('shows the keys that actually work', () => {
    // The instruction used to say "shift to neutral". These are the two keys a
    // player can press, drawn as keys, from the prompt's own table rather than
    // spelled into the content's prose.
    const html = promptWith({ phase: 'stuck', dropping: false });
    expect(html).toContain('↓');
    expect(html).toContain('>S<');
  });

  it('carries the instruction the scenario authored, and no impossible one', () => {
    const html = promptWith({ phase: 'stuck', dropping: false });
    expect(html).toContain('Hold the brake down');
    expect(html.toLowerCase()).not.toContain('neutral');
  });
});

/**
 * Below full support the move, its keys and the advice go, but the
 * failure itself stays named: it is the situation, which nothing on the road
 * shows, and a driver who is not told reads it as the game misbehaving.
 */
describe('the prompt while the throttle is jammed, below full support', () => {
  it('still names the failure and how the car is responding', () => {
    for (const support of ['cue', 'none'] as const) {
      expect(promptWith({ phase: 'stuck', dropping: false }, support), support).toContain('Throttle stuck');
      expect(promptWith({ phase: 'braking', dropping: true }, support), support).toContain('Speed dropping');
    }
  });

  it('shows neither the move, the keys that make it, nor the advice', () => {
    for (const support of ['cue', 'none'] as const) {
      const html = promptWith({ phase: 'stuck', dropping: false }, support);
      expect(html, support).not.toContain('Hold the brake down');
      expect(html, support).not.toContain('↓');
      expect(html, support).not.toContain('>S<');
    }
  });
});
