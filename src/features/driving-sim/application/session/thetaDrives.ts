/**
 * One scenario, driven at a given theta.
 *
 * Shared by the tests that pin what theta may and may not do to a drive:
 * `thetaLead.test.ts` (where the approach opens, the read phase, the cue) and
 * `thetaGrading.test.ts` (the grade). A drive starts at rest where the road
 * kept clear after the previous scenario begins - the nearest any approach may
 * open - so nothing earlier in the level can hide the scenario, and ends on the
 * frame the scenario is decided.
 *
 * The driver is a function of where the car is and how fast it is going, never
 * of the clock, so one driver is one piece of driving at every theta: the read
 * phase is acknowledged on the frame it opens and costs no frames, and the clock
 * and `Math.random` are seeded per drive, as in `driveSamples.ts`.
 */
import { DrivingFSM } from '@/features/driving-sim/domain/fsm/DrivingFSM';
import type { FSMState } from '@/features/driving-sim/domain/fsm/fsmTypes';
import { reactionClockMs } from '@/features/driving-sim/domain/fsm/fsmMetrics';
import type { ApproachTrace } from '@/features/driving-sim/domain/fsm/approachLead';
import {
  observeReaction,
  type DecisionSettlement,
  type ReactionObservation,
} from '@/features/driving-sim/domain/evaluation/reactionTiming';
import { LEVELS } from '@/features/driving-sim/domain/scenario/levelCatalog';
import { buildEvents, type SlotVariant } from '@/features/driving-sim/domain/scenario/pooling';
import type { LevelConfig, ScenarioEvent } from '@/features/driving-sim/domain/scenario/scenarioDefinition';
import {
  actionZoneFor,
  computeApproachFloors,
  computeApproachRooms,
  computeWarningDistances,
  stoppingDistanceFrom,
  type ActionZone,
} from '@/features/driving-sim/domain/systems/eventScheduler';
import { paceOf } from '@/features/driving-sim/domain/world/DrivingPace';
import { WARNING_START_RUNWAY, WARNING_ZONE_MARGIN } from '@/features/driving-sim/domain/world/vehiclePhysics';
import { isTutorial } from '@/features/driving-sim/domain/systems/tutorial';
import { noStandingStretch } from '@/features/driving-sim/domain/evaluation/eventTelemetry';
import type { GameEvent } from '@/features/driving-sim/domain/world/GameEvent';
import { SLOTS as level0Slots, SLOT_DISTANCES as level0At } from '@/features/driving-sim/domain/scenario/content/levels/level0';
import { SLOTS as level1Slots, SLOT_DISTANCES as level1At } from '@/features/driving-sim/domain/scenario/content/levels/level1';
import { SLOTS as level2Slots, SLOT_DISTANCES as level2At } from '@/features/driving-sim/domain/scenario/content/levels/level2';
import { SLOTS as level3Slots } from '@/features/driving-sim/domain/scenario/content/levels/level3/pools';
import { SLOT_DISTANCES as level3At } from '@/features/driving-sim/domain/scenario/content/levels/level3/level3';
import { SLOTS as level4Slots } from '@/features/driving-sim/domain/scenario/content/levels/level4/pools';
import { SLOT_DISTANCES as level4At } from '@/features/driving-sim/domain/scenario/content/levels/level4/level4';
import { SLOTS as level5Slots, SLOT_DISTANCES as level5At } from '@/features/driving-sim/domain/scenario/content/levels/level5';
import { SLOTS as level6Slots, SLOT_DISTANCES as level6At } from '@/features/driving-sim/domain/scenario/content/levels/level6';
import { SLOTS as level7Slots, SLOT_DISTANCES as level7At } from '@/features/driving-sim/domain/scenario/content/levels/level7';
import { SLOTS as level8Slots, SLOT_DISTANCES as level8At } from '@/features/driving-sim/domain/scenario/content/levels/level8';
import { SLOTS as level9Slots, SLOT_DISTANCES as level9At } from '@/features/driving-sim/domain/scenario/content/levels/level9';
import { SLOTS as level10Slots, SLOT_DISTANCES as level10At } from '@/features/driving-sim/domain/scenario/content/levels/level10';
import { SLOTS as level11Slots, SLOT_DISTANCES as level11At } from '@/features/driving-sim/domain/scenario/content/levels/level11';
import { SLOTS as level12Slots, SLOT_DISTANCES as level12At } from '@/features/driving-sim/domain/scenario/content/levels/level12';
import { createDrivingSession, NO_INPUT, type InputState } from './DrivingSession';

