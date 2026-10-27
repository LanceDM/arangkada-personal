import { getLevelModule } from '@/features/driving-sim/domain/scenario/content/lessons/lessonCatalog';
import { buildEvents, filterByWeakCompetency, type SlotVariant } from '@/features/driving-sim/domain/scenario/pooling';
import type { DrivingCompetency } from '@/domain/learner/competency';
import type { LevelConfig } from '@/features/driving-sim/domain/scenario/scenarioDefinition';

const levelModule = getLevelModule(5);

/**
 * A right-of-way drive: eight junctions, each asking the same question in a
 * different form — who goes first here, and how do you show it?
 *
 * Level 3 asks what is standing beside the road and Level 4 asks what is
 * painted under the wheels. Both are reading tasks with a single correct
 * reading. This level is the first where the road itself contains somebody
 * else, and where the answer depends on what that other party is doing rather
 * than on what a sign says. Every variant below therefore carries an `npc` or a
 * `pedestrians` list: a rule about yielding needs something to yield to, or it
 * is only a sentence.
 *
 * ## Why the pools are deep here
 *
 * This level used to be fixed content — eight slots holding one variant each.
 * The argument for that was that right-of-way has no catalogue to draw from the
 * way signs and markings do, and shuffling eight fixed situations would change
 * their order without changing what is being asked.
 *
 * That argument was wrong in one specific way, and the way it was wrong is the
 * whole design of this file. A pool of one teaches the *situation*, not the
 * rule. A learner who only ever meets a car arriving from their right learns
 * "there is a car at the junction, therefore stop" — which passes this level
 * and fails a real one, because it is not the rule. RA 4136 says the vehicle on
 * the *left* yields; the mirror image of that junction has the opposite answer
 * and looks almost identical.
 *
 * So every slot that can hold a "you must give way" case also holds the case
 * where the priority is yours and going is correct. Deciding *not* to yield is
 * as much a right-of-way judgment as deciding to, and a pool that never asks
 * for it is training a reflex rather than teaching a rule.
 *
 * ## One slot freezes the simulation, seven are driven
 *
 * Seven slots are driven and graded on what the vehicle actually did — the
 * telemetry grader reads speed, lane and whether the car came to rest, which
 * covers stopping for a pedestrian, holding at a stop line, moving over for an
 * ambulance, and — at an uncontrolled crossroads — slowing to give way or
 * carrying on to take priority. The uncontrolled junctions used to freeze on
 * the argument that "who goes first" is not a speed; in practice a long, early
 * warning plus the crossing vehicle itself lets the player read the situation
 * and answer it by braking or not, which is a real driving action and reads far
 * better than a sudden freeze.
 *
 * Only the roundabout still freezes. A rotunda cannot be driven on a corridor
 * that never forks (see the `RoadScene` note in types.ts): there is no way to
 * enter it, circulate, and take an exit, and driving straight ahead would send
 * the car through the central island. So the roundabout keeps `cutscene`, which
 * freezes the drive and hands the decision to `RoadDecision`; its
 * resolution plays the circulating vehicle without driving the player over the
 * island. `cutscene` variants are also excluded from `remediationPool.ts`, so
 * the roundabout's content can never be reused as practice in a later level.
 *
 * ## What is deliberately not here
 *
 * Following distance, overtaking judgment and unexpected hazards were all
 * considered for this level and left out. The curriculum's traceability matrix
 * assigns them to Levels 7, 6/7 and 8/9 respectively, and all of those levels
 * exist with content in them. A learner who is weak on those competencies will
 * still meet them here — `remediationPool.ts` pulls portable variants from any
 * earlier level into whatever level is being played — which is a better answer
 * than duplicating them, because the practice is then targeted rather than
 * scheduled.
 */

/**
 * Two citations get quoted often enough across these pools to be worth naming,
 * so a wording fix lands in one place rather than in nine string literals.
 */
const RA4136_LEFT_YIELDS =
  'RA 4136: the vehicle on the left shall yield the right-of-way to the vehicle on the right, except where another right-of-way rule applies.';
const RA4136_CROSSWALK =
  'RA 4136: the driver shall yield the right-of-way to a pedestrian crossing within a crosswalk, except where a peace officer or traffic signal is regulating the crossing.';

/* -------------------------------------------------------------------------
 * Slot 1 — Uncontrolled junctions. Driven: the crossing vehicle is on the road
 * and announced far ahead, so the player reads who has priority and answers by
 * slowing to give way or carrying on to take it.
 *
 * Module section 1. The pool covers all three shapes the module's own table
 * gives: left yields to right, the mirror of that, and the oncoming vehicle
 * turning left across you that has priority *because it signalled*.
 * ---------------------------------------------------------------------- */
