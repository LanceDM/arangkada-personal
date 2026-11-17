import { spacedPace } from '@/features/driving-sim/domain/world/DrivingPace';
import { getLevelModule } from '@/features/driving-sim/domain/scenario/content/lessons/lessonCatalog';
import { buildEvents, type SlotVariant } from '@/features/driving-sim/domain/scenario/pooling';
import { qaVariant } from './qaVariant';
import type { LevelConfig } from '@/features/driving-sim/domain/scenario/scenarioDefinition';

const levelModule = getLevelModule(11);

/**
 * A national road through a town, shared with the vehicles this module is
 * about: riders in their own lane and in yours, a cyclist, jeepneys loading
 * and overloaded, a tricycle stopped where no vehicle may stay, and the people
 * on foot a jeepney stop gathers.
 *
 * ## The driver is in a car, and that decides what is graded
 *
 * Almost every law in this module binds somebody else: the rider's helmet and
 * lamps, the child the rider may carry, the box on a delivery bike, the
 * tricycle's franchise and route, the jeepney driver's loading zone and seat
 * count. A private driver keeps none of them and enforces none of them. So each
 * scenario puts one of those vehicles in front of the car, the read panel and
 * the citation say whose law it is, and what is graded is the move the source
 * material gives the driver who meets it:
 *
 * | # | Scenario | The move, and what measures it |
 * |---|---|---|
 * | 1 | Motorcycle lane       | leave the riders their lane: the line held past them |
 * | 2 | No helmet             | two seconds behind the rider |
 * | 3 | Cyclist               | your own lane, and slowed, at the bike lane |
 * | 4 | Delivery box          | two seconds behind the rider |
 * | 5 | Child aboard          | two seconds behind the rider |
 * | 6 | Jeepney stop          | slowed past the people waiting |
 * | 7 | Tricycle in the box   | a full stop short of the yellow box |
 * | 8 | Crossing at the stop  | a full stop short of the crossing |
 * | 9 | Overloaded jeepney    | three seconds behind it |
 * | 10 | Flashing tail lamp   | three seconds behind it |
 *
 * ## Every answer here gives somebody space
 *
 * The sources give a car driver in mixed traffic only give-space moves: give way
 * to the motorcycle lane and leave room when passing a rider, give a cyclist
 * clearance and watch your speed, slow where people are on foot, stop for a
 * crossing, keep out of a blocked box. None of them makes carrying on the
 * correct answer, so no scenario here grades it. What separates drivers is how
 * the space is given: a steady line, the right lane at the right speed, a gap
 * measured every frame, and two full stops that slowing does not satisfy.
 *
 * ## What is on the road is what the scenario declares
 *
 * Every rider, passenger, vehicle and person the prose names is declared, and a
 * motorcycle carries its own `rider`: the helmet it lacks, the child behind
 * it, the box over its tail, the lamp that never stops flashing. Those are the
 * whole cue of four scenarios, and the sprite used to draw a helmeted rider
 * alone with a steady lamp whatever the prose said. The load on the jeepney's
 * step and the bar past its tail are the one thing named and not drawn.
 *
 * ## Where every claim comes from
 *
 * The collected LTO material quotes the source material each scenario
 * rests on, by file and heading, and lists what the sources do not settle.
 * A verdict or a correct answer says nothing the pack does not. Where
 * the move comes from a general chapter rather than this module's files (the
 * two-or-three-second rule, room for a long vehicle, the yellow box's own
 * rule), the citation still names the module's law as the other vehicle's.
 */

// 1. The motorcycle lane — riders where their lane keeps them, a car passing
// them in its own. FDM Vol. 1 lets other vehicles share a motorcycle lane, so
// nothing here grades the car for where it is; what it is graded on is the
// space it leaves while it goes past, which is the one thing the material asks
// of it: give way to their lane, and leave enough space when overtaking.
//
// Speed is not part of it. Easing off beside two people on one bike is a
// perfectly good way to give them room, and the verdict this replaced failed
// every driver who did.
const ridersInTheirLaneSlot: SlotVariant[] = [
  {
    id: 'level11.riders-in-their-lane',
    label: 'Motorcycle lane',
    type: 'scenario_trigger',
    npc: {
      path: 'travelling_ahead',
      vehicleKind: 'motorcycle',
      label: 'a rider and back rider in the motorcycle lane',
      lane: 'curb',
      // Slow enough to be caught inside the window: at the level's speed the
      // car draws level with the riders well before the point is graded.
      approachSpan: 600,
      entryHeadway: 1.2,
      speed: { cruise: 0.5 },
      rider: { backRider: { kind: 'adult' } },
    },
    description:
      'A painted motorcycle lane runs along the curb, and a rider with a back rider is traveling in it, slower than you.',
    recommendedMove: 'Hold your line past them. Leave them their lane.',
    correctAction: 'accelerate',
    points: 25,
    warningDistance: 400,
    penaltyMessage:
      'You moved off your line while you were passing the riders. Leave a motorcyclist enough space, and give way to their lane.',
    rewardMessage: 'Correct. You held your line past the riders and left them their lane.',
    duration: 200,
    lawCitation:
      'Motorcycle lanes are allotted to motorcycle riders and can be shared with other vehicles; a rider may not stay in another lane unless an enforcer directs it or the rider is turning into an intersection, signaling within 100 meters. When you pass motorcyclists, check what is in front of them, behind them and to each side, leave enough space when overtaking, and give way to their designated lane. Every rider and back rider wears a standard protective motorcycle helmet at all times, on any type of road, and a motorcycle carries no passenger other than its one back rider.',
    competency: 'lane_discipline',
    severity: 'major',
    // The room between a car centred in the inner lane and a rider in the curb
    // lane, less the part a driver steadying the wheel uses up: a lane change
    // toward them fails, a correction does not. Only a move toward them, to
    // the right, counts: leaving their lane, inward, gives them more room.
    lineHold: {
      maxDrift: 16,
      toward: 'right',
      driftedMessage:
        'You wandered off your line while the riders were beside you. Leave a motorcyclist enough space when you pass, and give way to their lane.',
    },
  },
];

