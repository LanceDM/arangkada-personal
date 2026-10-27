import { getLevelModule } from '@/features/driving-sim/domain/scenario/content/lessons/lessonCatalog';
import { buildEvents, type SlotVariant } from '@/features/driving-sim/domain/scenario/pooling';
import type { LevelConfig } from '@/features/driving-sim/domain/scenario/scenarioDefinition';

const levelModule = getLevelModule(8);

/**
 * The school run: a barangay street at drop-off, the road along the river, and
 * the avenue into town. Six things happen on it, none of them your fault, and
 * every one of them is still yours to avoid.
 *
 * Every level up to here asks the driver to read something and obey it — a
 * sign, a marking, a right-of-way rule, a lane assignment, a speed. This module
 * introduces no new rule. It asks whether the driver notices a risk before it
 * becomes one, keeps room around the car, and stays the same person when
 * somebody else does not.
 *
 * ## Six questions, six different answers
 *
 * The level this replaced asked one question six ways. Three of its seven
 * scenarios were the same following-gap check, two more were the same full
 * stop, and every correct answer was some version of "slow down". So the route
 * below is built from the measurements the engine can honestly take, used once
 * each:
 *
 * | Scenario        | What is measured                    |
 * |-----------------|-------------------------------------|
 * | School gate     | the speed carried to the gate       |
 * | Hold your line  | how far the car wandered sideways   |
 * | Blind bend      | the lane it was in at the bend      |
 * | Let them out    | whether it came to rest             |
 * | Two seconds     | the gap held, every frame           |
 * | Both at once    | a stop, and the horn                |
 *
 * ## Three stretches of road, and you can see which one you are on
 *
 * The route declares its own roadside, so the world changes as it is driven:
 * houses and awnings and a covered court through the barangay, a seawall and
 * open water along the river, ordinary frontage on the avenue. A level whose
 * whole subject is *noticing things* cannot be run down the same anonymous
 * green verge for five minutes.
 *
 * ## Where the pressure comes from, and where it does not
 *
 * One aggressive driver, once, at the end. They arrive while a school van ahead
 * is stopping with a child beside it, and nothing about them changes what the
 * child needs. That is the whole of the level's argument, and it is the last
 * thing it asks.
 *
 * The horn is never the answer here. It is watched on the one scenario where
 * sounding it would be retaliation, and it costs the event — but no scenario
 * requires it, so a driver who never touches it can score full marks.
 */

/**
 * The stretch each scenario sits on. Named so the route below and the events
 * cannot drift apart from one another.
 */
const BARANGAY_ENDS = 2150;
const RIVERSIDE_ENDS = 3850;
const ROUTE_END = 5760;

/* -------------------------------------------------------------------------
 * Act one — nothing has gone wrong yet
 * ---------------------------------------------------------------------- */

// 1. The school gate — module section 2, the Predict step, and section 8's list
// of road users owed extra care. Nobody is in the road and nothing misbehaves:
// the whole event is whether the speed came off while the only evidence was a
// stopped van, its hazards, and children on the footpath.
const schoolGateSlot: SlotVariant[] = [
  {
    id: 'level8.school-gate',
    label: 'School gate',
    // An obstacle with people beside it, not a crossing: there is no zebra at
    // this gate and nobody is in the road yet, which is the whole point of the
    // scenario. The van is what the scene is built from and the children on the
    // footpath compose beside it.
    type: 'obstacle_ahead',
    // Children on the footpath, not on the carriageway. Nothing here is solid,
    // because nothing here is in the way yet — that is the point of the event.
    pedestrians: [
      { kind: 'child', position: 1.09 },
      { kind: 'child', position: 1.2 },
      { kind: 'adult', position: 1.31 },
    ],
    description:
      'A van is stopped at the curb with its hazards on. Children are waiting on the footpath by the school gate.',
    recommendedMove: 'Be under 20 km/h before the gate.',
    correctAction: 'brake',
    points: 25,
    // Long enough that the speed comes off gradually rather than in one grab of
    // the brake: from the level's top speed this is over six seconds of road.
    warningDistance: 500,
    penaltyMessage:
      'You reached the gate at speed. Children step out from behind stopped vehicles, and hazards mean one is about to.',
    rewardMessage: 'Correct. You had the speed off well before the gate.',
    duration: 200,
    lawCitation:
      'SIPDE: search and scan the road ahead, identify potential hazards, predict what other road users are likely to do, decide what avoids the unsafe situation, and execute it. Give extra care and right-of-way to pedestrians such as children, senior citizens, PWDs, pregnant women and road workers.',
    competency: 'hazard_awareness',
    severity: 'major',
    actor: { kind: 'van', side: 'curb', hazards: true },
  },
];

