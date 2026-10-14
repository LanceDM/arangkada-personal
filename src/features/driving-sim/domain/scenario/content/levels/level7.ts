import { getLevelModule } from '@/features/driving-sim/domain/scenario/content/lessons/lessonCatalog';
import { buildEvents, type SlotVariant } from '@/features/driving-sim/domain/scenario/pooling';
import type { LevelConfig } from '@/features/driving-sim/domain/scenario/scenarioDefinition';

const levelModule = getLevelModule(7);

const IMG = 'arangkada_extracted_images/level7/';

/**
 * One expressway, driven from the acceleration lane to the toll booth.
 *
 * Levels 3 and 4 are reading tasks, Level 5 asks who goes first, and Level 6
 * asks what you choose to do. Every one of them is driven at 40-50 km/h, where
 * a late decision is still a recoverable one. This level's module opens with the
 * claim that higher speed does not just make mistakes more likely, it makes
 * every mistake bigger — so the level is driven at 100, and the whole design
 * follows from what that costs.
 *
 * ## The road is one road
 *
 * Everything about the carriageway comes from `route` below: the acceleration
 * lane that runs out, the ramp that opens where the road parts, the
 * verge that turns from barrier into a lit plaza approach, the gantry that
 * numbers the lanes, the gore the exit leaves through, the gates across the
 * plaza. One declaration, read by the paint, the drivable bounds, the scenery
 * generator, the traffic and the grading.
 *
 * That is a correction rather than a preference. This level used to be
 * assembled from per-event scene overlays — a slip road drawn beside one event,
 * a median nose beside another, a gore wedge beside a third — each of which
 * knew nothing about the road it was dropped onto. The acceleration lane was a
 * picture the car could not drive on, so an event that said "you are in the
 * acceleration lane" was measuring a car in an ordinary through lane; the
 * median began in the middle of four same-direction lanes; the exit was a wedge
 * beside a road the car then drove straight past. None of those are things you
 * fix by moving coordinates.
 *
 * ## What 100 km/h costs, and how the spacing is set
 *
 * The simulation advances the car by `speed` times this level's pace (0.03,
 * below) units a frame, so at the limit this road moves 3 units a frame against
 * Level 6's 2. Every event therefore declares a long `warningDistance`, and the
 * events are spaced by what each one actually needs rather than by a single
 * number: a reading needs a warning, a following gap needs its lead vehicle on
 * the road before the window opens, and an overtake needs a whole manoeuvre's
 * worth of road. `level7.test.ts` computes each envelope and fails if the route
 * stops fitting them. On top of that, every gap leaves an approach room to open
 * half as far again as its warning without reaching back into the scenario
 * before it.
 *
 * The drive also opens quiet. The first scenario announces itself at 890 units,
 * which from a standing start is a little over seven seconds of ordinary
 * driving: long enough to find the controls, see the lane, and be up to speed
 * before anything is being marked.
 *
 * ## Lane 1 is asked twice, in opposite directions
 *
 * Events 2 and 5 look contradictory and are not. Event 2 puts the car in Lane 2,
 * where the module's lane table puts a passenger car; event 5 asks for Lane 1 to
 * be given back to somebody faster. Between them event 4 requires Lane 1, for
 * the one thing it is for. None can be answered by a habit.
 *
 * ## What stays in the module and off the road
 *
 * The under-400cc ban and RA 4136's default speed table are both real and both
 * stay in the lesson and the quiz. A drawing of a motorcycle cannot state its
 * displacement, and a city street is not on this route; asking either here
 * would be asking a learner to act on something the screen does not show.
 */

/** Where the acceleration lane ends, which is where the merge has to be done by. */
const MERGE_POINT = 2190;
/**
 * Where the nose between the slip road and the expressway ends.
 *
 * Everything before this is two roads running alongside; from here they are one
 * surface and the merge is available. Seven hundred units of it, which at the
 * expressway minimum is about eight seconds — long enough to find a gap rather
 * than take one.
 */
