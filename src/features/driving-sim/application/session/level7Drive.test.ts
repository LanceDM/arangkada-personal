/**
 * Level 7, actually driven.
 *
 * Every other test here checks a part in isolation. This one runs the real
 * session over the real route with a real keyboard, and asks the only question
 * that matters in the end: can each scenario be passed by doing the thing it
 * asks for, and is it failed by not doing it?
 *
 * Both halves are load-bearing. A scenario nobody can pass is a broken level; a
 * scenario nobody can fail is a decoration, and the version of Level 7 this
 * replaced had several — an overtake that scored for occupying a lane at one
 * instant, a following distance measured against a parked bus, and a merge that
 * graded a speed and then told the driver they had merged.
 */
import { describe, expect, it } from 'vitest';
import { DrivingFSM } from '@/features/driving-sim/domain/fsm/DrivingFSM';
import { LEVELS } from '@/features/driving-sim/domain/scenario/levelCatalog';
import { evaluateWeightedRule } from '@/features/driving-sim/domain/evaluation/ruleEngine';
import { createDrivingSession, NO_INPUT, type InputState } from './DrivingSession';
import type { GameEvent } from '@/features/driving-sim/domain/world/GameEvent';
import type { SceneNode } from '@/features/driving-sim/domain/scene/SceneNode';
import { isOnAuxiliaryLane, segmentAt } from '@/features/driving-sim/domain/world/routeGeometry';
import {
  CANVAS_HEIGHT,
  CANVAS_WIDTH,
  LANE_WIDTH,
  ROAD_CENTRE_X,
  ROAD_WIDTH,
  laneCentreX,
  type LaneIndex,
} from '@/features/driving-sim/domain/world/vehiclePhysics';

const level7 = LEVELS.find(level => level.id === 7)!;
const route = level7.route!;

/** Where a lane's centre is on this road, which never bends. */
const centreOf = (lane: LaneIndex) => laneCentreX(lane, ROAD_CENTRE_X);
/** The middle of the auxiliary lane, where the drive starts. */
const AUXILIARY_X = ROAD_CENTRE_X + ROAD_WIDTH + LANE_WIDTH / 2;

/** What the driver can see, as a driver sees it. */
interface RoadView {
  distance: number;
  speed: number;
  carX: number;
  onAuxiliary: boolean;
  /** Road distance of a vehicle of this kind, when one is drawn. */
  leadDistance: (kind: string) => number | null;
}

/** What the driver wants right now: a line to hold, a speed, and any commitment. */
type Plan = (view: RoadView) => { x: number; speed: number; commitRight?: boolean };

interface DriveResult {
  decisions: Array<{ id: string; action: string; correct: boolean }>;
  crashed: boolean;
  finished: boolean;
  /** Where the car was, each frame, for asserting about the drive itself. */
  track: Array<{ distance: number; x: number; onAuxiliary: boolean }>;
  /** Whether the drive was ever held behind something needing acknowledgement. */
  everPaused: boolean;
  /** Each scenario held for reading, in the order it was held. */
  briefings: string[];
}

/**
 * Drives the route under a plan until the named event has been graded.
 *
 * The clock is the frame counter, so the correction hold after a mistake and
 * every other timed branch land on the same frame every run.
 */