const uncontrolledCrossroadsSlot: SlotVariant[] = [
  {
    id: 'level5.uncontrolled-crossroads.car-from-right',
    type: 'scenario_trigger',
    scene: 'intersection',
    // Driven, not frozen: you read the situation on the long approach and
    // answer it by what the car does — slow to give way, or carry on to take
    // the priority that is yours. Announced far ahead so there is time to read.
    warningDistance: 460,
    description:
      'A crossroads with no signal, no stop sign and no give-way line. A car is arriving from your right at the same moment you do.',
    question: 'Neither road is controlled and you both reach the junction together. Who goes first?',
    choices: [
      { label: 'The car on your right goes first; hold back and let it clear', action: 'brake' },
      { label: 'You go first, since you are already moving and it has not entered yet', action: 'accelerate' },
      { label: 'Sound the horn to claim the junction, then go', action: 'honk' },
    ],
    correctAction: 'brake',
    points: 20,
    penaltyMessage: `At an uncontrolled junction the vehicle on the left yields to the vehicle on the right. Taking the junction from the left is a right-of-way violation.`,
    rewardMessage: 'Correct. You were the vehicle on the left, so the car on your right had priority.',
    duration: 200,
    lawCitation: RA4136_LEFT_YIELDS,
    competency: 'right_of_way',
    severity: 'major',
    npc: {
      path: 'crossing_from_right',
      vehicleKind: 'car',
      label: 'a car approaching from your right',
      color: '#dc2626',
    },
  },
  {
    // The mirror, and the reason this slot is a pool at all. Same junction,
    // same absence of any sign, other car on the other arm — and the correct
    // answer inverts. A learner who has only met the variant above will fail
    // this one by doing what worked last time, which is exactly the reflex
    // this level should be catching.
    id: 'level5.uncontrolled-crossroads.car-from-left',
    type: 'scenario_trigger',
    scene: 'intersection',
    // Driven, not frozen: you read the situation on the long approach and
    // answer it by what the car does — slow to give way, or carry on to take
    // the priority that is yours. Announced far ahead so there is time to read.
    warningDistance: 460,
    description:
      'A crossroads with no signal, no stop sign and no give-way line. A car is arriving from your left at the same moment you do.',
    question: 'Neither road is controlled and you both reach the junction together. Who goes first?',
    choices: [
      { label: 'You go first — you are the vehicle on its right', action: 'accelerate' },
      { label: 'Give way to it, because it reached the junction at the same time', action: 'brake' },
      { label: 'Stop completely and wave it through', action: 'stop' },
    ],
    correctAction: 'accelerate',
    points: 20,
    penaltyMessage: `The vehicle on the left yields to the vehicle on the right, and here that vehicle is the other one. Giving way when the priority is yours is not caution — it leaves both drivers guessing and holds up everyone behind you.`,
    rewardMessage: 'Correct. You were on its right, so the priority was yours and you took it cleanly.',
    duration: 200,
    lawCitation: RA4136_LEFT_YIELDS,
    competency: 'right_of_way',
    severity: 'major',
    // Harder than its mirror: the rule is identical, but acting on it means
    // overriding the instinct to stop for anything that moves.
    npc: {
      path: 'crossing_from_left',
      vehicleKind: 'car',
      label: 'a car approaching from your left',
      color: '#dc2626',
      // You are the vehicle on its right, so it yields: it comes up to its
      // give-way line and holds, leaving the box clear for you to take. Without
      // this it crossed into the box as you arrived and forced a stop the rule
      // says you should never have had to make.
      yields: true,
    },
  },
  {
    id: 'level5.uncontrolled-crossroads.oncoming-left-turn',
    type: 'scenario_trigger',
    scene: 'intersection',
    // Driven, not frozen: you read the situation on the long approach and
    // answer it by what the car does — slow to give way, or carry on to take
    // the priority that is yours. Announced far ahead so there is time to read.
    warningDistance: 460,
    description:
      'An oncoming car has been signaling left and is already turning across your path into the side road.',
    question: 'It is turning left across you, and it signaled before it began. Who goes first?',
    choices: [
      { label: 'It does — it signaled and is already committed to the turn', action: 'brake' },
      { label: 'You do, because oncoming traffic always yields to traffic going straight', action: 'accelerate' },
      { label: 'Whoever entered the junction first, regardless of signals', action: 'honk' },
    ],
    correctAction: 'brake',
    points: 20,
    penaltyMessage: `A vehicle already turning left across you has the right-of-way when it gave a plainly visible signal of its intention. Driving into the turn it is halfway through is a right-of-way violation, not its mistake.`,
    rewardMessage: 'Correct. It signaled and was already within the junction, so it had the right-of-way.',
    duration: 200,
    lawCitation:
      'RA 4136: a driver shall yield to a vehicle already within the intersection, or one turning left across their path, provided that turning vehicle gave a plainly visible signal of its intention to turn.',
    competency: 'right_of_way',
    severity: 'major',
    npc: {
      path: 'oncoming_turning_left',
      vehicleKind: 'car',
      label: 'an oncoming car turning left across you',
      color: '#dc2626',
    },
  },
  {
    // The easiest reading in the pool: the other vehicle is not arriving, it is
    // already there. Kept as tier 1 so a learner who has been getting this
    // competency wrong has somewhere to succeed.
    id: 'level5.uncontrolled-crossroads.already-inside',
    type: 'scenario_trigger',
    scene: 'intersection',
    // Driven, not frozen: you read the situation on the long approach and
    // answer it by what the car does — slow to give way, or carry on to take
    // the priority that is yours. Announced far ahead so there is time to read.
    warningDistance: 460,
    description:
      'You reach an uncontrolled crossroads that a car is already part-way across, still clearing your side of the junction.',
    question: 'A vehicle is already inside the junction as you arrive. What do you do?',
    choices: [
      { label: 'Wait for it to clear — a vehicle already inside has the right-of-way', action: 'brake' },
      { label: 'Carry on; it will be out of the way by the time you get there', action: 'accelerate' },
      { label: 'Sound the horn so it hurries across', action: 'honk' },
    ],
    correctAction: 'brake',
    points: 20,
    penaltyMessage: `A vehicle already within the intersection has the right-of-way over one that has not entered it yet. Timing a gap through a junction somebody is still occupying is how right-angle collisions happen.`,
    rewardMessage: 'Correct. It was already inside the junction, so it finished crossing before you entered.',
    duration: 200,
    lawCitation:
      'RA 4136: a driver approaching but not yet within an intersection shall yield to a vehicle already within it.',
    competency: 'right_of_way',
    severity: 'major',
    npc: {
      path: 'crossing_from_right',
      vehicleKind: 'car',
      label: 'a car already crossing the junction',
      color: '#dc2626',
      // Already in the box: it sits dead centre from the moment the junction is
      // on screen and only clears once you have arrived, so "a vehicle is
      // already inside" is something you can see, not just read. See `inBox`.
      inBox: true,
    },
  },
  {
    // A second don't-yield case, and a different reason from `car-from-left`.
    // There the priority was yours by the left/right rule; here the other
    // driver has already resolved the question by stopping and waiting. The
    // answer is the same and the reasoning is not, which is the point — a
    // learner who has only met one route to "go" has memorised a picture.
    id: 'level5.uncontrolled-crossroads.waiting-on-the-left',
    label: 'Car stopped on the left',
    type: 'scenario_trigger',
    scene: 'intersection',
    // Driven, not frozen: you read the situation on the long approach and
    // answer it by what the car does — slow to give way, or carry on to take
    // the priority that is yours. Announced far ahead so there is time to read.
    warningDistance: 460,
    description:
      'At an uncontrolled crossroads, a car on the side road to your left has stopped short of the junction.',
    question: 'It has stopped and is waiting for you. What is the correct thing to do?',
    choices: [
      { label: 'Carry on through — it has given way, so take the gap predictably', action: 'accelerate' },
      { label: 'Stop as well, and wave it across first', action: 'stop' },
      { label: 'Slow to a crawl until you are sure what it intends', action: 'brake' },
    ],
    correctAction: 'accelerate',
    points: 20,
    penaltyMessage: `It had already yielded, which settled the junction. Stopping to hand the priority back leaves two drivers each waiting for the other, and waving somebody across offers them a gap you cannot see past.`,
    rewardMessage: 'Correct. It gave way, so you took the junction cleanly instead of negotiating over it.',
    duration: 200,
    lawCitation: RA4136_LEFT_YIELDS,
    competency: 'right_of_way',
    severity: 'major',
    npc: {
      path: 'crossing_from_left',
      vehicleKind: 'car',
      label: 'a car waiting on the side road',
      color: '#dc2626',
      // Comes up the side road and stops at its give-way line, holding there
      // while you pass — the driver has settled the junction by yielding, and
      // you can see it do so. See `yields` on NpcVehicleSpec.
      yields: true,
    },
  },
];

/* -------------------------------------------------------------------------
 * Slot 2 — Pedestrians. Driven: stopping short of a line and holding there is
 * exactly what the telemetry grader measures best.
 *
 * Module section 3. Every variant here is the same crossing element with a
 * different cast: scenes are composed from declared parts rather than owned
 * by a level.
 * ---------------------------------------------------------------------- */