// 2. The rider with no helmet — RA 10054, met from behind. The helmet law is
// the rider's to keep and the enforcer's to apply; what reaches the car is a
// rider with nothing on their head, and the gap behind them.
const noHelmetSlot: SlotVariant[] = [
  {
    id: 'level11.no-helmet',
    label: 'No helmet',
    type: 'obstacle_ahead',
    npc: {
      path: 'travelling_ahead',
      vehicleKind: 'motorcycle',
      label: 'a rider with no helmet',
      // No lane, here and in the four gaps after it: each joins in the one the
      // car is in, which is what "in your lane" says on every road it is
      // played on, Level 12's included.
      approachSpan: 620,
      // Well clear of two seconds when it joins, so the gap is lost by the
      // driver closing on it and never by where it was put.
      entryHeadway: 2.4,
      // At the road's speed, easing off on the run-in: the gap is tested by
      // the rider slowing, and afterwards the rider pulls away rather than
      // riding the rest of the level in front of the car.
      speed: { cruise: 1, slowsTo: 0.25, slowsFrom: 420 },
      rider: { bareheaded: true },
    },
    description: 'The rider ahead of you in your lane has no helmet on.',
    recommendedMove: 'Keep two seconds behind the motorcycle.',
    correctAction: 'brake',
    points: 20,
    warningDistance: 420,
    penaltyMessage:
      'You closed up behind the rider. The helmet law is theirs to keep; the gap behind a motorcycle is yours to leave.',
    rewardMessage: 'Correct. You kept your distance behind the rider.',
    duration: 200,
    lawCitation:
      "RA 10054, the Motorcycle Helmet Act, requires every motorcycle rider and back rider to wear a standard protective motorcycle helmet at all times while driving, on long or short drives and on any type of road. A standard helmet is one that complies with the DTI's specifications, shown by a PS mark or an ICC sticker. Drivers of tricycles are exempted. A rider without one is fined Php 1,500, then Php 3,000, then Php 5,000, and Php 10,000 with the confiscation of the driver's license from the fourth offense. None of that is yours to enforce. When you are near a motorcyclist, check what is in front of them, behind them and to each side, and behind one keep at least two or three seconds back.",
    competency: 'hazard_awareness',
    severity: 'major',
    following: {
      seconds: 2,
      tooCloseMessage: 'You were inside two seconds of the rider. Whatever the rider has to stop for, you are the next thing they meet.',
    },
  },
];

// 3. The cyclist — RO105's guidelines for every motorized driver, which are the
// one place in the module's material written to the player's side of the
// meeting. Graded as Level 4 grades a bicycle lane, because the rule is the
// same: in your own lane and slowed at the lane's point. What this adds to
// Level 4 is the person riding in it.
const cyclistSlot: SlotVariant[] = [
  {
    id: 'level11.cyclist-in-the-bike-lane',
    label: 'Cyclist in the lane',
    type: 'scenario_trigger',
    npc: {
      path: 'travelling_ahead',
      vehicleKind: 'bicycle',
      label: 'a cyclist in the bicycle lane',
      lane: 'curb',
      approachSpan: 520,
      entryHeadway: 1,
      speed: { cruise: 0.4 },
    },
    description: 'A cyclist is riding in the painted bicycle lane along the curb ahead.',
    recommendedMove: 'Stay in your own lane, and slow down to pass.',
    correctAction: 'brake',
    points: 25,
    warningDistance: 420,
    penaltyMessage:
      'You came past the cyclist too fast. Give a cyclist sufficient clearance, and watch your speed when passing.',
    rewardMessage: 'Correct. You were in your own lane, with your speed down, where the cyclist was riding.',
    duration: 200,
    lawCitation:
      "The guidelines for drivers of motorcycles, cars, trucks and other motorized vehicles: do not travel or park in a bicycle or pedestrian lane; give a cyclist sufficient clearance and watch your speed when passing; be extra careful turning at intersections; open doors with care; and check blind spots. A bicycle lane is painted with a solid line along the side of the road, and motor vehicles are not allowed to use it. Give courtesy and respect to active transport users.",
    competency: 'lane_discipline',
    severity: 'major',
    requiredLane: {
      lane: 'inner',
      hint: 'Keep out of the bike lane.',
      wrongLaneMessage: 'You were in the bicycle lane. Motor vehicles are not allowed to use it.',
    },
  },
];

// 4. The delivery box — the custom-made top box, whose limits exist so the
// rider can still see the road behind in both mirrors. A box that hides them is
// the rider's violation; the driver behind is the one the rider cannot see.
//
// The rider pulls up hard on the run-in, the way a delivery rider does at the
// address, so the gap is tested by the rider rather than chosen by the driver.
const deliveryBoxSlot: SlotVariant[] = [
  {
    id: 'level11.delivery-box',
    label: 'Delivery box',
    type: 'obstacle_ahead',
    npc: {
      path: 'travelling_ahead',
      vehicleKind: 'motorcycle',
      label: 'a delivery rider with a food box',
      approachSpan: 620,
      entryHeadway: 2.4,
      speed: { cruise: 1, slowsTo: 0.2, slowsFrom: 420 },
      rider: { topBox: true },
    },
    description:
      "A delivery rider is ahead of you in your lane, with a food box over the tail that is wider than the rider's shoulders.",
    recommendedMove: 'Keep two seconds behind the motorcycle.',
    correctAction: 'brake',
    points: 20,
    warningDistance: 420,
    penaltyMessage:
      'You closed up behind a rider whose box hides the road behind. The rider could not see you there.',
    rewardMessage: 'Correct. You kept your distance behind the delivery rider.',
    duration: 200,
    lawCitation:
      "A custom-made top box, such as a fast-food delivery box, is subject to inspection and registration. It must be securely attached, must not exceed two feet by two feet by two feet, and must not impede or obstruct the rider's view of the road from the side mirrors; an unregistered one is apprehended with a Php 5,000 penalty under DOTC JAO 2014-01. A top box designed for motorcycles and approved by the DTI may not be subject to inspection, registration or apprehension if it is securely attached and holds at most two full-faced helmets. The box is the rider's to answer for. Yours is to keep at least two or three seconds back from a rider who cannot see behind.",
    competency: 'hazard_awareness',
    severity: 'major',
    following: {
      seconds: 2,
      tooCloseMessage: 'You were inside two seconds of the delivery rider, in the one place the box hides you from the mirrors.',
    },
  },
];

