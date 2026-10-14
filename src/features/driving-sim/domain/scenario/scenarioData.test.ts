// Data-integrity checks over the actual level roster (domain/scenario/levelCatalog.ts).
// No React, no canvas - this is the highest-value pass for catching a dropped
// or mangled field after a mechanical refactor across 13 level files.
import { describe, it, expect } from 'vitest';
import { LEVELS } from './levelCatalog';
import { SLOTS as level12Slots } from '@/features/driving-sim/domain/scenario/content/levels/level12';
import { SLOTS as level1Slots } from '@/features/driving-sim/domain/scenario/content/levels/level1';
import { SLOTS as level2Slots } from '@/features/driving-sim/domain/scenario/content/levels/level2';
import { SLOTS as level3Slots } from '@/features/driving-sim/domain/scenario/content/levels/level3/pools';
import { SLOTS as level4Slots } from '@/features/driving-sim/domain/scenario/content/levels/level4/pools';
import { SLOTS as level5Slots } from '@/features/driving-sim/domain/scenario/content/levels/level5';
import type { ScenarioEvent } from './scenarioDefinition';
import { level3Module } from '@/features/driving-sim/domain/scenario/content/lessons/level3Module';
import type { EnvironmentTrigger } from '@/features/driving-sim/domain/fsm/fsmTypes';
import { DrivingFSM } from '@/features/driving-sim/domain/fsm/DrivingFSM';

// Exhaustive-by-construction: a Record over the union type means TypeScript
// itself fails the build if EnvironmentTrigger ever gains or loses a member
// without this list being updated, so the runtime check below can never fall
// silently out of sync with domain/fsm/fsmTypes.ts.
const ENVIRONMENT_TRIGGERS: Record<EnvironmentTrigger, true> = {
  red_light: true,
  briefing_dismissed: true,
  green_light: true,
  yellow_light: true,
  pedestrian_crossing: true,
  obstacle_ahead: true,
  stop_sign: true,
  speed_limit: true,
  road_clear: true,
  road_marking: true,
  overtaking_zone: true,
  emergency_vehicle: true,
  level_end: true,
  scenario_trigger: true,
  feedback_displayed: true,
  recovery_complete: true,
  crash: true,
  vehicle_stopped: true,
};

/**
 * Which triggers can actually take the machine out of DRIVING, read off the
 * transition table rather than listed here, so this cannot drift from the
 * machine it is checking.
 */
/** Every authored variant of every pooled slot, not just the roll in LEVELS. */
const POOLED_VARIANTS = [
  ...level1Slots,
  ...level2Slots,
  ...level3Slots,
  ...level4Slots,
  ...level5Slots,
  ...level12Slots,
];

const APPROACH_TRIGGERS = new Set(
  new DrivingFSM()
    .getTransitionTable()
    .filter(transition => transition.from === 'DRIVING' && transition.to === 'APPROACHING_EVENT')
    .map(transition => String(transition.trigger))
);

// ScenarioEvent['correctAction'] is its own hand-declared union, deliberately
// not UserAction: it excludes 'start' (an FSM-only action no event can expect
// as its answer) and it still includes 'honk', which left the FSM alphabet
// because sounding the horn never changes driving state - it is graded, not a
// transition. Building this as a Record<CorrectAction, true> keeps the runtime
// check exhaustive against that union the same way the table above is
// exhaustive against EnvironmentTrigger.
type CorrectAction = ScenarioEvent['correctAction'];
const CORRECT_ACTIONS: Record<CorrectAction, true> = {
  brake: true,
  stop: true,
  accelerate: true,
  turn_left: true,
  turn_right: true,
  honk: true,
};

