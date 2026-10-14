import { CANVAS_HEIGHT, CANVAS_WIDTH, ROAD_WIDTH, ROUNDABOUT_PATH_RADIUS, distanceToScreenY, laneCentreX, laneEdges, resolveLaneRole, type LaneIndex, } from '@/features/driving-sim/domain/world/vehiclePhysics';
import {
  auxiliaryAt,
  auxiliaryCentreX,
  segmentAt,
} from '@/features/driving-sim/domain/world/routeGeometry';
import type { RouteLayout } from '@/features/driving-sim/domain/scenario/scenarioScene';
import {
  DEFAULT_PACE,
  unitsForSeconds,
  type DrivingPace,
} from '@/features/driving-sim/domain/world/DrivingPace';
import type { NpcPathKind, NpcVehicleSpec } from '@/features/driving-sim/domain/scenario/scenarioScene';
import { leadLane, type TrafficVehicle } from './roadTraffic';

/** Where the NPC is on screen right now, and whether it should still be drawn. */
export interface NpcTransform {
  x: number;
  y: number;
  heading: number;
  active: boolean;
  /**
   * Whether hitting this vehicle should end the run. Only meaningful for a
   * vehicle closing from behind: it is `false` while it is holding behind you
   * (you cannot be rear-ended) and `true` once it has drawn alongside and is
   * passing (driving back into it is then your mistake). Undefined for every
   * other path, which the renderer treats as solid, as before.
   */
  solid?: boolean;
  /**
   * For `closing_from_behind` only: the latched "has committed to overtaking"
   * state this frame, written back into `followerState` so it persists. Once a
   * follower starts passing it never reverts to holding — so it drives on from
   * its actual position rather than being pulled back behind the player.
   */
  passing?: boolean;
  /**
   * The vehicle is shedding speed. Drawn as brake lights, which is the cue a
   * following driver is entitled to before the gap closes rather than after.
   */
  braking?: boolean;
  /**
   * Its hazard lights are on. Carried on the pose beside `braking` for the same
   * reason: the renderer draws what the world settled this frame and never
   * decides for itself whether a vehicle is signalling.
   */
  hazards?: boolean;
}

/**
 * What the paths below need to know about the road they are driving on.
 *
 * Every path resolves its lane from the level's own layout, never from the
 * road's midpoint: on a four-lane two-way street the middle of the carriageway
 * is the centre line, so a vehicle placed there sits astride it in neither
 * direction's lanes. Which lane a vehicle is in is frequently the whole point
 * of the rule being taught.
 */
export interface NpcRoadContext {
  /** The road this frame is driven on, for the paths that travel it. */
  route?: RouteLayout;
  /** The road's own limit, for a vehicle whose speed is a share of it. */
  speedLimit?: number;
  /** How much road a km/h is worth here, so NPC and player move on one scale. */
  pace?: DrivingPace;
  /** The world is held still, so anything carrying its own motion holds too. */
  frozen?: boolean;
  /**
   * The player's current speed, for traffic whose motion is genuinely relative
   * to theirs — a car passing at 120 while you do 100 closes at twenty, and the
   * whole point of the yield scenario is that it takes visible seconds to do it.
   */
  playerSpeed?: number;
  /**
   * The frame's own instant, for the one path that circulates on wall-clock
   * time rather than on the player's distance.
   *
   * Supplied by the frame composer rather than read here, for the same reason
   * every other moving pose is: the vehicle it places is solid, so its position
   * has to be a fact about the frame and not about when in the frame it was
   * asked for. Defaults to now, which is what production passes anyway.
   */
  nowMs?: number;
  /**
   * How many lanes at the left carry opposing traffic, from the level's
   * `paint.oncomingLanes`. Zero is a one-way road, where the whole width is
   * the player's and "oncoming" has no meaning.
   */
  oncomingLanes: number;
  /**
   * The lane a vehicle closing from behind has committed to.
   *
   * Locked once, when the ambulance first appears, rather than tracked live:
   * an emergency vehicle that followed the player across the carriageway would
   * be impossible to get out of the way of, which inverts the lesson. See
   * `chaseLaneRef` in useDrivingSimulation for where the lock is taken.
   */
  chaseLane?: LaneIndex;
  /**
   * The lane the player is in right now, so a vehicle closing from behind can
   * tell whether its path is still blocked. Live, unlike `chaseLane`, because
   * this is exactly the thing the player changes to let it through.
   */
  playerLane?: LaneIndex;
  /**
   * The follower's own screen-y last frame, threaded back in so a vehicle
   * closing from behind moves *continuously* from where it actually is rather
   * than being recomputed from the player's position each frame. `null`/`undefined`
   * means "no history yet", so the first frame places it on its approach line.
   * Owned by the drive loop (see `followerStateRef`).
   */
  followerY?: number | null;
  /**
   * Whether the follower has already committed to overtaking (latched). Once
   * set, it drives on up the lane at its own speed and never reverts to holding
   * behind the player — which is what stops it "catching up" to an accumulated
   * player-relative position when the lane finally opens. Owned by the loop.
   */
  followerPassing?: boolean;
  /**
   * Where this event's own self-driving vehicle has got to, for the one path
   * that carries its own road distance rather than deriving one from the
   * player's.
   *
   * Three states, and the difference between the last two matters. A vehicle
   * means it is there, at that distance. `null` is a drive saying it is *not*
   * there yet, and nothing is drawn — without that, a frame composed while the
   * event was merely on screen drew a solid vehicle at a fixed gap ahead, which
   * tracked the player's own speed exactly and could be driven into. `undefined`
   * is no drive at all — a golden sample, a scene test — where the honest
   * depiction is the vehicle at the gap it joins the road at.
   */
  lead?: TrafficVehicle | null;
}

