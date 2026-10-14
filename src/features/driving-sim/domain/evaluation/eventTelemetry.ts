// What the vehicle actually did at an event, and how that becomes a score.
//
// Everything here reads the car, never the keyboard. The arrow keys drive;
// they are never themselves right or wrong. Grading the keys instead would make
// holding the accelerator to keep moving a violation, and would score genuinely
// slowing down — lifting off and coasting — as nothing at all, because no key
// is down to read. What gets scored is whether the vehicle came to
// rest before the line, what speed it carried past the sign, which lane it was
// in, and which way it turned.

import type { LevelConfig, LineHoldRequirement, ScenarioEvent } from '@/features/driving-sim/domain/scenario/scenarioDefinition';
import { resolveLaneRole, type LaneIndex } from '@/features/driving-sim/domain/world/vehiclePhysics';
import { CAR_LENGTH, UNITS_PER_METER } from '@/features/driving-sim/domain/world/routeGeometry';

/** At or below this the vehicle counts as having come to a complete stop. */
export const FULL_STOP_SPEED = 1.5;

/**
 * A hazard sign asks for a genuine reduction, not merely for the posted limit
 * to be respected. Expressed as a share of whatever speed applies here.
 */
export const SLOWED_SHARE = 0.6;

/** A posted minimum is met with a little margin, so rounding never fails you. */
export const MINIMUM_SHARE = 0.75;

/**
 * How far through an overtake the car actually got.
 *
 * An overtake is a sequence, not a position, so each flag is set by the frame
 * that earns it and never cleared: a driver who pulled out, passed and came
 * back has done all three whatever lane the window happens to close in. What is
 * *not* recorded here is anything the simulation did not watch happen, which is
 * the whole reason the phases are separate — the feedback can then name the
 * phase that was reached rather than praising a manoeuvre nobody measured.
 */
export interface OvertakeProgress {
  /** Moved into the passing lane while still behind the vehicle. */
  pulledOut: boolean;
  /** Drew level with the vehicle from the passing lane. */
  passedInLane: boolean;
  /** Drew level with it from some other lane — an undertake, not a pass. */
  passedElsewhere: boolean;
  /** Got far enough past it for the return to be safe. */
  cleared: boolean;
  /** Back in a travelling lane once clear: the manoeuvre completed. */
  returned: boolean;
  /** Left the passing lane while still alongside it or barely in front. */
  cutIn: boolean;
}

/**
 * How much of a merge the car was seen to make.
 *
 * A merge is three measurements taken at one moment — the moment the car left
 * the auxiliary lane — plus the fact of having left it at all. Recording the
 * moment rather than the window is the point: the speed you were doing when you
 * joined and the gap you joined into are the merge, and a reading taken
 * anywhere else is a reading of something that is not it.
 */
export interface MergeProgress {
  /** The car was on the auxiliary lane at some point in the window. */
  usedAuxiliary: boolean;
  /** The lane it joined when it left, or null while it never has. */
  joinedLane: LaneIndex | null;
  /** Its speed at that moment. */
  speedAtJoin: number;
  /** Its headway to the traffic it joined in front of or behind, at that moment. */
  headwayAtJoin: number;
  /** How much of the auxiliary lane was left at that moment, as a share of one. */
  auxiliaryShareAtJoin: number;
  /** It was still on the auxiliary lane on the last frame measured. */
  onAuxiliary: boolean;
}

const freshMerge = (): MergeProgress => ({
  usedAuxiliary: false,
  joinedLane: null,
  speedAtJoin: 0,
  headwayAtJoin: Number.POSITIVE_INFINITY,
  auxiliaryShareAtJoin: 0,
  onAuxiliary: false,
});

const freshOvertake = (): OvertakeProgress => ({
  pulledOut: false,
  passedInLane: false,
  passedElsewhere: false,
  cleared: false,
  returned: false,
  cutIn: false,
});

