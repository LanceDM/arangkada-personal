/**
 * Level 10, actually driven.
 *
 * `level10.test.ts` checks the content; this one runs the real session over the
 * real road with a real keyboard and asks the two questions that settle it: can
 * each scenario be passed by doing the thing it asks for, and is it failed by
 * not doing it?
 *
 * The strategy sweep at the bottom is the other half. This module is mostly
 * about compliance rather than manoeuvring, which is exactly the shape of level
 * a single habit can beat — answer everything with the brake, or press 1 at
 * every question — so each of those is driven here rather than reasoned about,
 * and each has to miss the pass mark by a margin.
 */
import { describe, expect, it } from 'vitest';
import { DrivingFSM } from '@/features/driving-sim/domain/fsm/DrivingFSM';
import { LEVELS } from '@/features/driving-sim/domain/scenario/levelCatalog';
import { evaluateWeightedRule } from '@/features/driving-sim/domain/evaluation/ruleEngine';
import { createDrivingSession, NO_INPUT, type InputState } from './DrivingSession';
import type { GameEvent } from '@/features/driving-sim/domain/world/GameEvent';
import { laneCentreX, roadXAt, type LaneIndex } from '@/features/driving-sim/domain/world/vehiclePhysics';

const level10 = LEVELS.find(level => level.id === 10)!;

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
}