const MERGE_OPENING = 1490;
/** Where the exit leaves the expressway: the gore, the marker and the grade. */
const EXIT_POINT = 9580;
/** Where the ramp sets the driver down on the toll approach. */
/**
 * Where the ramp stops being crossable and starts being a road of its own.
 *
 * Derived, not chosen: the manoeuvre may be committed up to a car length past
 * the marker, runs for `RAMP_LENGTH`, and the car is a length of road in its
 * own right. The opening has to outlast all three or the nose comes up while
 * the car is still crossing it — which is a crash caused by the scenery.
 *
 * 136 (latest commit) + 420 (the crossing) + 136 (the car) = 692, rounded up.
 */
const RAMP_COMMITTED_FROM = EXIT_POINT + 700;
/**
 * Where the nose ends and the ramp joins the approach road.
 *
 * Eleven hundred units of kerb between the ramp and the expressway — most of
 * the ramp's length. A short one read as a stub and left the exit feeling like
 * something a driver drifted into and out of; a wall this long is the thing
 * that makes taking it a commitment.
 *
 * The taper that takes the lane away starts a car's length after it, so the
 * outer edge never closes in while the inner one is still solid.
 */
const RAMP_REJOINS_AT = EXIT_POINT + 1800;
const TOLL_APPROACH_FROM = EXIT_POINT + 2200;
/**
 * The plaza, far enough past the exit that the ramp is finished with before its
 * window opens. The ramp is now a road of its own for most of a kilometre — an
 * opening, a divided stretch and a taper back onto the approach — and the
 * driver has to be off it and able to steer across before being asked to pick a
 * gate.
 */
const TOLL_PLAZA = 12880;
const ROUTE_END = 13780;

// 1. Joining the expressway — module section 5, and its minimum speed from
// section 3. The player is physically on the acceleration lane, a car is
// already travelling it ahead of them, and the lane runs out at MERGE_POINT.
// Three things are graded, and all three are things the car did: the speed it
// carried in, the lane it joined, and the gap it joined into.
const accelerationLaneMergeSlot: SlotVariant[] = [
  {
    id: 'level7.merging-traffic-minimum-speed',
    type: 'scenario_trigger',
    scene: 'route',
    description:
      'You are on the acceleration lane — a separate road running alongside the expressway, divided from it until the merge opening. A car is already running down the expressway ahead of you.',
    recommendedMove:
      'Build speed to at least 60 km/h. Wait for the merge opening, then enter Lane 4 behind that car with a safe gap — well before the acceleration lane ends.',
    correctAction: 'accelerate',
    points: 25,
    // Announced at 890 units, which from a standing start on this level's pace
    // is a little over seven seconds of ordinary driving — long enough to find
    // the controls, see the lane and be up to speed before anything is marked,
    // and still 1,300 units short of where the lane ends. Calibrated against
    // the simulation rather than chosen: `level7Drive.test.ts` drives it.
    warningDistance: 1300,
    penaltyMessage: `An acceleration lane is for reaching the speed of the traffic you are joining and finding a gap in it, and it is not a lane you may still be on when it ends.`,
    // Names Lane 4 and nothing else. Where a passenger car belongs afterwards is
    // the next scenario's rule and the next scenario's grade — promising it here
    // would be this event taking credit for something it never measured.
    rewardMessage:
      'Correct. Up to speed, into Lane 4, and off the acceleration lane in good time. Settle there before thinking about moving further in.',
    duration: 200,
    lawCitation:
      'Except where a specific speed limit is posted, the expressway minimum speed is 60 km/h and the maximum is 100 km/h. Look ahead, enter slowly, and accelerate before merging, making full use of the acceleration (continuity) lane.',
    competency: 'speed_control',
    severity: 'critical',
    merge: {
      // Lane 4, the outermost: traffic joining an expressway joins the lane
      // beside the one it was accelerating on, not the middle of the road.
      intoLane: 'curb',
      minSpeed: 60,
      safeGapSeconds: 1.2,
      // Half a lane left: the merge has to be a move the driver made, not the
      // taper narrowing them out of a lane they were still sitting in.
      completeBy: 0.5,
      neverMergedMessage: `You were still on the acceleration lane when it ran out. It is a lane you leave, not a lane you travel in: the whole point of its length is that the merge happens somewhere along it rather than at its very end.`,
      tooSlowMessage: `You joined below the 60 km/h floor. Traffic already on the carriageway is doing a hundred and has to brake for a vehicle that arrives slower than it does — which is exactly what the acceleration lane exists to prevent.`,
      unsafeGapMessage: `You joined without the gap to do it in. A merge is a gap you find, not a space you take: arriving on the back of the vehicle you are joining behind leaves neither of you room to do anything about it.`,
    },
    npc: {
      path: 'merging_from_ramp',
      vehicleKind: 'car',
      label: 'the car merging ahead of you',
      lane: 'curb',
      color: '#94a3b8',
      approachSpan: 1400,
      // Three seconds ahead at the limit, travelling at four fifths of it: a
      // driver who builds speed sensibly keeps that gap, and one who arrives at
      // the merge point doing well over a hundred has eaten most of it — but is
      // still graded on the gap they took rather than removed from the level by
      // running into the back of it.
      entryHeadway: 3.2,
      speed: { cruise: 0.8 },
    },
    sign: {
      image: `${IMG}merge-lanes-500-meters-ahead.png`,
      name: 'Distance To The Merging Lanes Is 500 Meters',
      category: 'B. Warning Sign',
      meaning: 'The merge point is 500 meters ahead; plan your lane now rather than at it.',
      art: 'rect_instruction',
      glyph: 'MERGE 500m',
    },
  },
];