/** What the vehicle did while inside one event's measurement window. */
export interface EventTelemetry {
  /** Lowest speed seen anywhere in the window. */
  minSpeed: number;
  /** Speed as the car's nose reached the sign or line. */
  speedAtSign: number;
  /** Lane occupied as the car's nose reached the sign or line. */
  laneAtSign: LaneIndex;
  /** The lane the last frame reported, which `laneHeldFrames` counts against. */
  laneAtFrame: LaneIndex;
  /**
   * The lowest lane index occupied anywhere in the window — lane 0 is the
   * leftmost, which on a two-way road is the oncoming side. A `strict` lane
   * requirement is judged against this instead of `laneAtSign`, so crossing
   * into the oncoming lane and returning before the marking still counts as
   * having crossed it.
   */
  minLaneSeen: LaneIndex;
  /** The car came to a complete rest before passing the line. */
  stoppedBeforeLine: boolean;
  /**
   * The car came to rest where its scenario forbids it: inside the stretch
   * `noStandingStretch` gives, on either side of the place. A stop anywhere
   * else on the approach is `stoppedBeforeLine` and nothing more.
   */
  stoodWhereForbidden: boolean;
  /** A turn was executed out of this junction. */
  turned: 'left' | 'right' | null;
  /** The horn was sounded in the window. */
  honked: boolean;
  /** Where the car was across the road when the window opened. */
  entryX: number;
  /**
   * How many frames in a row the car has been in the lane it is in now.
   *
   * A lane requirement can be settled early — the driver is where the sign
   * wants them, so there is nothing left to watch — and that reading has to be
   * of a lane the car is *holding*, not of one it passed through. On a road
   * that bends, a driver correcting to hold their own lane crosses a boundary
   * for a frame or two at a time, and a single frame was enough to score a
   * bend taken against the center line as a pass.
   */
  laneHeldFrames: number;
  /** The furthest it moved from there, in canvas pixels. */
  maxDrift: number;
  /** The furthest it moved to the left of there, in canvas pixels. */
  maxDriftLeft: number;
  /** The furthest it moved to the right of there, in canvas pixels. */
  maxDriftRight: number;
  /** The car came to rest off the carriageway, in the roadside bay. */
  stoppedInBay: boolean;
  /**
   * The brake was actually applied at some point in the window. Read from the
   * control input, not inferred from the speed dropping: lifting off the
   * throttle and coasting slows the car too, and reporting that as "braked"
   * (which it used to) told a driver they had done something they had not. It
   * separates a deliberate brake from a coast so the two can be graded and,
   * more importantly, *described* as the different actions they are.
   */
  braked: boolean;
  /**
   * The longest unbroken run of frames in which the brake was held *while the
   * car was still going too fast to hold it*.
   *
   * `braked` alone cannot answer the question a blowout asks, because the
   * module does not forbid the brake — it forbids it *yet*. "Do not slam on the
   * brakes… apply the brake softly once the vehicle is under control" is one
   * instruction about when, and when is a speed.
   *
   * The two halves have to be one measurement rather than two. Recorded apart —
   * the fastest the car ever was while braking, and the longest hold anywhere —
   * they combine across moments that have nothing to do with each other: a
   * driver who taps down from 42 and then holds the pedal to a stop from 20 has
   * a top braking speed of 42 and a longest hold of 28, and did nothing wrong.
   * A run is the offense, so a run is what is counted. See `CoastRequirement`.
   */
  longestHardBrake: number;
  /** Frames of that in a row up to now, which `longestHardBrake` is the peak of. */
  hardBrakeRun: number;
  /**
   * A jammed throttle was brought back under control inside this window.
   *
   * The whole answer to that scenario, and the one thing a speed at a point
   * cannot read. "Hold the brake down until it slows" is done the moment the
   * car is back under control — after which the driver quite correctly builds
   * their speed back up, and arrives at the measuring point doing exactly what
   * a speed check would fail them for. Reported by the world, which owns
   * whether the jam has let go.
   */
  throttleRecovered: boolean;
  /** Set once the nose has passed the sign, so `speedAtSign` is only taken once. */
  reachedSign: boolean;
  /**
   * The closest the car came to the vehicle ahead, in seconds of headway.
   *
   * `Infinity` when there was never a vehicle ahead to measure against, which
   * is how "no gap was ever at risk" is told apart from "the gap was zero".
   */
  minHeadway: number;
  /** Frames in which a vehicle ahead was there to measure at all. */
  headwayFrames: number;
  /** Frames in which the vehicle this event is about was on the road. */
  leadFrames: number;
  /**
   * Of those, the frames it was ahead of the car in the car's lane: being
   * followed. A following gap is kept to a vehicle you are behind, so a window
   * with none of these never asked for one - the car was in another lane, or
   * already past it - however close the two came on the road.
   */
  followedFrames: number;
  /** How much of an overtake the car was seen to perform. */
  overtake: OvertakeProgress;
  /** How much of a merge the car was seen to make. */
  merge: MergeProgress;
  /**
   * The wheel was turned for a manoeuvre the car was carrying too much speed to
   * take. Recorded rather than ignored so the feedback can say which of the two
   * things stopped the turn — the lane or the speed — instead of reporting the
   * absence of a turn nobody could explain.
   */
  turnRefusedTooFast: boolean;
}

export const createTelemetry = (speed: number, lane: LaneIndex, x = 0): EventTelemetry => ({
  entryX: x,
  maxDrift: 0,
  maxDriftLeft: 0,
  maxDriftRight: 0,
  laneHeldFrames: 0,
  minHeadway: Number.POSITIVE_INFINITY,
  headwayFrames: 0,
  leadFrames: 0,
  followedFrames: 0,
  overtake: freshOvertake(),
  merge: freshMerge(),
  turnRefusedTooFast: false,
  minSpeed: speed,
  speedAtSign: speed,
  laneAtSign: lane,
  laneAtFrame: lane,
  minLaneSeen: lane,
  stoppedBeforeLine: false,
  stoodWhereForbidden: false,
  turned: null,
  honked: false,
  stoppedInBay: false,
  braked: false,
  longestHardBrake: 0,
  hardBrakeRun: 0,
  throttleRecovered: false,
  reachedSign: false,
});

/**
 * Folds one frame of vehicle state into the record. `pastSign` flips true once
 * the car's nose reaches the event, which is the moment the sign is read.
 */
