/**
 * The two manoeuvres the car performs by itself, as pure motion.
 *
 * A turn through a junction and a park into a bay are the only times the
 * vehicle moves without the player driving it: input, events and collisions
 * are all suspended, and the car follows a scripted path to a known finish.
 * That makes them the most cleanly separable part of the frame loop — given a
 * manoeuvre and how long it has been running, the car's pose is a function,
 * with no state to thread and nothing to read from the world.
 *
 * They lived inline in `useDrivingSimulation`'s effect, where the arithmetic
 * sat between a `drawRoad` call and a `requestAnimationFrame`. Here they can
 * be read, reasoned about and (unlike anything that touches a canvas) tested.
 */
import { CANVAS_WIDTH, type LaneIndex } from '@/features/driving-sim/domain/world/vehiclePhysics';

/** Where the car is and which way it is pointing, part-way through a manoeuvre. */
export interface CarPose {
  x: number;
  y: number;
  heading: number;
}

/** A manoeuvre's progress, 0..1, clamped. */
const progressOf = (elapsedMs: number, durationMs: number) =>
  Math.min(1, Math.max(0, elapsedMs / durationMs));

/** Smoothstep: eases in and out, so a manoeuvre starts and finishes gently. */
const smooth = (t: number) => t * t * (3 - 2 * t);

/** Eases a sub-range of a 0..1 clock into its own 0..1, so legs can be sequenced. */
const beat = (t: number, from: number, to: number) =>
  Math.min(Math.max((t - from) / (to - from), 0), 1);

const lerp = (a: number, b: number, share: number) => a + (b - a) * share;

/* ------------------------------------------------------------------------- *
 * Turning through a junction
 * ------------------------------------------------------------------------- */

/** How long the car takes to swing through a turn before the road hands over. */
export const TURN_DURATION_MS = 850;

export interface TurnManeuverState {
  dir: 1 | -1;
  startedAt: number;
  fromX: number;
  fromY: number;
  /** Screen row of the cross street's centre, which the turn arcs onto. */
  crossStreetY: number;
  exitDistance: number;
  /** The lane the road hands over into, where the manoeuvre named one. */
  exitLane?: LaneIndex;
}

/**
 * The car's pose part-way through a turn.
 *
 * A quadratic bezier: forward first, into the cross street's own asphalt, and
 * only then out along it. Sliding straight sideways from where the car was
 * standing took it over the curb and onto the grass, because the junction is
 * ahead of the stop line, not beside it.
 *
 * The heading is taken from the tangent of that curve rather than swept
 * linearly, so the nose leads the turn the way a real vehicle's would.
 */
export const turnPose = (turn: TurnManeuverState, elapsedMs: number): CarPose & { done: boolean } => {
  const progress = progressOf(elapsedMs, TURN_DURATION_MS);
  const eased = smooth(progress);

  const controlX = turn.fromX;
  const controlY = turn.crossStreetY;
  const endX = turn.fromX + turn.dir * (CANVAS_WIDTH / 2 + 90);
  const endY = turn.crossStreetY;
  const inverse = 1 - eased;

  const x = inverse * inverse * turn.fromX + 2 * inverse * eased * controlX + eased * eased * endX;
  const y = inverse * inverse * turn.fromY + 2 * inverse * eased * controlY + eased * eased * endY;

  const tangentX = 2 * inverse * (controlX - turn.fromX) + 2 * eased * (endX - controlX);
  const tangentY = 2 * inverse * (controlY - turn.fromY) + 2 * eased * (endY - controlY);

  return { x, y, heading: Math.atan2(tangentY, tangentX) + Math.PI / 2, done: progress >= 1 };
};

/* ------------------------------------------------------------------------- *
 * Leaving an expressway by its ramp
 * ------------------------------------------------------------------------- */

/**
 * How much road the divergence takes, in route units.
 *
 * A length rather than a duration, because a ramp is built as a length: the
 * tarmac peels away over a fixed distance and a driver taking it slowly follows
 * the same line as one taking it quickly, just for longer. Timing it instead
 * made the angle a function of speed — a careful driver at 45 km/h swerved
 * across at nearly twice the lean of one at the ceiling.
 */
export const RAMP_LENGTH = 420;

export interface RampManeuverState {
  /** The point of the route the manoeuvre was committed at. */
  fromDistance: number;
  /** Where the car was when it committed. */
  fromX: number;
  /** The ramp's own line, which is where it ends up. */
  toX: number;
}

