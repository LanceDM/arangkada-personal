import { getLevelModule } from '@/features/driving-sim/domain/scenario/content/lessons/lessonCatalog';
import { buildEvents, type SlotVariant } from '@/features/driving-sim/domain/scenario/pooling';
import type { LevelConfig } from '@/features/driving-sim/domain/scenario/scenarioDefinition';

const levelModule = getLevelModule(6);

/**
 * A manoeuvring drive: eight points on a city route where the driver chooses to
 * do something, rather than reacting to something done to them.
 *
 * Levels 3 and 4 are reading tasks — what is beside the road, what is painted
 * under the wheels. Level 5 introduced somebody else on the road and asked who
 * goes first. This level asks a different question again: nobody makes you turn
 * here, change lanes here, or park here, so every failure is a judgment failure
 * rather than a missed signal. That is the module's own opening line, and it is
 * what decides how each event below is graded.
 *
 * ## Seven of the eight are driven, and the eighth is driven afterwards
 *
 * Almost everything this module teaches turns out to be expressible as vehicle
 * position, which is what this simulation measures best:
 *
 * - A turn is a lane you were in before the junction. `maneuver` refuses the
 *   turn from any other lane, so "position yourself before the intersection,
 *   not during it" is enforced by the road rather than asked about in a prompt.
 * - A lane change is a lane, judged where the obstruction is.
 * - An overtaking restriction is a lane you must *not* enter, judged across the
 *   whole approach rather than at one point (`strict`).
 * - A no-parking zone is a bay you must not come to rest in.
 * - A place a car may not stand - a fire hydrant, a posted tow-away zone - is
 *   a stretch of road it must not come to rest on (`avoid: ['stop']`): within
 *   four meters of the hydrant, and alongside the sign. Neither needs a bay, so
 *   both can be played on any road as practice.
 *
 * Parking technique is the one thing that is not. There is no reverse gear and
 * no steering-angle state here, so how you get into a space cannot be driven.
 * It is asked instead — and then the car performs the answer on the same canvas
 * the rest of the level is driven on, reversing into the space or burying its
 * nose against the curb. See `parkingCutscene` in types.ts for why that is
 * different from a right-of-way freeze, which has nothing to watch afterwards.
 *
 * Angle and perpendicular parking, uphill and downhill wheel position, hand
 * signals and U-turns are all in the module and none of them are here. A
 * top-down corridor cannot show a slope, a wheel angle, or an arm out of a
 * window, and staging one as a multiple-choice card would be the mission quiz
 * with scenery. They are quiz items, which is what they actually are.
 *
 * The route is fixed rather than rolled, for the same reason Level 5's is:
 * there is no catalogue here to draw from. Eight decisions, each needing its own
 * geometry and its own obstruction, and shuffling them would change their order
 * without changing what is being asked.
 */

/**
 * Events are spaced 750 apart, a little wider than Level 5's 700.
 *
 * Two of them need more room than a junction does. A turn hands the road over
 * and regenerates the roadside 80 units past the junction, so the next event
 * must not already be within sight when that happens; and the parking decision
 * takes a checkpoint-sized 340-unit approach, because the driver has to read
 * the space and shed all of their speed alongside it rather than merely notice
 * a sign.
 */
// 1. Right turn — module section 1. Driven: the answer is the curb lane,
// reached before the junction, and the keypress only commits it.
const rightTurnCurbLaneSlot: SlotVariant[] = [
  {
    id: 'level6.right-turn-curb-lane',
    label: 'Right turn at the junction',
    type: 'scenario_trigger',
    scene: 'intersection',
    description:
      'The junction ahead is your right turn. This road has two lanes each way.',
    correctAction: 'turn_right',
    points: 20,
    warningDistance: 380,
    penaltyMessage: `A right turn is made from the curb lane, reached well in advance, with the rear right wheel nearest the curb. Arriving in the wrong lane leaves you nothing to do but swing across traffic or drive on past your turn.`,
    rewardMessage: 'Correct. curb lane before the junction, then round with the rear wheel close to the curb.',
    duration: 200,
    lawCitation:
      'RA 4136: proceed to the right lane well in advance, reduce to a safe speed, signal your intention, and keep the rear right wheel nearest the curb or edge of the highway through the turn.',
    competency: 'lane_discipline',
    severity: 'major',
    maneuver: {
      direction: 'right',
      lane: 'curb',
      hint: 'Move into the curb lane before the junction',
      wrongLaneMessage: `You reached the junction outside the curb lane, so the turn was not available to you and you drove straight through it. The lane is the maneuver; the wheel only finishes it.`,
    },
  },
];