export const recordFrame = (
  telemetry: EventTelemetry,
  speed: number,
  lane: LaneIndex,
  pastSign: boolean,
  honking: boolean,
  inBay = false,
  braking = false,
  /** Where the car is across the road, for the requirement that measures wander. */
  x = telemetry.entryX,
  /**
   * This frame's brake is one the scenario forbids — held while the car is
   * still too fast for it. Decided by the caller, which is where the event and
   * its threshold are, exactly as `inBay` is.
   */
  hardBraking = false,
  /** The world reports a jammed throttle is back under control this frame. */
  throttleRecovered = false,
  /**
   * The car is inside the stretch where its scenario forbids coming to rest
   * (`noStandingStretch`). Decided by the caller, which knows where the car is
   * against the place, exactly as `inBay` is.
   */
  inNoStanding = false
) => {
  telemetry.maxDrift = Math.max(telemetry.maxDrift, Math.abs(x - telemetry.entryX));
  telemetry.maxDriftLeft = Math.max(telemetry.maxDriftLeft, telemetry.entryX - x);
  telemetry.maxDriftRight = Math.max(telemetry.maxDriftRight, x - telemetry.entryX);
  telemetry.laneHeldFrames = lane === telemetry.laneAtFrame ? telemetry.laneHeldFrames + 1 : 0;
  telemetry.laneAtFrame = lane;
  telemetry.minSpeed = Math.min(telemetry.minSpeed, speed);
  telemetry.minLaneSeen = Math.min(telemetry.minLaneSeen, lane) as LaneIndex;
  if (honking) telemetry.honked = true;
  if (braking) telemetry.braked = true;
  // Latched, never cleared: the recovery happened, whatever the car does after.
  if (throttleRecovered) telemetry.throttleRecovered = true;
  if (hardBraking) {
    telemetry.hardBrakeRun += 1;
    telemetry.longestHardBrake = Math.max(telemetry.longestHardBrake, telemetry.hardBrakeRun);
  } else {
    telemetry.hardBrakeRun = 0;
  }
  // Pulling in and coming to rest are one act: stopping on the carriageway is
  // not parking, and rolling through a bay is not stopping.
  if (inBay && speed <= FULL_STOP_SPEED) telemetry.stoppedInBay = true;
  // Before the place or past it: the rule reaches both ways, so this is not
  // closed off by `reachedSign` the way a stop before the line is.
  if (inNoStanding && speed <= FULL_STOP_SPEED) telemetry.stoodWhereForbidden = true;

  if (!telemetry.reachedSign) {
    // Still on the approach, so a stop here is a stop before the line.
    if (speed <= FULL_STOP_SPEED) telemetry.stoppedBeforeLine = true;
    if (pastSign) {
      telemetry.reachedSign = true;
      telemetry.speedAtSign = speed;
      telemetry.laneAtSign = lane;
    }
  }
};

/**
 * How far past the vehicle being overtaken the car counts as still alongside,
 * in road units.
 *
 * The view compresses two road units into one screen pixel, so a 68-pixel car
 * beside a 66-pixel truck are overlapping bodies until their centres are about
 * 134 road units apart. 120 is a little inside that: while the gap is smaller
 * than this the two vehicles are level in the only sense that matters, which is
 * that one of them cannot move into the other's lane. A scenario's `clearBy`
 * has to be larger again, or the grader would call a return safe at a distance
 * the collision pass calls an impact.
 */
const ALONGSIDE = 120;

/** One frame of where the car is relative to the traffic this event is about. */
export interface TrafficSample {
  lane: LaneIndex;
  /** How fast the car is going, for the measurements taken at a moment. */
  speed: number;
  /** Seconds to the vehicle ahead; `Infinity` when there is none. */
  headway: number;
  /**
   * Road distance from the vehicle this event is about: positive once the car
   * is in front of it. `null` when that vehicle is not on the road yet.
   */
  gapToLead: number | null;
  /**
   * That vehicle is ahead of the car in the car's own lane: the car is
   * following it. Decided by the caller, which knows the lane the vehicle is
   * in (`leadLane`), exactly as `recordFrame`'s `inBay` is.
   */
  followed: boolean;
  /** How much of the auxiliary lane is left here, as a share of a full one. */
  auxiliaryShare: number;
  /**
   * The car is out on an auxiliary lane rather than in a through lane.
   *
   * `lane` cannot say this: it clamps everything beyond the carriageway to the
   * outermost through lane, so an acceleration lane and the lane beside it read
   * the same. They are not the same place, and the merge is the difference.
   */
  onAuxiliary: boolean;
}

/**
 * Folds one frame of the car's relationship to the traffic ahead into the
 * record: how close it is in time, and how far through an overtake it has got.
 *
 * Separate from `recordFrame` because it answers a different question about the
 * same frame. `recordFrame` reads the car alone — its speed, its lane, whether
 * it stopped — and needs nothing else on the road to be true. This one is only
 * meaningful where the scenario put a vehicle there, and reads the two of them
 * together.
 */
