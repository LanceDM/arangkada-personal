/**
 * Grading a scenario that forbids the horn.
 *
 * `EventTelemetry.honked` has always been recorded, and `avoid` has always
 * existed, but the two never met: `deriveAction` only ever *names* the horn
 * where sounding it is the answer, so a prohibition on it was comparing
 * against an action that could not occur and every such event scored correct
 * whatever the driver did. It is the same defect Level 4's prohibitive lines
 * had against a `turn_left` nothing could produce.
 *
 * `gradeEvent` now settles a forbidden horn before any measurement, because
 * sounding it is an act rather than a speed. These are the tests that say so,
 * and that say it changes nothing for the events that do not forbid it.
 */
import { describe, expect, it } from 'vitest';
import { createTelemetry, gradeEvent, recordFrame, recordTraffic } from './eventTelemetry';
import { evaluateWeightedRule } from './ruleEngine';
import type { LevelConfig, ScenarioEvent } from '@/features/driving-sim/domain/scenario/scenarioDefinition';

/** An ordinary two-way city street. */
const level = {
  id: 8,
  speedLimit: 40,
  paint: { oncomingLanes: 2, base: 'broken_yellow', spans: [] },
} as unknown as LevelConfig;

const event = (extra: Partial<ScenarioEvent>): ScenarioEvent =>
  ({
    id: 'test.event',
    triggerAtDistance: 1000,
    type: 'scenario_trigger',
    description: '',
    correctAction: 'brake',
    points: 25,
    penaltyMessage: 'generic penalty',
    rewardMessage: 'generic reward',
    duration: 0,
    ...extra,
  }) as ScenarioEvent;

/**
 * Drives a window at one speed, with or without the horn, and grades it.
 *
 * `headway` is only fed in where the scenario declares a gap, so an event with
 * no traffic is graded from the car alone — exactly as the drive does it.
 */
const grade = (
  scenario: ScenarioEvent,
  {
    speed,
    honking,
    headway,
    braking = false,
  }: { speed: number; honking: boolean; headway?: number; braking?: boolean }
) => {
  const telemetry = createTelemetry(speed, 2);
  for (let frame = 0; frame < 40; frame++) {
    recordFrame(telemetry, speed, 2, frame >= 30, honking, false, braking);
    if (headway !== undefined) {
      recordTraffic(telemetry, scenario, level, {
        lane: 2,
        speed,
        headway,
        gapToLead: 400,
        followed: true,
        onAuxiliary: false,
        auxiliaryShare: 0,
      });
    }
  }
  return gradeEvent(telemetry, scenario, level);
};

describe('a scenario that forbids the horn', () => {
  const noHorn = event({ avoid: ['honk'] });

  it('grades the horn as the thing that was done, not the speed that was carried', () => {
    // Slow enough to satisfy the event on every other reading.
    expect(grade(noHorn, { speed: 12, honking: true }).action).toBe('honk');
  });

  it('marks that as wrong, since the horn was never the answer here', () => {
    const { isCorrect } = evaluateWeightedRule(noHorn, 'honk', 0);
    expect(isCorrect).toBe(false);
  });

  it('leaves a driver who kept off it graded on everything else', () => {
    // Forbidding the horn must not answer the question the scenario is really
    // about. `avoid` on its own short-circuits to the event's own action once
    // nothing forbidden was done, which for a horn-only prohibition would hand
    // a pass to a driver who never slowed, never stopped and never held a lane.
    expect(grade(noHorn, { speed: 12, honking: false }).action).toBe('slow');
    expect(grade(noHorn, { speed: 12, honking: false, braking: true }).action).toBe('brake');
    expect(grade(noHorn, { speed: 38, honking: false }).action).toBe('accelerate');
  });

  it('settles the horn ahead of a gap that was kept', () => {
    // The ordering is the whole point. A following gap is graded before the
    // prohibition branch, so a driver who held the gap *and* leaned on the horn
    // would otherwise have been handed a pass over a horn nobody looked at.
    const withGap = event({
      avoid: ['honk'],
      following: { seconds: 2, tooCloseMessage: 'you were inside two seconds' },
    });
    expect(grade(withGap, { speed: 12, honking: false, headway: 4 }).action).toBe('brake');
    expect(grade(withGap, { speed: 12, honking: true, headway: 4 }).action).toBe('honk');
    // And a driver who did both wrong is still told about one of them.
    expect(grade(withGap, { speed: 12, honking: true, headway: 1 }).action).toBe('honk');
  });
});

describe('a scenario that does not forbid the horn', () => {
  it('is unmoved by it', () => {
    // Sounding the horn is not itself an offence, and nothing outside an event
    // that names it should change because a key was pressed.
    const ordinary = event({});
    expect(grade(ordinary, { speed: 12, honking: true }).action).toBe(
      grade(ordinary, { speed: 12, honking: false }).action
    );

    const crossing = event({ type: 'pedestrian_crossing', correctAction: 'stop' });
    const honkedTelemetry = createTelemetry(0, 2);
    recordFrame(honkedTelemetry, 0, 2, false, true);
    recordFrame(honkedTelemetry, 0, 2, true, true);
    expect(gradeEvent(honkedTelemetry, crossing, level).action).toBe('stop');
  });

  it('keeps every other prohibition working exactly as it did', () => {
    // A Give Way with nothing coming: stopping dead at the line is the failure,
    // and the horn has nothing to do with it either way.
    const giveWay = event({ correctAction: 'accelerate', avoid: ['brake'] });
    expect(grade(giveWay, { speed: 38, honking: false }).action).toBe('accelerate');
    expect(grade(giveWay, { speed: 38, honking: true }).action).toBe('accelerate');
    expect(grade(giveWay, { speed: 10, honking: false, braking: true }).action).toBe('accelerate');
    expect(grade(giveWay, { speed: 10, honking: true, braking: true }).action).toBe('accelerate');
    expect(grade(giveWay, { speed: 0, honking: false, braking: true }).action).toBe('brake');
    expect(grade(giveWay, { speed: 0, honking: true, braking: true }).action).toBe('brake');
  });
});