// 2. Left turn — module section 1, the RA 4136 positioning rule. Driven, and
// graded from the lane nearest the centre line rather than the curb, which is
// the whole difference between this and the event above.
const leftTurnCentreLaneSlot: SlotVariant[] = [
  {
    id: 'level6.left-turn-centre-lane',
    label: 'Left turn at the junction',
    type: 'scenario_trigger',
    scene: 'intersection',
    description:
      'Your left turn is at the next junction, on a road with two lanes each way.',
    correctAction: 'turn_left',
    points: 25,
    warningDistance: 380,
    penaltyMessage: `A left turn is taken from the lane nearest the center line, and the vehicle must be conducted to the right of the center of the intersection. Turning from the curb side swings you across every lane beside you.`,
    rewardMessage: 'Correct. Positioned nearest the center line, right of the center of the intersection, then through.',
    duration: 200,
    lawCitation:
      'RA 4136: when turning left from one highway to another, the vehicle shall be conducted to the right of the center of the intersection, and shall turn into the lane nearest the center line.',
    competency: 'lane_discipline',
    severity: 'major',
    maneuver: {
      direction: 'left',
      // `inner` is the lane nearest the centre line on your own side, which is
      // exactly the position RA 4136 names. On this two-by-two carriageway it
      // resolves to lane 2 — the left half of the road belongs to oncoming
      // traffic, so the leftmost lane on screen is emphatically not the answer.
      lane: 'inner',
      hint: 'Move into the lane nearest the center line',
      wrongLaneMessage: `You arrived at the junction outside the lane nearest the center line, so the left turn was refused and you carried straight on. Turning left across the lanes beside you is exactly what the positioning rule exists to prevent.`,
    },
  },
];

// 3. Lane change — module section 3, and specifically its table row on
// changing lanes to the right where two or more lanes run the same way.
// Driven: a lane change is a lane, which is the one thing this simulation
// never has to guess at.
const laneChangeSlowBusSlot: SlotVariant[] = [
  {
    id: 'level6.lane-change-slow-bus',
    label: 'Slow bus ahead',
    actor: { kind: 'bus' },
    type: 'obstacle_ahead',
    // Where the bus is, and nothing about the lane the scenario grades: whether
    // the lane beside it is clear is for the driver to look at.
    description: 'A provincial bus has slowed almost to a stop in your lane, the one beside the center line.',
    correctAction: 'accelerate',
    points: 20,
    warningDistance: 340,
    penaltyMessage: `With two or more lanes running your way, changing lanes to the right to pass a slower vehicle is allowed — and it is the only safe option here. Crossing the center line into oncoming traffic is not a lane change, and sitting behind the bus blocks everyone behind you.`,
    rewardMessage: 'Correct. Mirrors, blind spot, signal, and across into the clear curb lane.',
    duration: 200,
    lawCitation:
      'Changing lanes: check ahead, behind and to the sides, check your mirrors, glance at the blind spot, signal, then steer across and cancel the signal. Overtaking or changing lanes on the right is allowed where two or more lanes run in the same direction.',
    competency: 'lane_discipline',
    severity: 'major',
    requiredLane: {
      lane: 'curb',
      hint: 'Move across into the clear curb lane',
      wrongLaneMessage: `You reached the bus still in its lane, or in the oncoming lane beside it. The gap on your right was the lane change this situation called for.`,
    },
  },
];

