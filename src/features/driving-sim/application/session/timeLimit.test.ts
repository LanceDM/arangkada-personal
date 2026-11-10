/**
 * The per-level time limit: the `time_up` edge, the clock that
 * fires it, and the measured table it reads.
 *
 * The clock counts world steps that drive the car, at rest or moving, and
 * nothing the world spends held. The table is measured by
 * a developers' script; this holds it to the content it was
 * measured on, so a change to a level's road fails here until it is measured
 * again (`npm run time-limits:update`).
 */
import { describe, expect, it } from 'vitest';
import { DrivingFSM } from '@/features/driving-sim/domain/fsm/DrivingFSM';
import { LEVELS } from '@/features/driving-sim/domain/scenario/levelCatalog';
import {
  DRIVING_STEPS_PER_SECOND,
  limitSecondsFor,
  TIME_LIMIT_ROUNDING_SECONDS,
  TIME_LIMITS,
  timeLimitStepsFor,
} from '@/features/driving-sim/domain/scenario/levelTimeLimits';
import type { GameEvent } from '@/features/driving-sim/domain/world/GameEvent';
import { createDriveController } from './driveController';
import { createDrivingSession, NO_INPUT, type DrivingSession } from './DrivingSession';
import { driveReference, isCorrectDrive } from './referenceDrive';
import { rollFor, timeLimitFingerprint } from './timeLimitMeasurement';

const level = (id: number) => LEVELS.find(entry => entry.id === id)!;

describe('the measured table', () => {
  it('has one row for every level in the catalogue, and nothing else', () => {
    expect(TIME_LIMITS.levels.map(row => row.levelId).sort((a, b) => a - b)).toEqual(LEVELS.map(entry => entry.id));
  });

  it('is twice the longest correct drive, rounded up to the half minute, in steps at 60 a second', () => {
    for (const row of TIME_LIMITS.levels) {
      expect(row.limitSeconds, `Level ${row.levelId}`).toBe(limitSecondsFor(row.longestSteps));
      expect(row.limitSeconds % TIME_LIMIT_ROUNDING_SECONDS).toBe(0);
      expect(row.limitSteps).toBe(row.limitSeconds * DRIVING_STEPS_PER_SECOND);
      expect(row.limitSteps).toBeGreaterThanOrEqual(2 * row.longestSteps);
      expect(timeLimitStepsFor(row.levelId)).toBe(row.limitSteps);
    }
  });

  it('was measured on the content the game plays now', () => {
    for (const row of TIME_LIMITS.levels) {
      expect(
        timeLimitFingerprint(row.levelId),
        `Level ${row.levelId} changed since its time limit was measured: run npm run time-limits:update`
      ).toBe(row.fingerprint);
    }
  });

  it('is measured from correct drives: the reference driver drives every level right, inside half its limit', () => {
    for (const { id } of LEVELS) {
      const result = driveReference(rollFor(id, 1));
      expect(isCorrectDrive(result), `Level ${id}: ${JSON.stringify(result.decisions.filter(d => !d.correct))}`).toBe(true);
      expect(result.drivenSteps).toBeLessThanOrEqual(timeLimitStepsFor(id) / 2);
    }
  }, 120_000);
});

describe('the clock', () => {
  const standStill = (session: DrivingSession, steps: number) => {
    const seen: GameEvent[] = [];
    for (let step = 0; step < steps; step++) seen.push(...session.update(NO_INPUT));
    return seen;
  };

  it('ends a run at rest with time_up on the step its limit is spent, logged from IDLE', () => {
    const fsm = new DrivingFSM();
    const session = createDrivingSession({ level: level(1), fsm, signCoverage: {}, timeLimitSteps: 90 });
    expect(session.getSnapshot().drivingSecondsLeft).toBe(2);

    expect(standStill(session, 89)).toEqual([]);
    expect(session.getSnapshot().drivingSecondsLeft).toBe(1);
    expect(standStill(session, 1)).toEqual([{ kind: 'timed_out' }]);
    expect(session.getDrivenSteps()).toBe(90);
    expect(session.getSnapshot().drivingSecondsLeft).toBe(0);
    expect(fsm.getState()).toBe('GAME_OVER');
    expect(fsm.getTransitionLog().at(-1)).toMatchObject({ from: 'IDLE', to: 'GAME_OVER', trigger: 'time_up' });

    // The run is over: nothing more is reported, and the clock stops.
    expect(standStill(session, 30)).toEqual([]);
    expect(session.getDrivenSteps()).toBe(90);
  });

  it('plays each level under its measured limit by default, and none where a harness asks for none', () => {
    const session = createDrivingSession({ level: level(3), fsm: new DrivingFSM(), signCoverage: {} });
    expect(session.getSnapshot().drivingSecondsLeft).toBe(timeLimitStepsFor(3) / DRIVING_STEPS_PER_SECOND);
    const unlimited = createDrivingSession({
      level: level(3),
      fsm: new DrivingFSM(),
      signCoverage: {},
      timeLimitSteps: Number.POSITIVE_INFINITY,
    });
    expect(unlimited.getSnapshot().drivingSecondsLeft).toBeNull();
  });

  it('spends nothing while a scenario is held for reading', () => {
    const session = createDrivingSession({ level: level(2), fsm: new DrivingFSM(), signCoverage: {} });
    // Drive up to the first scenario's briefing, and leave it open.
    let steps = 0;
    while (!session.getSnapshot().briefingEvent && steps < 5_000) {
      session.update({ ...NO_INPUT, throttle: steps < 8 && steps % 4 === 0 });
      steps += 1;
    }
    expect(session.getSnapshot().briefingEvent).not.toBeNull();
    const before = session.getDrivenSteps();
    standStill(session, 600);
    expect(session.getDrivenSteps()).toBe(before);
    session.dismissBriefing();
    standStill(session, 1);
    expect(session.getDrivenSteps()).toBe(before + 1);
  });

  it('lets a run that reaches its end on its last step finish, and times out one step short', () => {
    const tutorial = level(0);
    const { drivenSteps } = driveReference(tutorial);
    expect(driveReference(tutorial, { timeLimitSteps: drivenSteps }).finished).toBe(true);
    const short = driveReference(tutorial, { timeLimitSteps: drivenSteps - 1 });
    expect(short.finished).toBe(false);
    expect(short.drivenSteps).toBe(drivenSteps - 1);
  }, 30_000);
});

