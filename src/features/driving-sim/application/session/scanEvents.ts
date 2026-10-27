/**
 * The route, scanned: which event the car has reached, and what its input did
 * about it.
 *
 * One pass over the events still unanswered. For each, it reports the
 * measurements the FSM's guards read, lets the machine decide whether the
 * approach opens, and then judges whatever the driver did inside the window —
 * a key, a full stop, a lane, or arriving at a decision the drive freezes for.
 *
 * It decides nothing about how any of that looks. A graded decision leaves here
 * as a `GameEvent` for the host to score.
 */
import type { LevelConfig, ScenarioEvent } from '@/features/driving-sim/domain/scenario/scenarioDefinition';
import type { DrivingFSM } from '@/features/driving-sim/domain/fsm/DrivingFSM';
import type { FSMState } from '@/features/driving-sim/domain/fsm/fsmTypes';
import type { DrivingWorld } from '@/features/driving-sim/domain/world/GameWorld';
import type { GameEvent } from '@/features/driving-sim/domain/world/GameEvent';
import type { InputState } from '@/features/driving-sim/domain/world/InputState';
import {
  CHECKPOINT_STOP_SPEED,
  distanceToScreenY,
  REACTION_ZONE_ENTER,
  isInBay,
  resolveLaneRole,
} from '@/features/driving-sim/domain/world/vehiclePhysics';
import { paceOf } from '@/features/driving-sim/domain/world/DrivingPace';
import {
  CAR_LENGTH,
  auxiliaryAt,
  drivableBounds,
  isOnAuxiliaryLane,
} from '@/features/driving-sim/domain/world/routeGeometry';
import {
  CAR_WIDTH,
  LANE_WIDTH,
  ROAD_WIDTH,
  laneBounds,
} from '@/features/driving-sim/domain/world/vehiclePhysics';
import { junctionExitY } from '@/features/driving-sim/domain/world/junctionGeometry';
import {
  FULL_STOP_SPEED,
  acceptableLanes,
  createTelemetry,
  gradeEvent,
  isMergeComplete,
  isFailedEarly,
  isSatisfiedEarly,
  laneForTurn,
  lineHoldDrift,
  noStandingStretch,
  recordFrame,
  recordTraffic,
} from '@/features/driving-sim/domain/evaluation/eventTelemetry';
import { headwaySeconds, leadLane } from '@/features/driving-sim/domain/systems/roadTraffic';
import { advanceToDecision, canOpenApproach } from '@/features/driving-sim/domain/systems/fsmBridge';
import { approachLead } from '@/features/driving-sim/domain/fsm/approachLead';
import {
  approachFraction,
  approachMeasurement,
  cutsceneFreezeLead,
  gradedExitFor,
  uiReactionPhase,
  type ApproachLimits,
} from '@/features/driving-sim/domain/systems/eventScheduler';
import { getTutorialCompletedAction } from '@/features/driving-sim/domain/systems/tutorial';
import type { DecisionSettlement } from '@/features/driving-sim/domain/evaluation/reactionTiming';
import { RAMP_LENGTH } from '@/features/driving-sim/domain/systems/maneuvers';

/**
 * How close an event must be before the reaction window may open. Reported into
 * the FSM as `TransitionContext.reactionDistance`, where the guard on
 * APPROACHING_EVENT -> REACTION_WINDOW scales it by the learned `reactionScale`.
 */
const REACTION_COMMIT_LEAD = 10;

/**
 * How close to the junction the turn may be committed. Outside this the arrow
 * keys are just steering, so getting into the turning lane never reads as an
 * attempt to turn.
 *
 * Deliberately the same band the UI puts "React Now" up over
 * (`uiReactionPhase`, REACTION_ZONE_ENTER). They used to differ — the cue
 * appeared 120 units out and the turn was only accepted from 90 — and a left
 * turn taken on the cue then failed: the arrow that was meant to commit it
 * steers as well, so pressing it in the 30-unit gap walked the car out of the
 * lane nearest the centre line and the junction refused the turn it had just
 * asked for. A right turn never showed it, because holding right pushes the car
 * *into* the curb lane a right turn is made from. The screen must not tell a
 * driver to act at a point where acting is what fails them, so the commit zone
 * is defined as that cue rather than beside it.
 */