export const recordTraffic = (
  telemetry: EventTelemetry,
  event: ScenarioEvent,
  level: LevelConfig,
  { lane, speed, headway, gapToLead, followed, onAuxiliary, auxiliaryShare }: TrafficSample
) => {
  if (gapToLead !== null) {
    telemetry.leadFrames += 1;
    if (followed) telemetry.followedFrames += 1;
  }

  // A following gap is the gap to a vehicle the car is behind, in its lane.
  // Measured along the road alone, a vehicle in the next lane reads closer and
  // closer as the car draws level, and 0 seconds once it has, which would fail
  // a driver passing a rider in the lane beside it for tailgating them.
  if (Number.isFinite(headway) && (followed || !event.following)) {
    telemetry.headwayFrames += 1;
    telemetry.minHeadway = Math.min(telemetry.minHeadway, headway);
  }

  // The merge, recorded at the moment it happens: the frame the car stops being
  // on the auxiliary lane, having been on it.
  const merge = telemetry.merge;
  if (onAuxiliary) merge.usedAuxiliary = true;
  else if (merge.usedAuxiliary && merge.joinedLane === null) {
    merge.joinedLane = lane;
    merge.speedAtJoin = speed;
    merge.headwayAtJoin = headway;
    merge.auxiliaryShareAtJoin = auxiliaryShare;
  }
  merge.onAuxiliary = onAuxiliary;

  const manoeuvre = event.overtake;
  if (!manoeuvre || gapToLead === null) return;

  const oncoming = level.paint?.oncomingLanes ?? 0;
  const passingLane = resolveLaneRole(manoeuvre.passingLane, oncoming);
  const inPassingLane = lane === passingLane;
  const progress = telemetry.overtake;

  // In the lane the pass is made from, with the vehicle not yet behind: the
  // manoeuvre has begun. Deliberately not "further back than a car length" —
  // that is a fact about which frame you happen to look at, and a driver who
  // pulled out late has still pulled out.
  if (inPassingLane && gapToLead < ALONGSIDE) progress.pulledOut = true;

  // Level with it. Which lane that happened in is the difference between an
  // overtake and an undertake, so both are recorded rather than one.
  if (Math.abs(gapToLead) <= ALONGSIDE) {
    if (inPassingLane) progress.passedInLane = true;
    else progress.passedElsewhere = true;
  }

  if (gapToLead >= manoeuvre.clearBy) progress.cleared = true;

  // Back in a travelling lane. Before there is room, that is cutting in; once
  // clear, it is the last step of the pass.
  if (!inPassingLane && progress.pulledOut) {
    if (gapToLead >= manoeuvre.clearBy) progress.returned = true;
    else if (gapToLead > -ALONGSIDE) progress.cutIn = true;
  }
};

/** The scenario forbids coming to rest at its place: `avoid` names the stop. */
const forbidsStop = (event: ScenarioEvent): boolean => event.avoid?.includes('stop') ?? false;

/** Where a scenario forbids coming to rest, as signed distances from its point. */
export interface NoStandingStretch {
  /** How far short of the point the car's nose may be and the car still stand within reach. */
  from: number;
  /** How far past it the nose is when the car's tail is last within reach. */
  to: number;
}

/**
 * The stretch where coming to rest fails a scenario that forbids the stop, in
 * signed road distance from its point (negative while the point is ahead),
 * measured at the car's nose as every `diff` is. Null where nothing is
 * forbidden.
 *
 * The car stands within `noStandingWithin` meters of the place when any part
 * of it does: from its nose that far short of the place to its tail that far
 * past it. The place is the event's point, where the hydrant or the sign is
 * drawn. Until the first play-test this was the whole 340-unit approach, which
 * failed a stop eleven meters short of a hydrant for "within four meters" and
 * passed a car standing level with it.
 */
export const noStandingStretch = (event: ScenarioEvent): NoStandingStretch | null => {
  if (!forbidsStop(event)) return null;
  const reach = (event.noStandingWithin ?? 0) * UNITS_PER_METER;
  return { from: 0 - reach, to: CAR_LENGTH + reach };
};

/** The speed this event is judged against: its own posting, else the road's. */
export const speedFor = (event: ScenarioEvent, level: LevelConfig): number =>
  event.postedSpeed ?? level.speedLimit;

/**
 * What the driver actually did, in the same vocabulary the scoring engine
 * already speaks. This is compared against `correctAction` exactly as before,
 * so every level's existing content keeps working — the difference is only that
 * the verb now describes the vehicle rather than the keyboard.
 */
