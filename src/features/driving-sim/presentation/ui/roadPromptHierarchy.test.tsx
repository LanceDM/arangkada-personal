/**
 * What the driving screen says, and in what order.
 *
 * The prompt this replaces rendered the scenario's whole `description` as its
 * title, in bold capitals, below the recommended move — so the loudest thing on
 * a 340px column was a 26-word paragraph, the answer was read before the
 * situation, and a law citation could be stacked under both while the car was
 * moving. These are the assertions that keep that from coming back, for every
 * level rather than for the one that was redesigned.
 *
 * Rendered to markup rather than mounted: nothing asserted here has behaviour.
 */
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import RoadEventPrompt from './RoadEventPrompt';
import CheckpointInspection from './decisions/CheckpointInspection';
import { LEVELS } from '@/features/driving-sim/domain/scenario/levelCatalog';
import { scenarioInstruction, scenarioLabel } from '@/features/driving-sim/domain/scenario/scenarioCopy';
import type { LevelConfig, ScenarioEvent } from '@/features/driving-sim/domain/scenario/scenarioDefinition';
import { supportCue } from '@/features/driving-sim/domain/scenario/scenarioSupport';
import { composeWorldFrame } from '@/features/driving-sim/domain/world/composeWorldFrame';
import { curvesForLevel } from '@/features/driving-sim/domain/world/roadCurves';

const level8 = LEVELS.find(level => level.id === 8)!;
const level7 = LEVELS.find(level => level.id === 7)!;

const promptFor = (
  event: ScenarioEvent,
  level: LevelConfig,
  extra: Partial<Parameters<typeof RoadEventPrompt>[0]> = {}
) =>
  renderToStaticMarkup(
    <RoadEventPrompt
      level={level}
      support="full"
      activeEvent={event}
      eventPhase="approach"
      eventApproach={0.5}
      laneCue={null}
      gapCue={null}
      holdCue={null}
      bayCue={null}
      coastCue={null}
      throttleCue={null}
      {...extra}
    />
  );

/** Every scenario in the game, so the hierarchy is asserted level-wide. */
const everyEvent = (): Array<{ level: LevelConfig; event: ScenarioEvent }> =>
  LEVELS.flatMap(level => level.events.map(event => ({ level, event })));

describe('the road prompt, on every level', () => {
  it('never renders a scenario description as the prompt', () => {
    // The whole defect in one assertion. A description is a sentence written to
    // be read while the drive is paused; on the moving screen it belongs
    // nowhere.
    const leaked = everyEvent()
      .filter(({ level, event }) => {
        if (level.id === 0) return false;
        const words = event.description.split(/\s+/).slice(0, 6).join(' ');
        return words.length > 12 && promptFor(event, level).includes(words);
      })
      .map(({ event }) => event.id);
    expect(leaked).toEqual([]);
  });

  it('never renders a law citation while the car is moving', () => {
    const leaked = everyEvent()
      .filter(({ level, event }) => {
        if (!event.lawCitation) return false;
        const words = event.lawCitation.split(/\s+/).slice(0, 6).join(' ');
        return promptFor(event, level).includes(words);
      })
      .map(({ event }) => event.id);
    expect(leaked).toEqual([]);
  });

  it('gives every scenario a name rather than a sentence', () => {
    // A plate's own name is the syllabus's wording and can run long; what it
    // may never be is a sentence, which is what `description` gave the title
    // slot before.
    const sentences = everyEvent()
      .map(({ event }) => ({ id: event.id, label: scenarioLabel(event) }))
      .filter(({ label }) => label.endsWith('.') || label.split(/\s+/).length > 10);
    expect(sentences).toEqual([]);
  });

  it('keeps an authored label to the two-to-five words a label is', () => {
    const wordy = everyEvent()
      .filter(({ event }) => event.label)
      .map(({ event }) => ({ id: event.id, words: event.label!.split(/\s+/).length }))
      .filter(({ words }) => words < 2 || words > 5);
    expect(wordy).toEqual([]);
  });

  it('gives every scenario exactly one instruction, and never an empty one', () => {
    const silent = everyEvent()
      .filter(({ event }) => !scenarioInstruction(event).trim())
      .map(({ event }) => event.id);
    expect(silent).toEqual([]);
  });

  it('renders no text below 12px', () => {
    // The floor. The prompt used to carry four different sizes under it, and
    // the smallest of them was the one naming what was being measured.
    const tiny = everyEvent()
      .flatMap(({ level, event }) => [...promptFor(event, level).matchAll(/text-\[(\d+)px\]/g)])
      .map(match => Number(match[1]))
      .filter(size => size < 12);
    expect([...new Set(tiny)]).toEqual([]);
  });
});