const crossingYieldSlot: SlotVariant[] = [
  {
    id: 'level5.crossing-yield.parent-and-child',
    type: 'pedestrian_crossing',
    scene: 'crosswalk',
    description:
      'A parent and a small child step onto a marked pedestrian lane ahead of you.',
    // The two people this event is actually about. Until `pedestrians` existed
    // the renderer picked one sprite by searching this description for "bata"
    // or "lola", matched neither, and drew a single anonymous adult — so the
    // child the whole penalty message turns on was never on screen. The parent
    // is the solid one, standing exactly where the lone pedestrian used to, so
    // the collision this event grades is unchanged.
    pedestrians: [
      { kind: 'adult', solid: true },
      { kind: 'child' },
    ],
    correctAction: 'stop',
    points: 25,
    // A person can be driven into here, so the approach needs enough road to
    // actually shed speed in, not merely enough to read a sign in.
    warningDistance: 340,
    penaltyMessage: `Pedestrians inside a marked crossing hold the right-of-way, and a child gives you no margin for a misjudged gap. Failing to stop is a critical violation.`,
    rewardMessage: 'Correct. You stopped clear of the lane and let them finish crossing.',
    duration: 200,
    lawCitation: RA4136_CROSSWALK,
    competency: 'pedestrians',
    severity: 'critical',
  },
  {
    id: 'level5.crossing-yield.elderly',
    type: 'pedestrian_crossing',
    scene: 'crosswalk',
    description:
      'An elderly woman is part-way across a marked pedestrian lane, walking slowly.',
    pedestrians: [{ kind: 'elderly', solid: true, position: 0.35 }],
    correctAction: 'stop',
    points: 25,
    warningDistance: 340,
    penaltyMessage: `A pedestrian in a marked crossing has the right-of-way for as long as it takes them to finish crossing. Creeping forward to hurry somebody who cannot walk faster is both unsafe and unlawful.`,
    rewardMessage: 'Correct. You stopped and gave her the time she needed.',
    duration: 200,
    lawCitation: RA4136_CROSSWALK,
    competency: 'pedestrians',
    severity: 'critical',
  },
  {
    id: 'level5.crossing-yield.pwd',
    type: 'pedestrian_crossing',
    scene: 'crosswalk',
    description:
      'A person using a wheelchair is crossing on the marked pedestrian lane ahead.',
    pedestrians: [{ kind: 'pwd', solid: true, position: 0.3 }],
    correctAction: 'stop',
    points: 25,
    warningDistance: 340,
    penaltyMessage: `A person with a disability crossing on a pedestrian lane needs extra time, not less. Rolling forward or revving to hurry them across is a critical failure of both the law and basic courtesy.`,
    rewardMessage: 'Correct. You held a full stop and let them cross at their own pace.',
    duration: 200,
    lawCitation: RA4136_CROSSWALK,
    competency: 'pedestrians',
    severity: 'critical',
  },
  {
    // The hardest reading in this pool, because the rule inverts: away from a
    // crossing the pedestrian is the one who must give way. The module makes
    // exactly this move — the rule says one thing, and a prudent driver still
    // covers the brake, because pedestrians do not always follow it.
    //
    // Graded as `brake` rather than `stop` for that reason: slowing enough to
    // be able to stop is what is being asked, and a driver who does come to a
    // full stop still passes, since a stop satisfies any request to slow.
    id: 'level5.crossing-yield.outside-crosswalk',
    type: 'pedestrian_crossing',
    scene: 'open_road',
    description:
      'A man steps off the curb and starts across the road, nowhere near a pedestrian lane.',
    pedestrians: [{ kind: 'adult', solid: true, position: 0.2 }],
    correctAction: 'brake',
    points: 25,
    warningDistance: 340,
    penaltyMessage: `A pedestrian crossing away from a crosswalk must yield to you — but right-of-way decides who was at fault, not who gets hurt. Holding your speed because the rule is on your side leaves you nothing when they keep walking.`,
    rewardMessage: 'Correct. The right-of-way was yours, and you still slowed enough to stop for him.',
    duration: 200,
    lawCitation:
      'RA 4136: a pedestrian crossing at a point other than a crosswalk shall yield the right-of-way to vehicles on the highway. A driver at unlawful speed forfeits any right-of-way they would otherwise hold.',
    competency: 'pedestrians',
    severity: 'critical',
  },
];

/* -------------------------------------------------------------------------
 * Slot 3 — Junctions that carry a control: a Stop sign or a Give Way sign.
 * Driven, because a full stop and a rolling stop are genuinely different
 * vehicle behaviours and the grader can tell them apart.
 *
 * Module section 2, the "who goes first" table.
 * ---------------------------------------------------------------------- */
const controlledJunctionSlot: SlotVariant[] = [
  {
    id: 'level5.controlled-junction.stop-sign-jeepney',
    type: 'stop_sign',
    scene: 'intersection',
    description:
      'A Stop sign governs your approach, and a jeepney is crossing the junction from your right.',
    correctAction: 'stop',
    points: 25,
    warningDistance: 340,
    penaltyMessage: `A Stop sign requires the wheels to actually stop. A rolling stop is a violation in itself, and here it puts you into a junction another vehicle is still occupying.`,
    rewardMessage: 'Correct. Full stop, cross traffic cleared, then away.',
    duration: 200,
    lawCitation:
      'RA 4136: at a Stop sign the driver shall come to a full stop and yield to any vehicle in or approaching the intersection. Never make a rolling stop.',
    competency: 'right_of_way',
    severity: 'critical',
    npc: {
      path: 'crossing_from_right',
      vehicleKind: 'jeepney',
      label: 'a jeepney crossing the junction',
      color: '#f59e0b',
    },
  },
  {
    // Harder than the variant above despite looking easier. With a vehicle
    // visibly in the way, stopping is obvious; with the junction empty, the
    // only thing asking for a full stop is the sign, which is precisely when
    // a learner rolls it.
    id: 'level5.controlled-junction.stop-sign-clear',
    type: 'stop_sign',
    scene: 'intersection',
    description:
      'A Stop sign governs your approach. The cross street looks completely empty.',
    correctAction: 'stop',
    points: 25,
    warningDistance: 340,
    penaltyMessage: `A Stop sign means a full stop every time, not only when something is coming. A rolling stop is an offense on its own, and "it looked clear" is what a driver says after failing to see the thing that was not.`,
    rewardMessage: 'Correct. Full stop even with nothing in sight — which is what the sign actually requires.',
    duration: 200,
    lawCitation:
      'RA 4136: at a Stop sign the driver shall bring the vehicle to a full stop before proceeding, whether or not other traffic is present.',
    competency: 'right_of_way',
    severity: 'critical',
  },
  {
    id: 'level5.controlled-junction.give-way-traffic',
    scenePrefab: { kind: 'give_way_junction' },
    type: 'scenario_trigger',
    scene: 'intersection',
    description:
      'A Give Way sign faces you at the junction ahead, and a car is closing along the road you are about to join.',
    correctAction: 'brake',
    points: 25,
    warningDistance: 340,
    penaltyMessage: `A Give Way sign asks you to surrender the junction to anything in it or closely approaching it. Arriving at road speed leaves you committed before you can see whether the way is clear.`,
    rewardMessage: 'Correct. You slowed on the approach and let the crossing traffic go first.',
    duration: 200,
    lawCitation:
      'RA 4136: at a Give Way sign the driver shall yield the right-of-way to any vehicle in, or closely approaching, the intersection.',
    competency: 'right_of_way',
    severity: 'critical',
    npc: {
      path: 'crossing_from_left',
      vehicleKind: 'car',
      label: 'a car crossing the junction',
      color: '#dc2626',
    },
  },
  {
    // The don't-yield case this slot needs, and the distinction the sign itself
    // turns on: Give Way is not Stop. It asks you to surrender the junction to
    // anything that is there, and with nothing there the surrender is owed to
    // nobody. Stopping anyway is the obstruction the sign was chosen to avoid,
    // which is why a junction gets a Give Way rather than a Stop in the first
    // place. Exactly parallel to `roundabout-entry.ring-clear`.
    id: 'level5.controlled-junction.give-way-clear',
    scenePrefab: { kind: 'give_way_junction' },
    type: 'scenario_trigger',
    scene: 'intersection',
    description:
      'A Give Way sign faces you at the junction ahead, and the road you are joining is clear in both directions.',
    correctAction: 'accelerate',
    points: 25,
    warningDistance: 340,
    // Graded on what was avoided rather than on a speed, so a driver who eases
    // off to look — which is what a Give Way sign is asking for — is not
    // punished for it. Only actually coming to rest fails.
    avoid: ['brake'],
    penaltyMessage: `A Give Way sign requires you to yield to traffic in or approaching the junction, and there was none. Stopping dead at an empty give-way line is not extra care — it is an obstruction, and it is why this junction carries a Give Way rather than a Stop.`,
    rewardMessage: 'Correct. Nothing was coming, so you gave way to nothing and kept moving.',
    duration: 200,
    lawCitation:
      'RA 4136: at a Give Way sign the driver shall yield the right-of-way to any vehicle in, or closely approaching, the intersection. A Give Way sign requires yielding, not an unconditional stop.',
    competency: 'right_of_way',
    severity: 'major',
  },
];