const drive = (plan: Plan, until: string, frames = 12000): DriveResult => {
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
    track: [],
    everPaused: false,
    briefings: [],
  };

  try {
    const fsm = new DrivingFSM();
    const session = createDrivingSession({ level: level7, fsm, signCoverage: {} });
    let previous: InputState = NO_INPUT;

    // The verdict edges the host fires once it has scored a decision. Without
    // them the machine never leaves the state the event was graded in, and no
    // later event can open an approach. Mirrors `useScenarioEvaluation`.
    const settleFsm = (correct: boolean) => {
      if (correct) {
        fsm.transition('answer_correct');
        fsm.transition('feedback_displayed');
        fsm.transition('road_clear');
      } else {
        fsm.transition('answer_incorrect');
        fsm.transition('feedback_displayed');
        fsm.transition('recovery_complete');
        fsm.transition('road_clear');
      }
    };

    for (let frame = 0; frame < frames; frame++) {
      clock = 1_760_000_000_000 + frame * (1000 / 60);

      // Every scenario answered with the car freezes once to be read. A driver
      // releases it and drives the approach; so does this. Released before the
      // frame is read, so what the plan steers against is the road as it stands
      // when the driving starts rather than the frame it was frozen on.
      const held = session.getSnapshot().briefingEvent;
      if (held) {
        result.briefings.push(held.id);
        session.dismissBriefing();
      }

      const snapshot = session.getSnapshot();
      const car = session.getFrame()?.scene.car;
      const nodes: SceneNode[] = session.getFrame()?.scene.nodes ?? [];
      const distance = car?.distance ?? 0;
      const carX = car?.x ?? AUXILIARY_X;

      const view: RoadView = {
        distance,
        speed: snapshot.speed,
        carX,
        onAuxiliary: isOnAuxiliaryLane(carX, ROAD_CENTRE_X),
        // Read off the scene the way a driver reads the road: the vehicle is
        // drawn at a row, and the row is its distance.
        leadDistance: kind => {
          const node = nodes.find(
            (entry): entry is Extract<SceneNode, { kind: 'scripted-vehicle' }> =>
              entry.kind === 'scripted-vehicle' && entry.npc.vehicleKind === kind
          );
          return node ? distance + (CANVAS_HEIGHT - 150 - node.at.y) * 2 : null;
        },
      };
      result.track.push({ distance, x: carX, onAuxiliary: view.onAuxiliary });

      const want = plan(view);
      const input: InputState = {
        ...NO_INPUT,
        // Two controls, as a driver uses them: the throttle is a setting raised
        // in steps, and the brake is a pedal held until the speed is right.
        throttle: snapshot.targetSpeed < want.speed - 1 && !previous.throttle,
        brake: snapshot.speed > want.speed + 2,
        left: carX > want.x + 2,
        // A ramp asks for a press of its own, so the plan lets the key go for a
        // frame before asking for the commitment — which is what a player does.
        right: (Boolean(want.commitRight) && !previous.right) || carX < want.x - 2,
      };
      previous = input;

      const queue: GameEvent[] = [...session.update(input)];
      while (queue.length > 0) {
        const event = queue.shift()!;
        if (event.kind === 'crashed') result.crashed = true;
        if (event.kind === 'finished') result.finished = true;
        if (event.kind === 'decision') {
          const { isCorrect } = evaluateWeightedRule(event.event, event.action, 0);
          result.decisions.push({ id: event.event.id, action: event.action, correct: isCorrect });
          settleFsm(isCorrect);
          queue.push(...session.settleDecision({ isCorrect, weakCompetency: null }));
        }
      }

      const after = session.getSnapshot();
      if (after.inspectionEvent || after.cutsceneEvent || after.adaptationNotice) {
        result.everPaused = true;
      }

      if (result.crashed || result.finished) break;
      if (result.decisions.some(decision => decision.id === until)) break;
    }
    return result;
  } finally {
    performance.now = realPerformanceNow;
    Date.now = realDateNow;
    Math.random = realRandom;
  }
};

const verdict = (result: DriveResult, id: string) =>
  result.decisions.find(decision => decision.id === id);

const CRUISE = centreOf(1); // Lane 2, where the table puts a car
const PASSING = centreOf(0); // Lane 1
const OUTER = centreOf(3); // Lane 4, and the lane the exit is taken from

/**
 * The drive this level is written for: build speed on the acceleration lane and
 * merge into the outer lane, settle into Lane 2, keep a gap, take Lane 1 for the
 * pass and give it back, then move over, slow down and take the exit.
 */