// 2. The rider alongside — module section 8, read from the driver's side. The
// only scenario in the game about a vehicle that is neither ahead of you nor
// behind you but level with your door, and the only one graded on whether the
// car moved sideways at all. Speed is deliberately not part of it: easing off
// while somebody comes past is a good answer, and grading it would turn "hold
// your line" into "hold your speed".
const holdYourLineSlot: SlotVariant[] = [
  {
    id: 'level8.hold-your-line',
    label: 'Rider alongside',
    type: 'scenario_trigger',
    description:
      'A motorcycle comes up behind you and filters past along the line between your two lanes.',
    recommendedMove: 'Stay steady. Give the rider space.',
    correctAction: 'accelerate',
    points: 30,
    warningDistance: 480,
    // The horn failure. The drift failure has its own line below, so whichever
    // went wrong is what the driver is told about.
    penaltyMessage:
      'The horn is not a warning here, it is a reply. A rider beside your door cannot go anywhere while you use it.',
    rewardMessage: 'Correct. You held your line and let the rider through.',
    duration: 200,
    lawCitation:
      'Give courtesy and respect to active-transport and light-mobility users. Check your blind spots before any movement that could affect a rider beside you, and do not blow the horn annoyingly or excessively — it is listed among the habits of an aggressive driver.',
    // Graded on holding the lane while a rider filters past, so lane discipline
    // rather than pedestrians (catalogue review 2026-10-28).
    competency: 'lane_discipline',
    severity: 'critical',
    // A third of the room between a centred car and the rider's line. Enough
    // that a driver easing off or correcting the wheel is never marked down,
    // and short enough that the verdict lands while there is still air between
    // the two of them — a wander is told to the driver, not demonstrated.
    lineHold: {
      maxDrift: 16,
      driftedMessage:
        'You drifted while the rider was alongside. Squeezing somebody on two wheels leaves them nowhere to go.',
    },
    avoid: ['honk'],
    npc: {
      path: 'filtering_past',
      vehicleKind: 'motorcycle',
      label: 'a motorcycle filtering past you',
      mirror: true,
    },
  },
];

/* -------------------------------------------------------------------------
 * Act two — other people start making mistakes
 * ---------------------------------------------------------------------- */

// 3. The blind bend — module section 2 again, applied to the road itself rather
// than to a person. The one scenario graded on which lane the car is in, and
// the only one that needs a lane change: the drive starts against the center
// line, and the safe line round a left-hander is the far side of your own half.
const blindBendSlot: SlotVariant[] = [
  {
    id: 'level8.blind-bend',
    label: 'Blind bend',
    type: 'scenario_trigger',
    description:
      'The river road bends left behind the seawall. A bus is coming the other way and the center line is solid.',
    recommendedMove: 'Keep right through the bend.',
    correctAction: 'brake',
    points: 30,
    warningDistance: 500,
    penaltyMessage:
      'You took the bend on the inside. The line is solid because nobody can see round it, and the bus was already committed.',
    rewardMessage: 'Correct. Wide of the bend, in your own lane, well clear of the bus.',
    duration: 200,
    lawCitation:
      'Follow the speed limit with the weather and the road in mind, and never cross a solid center line. Look ahead to have an advance plan for road crashes and emergencies, and do not overtake on a curve where it is not safe.',
    competency: 'lane_discipline',
    severity: 'critical',
    // The road genuinely bends, so holding a lane through it takes steering.
    effect: { curve: 'left', curveStrength: 0.85, span: 120 },
    requiredLane: {
      lane: 'curb',
      hint: 'Move to the curb lane',
      wrongLaneMessage:
        'You were against the center line through a bend you cannot see round. That is the half of the road the bus needs.',
    },
    npc: {
      path: 'oncoming_through',
      vehicleKind: 'bus',
      label: 'a bus coming the other way',
      // Past the warning distance, so the bus is already coming round at the
      // bend when the scenario is read rather than arriving afterwards: the
      // briefing says one is coming the other way, and the road has to agree.
      approachSpan: 540,
    },
  },
];

