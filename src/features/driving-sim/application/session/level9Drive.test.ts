/**
 * Level 9, actually driven.
 *
 * `level9.test.ts` checks the content; this one runs the real session over the
 * real road with a real keyboard and asks the two questions that settle it: can
 * each scenario be passed by doing the thing it asks for, and is it failed by
 * not doing it?
 *
 * The strategy sweep at the bottom is the other half. This module's answers are
 * mostly about slowing down, which is exactly the shape of level a single habit
 * can beat, so every simplistic habit is driven here rather than reasoned about
 * — and each has to miss the pass mark by a margin or end in an impact.
 */
import { describe, expect, it } from 'vitest';
import { DrivingFSM } from '@/features/driving-sim/domain/fsm/DrivingFSM';
import { LEVELS } from '@/features/driving-sim/domain/scenario/levelCatalog';
import { evaluateWeightedRule } from '@/features/driving-sim/domain/evaluation/ruleEngine';
import { createDrivingSession, NO_INPUT, type InputState } from './DrivingSession';
import type { GameEvent } from '@/features/driving-sim/domain/world/GameEvent';
import { laneCentreX, roadXAt, type LaneIndex } from '@/features/driving-sim/domain/world/vehiclePhysics';
import type { ThrottleCue } from '@/features/driving-sim/domain/world/GameWorld';

const level9 = LEVELS.find(level => level.id === 9)!;

/** How near the middle of a lane counts as being settled in it, in pixels. */
const LANE_TOLERANCE = 4;

/** The lane against the center line, which is where the drive starts. */
const INNER = 2 as LaneIndex;
/** The lane against the curb. */
const CURB = 3 as LaneIndex;

/** What the driver can see, as a driver sees it. */
interface RoadView {
  distance: number;
  speed: number;
  lane: LaneIndex;
  /** Where the car is across the screen, for aiming at the middle of a lane. */
  x: number;
  /** True once the car has come to rest at least once in this scenario. */
  stopped: boolean;
  /**
   * The jammed-throttle readout, exactly as the road prompt shows it.
   *
   * Read rather than inferred from a distance, because it is what the player is
   * given: "hold the brake down until it slows" is an instruction with a
   * visible end condition, and a plan that guessed at the end condition would
   * not be testing the thing the player is told.
   */
  throttle: ThrottleCue | null;
}

/**
 * What the driver wants right now.
 *
 * `ease` is the whole reason this differs from Level 8's harness. ↓/S is both
 * the brake and the tap that lowers the speed setting, so a driver bringing the
 * speed down gently presses it for a frame at a time and lets the car drift,
 * while a driver slamming it holds the key. A plan says which it is doing, and
 * the blowout is graded on the difference.
 */
type Plan = (view: RoadView) => {
  lane?: LaneIndex;
  hold?: boolean;
  speed: number;
  /** Shed speed in taps rather than by leaning on the pedal. */
  ease?: boolean;
  /** Hold the wheel right, past the curb lane and off the road into the bay. */
  intoBay?: boolean;
  horn?: boolean;
  /** Which answer to give if a frozen prompt opens on this stretch. */
  answer?: string;
};

/** How many frames a tap holds the key down for. A firm human press. */
const TAP_FRAMES = 6;
/** And how long it is off between taps, so each is a separate press. */
const TAP_GAP = 10;

interface DriveResult {
  decisions: Array<{ id: string; action: string; correct: boolean; points: number }>;
  crashed: boolean;
  finished: boolean;
  /** Standing infractions charged over the run — crawling, wrong side. */
  penalties: number;
  /** Each scenario held for reading, in the order it was held. */
  briefings: string[];
  /** Each frozen prompt that opened, in the order it opened. */
  frozen: string[];
  /** Points from graded decisions, before standing penalties. */
  score: number;
  /** What the run is actually worth: decisions less the penalties charged. */
  total: number;
}

/**
 * Drives the road under a plan until it ends or the car is wrecked.
 *
 * The clock is the frame counter, so the correction hold after a mistake and
 * every other timed branch land on the same frame every run.
 */
