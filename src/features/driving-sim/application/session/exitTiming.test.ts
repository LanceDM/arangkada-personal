/**
 * The exit is taken at the exit, not several car lengths after it.
 *
 * Six route distances used to mean "the exit": the gore's declared point, the
 * nose the gore was actually drawn at (120 units further on), the scenario's
 * trigger, the far end of a 700-unit commit band, the frame the animation
 * happened to start on, and the hand-off. A driver saw the marker go past and
 * then felt the car move. One number now, measured at the front bumper, taken
 * on a press of its own.
 */
import { describe, expect, it } from 'vitest';
import { DrivingFSM } from '@/features/driving-sim/domain/fsm/DrivingFSM';
import { LEVELS } from '@/features/driving-sim/domain/scenario/levelCatalog';
import { CAR_LENGTH } from '@/features/driving-sim/domain/world/routeGeometry';
import { RAMP_LENGTH } from '@/features/driving-sim/domain/systems/maneuvers';
import {
  CANVAS_WIDTH,
  ROAD_CENTRE_X,
  laneCentreX,
} from '@/features/driving-sim/domain/world/vehiclePhysics';
import { createDrivingSession, NO_INPUT, type InputState } from './DrivingSession';
import type { GameEvent } from '@/features/driving-sim/domain/world/GameEvent';

const level7 = LEVELS.find(level => level.id === 7)!;
const exit = level7.events.find(event => event.maneuver?.style === 'ramp')!;
const EXIT_AT = exit.maneuver!.commitAt!;
const OUTER = laneCentreX(3, ROAD_CENTRE_X);

interface Step {
  distance: number;
  x: number;
  heading: number;
  lane: number;
  speed: number;
}

interface Run {
  steps: Step[];
  decisions: { id: string; action: string }[];
  /** Route distance the car first moved right of where it committed. */
  turnedAt: number | null;
  crashed: boolean;
}

/**
 * Drives the exit the way a player does: into the outer lane, down to the ramp
 * speed, then a press at the marker. `pressFrom` chooses where the fresh press
 * happens, as an offset from the anchor.
 */
const driveExit = (options: { pressFrom?: number; hold?: boolean; speed?: number } = {}): Run => {
  const { pressFrom = -CAR_LENGTH / 2, hold = false, speed = 45 } = options;
  const fsm = new DrivingFSM();
  const session = createDrivingSession({
    level: level7,
    fsm,
    signCoverage: {},
    initialDistance: EXIT_AT - 1400,
  });

  const run: Run = { steps: [], decisions: [], turnedAt: null, crashed: false };
  const realNow = performance.now;
  let clock = 1_760_000_000_000;
  performance.now = () => clock;
  let previousRight = false;
  let committedX: number | null = null;

  /**
   * The host's half of a graded decision. Without it the machine stays in the
   * state the last event was graded in and no later event can open an approach
   * — so the exit would never become active and this file would pass by never
   * reaching what it is about.
   */
  const settleFsm = () => {
    fsm.transition('answer_correct');
    fsm.transition('feedback_displayed');
    fsm.transition('road_clear');
  };

  try {
    for (let frame = 0; frame < 3000; frame++) {
      clock += 1000 / 60;
      if (session.getSnapshot().briefingEvent) session.dismissBriefing();

      const snapshot = session.getSnapshot();
      const car = session.getFrame()?.scene.car;
      const distance = car?.distance ?? 0;
      const x = car?.x ?? OUTER;

      const wantPress = distance + CAR_LENGTH / 2 >= EXIT_AT + pressFrom;
      const input: InputState = {
        ...NO_INPUT,
        throttle: snapshot.targetSpeed < speed - 1 && frame % 3 === 0,
        brake: snapshot.speed > speed + 2,
        // `hold` is a key that never comes up on the run in to the marker,
        // which is what a driver steering into the lane actually does.
        right: hold
          ? distance > EXIT_AT - 900 || x < OUTER - 2
          : (wantPress && !previousRight) || x < OUTER - 2,
        left: x > OUTER + 2 && !wantPress && !hold,
      } as InputState;
      previousRight = input.right;

      const queue: GameEvent[] = [...session.update(input)];
      while (queue.length > 0) {
        const event = queue.shift()!;
        if (event.kind === 'crashed') run.crashed = true;
        if (event.kind === 'decision') {
          run.decisions.push({ id: event.event.id, action: event.action });
          settleFsm();
          queue.push(...session.settleDecision({ isCorrect: true, weakCompetency: null }));
          // Only a committed ramp starts the manoeuvre. A refusal is still a
          // decision, and treating it as one made ordinary steering look like a
          // turn.
          if (event.event.id === exit.id && event.action === 'turn_right') committedX = x;
        }
      }

      const after = session.getFrame()?.scene.car;
      if (after) {
        run.steps.push({
          distance: after.distance,
          x: after.x,
          heading: after.heading,
          lane: after.lane,
          speed: after.speed,
        });
        if (run.turnedAt === null && committedX !== null && after.x > committedX + 2) {
          run.turnedAt = after.distance;
        }
        if (after.distance > EXIT_AT + 1200) break;
      }
    }
  } finally {
    performance.now = realNow;
  }
  return run;
};

