// Pure road-distance geometry for the drive's event loop: how far ahead each
// event announces itself, how wide its action zone is, the two limits a
// theta-scaled announcement is held between, and where the UI's approach/react
// band sits. No refs, no canvas, no FSM - given a level's events and the car's
// signed distance to an event, these answer "how big is the window", so the
// loop reads named geometry instead of inlining the arithmetic.
import type { ScenarioEvent } from '@/features/driving-sim/domain/scenario/scenarioDefinition';
import { ACTION_ZONE_ENTER, ACTION_ZONE_EXIT, BAY_RUN_ON, CHECKPOINT_ZONE_ENTER, CHECKPOINT_ZONE_EXIT, REACTION_ZONE_ENTER, WARNING_START_RUNWAY, WARNING_ZONE_ENTER, WARNING_ZONE_MARGIN, applyBrake, } from '@/features/driving-sim/domain/world/vehiclePhysics';
import { unitsForSeconds, type DrivingPace } from '@/features/driving-sim/domain/world/DrivingPace';
import { TUTORIAL_ACTION_ZONE_ENTER, TUTORIAL_ACTION_ZONE_EXIT } from './tutorial';
import { noStandingStretch, type NoStandingStretch } from '@/features/driving-sim/domain/evaluation/eventTelemetry';

/**
 * The announcement distance for each event, keyed by its `triggerAtDistance`.
 *
 * An event's authored `warningDistance` is clamped to the room actually
 * available between it and the previous event (or the start runway for the
 * first), so a warning can never already be open when the level begins or
 * overlap the event before it. Pure over the level's events; the loop reads the
 * result by key.
 */
export const computeWarningDistances = (events: ScenarioEvent[]): Map<number, number> => {
  const ordered = [...events].sort((a, b) => a.triggerAtDistance - b.triggerAtDistance);
  const distances = new Map<number, number>();
  ordered.forEach((event, index) => {
    const previous = ordered[index - 1];
    const boundary = previous ? previous.triggerAtDistance + ACTION_ZONE_EXIT : WARNING_START_RUNWAY;
    const room = event.triggerAtDistance - boundary - WARNING_ZONE_MARGIN;
    distances.set(
      event.triggerAtDistance,
      Math.max(ACTION_ZONE_ENTER, Math.min(event.warningDistance ?? WARNING_ZONE_ENTER, room))
    );
  });
  return distances;
};

/**
 * The most road each event's approach may claim, keyed by its
 * `triggerAtDistance`: back to where the previous event's zone closes, less the
 * margin kept between events, or back to the start runway for the first.
 *
 * The ceiling a widened theta is held under (see `approachLead` in
 * domain/fsm). Measured against each previous event's own exit - a checkpoint's
 * zone stays open 40 units past its line and the tutorial's 90 - rather than
 * the plain 20 `computeWarningDistances` assumes, because this is the limit
 * that has to hold once a window is scaled past what was authored.
 */
export const computeApproachRooms = (events: ScenarioEvent[], isTutorial: boolean): Map<number, number> => {
  const ordered = [...events].sort((a, b) => a.triggerAtDistance - b.triggerAtDistance);
  const rooms = new Map<number, number>();
  ordered.forEach((event, index) => {
    const previous = ordered[index - 1];
    const boundary = previous
      ? previous.triggerAtDistance +
        actionZoneFor({
          isCheckpoint: Boolean(previous.inspection),
          isParking: Boolean(previous.parkingCutscene && previous.bay),
          isTutorial,
          warningDistance: undefined,
          noStanding: noStandingStretch(previous),
        }).exit
      : WARNING_START_RUNWAY;
    rooms.set(event.triggerAtDistance, event.triggerAtDistance - boundary - WARNING_ZONE_MARGIN);
  });
  return rooms;
};

/**
 * The perception-reaction allowance in `stoppingDistanceFrom`, in seconds.
 *
 * A stated assumption, not a measurement. The approach opens with the scenario
 * frozen for reading, so this does not have to cover understanding the scene -
 * only getting from the panel to the pedal, and Space, which releases the
 * panel, is not honoured as the brake until it has been pressed again.
 */
export const PERCEPTION_REACTION_SECONDS = 1;

/**
 * How much road the car needs to come to rest from `speed` on this pace: the
 * perception-reaction allowance driven at that speed, then the brake applied a
 * frame at a time exactly as `driveVehicle` applies it on a dry road.
 *
 * The floor under a road event's narrowed approach (`computeApproachFloors`),
 * taken at the level's own limit: a driver keeping to it always has the road
 * to stop in, whatever window the policy chose.
 */