/** What the driver wants right now. */
type Plan = (view: RoadView) => {
  lane?: LaneIndex;
  speed: number;
  /** Hold the wheel right, past the curb lane and off the road into the bay. */
  intoBay?: boolean;
  horn?: boolean;
  /** Which answer to give if a frozen prompt or a checkpoint window opens. */
  answer?: string;
};

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
  /** Each checkpoint document that opened. */
  inspections: string[];
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
    inspections: [],
    score: 0,
    total: 0,
  };

  try {
    const fsm = new DrivingFSM();
    const session = createDrivingSession({ level: level10, fsm, signCoverage: {} });
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

    /** Scores whatever a frozen panel or a frame reported, and settles it. */
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
      };

      const want = plan(view);

      // The one prompt in the level that stops the world and asks.
      const frozenEvent = session.getSnapshot().cutsceneEvent;
      if (frozenEvent) {
        result.frozen.push(frozenEvent.id);
        take(session.answerCutscene(want.answer ?? frozenEvent.correctAction));
        continue;
      }

      // And the checkpoint, which opens only once the car is already at rest.
      const document = session.getSnapshot().inspectionEvent;
      if (document) {
        result.inspections.push(document.id);
        take(session.answerInspection(want.answer ?? document.correctAction));
        continue;
      }

      // Steered at the middle of the lane, which is where a driver sits — or,
      // for the bay, held right until the road runs out, because the whole
      // point of a bay is that it is past the edge of the carriageway.
      const target =
        want.intoBay || want.lane === undefined
          ? null
          : laneCentreX(want.lane, roadXAt(view.distance, scene?.curves ?? []));
      const steer = want.intoBay
        ? { left: false, right: true }
        : target === null
          ? { left: false, right: false }
          : { left: view.x > target + LANE_TOLERANCE, right: view.x < target - LANE_TOLERANCE };

      const input: InputState = {
        ...NO_INPUT,
        throttle: snapshot.targetSpeed < want.speed - 1 && !previous.throttle,
        brake: snapshot.speed > want.speed + 0.5,
        ...steer,
        horn: Boolean(want.horn),
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

const verdict = (result: DriveResult, id: string) =>
  result.decisions.find(decision => decision.id === id);

/**
 * The drive this level is written for.
 *
 * Seven answers: leave the phone alone, stop in the turnout, keep three seconds
 * behind the jeepney, stop at the checkpoint and take the tests, stay on your
 * own side of the truck, hold the posted forty down the grade, and stop short
 * of the rider.
 */
const goodDriver: Plan = ({ distance, stopped }) => {
  // 1. The phone: frozen at 900, and the answer is to carry on.
  if (distance < 1100) return { lane: INNER, speed: 52, answer: 'accelerate' };
  // 2. The turnout: across to the curb lane in good time, then off the road and
  //    stopped in the bay. The bay only opens within BAY_SPAN of its own point,
  //    so the car has to still be rolling when it gets there.
  if (distance < 1480) return { lane: CURB, speed: 46 };
  if (distance < 1720) return { lane: CURB, speed: 18 };
  if (distance < 1920) return { intoBay: true, speed: stopped ? 34 : 0 };
  // 3. The smoke: well back off the jeepney, which is running at two thirds of
  //    the limit and slowing further on the run-in. It joins the road in the
  //    lane the car is in, which out of the turnout is the curb lane.
  if (distance < 2160) return { lane: CURB, speed: 46 };
  if (distance < 2760) return { lane: CURB, speed: 20 };
  // 4. The checkpoint: a full stop at the line, then out for the tests.
  if (distance < 3100) return { lane: INNER, speed: 46 };
  if (distance < 3560) return { lane: INNER, speed: stopped ? 40 : 0, answer: 'stop' };
  // 5. The truck: back off and stay on your own side of the line. The curb lane
  //    is still your own side, and it keeps the car off the truck's tailgate.
  if (distance < 3920) return { lane: CURB, speed: 46 };
  if (distance < 4480) return { lane: CURB, speed: 24 };
  // 6. The grade: hold the posted forty while the bus runs away from you.
  if (distance < 4880) return { lane: CURB, speed: 46 };
  if (distance < 5380) return { lane: CURB, speed: 30 };
  // 7. The rider: stopped short of the bike, in the lane beside it.
  if (distance < 5720) return { lane: INNER, speed: 46 };
  if (distance < 6280) return { lane: INNER, speed: stopped ? 40 : 0 };
  return { lane: INNER, speed: 46 };
};

/** The good line, overridden over one stretch of road. */
const insteadBetween = (from: number, to: number, instead: Plan): Plan =>
  view => (view.distance > from && view.distance < to ? instead(view) : goodDriver(view));

describe('driving Level 10 as it is meant to be driven', () => {
  const result = drive(goodDriver);

  it('reaches the end of the road without an impact', () => {
    expect(result.crashed).toBe(false);
    expect(result.finished).toBe(true);
  });

  it('is held by exactly one frozen prompt, the ringing phone', () => {
    // Every other point on this route is answered with the car. The one that
    // cannot be is the one whose correct answer is that nothing happens.
    expect([...new Set(result.frozen)]).toEqual(['level10.the-phone-rings']);
  });

  it('opens the checkpoint document only after the car has stopped', () => {
    expect([...new Set(result.inspections)]).toEqual(['level10.the-checkpoint']);
  });

  it('passes every scenario on the route', () => {
    expect(result.decisions.filter(decision => !decision.correct)).toEqual([]);
    expect(result.decisions.map(decision => decision.id).sort()).toEqual(
      level10.events.map(event => event.id).sort()
    );
  });

  it('holds each driven scenario to be read exactly once, before it grades it', () => {
    expect(new Set(result.briefings).size).toBe(result.briefings.length);
    for (const decision of result.decisions) {
      // The frozen prompt and the checkpoint carry their own question and are
      // never briefed.
      if (decision.id === 'level10.the-phone-rings') continue;
      if (decision.id === 'level10.the-checkpoint') continue;
      expect(
        result.briefings.indexOf(decision.id),
        `${decision.id} was graded without being read`
      ).toBeGreaterThanOrEqual(0);
    }
  });

  it('grades the seven scenarios in route order', () => {
    expect(result.decisions.map(decision => decision.id)).toEqual(
      level10.events.map(event => event.id)
    );
  });

  it('scores a pass, and a clean run scores the whole road', () => {
    const road = level10.events.reduce((sum, event) => sum + event.points, 0);
    expect(result.score).toBe(road);
    // The driveway is worth 60 more, which this harness never plays; a clean
    // road alone still has to clear the mark.
    expect(result.total).toBeGreaterThanOrEqual(level10.requiredScore - 60);
  });
});

describe('each Level 10 scenario can be failed by not doing what it asks', () => {
  it('fails the phone for a driver who answers it', () => {
    const result = drive(
      insteadBetween(0, 1100, () => ({ lane: INNER, speed: 52, answer: 'brake' }))
    );
    expect(verdict(result, 'level10.the-phone-rings')?.correct).toBe(false);
  });

  it('fails the phone for a driver who waits for the red light', () => {
    const result = drive(
      insteadBetween(0, 1100, () => ({ lane: INNER, speed: 52, answer: 'stop' }))
    );
    expect(verdict(result, 'level10.the-phone-rings')?.correct).toBe(false);
  });

  it('fails the turnout for a driver who stops in the lane instead', () => {
    // Slowed correctly and stopped — but on the carriageway, which is the
    // failure the whole scenario is about.
    const result = drive(
      insteadBetween(1480, 1920, ({ stopped }) => ({ lane: CURB, speed: stopped ? 34 : 0 }))
    );
    expect(verdict(result, 'level10.out-of-her-seat')?.correct).toBe(false);
  });

  it('fails the turnout for a driver who never leaves the travel lane', () => {
    const result = drive(insteadBetween(1480, 1920, () => ({ lane: INNER, speed: 46 })));
    expect(verdict(result, 'level10.out-of-her-seat')?.correct).toBe(false);
  });

  it('fails the smoke for a driver who closes up on the jeepney', () => {
    const result = drive(insteadBetween(2160, 2760, () => ({ lane: CURB, speed: 58 })));
    const graded = verdict(result, 'level10.smoke-in-the-lane');
    // Either the gap was not kept, or the jeepney was driven into — both are
    // the same mistake, and the road agrees with the grader about it.
    expect(graded === undefined || graded.correct === false).toBe(true);
  });

  it('fails the checkpoint for a driver who refuses the tests', () => {
    const result = drive(
      insteadBetween(3100, 3560, ({ stopped }) => ({
        lane: INNER,
        speed: stopped ? 40 : 0,
        answer: 'accelerate',
      }))
    );
    expect(verdict(result, 'level10.the-checkpoint')?.correct).toBe(false);
  });

  it('fails the checkpoint for a driver who never stops at it', () => {
    const result = drive(insteadBetween(3100, 3560, () => ({ lane: INNER, speed: 52 })));
    const graded = verdict(result, 'level10.the-checkpoint');
    expect(graded?.correct).toBe(false);
    // And the document never opened, so nothing was decided at the window.
    expect(result.inspections).toEqual([]);
  });

  it('fails the truck for a driver who crosses the line to pass it', () => {
    const result = drive(
      insteadBetween(3920, 4480, () => ({ lane: 1 as LaneIndex, speed: 52 }))
    );
    const graded = verdict(result, 'level10.losing-its-load');
    expect(graded?.correct).toBe(false);
    expect(graded?.action).toBe('wrong_lane');
  });

  it('fails the grade for a driver who keeps up with the bus', () => {
    const result = drive(insteadBetween(4880, 5380, () => ({ lane: CURB, speed: 58 })));
    expect(verdict(result, 'level10.bus-on-the-grade')?.correct).toBe(false);
  });

  it('fails the rider for a driver who does not stop', () => {
    const result = drive(insteadBetween(5720, 6280, () => ({ lane: INNER, speed: 46 })));
    const graded = verdict(result, 'level10.rider-down');
    expect(graded === undefined || graded.correct === false).toBe(true);
  });
});

/**
 * No single habit passes this level.
 *
 * Every one of these is a real way somebody tries to beat a driving level, and
 * each is driven rather than argued about. The pass mark is 148 of a total that
 * includes the driveway's sixty points, so a road-only strategy has to clear 88
 * on the road's 155 — which is deliberately not a high bar, and none of these
 * clears it anyway.
 */
describe('no simplistic strategy passes Level 10', () => {
  /** The road alone, with the driveway's sixty points assumed perfect. */
  const roadMarkNeeded = level10.requiredScore - 60;

  it('accelerating at everything ends in an impact or well short', () => {
    const result = drive(() => ({ lane: INNER, speed: 96, answer: 'accelerate' }));
    expect(result.crashed || result.total < roadMarkNeeded).toBe(true);
  });

  it('braking at everything loses the phone and the turnout, and is charged for crawling', () => {
    // Brake-at-everything takes the smoke, the truck and the grade honestly. It
    // loses the phone — whose correct answer is to carry on — and never leaves
    // the lane it started in, so the turnout goes too. The crawl between
    // scenarios is charged on top.
    const result = drive(() => ({ lane: INNER, speed: 8, answer: 'brake' }));
    expect(verdict(result, 'level10.the-phone-rings')?.correct).toBe(false);
    expect(verdict(result, 'level10.out-of-her-seat')?.correct).toBe(false);
    expect(result.penalties).toBeGreaterThan(0);
    expect(result.total).toBeLessThan(roadMarkNeeded);
  });

  it('stopping at everything never gets to the end of the road', () => {
    // A driver who answers every question with the brake pedal held down does
    // not drive the route at all, so there is nothing to score.
    const result = drive(() => ({ lane: INNER, speed: 0, answer: 'stop' }), 12_000);
    expect(result.finished).toBe(false);
    expect(result.total).toBeLessThan(roadMarkNeeded);
  });

  it('never slowing down loses every scenario that measures speed or a gap', () => {
    const result = drive(
      view =>
        view.distance > 1480 && view.distance < 1920
          ? { intoBay: true, speed: view.stopped ? 34 : 0 }
          : // Out of the turnout in the curb lane, where the jeepney joins.
            { lane: view.distance > 1920 && view.distance < 2760 ? CURB : INNER, speed: 58, answer: 'accelerate' }
    );
    const missed = ['level10.smoke-in-the-lane', 'level10.bus-on-the-grade'].filter(id => {
      const graded = verdict(result, id);
      return graded === undefined || graded.correct === false;
    });
    expect(missed).toHaveLength(2);
  });
});