/**
 * The car's pose part-way onto an exit ramp.
 *
 * Nothing about this is a junction turn, and that is the whole point. A junction
 * turn freezes the road, swings the car through ninety degrees and throws it off
 * the side of the frame, then sets it down somewhere else — correct for a street
 * corner and wrong for every expressway exit ever built. Reused here it put the
 * car off the canvas for five frames, jumped the route seven hundred units, and
 * landed it at a lane centre it had not driven to.
 *
 * A ramp instead is: the road keeps moving, the car keeps being driven, and it
 * drifts across onto the ramp's own line over a second and a half. The lean
 * comes from how fast it is crossing against how fast it is going forward, so it
 * peaks in the middle of the move and is gone by the end — a few degrees, not
 * ninety, and the car is pointing down the ramp the whole way.
 *
 * Both axes are counted in road units — a lateral pixel is a unit of road the
 * same way a longitudinal one is — because the projection compresses the length
 * of the road against its width, and an angle taken off the screen would report
 * a gentle lane change as a forty-degree swerve.
 */
export const rampPose = (
  ramp: RampManeuverState,
  distance: number
): CarPose & { done: boolean } => {
  const progress = progressOf(distance - ramp.fromDistance, RAMP_LENGTH);
  const eased = smooth(progress);
  const across = ramp.toX - ramp.fromX;

  // d/ds of smoothstep, so the lateral rate is the curve's own — and because
  // both axes are now road units, the angle is the one the tarmac makes.
  const rate = 6 * progress * (1 - progress);
  const lateralPerUnit = (across * rate) / RAMP_LENGTH;

  return {
    x: lerp(ramp.fromX, ramp.toX, eased),
    // The row never changes: the car is being driven, not repositioned.
    y: 0,
    heading: Math.atan(lateralPerUnit),
    done: progress >= 1,
  };
};

/* ------------------------------------------------------------------------- *
 * Parking into a bay
 * ------------------------------------------------------------------------- */

/**
 * How long the parking manoeuvre takes to play out once the technique has been
 * chosen. Longer than a turn because it is three legs rather than one arc, and
 * because it is being watched rather than driven.
 */
export const PARK_DURATION_MS = 2600;

export interface ParkManeuverState {
  /** True for the manoeuvre the module teaches; false for what the wrong answer looks like. */
  good: boolean;
  side: 'left' | 'right';
  startedAt: number;
  fromX: number;
  fromY: number;
  /** Point on the route the space sits at, so its screen row can be found. */
  bayDistance: number;
}

/** Where the space is on screen this frame. The road is frozen, so it is constant. */
export interface BayPosition {
  x: number;
  y: number;
}

/**
 * The car's pose part-way through the chosen parking technique.
 *
 * `good` is the reverse the module teaches, in its three legs: draw level with
 * the space and a little past it, reverse in on an arc so the tail leads into
 * the gap, then straighten against the curb. The nose swings away from the
 * curb as the tail swings into it, which is the whole shape of a reverse.
 *
 * The other is cutting straight in from the lane: the nose goes for the curb,
 * the tail never follows, and the car ends across the space with its back end
 * still out in the traffic lane. It stops short of the bay centre rather than
 * beyond it — the point is that the car never gets fully into the space.
 */
export const parkPose = (
  park: ParkManeuverState,
  elapsedMs: number,
  bay: BayPosition
): CarPose & { done: boolean } => {
  const progress = progressOf(elapsedMs, PARK_DURATION_MS);
  // Positive puts the space to the right of the carriageway, so one set of
  // arithmetic serves a bay on either side.
  const outward = park.side === 'right' ? 1 : -1;
  const done = progress >= 1;

  if (park.good) {
    const draw = beat(progress, 0, 0.34);
    const reverse = beat(progress, 0.34, 0.8);
    const straighten = beat(progress, 0.8, 1);

    if (straighten > 0) {
      return {
        x: lerp(bay.x - outward * 10, bay.x, straighten),
        y: lerp(bay.y - 10, bay.y, straighten),
        heading: lerp(-outward * 0.5, 0, straighten),
        done,
      };
    }
    if (reverse > 0) {
      const eased = smooth(reverse);
      return {
        x: lerp(park.fromX, bay.x - outward * 10, eased),
        y: lerp(bay.y - 46, bay.y - 10, eased),
        heading: -outward * Math.sin(eased * Math.PI) * 0.62,
        done,
      };
    }
    return { x: park.fromX, y: lerp(park.fromY, bay.y - 46, draw), heading: 0, done };
  }

  const eased = smooth(beat(progress, 0, 0.62));
  return {
    x: lerp(park.fromX, bay.x - outward * 6, eased),
    y: lerp(park.fromY, bay.y - 16, eased),
    heading: outward * eased * 0.75,
    done,
  };
};