const DEFAULT_SPAN: Record<NpcPathKind, number> = {
  crossing_from_left: 220,
  crossing_from_right: 220,
  oncoming_through: 180,
  closing_from_behind: 260,
  roundabout_circulating: 0,
  // Long enough that the car is on screen for the whole decision window and is
  // visibly turning through the reaction phase, not appearing already committed.
  oncoming_turning_left: 360,
  // Long enough that the rider is in the mirror for a couple of seconds before
  // they are beside the door, which is the whole of the warning a driver gets.
  filtering_past: 520,
  // How far out a lead vehicle joins the road. Where it is after that comes
  // from its own carried distance, so this only says when it arrives.
  travelling_ahead: 1000,
  // The whole run down an entry ramp, long enough that a driver at expressway
  // speed watches it come rather than finds it already alongside.
  merging_from_ramp: 700,
};

/**
 * Where a lead vehicle sits in a composition with no drive behind it — a golden
 * sample, a scene test. Its real position is a running total the world keeps,
 * and without a world the only honest answer is "somewhere ahead in its lane",
 * so this is a fixed, deterministic stand-in rather than a guess at one.
 */
const NOMINAL_LEAD_GAP = 320;

/**
 * The last stretch of an auxiliary lane, over which a vehicle on it moves
 * across into the carriageway.
 *
 * About four car lengths of road: long enough to read as a lane change rather
 * than a step sideways, short enough that it is unmistakably happening at the
 * end of the lane rather than somewhere along it.
 */
const MERGE_ACROSS = 260;

/** How far a merging vehicle is turned toward the lane it is joining, at most. */
const MERGE_LEAN = 0.3;

const ROUNDABOUT_CYCLE_MS = 6500;

/** How far behind the player's own row a filtering rider first appears, in px. */
const FILTER_BEHIND = 150;
/** How far ahead of it they have gone by the end of the pass. */
const FILTER_AHEAD = 260;
/** Share of the approach span they keep riding for after drawing level. */
const FILTER_TRAIL = 0.55;

/**
 * How far past the lane line the rider actually rides, in pixels.
 *
 * Squarely on the line is where a rider filters, but at this road's scale it is
 * also where a car sitting correctly in the middle of the next lane already
 * touches them: a lane is 65 wide, a car 40 and a motorcycle 24, which leaves
 * half a pixel between a centred car's flank and a rider on the line. A driver
 * who did everything right cannot be the one who gets hit, so the rider takes
 * the far third of the lane they are passing through — still straddling the
 * line to look at, with room beside the car for the wander to be *graded* in
 * rather than collided in.
 */
const FILTER_STRADDLE = 22;

/** The opposing lane nearest the centre line — the one closest to the player. */
const oncomingInnerLane = (oncomingLanes: number): LaneIndex =>
  (oncomingLanes > 0 ? oncomingLanes - 1 : 0) as LaneIndex;