/** Every theta the machine accepts at its bounds, and the three the policy chooses between. */
export const THETAS = [0.5, 0.75, 1, 1.5, 2] as const;

/** The states the `answer_correct` / `answer_incorrect` edges leave. */
const GRADEABLE: readonly FSMState[] = ['REACTION_WINDOW', 'INTERSECTION', 'HAZARD', 'DECISION'];

const FRAME_MS = 1000 / 60;
const EPOCH = 1_760_000_000_000;

/** Long enough for the slowest approach in the game; a drive that runs out reports 'none'. */
const FRAME_LIMIT = 4000;

/** Every level's authored slots, in the one shape every level uses. */
const LEVEL_SLOTS: Record<number, { slots: SlotVariant[][]; distances: number[] }> = {
  0: { slots: level0Slots, distances: level0At },
  1: { slots: level1Slots, distances: level1At },
  2: { slots: level2Slots, distances: level2At },
  3: { slots: level3Slots, distances: level3At },
  4: { slots: level4Slots, distances: level4At },
  5: { slots: level5Slots, distances: level5At },
  6: { slots: level6Slots, distances: level6At },
  7: { slots: level7Slots, distances: level7At },
  8: { slots: level8Slots, distances: level8At },
  9: { slots: level9Slots, distances: level9At },
  10: { slots: level10Slots, distances: level10At },
  11: { slots: level11Slots, distances: level11At },
  12: { slots: level12Slots, distances: level12At },
};

/** One authored variant, placed in a genuine roll of its level. */
export interface RolledScenario {
  level: LevelConfig;
  event: ScenarioEvent;
}

/**
 * Every variant of every slot, each in a roll of its own level that picks it in
 * its slot and the first variant everywhere else - which is exactly how each
 * level's static config is built, so every roll here is one the game can deal.
 */
export const everyScenario = (): RolledScenario[] =>
  LEVELS.flatMap(base => {
    const { slots, distances } = LEVEL_SLOTS[base.id];
    return slots.flatMap((pool, slot) =>
      pool.map((_, variant) => {
        const events = buildEvents(slots, distances, (choices, index) =>
          index === slot ? choices[variant] : choices[0]
        );
        return { level: { ...base, events }, event: events[slot] };
      })
    );
  });

/**
 * Every variant of every slot after every variant of the slot before it, the
 * first variant everywhere else.
 *
 * `everyScenario` fixes the previous slot at its first variant, which is enough
 * for a drive. The room an approach has also depends on what kind of scenario
 * stands before it - a checkpoint's zone stays open 40 units past its line, a
 * road event's 20 - so a claim about room has to hold after each of them.
 */
export const everyPairing = (): RolledScenario[] =>
  LEVELS.flatMap(base => {
    const { slots, distances } = LEVEL_SLOTS[base.id];
    return slots.flatMap((pool, slot) =>
      pool.flatMap((_, variant) =>
        (slot === 0 ? [0] : slots[slot - 1].map((__, before) => before)).map(before => {
          const events = buildEvents(slots, distances, (choices, index) =>
            index === slot ? choices[variant] : index === slot - 1 ? choices[before] : choices[0]
          );
          return { level: { ...base, events }, event: events[slot] };
        })
      )
    );
  });

/** The zone the session gives an event on this level. */
export const zoneOf = (level: LevelConfig, event: ScenarioEvent): ActionZone =>
  actionZoneFor({
    isCheckpoint: Boolean(event.inspection),
    isParking: Boolean(event.parkingCutscene && event.bay),
    isTutorial: isTutorial(level),
    warningDistance: computeWarningDistances(level.events).get(event.triggerAtDistance),
    noStanding: noStandingStretch(event),
  });