export const deriveAction = (
  telemetry: EventTelemetry,
  event: ScenarioEvent,
  level: LevelConfig
): string => {
  // Discrete acts describe themselves and outrank anything read off the
  // speedometer: sounding the horn is a decision, not a speed.
  if (telemetry.turned) {
    // Where the road ends, both turns are right, so the one taken is the one
    // that was asked for.
    return event.maneuver?.direction === 'either'
      ? event.correctAction
      : `turn_${telemetry.turned}`;
  }
  if (telemetry.honked && event.correctAction === 'honk') return 'honk';

  const posted = speedFor(event, level);

  if (event.type === 'speed_limit') {
    if (event.speedRule === 'minimum') {
      return telemetry.speedAtSign >= posted * MINIMUM_SHARE ? 'accelerate' : 'brake';
    }
    // A posted maximum is met by being at or under it as you pass the sign.
    if (telemetry.stoppedBeforeLine && event.correctAction === 'stop') return 'stop';
    return telemetry.speedAtSign <= posted ? 'brake' : 'accelerate';
  }

  // Coming to a complete stop satisfies any request to slow down — stopping is
  // more than braking, not something else. It only reads as 'stop' where a stop
  // is what the sign actually asked for, so an over-cautious learner who halts
  // at a give-way sign is not marked wrong for it. A full stop is always a
  // brake, so where the sign wanted braking, that is what it reads as.
  //
  // And where the scenario forbids the stop itself (a car may not stand at a
  // hydrant or beside a tow-away sign), a stop where it is forbidden is named
  // for what it is. Read as a brake, the prohibition would compare against an
  // action that never occurs, and a slow-down past the place - which no rule
  // forbids - could not be told from coming to rest at it. A stop anywhere else
  // on the approach is one the rule does not reach, and reads as a brake.
  if (forbidsStop(event) && telemetry.stoodWhereForbidden) return 'stop';
  if (telemetry.stoppedBeforeLine) {
    return event.correctAction === 'stop' ? 'stop' : 'brake';
  }

  // Everything else: did the vehicle noticeably slow for this, or not — and if
  // it slowed, was that a real brake or just a coast?
  //
  // The distinction matters because "you braked" was being reported to a driver
  // who only lifted off the throttle. Coasting and braking are graded the same
  // where either is acceptable (see the rule engine: 'slow' satisfies a request
  // to brake), so nothing legitimate fails for it — but the action is now named
  // for what the driver actually did.
  if (telemetry.speedAtSign <= posted * SLOWED_SHARE) {
    return telemetry.braked ? 'brake' : 'slow';
  }
  return 'accelerate';
};

/**
 * Which lanes satisfy this event, or null where it does not care.
 *
 * A road that simply ends accepts either turn, but each still has to be made
 * from its own lane, so it yields two acceptable positions rather than one.
 */
export const acceptableLanes = (
  event: ScenarioEvent,
  level: LevelConfig
): LaneIndex[] | null => {
  const oncoming = level.paint?.oncomingLanes ?? 0;
  if (event.maneuver) {
    // A road that simply ends accepts either turn, and each is made from its
    // own side: left from the lane nearest the centre line, right from the one
    // nearest the curb.
    return event.maneuver.direction === 'either'
      ? [resolveLaneRole('inner', oncoming), resolveLaneRole('curb', oncoming)]
      : [resolveLaneRole(event.maneuver.lane, oncoming)];
  }
  if (event.requiredLane) {
    const required = resolveLaneRole(event.requiredLane.lane, oncoming);
    // A `strict` requirement is a prohibition on going any further inboard than
    // this lane, not an instruction to sit in it — "keep out of the overtaking
    // lane" is satisfied by every lane outside it. Grading already reads it that
    // way (`minLaneSeen` against the lowest acceptable lane); returning the
    // single lane here made the HUD and the lane cue say otherwise, so a driver
    // correctly in the curb lane was told to change lanes.
    if (event.requiredLane.strict) {
      const curb = resolveLaneRole('curb', oncoming);
      return Array.from({ length: curb - required + 1 }, (_, i) => (required + i) as LaneIndex);
    }
    return [required];
  }
  return null;
};

/** The lane a given turn has to be made from at this junction. */
export const laneForTurn = (
  maneuver: NonNullable<ScenarioEvent['maneuver']>,
  turning: 'left' | 'right',
  level: LevelConfig
): LaneIndex => {
  const oncoming = level.paint?.oncomingLanes ?? 0;
  return maneuver.direction === 'either'
    ? resolveLaneRole(turning === 'left' ? 'inner' : 'curb', oncoming)
    : resolveLaneRole(maneuver.lane, oncoming);
};

/**
 * Whether the driver has already satisfied this event, so it can be settled now
 * rather than on the way out.
 *
 * Waiting for the window to close meant every piece of feedback — and every
 * consequence in the world, like a pedestrian only stepping off the curb once
 * the event was scored — arrived after the player had driven past the thing.
 * A requirement that is met is met, so it is settled where it happened.
 *
 * Only success settles early. A failure still needs the whole window, because
 * there is road left in which to put it right.
 */
/**
 * A merge that is over, whatever it was worth.
 *
 * Not the same question as `isSatisfiedEarly`, which asks whether the driver
 * has done the right thing and settles the event as a pass. This asks only
 * whether there is anything left to watch: once the car is in a through lane
 * the manoeuvre has happened, and everything it is graded on — the speed it
 * carried in, the gap it took, how much of the auxiliary lane was left — is
 * already recorded. Grading it here rather than at the window's end is what
 * puts the verdict in front of the traffic the driver has just merged into,
 * instead of behind it.
 */
export const isMergeComplete = (telemetry: EventTelemetry, event: ScenarioEvent): boolean =>
  Boolean(event.merge) && telemetry.merge?.joinedLane != null;

/**
 * How long the car has to have been in a lane before being in it counts as
 * having arrived there, in frames.
 *
 * A third of a second. Long enough that a correction on a bend is not mistaken
 * for a lane change, short enough that a driver who is simply already in the
 * right lane still gets their verdict where they earned it.
 */
const LANE_SETTLE_FRAMES = 20;

