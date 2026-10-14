/**
 * Theta moves where a scenario is announced, and only as far as the road allows.
 *
 * Before this was fixed, a widened approach reached
 * back past the scenario in front of it - thirty of the game's eighty-three
 * static scenarios at the policy's own 1.5, and every level's first one into
 * the start runway - the approach cue read the unscaled window, so it sat at 1
 * through the first third of a widened approach and began a narrowed one
 * part-way down, and nothing stopped a narrowed approach leaving less road than
 * a stop needs.
 *
 * Every variant of every slot, in a genuine roll of its level, at every theta
 * the machine accepts.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { approachLead } from '@/features/driving-sim/domain/fsm/approachLead';
import { DrivingFSM } from '@/features/driving-sim/domain/fsm/DrivingFSM';
import { LEVELS } from '@/features/driving-sim/domain/scenario/levelCatalog';
import type { LevelConfig } from '@/features/driving-sim/domain/scenario/scenarioDefinition';
import {
  PERCEPTION_REACTION_SECONDS,
  stoppingDistanceFrom,
} from '@/features/driving-sim/domain/systems/eventScheduler';
import { isTutorial } from '@/features/driving-sim/domain/systems/tutorial';
import { paceOf, unitsForSeconds } from '@/features/driving-sim/domain/world/DrivingPace';
import { speedProfileFor } from '@/features/driving-sim/domain/world/vehiclePhysics';
import { createDrivingSession, NO_INPUT } from './DrivingSession';
import {
  THETAS,
  clearFrom,
  driveScenario,
  everyScenario,
  limitsOf,
  type RolledScenario,
  type ScenarioDrive,
} from './thetaDrives';

interface Run extends RolledScenario {
  theta: number;
  drive: ScenarioDrive;
}

let runs: Run[] = [];

beforeAll(() => {
  runs = everyScenario().flatMap(scenario =>
    THETAS.map(theta => ({ ...scenario, theta, drive: driveScenario(scenario.level, scenario.event, theta) }))
  );
}, 120_000);

const label = (run: Run) => `level ${run.level.id} ${run.event.id} at theta ${run.theta}`;

/** Held to be read: answered with the car, outside the tutorial. */
const isRead = ({ level, event }: RolledScenario) =>
  !isTutorial(level) &&
  !event.inspection &&
  !(event.parkingCutscene && event.bay) &&
  !event.cutscene;

/** The most road the car can cover in one frame on this level: its top speed, at its pace. */
const stepOf = (level: LevelConfig) =>
  speedProfileFor(level.speedLimit).maxSpeed * paceOf(level).distancePerSpeed;

/** Where the approach should open for this run: the lead the guard computes. */
const leadOf = (run: Run) => approachLead(limitsOf(run.level, run.event), { approachScale: run.theta });