// 5. The child aboard — RA 10666, the densest rule in the module, met from
// behind. The Act applies on roads with a heavy volume of vehicles, a high
// density of fast-moving ones, or a limit over 60; this road is posted at 60
// and its traffic cannot be drawn, so nothing here says this trip is unlawful.
// The citation says when it is, and the drive grades the gap.
const childAboardSlot: SlotVariant[] = [
  {
    id: 'level11.child-aboard',
    label: 'Child aboard',
    type: 'obstacle_ahead',
    npc: {
      path: 'travelling_ahead',
      vehicleKind: 'motorcycle',
      label: 'a motorcycle carrying a small child',
      approachSpan: 620,
      entryHeadway: 2.4,
      speed: { cruise: 1, slowsTo: 0.25, slowsFrom: 420 },
      rider: { backRider: { kind: 'child', bareheaded: true } },
    },
    description:
      'The motorcycle ahead of you is carrying a small child behind the rider. Her feet do not reach the foot pegs, and she has no helmet on.',
    recommendedMove: 'Keep two seconds behind the motorcycle.',
    correctAction: 'brake',
    points: 25,
    warningDistance: 420,
    penaltyMessage: 'You closed up behind a motorcycle carrying a small child. Leave the room a sudden stop needs.',
    rewardMessage: 'Correct. You kept your distance behind the rider and the child.',
    duration: 220,
    lawCitation:
      "RA 10666, the Children's Safety on Motorcycles Act: it is unlawful to drive a two-wheeled motorcycle with a child on board on public roads with a heavy volume of vehicles, a high density of fast-moving vehicles, or a speed limit of more than 60 km/h, unless the child's feet can comfortably reach the standard foot peg, the child's arms can reach around and grasp the rider's waist, and the child wears a standard protective helmet. The exception is a child who needs immediate medical attention. Fines are Php 3,000, then Php 5,000, then Php 10,000 with a one-month license suspension, and Php 10,000 with automatic revocation of the license for succeeding offenses; where a child or anyone else is killed or injured, the rider or operator also faces one year's imprisonment and the Revised Penal Code. The Act is the rider's to obey. Yours is the room behind: at least two or three seconds.",
    competency: 'general_rules',
    severity: 'critical',
    following: {
      seconds: 2,
      tooCloseMessage: 'You were inside two seconds of a motorcycle carrying a child.',
    },
  },
];

// 6. The jeepney stop — the PUV driver's loading duty, and the driver's own
// rule for going past it. The jeepney is standing at the curb, which is where
// the lane it stops in meets the people waiting for it; the car in the inner
// lane is graded on having its speed down going by. The verdict this replaced
// graded the opposite and called stopping for a jeepney discourteous, which
// Level 8 teaches as courtesy.
const jeepneyStopSlot: SlotVariant[] = [
  {
    id: 'level11.jeepney-stop',
    label: 'Jeepney stop',
    type: 'obstacle_ahead',
    actor: { kind: 'jeepney', side: 'curb' },
    // On the footpath beside it, not in the road. Nobody here is in the car's
    // way yet, and nobody is solid.
    pedestrians: [
      { kind: 'adult', position: 1.1 },
      { kind: 'elderly', position: 1.21 },
      { kind: 'child', position: 1.31 },
    ],
    description:
      'A jeepney has pulled in at the curb ahead to load, and more passengers are waiting on the footpath beside it.',
    recommendedMove: 'Slow down past the jeepney and the people waiting.',
    correctAction: 'brake',
    points: 25,
    warningDistance: 420,
    penaltyMessage:
      'You went past a loading jeepney and the people waiting for it at speed. Where there are many people on foot, slow down.',
    rewardMessage: 'Correct. You had your speed down going past the jeepney stop.',
    duration: 200,
    lawCitation:
      "A bus or jeepney driver picks up and drops off passengers only at the correct loading and unloading zone, never on a curve or at an intersection, and stops out of traffic or the traveled lane; stopping outside the stopping zone and ignoring other motorists' right-of-way is one of the PUV violations that cause heavy traffic. A PUV conveys no more passengers than its sitting capacity and accommodates PWDs, pregnant women and senior citizens in designated seats. Going past, yours is the pedestrians' side of it: give way to pedestrians, and slow down where there is a high volume of them. A bus or PUJ stop zone is no place to park.",
    competency: 'general_rules',
    severity: 'major',
  },
];