/**
 * How far the car has wandered off a held line, as the line counts it: either
 * way, or only toward the side it declares. The grade, the early fail and the
 * driver's line cue all read this one number.
 */
export const lineHoldDrift = (telemetry: EventTelemetry, hold: LineHoldRequirement): number =>
  hold.toward === 'left'
    ? telemetry.maxDriftLeft
    : hold.toward === 'right'
      ? telemetry.maxDriftRight
      : telemetry.maxDrift;

/**
 * A requirement that has already been broken past putting right.
 *
 * The mirror of `isSatisfiedEarly`, and it exists for the same reason: a
 * verdict belongs where the driving happened. Most failures do not qualify —
 * there is road left in which to slow down, move over or come to a stop — but a
 * wander is not one of them. Once the car has left the line by more than the
 * scenario allows, no amount of remaining road un-wanders it, and holding the
 * verdict back only means the driver is still steering when they are told.
 *
 * It is also what keeps the scenario a lesson rather than a trap. The vehicle
 * a wander is measured against is beside the car, so a verdict held to the end
 * of the window can arrive after the contact it was warning about.
 *
 * A forbidden stop is the other one. Once the car has come to rest where it
 * may not stand, driving on does not un-stop it, and a driver who stopped to
 * park would otherwise sit at the hydrant hearing nothing until they left.
 */
export const isFailedEarly = (telemetry: EventTelemetry, event: ScenarioEvent): boolean =>
  (event.lineHold !== undefined && lineHoldDrift(telemetry, event.lineHold) > event.lineHold.maxDrift) ||
  (forbidsStop(event) && telemetry.stoodWhereForbidden);

/**
 * Whether meeting this scenario's requirement at a moment is enough to settle
 * it then - a stop, a slowing, a lane taken - rather than only once the whole
 * window has been driven.
 *
 * A posted speed is a reading taken at the sign: slowing early and speeding
 * back up must not pass. Turns settle when committed, prohibitions only once
 * the whole window has been driven without doing the forbidden thing. A strict
 * lane requirement is the same shape as a prohibition — being back in lane
 * right now says nothing about whether the car crossed out of it earlier in
 * the approach — so it also waits for the full window. A following gap and an
 * overtake are the same shape as a prohibition: what matters is the whole
 * window, not whether it happens to be satisfied now. Coasting is the same
 * shape again: the brake being off right now says nothing about whether it was
 * stood on two hundred units ago, and settling early would hand a pass to the
 * driver who did exactly that.
 *
 * And a bay, for a reason of its own: `gradeEvent` reads `stoppedInBay` and
 * nothing else where one is declared, while the `correctAction === 'stop'`
 * branch of `isSatisfiedEarly` reads `stoppedBeforeLine` — which is true of a
 * car stopped anywhere on the approach, including dead in the travel lane.
 * Settling early would pass the one driver the scenario exists to fail.
 */
export const settlesWhenMet = (event: ScenarioEvent): boolean =>
  !(
    event.type === 'speed_limit' ||
    event.maneuver ||
    event.avoid ||
    event.requiredLane?.strict ||
    event.lineHold ||
    event.coast ||
    event.bay ||
    event.effect?.stuckThrottle ||
    event.following ||
    event.overtake ||
    event.merge
  );

export const isSatisfiedEarly = (
  telemetry: EventTelemetry,
  event: ScenarioEvent,
  level: LevelConfig,
  currentLane: LaneIndex,
  currentSpeed: number,
  inReactionZone: boolean
): boolean => {
  if (!inReactionZone) return false;
  // Nothing here can go wrong, so there is nothing to wait out either.
  if (event.neutral) return true;
  if (!settlesWhenMet(event)) return false;

  const wanted = acceptableLanes(event, level);
  if (wanted && !wanted.includes(currentLane)) return false;
  // And held rather than clipped. See `laneHeldFrames`.
  if (wanted && telemetry.laneHeldFrames < LANE_SETTLE_FRAMES) return false;

  if (event.correctAction === 'stop') return telemetry.stoppedBeforeLine;
  if (event.correctAction === 'brake') {
    return currentSpeed <= speedFor(event, level) * SLOWED_SHARE;
  }
  return false;
};

export interface Grade {
  /** Action to score, in the engine's vocabulary. */
  action: string;
  /** Replaces the event's own penalty text when the lane was the failure. */
  penaltyMessage?: string;
  /**
   * Replaces the event's own reward text, where the praise can name what was
   * actually measured rather than describing a manoeuvre in general terms.
   */
  rewardMessage?: string;
}

/** One decimal place, for quoting a measured gap back to the driver. */
const seconds = (value: number) => `${Math.round(value * 10) / 10}`;

/**
 * How a merge came out.
 *
 * Every failure names the thing that was actually wrong, and the one success is
 * reachable only by a car watched leave the auxiliary lane, into the right
 * lane, at speed, into a gap that was there. The merge this replaced graded a
 * speed at a point and then told the driver they had merged.
 */