// 4. Letting somebody out — module section 4, courtesy, and section 2's "never
// insist on the right-of-way". The only scenario in the level where the correct
// action helps somebody else move rather than protecting the driver, and the
// only one whose reward is a change in the world: the jeepney is held at the
// mouth until this is answered, and then it takes the gap.
const letThemOutSlot: SlotVariant[] = [
  {
    id: 'level8.let-them-out',
    label: 'Jeepney at a side street',
    type: 'scenario_trigger',
    scene: 'side_road',
    description:
      'A jeepney is waiting at the mouth of a side street on your right, nosed out and unable to join.',
    recommendedMove: 'Stop and let the jeepney out.',
    correctAction: 'stop',
    points: 25,
    warningDistance: 480,
    penaltyMessage:
      'The right-of-way was yours and holding it cost them the gap. Insisting on priority is on the list of habits that cause crashes.',
    rewardMessage: 'Correct. A few seconds of your time, and they were away.',
    duration: 200,
    lawCitation:
      'Courtesy is politeness in your attitude and behavior toward other road users: be courteous and give the right-of-way when appropriate. Never insist on the right-of-way, since it can trigger a road crash or road rage, and put away your pride, because driving is not a contest.',
    competency: 'general_rules',
    severity: 'major',
    npc: {
      path: 'crossing_from_right',
      vehicleKind: 'jeepney',
      label: 'a jeepney waiting to come out',
      // Nosed out and waiting, and it completes the join once the scenario has
      // been answered. A courtesy the world does nothing with is a courtesy the
      // player has to be told about rather than shown.
      emerges: true,
      yields: true,
      // Where it is already waiting at the mouth: the briefing describes a
      // jeepney waiting there, so one has to be there while it is read, and
      // the widest theta, 1.5, opens the approach 720 units out.
      approachSpan: 740,
    },
  },
];

// 5. The gap — module section 2's tailgating row, and the level's one
// continuous measurement. Everything else here is read at a point; this is read
// every frame, which is the only honest way to grade a distance that a driver
// can open and close at will.
const twoSecondsSlot: SlotVariant[] = [
  {
    id: 'level8.two-seconds',
    label: 'Truck in heavy traffic',
    type: 'obstacle_ahead',
    description:
      'A loaded truck is in your lane on the avenue. Its brake lights keep coming on in the stop-start traffic.',
    recommendedMove: 'Keep two seconds of road to the truck.',
    correctAction: 'brake',
    points: 30,
    warningDistance: 480,
    penaltyMessage:
      'You closed inside two seconds. The gap is not for the stop you expect, it is for the one you do not.',
    rewardMessage: 'Correct. You gave the truck room to stop in.',
    duration: 200,
    lawCitation:
      'Common driving habits that lead to a crash: tailgating. Maintain a suitable braking distance when following a vehicle, and consider your own vehicle’s length, width and weight when judging what that distance is. A following gap is measured in time rather than in meters, so it holds at any speed.',
    competency: 'hazard_awareness',
    severity: 'critical',
    npc: {
      path: 'travelling_ahead',
      vehicleKind: 'truck',
      label: 'the truck ahead of you',
      // No lane: it joins in the one the car is in, which is what "in your
      // lane" says. It was the curb lane, which is where the bend leaves a
      // driver on this level but not on Level 12 or the levels it is practised
      // on, where the car runs nearest the center line and the gap graded was
      // to a truck in the next lane.
      //
      // And on the road before the scenario is read, at every theta: the
      // widest, 1.5, opens the approach 720 units out.
      approachSpan: 740,
      // Three seconds at the limit — the gap a driver is already meant to be
      // keeping, so the scenario starts from a lawful following distance and
      // asks only whether they keep it once the truck slows. Four put the
      // truck near the horizon and left a driver who never lifted off still
      // outside two seconds at the line, which graded the wrong thing.
      entryHeadway: 3,
      // Cruises at the limit and drops to a third of it on the run-in, so the
      // gap closes because the truck slowed rather than because the driver
      // chose to catch it. A third rather than nothing: the gap has to be
      // losable without the closing being unsurvivable, or a driver would be
      // removed from the level by an impact instead of graded on the room they
      // left.
      speed: { cruise: 1, slowsTo: 0.35, slowsFrom: 420 },
    },
    following: {
      seconds: 2,
      tooCloseMessage:
        'You were inside two seconds of the truck. Pick a point on the road: if you reach it before two seconds are up, the gap is not there.',
    },
  },
];