// 7. The tricycle in the box — the curriculum's tricycle stop, where it meets
// the car's own rule. A tricycle picking up a passenger inside a yellow box is
// breaking two of the rules its own list names; the driver behind has one
// rule, and it is to keep out of the box. The box composes the tricycle beside
// its paint, just past its near edge (`SceneBuilder`), and the queue across the
// junction that a stop-graded box always draws.
const tricycleInTheBoxSlot: SlotVariant[] = [
  {
    id: 'level11.tricycle-in-the-box',
    label: 'Tricycle in the box',
    type: 'road_marking',
    marking: {
      name: 'Yellow Box',
      image: 'arangkada_extracted_images/level4/yellow-box-do-not-block-intersection.jpg',
      category: 'C. Other Line',
      meaning:
        'Yellow lines forming a box across the intersection with diagonal lines inside it; no vehicle should stay inside the box, even while waiting in traffic.',
      art: 'yellow_box',
    },
    actor: { kind: 'tricycle', side: 'inner' },
    description:
      'A tricycle has stopped just inside the yellow box ahead, and the traffic across the junction is not moving.',
    recommendedMove: 'Stop before the box and keep it clear.',
    correctAction: 'stop',
    points: 20,
    penaltyMessage:
      'You went on into a box the tricycle and the cross traffic were already blocking. No vehicle should stay inside the box.',
    rewardMessage: 'Correct. You stopped short of the box and kept it clear.',
    duration: 220,
    lawCitation:
      "A yellow box marks the part of a junction no vehicle should stay inside, so that it does not obstruct other motorists. The tricycle is breaking its own rules twice: waiting within six meters of an intersection, and stopping on a yellow box, one of the violations of public utility drivers that cause heavy traffic. A tricycle is registered and renewed every year like any other motor vehicle; its franchise comes from the local government unit, not the LTFRB; and it displays its authorized fare matrix and identification card.",
    // Graded on keeping out of the yellow box: lane discipline (the groupmate's
    // catalogue review), as Level 4's yellow box is.
    competency: 'lane_discipline',
    severity: 'major',
  },
];

// 8. The crossing at the jeepney stop — where the passengers a PUV carries are
// on foot. A full stop, because slowing for somebody already on the crossing
// leaves the rest of the crossing to chance.
const crossingAtTheStopSlot: SlotVariant[] = [
  {
    id: 'level11.crossing-at-the-stop',
    label: 'Crossing at the stop',
    type: 'pedestrian_crossing',
    // She is half-way over, on the far half of the crossing and walking toward
    // the car's side, and is the one person who can be hit — where Level 5 puts
    // its own, so a driver who waits for her is never in her path. The two
    // waiting are on the footpath.
    pedestrians: [
      { kind: 'elderly', solid: true, position: 0.4 },
      { kind: 'adult', position: 1.1 },
      { kind: 'adult', position: 1.22 },
    ],
    description:
      'An elderly woman is part-way across the pedestrian crossing ahead, and two more people are waiting at the curb behind her.',
    recommendedMove: 'Stop before the crossing and let her finish.',
    correctAction: 'stop',
    points: 25,
    warningDistance: 420,
    penaltyMessage:
      'You did not stop for the woman on the crossing. Approaching a pedestrian lane, slow down and stop to yield to pedestrians.',
    rewardMessage: 'Correct. You stopped before the crossing for the woman on it.',
    duration: 220,
    lawCitation:
      'Give way to pedestrians at crossings, pavements and intersections, slow down where there is a high volume of pedestrians, and exercise extreme caution approaching the pedestrian lane; those with disabilities may need extra time to cross. The same people have protections on board: a jeepney keeps at least two seats for PWDs, every PUV accommodates PWDs, pregnant women and senior citizens in designated seats, and senior citizens, PWDs and students from preschool to college ride at a 20% fare discount.',
    competency: 'pedestrians',
    severity: 'critical',
  },
];

// 9. The overloaded jeepney — the overloading rules, every one of them pointed
// at the vehicle behind. Only rules that apply to a jeepney are named: standing
// passengers and roof freight are the bus's rules in the material, and the
// rear step is the running board the violation list names. The passengers on
// the step and the bar past the tail are prose; the jeepney is on the road.
const overloadedJeepneySlot: SlotVariant[] = [
  {
    id: 'level11.overloaded-jeepney',
    label: 'Overloaded jeepney',
    type: 'obstacle_ahead',
    npc: {
      path: 'travelling_ahead',
      vehicleKind: 'jeepney',
      label: 'an overloaded jeepney',
      approachSpan: 620,
      // Clear of three seconds when it joins, for the reason the riders are
      // clear of two.
      entryHeadway: 3.4,
      speed: { cruise: 1, slowsTo: 0.3, slowsFrom: 420 },
    },
    description:
      'The jeepney ahead is carrying more than it should, and it slows without warning.',
    recommendedMove: 'Keep three seconds behind the jeepney.',
    correctAction: 'brake',
    points: 20,
    warningDistance: 420,
    penaltyMessage: 'You closed up behind an overloaded jeepney.',
    rewardMessage: 'Correct. You stayed well back from the overloaded jeepney.',
    duration: 200,
    lawCitation:
      'A load that extends more than one meter beyond the body of the vehicle is marked with a red flag, or a red light at night. Permitting a passenger to ride on the running board, step board or mudguard while the vehicle is moving is a violation, and so is allowing passengers on top of a vehicle. A PUV conveys no more passengers than its sitting capacity; overloading passengers is fined Php 5,000, then Php 10,000, then Php 15,000 with the cancellation of the CPC. None of it is yours to enforce. Yours is the space: keep adequate room behind a long or loaded vehicle, at least two or three seconds.',
    competency: 'hazard_awareness',
    severity: 'major',
    following: {
      seconds: 3,
      tooCloseMessage: 'You were inside three seconds of an overloaded jeepney.',
    },
  },
];