const goodDriver: Plan = view => {
  const { distance } = view;

  // 1. The merge: up to speed on the lane, across into the outer lane with most
  // of the lane still left rather than being narrowed out of it.
  if (distance < 1490) return { x: AUXILIARY_X, speed: 66 };
  if (distance < 2390) return { x: OUTER, speed: 66 };

  // 2. Lane 2, where a passenger car belongs.
  if (distance < 4000) return { x: CRUISE, speed: 99 };

  // 3. Ease off for the van: the requirement is a time gap, so the answer is a
  // speed that leaves one.
  if (distance < 5460) return { x: CRUISE, speed: 45 };

  // 4. The overtake, timed off the truck itself rather than off a distance: out
  // while it is still ahead, back once it is a clear length behind.
  if (distance < 6960) {
    const truck = view.leadDistance('truck');
    if (truck !== null) {
      const gap = distance - truck;
      return { x: gap >= 220 ? CRUISE : PASSING, speed: 99 };
    }
    return { x: CRUISE, speed: 99 };
  }

  // 5. Out of Lane 1 for the faster car.
  if (distance < 8480) return { x: CRUISE, speed: 99 };

  // 6. The exit: into the outer lane, brake to the posted speed, then commit.
  if (distance < 9680) {
    const ready = view.carX > OUTER - 6 && view.speed <= 58;
    return { x: OUTER, speed: 50, commitRight: ready && distance > 8980 };
  }

  // 7. The plaza, at the end of the ramp.
  if (distance > 11180) return { x: OUTER, speed: 18 };
  return { x: OUTER, speed: 50 };
};

describe('driving Level 7 as it is meant to be driven', () => {
  const result = drive(goodDriver, 'level7.toll-plaza-closed-gates');

  it('never ends in an impact', () => {
    expect(result.crashed).toBe(false);
  });

  it('is never held behind anything that has to be dismissed', () => {
    expect(result.everPaused).toBe(false);
  });

  it('starts on the acceleration lane and leaves it while it is still a lane', () => {
    const opening = result.track.filter(step => step.distance < 200);
    expect(opening.every(step => step.onAuxiliary)).toBe(true);

    const left = result.track.find(step => step.distance > 200 && !step.onAuxiliary);
    expect(left, 'the car never left the acceleration lane').toBeDefined();
    // Well before the lane's own end, with most of it still there.
    expect(left!.distance).toBeLessThan(segmentAt(0, route)!.to - 300);
  });

  it('passes every scenario on the route', () => {
    expect(result.decisions.filter(decision => !decision.correct)).toEqual([]);
    expect(result.decisions.map(decision => decision.id)).toEqual(
      level7.events.map(event => event.id)
    );
  });

  it('leaves the expressway by the ramp, and meets the plaza on the road it led to', () => {
    const exitAt = level7.events.find(event => event.maneuver)!.triggerAtDistance;
    const landed = result.track.find(
      (step, index) =>
        index > 0 && step.distance > exitAt && result.track[index - 1].distance <= exitAt
    );
    expect(landed, 'the drive never got past the exit').toBeDefined();
    expect(segmentAt(landed!.distance, route)?.roadside).toBe('toll_approach');
    expect(verdict(result, 'level7.toll-plaza-closed-gates')?.correct).toBe(true);
  });

  it('scores a pass', () => {
    const score = result.decisions.reduce((sum, decision) => {
      const event = level7.events.find(entry => entry.id === decision.id)!;
      return sum + evaluateWeightedRule(event, decision.action, 0).points;
    }, 0);
    expect(score).toBeGreaterThanOrEqual(level7.requiredScore);
  });
});