/* -------------------------------------------------------------------------
 * Act three — both at once
 * ---------------------------------------------------------------------- */

// 6. The finale — module section 7's "Don't Be A Victim", over the top of
// section 8's vulnerable users. Two things the level has already taught, asked
// together: the hazard cue from the school gate, and the emotional control that
// has not been graded until now. Nothing behind you changes what the child in
// front of you needs.
const bothAtOnceSlot: SlotVariant[] = [
  {
    id: 'level8.both-at-once',
    label: 'Both at once',
    // The van ahead is the scene; the child beside its door composes onto it.
    // Not a crossing, for the same reason the school gate is not one.
    type: 'obstacle_ahead',
    // On the curb at the point the scenario is graded, which is between the
    // driver and the van rather than beside its door: the van carries its own
    // road distance and is a couple of hundred units further up, so a child
    // pinned to it would be a child the prose put somewhere the road does not.
    // Clear of both running lanes, so the cue is a person and not an obstacle —
    // the stop is asked for by what is about to happen, not by what already has.
    pedestrians: [{ kind: 'child', position: 1.06 }],
    description:
      'The school van ahead stops and puts its hazards on. A child has stepped down onto the curb between you and it, and a car closes up behind you.',
    recommendedMove: 'Stop behind the van and wait.',
    correctAction: 'stop',
    points: 30,
    warningDistance: 500,
    penaltyMessage:
      'You were pushed past a child getting out of a van. Whoever is behind you is not the one you would have hit.',
    rewardMessage: 'Correct. You stopped for the child and let the car behind wait.',
    duration: 200,
    lawCitation:
      "A school service stopped with its hazard lights on means students may cross: slow down and prepare to stop, and give way to it (Level 2 module, right-of-way). Give extra care and right-of-way to children. The car closing up behind does not change that duty: don't be a victim of road rage; keep your distance and put away your pride, because driving is not a contest.",
    competency: 'pedestrians',
    severity: 'critical',
    // Sounding the horn fails this outright. It is the one place in the level
    // the horn is graded, and it is never the answer anywhere.
    avoid: ['honk'],
    npc: {
      path: 'travelling_ahead',
      vehicleKind: 'van',
      label: 'the school van ahead of you',
      lane: 'curb',
      hazards: true,
      approachSpan: 560,
      entryHeadway: 3.4,
      // Down to a crawl at the point the child gets out, then away again once
      // the scenario is behind, so a driver who stopped is not left sitting
      // behind a vehicle that never moves.
      speed: { cruise: 1, slowsTo: 0.08, slowsFrom: 400 },
    },
    // The pressure, on the road rather than in the prose. It comes up the
    // driver's own lane and settles about a second back — close enough to fill
    // the mirror, and holding rather than closing, because a scenario that can
    // rear-end a driver for stopping correctly is not teaching them to stop.
    // Nothing here is graded: the car behind is what makes the right answer
    // hard, never what decides whether it was given.
    rear: {
      path: 'closing_from_behind',
      vehicleKind: 'car',
      label: 'the car behind you',
      lane: 'curb',
      mirror: true,
      closing: { approach: 1.15, pass: 1.3, holdSeconds: 1 },
    },
  },
];