// 10. The flashing tail lamp — the motorcycle lighting rules, the one part of
// the accessory rules whose whole purpose is to be read by the driver behind.
// The lamp flashes whether the rider is braking or not, so it slows on the
// run-in without telling anybody. Three seconds rather than two, the long end
// of the rule, because the warning a brake light gives is missing.
const flashingTailLampSlot: SlotVariant[] = [
  {
    id: 'level11.flashing-tail-lamp',
    label: 'Flashing tail lamp',
    type: 'obstacle_ahead',
    npc: {
      path: 'travelling_ahead',
      vehicleKind: 'motorcycle',
      label: 'a motorcycle with a flashing tail lamp',
      approachSpan: 620,
      entryHeadway: 3.4,
      speed: { cruise: 1, slowsTo: 0.3, slowsFrom: 420 },
      rider: { tailLamp: 'blinking' },
    },
    description: 'The motorcycle ahead has a tail lamp that flashes on and off all the time.',
    recommendedMove: 'Keep three seconds behind the motorcycle.',
    correctAction: 'brake',
    points: 20,
    warningDistance: 420,
    penaltyMessage: 'You closed up behind a motorcycle whose tail lamp could not tell you it was slowing.',
    rewardMessage: 'Correct. You kept your distance behind the motorcycle.',
    duration: 200,
    lawCitation:
      "A motorcycle's brake light must be bright red and its headlight yellowish white or yellow. A blinker taillight is not allowed: it is illegal modification under JAO No. 2014-01, and operating with improper or unauthorized blinkers, brake lights or tail lights carries a Php 5,000 fine, the vehicle impounded until they are corrected. Auxiliary LED headlamps have limits of their own: a separate switch, pointed rightward, white or yellowish white, up to two lamps of six bulbs, directed 20 cm downward at 10 meters forward, no higher than the handlebar, and never used on a well-lit street, toward oncoming vehicles or in place of the headlamp. A lamp that flashes all the time cannot tell you when the rider brakes: stay at least two or three seconds back.",
    competency: 'hazard_awareness',
    severity: 'major',
    following: {
      seconds: 3,
      tooCloseMessage: 'You were inside three seconds of a motorcycle whose lamp gives no warning that it is slowing.',
    },
  },
];


/* -------------------------------------------------------------------------
 * Pooled versions (2026-11-16, future work, draft for the team's check)
 *
 * Each slot keeps its driven scenario and gains two frozen questions on the
 * same competency, each a different rule from the Level 11 module
 * (`level11Module.ts`) or the Level 11 source material, cited by section or
 * tag. The scene vocabulary
 * draws one rider detail per rule, so the other rules are asked (`qaVariant`).
 * ---------------------------------------------------------------------- */

ridersInTheirLaneSlot.push(
  qaVariant(ridersInTheirLaneSlot[0], {
    id: 'level11.riders-in-their-lane.leaving-the-lane',
    label: 'Out of the motorcycle lane',
    description: 'You are riding a motorcycle in a motorcycle lane, and the lane beside it is moving faster.',
    question: 'May you move into the faster lane?',
    correct: 'No, unless an enforcer directs it or you are turning, signaling within 100 meters',
    wrong: ['Yes, whenever it is moving faster', 'Yes, if you switch on the hazard lights'],
    penaltyMessage:
      'Riders are not allowed to stay on other lanes unless instructed by enforcers or turning into an intersection, signaling the intention within 100 meters.',
    rewardMessage: 'Correct. The motorcycle lane is where the rider stays.',
    lawCitation:
      'Level 11 pack N1 (FDM Vol. 1, Other Markings): "MOTORCYCLE LANES -- lanes allotted for motorcycle riders and can be shared with other vehicles. Riders are not allowed to stay on other lanes unless instructed by enforcers or the rider is turning into an intersection and must signal his/her intention within 100 meters".',
  }),
  qaVariant(ridersInTheirLaneSlot[0], {
    id: 'level11.riders-in-their-lane.bus-lane',
    label: 'The bus lane',
    description: 'A bus in a marked bus lane is stuck behind a stalled jeepney.',
    question: 'When may the bus driver use another lane?',
    correct: 'Only when an enforcer instructs it, or when turning into an intersection',
    wrong: ['Whenever the bus lane is slower', 'Never, even to turn'],
    penaltyMessage:
      'Bus drivers are not allowed to use other lanes except when instructed by enforcers or when turning into an intersection.',
    rewardMessage: 'Correct. Enforcer or turn; otherwise the bus lane.',
    lawCitation:
      'Level 11 pack N6 (FDM Vol. 1, Other Markings): "BUS LANE -- designated lanes for buses. Bus drivers are not allowed to use other lanes except when instructed by enforcers or when turning into an intersection".',
  }),
);

noHelmetSlot.push(
  qaVariant(noHelmetSlot[0], {
    id: 'level11.no-helmet.back-rider-braking',
    label: 'With a back rider',
    description: 'You are riding a motorcycle with a back rider for the first time.',
    question: 'What should you anticipate?',
    correct: 'A longer braking distance',
    wrong: ['A shorter braking distance: the extra weight grips', 'No difference in how the motorcycle stops'],
    penaltyMessage: 'Anticipate a longer braking distance when carrying a back rider.',
    rewardMessage: 'Correct. More weight, more road to stop in.',
    lawCitation:
      'Level 11 module, General Riding Standards: "Anticipate a longer braking distance when carrying a back rider." Pack T8: "When driving a motorcycle with a back rider, one must anticipate: — longer braking distance".',
  }),
  qaVariant(noHelmetSlot[0], {
    id: 'level11.no-helmet.headlight-in-daylight',
    label: 'Riding in daylight',
    description: 'It is a bright, clear morning and you are about to ride off on a motorcycle.',
    question: 'Do you switch the headlight on?',
    correct: 'Yes: switch on the headlights when riding, even in daylight',
    wrong: ['No: headlights are for night only', 'Only on an expressway'],
    penaltyMessage: 'Switch on headlights when riding, for safety, even in daylight.',
    rewardMessage: 'Correct. Lights on, so others see you.',
    lawCitation:
      'Level 11 module, General Riding Standards: "Switch on headlights when riding, for safety, even in daylight." "Wear bright clothing when riding at night for clear visibility to other motorists."',
  }),
);