/** The event before this one on the route, if any. */
export const previousOf = (level: LevelConfig, event: ScenarioEvent): ScenarioEvent | undefined => {
  const ordered = [...level.events].sort((a, b) => a.triggerAtDistance - b.triggerAtDistance);
  return ordered[ordered.indexOf(event) - 1];
};

/**
 * The nearest road distance any approach to `event` may open at: past the
 * previous scenario's zone and the margin kept after it, or past the start
 * runway and that margin for the first. Derived here from the geometry itself,
 * not from `computeApproachRooms`, so a test can hold the two against each
 * other.
 */
export const clearFrom = (level: LevelConfig, event: ScenarioEvent): number => {
  const previous = previousOf(level, event);
  return (
    (previous ? previous.triggerAtDistance + zoneOf(level, previous).exit : WARNING_START_RUNWAY) +
    WARNING_ZONE_MARGIN
  );
};

/** The two limits the session reports for `event`, as the session computes them. */
export const limitsOf = (level: LevelConfig, event: ScenarioEvent) => ({
  warningDistance: zoneOf(level, event).enter,
  approachRoom: computeApproachRooms(level.events, isTutorial(level)).get(event.triggerAtDistance)!,
  approachFloor: computeApproachFloors(
    level.events,
    isTutorial(level),
    stoppingDistanceFrom(level.speedLimit, paceOf(level))
  ).get(event.triggerAtDistance)!,
});

/**
 * A scenario the drive starts past, reduced to what bounds the ones after it:
 * where it stands and what kind of zone it has.
 *
 * It puts nothing on the road. In a real drive it would have been answered,
 * and an answered scenario's traffic and pedestrians have cleared, whereas one
 * left unanswered behind the start leaves them standing in the car's path - a
 * crossing the car is parked on, the slow vehicle it was to follow.
 */
export const passed = (event: ScenarioEvent): ScenarioEvent => ({
  id: `${event.id}.passed`,
  triggerAtDistance: event.triggerAtDistance,
  type: event.type,
  description: '',
  correctAction: event.correctAction,
  points: 0,
  penaltyMessage: '',
  rewardMessage: '',
  duration: 0,
  ...(event.warningDistance !== undefined ? { warningDistance: event.warningDistance } : {}),
  ...(event.inspection ? { inspection: event.inspection } : {}),
  ...(event.parkingCutscene ? { parkingCutscene: event.parkingCutscene } : {}),
  ...(event.bay ? { bay: event.bay } : {}),
  ...(event.avoid ? { avoid: event.avoid } : {}),
  ...(event.noStandingWithin !== undefined ? { noStandingWithin: event.noStandingWithin } : {}),
});

/** What the driver does this frame, from where the car is. */
export type Driver = (at: {
  /** Signed road distance to the scenario: negative while it is still ahead. */
  diff: number;
  /** How far before it its zone starts. */
  zone: number;
  speed: number;
}) => Partial<InputState>;

/** Holds the speed two throttle taps give, and does nothing else. */
export const cruise: Driver = () => ({});

/**
 * Sounds the horn and swerves, then brakes to rest and drives on, starting at
 * `fraction` of the zone before the line. Before a narrowed announcement at
 * 0.9, before any announcement but a widened one at 1.2: the driving theta
 * decides whether anyone has been told about yet.
 */
export const swerveAndStopAt = (fraction: number): Driver => {
  let begun = false;
  let frames = 0;
  let rested = false;
  return ({ diff, zone, speed }) => {
    if (!begun && diff >= -fraction * zone) begun = true;
    if (!begun) return {};
    frames += 1;
    if (frames <= 10) return { horn: true, left: true };
    if (frames <= 25) return { left: true };
    if (!rested) {
      if (speed <= 0) rested = true;
      return { brake: true };
    }
    return { right: frames % 60 < 20 };
  };
};