const gradeMerge = (
  requirement: NonNullable<ScenarioEvent['merge']>,
  event: ScenarioEvent,
  level: LevelConfig,
  progress: MergeProgress
): Grade => {
  // Never on the lane at all: there was no merge to make, so there is nothing
  // here to grade and the event falls through to its ordinary reading.
  if (!progress.usedAuxiliary) return { action: event.correctAction };

  if (progress.joinedLane === null || progress.auxiliaryShareAtJoin < requirement.completeBy) {
    // Either still on it, or carried off it by the narrowing: both are the
    // merge having happened to the driver rather than been made by them.
    return { action: 'never_merged', penaltyMessage: requirement.neverMergedMessage };
  }
  const wanted = resolveLaneRole(requirement.intoLane, level.paint?.oncomingLanes ?? 0);
  if (progress.joinedLane !== wanted) {
    return { action: 'wrong_lane', penaltyMessage: requirement.neverMergedMessage };
  }
  if (progress.speedAtJoin < requirement.minSpeed) {
    return { action: 'too_slow', penaltyMessage: requirement.tooSlowMessage };
  }
  if (progress.headwayAtJoin < requirement.safeGapSeconds) {
    return { action: 'unsafe_gap', penaltyMessage: requirement.unsafeGapMessage };
  }
  return {
    action: event.correctAction,
    rewardMessage:
      `Correct. You joined at ${Math.round(progress.speedAtJoin)} km/h` +
      (Number.isFinite(progress.headwayAtJoin)
        ? `, ${seconds(progress.headwayAtJoin)} seconds behind the traffic already on the carriageway`
        : ', with the carriageway clear beside you') +
      ', and off the acceleration lane before it ran out.',
  };
};

/**
 * How an overtake came out, read off the phases that were actually seen.
 *
 * Every failure names the phase that was missing, and the one success is only
 * reachable by a car that was watched do all four. That is the whole point of
 * grading the manoeuvre rather than the lane it was in at one instant: the
 * feedback below can be read as a record of what happened.
 */
const gradeOvertake = (
  manoeuvre: NonNullable<ScenarioEvent['overtake']>,
  event: ScenarioEvent,
  progress: OvertakeProgress
): Grade => {
  if (progress.passedElsewhere && !progress.passedInLane) {
    return { action: 'undertake', penaltyMessage: manoeuvre.wrongLaneMessage };
  }
  if (!progress.pulledOut) {
    return { action: 'no_overtake', penaltyMessage: manoeuvre.neverPassedMessage };
  }
  if (progress.cutIn && !progress.returned) {
    return { action: 'cut_in', penaltyMessage: manoeuvre.cutInMessage };
  }
  if (!progress.cleared) {
    return { action: 'incomplete_overtake', penaltyMessage: manoeuvre.neverPassedMessage };
  }
  if (!progress.returned) {
    return { action: 'held_passing_lane', penaltyMessage: manoeuvre.neverReturnedMessage };
  }
  return {
    action: event.correctAction,
    rewardMessage:
      'Correct. You held back until the lane was yours, made the pass in Lane 1, drew clear, and gave the lane straight back.',
  };
};

/**
 * How a following gap came out.
 *
 * A window in which no vehicle was ever ahead cannot be failed — there was no
 * gap to keep — so it falls through to the ordinary grade rather than being
 * scored against a measurement that never happened.
 *
 * Nor can one in which the vehicle was on the road but never followed: the car
 * was in another lane throughout, or already past it. That is a pass, said for
 * what it was. A car that followed it and then changed lanes is graded on the
 * gap it kept while it was behind.
 */
const gradeFollowing = (
  requirement: NonNullable<ScenarioEvent['following']>,
  event: ScenarioEvent,
  telemetry: EventTelemetry
): Grade | null => {
  if (telemetry.headwayFrames === 0) {
    if (telemetry.leadFrames > 0 && telemetry.followedFrames === 0) {
      return {
        action: event.correctAction,
        rewardMessage: 'Correct. You were never behind it in its lane, so there was no following gap to keep.',
      };
    }
    return null;
  }
  if (telemetry.minHeadway < requirement.seconds) {
    return { action: 'too_close', penaltyMessage: requirement.tooCloseMessage };
  }
  return {
    action: event.correctAction,
    rewardMessage:
      `Correct. Your closest gap to the vehicle ahead was ${seconds(telemetry.minHeadway)} seconds, ` +
      `clear of the ${requirement.seconds}-second minimum.`,
  };
};

/**
 * Turns a completed measurement window into the action to score. Lane is
 * checked first: where a sign directs traffic into a lane, being in it is part
 * of obeying the sign, and doing the right thing from the wrong lane still
 * fails.
 */