const clamp01 = (v: number) => Math.min(Math.max(v, 0), 1);
/** Smoothstep, so a scripted vehicle eases into and out of its motion. */
const smooth = (t: number) => t * t * (3 - 2 * t);
const lerp = (a: number, b: number, share: number) => a + (b - a) * share;

/**
 * Distances, in road units ahead of the junction, that shape a crossing
 * vehicle's motion. Everything here is expressed against `relDist` (how far the
 * junction still is) rather than a normalised 0..1 clock, so a vehicle sits
 * where the geometry says it should regardless of the player's speed — and, in
 * particular, so it is genuinely *in the box* while the player is deciding
 * rather than half a screen away.
 */
/** A vehicle crossing with priority: appears this far ahead, dead centre at the junction, gone this far past it. */
const CROSS_LEAD = 340;
/** A vehicle yielding to the player: rolls into frame this far ahead… */
const YIELD_APPEAR = 360;
/** …and comes to rest at its give-way line this far short of the junction. */
const YIELD_STOP = 44;
/**
 * A vehicle joining from a side road: appears from its own side this far ahead,
 * and is at the mouth of the side road by `EMERGE_TURN`.
 *
 * That is for a vehicle that is seen pulling out. One a scenario describes as
 * already waiting at the mouth declares how far out it is there, as its
 * `approachSpan`, and arrives over the same stretch of road before that.
 */
const EMERGE_APPEAR = 560;
/** …begins its curved turn onto the player's road here… */
const EMERGE_TURN = 150;
/** …lifts this far up onto the carriageway as it completes the turn (px)… */
const EMERGE_RISE = 26;
/** …and then drives away up the road this fast (px up per unit past the junction). */
const EMERGE_EXIT_RATE = 1.6;
/** A vehicle already stalled inside the box: visible from this far ahead… */
const INBOX_APPEAR = 460;
/** …holds dead centre until the player is this close, then clears… */
const INBOX_CLEAR_FROM = 0;
/** …and is gone by this far past the junction. */
const INBOX_CLEAR_TO = -260;

/**
 * How far behind the player a blocked emergency vehicle holds, in screen
 * pixels below the player's own row. A car-length and a bit, so it reads as
 * waiting close behind rather than tailgating or overlapping — an ambulance
 * approaching from the rear brakes and waits, it does not drive through you.
 */
const AMBULANCE_HOLD_GAP = 96;

/**
 * The closest a vehicle holding behind the player is ever drawn, in pixels.
 *
 * A gap declared in seconds is nothing at all when the player is stopped, and
 * a scenario whose correct answer *is* to stop — a school van unloading, a
 * child at the curb — then finished with the car behind drawn on top of the
 * car in front. Two car lengths: close enough to be pressure in the mirror,
 * far enough to be a separate vehicle.
 */
const MIN_HOLD_GAP = 74;

/**
 * The most a vehicle closing from behind may move on screen in one frame, in
 * pixels. During its ordinary approach the geometry only asks for ~1px/frame,
 * so this never bites there. Its whole job is the moment the player clears the
 * lane: the hold releases and the geometry asks for up to a car-length at once,
 * which this spreads over ~a dozen frames so the ambulance accelerates past
 * rather than snapping forward onto the player.
 */
const MAX_FOLLOWER_STEP = 8;

/**
 * How fast a follower overtakes once it has committed to passing, in screen
 * px/frame up the vacated lane. This is its *own* forward speed — unlike the
 * approach, it is not derived from the player's position at all, so there is no
 * accumulated target for it to snap toward when the lane opens. It simply drives
 * on from wherever it actually is.
 */
const FOLLOWER_PASS_STEP = 7;

/**
 * How far behind the player's own row (in px) a follower counts as "drawing
 * level" and so becomes solid. A little more than a car-length, so it turns
 * solid just as it comes up alongside — never while it is still easing in from
 * further back, which is what kept the smoothed approach from ever being the
 * collision itself.
 */
const CAR_ALONGSIDE_MARGIN = 40;

/**
 * How far off the cross street's centre line a crossing vehicle sits, so it
 * travels in a lane rather than straddling the middle of the junction. A car
 * keeps to its right: one going left (arriving from your right) rides the upper
 * lane, one going right (from your left) rides the lower lane.
 */