describe('Level 7 opens quiet', () => {
  it('holds the first briefing until the driver has had five to eight seconds of road', () => {
    // Measured by driving, not assumed from a distance constant: the point is
    // how long the player gets, and how long a distance is worth depends on
    // the pace, the acceleration and the throttle they actually used.
    const fsm = new DrivingFSM();
    const session = createDrivingSession({ level: level7, fsm, signCoverage: {} });
    const opening = session.getSnapshot();
    expect(opening.briefingEvent, 'Level 7 opened behind a panel').toBeNull();
    // Every reason the drive can be held, so "unpaused" is the whole claim.
    expect(opening.inspectionEvent).toBeNull();
    expect(opening.cutsceneEvent).toBeNull();
    expect(opening.adaptationNotice).toBeNull();
    expect(opening.activeEvent).toBeNull();

    const realNow = performance.now;
    performance.now = () => 0;
    let opened = -1;
    try {
      for (let frame = 0; frame < 1200 && opened < 0; frame++) {
        // A driver finding the controls: three taps up to the cruise, then
        // nothing, which is the least eventful start anybody could make.
        session.update({ ...NO_INPUT, throttle: frame < 12 && frame % 4 === 0 });
        if (session.getSnapshot().briefingEvent) opened = frame;
      }
    } finally {
      performance.now = realNow;
    }

    expect(opened, 'no scenario ever announced itself').toBeGreaterThan(0);
    const seconds = opened / 60;
    expect(seconds).toBeGreaterThanOrEqual(5);
    expect(seconds).toBeLessThanOrEqual(8);
  });

  it('asks nothing until the driver has been driving for a while', () => {
    const fsm = new DrivingFSM();
    const session = createDrivingSession({ level: level7, fsm, signCoverage: {} });

    const opening = session.getSnapshot();
    expect(opening.activeEvent).toBeNull();
    expect(opening.inspectionEvent).toBeNull();
    expect(opening.cutsceneEvent).toBeNull();

    const realNow = performance.now;
    performance.now = () => 0;
    try {
      for (let frame = 0; frame < 240; frame++) {
        session.update({ ...NO_INPUT, throttle: frame % 4 === 0 });
      }
    } finally {
      performance.now = realNow;
    }
    const after = session.getSnapshot();
    expect(after.activeEvent, 'a scenario opened inside the first four seconds').toBeNull();
    expect(after.progress).toBeGreaterThan(0);
  });
});