describe('what the host makes of it', () => {
  it('fails the run as timed out, with no crash reason and no violation added, whatever it scored', () => {
    const fsm = new DrivingFSM();
    let finished: { result: unknown; holdMs: number } | null = null;
    const controller = createDriveController({
      session: { getFsm: () => fsm } as unknown as DrivingSession,
      level: level(1),
      evaluateAction: () => ({ isCorrect: true, logIndex: 0 }),
      readLogs: () => [],
      readTraces: () => [],
      readTotals: (extraViolations = 0) => ({ score: 999, violations: 2 + extraViolations, correctActions: 5, logs: [] }),
      host: { jolt: () => {}, finish: (result, _telemetry, holdMs) => (finished = { result, holdMs }) },
    });
    controller.handle([{ kind: 'timed_out' }]);
    expect(finished!.holdMs).toBe(0);
    expect(finished!.result).toMatchObject({ completed: false, stars: 0, timedOut: true, violations: 2 });
    expect(finished!.result).not.toHaveProperty('crashReason');
  });
});

describe('the time a panel may hold the drive', () => {
  /** Drives toward `levelId`'s first scenario at a crawl, braking to rest short of it, until `open` says a panel is up. */
  const holdAtFirstPanel = (levelId: number, open: (session: DrivingSession) => boolean) => {
    const session = createDrivingSession({ level: level(levelId), fsm: new DrivingFSM(), signCoverage: {} });
    for (let step = 0; step < 20_000 && !open(session); step++) {
      session.update({ ...NO_INPUT, throttle: step < 4 && step % 2 === 0 });
      const snapshot = session.getSnapshot();
      if (snapshot.briefingEvent && !open(session)) session.dismissBriefing();
    }
    expect(open(session)).toBe(true);
    return session;
  };

  it('closes a briefing left open for a minute, the Short Quiz time per item, and the drive goes on', () => {
    const session = holdAtFirstPanel(2, s => s.getSnapshot().briefingEvent !== null);
    expect(session.getSnapshot().panelSecondsLeft).toBe(60);
    const before = session.getDrivenSteps();
    for (let step = 0; step < 59 * 60; step++) session.update(NO_INPUT);
    expect(session.getSnapshot().panelSecondsLeft).toBe(1);
    expect(session.getSnapshot().briefingEvent).not.toBeNull();
    for (let step = 0; step < 60; step++) session.update(NO_INPUT);
    expect(session.getSnapshot().briefingEvent).toBeNull();
    expect(session.getSnapshot().panelSecondsLeft).toBeNull();
    // A minute held spent no driving time.
    expect(session.getDrivenSteps()).toBe(before);
  });

  it('settles a question left a minute unanswered as unanswered, which the rule engine scores wrong', () => {
    // Level 10's checkpoint opens its questions at a stop, inside its zone.
    const checkpoint = level(10).events.find(event => event.id === 'level10.the-checkpoint')!;
    const session = createDrivingSession({
      level: level(10),
      fsm: new DrivingFSM(),
      signCoverage: {},
      initialDistance: checkpoint.triggerAtDistance - 400,
    });
    for (let step = 0; step < 5_000 && !session.getSnapshot().inspectionEvent; step++) {
      const { briefingEvent, speed } = session.getSnapshot();
      if (briefingEvent) session.dismissBriefing();
      const nearing = (session.getFrame()?.scene.car.distance ?? 0) > checkpoint.triggerAtDistance - 150;
      session.update({ ...NO_INPUT, throttle: step < 4 && step % 2 === 0, brake: nearing && speed > 0 });
    }
    expect(session.getSnapshot().inspectionEvent?.id).toBe(checkpoint.id);
    const seen: GameEvent[] = [];
    for (let step = 0; step < 60 * 60; step++) seen.push(...session.update(NO_INPUT));
    expect(seen).toEqual([expect.objectContaining({ kind: 'decision', action: 'unanswered', settlement: 'unanswered' })]);
    expect(session.getSnapshot().inspectionEvent).toBeNull();
  });

  it('spends time away from the page on the open panel, or as driving time when none is open', () => {
    const held = holdAtFirstPanel(2, s => s.getSnapshot().briefingEvent !== null);
    const before = held.getDrivenSteps();
    held.spendAway(61_000);
    expect(held.getDrivenSteps()).toBe(before);
    held.update(NO_INPUT);
    expect(held.getSnapshot().briefingEvent).toBeNull();

    const fsm = new DrivingFSM();
    const driving = createDrivingSession({ level: level(1), fsm, signCoverage: {} });
    driving.update(NO_INPUT);
    driving.spendAway(60 * 60 * 1000);
    expect(driving.update(NO_INPUT)).toEqual([{ kind: 'timed_out' }]);
    expect(fsm.getTransitionLog().at(-1)?.trigger).toBe('time_up');
  });
});