// 4. Overtaking restriction — module section 4. Driven, and the only event in
// the level graded on what the driver refrained from doing: `strict` reads the
// whole approach, so dipping into the oncoming lane and pulling back before
// the marking still counts as the crossing the line forbids.
const noOvertakeDoubleYellowSlot: SlotVariant[] = [
  {
    id: 'level6.no-overtake-double-yellow',
    label: 'Double yellow, oncoming car',
    type: 'scenario_trigger',
    // Describes what is actually on the road: the line, and the vehicle coming
    // the other way. It used to add "the car ahead of you is slow", which
    // nothing declares and nothing draws — and a driver told there was a slow
    // car to get past went looking for a way round it, which on this stretch is
    // across the double yellow and straight into the one thing the event marks
    // critical. A scenario says what it puts on the road; its prose must not
    // describe a second road.
    description:
      'A double solid yellow line runs along this stretch, and a vehicle is coming the other way.',
    correctAction: 'accelerate',
    points: 25,
    warningDistance: 380,
    penaltyMessage: `You may not drive to the left of the center line to overtake unless that side is clearly visible and free of oncoming traffic for long enough to pass safely — and a double solid yellow line forbids crossing it at all. A head-on collision is the one mistake that leaves nobody any margin.`,
    rewardMessage: 'Correct. You stayed on your side of the line and waited it out.',
    duration: 200,
    lawCitation:
      'RA 4136: do not drive to the left of the center line of a highway to overtake unless that side is clearly visible and free of oncoming traffic for a sufficient distance to pass safely. Overtaking is prohibited on a solid yellow or solid white line, at intersections, on bridges, curves, crests and railroad crossings.',
    competency: 'lane_discipline',
    severity: 'critical',
    requiredLane: {
      lane: 'inner',
      hint: 'Stay on your own half, right of the double yellow line',
      // Strict, because the violation is the act of crossing, not the position
      // you happen to be in when you draw level with the oncoming car.
      strict: true,
      wrongLaneMessage: `You crossed the double solid yellow line into the path of oncoming traffic. Pulling back in before you drew level does not undo it — the crossing is the violation.`,
    },
    npc: {
      path: 'oncoming_through',
      vehicleKind: 'car',
      label: 'an oncoming vehicle',
    },
    // The line this is about, declared with it so it is painted wherever the
    // scenario is played. Here the level's own span paints it; Level 12, which
    // borrows it into its violation-risk slot, paints it from this.
    roadLine: 'double_solid_yellow',
  },
];

// 5. No-parking zone — module section 5's opening premise, that where you may
// park was already settled in the markings level and this one is about
// execution. Driven, and graded purely on whether the car came to rest off
// the carriageway: a red curb is passed by not stopping at it.
const redCurbNoParkingSlot: SlotVariant[] = [
  {
    id: 'level6.red-curb-no-parking',
    type: 'road_marking',
    description:
      'The curb along this stretch is painted red, and there is a gap at it wide enough to pull into.',
    correctAction: 'accelerate',
    points: 20,
    warningDistance: 340,
    penaltyMessage: `A red-painted curb prohibits stopping, standing and parking outright — there is no brief-stop exception and staying with the vehicle changes nothing. Coming to rest here is a parking violation.`,
    rewardMessage: 'Correct. You recognized the red curb and carried on to find a legal space.',
    duration: 200,
    lawCitation:
      'Painted curb markings: a red curb prohibits stopping, standing or parking at any time. A yellow curb permits loading and unloading only.',
    competency: 'parking',
    severity: 'major',
    marking: {
      name: 'Red Painted Curb',
      category: 'E. Painted Curb',
      meaning: 'No stopping, standing or parking at any time.',
      art: 'red_curb',
      side: 'right',
    },
    bay: {
      side: 'right',
      mayStop: false,
      hint: 'Red curb — do not stop here',
    },
  },
];

// 6. A fire hydrant — from the LTO parking sources. Nothing is posted:
// the place is the rule, and the rule says how far it reaches. Driven, and
// graded on one thing, whether the car came to rest within four meters of the
// hydrant, short of it or past it. A stop further back is one the rule allows,
// and slowing past is not standing at it, so both pass. The description gives
// the driver a reason to stop, which is what makes driving on a decision rather
// than a default.
const hydrantAtTheCurbSlot: SlotVariant[] = [
  {
    id: 'level6.hydrant-at-the-curb',
    label: 'Fire hydrant at the curb',
    type: 'scenario_trigger',
    scenePrefab: { kind: 'fire_hydrant' },
    description: 'A fire hydrant stands at the curb on your right. You are looking for a place to park.',
    correctAction: 'accelerate',
    avoid: ['stop'],
    // The sources' own distance, measured from the car to the hydrant on
    // the scale the car is drawn at (`UNITS_PER_METER`).
    noStandingWithin: 4,
    recommendedMove: 'Do not stop within four meters of the hydrant.',
    points: 20,
    warningDistance: 340,
    penaltyMessage:
      'You came to rest within four meters of the fire hydrant. No driver may park a vehicle, or let it stand, attended or unattended, within four meters of a fire hydrant.',
    rewardMessage: 'Correct. You did not stop within four meters of the hydrant.',
    duration: 200,
    lawCitation:
      'FDM Vol. 1, Parking Prohibitions In Specified Places: "No driver shall park a vehicle, or permit it to stand, whether attended or unattended, upon a highway in any of the following places: … Within four meters of a fire hydrant." RO102: "Within 4 meters from a fire hydrant." FDM Vol. 1\'s review item: never park or stop at the side of the road within 4 meters from a fire hydrant, pursuant to R.A. No. 4136.',
    competency: 'parking',
    severity: 'major',
  },
];