/* -------------------------------------------------------------------------
 * Slot 4 — Right-of-way at a traffic signal. Driven.
 *
 * Module section 2 again, the two signal rows of its table. Deliberately NOT
 * signal recognition: Level 3 owns what each aspect means, and a question whose
 * answer is "red means stop" would be that level's content replayed. What is
 * asked here is the part the module adds — that a green light permits you to
 * proceed only after yielding to whoever is already lawfully in the junction,
 * and that a permitted turn on red is a stop-then-yield, not a filter.
 * ---------------------------------------------------------------------- */
const signalRightOfWaySlot: SlotVariant[] = [
  {
    id: 'level5.signal-right-of-way.green-pedestrians-still-crossing',
    // `scenario_trigger`, like every other right-of-way judgement in this
    // level. `green_light` is in the machine's alphabet, but only as the edge
    // out of INTERSECTION when the light you were waiting at changes - there is
    // no edge that *starts* an event with it, so the whole of this slot silently
    // never fired: the approach never opened, the scene never appeared, and its
    // 25 points were unreachable on every roll.
    type: 'scenario_trigger',
    scene: 'signal',
    description:
      'Your light has turned green, but pedestrians who started on the previous phase are still finishing their way across.',
    pedestrians: [
      { kind: 'adult', solid: true, position: 0.45 },
      { kind: 'child', position: 0.55 },
    ],
    sign: {
      name: 'Traffic Signal, Green',
      category: 'Traffic Signal',
      meaning: 'You may proceed, but only after yielding to anyone already lawfully within the intersection.',
      art: 'signal_head',
      aspect: 'green',
    },
    correctAction: 'stop',
    points: 25,
    warningDistance: 340,
    penaltyMessage: `A green light gives you permission to proceed, not priority over people already lawfully inside the junction. Moving off into pedestrians still on the crossing is a critical violation however green your light is.`,
    rewardMessage: 'Correct. Green means go only once the junction is actually clear, and you waited until it was.',
    duration: 200,
    lawCitation:
      'On a green light a driver may proceed, but must first yield to other vehicles and pedestrians already lawfully within the intersection.',
    competency: 'traffic_signals',
    severity: 'critical',
  },
  {
    id: 'level5.signal-right-of-way.green-junction-not-clear',
    // `scenario_trigger`, like every other right-of-way judgement in this
    // level. `green_light` is in the machine's alphabet, but only as the edge
    // out of INTERSECTION when the light you were waiting at changes - there is
    // no edge that *starts* an event with it, so the whole of this slot silently
    // never fired: the approach never opened, the scene never appeared, and its
    // 25 points were unreachable on every roll.
    type: 'scenario_trigger',
    scene: 'signal',
    description:
      'Your light is green, but a car that entered on the last phase has not finished clearing the junction.',
    sign: {
      name: 'Traffic Signal, Green',
      category: 'Traffic Signal',
      meaning: 'You may proceed, but only after yielding to anyone already lawfully within the intersection.',
      art: 'signal_head',
      aspect: 'green',
    },
    correctAction: 'brake',
    points: 25,
    warningDistance: 340,
    penaltyMessage: `A vehicle already inside the junction keeps its right-of-way when your light turns green. Driving into the space it is still occupying is the most common way a green light becomes a collision.`,
    rewardMessage: 'Correct. You held back until the vehicle already in the junction had cleared it.',
    duration: 200,
    lawCitation:
      'On a green light a driver may proceed, but must first yield to other vehicles and pedestrians already lawfully within the intersection.',
    competency: 'traffic_signals',
    severity: 'critical',
    npc: {
      path: 'crossing_from_left',
      vehicleKind: 'car',
      label: 'a car still clearing the junction',
      color: '#dc2626',
      // Entered on the previous phase and not yet out: it sits in the box while
      // your light is green, which is exactly what you must yield to. See `inBox`.
      inBox: true,
    },
  },
  {
    id: 'level5.signal-right-of-way.right-turn-on-red',
    type: 'red_light',
    scene: 'signal',
    description:
      'The signal is red, and a sign beside it permits a right turn on red from this lane.',
    sign: {
      name: 'Traffic Signal, Red',
      category: 'Traffic Signal',
      meaning: 'Stop. Where a right turn on red is permitted, stop fully first and yield before turning.',
      art: 'signal_head',
      aspect: 'red',
    },
    correctAction: 'stop',
    points: 25,
    warningDistance: 340,
    penaltyMessage: `A permitted turn on red is a stop-then-yield, never a filter. Rolling into it without stopping is both a red-light offense and a failure to yield to the traffic and pedestrians that still have the green.`,
    rewardMessage: 'Correct. Full stop first, then yield — which is the only way a turn on red is lawful.',
    duration: 200,
    lawCitation:
      'Where a right turn on red is permitted, the driver shall come to a full stop and yield to pedestrians and to cross-traffic vehicles before proceeding. Never make a rolling stop.',
    competency: 'traffic_signals',
    severity: 'critical',
  },
  {
    // The don't-yield case for this slot: a plain green with the junction
    // genuinely clear. The other two green variants both carry a catch —
    // pedestrians still on the crossing, a vehicle still clearing — so a
    // learner who has only met those learns to hesitate at every green. Here
    // there is nothing to yield to, and hesitating is the mistake: a green
    // light is permission to go, and holding at one with a clear junction just
    // blocks the traffic behind you.
    id: 'level5.signal-right-of-way.green-all-clear',
    // `scenario_trigger`, like every other right-of-way judgement in this
    // level. `green_light` is in the machine's alphabet, but only as the edge
    // out of INTERSECTION when the light you were waiting at changes - there is
    // no edge that *starts* an event with it, so the whole of this slot silently
    // never fired: the approach never opened, the scene never appeared, and its
    // 25 points were unreachable on every roll.
    type: 'scenario_trigger',
    scene: 'signal',
    description:
      'Your light is green and the junction ahead is completely clear — no pedestrians, no crossing traffic.',
    sign: {
      name: 'Traffic Signal, Green',
      category: 'Traffic Signal',
      meaning: 'Proceed. Yield first only to anyone already lawfully within the intersection.',
      art: 'signal_head',
      aspect: 'green',
    },
    correctAction: 'accelerate',
    points: 25,
    warningDistance: 340,
    avoid: ['brake'],
    penaltyMessage: `A green light with a clear junction is permission to go, and there was nobody to yield to. Stopping at it is not caution — it strands the traffic behind you at a green.`,
    rewardMessage: 'Correct. Green light, clear junction, nothing to yield to — so you proceeded.',
    duration: 200,
    lawCitation:
      'On a green light the driver may proceed, after yielding to any vehicles and pedestrians already lawfully within the intersection. With the junction clear, there is nothing left to yield to.',
    competency: 'traffic_signals',
    severity: 'major',
  },
];