describe('each Level 7 scenario can be failed by not doing what it asks', () => {
  it('fails the merge for a driver who never reaches the minimum speed', () => {
    const result = drive(
      view => (view.distance < 1490 ? { x: AUXILIARY_X, speed: 33 } : { x: OUTER, speed: 33 }),
      'level7.merging-traffic-minimum-speed'
    );
    const graded = verdict(result, 'level7.merging-traffic-minimum-speed');
    expect(graded?.correct).toBe(false);
    expect(graded?.action).toBe('too_slow');
  });

  it('fails the merge for a driver who lets the taper do it for them', () => {
    const result = drive(
      () => ({ x: AUXILIARY_X, speed: 66 }),
      'level7.merging-traffic-minimum-speed'
    );
    const graded = verdict(result, 'level7.merging-traffic-minimum-speed');
    expect(graded?.correct).toBe(false);
    expect(graded?.action).toBe('never_merged');
  });

  it('fails the merge for a driver who arrives on the back of the traffic they join', () => {
    // Over the limit down the acceleration lane, which eats the gap the car
    // ahead left. Graded rather than fatal: the vehicle is still a long way in
    // front, so this is a merge done badly and not a crash.
    const result = drive(
      view => (view.distance < 1490 ? { x: AUXILIARY_X, speed: 132 } : { x: OUTER, speed: 132 }),
      'level7.merging-traffic-minimum-speed'
    );
    const graded = verdict(result, 'level7.merging-traffic-minimum-speed');
    expect(result.crashed).toBe(false);
    expect(graded?.correct).toBe(false);
    expect(graded?.action).toBe('unsafe_gap');
  });

  it('fails the lane rule for a driver who cruises in Lane 1', () => {
    const result = drive(
      view => (view.distance > 2390 ? { x: PASSING, speed: 99 } : goodDriver(view)),
      'level7.lane1-keep-right-except-pass'
    );
    const graded = verdict(result, 'level7.lane1-keep-right-except-pass');
    expect(graded?.correct).toBe(false);
    expect(graded?.action).toBe('wrong_lane');
  });

  it('fails the lane rule for a car cruising in the heavy-vehicle lanes', () => {
    // Lanes 3 and 4 are not a passenger car's lanes either, which a rule
    // reading "anything outside Lane 1" would have let through.
    for (const lane of [2, 3] as LaneIndex[]) {
      const result = drive(
        view => (view.distance > 2390 ? { x: centreOf(lane), speed: 99 } : goodDriver(view)),
        'level7.lane1-keep-right-except-pass'
      );
      const graded = verdict(result, 'level7.lane1-keep-right-except-pass');
      expect(graded?.action, `lane ${lane} passed the passenger-car lane rule`).toBe('wrong_lane');
    }
  });

  it('fails the following gap for a driver who holds expressway speed into it', () => {
    const result = drive(
      view => (view.distance > 4000 ? { x: CRUISE, speed: 99 } : goodDriver(view)),
      'level7.following-distance-lead-van'
    );
    const graded = verdict(result, 'level7.following-distance-lead-van');
    expect(result.crashed, 'ran into the van rather than being graded on the gap').toBe(false);
    expect(graded?.correct).toBe(false);
    expect(graded?.action).toBe('too_close');
  });

  it('fails the overtake for a driver who sits behind the truck instead of passing it', () => {
    const result = drive(
      view => (view.distance > 5460 ? { x: CRUISE, speed: 33 } : goodDriver(view)),
      'level7.lane1-overtake-freight-truck'
    );
    const graded = verdict(result, 'level7.lane1-overtake-freight-truck');
    expect(result.crashed, 'ran into the truck rather than being graded on the pass').toBe(false);
    expect(graded?.correct).toBe(false);
    expect(graded?.action).toBe('no_overtake');
  });

  it('fails the overtake for a driver who pulls out and stays out', () => {
    const result = drive(
      view => (view.distance > 5560 ? { x: PASSING, speed: 99 } : goodDriver(view)),
      'level7.lane1-overtake-freight-truck'
    );
    const graded = verdict(result, 'level7.lane1-overtake-freight-truck');
    expect(graded?.correct).toBe(false);
    expect(graded?.action).toBe('held_passing_lane');
  });

  it('fails the lane-clearing scenario for a driver who holds Lane 1', () => {
    const result = drive(
      view => (view.distance > 6960 ? { x: PASSING, speed: 80 } : goodDriver(view)),
      'level7.lane1-yield-to-faster-traffic'
    );
    const graded = verdict(result, 'level7.lane1-yield-to-faster-traffic');
    expect(graded?.correct).toBe(false);
    expect(graded?.action).toBe('wrong_lane');
  });

  it('fails the exit for a driver still in a through lane', () => {
    const result = drive(
      view => (view.distance > 8480 ? { x: CRUISE, speed: 50 } : goodDriver(view)),
      'level7.check-brakes-reduce-speed'
    );
    expect(verdict(result, 'level7.check-brakes-reduce-speed')?.correct).toBe(false);
  });

  it('refuses the exit to a driver still carrying expressway speed, and says so', () => {
    const result = drive(
      view =>
        view.distance > 8480
          ? { x: OUTER, speed: 99, commitRight: view.distance > 8980 }
          : goodDriver(view),
      'level7.check-brakes-reduce-speed'
    );
    const graded = verdict(result, 'level7.check-brakes-reduce-speed');
    expect(graded?.correct).toBe(false);
    expect(graded?.action).toBe('too_fast');
  });

  it('stops a driver who lines up on a closed toll gate', () => {
    // The barrier is solid, so this one ends the run rather than costing points
    // — the same treatment a road closure gets, and for the same reason.
    const result = drive(
      view => (view.distance > 10780 ? { x: CRUISE, speed: 40 } : goodDriver(view)),
      'level7.toll-plaza-closed-gates'
    );
    expect(result.crashed).toBe(true);
  });
});