describe('every scenario, at every theta', () => {
  it('opens its approach', () => {
    expect(runs.filter(run => run.drive.openedAt === null).map(label)).toEqual([]);
  });

  it('holds a scenario answered by driving to be read exactly once, and holds nothing else', () => {
    const wrong = runs
      .filter(run => run.drive.briefings !== (isRead(run) ? 1 : 0))
      .map(run => `${label(run)}: read ${run.drive.briefings} times`);
    expect(wrong).toEqual([]);
  });

  it('opens nowhere inside the road kept clear after the scenario before it, or the start runway', () => {
    // Unless its baseline already did: theta never moves an approach nearer the
    // previous scenario than the authored window put it.
    const intruding = runs
      .filter(run => {
        const clear = clearFrom(run.level, run.event);
        const baselineReaches =
          run.event.triggerAtDistance - limitsOf(run.level, run.event).warningDistance < clear;
        return !baselineReaches && run.event.triggerAtDistance + run.drive.openedAt! < clear - 1e-9;
      })
      .map(label);
    expect(intruding).toEqual([]);
  });

  it('opens where its bounded lead says, and never leaves less road than a stop needs', () => {
    const wrong: string[] = [];
    for (const run of runs) {
      const lead = leadOf(run);
      const leftAtOpening = -run.drive.openedAt!;
      const startedAhead = run.event.triggerAtDistance - run.drive.startDistance;
      const step = stepOf(run.level);
      if (leftAtOpening > lead + 1e-9) wrong.push(`${label(run)}: opened ${leftAtOpening} out, lead ${lead}`);
      // A car that started nearer than the lead opens on its first frame.
      if (startedAhead > lead && leftAtOpening <= lead - step) {
        wrong.push(`${label(run)}: opened late, ${leftAtOpening} out against a lead of ${lead}`);
      }
      // A stop's worth from the level's limit, computed here from the car's
      // braking rather than read back from the floors the session was given -
      // or the whole baseline, where that is shorter and theta never touched it.
      const stop = stoppingDistanceFrom(run.level.speedLimit, paceOf(run.level));
      const floor = Math.min(limitsOf(run.level, run.event).warningDistance, stop);
      if (startedAhead > floor && leftAtOpening <= floor - step) {
        wrong.push(`${label(run)}: ${leftAtOpening} of road left, a stop needs ${stop}`);
      }
    }
    expect(wrong).toEqual([]);
  });

  it('shows the approach cue as the share of that lead still ahead, from 1 at the pause', () => {
    const wrong: string[] = [];
    for (const run of runs) {
      const lead = leadOf(run);
      for (const { diff, approach } of run.drive.cue) {
        const expected = Math.min(1, Math.max(0, -diff) / Math.max(1, lead));
        if (Math.abs(approach - expected) > 1e-9) {
          wrong.push(`${label(run)}: cue ${approach} at ${diff}, expected ${expected}`);
          break;
        }
      }
      const first = run.drive.cue[0];
      const startedAhead = run.event.triggerAtDistance - run.drive.startDistance;
      if (first && startedAhead > lead && first.approach < 1 - stepOf(run.level) / lead) {
        wrong.push(`${label(run)}: the cue began at ${first.approach}`);
      }
    }
    expect(wrong).toEqual([]);
  });

  it('records, with its decision, the theta asked for and the lead it opened at', () => {
    // The per-decision record's theta is read off the session when the host
    // grades the decision. It has to be the lead the approach above opened at,
    // not the theta the level entry asked for, wherever a limit held it.
    // A drive the cruising driver never gets a decision out of - it hits the
    // scenario's traffic, or runs out of road - has no decision to record.
    const decided = runs.filter(run => run.drive.settlement !== null);
    const wrong: string[] = [];
    let held = 0;
    for (const run of decided) {
      const recorded = run.drive.approach;
      if (!recorded) {
        wrong.push(`${label(run)}: decided with no approach recorded`);
        continue;
      }
      const lead = leadOf(run);
      const baseline = limitsOf(run.level, run.event).warningDistance;
      if (recorded.requested !== run.theta) wrong.push(`${label(run)}: requested ${recorded.requested}`);
      if (recorded.lead !== lead) wrong.push(`${label(run)}: recorded lead ${recorded.lead}, opened at ${lead}`);
      if (recorded.baselineLead !== baseline) wrong.push(`${label(run)}: baseline ${recorded.baselineLead}`);
      if (Math.abs(recorded.effective - lead / baseline) > 1e-12) wrong.push(`${label(run)}: effective ${recorded.effective}`);
      if (Math.abs(recorded.effective - run.theta) > 1e-9) held += 1;
    }
    expect(wrong).toEqual([]);
    // Not vacuous: nearly every drive is decided, and the limits bind often
    // enough that requested and effective genuinely differ - which is the
    // reason both are recorded.
    expect(decided.length).toBeGreaterThan(runs.length * 0.9);
    expect(held).toBeGreaterThan(0);
  });
});

describe('the stopping floor', () => {
  /**
   * Brings the car to a steady speed on this level, then holds the brake to a
   * stop, and reports the speed it braked from and the road it took.
   */
  const brakeToRest = (levelId: number) => {
    const level = LEVELS.find(entry => entry.id === levelId)!;
    const session = createDrivingSession({ level, fsm: new DrivingFSM(), signCoverage: {} });
    const car = () => session.getFrame()!.scene.car;
    let frame = 0;
    const step = (brake: boolean) => {
      session.update({ ...NO_INPUT, throttle: !brake && frame < 12 && frame % 4 === 0, brake });
      if (session.getSnapshot().briefingEvent) session.dismissBriefing();
      frame += 1;
    };
    do {
      step(false);
    } while (frame < 12 || car().speed !== session.getSnapshot().targetSpeed);

    const from = car().speed;
    const at = car().distance;
    while (car().speed > 0) step(true);
    return { level, from, braked: car().distance - at };
  };

  it(`is the road the car really needs to stop, on the shared pace and on Level 7's`, () => {
    for (const levelId of [3, 7]) {
      const { level, from, braked } = brakeToRest(levelId);
      const pace = paceOf(level);
      expect(from).toBeGreaterThan(0);
      expect(stoppingDistanceFrom(from, pace)).toBeCloseTo(
        unitsForSeconds(PERCEPTION_REACTION_SECONDS, from, pace) + braked,
        6
      );
    }
  });
});