/* -------------------------------------------------------------------------
 * Slot 5 — Emergency vehicles. Driven, and the strongest driven content in the
 * level: "move over and slow down" is a lane and a speed, which are the two
 * things this simulation measures natively.
 *
 * Module section 4.
 * ---------------------------------------------------------------------- */
const emergencyYieldSlot: SlotVariant[] = [
  {
    id: 'level5.emergency-yield.ambulance-behind',
    type: 'emergency_vehicle',
    description:
      'An ambulance is closing fast behind you with its siren and lights running.',
    correctAction: 'brake',
    points: 25,
    warningDistance: 360,
    penaltyMessage: `An emergency vehicle on official business with an audible signal outranks every ordinary right-of-way rule. Staying in its path delays a response that is measured in seconds.`,
    rewardMessage: 'Correct. You moved to the right edge and slowed, and the ambulance got through.',
    duration: 200,
    lawCitation:
      'RA 4136: drivers shall yield the right-of-way to police, fire department vehicles and ambulances operated on official business when the driver sounds an audible signal of approach.',
    competency: 'right_of_way',
    severity: 'critical',
    // Yielding here is a place on the road, not only a speed: pulling to the
    // nearside is the whole instruction, so slowing down in the middle of the
    // carriageway has not actually let anything past.
    requiredLane: {
      lane: 'curb',
      hint: 'Move over to the right and let it through',
      wrongLaneMessage: `Slowing down without moving over leaves the ambulance boxed in behind you. Yielding means clearing its path, not just easing off.`,
    },
    npc: {
      path: 'closing_from_behind',
      vehicleKind: 'ambulance',
      label: 'an ambulance responding with sirens',
    },
  },
  {
    // The same duty read from the other direction. An emergency vehicle
    // crossing ahead of you outranks your priority even where the junction
    // itself would have given it to you, which is the part a learner who has
    // only met the mirror-check version does not necessarily generalise to.
    id: 'level5.emergency-yield.ambulance-crossing',
    type: 'emergency_vehicle',
    scene: 'intersection',
    description:
      'An ambulance with its siren running is crossing the junction ahead of you, against the flow.',
    correctAction: 'stop',
    points: 25,
    warningDistance: 360,
    penaltyMessage: `An emergency vehicle on official business with an audible signal has priority at a junction whoever else would normally hold it. Entering across its path is a critical violation.`,
    rewardMessage: 'Correct. You stopped and let it through, even though the junction would otherwise have been yours.',
    duration: 200,
    lawCitation:
      'RA 4136: drivers shall yield the right-of-way to police, fire department vehicles and ambulances operated on official business when the driver sounds an audible signal of approach.',
    competency: 'right_of_way',
    severity: 'critical',
    // The easiest portable right-of-way variant in the game — the two easier
    // readings elsewhere in this level are both cutscenes and so cannot leave
    // it. Without this, a learner practising right-of-way after repeated
    // failures would have nothing easier than what they just failed to fall
    // back on.
    //
    // Genuinely the easiest call here: a siren crossing in front of you needs
    // no rule looked up, only stopping.
    npc: {
      path: 'crossing_from_right',
      vehicleKind: 'ambulance',
      label: 'an ambulance crossing on a shout',
    },
  },
  {
    // The module's step 3: never stop inside a junction or on a crossing while
    // yielding. Graded on what is avoided, because the failure is the act of
    // coming to rest in the one place a stopped vehicle blocks everybody.
    id: 'level5.emergency-yield.not-in-the-junction',
    label: 'Siren at the junction',
    type: 'emergency_vehicle',
    scene: 'intersection',
    description:
      'An ambulance is closing behind you with its siren on, just as you reach a junction.',
    correctAction: 'accelerate',
    points: 25,
    warningDistance: 360,
    // Coming to rest is the wrong response *here* specifically: the instruction
    // is to clear the junction first and pull over beyond it.
    //
    // `'brake'` and not `'stop'`, which is what this said first and which was
    // dead content. `deriveAction` only ever returns `'stop'` for an event whose
    // own `correctAction` is `'stop'` (eventTelemetry.ts: a full stop reads as
    // `'brake'` otherwise, on the principle that stopping satisfies any request
    // to slow). An `avoid` list naming an action the grader cannot produce for
    // this event never fires, so the event always scored correct however the
    // driver behaved. Level 4's pools carry the same lesson in their header,
    // learned the same way.
    avoid: ['brake'],
    penaltyMessage: `Stopping inside the junction to let an emergency vehicle past blocks every direction at once, including the one it needs. Clear the junction first, then pull over.`,
    rewardMessage: 'Correct. You cleared the junction before pulling over, leaving its path open.',
    duration: 200,
    lawCitation:
      'FDM Vol. 1 p. 141: when an emergency vehicle approaches, pull over as near as possible to the right-hand edge of the road, clear of any intersection, and stop until it has passed. Never stop within an intersection or on a pedestrian crossing.',
    competency: 'right_of_way',
    severity: 'critical',
    npc: {
      path: 'closing_from_behind',
      vehicleKind: 'ambulance',
      label: 'an ambulance responding with sirens',
    },
  },
];

/* -------------------------------------------------------------------------
 * Slot 6 — Yellow box and intersection discipline. Driven.
 *
 * Module section 6. The only slot in the level whose variants disagree about
 * what to do, and deliberately so: the box asks a different question depending
 * on whether your exit is clear, and a driver who applies one answer to both
 * situations has misunderstood the marking.
 * ---------------------------------------------------------------------- */