/* ---------------------------------------------------------------------------
 * Right-of-way resolution
 * ------------------------------------------------------------------------ */

/** How long a frozen right-of-way call takes to play itself out. */
export const RIGHT_OF_WAY_DURATION_MS = 2300;

/**
 * Which of the four resolutions is being played.
 *
 * The two axes are independent and both matter. `youYield` is what the rule
 * said — whether the other vehicle had priority — and `good` is whether the
 * player agreed with it. A learner who correctly went first and one who
 * correctly held back have both answered right, but the road does two
 * completely different things afterwards, and showing the same clip for both
 * would teach that right-of-way is a single reflex.
 */
export interface RightOfWayRun {
  youYield: boolean;
  good: boolean;
  startedAt: number;
  /** Road distance the player was frozen at, which their advance is measured from. */
  fromDistance: number;
  /**
   * Keep the player parked for the whole resolution — used by the roundabout,
   * where driving forward on this straight corridor would send the car through
   * the central island. Only the circulating vehicle (which animates on its own
   * clock) moves; the player stays at the give-way line and the verdict narrates
   * the entry and exit.
   */
  holdPlayer?: boolean;
}

/** How the junction stands part-way through the resolution. */
export interface RightOfWayPose {
  /** Extra road distance to place scripted NPCs at, so they can move while the player is held. */
  npcAdvance: number;
  /** How far the player's own car has travelled from where it froze. */
  playerAdvance: number;
  /** 0..1 flash of a collision, non-zero only where the answer put them in the same space. */
  impact: number;
  done: boolean;
}

/** How far a vehicle travels to clear the junction it is in. */
const CLEAR_DISTANCE = 190;

/**
 * Where both vehicles are, `elapsedMs` into the resolution.
 *
 * Deliberately expressed as two distances rather than as screen positions: the
 * canvas already knows how to place a car and an NPC given a road distance, so
 * the resolution is the drive briefly running on a script instead of on input.
 * That is what lets it reuse the junction, the lane geometry and the sprites
 * the player has been looking at all level, rather than restating them in a
 * diagram that can drift out of step with the road.
 */
export const rightOfWayPose = (run: RightOfWayRun, elapsedMs: number): RightOfWayPose => {
  const t = progressOf(elapsedMs, RIGHT_OF_WAY_DURATION_MS);
  const done = t >= 1;

  // Roundabout: the player never advances (the island is straight ahead), and
  // nothing is ever "hit" — the circulating car animates on its own clock.
  if (run.holdPlayer) {
    return { npcAdvance: 0, playerAdvance: 0, impact: 0, done };
  }

  if (run.youYield) {
    return run.good
      ? {
          // It had priority and you let it take it: it clears first, and only
          // then do you move off. The gap between the two beats is the lesson.
          npcAdvance: smooth(beat(t, 0, 0.5)) * CLEAR_DISTANCE,
          playerAdvance: smooth(beat(t, 0.45, 1)) * CLEAR_DISTANCE,
          impact: 0,
          done,
        }
      : {
          // You took a junction that was not yours. Both of you arrive in it.
          npcAdvance: smooth(beat(t, 0, 0.42)) * 96,
          playerAdvance: smooth(beat(t, 0, 0.42)) * 74,
          impact: beat(t, 0.42, 0.62) * (1 - beat(t, 0.75, 1) * 0.5),
          done,
        };
  }

  return run.good
    ? {
        // The priority was yours: you go, and it holds where it is.
        npcAdvance: 0,
        playerAdvance: smooth(beat(t, 0, 0.85)) * CLEAR_DISTANCE,
        impact: 0,
        done,
      }
    : {
        // You gave way when you did not have to. Nothing is hit — it simply
        // goes instead, and you are still sitting there when it has gone.
        npcAdvance: smooth(beat(t, 0.15, 0.9)) * CLEAR_DISTANCE,
        playerAdvance: 0,
        impact: 0,
        done,
      };
};

/* ---------------------------------------------------------------------------
 * Driving through a roundabout
 * ------------------------------------------------------------------------ */

/** How long the player's own trip round the rotunda takes to play out. */
export const ROUNDABOUT_DURATION_MS = 3400;

export interface RoundaboutRun {
  startedAt: number;
  /** Where the car was frozen (at the give-way line), which the approach starts from. */
  fromX: number;
  fromY: number;
  /** The central island on screen: centre and the radius of the driving path around it. */
  island: { x: number; y: number; r: number };
  /** Road distance to set the car down at once it has left the ring — past the island. */
  exitDistance: number;
  /** Screen-x of the lane the car exits into — its own inner lane, not the road centre. */
  exitLaneX: number;
  /**
   * Which exit the scenario's route takes. `straight` goes on round to the far
   * (second) exit — the common "carry straight through" case; `right` peels off
   * at the near (first) exit after only a quarter of the ring. The route is the
   * scenario's, not one generic loop for every roundabout.
   */
  exit: 'straight' | 'right';
}