describe('every kind of scenario in the game', () => {
  /**
   * What makes one scenario a different *kind* of thing to render from another:
   * the event type it is, and whichever of the optional declarations changes
   * what the card has to show. Two scenarios with the same signature put the
   * same shapes on screen; one signature with no coverage is a shape nobody has
   * looked at.
   */
  const signature = (event: ScenarioEvent) =>
    [
      event.type,
      event.sign ? 'sign' : event.marking ? 'marking' : 'plain',
      event.following ? 'gap' : '',
      event.requiredLane ? 'lane' : '',
      event.lineHold ? 'line' : '',
      event.maneuver ? 'maneuver' : '',
      event.merge ? 'merge' : '',
      event.overtake ? 'overtake' : '',
      event.avoid ? 'avoid' : '',
      event.inspection ? 'inspection' : '',
      event.cutscene ? 'cutscene' : '',
      event.parkingCutscene ? 'parking' : '',
      event.emergency ? 'emergency' : '',
      event.npc ? 'npc' : '',
      event.rear ? 'rear' : '',
      event.pedestrians ? 'people' : '',
    ]
      .filter(Boolean)
      .join('+');

  /** One scenario per signature, so every shape is rendered at least once. */
  const oneOfEach = () => {
    const seen = new Map<string, { level: LevelConfig; event: ScenarioEvent }>();
    for (const entry of everyEvent()) {
      const key = signature(entry.event);
      if (!seen.has(key)) seen.set(key, entry);
    }
    return [...seen.entries()];
  };

  it('renders on the moving screen without throwing, in every phase', () => {
    // The smoke test the level-wide redesign needs: one card serves every
    // scenario in the game now, so every shape of scenario has to survive it.
    const broken: string[] = [];
    for (const [key, { level, event }] of oneOfEach()) {
      for (const eventPhase of ['approach', 'react'] as const) {
        try {
          const markup = promptFor(event, level, { eventPhase });
          if (!markup.includes('road-prompt')) broken.push(`${event.id} (${key}): rendered nothing`);
        } catch (error) {
          broken.push(`${event.id} (${key}): ${(error as Error).message}`);
        }
      }
    }
    expect(broken).toEqual([]);
  });

  it('covers enough distinct shapes to be worth calling a sweep', () => {
    // A guard on the guard: if the roster ever collapsed to a handful of
    // signatures, the test above would still pass while covering nothing.
    expect(oneOfEach().length).toBeGreaterThan(20);
  });

  it('gives every one of them a name and an instruction', () => {
    const silent = oneOfEach()
      .filter(([, { event }]) => !scenarioLabel(event).trim() || !scenarioInstruction(event).trim())
      .map(([key, { event }]) => `${event.id} (${key})`);
    expect(silent).toEqual([]);
  });

  it('survives the cues arriving in any combination', () => {
    // The three live readings are computed independently, and a card handed all
    // three at once must still show exactly the one its scenario is graded on.
    const cues = {
      laneCue: { hint: 'Move to the curb lane', inLane: false },
      gapCue: { seconds: 1.4, safe: false },
      holdCue: { drift: 22, steady: false },
    };
    const broken: string[] = [];
    for (const [key, { level, event }] of oneOfEach()) {
      try {
        promptFor(event, level, cues);
      } catch (error) {
        broken.push(`${event.id} (${key}): ${(error as Error).message}`);
      }
    }
    expect(broken).toEqual([]);
  });
});

describe('the one live metric', () => {
  const gapEvent = level8.events.find(event => event.following)!;
  const laneEvent = level8.events.find(event => event.requiredLane)!;
  const holdEvent = level8.events.find(event => event.lineHold)!;
  const cues = {
    laneCue: { hint: 'Move to the curb lane', inLane: false },
    gapCue: { seconds: 1.4, safe: false },
    holdCue: { drift: 44, steady: false },
  };

  it('shows the gap on a scenario that grades a gap, and nothing else', () => {
    const markup = promptFor(gapEvent, level8, cues);
    expect(markup).toContain('1.4s');
    expect(markup).not.toContain('Move over');
    expect(markup).not.toContain('Wandering');
  });

  it('shows the lane on a scenario that grades a lane, and nothing else', () => {
    const markup = promptFor(laneEvent, level8, cues);
    expect(markup).toContain('Move over');
    expect(markup).not.toContain('1.4s');
    expect(markup).not.toContain('Wandering');
  });

  it('shows steadiness on a scenario that grades steadiness, and nothing else', () => {
    const markup = promptFor(holdEvent, level8, cues);
    expect(markup).toContain('Wandering');
    expect(markup).not.toContain('1.4s');
    expect(markup).not.toContain('Move over');
  });

  it('shows no reading at all on a scenario that grades none', () => {
    const plain = level8.events.find(
      event => !event.following && !event.requiredLane && !event.lineHold && !event.maneuver
    )!;
    const markup = promptFor(plain, level8, cues);
    for (const reading of ['1.4s', 'Move over', 'Wandering']) {
      expect(markup, `${plain.id} showed a reading it does not grade`).not.toContain(reading);
    }
  });
});