const TURN_COMMIT_ZONE = REACTION_ZONE_ENTER;

/**
 * How close the front of the car has to be to a ramp's own point for the
 * manoeuvre to be available, in road units.
 *
 * One car length either side. Tight enough that "at the marker" means at the
 * marker — the defect this replaced opened the window seven hundred units early
 * and let a held key take it at whichever frame the speed gate cleared — and
 * wide enough to be pressable by hand: at the ramp's 60 km/h ceiling the band is
 * about a second and a quarter of driving, and longer the slower you take it.
 */
const RAMP_COMMIT_TOLERANCE = CAR_LENGTH;

/**
 * The largest gap the readout bothers to distinguish. Past this the vehicle
 * ahead is no longer being followed, and a number that keeps climbing reads as
 * a measurement of nothing.
 */
const MAX_SHOWN_GAP = 9.9;

export interface ScanEventsContext {
  world: DrivingWorld;
  level: LevelConfig;
  fsm: DrivingFSM;
  roadX: number;
  isTutorialLevel: boolean;
  /** Each event's baseline lead and the two limits theta is held between, measured once per drive. */
  limits: ApproachLimits;
  /** Records the decision on the world and reports it, and how it was settled, for the host to grade. */
  decide: (
    events: GameEvent[],
    event: ScenarioEvent,
    action: string,
    settlement: DecisionSettlement
  ) => void;
  isFsmState: (state: FSMState, states: readonly FSMState[]) => boolean;
}

/**
 * The scripted run a committed turn hands over to.
 *
 * One construction, because a junction turn and an expressway exit are the same
 * manoeuvre with different numbers: the car swings out, the road hands over,
 * and it is set down on what it turned onto.
 */
const beginTurn = (
  event: ScenarioEvent,
  maneuver: NonNullable<ScenarioEvent['maneuver']>,
  turning: 'left' | 'right',
  car: DrivingWorld['car'],
  level: LevelConfig
): NonNullable<DrivingWorld['turn']> => ({
  dir: turning === 'left' ? -1 : 1,
  startedAt: performance.now(),
  fromX: car.x,
  fromY: car.y,
  // The half of the cross street you are entitled to, not its middle. Turning
  // onto the centre row drove the car along the line dividing the road's two
  // directions of travel.
  crossStreetY: junctionExitY(
    distanceToScreenY(event.triggerAtDistance, car.distance),
    turning
  ),
  exitDistance: event.triggerAtDistance + (maneuver.handOffAfter ?? 80),
  ...(maneuver.exitLane
    ? { exitLane: resolveLaneRole(maneuver.exitLane, level.paint?.oncomingLanes ?? 0) }
    : {}),
});