cyclistSlot.push(
  qaVariant(cyclistSlot[0], {
    id: 'level11.cyclist-in-the-bike-lane.sidewalk',
    label: 'Up on the sidewalk',
    description: 'Traffic is jammed, and a rider ahead of you mounts the sidewalk to get past.',
    question: 'Is that allowed?',
    correct: 'No: riders are prohibited from using sidewalks and center islands',
    wrong: ['Yes, if no pedestrian is on it', 'Yes, at walking speed'],
    penaltyMessage: 'Riders are prohibited from using sidewalks and center islands.',
    rewardMessage: 'Correct. The sidewalk is not a lane.',
    lawCitation:
      'Level 11 module, General Riding Standards: "Riders are prohibited from using sidewalks and center islands." Pack T8: "The law prohibits riders to use: — the sidewalks and center island Pursuant to R.A. No. 4136".',
  }),
  qaVariant(cyclistSlot[0], {
    id: 'level11.cyclist-in-the-bike-lane.yellow-box',
    label: 'In the yellow box',
    description: 'You are on a motorcycle and the traffic ahead stops while you are about to enter a yellow box.',
    question: 'May you stop inside the box?',
    correct: 'No: never stop inside a yellow box, under any circumstance',
    wrong: ['Yes, a motorcycle is small enough', 'Yes, if the light is still green'],
    penaltyMessage: 'Never stop inside a yellow box, under any circumstance.',
    rewardMessage: 'Correct. Wait before the box.',
    lawCitation:
      'Level 11 module, General Riding Standards: "Never stop inside a yellow box, under any circumstance." Pack T8: "Can a motorcyclist stop in a yellow box? — At any instance a rider is not allowed to stop inside a yellow box".',
  }),
);

deliveryBoxSlot.push(
  qaVariant(deliveryBoxSlot[0], {
    id: 'level11.delivery-box.top-box-limits',
    label: 'A new top box',
    description: 'You are fitting a factory-made top box to your motorcycle.',
    question: 'Which is within the rules?',
    correct: 'Securely attached, clear of the side mirrors, holding at most two full-face helmets',
    wrong: ['Any size, as long as it is locked', 'Wider than the handlebars, if it is DTI-approved'],
    penaltyMessage:
      'A top box must not exceed 2 x 2 x 2 feet, must be securely attached, must not obstruct the view from the side mirrors, and can carry at most two full-faced helmets.',
    rewardMessage: 'Correct. Secure, clear of the mirrors, two helmets at most.',
    lawCitation:
      'Level 11 module, Top Boxes And Saddle Bags: "Top box — Must not exceed 2 feet x 2 feet x 2 feet, must be securely attached, must not obstruct the view from the side mirrors, and can carry a maximum of two full-faced helmets."',
  }),
  qaVariant(deliveryBoxSlot[0], {
    id: 'level11.delivery-box.saddle-bags',
    label: 'Saddle bags',
    description: 'A rider wants saddle bags big enough to rise above the seat and stick out past the tail.',
    question: 'Are they allowed?',
    correct: 'No: not higher than the seat, at most 14 inches from the sides, not past the tail end',
    wrong: ['Yes, if they are securely strapped', 'Yes, for a delivery rider'],
    penaltyMessage:
      'A saddle bag must not be higher than the seat, must not exceed 14 inches from the sides, and its length must not exceed the tail end of the motorcycle.',
    rewardMessage: 'Correct. Below the seat, within 14 inches, inside the tail.',
    lawCitation:
      'Level 11 module, Top Boxes And Saddle Bags: "Saddle bag — Must not be higher than the seat, must not exceed 14 inches from the sides, and its length must not exceed the tail end of the motorcycle."',
  }),
);

childAboardSlot.push(
  qaVariant(childAboardSlot[0], {
    id: 'level11.child-aboard.medical-emergency',
    label: 'To the hospital',
    description: 'A neighbor\'s small child is badly hurt, and the only way to the hospital now is your motorcycle.',
    question: 'Does the child-passenger prohibition apply?',
    correct: 'No: it does not apply when the child needs immediate medical attention',
    wrong: ['Yes, always: wait for a car', 'Only on a road posted over 60 km/h'],
    penaltyMessage: 'The prohibition does not apply if the child being transported needs immediate medical attention.',
    rewardMessage: 'Correct. A medical emergency is the exception.',
    lawCitation:
      'Level 11 module, Children\'s Safety on Motorcycles Act (RA 10666), Exception: "The prohibition does not apply if the child being transported needs immediate medical attention."',
  }),
  qaVariant(childAboardSlot[0], {
    id: 'level11.child-aboard.one-back-rider',
    label: 'Two want a ride',
    description: 'Two friends both ask to ride behind you on your motorcycle.',
    question: 'How many may ride?',
    correct: 'One: only one back rider is allowed at a time',
    wrong: ['Both, if they are small', 'Both, for a short distance'],
    penaltyMessage: 'Only one back rider is allowed at a time.',
    rewardMessage: 'Correct. One back rider.',
    lawCitation:
      'Level 11 module, Other Accessory And Riding Standards: "Back riders — Only one back rider is allowed at a time." Pack T8: "If two passengers insist to back ride with you, what should you do? — Allow only one back rider".',
  }),
);