const yellowBoxJunctionSlot: SlotVariant[] = [
  {
    id: 'level5.yellow-box.exit-clear',
    type: 'road_marking',
    scene: 'intersection',
    description:
      'A yellow box junction is painted across the road ahead, and the exit beyond it is clear.',
    correctAction: 'accelerate',
    points: 20,
    warningDistance: 340,
    penaltyMessage: `Coming to rest inside a yellow box blocks every direction of cross traffic at once. With your exit clear there was nothing to wait for, and waiting there is the obstruction the marking exists to prevent.`,
    rewardMessage: 'Correct. Exit clear, so you crossed the box without stopping in it.',
    duration: 200,
    // The failure is the act of stopping in the box, so this is graded on what
    // was avoided rather than on arriving at some speed or lane. `brake` covers
    // both stopping dead and crawling to a halt inside the markings, which are
    // the same obstruction.
    avoid: ['brake'],
    lawCitation:
      'Yellow box junction rules: do not block the intersection even when turning, do not stop or make a U-turn inside the box, and yield to vehicles already within it.',
    competency: 'lane_discipline',
    severity: 'major',
    marking: {
      name: 'Yellow Box Junction',
      category: 'C. Other Lines',
      meaning: 'Do not enter unless your exit is clear. Never come to rest inside the box.',
      art: 'yellow_box',
    },
  },
  {
    // The other half of the same rule, and the half that catches people. Here
    // the answer is to stop — but *before* the box, not in it. Same marking,
    // same green light, opposite action, because the exit is what decides.
    id: 'level5.yellow-box.exit-blocked',
    type: 'road_marking',
    scene: 'intersection',
    description:
      'Cross traffic is streaming left to right through the junction and has jammed solid across the yellow box.',
    correctAction: 'stop',
    points: 20,
    warningDistance: 340,
    penaltyMessage: `Nothing entitles you to enter a box you cannot clear. Rolling in behind the jam strands you across the junction and stops every other direction dead.`,
    rewardMessage: 'Correct. You waited behind the box until the crossing traffic had cleared a way out.',
    duration: 200,
    lawCitation:
      'Yellow box junction rules: do not enter the box unless your exit beyond it is clear, even on a green light.',
    competency: 'lane_discipline',
    severity: 'major',
    marking: {
      name: 'Yellow Box Junction',
      category: 'C. Other Lines',
      meaning: 'Do not enter unless your exit is clear. Never come to rest inside the box.',
      art: 'yellow_box',
    },
  },
  {
    id: 'level5.yellow-box.vehicle-inside',
    type: 'road_marking',
    scene: 'intersection',
    description:
      'A car is already committed inside the yellow box, working its way out across your path.',
    correctAction: 'brake',
    points: 20,
    warningDistance: 340,
    penaltyMessage: `A vehicle already inside the box is committed to clearing it and has priority over anyone about to enter. Pressing in behind it is what turns one blocked junction into four.`,
    rewardMessage: 'Correct. You gave way to the vehicle already inside the box and let it clear.',
    duration: 200,
    lawCitation:
      'Yellow box junction rules: yield the right-of-way to vehicles already within the box, which are committed to clearing the intersection.',
    competency: 'lane_discipline',
    severity: 'major',
    marking: {
      name: 'Yellow Box Junction',
      category: 'C. Other Lines',
      meaning: 'Do not enter unless your exit is clear. Never come to rest inside the box.',
      art: 'yellow_box',
    },
    npc: {
      path: 'crossing_from_left',
      vehicleKind: 'car',
      label: 'a car clearing the yellow box',
      color: '#dc2626',
      // Committed inside the box and working its way out: it holds in the box
      // through the decision instead of never arriving. See `inBox`.
      inBox: true,
    },
  },
  {
    // The module's first yellow-box prohibition, read from inside the box: do
    // not block the intersection. Once you are committed, the only way to stop
    // blocking it is to leave it — so a light changing against you while you
    // are on the markings is not an instruction to stop, it is an instruction
    // to clear.
    id: 'level5.yellow-box.already-committed',
    type: 'road_marking',
    scene: 'intersection',
    description:
      'The signal ahead turns amber just as you reach the yellow box.',
    correctAction: 'accelerate',
    points: 20,
    // A short warning so it fires as you arrive at the box, not far out: the
    // whole point is that you are committed to the crossing when the light
    // changes, which only reads if you are actually on the markings.
    warningDistance: 200,
    avoid: ['brake'],
    penaltyMessage: `Stopping on the box is the one thing the marking exists to prevent: it strands you across every conflicting movement at once. Once you are committed to the crossing, clearing it is the only safe move.`,
    rewardMessage: 'Correct. Committed to the crossing, you cleared the box rather than stopping on it.',
    duration: 200,
    lawCitation:
      'Yellow box junction rules: do not block the intersection. A vehicle already within the box is committed to clearing it and must do so rather than coming to rest inside.',
    competency: 'lane_discipline',
    severity: 'major',
    marking: {
      name: 'Yellow Box Junction',
      category: 'C. Other Lines',
      meaning: 'Do not enter unless your exit is clear. Never come to rest inside the box.',
      art: 'yellow_box',
    },
  },
];

/* -------------------------------------------------------------------------
 * Slot 7 — Roundabout entry. The one frozen slot: this corridor cannot express
 * entering a rotunda as a manoeuvre (and driving straight would cross the
 * central island), so the decision is asked rather than driven, and the
 * resolution plays the circulating vehicle without moving the player.
 *
 * Module section 5.
 * ---------------------------------------------------------------------- */