export const gradeEvent = (
  telemetry: EventTelemetry,
  event: ScenarioEvent,
  level: LevelConfig
): Grade => {
  // A marking that permits without requiring has nothing to fail on: reading
  // it correctly IS proceeding normally, whichever lane and speed that
  // happens to be. Checked first, ahead of the bay/avoid/lane machinery below,
  // since none of it has anything to say about an event nothing can fail.
  if (event.neutral) return { action: event.correctAction };

  // The horn is an act, and a scenario that forbids it is asking about the act.
  // Settled ahead of every measurement below for the reason `deriveAction`
  // gives a discrete act precedence over the speedometer: a driver who leaned
  // on the horn did that whatever the window went on to measure. It has to be
  // here rather than in the `avoid` branch further down, because `deriveAction`
  // only ever names 'honk' where the horn was the *answer* — so a prohibition
  // on it was comparing against an action that could not occur, and a gap or a
  // lane graded first would report a pass over a horn nobody looked at.
  //
  // And only the horn is settled here. The rest of `avoid` still runs in its own
  // branch below, so forbidding the horn never quietly answers the stop, the gap
  // or the lane a scenario is really about.
  if (event.avoid?.includes('honk') && telemetry.honked) return { action: 'honk' };
  const forbidden = event.avoid?.filter(action => action !== 'honk') ?? [];

  // Standing on the brake too fast to stand on it is settled next, and ahead of
  // everything below, for the reason the horn is: it is a pedal that was held,
  // and no later measurement un-holds it. A driver who slammed it at speed and
  // then rolled neatly into the bay has done the one thing the emergency
  // forbids, and the bay branch would have reported that as a pass.
  if (event.coast && telemetry.longestHardBrake > event.coast.maxHeldFrames) {
    return { action: 'braked_hard', penaltyMessage: event.coast.brakedMessage };
  }

  // A jammed throttle is answered by getting it back under control, which is
  // not a speed at a point. A driver who held the brake until the engine let go
  // and then quite correctly built their speed back up would arrive at the
  // measuring point doing the very thing a speed check fails — so the scenario
  // is graded on the recovery it actually asked for.
  if (event.effect?.stuckThrottle) {
    return { action: telemetry.throttleRecovered ? event.correctAction : 'accelerate' };
  }

  const derived = deriveAction(telemetry, event, level);

  // A bay asks one thing: did you pull off the carriageway and stop? Whether
  // that was the right call is carried by `correctAction`, which the sign sets
  // to 'stop' where the bay may be used and 'accelerate' where it may not.
  // Speed and lane have nothing to say about it.
  if (event.bay) {
    return { action: telemetry.stoppedInBay ? 'stop' : 'accelerate' };
  }

  // A manoeuvre refused because the car was carrying too much speed to make it
  // is a speed failure, not an absent turn: the wheel was turned and the road
  // declined it. Named before the lane check, which the driver passed.
  if (event.maneuver?.maxSpeed !== undefined && telemetry.turnRefusedTooFast && !telemetry.turned) {
    return { action: 'too_fast', penaltyMessage: event.maneuver.tooFastMessage };
  }

  // A manoeuvre and a gap are each the whole test where they are declared, and
  // each is read from what was watched happen rather than from where the car
  // ended up, so both are settled ahead of any question of lane or speed.
  // Holding a line is the whole test where it is declared, and it is read from
  // what the car did over the window rather than from where it ended up — so it
  // is settled ahead of any question of lane or speed, like the gap is.
  if (event.lineHold) {
    return lineHoldDrift(telemetry, event.lineHold) > event.lineHold.maxDrift
      ? { action: 'drifted', penaltyMessage: event.lineHold.driftedMessage }
      : { action: event.correctAction };
  }

  if (event.merge) return gradeMerge(event.merge, event, level, telemetry.merge);
  if (event.overtake) return gradeOvertake(event.overtake, event, telemetry.overtake);
  if (event.following) {
    const graded = gradeFollowing(event.following, event, telemetry);
    if (graded) return graded;
  }

  // A prohibition is passed by what you refrained from doing, so it is settled
  // before any question of speed or lane.
  //
  // A prohibition on the brake forbids coming to rest, not easing off: every
  // scenario that declares it (a Give Way with nothing coming, a clear yellow
  // box, an emergency vehicle at a junction) fails the driver who stops, and a
  // driver who slows to look is doing what the sign asks. `derived` also names
  // a braked slow-down `brake`, and on a faster road - the final exam's 60 -
  // that failed an ordinary approach with text about stopping dead.
  if (forbidden.length > 0) {
    const act = derived === 'brake' && !telemetry.stoppedBeforeLine ? event.correctAction : derived;
    return { action: (forbidden as string[]).includes(act) ? act : event.correctAction };
  }

  const wanted = acceptableLanes(event, level);
  if (wanted) {
    // A `strict` requirement is a prohibition on crossing, not a request to
    // arrive somewhere: judging it by `laneAtSign` alone would let a driver
    // cross into the oncoming lane, pass the vehicle, and drift back before
    // the exact marking point, which is the crossing the marking forbids,
    // scored as if it never happened. `minLaneSeen` covers the whole window
    // the crossing could have happened in, not just its last instant.
    const violated = event.requiredLane?.strict
      ? telemetry.minLaneSeen < Math.min(...wanted)
      : !wanted.includes(telemetry.laneAtSign);
    if (violated) {
      const requirement = event.maneuver ?? event.requiredLane;
      return { action: 'wrong_lane', penaltyMessage: requirement?.wrongLaneMessage };
    }
  }

  // Where a sign's whole test is lane position, passing the lane check is
  // passing the sign. Grading it a second time on speed would fail a driver who
  // is exactly where the sign told them to be, and blame their lane for it —
  // telling them the one thing they got right was wrong. Dawdling is already
  // answered by the crawl penalty, which is its own rule.
  if (event.requiredLane && event.correctAction === 'accelerate') {
    return { action: event.correctAction };
  }

  return { action: derived };
};