// 2. What each lane is for — module section 4's table, hung over the lanes it
// describes. The player is driving a passenger car, so the lane it belongs in
// is Lane 2, and that is the lane this grades: Lane 1 is for overtaking, and
// Lanes 3 and 4 belong to traffic this car is not.
const lane2PassengerCarSlot: SlotVariant[] = [
  {
    id: 'level7.lane1-keep-right-except-pass',
    type: 'scenario_trigger',
    scene: 'route',
    description:
      'The gantry ahead assigns every lane: Lane 1 for overtaking, Lane 2 for cars and light vehicles, Lane 3 for large buses and heavy freight, Lane 4 for special and construction vehicles. Nothing is in your way and there is nothing to pass.',
    recommendedMove: 'Lane 1 is for overtaking only. Cruise in Lane 2, where this car belongs.',
    correctAction: 'accelerate',
    points: 20,
    warningDistance: 800,
    penaltyMessage: `An expressway assigns each lane to a category of vehicle, and staying in the correct one is the rule rather than a courtesy. Lane 1 is borrowed for a pass and given back; Lanes 3 and 4 belong to the heavy and slow traffic a car should not be sitting among.`,
    rewardMessage: 'Correct. Lane 2 — the lane the table assigns to cars — with Lane 1 left clear for the traffic that needs it.',
    duration: 200,
    lawCitation:
      'On a four-lane expressway: Lane 1 is used by vehicles from Lane 2 for passing and overtaking; Lane 2 carries passenger cars, small and medium passenger buses, and freight under 1.5 tons; Lane 3 carries large passenger buses and freight over 1.5 tons; Lane 4 carries special vehicles and construction equipment.',
    competency: 'lane_discipline',
    severity: 'major',
    requiredLane: {
      // `middle` is Lane 2 on this four-lane one-way road — and the lane the
      // route's own lane plan marks for cars, which `level7.test.ts` checks.
      lane: 'middle',
      hint: 'Cruise in Lane 2 — the lane for cars',
      wrongLaneMessage: `That is not the lane a passenger car cruises in. Lane 1 is for overtaking, and Lanes 3 and 4 are assigned to heavy, slow and special vehicles; a car traveling among them is as out of place as one sitting in the overtaking lane.`,
    },
    sign: {
      image: `${IMG}expressway-lane-usage.jpg`,
      name: 'Expressway Lane Usage',
      category: 'D. Guide Sign',
      meaning: 'Each lane is assigned to a category of vehicle; a passenger car belongs in Lane 2.',
      art: 'rect_instruction',
      glyph: 'LANE USE',
    },
  },
];