jeepneyStopSlot.push(
  qaVariant(jeepneyStopSlot[0], {
    id: 'level11.jeepney-stop.not-at-the-corner',
    label: 'A passenger at the corner',
    description: 'A passenger asks the jeepney driver to stop right at the intersection ahead.',
    question: 'Where may the driver let them off?',
    correct: 'At a designated drop-off point, never on a curve or at an intersection',
    wrong: ['Right at the intersection, quickly', 'Anywhere, if the hazards are on'],
    penaltyMessage:
      'Load and unload only at designated pick-up and drop-off points. Never load or unload passengers on a curve or at an intersection.',
    rewardMessage: 'Correct. The designated point, out of the flow of traffic.',
    lawCitation:
      'Level 11 module, Correct Loading And Unloading: "Load and unload only at designated pick-up and drop-off points." "Never load or unload passengers on a curve or at an intersection." "Stop the vehicle out of the flow of traffic."',
  }),
  qaVariant(jeepneyStopSlot[0], {
    id: 'level11.jeepney-stop.standing-on-the-bus',
    label: 'A full bus',
    description: 'Every seat on the bus is taken, and two more passengers want to ride standing.',
    question: 'May they?',
    correct: 'No: passengers are not allowed to stand while a bus is moving',
    wrong: ['Yes, if they hold on', 'Yes, on short trips'],
    penaltyMessage:
      'Passengers are not allowed to stand while a bus is in motion, at any time, and a PUV conveys passengers only up to its sitting capacity.',
    rewardMessage: 'Correct. They wait for the next bus.',
    lawCitation:
      'Level 11 module, Overloading Passengers: "Passengers are not allowed to stand while a bus is in motion, at any time." Buses And Jeepneys: "Convey passengers only up to the vehicle\'s sitting capacity."',
  }),
);

tricycleInTheBoxSlot.push(
  qaVariant(tricycleInTheBoxSlot[0], {
    id: 'level11.tricycle-in-the-box.franchise',
    label: 'A tricycle franchise',
    description: 'A neighbor wants to run a tricycle for hire in your town.',
    question: 'Who grants the franchise?',
    correct: 'The local government unit, not the LTFRB',
    wrong: ['The LTFRB, with a CPC', 'The LTO, at registration'],
    penaltyMessage:
      'A tricycle does not need a CPC from the LTFRB; the concerned Local Government Unit regulates tricycle operation and grants franchises within its own territory.',
    rewardMessage: 'Correct. The LGU grants it.',
    lawCitation:
      'Level 11 module, Registration And Franchise: "A tricycle does not need a Certificate of Public Convenience (CPC) from the LTFRB; the concerned Local Government Unit regulates tricycle operation and grants franchises within its own territory."',
  }),
  qaVariant(tricycleInTheBoxSlot[0], {
    id: 'level11.tricycle-in-the-box.helmet-exemption',
    label: 'Tricycle driver\'s helmet',
    description: 'An enforcer stops a tricycle whose driver has no helmet on.',
    question: 'Is that a helmet violation?',
    correct: 'No: tricycle drivers are exempted from the helmet law',
    wrong: ['Yes: every rider must wear one', 'Yes, unless the tricycle has a roof'],
    penaltyMessage: 'Tricycle drivers are exempted from the mandatory wearing of motorcycle helmets under RA 10054.',
    rewardMessage: 'Correct. The helmet law exempts tricycle drivers.',
    lawCitation:
      'Level 11 module, Motorcycle Helmet Act (RA 10054), Exemption: "Tricycle drivers are exempted from the mandatory wearing of motorcycle helmets under this Act."',
  }),
);

crossingAtTheStopSlot.push(
  qaVariant(crossingAtTheStopSlot[0], {
    id: 'level11.crossing-at-the-stop.sidewalk-waiting',
    label: 'Waiting on the sidewalk',
    description: 'A tricycle driver parks on the sidewalk to wait for passengers, and people walk around it in the road.',
    question: 'Is that allowed?',
    correct: 'No: parking or waiting on sidewalks meant for pedestrians is a violation',
    wrong: ['Yes, if it is not blocking a door', 'Yes, at a tricycle stop'],
    penaltyMessage: 'Parking or waiting on sidewalks meant for pedestrians is one of the common tricycle violations.',
    rewardMessage: 'Correct. The sidewalk is for pedestrians.',
    lawCitation:
      'Level 11 module, Common Tricycle Violations: "Parking or waiting on sidewalks meant for pedestrians." Pack A2: "Do not travel nor park into bicycle or pedestrian lanes."',
  }),
  // Driven: your light turns green while a wheelchair user is still on the
  // crossing. Staged as Level 5's green-with-pedestrians is; graded on
  // stopping for them (Level 11 pack N3, N11).
  {
    id: 'level11.crossing-at-the-stop.extra-time',
    label: 'Crossing slowly',
    type: 'scenario_trigger',
    scene: 'signal',
    description: 'Your light turns green while a wheelchair user is still part-way across the crossing ahead.',
    pedestrians: [{ kind: 'pwd', solid: true, position: 0.45 }],
    sign: {
      name: 'Traffic Signal, Green',
      category: 'Traffic Signal',
      meaning: 'You may proceed, but only after yielding to anyone already on the crossing.',
      art: 'signal_head',
      aspect: 'green',
    },
    recommendedMove: 'Stop and let them finish crossing.',
    correctAction: 'stop',
    points: 25,
    warningDistance: 340,
    penaltyMessage:
      'Give way to pedestrians at crossings and intersections. Those with disabilities may need extra time to cross a road.',
    rewardMessage: 'Correct. You waited until they had finished crossing.',
    duration: 220,
    lawCitation:
      'Level 11 pack N3 (FDM Vol. 1, Road Sharing): "Give way to pedestrians at crossings, pavements, and intersections. Slow down where there is a high volume of pedestrians. Those with disabilities may need extra time to cross a road." N11: "When approaching a crosswalk or pedestrian lane, you should: — slow down and stop to yield to pedestrians".',
    competency: 'pedestrians',
    severity: 'critical',
  },
);