export const scanEvents = (input: InputState, context: ScanEventsContext): GameEvent[] => {
  const events: GameEvent[] = [];
  const {
    world,
    level,
    fsm,
    roadX,
    isTutorialLevel,
    limits,
    decide,
    isFsmState,
  } = context;
  const car = world.car;

  // A press this frame that was not down last frame. Captured once, before the
  // loop, and cleared once after it: a manoeuvre that asks for a fresh press
  // must see the same answer whichever event asks.
  const freshSteer = {
    left: input.left && !world.prevSteer.left,
    right: input.right && !world.prevSteer.right,
  };

  /**
   * Grades one event from what the car actually did, and hands down the
   * verdict. The single place a measured event is scored: the window closing
   * and a requirement already lost are two reasons to reach the same point,
   * and a second copy of this is a second set of rules.
   */
  const gradeNow = (event: ScenarioEvent, settlement: DecisionSettlement) => {
    world.playerActed = true;
    world.laneCue = null;
    world.requiredLanes = [];
    world.gapCue = null;
    world.bayCue = null;
    world.holdCue = null;
    world.coastCue = null;
    world.throttleCue = null;
    const telemetry = world.telemetry ?? createTelemetry(car.speed, car.lane, car.x - roadX);
    const grade = gradeEvent(telemetry, event, level);
    // Either message may be replaced by what was actually measured — the lane
    // that failed, the phase of an overtake that never happened, the gap that
    // was held. The event's own text is the fallback, not the last word.
    decide(
      events,
      grade.penaltyMessage || grade.rewardMessage
        ? {
            ...event,
            ...(grade.penaltyMessage ? { penaltyMessage: grade.penaltyMessage } : {}),
            ...(grade.rewardMessage ? { rewardMessage: grade.rewardMessage } : {}),
          }
        : event,
      grade.action,
      settlement
    );
  };

  for (const event of world.events) {
    if (world.handled.has(event.triggerAtDistance)) continue;
    const diff = car.distance - event.triggerAtDistance;
    const isCheckpoint = Boolean(event.inspection);
    const isParking = Boolean(event.parkingCutscene && event.bay);
    const measured = approachMeasurement(event, limits, isTutorialLevel);
    const { enter: actionZoneEnter, exit: actionZoneExit } = measured.zone;
    const gradedExit = gradedExitFor(event, measured.zone);
    const noStanding = noStandingStretch(event);

    // Report this event's measurements into the machine. The FSM's guards read
    // them; nothing here decides anything. The distance test lives on the edge
    // itself as `withinApproachWindow` (domain/fsm/DrivingFSM), scaled by the
    // learned theta and held between the floor and the room back to the
    // previous event, so the transition relation owns when the machine advances
    // and this loop only measures.
    fsm.updateContext({
      distanceToEvent: diff,
      warningDistance: actionZoneEnter,
      approachRoom: measured.room,
      approachFloor: measured.floor,
      reactionDistance: REACTION_COMMIT_LEAD,
    });

    // The stretch of road this event is graded over: from its baseline lead to
    // its exit. Fixed on the road, whatever theta did to the approach - theta
    // moves where the pause and the reaction clock start, never which driving
    // counts - so the same driving earns the same grade at every setting.
    // A bay is graded on into its far half (`gradedExitFor`).
    const inZone = diff >= -actionZoneEnter && diff < gradedExit;

    // The FSM's verdict is what starts the event. `transition` returns
    // whether the guard let it through, and that - not a distance test here
    // - is the signal to open the approach.
    //
    // Offered only from a state an approach can actually open from. The
    // approach edges leave IDLE and DRIVING, which are exactly the states with
    // no event in progress; inside an event, `scenario_trigger` means something
    // else entirely (the unguarded step to DECISION). Without this check, an
    // event *typed* `scenario_trigger` took that second meaning and reported
    // success from thousands of units away: on Level 5 the roundabout at 6100
    // stole the active event at 1493 while the crossing at 1500 was still being
    // answered, abandoning that crossing ungraded and leaving the machine in
    // DECISION - where nothing between them could open an approach either. Five
    // of that level's eight events never fired.
    if (
      world.activeEvent !== event &&
      diff < actionZoneExit &&
      canOpenApproach(fsm) &&
      fsm.transition(event.type)
    ) {
      world.activeEvent = event;
      world.playerActed = false;
      // Opening the approach decides whose zone is being measured, not when the
      // measuring starts (below). Anything still measured for an event that
      // never became active is dropped rather than graded against this one.
      if (world.measuredEvent !== event) {
        world.measuredEvent = null;
        world.telemetry = null;
      }

      // Read before it is driven. Held once, here, at the moment the scenario
      // becomes the active one — so the reading is untimed and the response is
      // measured from the release. At theta 1 the whole zone is still ahead;
      // narrowed, the pause lands inside it, but never with less road left
      // than the floor allows. Never for the decisions that already stop the world
      // behind a question of their own, and never for the tutorial, whose
      // whole content is the instruction panel it would be covering.
      if (
        !isTutorialLevel &&
        !isCheckpoint &&
        !isParking &&
        !event.cutscene &&
        !world.briefingEvent &&
        !world.briefed.has(event.id)
      ) {
        world.briefed.add(event.id);
        world.briefingEvent = event;
      }
    }

    // The zone, measured. It opens the first frame the car is inside it with no
    // other event being answered, whether or not this event's approach has
    // opened: a narrowed approach opens inside a zone already being measured,
    // and a widened one is active for a stretch before its zone begins.
    if (
      inZone &&
      !world.measuredEvent &&
      (!world.activeEvent || world.activeEvent === event)
    ) {
      world.measuredEvent = event;
      world.telemetry = createTelemetry(car.speed, car.lane, car.x - roadX);
    }

    const measuring = world.measuredEvent === event;
    const lead = measuring || world.activeEvent === event ? world.traffic.get(event.id) : undefined;
    // On the level's own pace, or a gap measured on the shared scale would be
    // a different number of seconds from the one the traffic was placed at.
    const headway = headwaySeconds(car.distance, car.speed, lead, paceOf(level));
    // Ahead of the car and in its lane, the lane the scene draws it in: the
    // car is following it. What a following gap is kept to.
    const followed =
      lead !== undefined &&
      event.npc !== undefined &&
      lead.distance > car.distance &&
      car.lane === leadLane(event.npc, lead, level.paint?.oncomingLanes ?? 0, car.lane);

    if (measuring && inZone) {
      // Every frame inside the zone is folded into the record that will grade
      // this event, so slowing down counts whether it came from the brake or
      // from simply lifting off.
      if (world.telemetry) {
        recordFrame(
          world.telemetry,
          car.speed,
          car.lane,
          diff >= 0,
          input.horn,
          Boolean(event.bay) && isInBay(car.x, roadX, event.bay!.side),
          input.brake,
          // Across the road rather than across the screen: a bend carries the
          // whole carriageway sideways, and a driver holding their lane
          // through one has not wandered out of it.
          car.x - roadX,
          // And whether this frame's brake is one the scenario forbids: held
          // while the car is still too fast to hold it. Computed here, where
          // the event is, for the same reason the bay test is.
          Boolean(event.coast) && input.brake && car.speed > event.coast!.brakeBelow,
          // And whether a jammed throttle has let go, which the world owns.
          Boolean(event.effect?.stuckThrottle) && world.throttleFreed,
          // And whether the car is where this scenario forbids it to stand.
          noStanding !== null && diff >= noStanding.from && diff < noStanding.to
        );
        // The same frame, read against the traffic this event is about: how
        // close in time, and how far through an overtake.
        recordTraffic(world.telemetry, event, level, {
          lane: car.lane,
          speed: car.speed,
          headway,
          gapToLead: lead ? car.distance - lead.distance : null,
          followed,
          onAuxiliary: isOnAuxiliaryLane(car.x, roadX),
          auxiliaryShare: (auxiliaryAt(car.distance, level.route)?.width ?? 0) / LANE_WIDTH,
        });
      }
    }

    // Driven through without its approach ever opening: there is no decision
    // to grade the measurement against, so it is let go for the next event.
    if (measuring && diff >= actionZoneExit && world.activeEvent !== event) {
      world.measuredEvent = null;
      world.telemetry = null;
    }

    if (world.activeEvent === event && diff < actionZoneExit) {
      // The gap, as a number the driver can act on. A rule measured every frame
      // and never shown is a rule they can only find out about afterwards.
      // Shown only while it is being measured: from another lane there is no
      // gap to the vehicle, and a number would say there was.
      if (event.following && followed) {
        const shown = Math.round(Math.min(headway, MAX_SHOWN_GAP) * 10) / 10;
        const safe = headway >= event.following.seconds;
        if (!world.gapCue || world.gapCue.seconds !== shown || world.gapCue.safe !== safe) {
          world.gapCue = { seconds: shown, safe };
        }
      } else if (world.gapCue) {
        world.gapCue = null;
      }

      // Whether the car is off the road yet, for the same reason the gap and
      // the wander are shown. This one is the whole grade where it applies —
      // `gradeEvent` reads `stoppedInBay` and nothing else — so a driver who
      // cannot see it is a driver who finds out by failing.
      if (event.bay) {
        const inBay = isInBay(car.x, roadX, event.bay.side);
        const stopped = inBay && car.speed <= FULL_STOP_SPEED;
        if (!world.bayCue || world.bayCue.inBay !== inBay || world.bayCue.stopped !== stopped) {
          world.bayCue = { inBay, stopped, side: event.bay.side };
        }
      } else if (world.bayCue) {
        world.bayCue = null;
      }

      // The wander, as a number the driver can act on, for the same reason the
      // gap is shown: a requirement measured every frame and never displayed is
      // one they can only find out about after failing it.
      if (event.lineHold && world.telemetry) {
        const drift = Math.round(lineHoldDrift(world.telemetry, event.lineHold));
        const steady = drift <= event.lineHold.maxDrift;
        if (!world.holdCue || world.holdCue.drift !== drift || world.holdCue.steady !== steady) {
          world.holdCue = { drift, steady };
        }
      } else if (world.holdCue) {
        world.holdCue = null;
      }

      // Whether the brake is safe to press yet. The one cue that also reports a
      // requirement already lost: this is graded on a single press, so a driver
      // who has made it needs to be told, rather than left driving a scenario
      // that has already been decided against them.
      if (event.coast && world.telemetry) {
        const brakeBelow = event.coast.brakeBelow;
        const safeToBrake = car.speed <= brakeBelow;
        const lost = world.telemetry.longestHardBrake > event.coast.maxHeldFrames;
        if (
          !world.coastCue ||
          world.coastCue.safeToBrake !== safeToBrake ||
          world.coastCue.lost !== lost ||
          world.coastCue.brakeBelow !== brakeBelow
        ) {
          world.coastCue = { safeToBrake, brakeBelow, lost };
        }
      } else if (world.coastCue) {
        world.coastCue = null;
      }

      // A jammed throttle, as something the driver can read. The only failure
      // in the game with no sprite and no sound: without this the car simply
      // accelerates, which is indistinguishable from a bug.
      if (event.effect?.stuckThrottle && world.activeEvent === event) {
        const phase: NonNullable<typeof world.throttleCue>['phase'] = world.throttleFreed
          ? 'freed'
          : input.brake
            ? 'braking'
            : 'stuck';
        const dropping = car.speed < world.speedAtFrameStart - 0.01;
        if (!world.throttleCue || world.throttleCue.phase !== phase || world.throttleCue.dropping !== dropping) {
          world.throttleCue = { phase, dropping };
        }
      } else if (world.throttleCue) {
        world.throttleCue = null;
      }

      // Quiet heads-up while it is still ahead; urgent once it is close.
      // This is the UI band (REACTION_ZONE_ENTER), not the FSM's tighter
      // REACTION_WINDOW guard - see uiReactionPhase in eventScheduler.ts.
      const phase = uiReactionPhase(diff);
      if (world.eventPhase !== phase) {
        world.eventPhase = phase;
        world.eventPhase = phase;
      }
      // Measured against the lead the approach actually opened at, which the
      // guard computes the same way - not the baseline window theta scaled.
      world.eventApproach = approachFraction(
        diff,
        approachLead(fsm.getContext(), fsm.getTransitionParams())
      );

      // Tell the player which lane the sign needs while there is still road
      // left to change lanes in, so lane position is taught rather than
      // sprung on them at the junction.
      const laneReq = event.maneuver ?? event.requiredLane;
      const wanted = acceptableLanes(event, level);
      if (laneReq && wanted) {
        const inLane = wanted.includes(car.lane);
        // Kept identity-stable while the answer is unchanged, so the screen
        // is not re-rendered every frame of a long approach.
        const sameLanes =
          world.requiredLanes.length === wanted.length &&
          world.requiredLanes.every((lane, i) => lane === wanted[i]);
        if (!sameLanes) world.requiredLanes = wanted;
        if (!world.laneCue || world.laneCue.inLane !== inLane || world.laneCue.hint !== laneReq.hint) {
          world.laneCue = { hint: laneReq.hint, inLane };
        }
      }
    }

    if (
      world.activeEvent === event &&
      isFsmState(fsm.getState(), ['APPROACHING_EVENT']) &&
      diff < actionZoneExit
    ) {
      // Same shape as the approach above: the commit-lead test is
      // `withinReactionWindow` on the transition, not a condition here. If the
      // guard declines, the machine stays in APPROACHING_EVENT and the
      // follow-up trigger would be rejected anyway.
      if (fsm.transition('scenario_trigger')) fsm.transition(event.type);
    }

    // A right-of-way judgment call that cannot be timed fairly through
    // raw accelerate/brake/lane input: the moment it arrives, the sim
    // freezes and hands the decision to a full-screen prompt instead of
    // opening a reaction window. Fires regardless of the player's speed —
    // the scenario itself is what pauses the drive, not a stop the player
    // had to find on their own.
    // A roundabout freezes well before its centre so the decision is put at
    // the give-way line, before the player is on the ring; every other
    // cutscene freezes as it arrives.
    if (
      event.cutscene &&
      world.activeEvent === event &&
      !world.playerActed &&
      diff >= -cutsceneFreezeLead(event)
    ) {
      world.playerActed = true;
      world.paused = true;
      world.cutsceneEvent = event;
      world.rightOfWayPlayed = false;
      world.rightOfWay = null;
      world.laneCue = null;
      world.requiredLanes = [];
      advanceToDecision(fsm);
    }

    if (
      isTutorialLevel &&
      world.activeEvent === event &&
      !world.playerActed &&
      diff >= -actionZoneEnter
    ) {
      const action = getTutorialCompletedAction(event, car, roadX);
      if (action) {
        world.playerActed = true;
        decide(events, event, action, 'guided');
      }
    }

    // Checkpoint: coming to a full stop inside the zone opens the inspection.
    // Knowledge, not the brake key, decides the outcome from here. Flagged down
    // by an enforcer, the stop is a pull-over to the extreme right, so only a
    // stop in the curb lane opens it; one anywhere else waits on the driver
    // moving over, or is driven through and graded as not made.
    const pulledOver =
      !event.inspection?.pullOver ||
      car.lane === resolveLaneRole('curb', level.paint?.oncomingLanes ?? 0);
    if (
      isCheckpoint &&
      world.activeEvent === event &&
      !world.playerActed &&
      diff >= -actionZoneEnter &&
      car.speed <= CHECKPOINT_STOP_SPEED &&
      pulledOver
    ) {
      car.speed = 0;
      world.playerActed = true;
      world.paused = true;
      world.inspectionEvent = event;

      // Land on DECISION so the answer is logged from the right state.
      advanceToDecision(fsm);
    }

    // Parking decision: unlike a plain cutscene, this waits for the driving
    // to actually happen. Bringing the car to a halt on the carriageway
    // alongside the space is itself the first step of the manoeuvre the
    // module teaches, and until the driver has done it there is nothing to
    // ask — the question is which technique gets you in *from here*, and
    // "here" has to exist first.
    //
    // Deliberately not gated on already being inside the bay: how you got
    // into the space is the entire subject of the question, so requiring
    // the player to be in it first would ask about a manoeuvre they had
    // already made off-screen.
    if (
      isParking &&
      world.activeEvent === event &&
      !world.playerActed &&
      car.speed <= CHECKPOINT_STOP_SPEED &&
      diff >= -REACTION_ZONE_ENTER
    ) {
      car.speed = 0;
      // Settle the car exactly level with the space. Wherever in the window
      // the driver actually stopped, the bay only opens the curb line from
      // BAY_SPAN before its own point to BAY_RUN_ON past it, so a car parked
      // from further out would finish the manoeuvre beyond anywhere the bounds allow and
      // be pushed straight back out of the space on release. The world is
      // freezing on this same frame, so the correction reads as the car
      // coming to rest rather than as a jump.
      car.distance = event.triggerAtDistance;
      world.playerActed = true;
      world.paused = true;
      world.cutsceneEvent = event;
      world.laneCue = null;
      world.requiredLanes = [];

      advanceToDecision(fsm);
    }

    // Turn: judged on where the car is, not on which key was pressed. The
    // arrow only commits a turn you already put yourself in position for,
    // so "you cannot turn left from the right lane" is enforced by the
    // road rather than by a question about it.
    // Where the manoeuvre may be taken. A junction is a band before the point;
    // a ramp is the point itself, measured at the car's front bumper and
    // reached with a fresh press rather than a held key.
    const maneuverAnchor = event.maneuver?.commitAt;
    const atCommitPoint =
      maneuverAnchor === undefined
        ? diff >= -(event.maneuver?.commitFrom ?? TURN_COMMIT_ZONE) && diff < actionZoneExit
        : Math.abs(car.distance + CAR_LENGTH / 2 - maneuverAnchor) <= RAMP_COMMIT_TOLERANCE;

    if (
      !isTutorialLevel &&
      event.maneuver &&
      world.activeEvent === event &&
      !world.playerActed &&
      atCommitPoint
    ) {
      const maneuver = event.maneuver;
      const mayGoLeft = maneuver.direction === 'left' || maneuver.direction === 'either';
      const mayGoRight = maneuver.direction === 'right' || maneuver.direction === 'either';
      // A ramp wants the press itself; a junction accepts the wheel being held
      // through it, which is how every turn in the game has always been taken.
      const steer = maneuverAnchor === undefined ? input : freshSteer;
      const pressedLeft = steer.left;
      const pressedRight = steer.right;
      const turning: 'left' | 'right' | null =
        mayGoLeft && pressedLeft ? 'left'
        : mayGoRight && pressedRight ? 'right'
        : null;

      // Only a car already in the lane for that turn can take it, and only at a
      // speed it can be taken at. From anywhere else, or too fast, the wheel
      // does nothing here and the point is driven straight through — which is
      // what the wrong lane and the wrong speed cost you.
      const inLane = turning && car.lane === laneForTurn(maneuver, turning, level);
      const tooFast = maneuver.maxSpeed !== undefined && car.speed > maneuver.maxSpeed;
      // The refusal is recorded for any attempt, held or fresh: a driver
      // leaning on the wheel at the marker is trying to take the exit, and
      // being told they were carrying too much speed for it is the point of the
      // scenario. Only the *commit* needs a press of its own.
      const attempting =
        (mayGoLeft && input.left) || (mayGoRight && input.right);
      const inLaneForAttempt =
        attempting &&
        car.lane === laneForTurn(maneuver, mayGoRight && input.right ? 'right' : 'left', level);
      if (inLaneForAttempt && tooFast && world.telemetry) {
        world.telemetry.turnRefusedTooFast = true;
      }

      if (turning && inLane && !tooFast) {
        world.playerActed = true;
        world.laneCue = null;
        world.requiredLanes = [];
        if (world.telemetry) {
          world.telemetry.turned = turning;
          world.telemetry.laneAtSign = car.lane;
        }
        decide(
          events,
          event,
          maneuver.direction === 'either' ? event.correctAction : `turn_${turning}`,
          'response'
        );
        if (maneuver.style === 'ramp') {
          // An exit is not a corner. The road keeps coming, the car keeps being
          // driven, and the wheel is taken over only long enough to cross onto
          // the ramp's own line — which is the auxiliary lane the route already
          // opened beside the carriageway for exactly this.
          // The ramp's own line is the far edge of what can be driven on here,
          // taken from the same `drivableBounds` the wheel is clamped by — so
          // the manoeuvre finishes exactly where the road stops rather than a
          // few pixels past it, where the curb push would drag it back every
          // frame. And never left of where the car already is: aiming at the
          // lane's centre pulled a driver who had properly put themselves out
          // on the deceleration lane back towards the carriageway.
          // Measured where the manoeuvre finishes, not where it starts: the
          // ramp opens at the gore and widens as the roads part, so its line at
          // the commit point is barely off the carriageway.
          const rampLine = drivableBounds(
            laneBounds(roadX, 1, 'centre'),
            roadX + ROAD_WIDTH + LANE_WIDTH,
            car.distance + RAMP_LENGTH,
            level.route,
            roadX,
            CAR_WIDTH / 2
          ).max;
          world.ramp = {
            fromDistance: car.distance,
            fromX: car.x,
            toX: Math.max(car.x, rampLine),
          };
        } else {
          world.turn = beginTurn(event, maneuver, turning, car, level);
        }
      }
    }

    // And settled the moment it is lost, where the loss is one nothing later
    // can undo. Same reasoning as the branch below, from the other side: the
    // verdict belongs on the frame the driving earned it.
    if (
      !isTutorialLevel &&
      !isCheckpoint &&
      !event.cutscene &&
      !isParking &&
      !world.playerActed &&
      world.activeEvent === event &&
      world.telemetry &&
      isFailedEarly(world.telemetry, event)
    ) {
      gradeNow(event, 'lapse');
    }

    // Settled the moment the driver satisfies it, so feedback lands where
    // the decision was made and the world can react to it there too — a
    // pedestrian steps off the curb because you stopped, not because the
    // scoring window happened to close.
    if (
      !isTutorialLevel &&
      !isCheckpoint &&
      !event.cutscene &&
      !isParking &&
      !world.playerActed &&
      world.activeEvent === event &&
      world.telemetry &&
      isSatisfiedEarly(
        world.telemetry,
        event,
        level,
        car.lane,
        car.speed,
        diff >= -REACTION_ZONE_ENTER
      )
    ) {
      world.playerActed = true;
      world.laneCue = null;
      world.requiredLanes = [];
      decide(events, event, event.correctAction, 'response');
    }

    // A road that leaves here leaves here. A driver who never committed is
    // carried off it, graded on not having set up for it — which is honest
    // about both halves: the manoeuvre was theirs to make and the road was
    // always going this way.
    //
    // Only a junction needs an animation for that, because only a junction is a
    // corner the car would otherwise drive straight past. A ramp is already the
    // road: the route's own segments carry an uncommitted driver onto the
    // approach, and playing the committed manoeuvre for them would be showing
    // the same picture for doing it and for failing to.
    if (
      !isTutorialLevel &&
      event.maneuver?.mandatory &&
      event.maneuver.style !== 'ramp' &&
      world.activeEvent === event &&
      !world.turn &&
      diff >= 0 &&
      !world.telemetry?.turned
    ) {
      const direction = event.maneuver.direction === 'left' ? 'left' : 'right';
      world.turn = beginTurn(event, event.maneuver, direction, car, level);
    }

    // Anything still unresolved is graded once, when the car leaves the
    // measurement window, from what the vehicle actually did in it.
    // A merge is graded where it happens rather than where its window ends -
    // and where it happens is the driver's own act.
    const merged = world.telemetry ? isMergeComplete(world.telemetry, event) : false;
    if (
      !isTutorialLevel &&
      !isCheckpoint &&
      (diff >= gradedExit || merged) &&
      !world.playerActed &&
      world.activeEvent === event
    ) {
      gradeNow(event, merged ? 'response' : 'expired');
    }

    // The tutorial and checkpoints keep their own completion rules, so they
    // still need the plain zone-exit fallback.
    if (
      (isTutorialLevel || isCheckpoint) &&
      diff >= actionZoneExit &&
      !world.playerActed &&
      world.activeEvent === event
    ) {
      world.playerActed = true;
      // A traffic stop driven through is told what it missed - the pull-over -
      // rather than the penalty for a question the driver was never asked.
      const missed = event.inspection?.pullOver?.missedMessage;
      decide(
        events,
        missed ? { ...event, penaltyMessage: missed } : event,
        event.correctAction === 'accelerate' ? 'brake' : 'accelerate',
        isTutorialLevel ? 'guided' : 'expired'
      );
    }
  }


  // Carried to the next frame, after every event has had its answer, so the
  // edge is the player's press rather than the order the events were scanned in.
  world.prevSteer = { left: input.left, right: input.right };

  return events;
};