describe('the approach and act-now states', () => {
  const event = level8.events[0];

  it('are told apart by a word, not only by a colour', () => {
    expect(promptFor(event, level8, { eventPhase: 'approach' })).toContain('Coming up');
    expect(promptFor(event, level8, { eventPhase: 'react' })).toContain('Act now');
  });

  it('keep the same slots, so nothing on the card moves between them', () => {
    const approach = promptFor(event, level8, { eventPhase: 'approach' });
    const react = promptFor(event, level8, { eventPhase: 'react' });
    const slots = (markup: string) => (markup.match(/min-h-\[\d+px\]/g) ?? []).sort();
    expect(slots(approach)).toEqual(slots(react));
  });
});

describe('the prompt on the levels that were not redesigned', () => {
  it('names a sign event by its plate rather than by its prose', () => {
    const signed = LEVELS.flatMap(level => level.events).find(event => event.sign)!;
    expect(scenarioLabel(signed)).toBe(signed.sign!.name);
  });

  it('still gives a Level 7 scenario its authored instruction', () => {
    const merge = level7.events.find(event => event.merge)!;
    expect(promptFor(merge, level7)).toContain(merge.recommendedMove!);
  });

  it('falls back to a readable name where a level authored none', () => {
    const unlabelled = LEVELS.flatMap(level => level.events).find(
      event => !event.label && !event.sign && !event.marking
    )!;
    const label = scenarioLabel(unlabelled);
    expect(label).not.toContain('.');
    expect(label.split(/\s+/).length).toBeLessThanOrEqual(7);
    expect(label[0]).toBe(label[0].toUpperCase());
  });
});

/**
 * The prompt after the read phase withholds exactly what the read phase did.
 * If it showed the move, its keys or live advice the instant the
 * drive resumed, a briefing at `none` would have hidden nothing.
 */