overloadedJeepneySlot.push(
  qaVariant(overloadedJeepneySlot[0], {
    id: 'level11.overloaded-jeepney.load-at-night',
    label: 'A long load at night',
    description: 'At night, a truck ahead carries pipes that stick out more than a meter past its body.',
    question: 'How must that load be marked?',
    correct: 'With a red light at night (a red flag by day)',
    wrong: ['It needs no marking at night', 'With a white light, to be seen'],
    penaltyMessage:
      'Use a red flag to mark loads that extend more than one meter beyond the body of the vehicle. When transporting cargo at night, use a red light instead.',
    rewardMessage: 'Correct. A red light at night.',
    lawCitation:
      'Level 11 pack O1 (RO104): "Use a red flag to mark loads that extend more than one meter beyond the body of the vehicle. When transporting cargo at night, use a red light instead."',
  }),
  qaVariant(overloadedJeepneySlot[0], {
    id: 'level11.overloaded-jeepney.loose-in-the-back',
    label: 'Loose in the back',
    description: 'You are carrying boxes of tiles loose on the back seat and the rear window deck.',
    question: 'What is the danger?',
    correct: 'In a sudden stop they can hit the passengers or the driver',
    wrong: ['None: the back seat holds them', 'Only that they may break'],
    penaltyMessage:
      'Never load unsecured items on the backseat or rear window deck. They can hit passengers or the driver when the vehicle comes to a sudden stop.',
    rewardMessage: 'Correct. Secure them, or carry them elsewhere.',
    lawCitation:
      'Level 11 pack O1 (RO104): "Never load unsecured items on the backseat or rear window deck of the vehicle. This can cause the load to hit passengers or the driver when the vehicle comes to a sudden stop."',
  }),
);

flashingTailLampSlot.push(
  qaVariant(flashingTailLampSlot[0], {
    id: 'level11.flashing-tail-lamp.light-colors',
    label: 'Motorcycle lights',
    description: 'A rider wants to change the motorcycle\'s lamps to colors of their own choice.',
    question: 'Which is the rule?',
    correct: 'Headlight yellowish white or yellow; brake light bright red',
    wrong: ['Any color, if it is bright', 'Headlight blue; brake light amber'],
    penaltyMessage: "A motorcycle's headlight is yellowish white or yellow, and its brake light bright red.",
    rewardMessage: 'Correct. Yellowish white in front, bright red behind.',
    lawCitation:
      'Level 11 module, Other Accessory And Riding Standards: "Headlight color — Yellowish white or yellow." "Brake light color — Bright red." "Blinker taillight — Not allowed."',
  }),
  qaVariant(flashingTailLampSlot[0], {
    id: 'level11.flashing-tail-lamp.auxiliary-lamps',
    label: 'Auxiliary lamps',
    description: 'A rider with LED auxiliary lamps rides down a well-lit city street toward oncoming traffic.',
    question: 'Should the auxiliary lamps be on?',
    correct: 'No: not on a well-lit street or when approaching an oncoming vehicle',
    wrong: ['Yes, always, for visibility', 'Yes, in place of the main headlamp'],
    penaltyMessage:
      'Auxiliary headlamps must not be used on a well-lit street, or when approaching an oncoming vehicle, and never in place of the main headlamp.',
    rewardMessage: 'Correct. Off here.',
    lawCitation:
      'Level 11 module, Auxiliary Headlamps (LED): "Must not be used on a well-lit street, or when approaching an oncoming vehicle." "Must never be used in place of the main headlamp."',
  }),
);

export const SLOT_DISTANCES = [840, 1540, 2240, 2940, 3640, 4340, 5040, 5740, 6440, 7140];
export const SLOTS: SlotVariant[][] = [
  ridersInTheirLaneSlot,
  noHelmetSlot,
  cyclistSlot,
  deliveryBoxSlot,
  childAboardSlot,
  jeepneyStopSlot,
  tricycleInTheBoxSlot,
  crossingAtTheStopSlot,
  overloadedJeepneySlot,
  flashingTailLampSlot,
];

/**
 * The level is worth 225 points: 25 for each of the five scenarios whose cost
 * lands on a person — the riders, the cyclist, the child, the people at the
 * jeepney stop, the woman on the crossing — and 20 for each of the five where
 * it is measured in risk.
 *
 * The pass mark is 158, 70% of the total, as it has been. No single habit
 * reaches it, and `level11Drive.test.ts` drives each one rather than reasoning
 * about it:
 *
 * - **Brake at everything** passes every gap and slowing, and loses both full
 *   stops, whose wrong answers cost more than they were worth, on top of the
 *   crawl it is charged for between scenarios.
 * - **Keep up with the traffic** closes on every rider and the jeepney, and
 *   goes through the box and the crossing.
 * - **Stop and wait** never reaches the end of the road.
 *
 * A driver who stops at every scenario and drives on between them does pass:
 * nothing in the sources makes stopping wrong at any point on this road.
 */
export const level11: LevelConfig = {
  id: 11,
  name: levelModule.title,
  moduleId: levelModule.id,
  description: levelModule.desc,
  // Ten events 700 apart, plus a runway past the last one long enough for its
  // measurement window to close before the road ends.
  roadLength: 7840,
  // A national road through a town, where motorcycles, tricycles, jeepneys and
  // cyclists share a road with through traffic, and a jeepney stop and a
  // crossing share a curb: Republic Act No. 4136, Section 35(b)'s city or municipal street, at 30,
  // which is not over the 60 km/h line of RA 10666 — the one fact about this
  // road scenario 5's citation depends on. Spaced and measured at 60 on the
  // dial; driven at 30 as it was at 60.
  roadClass: 'city_street',
  speedLimit: 30,
  pace: spacedPace(30, 60),
  requiredScore: 158,
  events: buildEvents(SLOTS, SLOT_DISTANCES, pool => pool[0]),
  /**
   * An ordinary two-way national road: four lanes, the left two carrying
   * opposing traffic.
   *
   * The two spans are the lanes scenarios 1 and 3 are about, painted as tinted
   * and lettered curb-side bands so the lane a rider or cyclist is entitled to
   * is something the player can see rather than something the prompt asserts.
   * Each covers the stretch its rider or cyclist travels while the scenario is
   * live.
   */
  paint: {
    oncomingLanes: 2,
    base: 'broken_yellow',
    spans: [
      { from: 380, to: 1160, art: 'motorcycle_lane' },
      { from: 1640, to: 2420, art: 'bicycle_lane' },
    ],
  },
};