export const SLOT_DISTANCES = [990, 1790, 2600, 3400, 4200, 5010];
export const SLOTS: SlotVariant[][] = [
  schoolGateSlot,
  holdYourLineSlot,
  blindBendSlot,
  letThemOutSlot,
  twoSecondsSlot,
  bothAtOnceSlot,
];

/**
 * The drive is worth 160 points across six scenarios: 30 each for the two where
 * getting it wrong means a head-on or a child, and 25 for the other four.
 *
 * The pass mark sits at 69% of the total, the share every level from 4 onwards
 * uses, and the thresholds were set after the mechanics were verified by
 * driving rather than by arithmetic. `level8Drive.test.ts` runs every strategy
 * below through the real session:
 *
 * - **Accelerate at everything** ends in the back of the truck.
 * - **Brake at everything** never comes to the two full stops the level asks
 *   for, and a crawl is not a stop.
 * - **Stop at everything** fails the bend, which is a lane and not a speed.
 * - **Never change lane** fails the bend for the same reason.
 * - **Hold the wheel over** fails the line hold and the bend, and spends the
 *   level on the wrong side of the road.
 * - **Lean on the horn** fails the two scenarios that watch for it.
 */
export const level8: LevelConfig = {
  id: 8,
  name: levelModule.title,
  moduleId: levelModule.id,
  description: levelModule.desc,
  // Six events 800 to 810 apart, plus a runway past the last one long enough
  // for its measurement window to close before the road ends.
  roadLength: ROUTE_END,
  // A city street, matching Levels 5 and 6. Every hazard here is a person or a
  // vehicle that can appear with no notice, and "slowed down" should mean what
  // it means on that kind of road.
  speedLimit: 40,
  // Seventy per cent of a route worth 170. The ladder underneath it is the
  // calibration: a clean run scores everything, one lapse at a *major*
  // scenario still clears the mark by six, and one at a critical — the rider,
  // the bend, the gap, the child — costs sixty and misses it by ten. That is
  // the level saying which mistakes it is prepared to forgive.
  requiredScore: 120,
  stars2: 142,
  stars3: 162,
  events: buildEvents(SLOTS, SLOT_DISTANCES, pool => pool[0]),
  /**
   * An ordinary two-way city street: four lanes, the left two carrying
   * opposing traffic.
   *
   * The bend at event 3 only means anything on a road with a half that is not
   * yours, and being over there costs points continuously rather than only
   * where a scenario happens to be measuring.
   */
  paint: {
    oncomingLanes: 2,
    // Broken yellow rather than `centre_line`, for Level 6's reason: the solid
    // white one paints the divide between the opposing directions in the same
    // color and weight as the dashes between your own two lanes, and on a road
    // where which side is yours decides a scenario, that line has to be
    // unmistakable.
    base: 'broken_yellow',
    spans: [
      // Solid through the bend and a little either side of it, so the line the
      // driver must not cross is continuous across the whole of the curve
      // rather than appearing at the one point it is measured.
      { from: 2400, to: 2850, art: 'double_solid_yellow' },
    ],
  },
  /**
   * Three stretches of road, in the order they are driven.
   *
   * The only thing this level declares a route for is its roadside, and that is
   * enough: the verge is what tells a driver where they are before any sign
   * does, and a mission about noticing things cannot run down five thousand
   * units of identical green bank.
   */
  route: {
    segments: [
      { from: 0, to: BARANGAY_ENDS, roadside: 'barangay' },
      { from: BARANGAY_ENDS, to: RIVERSIDE_ENDS, roadside: 'riverside' },
      { from: RIVERSIDE_ENDS, to: ROUTE_END, roadside: 'mixed' },
    ],
  },
};