/**
 * The player's own car, part-way through driving the roundabout.
 *
 * The corridor can't be *driven* round the island, so this is a scripted path
 * played with the road frozen (exactly like a turn): approach the entry, curve
 * counter-clockwise around the right of the island — the direction right-hand
 * traffic circulates — and peel off up the exit road, heading north again, at
 * which point the drive loop hands back to normal driving beyond the roundabout.
 *
 * `heading` is 0 = north (up) and increases clockwise, matching `turnPose` and
 * what `drawCar` expects, so a car mid-arc leans into the curve like a turn.
 */
export const roundaboutPose = (
  run: RoundaboutRun,
  elapsedMs: number
): CarPose & { done: boolean } => {
  const t = progressOf(elapsedMs, ROUNDABOUT_DURATION_MS);
  const { x: cx, y: cy, r } = run.island;

  // Position angles on the ring (x = cx + r·cos a, y = cy + r·sin a). Entry is
  // the bottom (south), and the car sweeps counter-clockwise on screen (a
  // decreasing) — the direction right-hand traffic circulates. The near/first
  // exit is a quarter round, at the east point (a = 0), where the ring tangent
  // already points north; the far/second exit is a half round, at the top
  // (a = -π/2). The route depends on the scenario.
  const entryA = Math.PI / 2;
  const exitA = run.exit === 'right' ? 0 : -Math.PI / 2;
  const entryX = cx + r * Math.cos(entryA); // = cx
  const entryY = cy + r * Math.sin(entryA); // = cy + r (bottom of ring)
  const exitX = cx + r * Math.cos(exitA);
  const exitY = cy + r * Math.sin(exitA);

  const APPROACH = 0.22;
  // A shorter arc for the near exit, so it plainly does not go all the way round.
  const CIRCULATE = run.exit === 'right' ? 0.6 : 0.82;

  if (t < APPROACH) {
    // Roll up from the give-way line to the entry, turning to face along the
    // ring (east) as you arrive.
    const s = smooth(t / APPROACH);
    return {
      x: lerp(run.fromX, entryX, s),
      y: lerp(run.fromY, entryY, s),
      heading: s * entryA,
      done: false,
    };
  }
  if (t < CIRCULATE) {
    // Round the island. Heading equals the position angle, which is the travel
    // tangent for a counter-clockwise sweep, so the nose leads the curve.
    const a = lerp(entryA, exitA, smooth((t - APPROACH) / (CIRCULATE - APPROACH)));
    return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a), heading: a, done: false };
  }

  const s = smooth((t - CIRCULATE) / (1 - CIRCULATE));

  if (run.exit === 'right') {
    // The near/first exit is a genuine right turn OFF the ring, not a carry-on
    // up the main road. From the east point of the ring (nose pointing north)
    // the car curves forward-then-right — a quadratic bezier, exactly like a
    // right turn at a junction — and drives off toward the destination road on
    // the right. The drive loop then hands over a fresh road with the car set
    // down in its right-hand lane, the same way `turnPose`'s right turn does, so
    // there is no on-screen sideways snap. Continuing straight up here was the
    // bug: it completed the arc and then just resumed the main-road trajectory.
    const p1x = exitX, p1y = exitY - 70;                        // forward into the exit throat
    const p2x = exitX + CANVAS_WIDTH * 0.7, p2y = exitY - 70;   // then out to the right, off-frame
    const inv = 1 - s;
    const x = inv * inv * exitX + 2 * inv * s * p1x + s * s * p2x;
    const y = inv * inv * exitY + 2 * inv * s * p1y + s * s * p2y;
    const tanX = 2 * inv * (p1x - exitX) + 2 * s * (p2x - p1x);
    const tanY = 2 * inv * (p1y - exitY) + 2 * s * (p2y - p1y);
    // atan2(tanX, -tanY): 0 = north (tangent up), +π/2 = east (tangent right).
    return { x, y, heading: Math.atan2(tanX, -tanY), done: t >= 1 };
  }

  // The far/second exit carries straight on: rejoin the driver's OWN lane (not
  // the road centre) heading north and drive up off the top of the frame, so the
  // loop hands back with no sideways snap and the car in its actual travel lane.
  return {
    x: lerp(exitX, run.exitLaneX, s),
    y: lerp(exitY, exitY - 240, s),
    heading: lerp(exitA, 0, s),
    done: t >= 1,
  };
};
