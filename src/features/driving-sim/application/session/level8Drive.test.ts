/**
 * Level 8, actually driven.
 *
 * `level8.test.ts` checks the content; this one runs the real session over the
 * real street with a real keyboard and asks the two questions that settle it:
 * can each scenario be passed by doing the thing it asks for, and is it failed
 * by not doing it?
 *
 * The strategy sweep at the bottom is the other half. A level whose every
 * correct answer is "slow down" can be beaten by never speeding up, and the
 * version this replaced could be: it had three following gaps, two stops and
 * one speed check, and a steady crawl cleared five of six. Every simplistic
 * habit is driven here rather than reasoned about, and each has to miss the
 * pass mark by a margin or end in an impact.
 */
import { describe, expect, it } from 'vitest';
import { DrivingFSM } from '@/features/driving-sim/domain/fsm/DrivingFSM';
import { LEVELS } from '@/features/driving-sim/domain/scenario/levelCatalog';
import { evaluateWeightedRule } from '@/features/driving-sim/domain/evaluation/ruleEngine';
import { createDrivingSession, NO_INPUT, type InputState } from './DrivingSession';
import type { GameEvent } from '@/features/driving-sim/domain/world/GameEvent';
import {
  laneCentreX,
  roadXAt,
  type LaneIndex,
} from '@/features/driving-sim/domain/world/vehiclePhysics';

const level8 = LEVELS.find(level => level.id === 8)!;

/**
 * How near the middle of a lane counts as being settled in it, in pixels.
 *
 * Wider than one frame of steering, so the wheel is not sawed back and forth
 * every frame, and far inside the 16 pixels the rider scenario allows.
 */
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

/**
 * What the driver wants right now.
 *
 * A lane rather than a position across the road, because that is what a player
 * steers by — and because the river bend moves the whole carriageway sideways,
 * so a fixed x would be a different lane at each end of it. `hold` is the one
 * scenario where the answer is to touch nothing: the wheel stays where it is.
 */
type Plan = (view: RoadView) => {
  lane?: LaneIndex;
  hold?: boolean;
  speed: number;
  horn?: boolean;
};

interface DriveResult {
  decisions: Array<{ id: string; action: string; correct: boolean; points: number }>;
  crashed: boolean;
  finished: boolean;
  /** Standing infractions charged over the run — crawling, wrong side. */
  penalties: number;
  /** Whether the drive was ever held behind something needing acknowledgement. */
  everPaused: boolean;
  /** Each scenario held for reading, in the order it was held. */
  briefings: string[];
  /** Points from graded decisions, before standing penalties. */
  score: number;
  /** What the run is actually worth: decisions less the penalties charged. */
  total: number;
}

/**
 * Drives the street under a plan until the road ends or the car is wrecked.
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
    everPaused: false,
    briefings: [],
    score: 0,
    total: 0,
  };

  try {
    const fsm = new DrivingFSM();
    const session = createDrivingSession({ level: level8, fsm, signCoverage: {} });
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
      };

      const want = plan(view);
      // Steered at the middle of the lane, which is where a driver sits. Held
      // until the lane number changes and no longer, the car comes to rest
      // hard against the line it has just crossed — close enough to the next
      // lane that every lateral judgement in the level is taken within a few
      // pixels of a boundary, and nothing measured that way means much.
      const target =
        want.hold || want.lane === undefined
          ? null
          : laneCentreX(want.lane, roadXAt(view.distance, scene?.curves ?? []));
      const steer =
        target === null
          ? { left: false, right: false }
          : { left: view.x > target + LANE_TOLERANCE, right: view.x < target - LANE_TOLERANCE };
      const input: InputState = {
        ...NO_INPUT,
        // Two controls, as a driver uses them: the throttle is a setting raised
        // in steps, the brake a pedal held until the speed is right.
        throttle: snapshot.targetSpeed < want.speed - 1 && !previous.throttle,
        brake: snapshot.speed > want.speed + 0.5,
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

      const after = session.getSnapshot();
      if (after.inspectionEvent || after.cutsceneEvent || after.adaptationNotice) {
        result.everPaused = true;
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
 * Six answers, six different actions: arrive slow at the gate, touch nothing
 * while the rider comes past, move to the curb lane for the bend, stop for the
 * jeepney, hold two seconds behind the truck, and stop for the van. A stop is
 * held only until the car is actually at rest, which is what a player does.
 */