// 3. Following and stopping distance — module section 2, driven as the module
// teaches it: a time gap to a vehicle genuinely travelling in front of you,
// held over the whole approach rather than sampled at one point.
const followingDistanceLeadVanSlot: SlotVariant[] = [
  {
    id: 'level7.following-distance-lead-van',
    label: 'Van slowing ahead',
    type: 'obstacle_ahead',
    description:
      'A delivery van is traveling in your lane a short way ahead, and its brake lights come on as it slows for something you cannot see yet.',
    recommendedMove: 'Hold at least a two-second gap. Ease off early rather than braking late.',
    correctAction: 'brake',
    points: 25,
    warningDistance: 900,
    penaltyMessage: `You closed inside two seconds of the van. At 100 km/h you cover about 20 meters before you have even reacted and another 60 braking — 80 meters of road gone before the vehicle stops.`,
    rewardMessage: 'Correct. You kept a full two-second gap to the van the whole way in.',
    duration: 200,
    lawCitation:
      'Keep a two-to-three second following gap, measured in time rather than meters, and widen it for higher speed, a heavier load or reduced visibility. Total stopping distance is perception and reaction distance plus braking distance: about 80 meters at 100 km/h.',
    competency: 'hazard_awareness',
    severity: 'critical',
    npc: {
      path: 'travelling_ahead',
      vehicleKind: 'van',
      label: 'the van traveling ahead of you',
      // No lane: it joins in the one the car is in, so it is genuinely in front
      // of the driver rather than beside them wherever it is played, Level 12's
      // hazard slot and Levels 8-11's practice included.
      approachSpan: 1000,
      entryHeadway: 3.5,
      // Slows to half the limit rather than a third of it. The gap has to be
      // losable without the closing being unsurvivable: a driver who holds a
      // hundred into this must be gradeable on the gap they left, not removed
      // from the level by an impact they could not have got out of.
      speed: { cruise: 0.62, slowsTo: 0.5, slowsFrom: 420 },
    },
    following: {
      seconds: 2,
      tooCloseMessage: `You were inside two seconds of the van. The rule is measured in time, not in car lengths: pick a fixed point on the road, and if you reach it less than two seconds after the vehicle ahead did, the gap is not there.`,
    },
  },
];

// 4. Overtaking at speed — module section 6. The truck is a real vehicle on a
// real path, and the whole manoeuvre is measured: out into Lane 1 while still
// behind it, level with it from that lane, clear of it by more than the two
// bodies put together, and back.
const lane1OvertakeFreightTruckSlot: SlotVariant[] = [
  {
    id: 'level7.lane1-overtake-freight-truck',
    type: 'overtaking_zone',
    scene: 'route',
    description:
      'A freight truck is running well under the limit in your lane, Lane 1 alongside you is empty, and the road beyond the truck is clear.',
    recommendedMove: 'Move into Lane 1, pass the truck, and return to Lane 2 once it is fully clear behind you.',
    correctAction: 'accelerate',
    points: 25,
    warningDistance: 1200,
    penaltyMessage: `On an expressway overtaking happens in Lane 1 and nowhere else, and it is finished when you are back in your own lane. Undertaking puts you in the blind spot of a driver with no reason to expect anything there; staying in Lane 1 afterwards is the thing the lane assignment forbids.`,
    rewardMessage: 'Correct. Into Lane 1 for the pass, and back to your own lane once the truck was clear behind you.',
    duration: 200,
    lawCitation:
      'Expressway overtaking happens only in Lane 1, the innermost lane; an overtaking vehicle does not have right-of-way and must return to its own lane once clear. Judge the gap by whether it is large enough to complete the pass and return safely, not by how much the vehicle ahead is slowing you down.',
    competency: 'lane_discipline',
    severity: 'major',
    npc: {
      path: 'travelling_ahead',
      vehicleKind: 'truck',
      label: 'the freight truck you were passing',
      lane: 'middle',
      // Comes into view as the event announces itself, so the whole measured
      // window is the whole manoeuvre.
      approachSpan: 1200,
      // Two seconds ahead at the limit, doing a quarter of it. Close enough to
      // be caught within the scenario and far enough that a driver who simply
      // sits behind it is graded on not passing rather than on the impact.
      entryHeadway: 2,
      // Well under a third of the limit: slow enough that the pass fits inside
      // the window from anywhere in the legal speed range, including the 60
      // km/h floor, which is what stops this grading top speed instead of
      // overtaking. `level7.test.ts` computes that envelope.
      speed: { cruise: 0.28 },
    },
    overtake: {
      passingLane: 'inner',
      // Larger than the two bodies put together. A 68-pixel car and a 66-pixel
      // truck still overlap until their centres are 134 road units apart, so a
      // smaller figure would call a return safe where the collision pass calls
      // it an impact.
      clearBy: 170,
      neverPassedMessage: `You never completed the pass. Moving into Lane 1 is the start of an overtake, not the whole of it — you are in the overtaking lane until you are clear of the vehicle and back in your own.`,
      wrongLaneMessage: `You drew level with the truck outside Lane 1. The pass is made in the innermost lane and returned from it; taking it anywhere else is not overtaking, it is filtering.`,
      neverReturnedMessage: `You passed the truck and stayed in Lane 1. The overtaking lane is borrowed for the length of the pass and given back the moment it is over.`,
      cutInMessage: `You came back across before you were clear of the truck. Cutting in front of a loaded vehicle takes away the gap it needs to stop, and it is the half of the maneuver drivers skip most often.`,
    },
    sign: {
      name: 'Overtaking Lane',
      category: 'C. Regulatory Sign',
      meaning: 'Lane 1 is the lane a pass is made in, and only for as long as the pass takes.',
      art: 'rect_instruction',
      glyph: 'OVERTAKING LANE',
    },
  },
];