const CROSS_LANE_OFFSET = 30;

/**
 * Where a scripted NPC vehicle is right now.
 *
 * `anchorY` is the row its path is centred on — the junction's cross-street
 * row for the two `crossing_*` paths, the roundabout's own row for
 * `roundabout_circulating`, or the junction row for the oncoming paths, which
 * approach it from further up the screen. `closing_from_behind` ignores it and
 * derives its row from a virtual distance instead, the same way every other
 * road object derives its row from the player's actual distance.
 */
export const npcTransform = (
  spec: NpcVehicleSpec,
  triggerAtDistance: number,
  playerDistance: number,
  roadX: number,
  anchorY: number,
  handled: boolean,
  road: NpcRoadContext = { oncomingLanes: 0 }
): NpcTransform => {
  const span = spec.approachSpan ?? DEFAULT_SPAN[spec.path];
  const relDist = triggerAtDistance - playerDistance;

  switch (spec.path) {
    case 'crossing_from_right':
    case 'crossing_from_left': {
      const fromRight = spec.path === 'crossing_from_right';
      const laneOffset = fromRight ? -CROSS_LANE_OFFSET : CROSS_LANE_OFFSET;
      const y = anchorY + laneOffset;
      const heading = fromRight ? Math.PI : 0;
      // Enters from off its own edge of the frame and, left to run, exits the
      // far one. A car keeps to its lane on the cross street, so the two ends
      // are the off-screen curbs, not the centre line.
      const startX = fromRight ? CANVAS_WIDTH + 60 : -60;
      const endX = fromRight ? -60 : CANVAS_WIDTH + 60;
      const boxCentreX = roadX + ROAD_WIDTH / 2;
      // Its give-way line: just off the carriageway on its own side, front
      // bumper at the curb line, body still clear of the box.
      const giveWayX = fromRight ? roadX + ROAD_WIDTH + 34 : roadX - 34;

      // None of the four readings below gate `active` on `handled`. A scripted
      // vehicle is part of the world, not a prop struck the instant the event
      // is scored: it keeps to its path as the player drives on and only leaves
      // once it has actually driven off, which is what stops a car vanishing
      // mid-junction the moment an answer is graded.

      // (1) Yields to the player. Rolls up to its give-way line as the player
      // approaches and holds there — so a driver with priority meets a clear
      // box rather than a car parked across it.
      //
      // Not for one that also `emerges`: that is a vehicle waiting for a gap
      // it intends to *take*, and its whole arc — wait at the mouth, then pull
      // out once the driver has let it — lives in (2). Taking it here left it
      // parked at a give-way line for the rest of the level, so the courtesy
      // the scenario asked for visibly came to nothing.
      if (spec.yields && !spec.emerges) {
        const approach = clamp01((YIELD_APPEAR - relDist) / (YIELD_APPEAR - YIELD_STOP));
        return { x: lerp(startX, giveWayX, smooth(approach)), y, heading, active: approach > 0.01 };
      }

      // (2) Joins the player's road from a west side road at a T-junction:
      // approaches from the west, makes a *curved* turn onto the carriageway,
      // and drives away up the road in the player's own direction — rather than
      // continuing straight across and out of bounds. `heading` here is measured
      // from due north (0 = driving up the road, +π/2 = facing east on the
      // approach); the 'joining' renderer rotates a nose-up sprite by it.
      //
      // Only the crossing_from_left form is a west join; the geometry below
      // assumes entry from the left.
      if (spec.emerges) {
        // Which side of the road the mouth is on follows the path: a vehicle
        // coming from the right joins from the curb side, and aims at the curb
        // lane rather than at the lane against the centre line.
        const joinRole = spec.lane ?? (fromRight ? 'curb' : 'inner');
        const nearLaneX = laneCentreX(
          fromRight
            ? resolveLaneRole(joinRole, road.oncomingLanes)
            : road.playerLane ?? resolveLaneRole('inner', road.oncomingLanes),
          roadX
        );
        const mouthX = fromRight ? roadX + ROAD_WIDTH - 24 : roadX + 24;
        const turnEndY = anchorY - EMERGE_RISE;
        // Facing the way it is travelling along the cross street before it turns.
        const approachHeading = fromRight ? -Math.PI / 2 : Math.PI / 2;

        // At the mouth by `arrive`: the scenario's own `approachSpan` where it
        // declares one, so a vehicle the briefing says is waiting there is
        // there when the briefing is read; otherwise as it pulls out.
        const arrive = Math.max(spec.approachSpan ?? EMERGE_TURN, EMERGE_TURN);
        const appear = arrive + (EMERGE_APPEAR - EMERGE_TURN);
        if (relDist >= EMERGE_TURN) {
          // Approach: in along the cross street, facing across the road, then
          // waiting at the mouth until the turn.
          const a = clamp01((appear - relDist) / (appear - arrive));
          return { x: lerp(startX, mouthX, smooth(a)), y: anchorY, heading: approachHeading, active: a > 0.01 };
        }
        // Waiting to be let out. A vehicle that both `emerges` and `yields` is
        // one that has arrived at the mouth and stopped: it holds there until
        // the scenario has been answered, and only then takes the gap. That is
        // what makes a courtesy the driver extended visible as something the
        // world actually did with it.
        if (spec.yields && !handled) {
          return { x: mouthX, y: anchorY, heading: approachHeading, active: true };
        }
        if (relDist >= 0) {
          // The turn: a smooth arc from facing east to facing north, curving up
          // into the player's near lane. Never leaves the carriageway.
          const s = smooth(clamp01((EMERGE_TURN - relDist) / EMERGE_TURN));
          return {
            x: lerp(mouthX, nearLaneX, s),
            y: lerp(anchorY, turnEndY, s),
            heading: (1 - s) * approachHeading,
            active: true,
          };
        }
        // Exit: settled in the lane, driving on up the road and away, same
        // direction as the player, until it leaves the top of the frame.
        const upY = turnEndY - (-relDist) * EMERGE_EXIT_RATE;
        return { x: nearLaneX, y: upY, heading: 0, active: upY > -70 };
      }

      // (3) Already committed inside the box — stalled cross traffic still
      // clearing. Sits dead centre from the moment the junction is on screen,
      // so it is unmistakably there while the decision is made, and only pulls
      // clear once the player has arrived.
      if (spec.inBox) {
        const clearing = clamp01((INBOX_CLEAR_FROM - relDist) / (INBOX_CLEAR_FROM - INBOX_CLEAR_TO));
        return {
          x: lerp(boxCentreX, endX, smooth(clearing)),
          y, heading,
          active: relDist <= INBOX_APPEAR && clearing < 1,
        };
      }

      // (4) Default: crossing with priority. Enters as the player approaches,
      // is dead centre in the box as the player reaches the junction — so
      // driving in without yielding is a collision, not a near miss — and
      // clears out beyond it. Symmetric about the junction so the centre moment
      // lands exactly at arrival.
      const cross = clamp01((CROSS_LEAD - relDist) / (2 * CROSS_LEAD));
      return { x: lerp(startX, endX, cross), y, heading, active: cross > 0 && cross < 1 };
    }

    case 'oncoming_through': {
      // In the opposing lane nearest the centre line, which is where a driver
      // actually meets oncoming traffic — not on the line itself.
      const t = span > 0 ? clamp01(1 - relDist / span) : 1;
      return {
        x: laneCentreX(oncomingInnerLane(road.oncomingLanes), roadX),
        y: anchorY + 20 * (1 - t),
        heading: Math.PI,
        active: !handled && t > 0,
      };
    }

    case 'closing_from_behind': {
      // In the player's own lane, which is the whole reason they are being
      // asked to move over. Falls back to the inner lane on the rare frame
      // before the lock is taken, so it is never on the centre line.
      //
      // A scenario may name the lane instead, and then that is the lane it
      // comes up — because some rules are about a particular lane rather than
      // about yours. On an expressway the faster traffic comes up Lane 1
      // whether or not you happen to be sitting in it, and "get out of Lane 1"
      // cannot be taught by a car that follows you into whichever lane you
      // chose. An ambulance is the other case and declares nothing, so it
      // still takes the lane you are in.
      const lane = spec.lane
        ? resolveLaneRole(spec.lane, road.oncomingLanes)
        : road.chaseLane ?? resolveLaneRole('inner', road.oncomingLanes);
      const laneX = laneCentreX(lane, roadX);
      const playerRow = distanceToScreenY(playerDistance, playerDistance);

      // A scenario may say how this traffic moves, in shares of the road's own
      // limit. Where it does, the motion is relative — its speed against the
      // player's — which is what makes an ordinary car take seconds to come up
      // and pass rather than crossing the frame in one. Where it does not, the
      // fixed screen steps the emergency vehicle was written against stay
      // exactly as they were.
      const pace = road.pace ?? DEFAULT_PACE;
      const limit = road.speedLimit ?? 0;
      const playerSpeed = road.playerSpeed ?? 0;
      const profile = spec.closing;
      const rowsPerFrame = (speedKph: number) =>
        // Half a pixel of screen per road unit, from `distanceToScreenY`.
        Math.max(0, (speedKph - playerSpeed) * pace.distancePerSpeed * 0.5);
      const passStep = profile ? rowsPerFrame(profile.pass * limit) : FOLLOWER_PASS_STEP;
      const approachStep = profile
        ? rowsPerFrame(profile.approach * limit)
        : MAX_FOLLOWER_STEP;
      const holdGap = profile
        ? Math.max(
            MIN_HOLD_GAP,
            unitsForSeconds(profile.holdSeconds, Math.max(playerSpeed, 1), pace) * 0.5
          )
        : AMBULANCE_HOLD_GAP;
      const holdY = playerRow + holdGap;

      // The natural approach position: behind the player, closing as the player
      // advances. Used ONLY while the follower is still approaching — never as a
      // target once it passes. That is the whole fix: the old code aimed the
      // release at this player-relative position, which had drifted far ahead
      // while the follower was held, so opening the lane made it lurch forward
      // to "where it would have been". A follower has no such debt now.
      const naturalY = distanceToScreenY(playerDistance - relDist, playerDistance);

      // Is the player still sitting in the follower's lane? Blocking is decided
      // purely by lane, not by grading: an ambulance never rear-ends a driver
      // who has not moved over — it holds behind and, if they never clear, trails
      // off without a collision.
      const playerInLane = road.playerLane === undefined || road.playerLane === lane;
      // Commit to overtaking the moment the lane opens, and stay committed
      // (latched), so a player who then swerves back into it is the one at fault
      // and the pass is never rewound into a catch-up.
      const passing = (road.followerPassing ?? false) || !playerInLane;

      const prev = road.followerY;
      let y: number;
      if (road.frozen && prev !== undefined && prev !== null) {
        // Held exactly where it was. A frozen frame is still drawn, and what it
        // draws has to be the frame the driver was looking at — a follower that
        // kept coming while a panel was up arrived having covered the gap in
        // the reader's own time.
        y = prev;
      } else if (prev === undefined || prev === null) {
        // First frame on stage: place it on its approach line, no closer than
        // the hold gap and never ahead of the player.
        y = Math.max(naturalY, holdY);
      } else if (passing) {
        // Its own forward motion up the vacated lane, from wherever it actually
        // is. A fixed screen speed, independent of the player — no snap.
        y = prev - passStep;
      } else {
        // Blocked: ease toward the hold point behind the player (or its natural
        // approach position while it is still further back), capped for smoothness.
        const target = Math.max(naturalY, holdY);
        y = prev + Math.max(-approachStep, Math.min(approachStep, target - prev));
      }

      return {
        x: laneX,
        y,
        heading: 0,
        // On stage from when it closes into range. While passing it stays until
        // it has driven off the top of the frame (y past -60); while merely
        // holding behind an un-yielding player it drops off once the junction
        // has scrolled well behind.
        active: relDist < span + 80 && y > -60 && y < 740 && (passing || relDist > -160),
        // Solid only once it is committed to passing and genuinely alongside or
        // ahead, in its own lane — the smoothed approach itself is never solid,
        // so giving way correctly can never be the collision.
        solid: passing && y <= playerRow + CAR_ALONGSIDE_MARGIN,
        passing,
      };
    }

    case 'filtering_past': {
      // Up the line between the driver's own two lanes: behind, then level,
      // then gone. Everything about where it is comes from the player's own
      // distance, like every path but the two that carry their own, so the pass
      // plays out at the same point of the road however fast it is driven — a
      // rider who only appeared once you slowed would be teaching you to watch
      // the speedometer instead of the mirror.
      const edges = laneEdges(roadX);
      const boundary = edges[Math.min(edges.length - 2, road.oncomingLanes + 1)];
      const playerRow = distanceToScreenY(playerDistance, playerDistance);
      const travelled = span > 0 ? (span - relDist) / span : 1;
      const from = playerRow + FILTER_BEHIND;
      const to = playerRow - FILTER_AHEAD;
      const y = from + (to - from) * clamp01(travelled / (1 + FILTER_TRAIL));
      return {
        x: boundary + FILTER_STRADDLE,
        y,
        heading: 0,
        active: travelled > 0 && y > -60,
        // Solid for the whole pass. A rider beside your door is exactly the
        // thing you must not move into, and a body that only became solid once
        // you had already drifted would report the collision rather than
        // prevent it.
        solid: true,
      };
    }

    case 'oncoming_turning_left': {
      // Comes down the opposing lane from up the road, then turns left — which
      // on a right-hand-traffic road means sweeping across the player's lanes,
      // toward the near-side road. That crossing is the whole reason the rule
      // exists: an oncoming vehicle turning away from you would take nothing
      // from you and there would be nothing to yield.
      //
      // Runs a little past the junction (t up to ~1.4) rather than being cut
      // off at arrival, and is not gated on `handled`, so the turn is actually
      // seen through to the receiving lane instead of vanishing the instant the
      // event is graded. The turn begins early (40% of the way down) so it is
      // visibly *turning*, not driving straight, while the decision is made.
      const t = span > 0 ? 1 - relDist / span : 1;
      const APPROACH = 0.4;
      const turn = clamp01((t - APPROACH) / (0.95 - APPROACH));

      const laneX = laneCentreX(oncomingInnerLane(road.oncomingLanes), roadX);
      // Enters near the top of the frame and runs down to the junction, so the
      // player sees it coming rather than finding it already in the box.
      const startY = anchorY - 250;
      const approachY = startY + (anchorY - startY) * clamp01(t / APPROACH);
      // Turns out across the carriageway into the side road on the player's side.
      const exitX = roadX + ROAD_WIDTH + 34;

      return {
        x: laneX + smooth(turn) * (exitX - laneX),
        y: approachY + smooth(turn) * 22,
        // Measured from "facing the player", which is the pose the oncoming
        // sprite is drawn in. Negative swings it toward screen-right under
        // canvas's y-down rotation, which is where its left turn takes it.
        heading: -smooth(turn) * (Math.PI / 2),
        active: t > 0 && t < 1.4,
      };
    }

    case 'travelling_ahead': {
      // In a lane of your own carriageway, at the distance it has driven itself
      // to. Everything about it is a fact about the road rather than about the
      // player: the lane is the one its scenario put it in, or, where it names
      // none, the one it joined in (`TrafficVehicle.lane`), and the row is
      // wherever its own distance falls on screen.
      // The drive says it has not joined the road yet.
      if (road.lead === null) return { x: roadX, y: 0, heading: 0, active: false };
      // With no drive at all (a golden sample, a scene test) it is in the lane
      // the car is, which is where it would have joined.
      const lane = leadLane(spec, road.lead, road.oncomingLanes, road.playerLane);
      const distance = road.lead ? road.lead.distance : playerDistance + NOMINAL_LEAD_GAP;
      const y = distanceToScreenY(distance, playerDistance);
      return {
        x: laneCentreX(lane, roadX),
        y,
        heading: 0,
        // Only its own position decides this, never `handled`: traffic you have
        // finished being graded on is still traffic, and a lead vehicle that
        // blinked out at the moment of the verdict would empty the road at
        // exactly the point the driver is being told what they did on it.
        active: y > -90 && y < CANVAS_HEIGHT + 90,
        solid: true,
        braking: road.lead?.braking ?? false,
        hazards: spec.hazards ?? false,
      };
    }

    case 'merging_from_ramp': {
      // On the acceleration lane at the distance it has driven itself to, and
      // moving across into the carriageway over the last stretch of that lane,
      // which is where a driver using an acceleration lane merges.
      if (road.lead === null) return { x: roadX, y: 0, heading: 0, active: false };
      const distance = road.lead ? road.lead.distance : playerDistance + NOMINAL_LEAD_GAP;
      const y = distanceToScreenY(distance, playerDistance);
      const lane = resolveLaneRole(spec.lane ?? 'curb', road.oncomingLanes);
      const laneX = laneCentreX(lane, roadX);

      const segment = segmentAt(distance, road.route);
      const aux = auxiliaryAt(distance, road.route);
      // How far through its own merge it is: nothing while the lane still runs
      // on ahead of it, all of it once the lane has ended.
      const remaining = segment ? segment.to - distance : 0;
      const across = smooth(clamp01(1 - remaining / MERGE_ACROSS));

      return {
        x: lerp(aux ? auxiliaryCentreX(roadX, aux) : laneX, laneX, across),
        y,
        // Turned toward the carriageway while it is crossing, straight again at
        // both ends. Drawn flat, a merge reads as a car sliding sideways.
        heading: -MERGE_LEAN * Math.sin(Math.PI * across),
        active: y > -90 && y < CANVAS_HEIGHT + 90,
        solid: true,
        braking: road.lead?.braking ?? false,
        hazards: spec.hazards ?? false,
      };
    }

    case 'roundabout_circulating': {
      // Screen y grows downward, so a decreasing angle runs counter-clockwise
      // on screen — the direction right-hand traffic goes round a rotunda, and
      // the one that brings the circulating car past your entry from your left.
      const nowMs = road.nowMs ?? Date.now();
      const angle = -((nowMs % ROUNDABOUT_CYCLE_MS) / ROUNDABOUT_CYCLE_MS) * Math.PI * 2;
      return {
        x: roadX + ROAD_WIDTH / 2 + Math.cos(angle) * ROUNDABOUT_PATH_RADIUS,
        y: anchorY + Math.sin(angle) * ROUNDABOUT_PATH_RADIUS,
        heading: angle - Math.PI / 2,
        active: !handled,
      };
    }
  }
};