// 7. A posted tow-away zone — from the LTO parking sources. The same
// measurement as the hydrant, on a sign rather than a place: a car may not be
// parked or left standing where official signs prohibit parking. The sources'
// text gives the sign no extent (its arrows are image-only), so the
// stop that fails is the one with the car alongside it.
const towAwayZoneSlot: SlotVariant[] = [
  {
    id: 'level6.tow-away-zone',
    type: 'scenario_trigger',
    scene: 'open_road',
    description:
      'A NO PARKING: TOW-AWAY ZONE sign stands at the curb on your right. You are looking for a place to park.',
    correctAction: 'accelerate',
    avoid: ['stop'],
    recommendedMove: 'Do not stop at the tow-away sign.',
    points: 20,
    warningDistance: 340,
    penaltyMessage:
      'You came to rest beside a posted NO PARKING: TOW-AWAY ZONE sign. Where official signs prohibit parking, no driver may park a vehicle or let it stand, attended or unattended, and a parked vehicle there will be towed.',
    rewardMessage: 'Correct. You read the sign and did not stop at it.',
    duration: 200,
    lawCitation:
      'FDM Vol. 1, Parking Prohibitions In Specified Places: "No driver shall park a vehicle, or permit it to stand, whether attended or unattended, upon a highway in any of the following places: … At any place where official signs have been displayed prohibiting parking." The sign, in FDM Vol. 1 and RO102: "NO PARKING: TOW-AWAY ZONE -- parked vehicle will be towed."',
    competency: 'parking',
    severity: 'major',
    sign: {
      image: 'arangkada_extracted_images/level3/no-parking-tow-away-zone.png',
      name: 'No Parking: Tow-Away Zone',
      category: 'A. Regulatory Sign — Parking And Stopping',
      meaning: 'No parking. A parked vehicle will be towed.',
      art: 'rect_instruction',
      glyph: 'NO PARKING',
    },
  },
];

// 8. Parking technique — module section 5. The one decision in this level that
// cannot be driven, so it is answered and then performed: see the file header,
// and `parkingCutscene` in types.ts. The answer is FDM Vol. 1's PARALLEL
// PARKING. Both wrong answers enter nose first, which is the
// manoeuvre the car performs for any wrong answer, so what the driver watches
// is what they chose.
const parallelParkingBaySlot: SlotVariant[] = [
  {
    id: 'level6.parallel-parking-bay',
    type: 'road_marking',
    parkingCutscene: true,
    description: 'A marked parking bay, with a car parked at each end of it. You are looking for a place to park.',
    question: 'You are stopped alongside the space, with a car parked at each end of it. How do you get into it?',
    // The answer first and the wrong one the simulator plays second: both are
    // what the drive harnesses and `wrongActionFor` read, and both are what
    // they read before the choices were restored.
    choices: [
      {
        label: 'Pull slightly past the space, parallel to the car in front of it at a safe distance, then reverse in',
        action: 'stop',
      },
      { label: 'Turn in nose first from where you are, then straighten against the curb', action: 'accelerate' },
      { label: 'Back up behind the space, then drive into it forward', action: 'turn_right' },
    ],
    correctAction: 'stop',
    points: 25,
    penaltyMessage: `A space between two parked cars is entered in reverse: drive slightly past it, parallel to the vehicle in front, then back in and straighten. Going in nose-first cannot bring the tail round, so the car ends across the bay with its back end still out in the traffic lane.`,
    rewardMessage:
      'Correct. Level with the car in front, then reversed in and straightened up against the curb — parallel parking, done the way the space required.',
    duration: 200,
    lawCitation:
      'FDM Vol. 1, parallel parking: "driving slightly past the parking space, parallel to the parked vehicles in front of that space, keeping a safe distance, then followed by reversing into that space." Angle parking sits at about 45 degrees to the curb with one front wheel within a foot of it; perpendicular parking sits square to a wall or curb.',
    competency: 'parking',
    severity: 'major',
    marking: {
      name: 'Parking Bay',
      category: 'C. Other Lines',
      meaning: 'A marked space where parking is permitted.',
      art: 'parking_bay',
      side: 'right',
    },
    bay: {
      side: 'right',
      mayStop: true,
      hint: 'Pull up level with the space and stop',
      // The two cars are what make this a parallel-parking problem rather than
      // an open curb you could drive straight at.
      refCars: true,
    },
  },
];