describe('no single key passes Level 7', () => {
  const score = (result: DriveResult) =>
    result.decisions.reduce((sum, decision) => {
      const event = level7.events.find(entry => entry.id === decision.id)!;
      return sum + evaluateWeightedRule(event, decision.action, 0).points;
    }, 0);

  it('is not passed by holding the accelerator', () => {
    const result = drive(() => ({ x: AUXILIARY_X, speed: 160 }), 'level7.toll-plaza-closed-gates');
    expect(result.crashed || score(result) < level7.requiredScore).toBe(true);
  });

  it('is not passed by braking at everything', () => {
    const result = drive(
      () => ({ x: AUXILIARY_X, speed: 20 }),
      'level7.toll-plaza-closed-gates',
      30000
    );
    expect(score(result)).toBeLessThan(level7.requiredScore);
  });
});

describe('the shape of a Level 7 drive', () => {
  const result = drive(goodDriver, 'level7.toll-plaza-closed-gates');

  it('holds each scenario to be read exactly once, and never two at a time', () => {
    // One at a time is structural — the world holds a single briefing — and
    // once each is the `briefed` set. A scenario read twice is a scenario whose
    // window reopened, which would mean two of them owned the drive.
    expect(new Set(result.briefings).size).toBe(result.briefings.length);
    for (const id of result.briefings) {
      expect(level7.events.some(event => event.id === id), `${id} is not on this route`).toBe(true);
    }
  });

  it('reads each scenario before it grades it', () => {
    for (const decision of result.decisions) {
      const read = result.briefings.indexOf(decision.id);
      expect(read, `${decision.id} was graded without being read`).toBeGreaterThanOrEqual(0);
    }
  });

  it('opens the plaza once, and only after the exit has been driven', () => {
    const ids = result.decisions.map(decision => decision.id);
    expect(ids.filter(id => id === 'level7.toll-plaza-closed-gates')).toHaveLength(1);
    expect(ids.indexOf('level7.toll-plaza-closed-gates')).toBeGreaterThan(
      ids.indexOf('level7.check-brakes-reduce-speed')
    );
  });

  it('leaves the car somewhere real after the exit, with no jump in the route', () => {
    // The junction turn this replaced carried the car off the canvas and set it
    // down seven hundred units further on. A ramp moves it across a lane and
    // leaves the road to do the rest.
    const exitAt = level7.events.find(event => event.maneuver)!.triggerAtDistance;
    const through = result.track.filter(step => step.distance > exitAt - 400 && step.distance < exitAt + 900);
    expect(through.length).toBeGreaterThan(10);
    for (const step of through) {
      expect(step.x, 'the car left the canvas during the exit').toBeGreaterThan(0);
      expect(step.x).toBeLessThan(CANVAS_WIDTH);
    }
    for (let i = 1; i < through.length; i++) {
      const jump = through[i].distance - through[i - 1].distance;
      expect(jump, 'the route jumped during the exit').toBeLessThan(40);
    }
  });
});

describe('a driver who misses the exit', () => {
  it('is graded down and is not shown the manoeuvre they did not make', () => {
    const missed = drive(
      view => (view.distance > 8480 ? { x: CRUISE, speed: 99 } : goodDriver(view)),
      'level7.check-brakes-reduce-speed'
    );
    const graded = verdict(missed, 'level7.check-brakes-reduce-speed');
    expect(graded?.correct).toBe(false);

    // The road carries them on to the plaza — it was always going that way —
    // but nothing plays the committed manoeuvre for them. The car is where they
    // left it, not on the ramp line.
    const after = missed.track.filter(step => step.distance > 9580).slice(0, 20);
    expect(after.every(step => step.x < AUXILIARY_X - 20)).toBe(true);
  });
});