export const stoppingDistanceFrom = (speed: number, pace: DrivingPace): number => {
  let braking = 0;
  let current = speed;
  while (current > 0) {
    current = applyBrake(current, pace.brakingScale);
    braking += current * pace.distancePerSpeed;
  }
  return unitsForSeconds(PERCEPTION_REACTION_SECONDS, speed, pace) + braking;
};

/**
 * How far short of a roundabout's centre the decision freezes the drive. The
 * give-way line is drawn about 270 units in front of the centre, so freezing
 * here leaves the player stopped just behind it - the decision is put *before*
 * the entry, not after the car is already on the ring.
 */
const ROUNDABOUT_FREEZE_LEAD = 250;

/** How far short of its line any other cutscene freezes the drive to ask. */
const CUTSCENE_FREEZE_LEAD = 10;

/** How far before its trigger a cutscene freezes the drive to put its question. */
export const cutsceneFreezeLead = (event: ScenarioEvent): number =>
  event.scene === 'roundabout' ? ROUNDABOUT_FREEZE_LEAD : CUTSCENE_FREEZE_LEAD;

/**
 * The least road each event's approach may leave, keyed by its
 * `triggerAtDistance`: the floor a narrowed theta is held above (see
 * `approachLead` in domain/fsm). What it is depends on what the zone is for.
 *
 * - A road event needs a stop's worth: `stopping`, from the level's limit.
 * - A cutscene needs that and its freeze point still ahead, so the question is
 *   put where it was designed to be put - before the give-way line, not on the
 *   ring.
 * - Some zones cannot be narrowed at all, and report `Infinity`, which holds
 *   them at their baseline. A checkpoint's or a parking bay's zone is itself
 *   the runway the stop has to happen in, and an overtake's or a merge's is the
 *   runway the whole manoeuvre is driven in - told half-way
 *   through, a driver has already closed on the vehicle they were to pass. The
 *   tutorial's is a fixed teaching zone read off the car as it stands; and a
 *   line hold is lost the moment it is lost, so a verdict held back for a later
 *   announcement would arrive after the contact it was warning about. For
 *   each, driving inside the zone but before a narrowed announcement would be
 *   graded - or crashed - differently from the same driving at theta 1, which
 *   is exactly what theta must not do.
 */
export const computeApproachFloors = (
  events: ScenarioEvent[],
  isTutorial: boolean,
  stopping: number
): Map<number, number> => {
  const floors = new Map<number, number>();
  for (const event of events) {
    const fixed =
      isTutorial ||
      Boolean(event.inspection) ||
      Boolean(event.parkingCutscene && event.bay) ||
      event.overtake !== undefined ||
      event.merge !== undefined ||
      event.lineHold !== undefined;
    floors.set(
      event.triggerAtDistance,
      fixed
        ? Number.POSITIVE_INFINITY
        : event.cutscene
          ? Math.max(stopping, cutsceneFreezeLead(event))
          : stopping
    );
  }
  return floors;
};

export interface ActionZone {
  /**
   * How far before the trigger the event's zone starts. It is the baseline
   * announcement - where the approach opens at theta = 1 - and, whatever theta
   * does to the announcement, where the driving starts being graded.
   */
  enter: number;
  /** How far past the trigger the window stays open before the event is missed. */
  exit: number;
}

export interface ActionZoneContext {
  isCheckpoint: boolean;
  isParking: boolean;
  isTutorial: boolean;
  /** The clamped announcement distance for this event (from computeWarningDistances). */
  warningDistance: number | undefined;
  /**
   * Where the event forbids coming to rest, if anywhere (`noStandingStretch`).
   * The rule reaches past the place, so the zone stays open until the car's
   * tail has cleared it: a car parked level with a hydrant is standing at it.
   */
  noStanding?: NoStandingStretch | null;
}

/**
 * The action-zone width for one event.
 *
 * Checkpoints and parking take the wider checkpoint runway (room to read the
 * space and shed all speed alongside it); the tutorial uses its own gentler
 * zones; every other event uses its clamped warning distance, falling back to
 * the default, and stays open past its point until the car is clear of any
 * stretch where it may not stand.
 */