describe('taking the exit', () => {
  const run = driveExit();

  it('is graded exactly once', () => {
    expect(run.decisions.filter(decision => decision.id === exit.id)).toHaveLength(1);
  });

  it('starts turning within half a car length of the marker', () => {
    expect(run.turnedAt, 'the car never moved towards the ramp').not.toBeNull();
    expect(Math.abs(run.turnedAt! + CAR_LENGTH / 2 - EXIT_AT)).toBeLessThanOrEqual(CAR_LENGTH);
  });

  it('never passes the marker before it starts', () => {
    expect(run.turnedAt! + CAR_LENGTH / 2).toBeLessThanOrEqual(EXIT_AT + CAR_LENGTH / 2);
  });

  it('moves only towards the ramp, and only forwards', () => {
    // The manoeuvre's own length. Past it the lane tapers back into the
    // approach road and the bounds bring the car in, which is the road doing
    // its job rather than the turn undoing itself.
    const during = run.steps.filter(
      step => step.distance >= run.turnedAt! && step.distance <= run.turnedAt! + RAMP_LENGTH - 20
    );
    expect(during.length).toBeGreaterThan(20);
    for (let i = 1; i < during.length; i++) {
      expect(during[i].x, 'steered back towards the carriageway').toBeGreaterThanOrEqual(
        during[i - 1].x - 0.01
      );
      expect(during[i].distance, 'the route went backwards').toBeGreaterThanOrEqual(
        during[i - 1].distance
      );
    }
  });

  it('leans gradually and stays on the canvas', () => {
    const during = run.steps.filter(
      step => step.distance >= run.turnedAt! - 100 && step.distance <= run.turnedAt! + RAMP_LENGTH
    );
    for (const step of during) {
      expect(Math.abs(step.heading)).toBeLessThan(0.4);
      expect(step.x).toBeGreaterThan(0);
      expect(step.x).toBeLessThan(CANVAS_WIDTH);
    }
    for (let i = 1; i < during.length; i++) {
      expect(Math.abs(during[i].heading - during[i - 1].heading)).toBeLessThan(0.06);
    }
  });

  it('never drives through the gore', () => {
    expect(run.crashed).toBe(false);
  });

  it('leaves a valid world behind it', () => {
    const last = run.steps[run.steps.length - 1];
    expect(Number.isFinite(last.distance)).toBe(true);
    expect(Number.isFinite(last.x)).toBe(true);
    expect(last.heading).toBe(0);
    expect(last.speed).toBeGreaterThan(0);
    expect(last.lane).toBeGreaterThanOrEqual(0);
    expect(last.lane).toBeLessThanOrEqual(3);
  });

  it('does not open the plaza while the ramp is being driven', () => {
    const order = run.decisions.map(decision => decision.id);
    const toll = order.indexOf('level7.toll-plaza-closed-gates');
    if (toll >= 0) expect(toll).toBeGreaterThan(order.indexOf(exit.id));
    expect(run.steps.some(step => step.distance > EXIT_AT + 1000)).toBe(true);
  });
});

describe('what will not take the exit', () => {
  it('a key already held on the way into the lane', () => {
    const held = driveExit({ hold: true });
    expect(held.decisions.find(decision => decision.id === exit.id)?.action).not.toBe('turn_right');
  });

  it('a press before the car has reached the marker', () => {
    const early = driveExit({ pressFrom: -900 });
    const startedLate =
      early.turnedAt === null || early.turnedAt + CAR_LENGTH / 2 >= EXIT_AT - CAR_LENGTH;
    expect(startedLate).toBe(true);
  });

  it('a press at the marker while still carrying expressway speed', () => {
    const fast = driveExit({ speed: 99 });
    expect(fast.decisions.find(decision => decision.id === exit.id)?.action).toBe('too_fast');
    expect(fast.turnedAt).toBeNull();
  });
});