const drive = (plan: Plan, frames = 40_000): DriveResult => {
  const realPerformanceNow = performance.now;
  const realDateNow = Date.now;
  const realRandom = Math.random;
  let clock = 1_760_000_000_000;
  performance.now = () => clock;
  Date.now = () => clock;
  Math.random = () => 0.5;

  const result: DriveResult = {
    decisions: [],
    crashed: false,
    finished: false,
    penalties: 0,
    briefings: [],
    frozen: [],
    score: 0,
    total: 0,
  };

  try {
    const fsm = new DrivingFSM();
    const session = createDrivingSession({ level: level9, fsm, signCoverage: {} });
    let previous: InputState = NO_INPUT;
    let stoppedHere = false;
    let lastEvent: string | null = null;

    // The verdict edges the host fires once it has scored a decision. Without
    // them the machine never leaves the state the event was graded in, and no
    // later event can open an approach. Mirrors `useScenarioEvaluation`.
    const settleFsm = (correct: boolean) => {
      fsm.transition(correct ? 'answer_correct' : 'answer_incorrect');
      fsm.transition('feedback_displayed');
      if (!correct) fsm.transition('recovery_complete');
      fsm.transition('road_clear');
    };

    for (let frame = 0; frame < frames; frame++) {
      clock = 1_760_000_000_000 + frame * (1000 / 60);

      // Every scenario answered with the car freezes once to be read. A driver
      // releases it and drives the approach; so does this.
      const held = session.getSnapshot().briefingEvent;
      if (held) {
        result.briefings.push(held.id);
        session.dismissBriefing();
      }

      const snapshot = session.getSnapshot();
      const scene = session.getFrame()?.scene;
      const car = scene?.car;
      const active = snapshot.activeEvent?.id ?? null;
      if (active !== lastEvent) {
        stoppedHere = false;
        lastEvent = active;
      }
      if (snapshot.speed <= 0.5) stoppedHere = true;

      const view: RoadView = {
        distance: car?.distance ?? 0,
        speed: snapshot.speed,
        lane: (car ? snapshot.lane : INNER) as LaneIndex,
        x: car?.x ?? 0,
        stopped: stoppedHere,
        throttle: snapshot.throttleCue,
      };

      const want = plan(view);

      // The one prompt in the level that stops the world and asks. Answered the
      // way the panel commits it: the emergency plays out, then the action is
      // handed back to the session.
      const frozenEvent = session.getSnapshot().cutsceneEvent;
      if (frozenEvent) {
        result.frozen.push(frozenEvent.id);
        const queue: GameEvent[] = [
          ...session.answerCutscene(want.answer ?? frozenEvent.correctAction),
        ];
        while (queue.length > 0) {
          const event = queue.shift()!;
          if (event.kind === 'decision') {
            const { isCorrect, points } = evaluateWeightedRule(event.event, event.action, 0);
            result.decisions.push({
              id: event.event.id,
              action: event.action,
              correct: isCorrect,
              points,
            });
            result.score += points;
            result.total += points;
            settleFsm(isCorrect);
            queue.push(...session.settleDecision({ isCorrect, weakCompetency: null }));
          }
        }
        continue;
      }

      // Steered at the middle of the lane, which is where a driver sits — or,
      // for the bay, held right until the road runs out, because the whole
      // point of a bay is that it is past the edge of the carriageway.
      const target =
        want.intoBay || want.hold || want.lane === undefined
          ? null
          : laneCentreX(want.lane, roadXAt(view.distance, scene?.curves ?? []));
      const steer = want.intoBay
        ? { left: false, right: true }
        : target === null
          ? { left: false, right: false }
          : { left: view.x > target + LANE_TOLERANCE, right: view.x < target - LANE_TOLERANCE };

      // Easing off is a rhythm of separate presses; slamming is one long one.
      const tooFast = snapshot.speed > want.speed + 0.5;
      const braking = want.ease
        ? tooFast && frame % (TAP_FRAMES + TAP_GAP) < TAP_FRAMES
        : tooFast;

      const input: InputState = {
        ...NO_INPUT,
        throttle: snapshot.targetSpeed < want.speed - 1 && !previous.throttle,
        brake: braking,
        ...steer,
        horn: Boolean(want.horn),
      };
      previous = input;

      const queue: GameEvent[] = [...session.update(input)];
      while (queue.length > 0) {
        const event = queue.shift()!;
        if (event.kind === 'crashed') result.crashed = true;
        if (event.kind === 'finished') result.finished = true;
        if (event.kind === 'penalty') {
          result.penalties += 1;
          result.total += evaluateWeightedRule(event.event, event.action, 0).points;
        }
        if (event.kind === 'decision') {
          const { isCorrect, points } = evaluateWeightedRule(event.event, event.action, 0);
          result.decisions.push({ id: event.event.id, action: event.action, correct: isCorrect, points });
          result.score += points;
          result.total += points;
          settleFsm(isCorrect);
          queue.push(...session.settleDecision({ isCorrect, weakCompetency: null }));
        }
      }

      if (result.crashed || result.finished) break;
    }
    // The running total never goes below zero, exactly as the drive scores it.
    result.total = Math.max(0, result.total);
    return result;
  } finally {
    performance.now = realPerformanceNow;
    Date.now = realDateNow;
    Math.random = realRandom;
  }
};