/** What one drive did to its scenario. */
export interface ScenarioDrive {
  /** The action it was graded as, or 'crashed' / 'none'. */
  outcome: string;
  /** Standing penalties charged on the way, by the action charged. */
  penalties: string[];
  /** How many times it was held to be read. */
  briefings: number;
  /** Where the car started, as a road distance. */
  startDistance: number;
  /** Signed distance to it on the frame its approach opened, or null if it never did. */
  openedAt: number | null;
  /** Every frame it was the active event: where the car was, and the cue shown. */
  cue: Array<{ diff: number; approach: number }>;
  /** How the world settled it, or null if it never was. */
  settlement: DecisionSettlement | null;
  /**
   * What its decision says about response speed, read exactly as the host
   * reads it: off the machine's own log, before the verdict is fired.
   */
  reaction: ReactionObservation | null;
  /** What the session says theta did to its approach, asked when it was decided as the host asks it. */
  approach: ApproachTrace | null;
  /** The frames it opened, was released from reading, and was decided on. */
  frames: { opened: number | null; released: number | null; decided: number | null };
}

/** How a drive reads the holds it meets. */
export interface DriveOptions {
  /**
   * How many frames a read phase stays open before it is released - time on
   * the clock with the world held still, as a player reading it would spend.
   */
  readFrames?: number;
}

/** xorshift32, as `driveSamples.ts` seeds its drives. */
const seeded = (seed: number) => {
  let state = seed | 0 || 1;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return ((state >>> 0) % 1000) / 1000;
  };
};

/**
 * Drives one scenario at `theta`, from rest just past the previous one's zone,
 * until it is decided.
 *
 * Throttle is two taps, and two more after any stop the driver did not ask to
 * hold; every hold the drive opens is answered the frame it opens, checkpoints
 * and cutscenes with their first choice; and every verdict is settled as the
 * host settles one, so the machine is always somewhere an approach can open.
 */
export const driveScenario = (
  level: LevelConfig,
  event: ScenarioEvent,
  theta: number,
  driver: Driver = cruise,
  options: DriveOptions = {}
): ScenarioDrive => driveFrom(level, event, theta, driver, startFor(level, event), FRAME_LIMIT, options);

/** How far a start may be moved on to find road the car is not hit on the moment it appears. */
const START_STEP = 25;
const START_TRIES = 12;

const starts = new WeakMap<ScenarioEvent, number>();

/**
 * Where `event`'s drives start: the nearest point any approach may open, or the
 * first point after it where the car is not hit on the frame it appears.
 *
 * The world spawns a car in its level's default lane, and a scenario's own
 * traffic can be standing in that lane at the boundary - a spawn no real drive
 * makes, since a driver arrives in the lane they chose. Chosen once per
 * scenario, at theta 1, so every theta drives from the same point and the same
 * driver is still the same driving.
 */
const startFor = (level: LevelConfig, event: ScenarioEvent): number => {
  const known = starts.get(event);
  if (known !== undefined) return known;
  let start = previousOf(level, event) ? clearFrom(level, event) : 0;
  for (let attempt = 0; attempt < START_TRIES; attempt++) {
    const probe = driveFrom(level, event, 1, cruise, start, 1);
    if (probe.outcome !== 'crashed') break;
    start += START_STEP;
  }
  starts.set(event, start);
  return start;
};