const goodDriver: Plan = ({ distance, stopped }) => {
  // 1. The school gate: under 20 before the gate.
  if (distance < 660) return { lane: INNER, speed: 38 };
  if (distance < 1040) return { lane: INNER, speed: 17 };
  // 2. The rider: settled in a lane well before the window, then hands off.
  if (distance < 1260) return { lane: INNER, speed: 34 };
  if (distance < 1840) return { hold: true, speed: 30 };
  // 3. The bend: across to the curb lane in good time, and slow for it.
  if (distance < 2110) return { lane: CURB, speed: 32 };
  if (distance < 2650) return { lane: CURB, speed: 20 };
  // 4. The side street: a full stop, then away.
  if (distance < 2950) return { lane: CURB, speed: 30 };
  if (distance < 3450) return { lane: CURB, speed: stopped ? 14 : 0 };
  // 5. The truck: ease off and keep the gap.
  if (distance < 3750) return { lane: CURB, speed: 30 };
  if (distance < 4250) return { lane: CURB, speed: 16 };
  // 6. The van and the car behind: stop, and keep off the horn.
  if (distance < 4560) return { lane: CURB, speed: 30 };
  if (distance < 5060) return { lane: CURB, speed: stopped ? 12 : 0 };
  return { lane: CURB, speed: 34 };
};

/** The good line, overridden over one stretch of road. */
const insteadBetween = (from: number, to: number, instead: Plan): Plan =>
  view => (view.distance > from && view.distance < to ? instead(view) : goodDriver(view));

describe('driving Level 8 as it is meant to be driven', () => {
  const result = drive(goodDriver);

  it('reaches the end of the street without an impact', () => {
    expect(result.crashed).toBe(false);
    expect(result.finished).toBe(true);
  });

  it('is never held behind a frozen prompt', () => {
    // Every point on this route is answered with the car. The read panel each
    // scenario opens is dismissed like a player would; nothing else holds.
    expect(result.everPaused).toBe(false);
  });

  it('is never charged for crawling or for the wrong side of the road', () => {
    // A level whose answers are mostly "slow down" has to be passable without
    // driving at walking pace between the scenarios as well as inside them.
    expect(result.penalties).toBe(0);
  });

  it('passes every scenario on the route', () => {
    expect(result.decisions.filter(decision => !decision.correct)).toEqual([]);
    expect(result.decisions.map(decision => decision.id)).toEqual(
      level8.events.map(event => event.id)
    );
  });

  it('holds each scenario to be read exactly once, before it grades it', () => {
    expect(new Set(result.briefings).size).toBe(result.briefings.length);
    for (const decision of result.decisions) {
      expect(
        result.briefings.indexOf(decision.id),
        `${decision.id} was graded without being read`
      ).toBeGreaterThanOrEqual(0);
    }
  });

  it('scores a pass, and a clean run scores the whole route', () => {
    expect(result.total).toBeGreaterThanOrEqual(level8.requiredScore);
    expect(result.score).toBe(level8.events.reduce((sum, event) => sum + event.points, 0));
  });
});