const verdict = (result: DriveResult, id: string) =>
  result.decisions.find(decision => decision.id === id);

/**
 * The drive this level is written for.
 *
 * Six answers: arrive slow in the rain, arrive slow at the water, brake a car
 * whose throttle will not close, ease a blown tire down and stop off the road,
 * answer the brake failure, and stop short of the crash.
 */
const goodDriver: Plan = ({ distance, stopped, throttle }) => {
  // 1. The rain: the speed is off well before the worst of it.
  if (distance < 500) return { lane: INNER, speed: 52 };
  if (distance < 1020) return { lane: INNER, speed: 22 };
  // 2. The flooded dip: off the accelerator before the edge, not in the water.
  if (distance < 1350) return { lane: INNER, speed: 52 };
  if (distance < 1900) return { lane: INNER, speed: 20, ease: true };
  // 3. The stuck throttle: the brake is held down until the readout says the
  //    car is back under control, then the drive carries on. Exactly what the
  //    panel and the live metric tell the player to do, and nothing else works
  //    — the engine is driving the wheels until it is brought to a crawl.
  if (distance < 2200) return { lane: INNER, speed: 52 };
  if (distance < 2760) {
    return { lane: INNER, speed: throttle && throttle.phase !== 'freed' ? 0 : 44 };
  }
  // 4. The blowout: tapped down rather than stood on, across to the curb lane
  //    in good time, then off the road into the bay and stopped there. The bay
  //    only opens within 90 units of the sign, so the car has to still be
  //    rolling when it gets there.
  if (distance < 3060) return { lane: INNER, speed: 52 };
  if (distance < 3415) return { lane: CURB, speed: 20, ease: true };
  if (distance < 3620) return { intoBay: true, speed: stopped ? 30 : 0 };
  // 5. The descent: answered in the prompt.
  if (distance < 4500) return { lane: CURB, speed: 34, answer: 'stop' };
  // 6. The crash: a full stop, short of it.
  if (distance < 5100) return { lane: CURB, speed: 34 };
  if (distance < 5500) return { lane: CURB, speed: stopped ? 20 : 0 };
  return { lane: CURB, speed: 34 };
};

/** The good line, overridden over one stretch of road. */
const insteadBetween = (from: number, to: number, instead: Plan): Plan =>
  view => (view.distance > from && view.distance < to ? instead(view) : goodDriver(view));

describe('driving Level 9 as it is meant to be driven', () => {
  const result = drive(goodDriver);

  it('reaches the end of the road without an impact', () => {
    expect(result.crashed).toBe(false);
    expect(result.finished).toBe(true);
  });

  it('is held by exactly one frozen prompt, the brake failure', () => {
    // Every other point on this route is answered with the car. The one that
    // cannot be is the one whose correct sequence has no key.
    expect([...new Set(result.frozen)]).toEqual(['level9.brakes-gone']);
  });

  it('passes every scenario on the route', () => {
    expect(result.decisions.filter(decision => !decision.correct)).toEqual([]);
    expect(result.decisions.map(decision => decision.id).sort()).toEqual(
      level9.events.map(event => event.id).sort()
    );
  });

  it('holds each driven scenario to be read exactly once, before it grades it', () => {
    expect(new Set(result.briefings).size).toBe(result.briefings.length);
    for (const decision of result.decisions) {
      // The frozen one carries its own question and is never briefed twice.
      if (decision.id === 'level9.brakes-gone') continue;
      expect(
        result.briefings.indexOf(decision.id),
        `${decision.id} was graded without being read`
      ).toBeGreaterThanOrEqual(0);
    }
  });

  it('scores a pass, and a clean run scores the whole route', () => {
    expect(result.total).toBeGreaterThanOrEqual(level9.requiredScore);
    expect(result.score).toBe(level9.events.reduce((sum, event) => sum + event.points, 0));
  });
});