const roundaboutEntrySlot: SlotVariant[] = [
  {
    id: 'level5.roundabout-entry.circulating-car',
    type: 'scenario_trigger',
    scene: 'roundabout',
    cutscene: true,
    description:
      'You reach the give-way line at a roundabout. A car is already circulating, coming round towards your entry.',
    question: 'A vehicle is already going round the roundabout as you arrive at the entry. Who has priority?',
    choices: [
      { label: 'The circulating car — wait at the line until it has passed your entry', action: 'brake' },
      { label: 'You do, because it is moving slowly and you can enter ahead of it', action: 'accelerate' },
      // Not `stop`: the rule engine treats a full stop as satisfying a request
      // to slow down, so this answer — entering the roundabout — was being
      // scored correct against a `brake` answer. Pulling alongside is a move
      // across the entry, which is what it is now named as.
      { label: 'Enter alongside it and let it work around you', action: 'turn_left' },
    ],
    correctAction: 'brake',
    points: 20,
    penaltyMessage: `Traffic already inside a roundabout has priority over traffic entering it, no matter how slowly it is moving. Entering across it is a right-of-way violation.`,
    rewardMessage:
      'Correct. You gave way to the circulating vehicle, then entered, signaled and took your exit.',
    duration: 200,
    lawCitation:
      'Roundabout rules: yield the right-of-way to vehicles already inside the roundabout, and signal your intention and check your side mirror before exiting.',
    competency: 'right_of_way',
    severity: 'major',
    npc: {
      path: 'roundabout_circulating',
      vehicleKind: 'car',
      label: 'a car already circulating the roundabout',
      color: '#2563eb',
    },
  },
  {
    // No NPC at all, which `RoadDecision` reads as a clear ring and draws
    // accordingly. A give-way line is not a stop line: yielding to nothing is
    // the mistake this variant exists to catch, and it is the roundabout twin
    // of the car-from-left case in slot 1.
    id: 'level5.roundabout-entry.ring-clear',
    type: 'scenario_trigger',
    scene: 'roundabout',
    cutscene: true,
    description:
      'You reach the give-way line at a roundabout and nothing is circulating in either direction.',
    question: 'The roundabout is empty as you arrive at the give-way line. What is correct?',
    choices: [
      { label: 'Enter without stopping — a give-way line asks you to yield, not to stop', action: 'accelerate' },
      { label: 'Come to a full stop at the line first, then enter', action: 'stop' },
      { label: 'Slow almost to a halt and edge in, in case something appears', action: 'brake' },
    ],
    correctAction: 'accelerate',
    points: 20,
    penaltyMessage: `A give-way line requires you to yield to circulating traffic, and there was none. Stopping at an empty roundabout blocks the vehicles behind you and is not what the marking asks for.`,
    rewardMessage: 'Correct. Nothing was circulating, so you gave way to nothing and kept moving.',
    duration: 200,
    lawCitation:
      'Roundabout rules: yield the right-of-way to vehicles already inside the roundabout. A give-way line requires yielding, not an unconditional stop.',
    competency: 'right_of_way',
    severity: 'major',
  },
  {
    id: 'level5.roundabout-entry.exit-signal',
    type: 'scenario_trigger',
    scene: 'roundabout',
    cutscene: true,
    description:
      'You are circulating, and the exit you want is the next one off the roundabout.',
    question: 'You are about to leave the roundabout at the next exit. What must you do first?',
    choices: [
      { label: 'Signal right and check your side mirror before moving out', action: 'turn_right' },
      { label: 'Nothing — traffic entering has to give way to you anyway', action: 'accelerate' },
      { label: 'Slow to a crawl on the ring so entering traffic can read your intention', action: 'brake' },
    ],
    correctAction: 'turn_right',
    points: 20,
    penaltyMessage: `Leaving a roundabout unsignalled is one of the two most common rotunda mistakes: drivers waiting to enter cannot tell whether you are coming round again, so they either sit there or pull out into you.`,
    rewardMessage: 'Correct. Signaled and mirror-checked before leaving the ring.',
    duration: 200,
    lawCitation:
      'Roundabout rules: signal your intention and check your side mirror before you exit a roundabout or rotunda.',
    competency: 'right_of_way',
    severity: 'major',
    npc: {
      path: 'roundabout_circulating',
      vehicleKind: 'car',
      label: 'a car circulating behind you',
      color: '#2563eb',
    },
  },
];

/* -------------------------------------------------------------------------
 * Slot 8 — Traffic joining from a private road. Driven.
 *
 * Module section 1, read the other way round: here the right-of-way is yours,
 * and the lesson is that holding it is not the same as assuming it will be
 * respected. The module makes exactly this move for pedestrians outside a
 * crosswalk — the other party must yield, and a prudent driver slows anyway.
 * ---------------------------------------------------------------------- */
const drivewayJoinSlot: SlotVariant[] = [
  {
    id: 'level5.driveway-join.van',
    type: 'scenario_trigger',
    scene: 'side_road',
    description:
      'A van noses out of a private driveway on your left, into the highway you are already traveling on.',
    correctAction: 'brake',
    points: 20,
    penaltyMessage: `A vehicle leaving a private road must yield to highway traffic, but right-of-way is a rule about fault, not a guarantee about behavior. Driving on at full speed leaves you nothing if it pulls out.`,
    rewardMessage:
      'Correct. The right-of-way was yours, and you still slowed enough to be able to stop for it.',
    duration: 200,
    lawCitation:
      'RA 4136: a vehicle entering a highway from a private road or driveway shall yield the right-of-way to all vehicles approaching on that highway. A driver at unlawful speed forfeits any right-of-way they would otherwise hold.',
    competency: 'right_of_way',
    severity: 'major',
    npc: {
      path: 'crossing_from_left',
      vehicleKind: 'car',
      label: 'a van pulling out of a driveway',
      color: '#64748b',
      // Noses out of the driveway into your lane and stays there, completing
      // the join on screen rather than vanishing the moment you slow. See
      // `emerges`.
      emerges: true,
    },
  },
  {
    id: 'level5.driveway-join.tricycle',
    type: 'scenario_trigger',
    scene: 'side_road',
    description:
      'A tricycle pulls straight out of a compound gate ahead without looking, into your lane.',
    correctAction: 'stop',
    points: 20,
    warningDistance: 340,
    penaltyMessage: `It had to give way to you and did not. That settles who is at fault and nothing else — a tricycle in your lane is a tricycle in your lane, and the only useful response is to stop.`,
    rewardMessage: 'Correct. You stopped for it rather than insisting on a right-of-way it was never going to respect.',
    duration: 200,
    lawCitation:
      'RA 4136: a vehicle entering a highway from a private road or driveway shall yield to all vehicles approaching on that highway — but the doctrine of last clear chance still holds the driver who could have avoided the collision responsible.',
    competency: 'right_of_way',
    severity: 'critical',
    npc: {
      path: 'crossing_from_left',
      vehicleKind: 'motorcycle',
      label: 'a tricycle pulling out of a gate',
      color: '#0ea5e9',
      // Pulls straight out into your lane and sits there in your path — you
      // must stop for it. It stays put through the decision rather than reaching
      // the road only after the event has ended. See `emerges`.
      emerges: true,
    },
  },
  {
    // Not a junction: a jeepney stopped at the curb to load passengers, which
    // is why it is drawn on the roadside lane rather than emerging from an arm.
    // The lesson is anticipation — a loaded jeepney at the curb is about to
    // pull out, and passengers step off it into the road — so you ease off as
    // you come up on it rather than holding your speed alongside it.
    id: 'level5.driveway-join.jeepney-loading',
    type: 'obstacle_ahead',
    description:
      'A jeepney is stopped at the curb ahead of you, loading passengers, half in your lane.',
    actor: { kind: 'jeepney', side: 'curb' },
    correctAction: 'brake',
    points: 20,
    warningDistance: 340,
    penaltyMessage: `A jeepney loading at the curb is about to pull out, and passengers step off it into the road. Holding your speed alongside it leaves you nothing when either happens — a routine Philippine-street event a prepared driver plans for.`,
    rewardMessage: 'Correct. You eased off coming up on the loading jeepney instead of holding your speed past it.',
    duration: 200,
    lawCitation:
      'RA 4136: a driver shall drive at a careful and prudent speed having regard to actual hazards, and yield to a vehicle pulling out from a standing position at the curb.',
    competency: 'right_of_way',
    severity: 'major',
  },
  {
    // The don't-yield case for this slot. The other driver has done exactly
    // what the rule asks — stopped at the mouth and waited — so the useful
    // thing you can do is be predictable and go.
    //
    // Waving somebody out is the specific bad habit here, and it is worth
    // naming: it hands them a gap you cannot see past, on your assurance, with
    // your vehicle blocking their view of the lane that will actually hit them.
    id: 'level5.driveway-join.waiting-van',
    label: 'Van at a driveway',
    type: 'scenario_trigger',
    scene: 'side_road',
    description:
      'A van has stopped at the mouth of a private driveway on your left, short of the highway you are traveling on.',
    correctAction: 'accelerate',
    points: 20,
    warningDistance: 340,
    avoid: ['brake'],
    penaltyMessage: `It stopped and waited, which is what the rule asks of it. Slowing to a halt to wave it out gives away a right-of-way that keeps traffic predictable, and offers it a gap you cannot see past.`,
    rewardMessage: 'Correct. It was already yielding properly, so you held your speed and stayed predictable.',
    duration: 200,
    lawCitation:
      'RA 4136: a vehicle entering a highway from a private road or driveway shall yield the right-of-way to all vehicles approaching on that highway.',
    competency: 'right_of_way',
    severity: 'major',
    npc: {
      path: 'crossing_from_left',
      vehicleKind: 'car',
      label: 'a van waiting at a driveway mouth',
      color: '#64748b',
      // Stopped at the mouth of the driveway, holding for the road to clear —
      // it has done exactly what the rule asks, so you stay predictable and go.
      // It never enters the carriageway. See `yields`.
      yields: true,
    },
  },
];