// 5. Somebody faster, coming up Lane 1 — module section 3's rule read from the
// other side. The pass is over and the lane goes back. The sedan takes the lane
// its scenario names rather than the lane the player happens to be in, because
// the rule is about Lane 1 and not about you.
const lane1YieldToFasterTrafficSlot: SlotVariant[] = [
  {
    id: 'level7.lane1-yield-to-faster-traffic',
    label: 'Car closing from behind',
    type: 'scenario_trigger',
    description:
      'A sedan is coming up fast behind you in Lane 1, closing much quicker than the traffic around you. Your pass is finished and the road ahead of you is clear.',
    recommendedMove: 'Clear Lane 1 and let the faster car through.',
    correctAction: 'accelerate',
    points: 20,
    warningDistance: 700,
    penaltyMessage: `You held Lane 1 with a faster vehicle behind you. The overtaking lane is not yours for as long as you want it, and a driver who has to go round you on the right is being forced into the one move the lane assignment exists to prevent.`,
    rewardMessage: 'Correct. You stayed out of Lane 1 and let the faster car take it.',
    duration: 200,
    lawCitation:
      'The innermost lane (Lane 1), nearest the median barrier, is for overtaking only, within the allowed speed. An overtaking vehicle does not have right-of-way and must return to its own lane once clear.',
    competency: 'lane_discipline',
    severity: 'major',
    npc: {
      path: 'closing_from_behind',
      // An ordinary car, not an ambulance. The shared screen-space steps this
      // path was written for cross the frame in about a second and a half,
      // which is right for a siren and useless for a lesson about giving the
      // lane back: it was alongside before the driver had read why. Declared in
      // shares of the road's own limit, so it closes at fifteen over and passes
      // at twenty-five over — visible, bounded, and several seconds long.
      closing: { approach: 1.15, pass: 1.25, holdSeconds: 1.8 },
      vehicleKind: 'car',
      label: 'the car overtaking you',
      lane: 'inner',
      color: '#0f172a',
      approachSpan: 620,
    },
    requiredLane: {
      lane: 'middle',
      hint: 'Leave Lane 1 clear for the faster car',
      strict: true,
      wrongLaneMessage: `You were still in Lane 1 as the faster car came up behind you. Finishing a pass means giving the lane back, not keeping it until somebody else has to go round.`,
    },
  },
];

