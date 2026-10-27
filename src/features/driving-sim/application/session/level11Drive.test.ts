/**
 * Level 11, actually driven.
 *
 * `level11.test.ts` checks the content; this one runs the real session over the
 * real road and asks the two questions that settle it: can each scenario be
 * passed by giving the space it asks for, and is it failed by not giving it?
 *
 * The strategy sweep at the bottom is the other half. Every move this module
 * gives a car driver is a give-space move, which is the shape of level a single
 * habit could beat, so each habit is driven rather than reasoned about.
 */
import { describe, expect, it } from 'vitest';
import { DrivingFSM } from '@/features/driving-sim/domain/fsm/DrivingFSM';
import { LEVELS } from '@/features/driving-sim/domain/scenario/levelCatalog';
import { evaluateWeightedRule } from '@/features/driving-sim/domain/evaluation/ruleEngine';
import { createDrivingSession, NO_INPUT, type InputState } from './DrivingSession';
import type { GameEvent } from '@/features/driving-sim/domain/world/GameEvent';
import { laneCentreX, roadXAt, type LaneIndex } from '@/features/driving-sim/domain/world/vehiclePhysics';

const level11 = LEVELS.find(level => level.id === 11)!;

/** How near the middle of a lane counts as being settled in it, in pixels. */
const LANE_TOLERANCE = 4;

/** The lane against the center line, which is where the drive starts. */
const INNER = 2 as LaneIndex;
/** The lane against the curb: the motorcycle and bicycle lanes. */
const CURB = 3 as LaneIndex;

/** What the driver can see, as a driver sees it. */
interface RoadView {
  distance: number;
  speed: number;
  lane: LaneIndex;
  /** True once the car has come to rest at least once in this scenario. */
  stopped: boolean;
}

/** What the driver wants right now. */
type Plan = (view: RoadView) => { lane?: LaneIndex; speed: number };

interface DriveResult {
  decisions: Array<{ id: string; action: string; correct: boolean; points: number }>;
  crashed: boolean;
  finished: boolean;
  /** Standing infractions charged over the run — crawling, wrong side. */
  penalties: number;
  /** Each scenario held for reading, in the order it was held. */
  briefings: string[];
  /** Points from graded decisions, before standing penalties. */
  score: number;
  /** What the run is actually worth: decisions less the penalties charged. */
  total: number;
}

/**
 * Drives the road under a plan until it ends or the car is wrecked.
 *
 * The clock is the frame counter, so every timed branch lands on the same frame
 * every run.
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
    score: 0,
    total: 0,
  };

  try {
    const fsm = new DrivingFSM();
    const session = createDrivingSession({ level: level11, fsm, signCoverage: {} });
    let previous: InputState = NO_INPUT;
    let stoppedHere = false;
    let lastEvent: string | null = null;

    // The verdict edges the host fires once it has scored a decision. Mirrors
    // `useScenarioEvaluation`.
    const settleFsm = (correct: boolean) => {
      fsm.transition(correct ? 'answer_correct' : 'answer_incorrect');
      fsm.transition('feedback_displayed');
      if (!correct) fsm.transition('recovery_complete');
      fsm.transition('road_clear');
    };

    const take = (reported: readonly GameEvent[]) => {
      const queue: GameEvent[] = [...reported];
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

      const distance = car?.distance ?? 0;
      const want = plan({
        distance,
        speed: snapshot.speed,
        lane: (car ? snapshot.lane : INNER) as LaneIndex,
        stopped: stoppedHere,
      });

      const target = want.lane === undefined ? null : laneCentreX(want.lane, roadXAt(distance, scene?.curves ?? []));
      const x = car?.x ?? 0;
      const input: InputState = {
        ...NO_INPUT,
        throttle: snapshot.targetSpeed < want.speed - 1 && !previous.throttle,
        brake: snapshot.speed > want.speed + 0.5,
        left: target !== null && x > target + LANE_TOLERANCE,
        right: target !== null && x < target - LANE_TOLERANCE,
      };
      previous = input;

      take(session.update(input));

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

const verdict = (result: DriveResult, id: string) => result.decisions.find(decision => decision.id === id);

/** Failed, or ended in the thing the scenario was about: both are the same mistake. */
const failed = (result: DriveResult, id: string) => {
  const graded = verdict(result, id);
  return graded === undefined || graded.correct === false;
};

/**
 * The drive this level is written for.
 *
 * Ten answers: hold the line past the riders, keep back from four motorcycles
 * and a jeepney, pass the cyclist from your own lane and slowly, ease off past
 * the jeepney stop, and stop short of the yellow box and of the crossing.
 */