describe('each Level 9 scenario can be failed by not doing what it asks', () => {
  it('fails the rain for a driver who keeps their speed', () => {
    const result = drive(insteadBetween(400, 1000, () => ({ lane: INNER, speed: 58 })));
    expect(verdict(result, 'level9.rain-closes-in')?.correct).toBe(false);
  });

  it('fails the flooded dip for a driver who carries speed into the water', () => {
    const result = drive(insteadBetween(1200, 1900, () => ({ lane: INNER, speed: 58 })));
    expect(verdict(result, 'level9.flooded-dip')?.correct).toBe(false);
  });

  it('fails the stuck throttle for a driver who never touches the brake', () => {
    // And the jeepney is solid, so this is a failure the road agrees with.
    const result = drive(insteadBetween(2100, 2700, () => ({ lane: INNER, speed: 96 })));
    const graded = verdict(result, 'level9.throttle-sticks-open');
    expect(graded === undefined || graded.correct === false).toBe(true);
  });

  it('fails the blowout for a driver who stops on the carriageway', () => {
    // Eased down correctly, but never off the lane: a stopped car in a live
    // lane is the failure the whole breakdown procedure is about.
    const result = drive(
      insteadBetween(3060, 3620, ({ distance, stopped }) =>
        distance < 3415
          ? { lane: CURB, speed: 20, ease: true }
          : { lane: CURB, speed: stopped ? 30 : 0, ease: true }
      )
    );
    expect(verdict(result, 'level9.tire-blowout')?.correct).toBe(false);
  });

  it('fails the blowout for a driver who stands on the brake at speed', () => {
    // Same bay, same stop — and still a failure, because the pedal was held
    // down while the car was still unstable. This is the one scenario in the
    // game graded on how a control was used rather than on where the car ended
    // up, so it is the one that has to be proved both ways.
    const result = drive(
      insteadBetween(3060, 3620, ({ distance, stopped }) =>
        distance < 3415
          ? { lane: CURB, speed: 20, ease: false }
          : { intoBay: true, speed: stopped ? 30 : 0 }
      )
    );
    const graded = verdict(result, 'level9.tire-blowout');
    expect(graded?.correct).toBe(false);
    expect(graded?.action).toBe('braked_hard');
  });

  it('fails the brake failure for the answer that rides it out', () => {
    const result = drive(
      insteadBetween(3600, 4500, () => ({ lane: CURB, speed: 34, answer: 'accelerate' }))
    );
    expect(verdict(result, 'level9.brakes-gone')?.correct).toBe(false);
  });

  it('fails the crash for a driver who does not stop', () => {
    const result = drive(insteadBetween(4800, 5600, () => ({ lane: CURB, speed: 34 })));
    const graded = verdict(result, 'level9.crash-at-the-bottom');
    expect(graded === undefined || graded.correct === false).toBe(true);
  });
});

/**
 * No single habit passes this level.
 *
 * Every one of these is a real way somebody tries to beat a driving level, and
 * each is driven rather than argued about. The pass mark is 69% of a total that
 * includes the crash scene's eighty points, so a road-only strategy has to
 * clear 186 on 190 available — which none of them comes near.
 */
describe('no simplistic strategy passes Level 9', () => {
  it('accelerating at everything ends in an impact', () => {
    const result = drive(() => ({ lane: INNER, speed: 96, answer: 'accelerate' }));
    expect(result.crashed).toBe(true);
  });

  it('standing on the brake at everything loses the blowout', () => {
    // Brake-at-everything takes the rain, the water and the throttle honestly.
    // It loses the blowout twice over: the pedal is held down while the car is
    // still unstable, and a driver who never steers never reaches the bay.
    const result = drive(view => ({ ...goodDriver(view), ease: false, intoBay: false, lane: INNER }));
    expect(verdict(result, 'level9.tire-blowout')?.correct).toBe(false);
  });

  it('never leaving the starting lane loses the blowout', () => {
    // The bay is off the carriageway on the right. A driver who never steers
    // can ease the tire down perfectly and still leave the car in the lane.
    const result = drive(view => ({ ...goodDriver(view), lane: INNER, intoBay: false }));
    expect(verdict(result, 'level9.tire-blowout')?.correct).toBe(false);
  });

  it('never touching the brake loses the throttle and the crash', () => {
    const result = drive(view => ({ ...goodDriver(view), speed: 96 }));
    const throttle = verdict(result, 'level9.throttle-sticks-open');
    const crash = verdict(result, 'level9.crash-at-the-bottom');
    expect(throttle === undefined || throttle.correct === false).toBe(true);
    expect(crash === undefined || crash.correct === false).toBe(true);
  });
});