// 6. The exit — module section 5's advance signage and section 1's posted
// maximum, in one place because that is where they happen. It is driven rather
// than answered: the gantry names the exit, the chevrons mark where it leaves, and the
// driver has to be in the outer lane, down to the posted speed, and actually
// turn onto the ramp. The road leaves the expressway here, so a driver who never
// set up for it is carried off anyway — and graded on not having set up for it.
const expresswayExitSlot: SlotVariant[] = [
  {
    id: 'level7.check-brakes-reduce-speed',
    type: 'scenario_trigger',
    scene: 'route',
    postedSpeed: 60,
    description:
      'Your route leaves the expressway at the exit signed ahead, with chevrons painted where its ramp leaves. The ramp is posted at 60.',
    recommendedMove:
      'Move into the outer lane, brake down to 60, and steer right onto the ramp before the gore.',
    correctAction: 'turn_right',
    points: 25,
    warningDistance: 1100,
    penaltyMessage: `An exit is taken from the outer lane, at the marker, at a speed the ramp is built for. You were carried past it without having set up for it — and the chevrons beside you are the one piece of road you may not cross to get back.`,
    rewardMessage: 'Correct. Into the exit lane in good time, down to the posted 60, and onto the ramp under control.',
    duration: 200,
    lawCitation:
      'A posted sign always overrides the default speed table. Check Brakes, Reduce Speed Now is posted in conjunction with a merge or descent on the expressway: test your brakes and slow down before the situation demands it. Special signs appear as early as 200 meters before an exit to give you time to move into the correct lane.',
    competency: 'speed_control',
    severity: 'major',
    maneuver: {
      // An exit, not a corner: the road keeps coming and the car crosses onto
      // the ramp's own line. See `ManeuverStyle`.
      style: 'ramp',
      direction: 'right',
      // The outermost lane, which is the lane the ramp leaves from
      // and the lane the gore opens off.
      lane: 'curb',
      // The whole deceleration lane, not a junction's reaction band: the driver
      // is meant to commit anywhere along it.
      // The one anchor. The gore that draws the opening, the fixture that
      // places it, the scenario that grades it and the frame the animation
      // starts on are all this number — `level7.test.ts` asserts they still
      // are. What used to sit here was a 700-unit band whose far end was 820
      // units from the nose the driver could actually see.
      commitAt: EXIT_POINT,
      maxSpeed: 60,
      // The ramp is a road of its own, so the hand-off sets the car down some
      // way along it rather than just past a junction box.
      exitLane: 'curb',
      mandatory: true,
      hint: 'Move into the exit lane and slow to 60',
      wrongLaneMessage: `You reached the gore still in a through lane. The signs go up hundreds of meters out precisely so the lane change is made where it costs nothing.`,
      tooFastMessage: `You were still carrying expressway speed at the exit. The speed comes off on the carriageway before the ramp, not on it: a ramp taken at a hundred is a ramp taken at more than it is built for.`,
    },
    sign: {
      image: `${IMG}check-brakes-reduce-speed.png`,
      name: 'Check Brakes, Reduce Speed Now',
      category: 'C. Regulatory Sign',
      meaning: 'Test your brakes and slow down before the exit, not at it.',
      art: 'circle_limit',
      glyph: '60',
    },
  },
];

// 7. The toll plaza — module section 5's lane indicators, on the road the exit
// led to. Two things at once: the gate is a lane, and the booth is a speed.
const tollPlazaClosedGatesSlot: SlotVariant[] = [
  {
    id: 'level7.toll-plaza-closed-gates',
    type: 'scenario_trigger',
    scene: 'route',
    postedSpeed: 40,
    description:
      'The plaza is ahead at the end of the ramp. A red X hangs over every gate but the outermost, and the barriers under them are down.',
    recommendedMove: 'Line up on the gate under the green arrow and slow to a walking pace for the booth.',
    correctAction: 'brake',
    points: 25,
    // Opens once the ramp has tapered back onto the approach road. A window
    // that opened while the driver was still walled off on the ramp asked them
    // to pick a gate from a road they could not yet steer across.
    warningDistance: 800,
    penaltyMessage: `A red X over a toll lane means the lane is closed and you cannot drive through it — the barrier is down behind the sign. Special signs appear as early as 200 meters out precisely so the gate is chosen there rather than at the plaza.`,
    rewardMessage: 'Correct. Open gate picked out early, across in good time, and slowed to a walking pace for the booth.',
    duration: 200,
    lawCitation:
      'Toll gate lane indicators: a red X means the lane is closed and you cannot drive through it. Special signs appear as early as 200 meters before a toll exit to give you time to move into the correct lane. Slow down at the entry and exit tolls.',
    competency: 'lane_discipline',
    severity: 'major',
    requiredLane: {
      lane: 'curb',
      hint: 'Line up on the open gate',
      wrongLaneMessage: `You arrived at the plaza lined up on a closed gate. The indicators are lit hundreds of meters out so the choice is made on the approach, where a lane change still costs nothing.`,
    },
    sign: {
      image: `${IMG}toll-lane-closed-red-x.png`,
      name: 'Toll Lane Closed',
      category: 'D. Guide Sign',
      meaning: 'A red X means that gate is closed; take the one showing a green arrow.',
      art: 'rect_instruction',
      glyph: 'TOLL PLAZA',
    },
  },
];

