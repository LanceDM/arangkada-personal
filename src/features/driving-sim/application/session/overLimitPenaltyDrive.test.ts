/**
 * Over the road's limit on clear road is a standing penalty, driven.
 *
 * Charged above the limit and never at it, warned before it is charged, capped,
 * not charged inside a scenario's zone, and never on the tutorial. It reaches
 * the host as a `penalty` report, which is what marks its log `standing` and
 * keeps it out of `bktEvidence`.
 */
import { describe, expect, it } from 'vitest';
import { DrivingFSM } from '@/features/driving-sim/domain/fsm/DrivingFSM';
import { level0 } from '@/features/driving-sim/domain/scenario/content/levels/level0';
import { level5 } from '@/features/driving-sim/domain/scenario/content/levels/level5';
import type { LevelConfig, ScenarioEvent } from '@/features/driving-sim/domain/scenario/scenarioDefinition';
import type { GameEvent } from '@/features/driving-sim/domain/world/GameEvent';
import { OVER_LIMIT_PENALTY } from '@/features/driving-sim/domain/systems/standingPenalties';
import { createDrivingSession, NO_INPUT, OVER_LIMIT_PENALTY_EVENT, type InputState } from './DrivingSession';

/** The level's own road with nothing on it. */
const clear = (level: LevelConfig, events: ScenarioEvent[] = []): LevelConfig => ({
  ...level,
  events,
  roadLength: 60_000,
});

interface Run {
  charges: Array<{ frame: number; kind: GameEvent['kind'] }>;
  firstWarning: number | null;
  topSpeed: number;
}

/** Holds the setting at `speed` for `frames`, on a clock the test owns. */
const drive = (level: LevelConfig, speed: number, frames = 60 * 40): Run => {
  const realPerformanceNow = performance.now;
  const realDateNow = Date.now;
  const realRandom = Math.random;
  let clock = 1_760_000_000_000;
  performance.now = () => clock;
  Date.now = () => clock;
  Math.random = () => 0.5;
  const run: Run = { charges: [], firstWarning: null, topSpeed: 0 };
  try {
    const session = createDrivingSession({ level, fsm: new DrivingFSM(), signCoverage: {}, timeLimitSteps: Infinity });
    let previous: InputState = NO_INPUT;
    for (let frame = 0; frame < frames; frame++) {
      clock = 1_760_000_000_000 + frame * (1000 / 60);
      if (session.getSnapshot().briefingEvent) session.dismissBriefing();
      const snapshot = session.getSnapshot();
      if (snapshot.overLimitWarning && run.firstWarning === null) run.firstWarning = frame;
      run.topSpeed = Math.max(run.topSpeed, snapshot.speed);
      const input: InputState = { ...NO_INPUT, throttle: snapshot.targetSpeed < speed && !previous.throttle };
      previous = input;
      for (const report of session.update(input)) {
        if (report.kind === 'penalty' && report.event.id === OVER_LIMIT_PENALTY_EVENT.id) {
          run.charges.push({ frame, kind: report.kind });
        }
      }
    }
    return run;
  } finally {
    performance.now = realPerformanceNow;
    Date.now = realDateNow;
    Math.random = realRandom;
  }
};

describe('the over-limit standing penalty', () => {
  it('is never charged at the limit', () => {
    const run = drive(clear(level5), level5.speedLimit);
    expect(run.topSpeed).toBe(level5.speedLimit);
    expect(run.charges).toEqual([]);
    expect(run.firstWarning).toBeNull();
  });

  it('is charged one step over it, after its warning, and capped', () => {
    const run = drive(clear(level5), level5.speedLimit + 5);
    expect(run.firstWarning).not.toBeNull();
    expect(run.charges.length).toBe(OVER_LIMIT_PENALTY.maxCharges);
    expect(run.charges.every(charge => charge.kind === 'penalty')).toBe(true);
    expect(run.firstWarning!).toBeLessThan(run.charges[0].frame);
  });

  it('is not charged on the tutorial, whose top speed is its limit', () => {
    const run = drive(clear(level0), level0.speedLimit + 10);
    expect(run.topSpeed).toBeLessThanOrEqual(level0.speedLimit);
    expect(run.charges).toEqual([]);
  });

  it('is not charged inside a scenario’s zone', () => {
    // One long zone from the start to most of the road: the car is answering it
    // the whole drive, so it is never on clear road.
    const zone: ScenarioEvent = {
      id: 'test.long-zone',
      type: 'speed_limit',
      speedRule: 'maximum',
      postedSpeed: 60,
      triggerAtDistance: 59_000,
      warningDistance: 58_800,
      description: 'A long zone',
      correctAction: 'brake',
      points: 10,
      penaltyMessage: '',
      rewardMessage: '',
      duration: 200,
      competency: 'speed_control',
      severity: 'minor',
    };
    const run = drive(clear(level5, [zone]), level5.speedLimit + 5, 60 * 20);
    expect(run.charges).toEqual([]);
  });
});
