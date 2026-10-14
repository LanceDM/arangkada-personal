/**
 * A reaction time is only ever a response.
 *
 * Every graded decision used to be
 * timed from the machine's most recent approach entry to its verdict: a window
 * the car drove through recorded the time taken to drive through it, a
 * checkpoint recorded the time spent reading its question, and a stop sign the
 * car came to rest before recorded almost nothing, because coming to rest
 * restarts the approach. The practice policy's latency bucket reads these.
 *
 * Every way a decision can be settled is driven here, on a real scenario
 * through the real session, and read the way the host reads it:
 *
 *   response   - timed, from the release of the read phase, or the approach
 *   expired    - censored if the scenario asked for a response, else nothing
 *   lapse      - nothing
 *   question   - nothing
 *   guided     - nothing
 */
import { describe, expect, it } from 'vitest';
import { DrivingFSM } from '@/features/driving-sim/domain/fsm/DrivingFSM';
import { evaluatePlayerAction } from '@/features/driving-sim/domain/evaluation/evaluatePlayerAction';
import { observeReaction } from '@/features/driving-sim/domain/evaluation/reactionTiming';
import { LEVELS } from '@/features/driving-sim/domain/scenario/levelCatalog';
import type { GameEvent } from '@/features/driving-sim/domain/world/GameEvent';
import { createDriveController } from './driveController';
import { createDrivingSession } from './DrivingSession';
import {
  cruise,
  driveScenario,
  everyScenario,
  swerveAndStopAt,
  type Driver,
  type DriveOptions,
  type ScenarioDrive,
} from './thetaDrives';

const FRAME_MS = 1000 / 60;

/**
 * The decimal places a timed response can be compared to. The harness clock
 * runs near 1.76e12 ms, where a double resolves about 2.4e-4 ms, so a
 * difference of two of its readings is only exact to three places. A read
 * phase moves the time by whole frames (16.7 ms), so three places still tell
 * the release from the announcement.
 */
const CLOCK_DIGITS = 3;

const scenario = (id: string) => {
  const found = everyScenario().find(({ event }) => event.id === id);
  if (!found) throw new Error(`no scenario ${id}`);
  return found;
};

/** The time a drive recorded, checked to be a timed response. */
const timedMs = (drive: ScenarioDrive): number => {
  expect(drive.reaction?.kind).toBe('timed');
  return (drive.reaction as { kind: 'timed'; ms: number }).ms;
};

const drive = (id: string, driver: Driver = cruise, options: DriveOptions = {}): ScenarioDrive => {
  const { level, event } = scenario(id);
  return driveScenario(level, event, 1, driver, options);
};

/** Brakes to rest once the car is `within` units of the line, then waits there. */
const stopWithin = (within: number): Driver => ({ diff }) => (diff >= -within ? { brake: true } : {});

/** Holds the wheel over from the start, which puts the car in the lane a turn that way is made from. */
const holdWheel = (side: 'left' | 'right'): Driver => () => ({ [side]: true });

describe('a decision the driver settled', () => {
  it('is timed from the release of the read phase, never from the announcement', () => {
    // The world is held while the scenario is read, and the clock keeps
    // running: two seconds of reading must not appear in the time.
    const read = drive('level4.traverse.stop-line', stopWithin(100), { readFrames: 120 });
    expect(read.settlement).toBe('response');
    expect(read.frames.released! - read.frames.opened!).toBe(120);
    expect(timedMs(read)).toBeCloseTo((read.frames.decided! - read.frames.released!) * FRAME_MS, CLOCK_DIGITS);
  });

  it('is still timed from the release when the car came to rest on the way', () => {
    // Coming to rest mid-approach returns the machine to IDLE, and closing the
    // decision walks it back through APPROACHING_EVENT. Read from that entry,
    // the correct response to a stop sign was timed at nothing.
    const stopped = drive('level4.traverse.stop-line', stopWithin(100));
    expect(stopped.settlement).toBe('response');
    const ms = timedMs(stopped);
    expect(ms).toBeCloseTo((stopped.frames.decided! - stopped.frames.released!) * FRAME_MS, CLOCK_DIGITS);
    expect(ms).toBeGreaterThan(1000);
  });

  it('is timed for a committed turn', () => {
    const turned = drive('level6.right-turn-curb-lane', holdWheel('right'));
    expect(turned.settlement).toBe('response');
    expect(turned.reaction?.kind).toBe('timed');
  });

  it('is timed for a merge, which is the driver joining the lane', () => {
    // Across from the acceleration lane once the separator has ended.
    const merged = drive('level7.merging-traffic-minimum-speed', ({ diff }) => (diff >= -600 ? { left: true } : {}));
    expect(merged.settlement).toBe('response');
    expect(merged.reaction?.kind).toBe('timed');
  });

  it('is not timed where the scenario asked for nothing - a marking that permits', () => {
    const neutral = drive('level4.longitudinal.broken-yellow');
    expect(neutral.settlement).toBe('response');
    expect(neutral.reaction).toEqual({ kind: 'none' });
  });
});