export const SLOT_DISTANCES = [MERGE_POINT, 3490, 4900, 6760, 7870, EXIT_POINT, TOLL_PLAZA];
export const SLOTS: SlotVariant[][] = [
  accelerationLaneMergeSlot,
  lane2PassengerCarSlot,
  followingDistanceLeadVanSlot,
  lane1OvertakeFreightTruckSlot,
  lane1YieldToFasterTrafficSlot,
  expresswayExitSlot,
  tollPlazaClosedGatesSlot,
];

/**
 * The drive is worth 165 points across seven scenarios: 25 for each of the five
 * where getting it wrong means an impact, a closed barrier or leaving the
 * expressway out of control, and 20 for each of the two lane judgments.
 *
 * The pass mark sits at 69% of the total, the share every level from 4 onwards
 * uses. No single-key strategy comes close. A driver who accelerates at
 * everything arrives at the merge with no gap, closes on a braking van, drives
 * into the back of a truck doing a quarter of their speed, and is carried off
 * the exit too fast to take it. One who brakes at everything never reaches the
 * 60 km/h floor to merge, never overtakes at all, and reaches the plaza having
 * scored two of seven.
 */
export const level7: LevelConfig = {
  id: 7,
  name: levelModule.title,
  moduleId: levelModule.id,
  description: levelModule.desc,
  roadLength: ROUTE_END,
  // The expressway maximum, and the first level driven anywhere near it. The
  // speed profile derives acceleration and top speed from this, so the road
  // genuinely gets away from a driver who is not paying attention to it.
  speedLimit: 100,
  /**
   * The expressway is driven at a hundred and understood at a walking pace.
   *
   * The dial is untouched: 60 to 100 km/h is the rule this level teaches and
   * what the speedometer reads. What changes is how much road a hundred is
   * worth per frame. At the shared 0.05 this road went past at 300 units a
   * second — two and a half times Level 6 — while the wheel still moved the car
   * 2.5px a frame, so a lane change was over in four tenths of a second and a
   * scenario arrived faster than it could be read.
   *
   * 0.03 puts it at 180 units a second: brisker than Level 6 and half again
   * slower than it was. The wheel moves 1.4px a frame, so a tap is about a
   * sixth of a lane and a held key crosses one in three quarters of a second.
   * Acceleration is a little over half the derived rate, which is four and a
   * half seconds from rest to the limit rather than two and a half; braking is
   * eased for the same reason. Traffic, headways and grading all read the same
   * numbers, so nothing closes on anything at the difference between two paces.
   */
  pace: {
    distancePerSpeed: 0.03,
    steerPerFrame: 1.4,
    accelerationScale: 0.55,
    brakingScale: 0.7,
  },
  requiredScore: 114,
  stars2: 137,
  stars3: 157,
  events: buildEvents(SLOTS, SLOT_DISTANCES, pool => pool[0]),
  /**
   * A four-lane, one-way expressway: no opposing traffic at all.
   *
   * `oncomingLanes: 0` is what makes the module's lane table expressible. The
   * `inner` role resolves to the lane against the median — Lane 1, the
   * overtaking lane — `middle` to Lane 2, where a car belongs, and `curb` to
   * Lane 4. On a two-way road every one of those rules would be about a
   * different piece of road.
   *
   * `edge_line` is the marking, not `lane_line`. With no opposing traffic the
   * centre treatment falls on the left edge of the carriageway, and edge_line
   * is the one that puts a solid white line there and heavy lines at both
   * curbs — which is what an expressway is painted with.
   */
  paint: {
    oncomingLanes: 0,
    base: 'edge_line',
    spans: [],
  },
  /**
   * The road, from the acceleration lane to the plaza.
   *
   * Four stretches in the order they are driven, and the two ends mirror each
   * other. The acceleration lane is full width from the start — the drive
   * begins on it — divided from the expressway by a kerbed nose until the
   * opening, then tapering away over its last 420 units. Between the merge and
   * the exit there is no auxiliary lane at all. Then the ramp opens at the
   * gore, is crossable for the length of the manoeuvre, and is divided from the
   * expressway by a nose of its own until it tapers out onto the approach road.
   * On both, the only place the two roads meet is the opening. Everything that
   * has to agree about where the road is reads these numbers.
   */
  route: {
    segments: [
      {
        from: 0,
        to: MERGE_POINT,
        roadside: 'expressway',
        auxiliary: {
          role: 'acceleration',
          taperIn: 0,
          taperOut: 420,
          // Two roads, not two lanes, until the opening. A slip road does not
          // become the expressway where its tarmac touches it, and a driver who
          // could steer across from the first frame was never merging from
          // anywhere — which is what "merge before the lane ends" has to mean.
          // The nose ends at MERGE_OPENING, leaving 700 units of shared surface
          // to cross in before the taper starts taking the lane away.
          separator: { kind: 'island', from: 0, to: MERGE_OPENING },
        },
      },
      // No extra lane at all until the road actually divides. A 1,200-unit
      // deceleration lane opening long before the exit was a second road the
      // driver could sit in for twenty seconds while nothing about it was
      // graded — and it let them be "in the exit lane" before there was an exit
      // to be in the lane for. On a straight road the honest shape is: you slow
      // down in Lane 4, and the ramp exists from the point the two roads part.
      { from: MERGE_POINT, to: EXIT_POINT, roadside: 'expressway' },
      {
        // The ramp, and the mirror of the acceleration lane at the other end of
        // the route. It opens at the gore, and past the opening a kerbed nose
        // divides it from the expressway exactly as one divides the slip road
        // from it at the start: once you are on the ramp you are on a different
        // road and cannot steer back, and once you are past the opening you
        // cannot steer onto it either. The nose ends where the ramp tapers out
        // onto the approach road, which is the only other place the two meet.
        from: EXIT_POINT,
        to: TOLL_APPROACH_FROM,
        roadside: 'toll_approach',
        auxiliary: {
          role: 'deceleration',
          taperIn: 120,
          taperOut: 250,
          separator: { kind: 'island', from: RAMP_COMMITTED_FROM, to: RAMP_REJOINS_AT },
        },
      },
      { from: TOLL_APPROACH_FROM, to: ROUTE_END, roadside: 'toll_approach' },
    ],
    /**
     * The module's four-lane table, from the median outwards.
     *
     * The gantry draws these over the lanes `laneEdges` divides the road into,
     * and the scenario that grades a passenger car requires the lane marked
     * `cars`. One declaration, so a panel and a grade cannot disagree about
     * which lane is which.
     */
    lanePlan: {
      lanes: [
        { label: 'LANE 1', use: 'OVERTAKING / ONLY', role: 'overtaking' },
        { label: 'LANE 2', use: 'CARS / LIGHT VEHICLES', role: 'cars' },
        { label: 'LANE 3', use: 'LARGE BUSES / HEAVY FREIGHT', role: 'heavy' },
        { label: 'LANE 4', use: 'SPECIAL / CONSTRUCTION', role: 'special' },
      ],
    },
    fixtures: [
      // The arrows across the closing acceleration lane, inside its taper.
      { at: MERGE_POINT - 220, fixture: { kind: 'merge-taper' } },
      // The lane table, with the lane this car belongs in picked out. The role
      // is the same one the lane plan gives Lane 2 and the same one the
      // scenario grades against, so the board cannot recommend a lane the
      // grader marks down.
      { at: 3490, fixture: { kind: 'lane-gantry', vehicleRole: 'cars' } },
      // Advance guidance, seven hundred units out: an overhead board saying how
      // far the exit is. Deliberately unlike the marker at the exit itself, so
      // the two cannot be mistaken for each other.
      { at: EXIT_POINT - 700, fixture: { kind: 'exit-gantry', legend: 'EXIT', sub: '700 m AHEAD' } },
      { at: EXIT_POINT, fixture: { kind: 'exit-gore' } },
      { at: TOLL_PLAZA, fixture: { kind: 'toll-plaza', openLane: 'curb' } },
    ],
  },
};