describe('each Level 8 scenario can be failed by not doing what it asks', () => {
  it('fails the school gate for a driver who arrives at speed', () => {
    const result = drive(insteadBetween(540, 1040, () => ({ lane: INNER, speed: 40 })));
    const graded = verdict(result, 'level8.school-gate');
    expect(graded?.correct).toBe(false);
    expect(graded?.action).toBe('accelerate');
  });

  it('fails the line hold for a driver who moves over onto the rider', () => {
    // Steering across while somebody is riding the line between the lanes. The
    // lane is not what is graded here — the wander is.
    // From inside the window, not before it: the line being held is the one
    // the car was on when the rider appeared, so a lane change already
    // finished by then is a driver who is simply in the other lane.
    const result = drive(insteadBetween(1440, 1840, () => ({ lane: CURB, speed: 30 })));
    const graded = verdict(result, 'level8.hold-your-line');
    expect(graded?.correct).toBe(false);
    expect(graded?.action).toBe('drifted');
  });

  it('fails the line hold for a driver who answers the rider with the horn', () => {
    // The line was held. The horn is the only thing that went wrong, and before
    // this was fixed it was a prohibition the grader could not see.
    const result = drive(
      insteadBetween(1260, 1840, () => ({ hold: true, speed: 30, horn: true }))
    );
    const graded = verdict(result, 'level8.hold-your-line');
    expect(graded?.correct).toBe(false);
    expect(graded?.action).toBe('honk');
  });

  it('passes the line hold for a driver who eases off while holding it', () => {
    // Slowing while somebody comes past is a good answer, and nothing here
    // grades speed. This is the assertion that keeps it that way.
    const result = drive(insteadBetween(1260, 1840, () => ({ hold: true, speed: 14 })));
    expect(verdict(result, 'level8.hold-your-line')?.correct).toBe(true);
  });

  it('fails the bend for a driver who takes it against the center line', () => {
    const result = drive(insteadBetween(2110, 2650, () => ({ lane: INNER, speed: 20 })));
    const graded = verdict(result, 'level8.blind-bend');
    expect(graded?.correct).toBe(false);
    expect(graded?.action).toBe('wrong_lane');
  });

  it('fails the side street for a driver who rolls past the waiting jeepney', () => {
    const result = drive(insteadBetween(2950, 3450, () => ({ lane: CURB, speed: 18 })));
    const graded = verdict(result, 'level8.let-them-out');
    expect(graded?.correct).toBe(false);
  });

  it('fails the gap for a driver who holds their speed into the truck', () => {
    const result = drive(insteadBetween(3750, 4250, () => ({ lane: CURB, speed: 40 })));
    const graded = verdict(result, 'level8.two-seconds');
    expect(result.crashed, 'ran into the truck rather than being graded on the gap').toBe(false);
    expect(graded?.correct).toBe(false);
    expect(graded?.action).toBe('too_close');
  });

  it('fails the finale for a driver who does not stop for the van', () => {
    const result = drive(insteadBetween(4560, 5060, () => ({ lane: CURB, speed: 18 })));
    expect(verdict(result, 'level8.both-at-once')?.correct).toBe(false);
  });

  it('fails the finale for a driver who leans on the horn instead', () => {
    const result = drive(
      insteadBetween(4560, 5060, view => ({ ...goodDriver(view), horn: true }))
    );
    const graded = verdict(result, 'level8.both-at-once');
    expect(graded?.correct).toBe(false);
    expect(graded?.action).toBe('honk');
  });
});

describe('no simplistic habit passes Level 8', () => {
  /** How far short of the pass mark a strategy has to land to count as failing. */
  const MARGIN = 10;

  const missed = (result: DriveResult) =>
    result.crashed || !result.finished || result.total <= level8.requiredScore - MARGIN;

  const report = (name: string, result: DriveResult) =>
    `${name}: ${result.crashed ? 'crashed' : `${result.total}/${level8.requiredScore}`}`;

  it('is not passed by holding the accelerator', () => {
    const result = drive(() => ({ lane: INNER, speed: 64 }));
    expect(missed(result), report('full throttle', result)).toBe(true);
  });

  it('is not passed by braking at everything', () => {
    const result = drive(() => ({ lane: INNER, speed: 20 }));
    expect(missed(result), report('steady 20', result)).toBe(true);
  });

  it('is not passed by stopping at every scenario', () => {
    // A driver who comes to rest at each event and crawls between them. This is
    // the habit the level this replaced could not refuse.
    const result = drive(({ stopped }) => ({ lane: INNER, speed: stopped ? 12 : 0 }));
    expect(missed(result), report('stop at everything', result)).toBe(true);
  });

  it('is not passed by crawling the whole way', () => {
    for (const speed of [8, 11, 15]) {
      const result = drive(() => ({ lane: INNER, speed }));
      expect(missed(result), report(`crawl at ${speed}`, result)).toBe(true);
    }
  });

  it('is not passed by never changing lane', () => {
    const result = drive(view => ({ ...goodDriver(view), lane: INNER, hold: false }));
    expect(missed(result), report('never changes lane', result)).toBe(true);
  });

  it('is not passed by holding the wheel over, either way', () => {
    for (const lane of [0 as LaneIndex, CURB]) {
      const result = drive(() => ({ lane, speed: 34 }));
      expect(missed(result), report(`held to lane ${lane}`, result)).toBe(true);
    }
  });

  it('is not passed by leaning on the horn', () => {
    const result = drive(view => ({ ...goodDriver(view), horn: true }));
    expect(missed(result), report('horn throughout', result)).toBe(true);
  });

  it('is not passed by ignoring the rider and closing the gap', () => {
    // The two scenarios a driver is most likely to think cost nothing.
    const result = drive(view => {
      if (view.distance > 1260 && view.distance < 1840) return { lane: CURB, speed: 34 };
      if (view.distance > 3750 && view.distance < 4250) return { lane: CURB, speed: 40 };
      return goodDriver(view);
    });
    expect(missed(result), report('ignores rider and gap', result)).toBe(true);
  });
});