const driveFrom = (
  level: LevelConfig,
  event: ScenarioEvent,
  theta: number,
  driver: Driver,
  startDistance: number,
  frameLimit = FRAME_LIMIT,
  { readFrames = 0 }: DriveOptions = {}
): ScenarioDrive => {
  const zone = zoneOf(level, event).enter;

  // Everything behind the start is passed; the scenario and everything after
  // it are the level as authored. Checked rather than assumed: the scenario
  // has to be bounded exactly as it is in the game, or the drive proves
  // nothing about the game.
  const driven: LevelConfig = {
    ...level,
    events: level.events.map(other =>
      other.triggerAtDistance < event.triggerAtDistance ? passed(other) : other
    ),
  };
  const target = driven.events.find(other => other.id === event.id)!;
  if (JSON.stringify(limitsOf(driven, target)) !== JSON.stringify(limitsOf(level, event))) {
    throw new Error(`${event.id}: the passed scenarios no longer bound it as the level does`);
  }

  const realPerformanceNow = performance.now;
  const realDateNow = Date.now;
  const realRandom = Math.random;
  let clock = EPOCH;
  performance.now = () => clock;
  Date.now = () => clock;
  Math.random = seeded(event.triggerAtDistance * 7919 + 13);

  try {
    const fsm = new DrivingFSM();
    const session = createDrivingSession({ level: driven, fsm, signCoverage: {}, initialDistance: startDistance });
    fsm.setTransitionParams({ approachScale: theta, reactionScale: 1 });

    const drive: ScenarioDrive = {
      outcome: 'none',
      penalties: [],
      briefings: 0,
      startDistance,
      openedAt: null,
      cue: [],
      settlement: null,
      reaction: null,
      approach: null,
      frames: { opened: null, released: null, decided: null },
    };
    let frame = 0;
    let heldFor = 0;
    let taps = 0;
    let wasMoving = false;

    const distanceNow = () => session.getFrame()?.scene.car.distance ?? startDistance;

    const settle = (reported: readonly GameEvent[]) => {
      const queue = [...reported];
      while (queue.length > 0) {
        const report = queue.shift()!;
        if (report.kind === 'crashed' && drive.outcome === 'none') drive.outcome = 'crashed';
        if (report.kind === 'penalty') drive.penalties.push(report.event.id);
        if (report.kind !== 'decision') continue;
        if (report.event.id === event.id) {
          drive.outcome = report.action;
          drive.settlement = report.settlement;
          drive.reaction = observeReaction(
            report.settlement,
            report.event,
            reactionClockMs(fsm.getTransitionLog(), clock)
          );
          drive.approach = session.approachTraceFor(report.event);
          drive.frames.decided = frame;
          drive.frames.opened ??= frame;
          // Opened and settled on the same frame - a tutorial step the car
          // already satisfies - is still an approach that opened there.
          drive.openedAt ??= distanceNow() - event.triggerAtDistance;
        }
        if (GRADEABLE.includes(fsm.getState())) {
          fsm.transition('answer_correct');
          fsm.transition('feedback_displayed');
          fsm.transition('road_clear');
        }
        queue.push(...session.settleDecision({ isCorrect: true, weakCompetency: null }));
      }
    };

    for (; frame < frameLimit && drive.outcome === 'none'; frame++) {
      clock = EPOCH + frame * FRAME_MS;
      const car = session.getFrame()?.scene.car;
      const speed = car?.speed ?? 0;
      const asked = driver({ diff: (car?.distance ?? startDistance) - event.triggerAtDistance, zone, speed });

      if (speed > 0) wasMoving = true;
      if (wasMoving && speed <= 0 && !asked.brake) {
        wasMoving = false;
        taps = 0;
      }
      const throttle = taps < 2 && !asked.brake && frame % 4 === 0;
      if (throttle) taps += 1;

      settle(session.update({ ...NO_INPUT, ...asked, throttle }));

      const snapshot = session.getSnapshot();
      if (snapshot.activeEvent?.id === event.id) {
        const diff = distanceNow() - event.triggerAtDistance;
        if (drive.openedAt === null) {
          drive.openedAt = diff;
          drive.frames.opened = frame;
        }
        drive.cue.push({ diff, approach: snapshot.eventApproach });
      }
      if (snapshot.adaptationNotice) session.dismissAdaptationNotice();
      if (snapshot.briefingEvent) {
        const ours = snapshot.briefingEvent.id === event.id;
        if (heldFor === 0 && ours) drive.briefings += 1;
        heldFor += 1;
        if (heldFor > readFrames) {
          session.dismissBriefing();
          heldFor = 0;
          if (ours) drive.frames.released = frame;
        }
      }
      if (snapshot.inspectionEvent) {
        settle(session.answerInspection(snapshot.inspectionEvent.choices?.[0]?.action ?? 'stop'));
      } else if (snapshot.cutsceneEvent) {
        settle(session.answerCutscene(snapshot.cutsceneEvent.choices?.[0]?.action ?? 'stop'));
      }
    }
    return drive;
  } finally {
    performance.now = realPerformanceNow;
    Date.now = realDateNow;
    Math.random = realRandom;
  }
};