// The hydrant and the tow-away zone stand between the red curb and the bay, so
// the last four read as one search for somewhere to park: three places a car
// may not stand, then the space where it may. The hydrant has the 750 the
// others get. The tow-away zone has 810: the hydrant's zone stays open until
// the car is four meters past it, and the extra 60 keeps the room a widened
// theta asks for (`thetaRoom.test.ts`). The bay keeps its place at 6210.
export const SLOT_DISTANCES = [810, 1560, 2310, 3060, 3810, 4560, 5370, 6210];
export const SLOTS: SlotVariant[][] = [
  rightTurnCurbLaneSlot,
  leftTurnCentreLaneSlot,
  laneChangeSlowBusSlot,
  noOvertakeDoubleYellowSlot,
  redCurbNoParkingSlot,
  hydrantAtTheCurbSlot,
  towAwayZoneSlot,
  parallelParkingBaySlot,
];


/**
 * The drive is worth 175 points across eight decisions: 25 each for the left
 * turn, the overtaking restriction and the parking technique — the three where
 * the module's rule is most specific and getting it wrong puts the car across
 * somebody else's lane — and 20 each for the other five.
 *
 * The pass mark sits at 69% of the total, the same share Levels 4 and 5 use,
 * and the stars at the 83% and 95% this level always had. Three of the eight
 * are passed by not coming to rest, so a driver who never stops collects them
 * without knowing a rule. That alone does not pass: the two turns are worth 45
 * and a missed one costs points besides.
 */
export const level6: LevelConfig = {
  id: 6,
  name: levelModule.title,
  moduleId: levelModule.id,
  description: levelModule.desc,
  // Last event at 6210 plus its checkpoint-sized window, and then a runway long
  // enough for the car to pull back out of the bay and drive clear of it.
  roadLength: 6910,
  // A city route through junctions and parked traffic, matching Level 5. Every
  // manoeuvre here is made across somebody else's lane, and the speeds the
  // grader judges "slowed" against should be the ones that deserves.
  speedLimit: 40,
  requiredScore: 121,
  stars2: 145,
  stars3: 166,
  events: buildEvents(SLOTS, SLOT_DISTANCES, pool => pool[0]),
  /**
   * A two-way city carriageway: one lane of opposing traffic at the left, then
   * two lanes of your own.
   *
   * This is what makes the level's two central rules mean anything. "Turn into
   * the lane nearest the centre line" needs a center line to be near, and "do
   * not cross to overtake" needs a side of the road that is not yours — and
   * being over there costs points continuously, not only where an event happens
   * to be measuring.
   */
  paint: {
    oncomingLanes: 2,
    // Broken yellow, not `centre_line`: that one paints the divide between the
    // opposing lanes solid *white*, which is the same colour and weight as the
    // dashes between your own two lanes. On a road where the whole lesson is
    // which side is yours, the one line that has to be unmistakable was the one
    // line drawn to look like all the others. Broken yellow also says the true
    // thing about this road — crossing to overtake is permitted here when it is
    // safe, which is exactly what the span below then takes away.
    base: 'broken_yellow',
    spans: [
      // The no-overtaking stretch, laid over the road rather than drawn as an
      // event, so the line the driver must not cross is continuous either side
      // of the point where crossing it is measured. It starts 40 before the
      // zone opens (3060 less its 380 lead), past the blank a change of paint
      // leaves, because a crossing is failed on any frame of the zone
      // (`declaredLineSpans` paints a borrowed line the same way).
      { from: 2640, to: 3310, art: 'double_solid_yellow' },
    ],
  },
};