describe('scenario roster (LEVELS)', () => {
  const allEvents: Array<{ levelId: number; levelName: string; event: ScenarioEvent }> = LEVELS.flatMap(level =>
    level.events.map(event => ({ levelId: level.id, levelName: level.name, event }))
  );

  it('has at least one level with events', () => {
    expect(LEVELS.length).toBeGreaterThan(0);
    expect(allEvents.length).toBeGreaterThan(0);
  });

  it('gives every event a non-empty id', () => {
    const empties = allEvents.filter(({ event }) => !event.id || event.id.trim().length === 0);
    expect(empties).toEqual([]);
  });

  /**
   * An id's `level{N}.` prefix names the level that *authored* the event, which
   * is not always the level it is playing in: Level 12 is the final exam and
   * deliberately re-plays content from earlier levels (see level12.ts), so a
   * borrowed event legitimately appears twice across the roster - once at its
   * source and once in the exam.
   *
   * Uniqueness is therefore asserted over authored events, and borrowing gets
   * its own, stricter check below: a borrowed id has to resolve to content that
   * actually exists at the level it names, which is a better guarantee than
   * plain uniqueness ever gave.
   */
  const isAuthoredHere = (event: ScenarioEvent, levelId: number) => event.id.startsWith(`level${levelId}.`);

  it('gives every authored event a globally-unique id across the whole roster', () => {
    const seen = new Map<string, number>();
    for (const { levelId, event } of allEvents) {
      if (!isAuthoredHere(event, levelId)) continue;
      seen.set(event.id, (seen.get(event.id) ?? 0) + 1);
    }
    const duplicates = [...seen.entries()].filter(([, count]) => count > 1).map(([id]) => id);
    expect(duplicates).toEqual([]);
  });

  it('traces every borrowed event back to real content in the level that authored it', () => {
    const authoredIds = new Set(
      allEvents.filter(({ levelId, event }) => isAuthoredHere(event, levelId)).map(({ event }) => event.id)
    );
    const borrowed = allEvents.filter(({ levelId, event }) => !isAuthoredHere(event, levelId));

    // Borrowing is a Level 12 mechanism. An event turning up anywhere else
    // under another level's name is a mistake, not a feature.
    expect(borrowed.filter(({ levelId }) => levelId !== 12).map(({ event }) => event.id)).toEqual([]);
    // And a borrowed id must name content that genuinely exists at its source,
    // so the id still leads a developer straight to the scenario on screen.
    expect(borrowed.filter(({ event }) => !authoredIds.has(event.id)).map(({ event }) => event.id)).toEqual([]);
  });

  /**
   * A lane requirement is a *role* resolved against the host level's
   * `oncomingLanes`, so borrowing a lane-dependent scenario into a level with a
   * different carriageway layout silently changes which lane it demands - and
   * on a two-way road, gets it exactly backwards. Level 12 declares paint
   * matching its sources for this reason; this guards that it keeps matching if
   * the borrow pools ever widen.
   */
  it('grades borrowed lane requirements against the same layout their source used', () => {
    const hostOncoming = LEVELS.find(level => level.id === 12)!.paint?.oncomingLanes ?? 0;

    // Every variant the exam *can* roll, not just the one representative roll
    // in the static export - a mismatch that only shows up on some seeds is
    // exactly the kind of bug this is meant to catch.
    const mismatched = level12Slots
      .flat()
      .filter(variant => variant.requiredLane || variant.maneuver)
      .filter(variant => !variant.id.startsWith('level12.'))
      .map(variant => {
        const sourceId = Number(variant.id.match(/^level(\d+)\./)?.[1]);
        const source = LEVELS.find(level => level.id === sourceId);
        return { id: variant.id, sourceOncoming: source?.paint?.oncomingLanes ?? 0 };
      })
      .filter(entry => entry.sourceOncoming !== hostOncoming);

    expect(mismatched).toEqual([]);
  });

  it('keeps ids unique within each single level', () => {
    const collisions: string[] = [];
    for (const level of LEVELS) {
      const seen = new Set<string>();
      for (const event of level.events) {
        if (seen.has(event.id)) collisions.push(`${level.id}:${event.id}`);
        seen.add(event.id);
      }
    }
    expect(collisions).toEqual([]);
  });

  it('orders each level\'s events by strictly ascending triggerAtDistance', () => {
    const outOfOrder: Array<{ levelId: number; index: number }> = [];
    for (const level of LEVELS) {
      for (let i = 1; i < level.events.length; i += 1) {
        if (level.events[i].triggerAtDistance <= level.events[i - 1].triggerAtDistance) {
          outOfOrder.push({ levelId: level.id, index: i });
        }
      }
    }
    expect(outOfOrder).toEqual([]);
  });

  it('only uses correctAction values the FSM/UI actually understand', () => {
    const invalid = allEvents
      .filter(({ event }) => !(event.correctAction in CORRECT_ACTIONS))
      .map(({ levelId, event }) => `level${levelId}:${event.id}:${event.correctAction}`);
    expect(invalid).toEqual([]);
  });

  it('only uses event types that are valid EnvironmentTriggers', () => {
    const invalid = allEvents
      .filter(({ event }) => !(event.type in ENVIRONMENT_TRIGGERS))
      .map(({ levelId, event }) => `level${levelId}:${event.id}:${event.type}`);
    expect(invalid).toEqual([]);
  });

  it('only uses event types the machine can actually start an event with, in every pool', () => {
    // Being in the alphabet is not enough. `green_light` is a real trigger, but
    // the only edge it has is the one *out* of INTERSECTION when the light you
    // were waiting at changes - there is none that opens an approach. Level 5's
    // whole signal right-of-way slot was authored with it and therefore never
    // fired on any roll: the approach never opened, the scene never appeared,
    // and 25 points were unreachable. Nothing about that was visible from the
    // content, which is why it is checked here.
    //
    // Checked over every authored variant, not just the roster's current roll:
    // a pooled level shows one variant per slot per attempt, so a roll-only
    // check would clear a broken variant on most runs and fail on some.
    const unstartable = [
      ...allEvents.map(({ event }) => event),
      ...POOLED_VARIANTS.flat(),
    ]
      .filter(event => !APPROACH_TRIGGERS.has(event.type))
      .map(event => `${event.id}:${event.type}`);
    expect([...new Set(unstartable)]).toEqual([]);
  });

  it('gives every scenario answered at a prompt answers to choose from, one of them right', () => {
    // A checkpoint, a frozen prompt and a parking decision stop the drive and
    // wait for an answer, so one with no `choices` is a dead end: Level 6's bay
    // opened a panel with nothing to click until the first play-test,
    // because every drive harness answers a missing choice with
    // 'stop'. Over every authored variant, for the reason the check above is.
    const unanswerable = [...allEvents.map(({ event }) => event), ...POOLED_VARIANTS.flat()]
      .filter(event => event.inspection || event.cutscene || event.parkingCutscene)
      .filter(event => {
        const choices = event.choices ?? [];
        return choices.length < 2 || choices.filter(choice => choice.action === event.correctAction).length !== 1;
      })
      .map(event => `${event.id}: ${event.choices?.length ?? 0} choices`);
    expect([...new Set(unanswerable)]).toEqual([]);
  });

  it('drives no ROAD CLOSED TO ALL VEHICLES sign, which the lesson teaches instead', () => {
    // The sign closes the road to all vehicles, and a corridor with no detour
    // can only stage it as a closed lane the car drives past: graded, that
    // teaches the opposite of the sign. Over every authored variant, because
    // Level 3 and the final exam each roll from a pool, and the practice pool
    // borrows them.
    const driven = [...allEvents.map(({ event }) => event), ...POOLED_VARIANTS.flat()]
      .filter(event => /road closed/i.test(event.sign?.name ?? '') || /road closed/i.test(event.description))
      .map(event => event.id);
    expect([...new Set(driven)]).toEqual([]);
    expect(JSON.stringify(level3Module)).toContain('Road Closed To All Vehicles');
  });
});