const goodDriver: Plan = ({ distance, stopped }) => {
  // 1. The riders in the motorcycle lane: a steady line in the inner lane.
  if (distance < 1000) return { lane: INNER, speed: 48 };
  // 2. The rider with no helmet: well back as the rider eases off.
  if (distance < 1640) return { lane: INNER, speed: 26 };
  if (distance < 1780) return { lane: INNER, speed: 44 };
  // 3. The cyclist: own lane, slowed where the cyclist is.
  if (distance < 2300) return { lane: INNER, speed: 28 };
  if (distance < 2420) return { lane: INNER, speed: 44 };
  // 4. The delivery rider pulling up.
  if (distance < 3040) return { lane: INNER, speed: 20 };
  if (distance < 3120) return { lane: INNER, speed: 44 };
  // 5. The child aboard.
  if (distance < 3740) return { lane: INNER, speed: 22 };
  if (distance < 3880) return { lane: INNER, speed: 44 };
  // 6. The jeepney stop: slowed past it, in the lane beside it.
  if (distance < 4400) return { lane: INNER, speed: 28 };
  // 7. The yellow box: a full stop short of it, then on once it has cleared.
  if (distance < 4880) return { lane: INNER, speed: 44 };
  if (distance < 5120) return { lane: INNER, speed: stopped ? 36 : 0 };
  // 8. The crossing: a full stop, then on once she has crossed.
  if (distance < 5580) return { lane: INNER, speed: 44 };
  if (distance < 5820) return { lane: INNER, speed: stopped ? 36 : 0 };
  // 9. The overloaded jeepney.
  if (distance < 5980) return { lane: INNER, speed: 44 };
  if (distance < 6540) return { lane: INNER, speed: 20 };
  // 10. The flashing tail lamp.
  if (distance < 6680) return { lane: INNER, speed: 44 };
  if (distance < 7240) return { lane: INNER, speed: 20 };
  return { lane: INNER, speed: 44 };
};

/** The good line, overridden over one stretch of road. */
const insteadBetween = (from: number, to: number, instead: Plan): Plan => view =>
  view.distance > from && view.distance < to ? instead(view) : goodDriver(view);

describe('driving Level 11 as it is meant to be driven', () => {
  const result = drive(goodDriver);

  it('reaches the end of the road without an impact', () => {
    expect(result.crashed).toBe(false);
    expect(result.finished).toBe(true);
  });

  it('passes every scenario on the route, in route order', () => {
    expect(result.decisions.filter(decision => !decision.correct)).toEqual([]);
    expect(result.decisions.map(decision => decision.id)).toEqual(level11.events.map(event => event.id));
  });

  it('holds each scenario to be read exactly once, before it grades it', () => {
    expect(new Set(result.briefings).size).toBe(result.briefings.length);
    for (const decision of result.decisions) {
      expect(result.briefings.indexOf(decision.id), `${decision.id} was graded without being read`).toBeGreaterThanOrEqual(0);
    }
  });

  it('scores the whole road and clears the pass mark', () => {
    const road = level11.events.reduce((sum, event) => sum + event.points, 0);
    expect(result.score).toBe(road);
    expect(result.total).toBeGreaterThanOrEqual(level11.requiredScore);
  });
});

describe('each Level 11 scenario can be failed by not giving the space it asks for', () => {
  it('fails the riders for a driver who moves over toward them', () => {
    const result = drive(insteadBetween(560, 1000, () => ({ lane: CURB, speed: 48 })));
    expect(failed(result, 'level11.riders-in-their-lane')).toBe(true);
  });

  it('passes the riders for a driver who moves out of their lane, away from them', () => {
    // Only a move toward the riders squeezes them. A driver
    // who began in the motorcycle lane and leaves it, inward, gives them more
    // room, and was failed for it.
    const result = drive(
      insteadBetween(0, 1000, ({ distance }) => ({ lane: distance < 600 ? CURB : INNER, speed: 40 }))
    );
    expect(result.crashed).toBe(false);
    expect(verdict(result, 'level11.riders-in-their-lane')?.correct).toBe(true);
  });

  it('fails the rider with no helmet for a driver who keeps up', () => {
    const result = drive(insteadBetween(880, 1640, () => ({ lane: INNER, speed: 58 })));
    expect(failed(result, 'level11.no-helmet')).toBe(true);
  });

  it('fails the cyclist for a driver who comes past at speed', () => {
    const result = drive(insteadBetween(1780, 2300, () => ({ lane: INNER, speed: 56 })));
    expect(verdict(result, 'level11.cyclist-in-the-bike-lane')?.correct).toBe(false);
  });

  it('fails the cyclist for a driver in the bicycle lane, however slowly', () => {
    const result = drive(insteadBetween(1780, 2300, () => ({ lane: CURB, speed: 24 })));
    expect(failed(result, 'level11.cyclist-in-the-bike-lane')).toBe(true);
  });

  it('fails the delivery rider for a driver who keeps up', () => {
    const result = drive(insteadBetween(2280, 3040, () => ({ lane: INNER, speed: 58 })));
    expect(failed(result, 'level11.delivery-box')).toBe(true);
  });

  it('fails the child aboard for a driver who keeps up', () => {
    const result = drive(insteadBetween(2980, 3740, () => ({ lane: INNER, speed: 58 })));
    expect(failed(result, 'level11.child-aboard')).toBe(true);
  });

  it('fails the jeepney stop for a driver who goes past at speed', () => {
    const result = drive(insteadBetween(3880, 4400, () => ({ lane: INNER, speed: 56 })));
    expect(verdict(result, 'level11.jeepney-stop')?.correct).toBe(false);
  });

  it('fails the yellow box for a driver who slows but never stops', () => {
    const result = drive(insteadBetween(4400, 5120, () => ({ lane: INNER, speed: 10 })));
    expect(failed(result, 'level11.tricycle-in-the-box')).toBe(true);
  });

  it('fails the crossing for a driver who slows but never stops', () => {
    const result = drive(insteadBetween(5120, 5820, () => ({ lane: CURB, speed: 10 })));
    expect(failed(result, 'level11.crossing-at-the-stop')).toBe(true);
  });

  it('fails the overloaded jeepney for a driver who keeps up', () => {
    const result = drive(insteadBetween(5780, 6540, () => ({ lane: INNER, speed: 58 })));
    expect(failed(result, 'level11.overloaded-jeepney')).toBe(true);
  });

  it('fails the flashing tail lamp for a driver who keeps up', () => {
    const result = drive(insteadBetween(6480, 7240, () => ({ lane: INNER, speed: 58 })));
    expect(failed(result, 'level11.flashing-tail-lamp')).toBe(true);
  });
});