const HITBOX_SIZE: Record<NpcPathKind, { width: number; height: number }> = {
  crossing_from_left: { width: 50, height: 24 },
  crossing_from_right: { width: 50, height: 24 },
  oncoming_through: { width: 28, height: 48 },
  closing_from_behind: { width: 29, height: 45 },
  roundabout_circulating: { width: 46, height: 22 },
  oncoming_turning_left: { width: 34, height: 44 },
  filtering_past: { width: 24, height: 38 },
  // The two shared-carriageway paths are sized by what is travelling, not by
  // the path; see SHARED_LANE_HITBOX. These are the fallback a path-only read
  // would take and are never reached for them.
  travelling_ahead: { width: 30, height: 48 },
  merging_from_ramp: { width: 30, height: 48 },
};

/**
 * The body each kind of vehicle is hit at when it is sharing your carriageway.
 *
 * A path is not enough to size these, because the two paths that travel your
 * own road are the two a truck can travel: a truck drawn forty-two pixels wide
 * with a car's thirty-pixel body is a sprite you can drive through the edge of.
 * Exhaustive over the kinds on purpose — a new one cannot be added without
 * deciding how big it is — and every entry matches the sprite that kind is
 * drawn with, which `scriptedVehicleRenderer.test.ts` holds it to.
 */
export const SHARED_LANE_HITBOX: Record<NpcVehicleSpec['vehicleKind'], { width: number; height: number }> = {
  car: { width: 30, height: 48 },
  van: { width: 34, height: 54 },
  truck: { width: 42, height: 66 },
  bus: { width: 36, height: 70 },
  jeepney: { width: 36, height: 54 },
  motorcycle: { width: 24, height: 38 },
  ambulance: { width: 29, height: 45 },
  // The same body a cyclist standing in the carriageway is given, because it is
  // the same sprite at the same scale. Narrow enough that the clearance a
  // driver leaves beside one is the gap they can actually see.
  bicycle: { width: 16, height: 34 },
};

/** Axis-aligned box for the NPC's current transform, or null while it isn't active. */
export const npcHitbox = (
  spec: NpcVehicleSpec,
  transform: NpcTransform
): { x: number; y: number; width: number; height: number } | null => {
  if (!transform.active) return null;
  const shared = spec.path === 'travelling_ahead' || spec.path === 'merging_from_ramp';
  const { width, height } = shared ? SHARED_LANE_HITBOX[spec.vehicleKind] : HITBOX_SIZE[spec.path];
  return { x: transform.x - width / 2, y: transform.y - height / 2, width, height };
};