export const actionZoneFor = (ctx: ActionZoneContext): ActionZone => {
  if (ctx.isCheckpoint || ctx.isParking) return { enter: CHECKPOINT_ZONE_ENTER, exit: CHECKPOINT_ZONE_EXIT };
  if (ctx.isTutorial) return { enter: TUTORIAL_ACTION_ZONE_ENTER, exit: TUTORIAL_ACTION_ZONE_EXIT };
  return {
    enter: ctx.warningDistance ?? ACTION_ZONE_ENTER,
    exit: Math.max(ACTION_ZONE_EXIT, ctx.noStanding?.to ?? 0),
  };
};

/**
 * How far past its point the session grades an event: its zone's exit, except
 * at a roadside bay, which is graded to its far end, `BAY_RUN_ON`.
 *
 * A car can be pulled into a bay's far half and come to rest there. Closed at
 * the plain exit, 20 past the point, the zone graded a driver still rolling
 * into the turnout as never having stopped, and never saw a stop in the far
 * half of a red curb. A parking cutscene is not one of these: it stops the car
 * level with its space and has its own runway.
 *
 * The far end is no further than the road is kept clear after the zone: the
 * next approach may open `WARNING_ZONE_MARGIN` past the exit
 * (`computeApproachRooms`), and one that opened while the bay was still being
 * answered would take the drive from it and leave it ungraded.
 *
 * Only grading reads this. The zone `actionZoneFor` gives, which every room
 * and the simulation read, is unchanged.
 */
export const gradedExitFor = (event: ScenarioEvent, zone: ActionZone): number =>
  event.bay && !event.parkingCutscene ? Math.max(zone.exit, BAY_RUN_ON) : zone.exit;

/** A drive's per-event limits, each keyed by the event's `triggerAtDistance`, measured once per drive. */
export interface ApproachLimits {
  warningDistances: Map<number, number>;
  approachRooms: Map<number, number>;
  approachFloors: Map<number, number>;
}

/** What the approach guard is told about one event: its zone, and the two limits theta is held between. */
export interface ApproachMeasurement {
  zone: ActionZone;
  room: number;
  floor: number;
}

/**
 * One event's measurements, as the world reports them to the machine.
 *
 * The single place they are read off the drive's limits: the frame loop reports
 * them into the FSM's context every frame, and the per-decision record reads
 * the same ones to say what theta did to the event - so the two cannot differ
 * about which lead the guard fired at.
 */
export const approachMeasurement = (
  event: ScenarioEvent,
  limits: ApproachLimits,
  isTutorial: boolean
): ApproachMeasurement => ({
  zone: actionZoneFor({
    isCheckpoint: Boolean(event.inspection),
    // A parking decision needs the same runway a checkpoint does: room to
    // read the space and shed all of your speed alongside it, rather than
    // the brief slice a plain sign gets.
    isParking: Boolean(event.parkingCutscene && event.bay),
    isTutorial,
    warningDistance: limits.warningDistances.get(event.triggerAtDistance),
    noStanding: noStandingStretch(event),
  }),
  room: limits.approachRooms.get(event.triggerAtDistance) ?? Number.POSITIVE_INFINITY,
  floor: limits.approachFloors.get(event.triggerAtDistance) ?? 0,
});

/**
 * Which half of the approach the *UI prompt* is in for one event, from the
 * car's signed distance to it (negative while the event is still ahead).
 *
 * Deliberately distinct from the FSM's REACTION_WINDOW state. This is only the
 * on-screen "Coming Up" vs "React Now" band, governed by REACTION_ZONE_ENTER
 * (120u). The machine opens its REACTION_WINDOW at a much tighter reaction
 * guard (REACTION_COMMIT_LEAD, 10u, scaled by theta) - the graded transition.
 * The two share the word "reaction" but answer different questions: one is
 * presentation, the other is the state change the thesis measures. They are
 * kept as separate numbers on purpose; do not collapse one into the other
 * without deciding which single width both should mean.
 */
export const uiReactionPhase = (diff: number): 'approach' | 'react' =>
  diff >= -REACTION_ZONE_ENTER ? 'react' : 'approach';

/**
 * How close the event is, as 1 (just announced) down to 0 (at the trigger).
 * `lead` is where the approach actually opened - the scaled lead the guard
 * fired at, not the event's baseline window - or the cue would sit at 1 through
 * the first part of a widened approach and start part-way down a narrowed one.
 */
export const approachFraction = (diff: number, lead: number): number =>
  Math.min(1, Math.max(0, -diff) / Math.max(1, lead));