/**
 * A following gap is kept to a vehicle the car is behind, in its lane.
 * Measured along the road alone, a rider in the next lane read as 0
 * seconds once the car drew level with it, so passing one failed.
 */
describe('a following gap on Level 11 is the gap to the vehicle in your lane', () => {
  it('passes a driver who keeps two seconds back and then passes the rider in the curb lane', () => {
    const result = drive(
      insteadBetween(880, 1640, view => (view.distance < 1350 ? { lane: INNER, speed: 40 } : { lane: CURB, speed: 58 }))
    );
    expect(result.crashed).toBe(false);
    expect(verdict(result, 'level11.no-helmet')).toMatchObject({ correct: true, action: 'brake' });
  });

  it('passes a driver who was never behind the rider in its lane', () => {
    // Moves to the curb lane after the rider has joined in the inner one, and
    // before its zone opens.
    const result = drive(insteadBetween(1000, 1640, () => ({ lane: CURB, speed: 50 })));
    expect(result.crashed).toBe(false);
    expect(verdict(result, 'level11.no-helmet')).toMatchObject({ correct: true, action: 'brake' });
  });

  it('still fails a driver who closes up behind it and only then pulls out', () => {
    const result = drive(
      insteadBetween(880, 1640, view => (view.distance < 1400 ? { lane: INNER, speed: 58 } : { lane: CURB, speed: 58 }))
    );
    expect(verdict(result, 'level11.no-helmet')).toMatchObject({ correct: false, action: 'too_close' });
  });
});

/**
 * No single habit passes this level.
 *
 * Driven, not argued about. The one that does pass is written down too: a
 * driver who comes to a stop at every scenario and drives on between them has
 * done nothing the sources call wrong anywhere on this road.
 */
describe('no simplistic strategy passes Level 11', () => {
  it('braking at everything never stops for the box, and is charged for crawling', () => {
    // A crawl is not a stop. It is graded wrong at the yellow box, and then it
    // rolls on into the tricycle standing in it.
    const result = drive(() => ({ lane: INNER, speed: 8 }));
    expect(verdict(result, 'level11.tricycle-in-the-box')?.correct).toBe(false);
    expect(result.penalties).toBeGreaterThan(0);
    expect(result.crashed || result.total < level11.requiredScore).toBe(true);
    expect(result.total).toBeLessThan(level11.requiredScore);
  });

  it('keeping up with the traffic ends in an impact or well short', () => {
    const result = drive(() => ({ lane: INNER, speed: 58 }));
    expect(result.crashed || result.total < level11.requiredScore).toBe(true);
  });

  it('stopping and waiting never gets to the end of the road', () => {
    const result = drive(() => ({ lane: INNER, speed: 0 }), 12_000);
    expect(result.finished).toBe(false);
    expect(result.total).toBeLessThan(level11.requiredScore);
  });

  it('stopping at every scenario and driving on between them passes', () => {
    // The consequence of every sourced move being a give-space move.
    const scenario = level11.events.map(event => event.triggerAtDistance);
    const result = drive(({ distance, stopped }) => {
      const next = scenario.find(at => at > distance - 30);
      const near = next !== undefined && next - distance < 260;
      return { lane: INNER, speed: near && !stopped ? 0 : 36 };
    });
    expect(result.crashed).toBe(false);
    expect(result.total).toBeGreaterThanOrEqual(level11.requiredScore);
  });
});