describe('the prompt at each support level', () => {
  const cues = {
    laneCue: { hint: 'Move to the curb lane', inLane: false },
    gapCue: { seconds: 1.4, safe: false },
    holdCue: { drift: 44, steady: false },
  };
  const KEYCAP = 'inset_0_-3px';
  const ADVICE = ['Move to the curb lane', 'Move over', 'Ease off', 'Come back straight', 'Hold it'];
  const presented = () =>
    everyEvent().filter(({ level, event }) => level.id !== 0 && !event.inspection);

  it('never shows the move, the keys that make it, or advice below full, on every level', () => {
    const leaked: string[] = [];
    for (const support of ['cue', 'none'] as const) {
      for (const { level, event } of presented()) {
        const markup = promptFor(event, level, { ...cues, support });
        if (markup.includes(scenarioInstruction(event))) leaked.push(`${support} ${event.id}: the move`);
        if (markup.includes(KEYCAP)) leaked.push(`${support} ${event.id}: keys`);
        for (const advice of ADVICE) if (markup.includes(advice)) leaked.push(`${support} ${event.id}: ${advice}`);
      }
    }
    expect(leaked).toEqual([]);
  });

  it('shows where to look at cue, and the same slots at every level', () => {
    const slots = (markup: string) => (markup.match(/min-h-\[\d+px\]/g) ?? []).sort();
    for (const { level, event } of presented()) {
      const full = promptFor(event, level, { support: 'full' });
      const cue = promptFor(event, level, { support: 'cue' });
      const none = promptFor(event, level, { support: 'none' });
      const pointer = supportCue(event);
      if (pointer) expect(cue, event.id).toContain(pointer.replace(/'/g, '&#x27;'));
      expect(slots(cue), event.id).toEqual(slots(full));
      expect(slots(none), event.id).toEqual(slots(full));
    }
  });

  it('still shows the options a question offers, which are the question rather than the answer', () => {
    const asked = presented().find(({ event }) => event.choices?.length && !event.cutscene)!;
    const markup = promptFor(asked.event, asked.level, { support: 'none' });
    // Every option, as its chip - the whole set, so no one of them is singled out.
    const chips = markup.match(/px-2 py-1 font-display text-xs/g) ?? [];
    expect(chips).toHaveLength(asked.event.choices!.length);
  });
});

/**
 * A checkpoint grades the full stop at its line, so the
 * stop is its move. In the first play-test the prompt said "Brake to a full stop
 * at the line" with the brake's keys and a "Full stop" banner, and the road
 * read "LTO CHECKPOINT — FULL STOP", at every support level - Level 12, always
 * at none, included.
 */
describe('a checkpoint on the road', () => {
  const checkpoints = LEVELS.flatMap(level =>
    level.events.filter(event => event.inspection && !event.inspection.pullOver).map(event => ({ level, event }))
  );
  const MOVE = /full stop|slow|brake|stop at|the line/i;
  const KEYCAP = 'inset_0_-3px';
  const visible = (markup: string) => markup.replace(/<[^>]*>/g, ' ');

  it('is on Levels 1 and 10 and in Level 12’s roadside check', () => {
    expect([...new Set(checkpoints.map(({ level }) => level.id))]).toEqual([1, 10, 12]);
  });

  it('gives the stop, its keys and the full-stop banner at full only', () => {
    for (const { level, event } of checkpoints) {
      const full = promptFor(event, level, { support: 'full' });
      expect(visible(full), event.id).toMatch(/Start slowing for the checkpoint/);
      expect(full, event.id).toContain(KEYCAP);
      for (const support of ['cue', 'none'] as const) {
        const markup = promptFor(event, level, { support });
        expect(visible(markup), `${support} ${event.id}`).toContain('LTO checkpoint');
        expect(visible(markup), `${support} ${event.id}`).not.toMatch(MOVE);
        expect(markup, `${support} ${event.id}`).not.toContain(KEYCAP);
      }
      expect(visible(promptFor(event, level, { support: 'cue' })), event.id).toContain('Watch the checkpoint ahead.');
      expect(visible(promptFor(event, level, { support: 'none' })), event.id).not.toContain('Watch');
    }
  });

  it('is named on the road, and the road says nothing of the stop', () => {
    for (const { level, event } of checkpoints) {
      const view = {
        level,
        distance: event.triggerAtDistance - 300,
        handled: new Set<number>(),
        curves: curvesForLevel(level),
      };
      // Level 1's checkpoints stand close enough for two to be labelled at once.
      const labels = composeWorldFrame(view, { playerLane: 2 }).nodes.flatMap(node =>
        node.kind === 'checkpoint' && node.label !== null ? [node.label] : []
      );
      expect(labels.length, event.id).toBeGreaterThan(0);
      expect(new Set(labels), event.id).toEqual(new Set(['LTO CHECKPOINT']));
    }
  });
});

describe('a traffic stop on the road', () => {
  const level12 = LEVELS.find(level => level.id === 12)!;
  const stop = level12.events.find(event => event.inspection?.pullOver)!;
  const checkpoint = level12.events.find(event => event.inspection && !event.inspection.pullOver)!;

  it('is named, and neither called a checkpoint nor told where to stop, at every support level', () => {
    for (const support of ['full', 'cue', 'none'] as const) {
      const markup = promptFor(stop, level12, { support });
      // What is read, not the markup: the panel's tone is still called checkpoint.
      const text = markup.replace(/<[^>]*>/g, ' ');
      expect(text, support).toContain('Traffic stop');
      expect(text, support).not.toMatch(/checkpoint|full stop|pull over|extreme right|curb lane/i);
      // No keys either: the checkpoint's prompt shows the brake's.
      expect(markup, support).not.toContain('inset_0_-3px');
    }
  });

  it('leaves the roadside check its checkpoint prompt', () => {
    expect(promptFor(checkpoint, level12)).toContain('LTO checkpoint');
  });

  it('opens a panel titled a traffic stop, and the roadside check one titled a checkpoint', () => {
    const title = (event: ScenarioEvent) =>
      renderToStaticMarkup(<CheckpointInspection event={event} onAnswer={() => {}} choiceSeed={0} />).match(
        /id="checkpoint-title"[^>]*>([^<]*)</
      )?.[1];
    expect(title(stop)).toBe('Traffic stop');
    expect(title(checkpoint)).toBe('LTO checkpoint');
  });
});