/**
 * Eight junctions 700 apart, which is set by what fits on the screen rather
 * than by the 400-unit warning range.
 *
 * The canvas draws half a pixel per road unit, so 700 units is 350px of a
 * 700px-tall view. That is the smallest gap that keeps two junctions from
 * overlapping: the roundabout's plaza alone is 300px tall, and an ordinary
 * junction reaches about 150px above its own stop line, so anything tighter
 * puts one junction's cross street on top of the next one's — which at 450
 * apart it demonstrably did, drawing a yellow box across the roundabout's
 * give-way line.
 */
export const SLOT_DISTANCES = [930, 1830, 2730, 3630, 4530, 5430, 6430, 7330];

export const SLOTS: SlotVariant[][] = [
  uncontrolledCrossroadsSlot,
  crossingYieldSlot,
  controlledJunctionSlot,
  signalRightOfWaySlot,
  emergencyYieldSlot,
  yellowBoxJunctionSlot,
  roundaboutEntrySlot,
  drivewayJoinSlot,
];

/**
 * The drive is worth 180 points across eight junctions, and every variant in a
 * slot is worth exactly what its siblings are worth.
 *
 * That equality is load-bearing rather than tidy: the route is rolled fresh per
 * attempt, so a slot whose variants disagreed about their value would make the
 * level's own pass mark depend on the roll. 25 for the five slots where getting
 * it wrong means hitting somebody — a pedestrian, a vehicle already in the
 * junction, an ambulance you have boxed in — and 20 for the three judgment
 * slots.
 *
 * The pass mark sits at 124, 69% of the total and the same share Level 4 uses,
 * which lets a learner miss two of the eight and still pass.
 *
 * ## What the pass mark does and does not catch, measured
 *
 * The obvious degenerate strategy here is not speeding — it is yielding at
 * everything. Enumerating all 46,080 possible rolls against a driver who comes
 * to a full stop at every driven event and picks the most cautious offered
 * answer in every cutscene: that reflex scores 25..180 (mean 114.5) and clears
 * the pass mark on **35% of rolls**.
 *
 * That number is the honest one and it is worth stating rather than claiming
 * the reflex fails outright, which an earlier version of this comment did. Two
 * things about it:
 *
 * - It used to be 74%. The don't-yield variants brought it down — the reflex's
 *   *guaranteed* floor, the points it collects no matter what rolls, fell from
 *   95 to 25 once every slot but one held a case where going is correct. The
 *   exception is the pedestrian slot, deliberately: stopping for somebody in a
 *   crossing is never the wrong answer, and manufacturing a case where it is
 *   would teach something false to make a metric look better.
 * - The pass mark is not the only thing reading this drive. A reflex driver is
 *   wrong on every don't-yield event, which is exactly the evidence BKT needs:
 *   their `right_of_way` mastery drops whether or not they scraped a pass, and
 *   the remediation selector targets them on the next level. Tightening the
 *   mark to 141 would drop the reflex to 11% but would also mean missing a
 *   single event out of eight fails the level, which is harsher than any of
 *   this level's siblings. The adaptive layer is the better instrument for
 *   this, and it is already pointed at it.
 *
 * Re-measure it if the pools change.
 */
const level5Base = {
  id: 5,
  name: levelModule.title,
  moduleId: levelModule.id,
  description: levelModule.desc,
  // Eight junctions 700 apart, plus a runway after the last one long enough for
  // its measurement window to close before the road ends.
  roadLength: 8030,
  // A city route through intersections. Well below Level 4's 50: every hazard
  // in this level is something that can appear from the side, and the speeds
  // the grader judges "slowed" against should be the ones a junction actually
  // deserves.
  speedLimit: 40,
  requiredScore: 124,
  stars2: 149,
  stars3: 171,
} as const;

/**
 * An ordinary two-way city street: four lanes, the left two carrying opposing
 * traffic.
 *
 * Right-of-way is a relationship with other road users, so the road this level
 * is driven on has to have another side to it. Without a declared layout the
 * carriageway is one-way by default, which would make the ambulance's "move
 * over to the curb and let it through" a manoeuvre across lanes that belong to
 * nobody, and would leave the driver free to sit in the oncoming lane between
 * junctions at no cost.
 *
 * Built fresh per level rather than folded into `level5Base` above, because
 * that object is `as const` for its numbers and a frozen `spans` array is not
 * assignable to `RoadPaint`.
 */
const cityStreetPaint = (): LevelConfig['paint'] => ({
  oncomingLanes: 2,
  base: 'broken_yellow',
  spans: [],
});

/**
 * A fresh roll of the drive: one situation from each slot's pool.
 *
 * Unlike Levels 3 and 4 there is no sign/marking coverage record to work
 * through here — right-of-way has no catalogue of plates to tick off — so the
 * signature accepts one for interface parity with the other builders and
 * ignores it. What does apply is `weakCompetency`: the pedestrian slot and the
 * signal slot are tagged `pedestrians` and `traffic_signals` respectively while
 * the rest are `right_of_way`, so a learner weak in one of those gets narrowed
 * pools where it matters and the full pool everywhere else.
 */
export const createLevel5 = (
  _coverage?: unknown,
  weakCompetency?: DrivingCompetency | null,
  rng: () => number = Math.random
): LevelConfig => ({
  ...level5Base,
  paint: cityStreetPaint(),
  events: buildEvents(SLOTS, SLOT_DISTANCES, pool => {
    const scoped = filterByWeakCompetency(pool, weakCompetency ?? null);
    return scoped[Math.floor(rng() * scoped.length)];
  }),
});

/**
 * Stable version of the level used for the level map, briefing and results,
 * where the metadata matters and the specific situations do not. The played
 * drive comes from `createLevel5()` instead.
 */
export const level5: LevelConfig = {
  ...level5Base,
  paint: cityStreetPaint(),
  events: buildEvents(SLOTS, SLOT_DISTANCES, pool => pool[0]),
};