describe('a decision the window closed on', () => {
  it('is censored, and never timed, when the scenario asked for a response', () => {
    // Driven straight through a stop sign: the response took at least the
    // whole window, and no time was observed.
    const through = drive('level4.traverse.stop-line');
    expect(through.settlement).toBe('expired');
    expect(through.reaction).toEqual({ kind: 'censored' });
  });

  it('is censored for a turn that was never committed', () => {
    const straight = drive('level6.right-turn-curb-lane');
    expect(straight.settlement).toBe('expired');
    expect(straight.reaction).toEqual({ kind: 'censored' });
  });

  it('says nothing where the whole window was the answer', () => {
    // A prohibition passed by driving on, and a speed read at the sign: the
    // window closing is how both are always settled.
    for (const id of ['level3.route-restriction.no-entry-all-vehicles', 'level2.settle.posted-limit']) {
      const kept = drive(id);
      expect(kept.settlement, id).toBe('expired');
      expect(kept.reaction, id).toEqual({ kind: 'none' });
    }
  });

  it('says nothing for a checkpoint driven past, which was a question never asked', () => {
    const past = drive('level1.code-match.passenger-car');
    expect(past.settlement).toBe('expired');
    expect(past.reaction).toEqual({ kind: 'none' });
  });
});

describe('a decision that was never a response', () => {
  it('says nothing for a line lost part-way through', () => {
    const drifted = drive('level8.hold-your-line', swerveAndStopAt(0.9));
    expect(drifted.settlement).toBe('lapse');
    expect(drifted.reaction).toEqual({ kind: 'none' });
  });

  it('says nothing for a question answered while the drive was frozen', () => {
    const checkpoint = drive('level1.code-match.passenger-car', stopWithin(200));
    const cutscene = drive('level5.roundabout-entry.circulating-car');
    const parking = drive('level6.parallel-parking-bay', stopWithin(100));
    for (const answered of [checkpoint, cutscene, parking]) {
      expect(answered.settlement).toBe('question');
      expect(answered.reaction).toEqual({ kind: 'none' });
    }
  });

  it('says nothing for a tutorial step, completed or not', () => {
    const completed = drive('level0.start-accelerate');
    const missed = drive('level0.full-stop-checkpoint');
    for (const step of [completed, missed]) {
      expect(step.settlement).toBe('guided');
      expect(step.reaction).toEqual({ kind: 'none' });
    }
  });

  it('says nothing for a standing penalty or a garage answer, which carry no settlement', () => {
    const { event } = scenario('level4.traverse.stop-line');
    expect(observeReaction(undefined, event, 5_000)).toEqual({ kind: 'none' });

    // And the controller hands penalties over without one.
    const level = LEVELS.find(entry => entry.id === 4)!;
    const session = createDrivingSession({ level, fsm: new DrivingFSM(), signCoverage: {} });
    const calls: unknown[][] = [];
    const controller = createDriveController({
      session,
      level,
      evaluateAction: (...args) => {
        calls.push(args);
        return { isCorrect: true, logIndex: calls.length - 1 };
      },
      readLogs: () => [],
      readTraces: () => [],
      readTotals: () => ({ score: 0, violations: 0, correctActions: 0, logs: [] }),
      host: { jolt: () => {}, finish: () => {} },
    });
    const reports: GameEvent[] = [
      { kind: 'decision', event, action: 'accelerate', settlement: 'expired' },
      { kind: 'penalty', event, action: 'brake' },
    ];
    controller.handle(reports);
    expect(calls[0]).toEqual([event, 'accelerate', 'road', false, 'expired', session.approachTraceFor(event)]);
    expect(calls[1]).toEqual([event, 'brake', 'penalty', true]);
  });
});

describe('what reaches the learner model', () => {
  const { event } = scenario('level4.traverse.stop-line');

  it('stores a response as its time, a censored window as a flag, and anything else as neither', () => {
    const timed = evaluatePlayerAction(event, 'stop', 0, { kind: 'timed', ms: 1_234 }).log;
    const censored = evaluatePlayerAction(event, 'accelerate', 0, { kind: 'censored' }).log;
    const neither = evaluatePlayerAction(event, 'stop', 0).log;

    expect(timed.reactionTime).toBe(1_234);
    expect(timed).not.toHaveProperty('reactionCensored');
    expect(censored.reactionCensored).toBe(true);
    expect(censored).not.toHaveProperty('reactionTime');
    expect(neither).not.toHaveProperty('reactionTime');
    expect(neither).not.toHaveProperty('reactionCensored');
  });
});
