import type { SlotVariant } from '@/features/driving-sim/domain/scenario/pooling';
import type { ScenarioEvent } from '@/features/driving-sim/domain/scenario/scenarioDefinition';
import type { MarkingPlate } from '@/features/driving-sim/domain/scenario/scenarioScene';

/** Folder the level module already publishes its marking images from. */
const IMG = 'arangkada_extracted_images/level4/';

type Action = ScenarioEvent['correctAction'];

interface MarkingSpec extends MarkingPlate {
  id: string;
  description: string;
  law: string;
  /** Sentence explaining the failure; the points figure is appended for you. */
  penalty: string;
  reward: string;
  correctAction: Action;
  type?: ScenarioEvent['type'];
  points?: number;
  severity?: 'minor' | 'major';
  scene?: ScenarioEvent['scene'];
  requiredLane?: ScenarioEvent['requiredLane'];
  effect?: ScenarioEvent['effect'];
  avoid?: ScenarioEvent['avoid'];
  bay?: ScenarioEvent['bay'];
  speedRule?: ScenarioEvent['speedRule'];
  postedSpeed?: ScenarioEvent['postedSpeed'];
  neutral?: ScenarioEvent['neutral'];
  warningDistance?: ScenarioEvent['warningDistance'];
}

/**
 * Collapses a marking down to the parts that actually differ between markings,
 * so a catalogue of thirty-odd stays readable — and so the deduction quoted in
 * the penalty text is always the one the rule engine will really take.
 */
const marking = (spec: MarkingSpec): SlotVariant => {
  const points = spec.points ?? 20;
  const severity = spec.severity ?? 'major';

  return {
    id: spec.id,
    type: spec.type ?? 'road_marking',
    description: spec.description,
    correctAction: spec.correctAction,
    points,
    duration: 200,
    penaltyMessage: `${spec.penalty}`,
    rewardMessage: `${spec.reward}`,
    lawCitation: spec.law,
    competency: 'lane_discipline',
    severity,
    ...(spec.scene ? { scene: spec.scene } : {}),
    ...(spec.requiredLane ? { requiredLane: spec.requiredLane } : {}),
    ...(spec.effect ? { effect: spec.effect } : {}),
    ...(spec.avoid ? { avoid: spec.avoid } : {}),
    ...(spec.bay ? { bay: spec.bay } : {}),
    ...(spec.speedRule ? { speedRule: spec.speedRule } : {}),
    ...(spec.postedSpeed ? { postedSpeed: spec.postedSpeed } : {}),
    ...(spec.neutral ? { neutral: spec.neutral } : {}),
    ...(spec.warningDistance ? { warningDistance: spec.warningDistance } : {}),
    marking: {
      name: spec.name,
      ...(spec.image ? { image: spec.image } : {}),
      category: spec.category,
      meaning: spec.meaning,
      art: spec.art,
      ...(spec.glyph ? { glyph: spec.glyph } : {}),
      ...(spec.side ? { side: spec.side } : {}),
    },
  };
};

/**
 * Slot 1 — the line down the middle: may I cross it, and may I overtake?
 *
 * Every variant is the same road with the same slow vehicle ahead and the same
 * oncoming traffic. Only the paint differs, and reading it is the whole task —
 * lane position at the marking is what is graded, never a keypress.
 *
 * `scene: 'two_way'` is what puts the slow vehicle and the oncoming stream on
 * the road. A no-overtaking line with nothing to overtake is passed by simply
 * driving, which is the mistake Level 3 called out when it held the No
 * Overtaking Zone sign back for this level.
 *
 * The prohibitive lines below are graded with `requiredLane: { lane: 'inner',
 * strict: true }`. That replaces an earlier version of this slot that scored
 * these with `avoid: ['turn_left']` — which never actually worked, because the
 * telemetry only ever derives a `turn_left` action from a scored junction
 * manoeuvre, and nothing here has one. The `avoid` check was comparing against
 * an action that could never occur, so every prohibitive line always scored
 * correct regardless of whether the car had overtaken.
 *
 * `strict` is what makes the check honest about what these lines actually
 * forbid: not "being on the wrong side exactly at the marking," but crossing
 * it at all. A plain lane check only reads the car's lane at the marking's
 * own distance, which a driver can satisfy by overtaking early and drifting
 * back before that exact point — the crossing the line forbids, scored as if
 * it never happened. `strict` grades the whole approach instead, so a
 * crossing anywhere in the window still fails it.
 *
 * The permissive lines are `neutral`: overtaking here is allowed, not
 * required, so there is no wrong choice to fail a driver on. Forcing the
 * manoeuvre to score correct would teach that passing is obligatory wherever
 * it is legal, which is not the rule; leaving it untested when there is no
 * failure state to test is the honest version of the same lesson.
 *
 * Single Yellow Line With Broken White Line is the one marking in this slot
 * with two variants of itself: which line is "yours" depends on which side of
 * the pair you are driving on, and the module describes both readings. One
 * variant puts the broken white line on your side (permissive, neutral); the
 * other puts the solid yellow on your side (prohibitive, strict) — so
 * replaying the level tests both directions of the same marking rather than
 * only ever showing the permissive half.
 */
const longitudinalSlot: SlotVariant[] = [
  marking({
    id: 'level4.longitudinal.double-solid-yellow',
    name: 'Double Solid Yellow Line',
    image: IMG + 'double-solid-yellow-line.jpg',
    category: 'A. Longitudinal Line — Barrier Line',
    meaning: 'No overtaking and no crossing.',
    art: 'double_solid_yellow',
    scene: 'two_way',
    type: 'overtaking_zone',
    correctAction: 'accelerate',
    description: 'Double solid yellow line: a slow vehicle is ahead and traffic is coming the other way.',
    law: 'A Double Solid Yellow Line means no overtaking and no crossing.',
    penalty: 'You crossed a double solid yellow line into the oncoming lane. It forbids both overtaking and crossing, whatever the road ahead looks like.',
    reward: 'Correct. You read the double yellow and held your lane.',
    requiredLane: {
      lane: 'inner',
      strict: true,
      hint: 'Double solid yellow: no overtaking. Stay in your own lane.',
      wrongLaneMessage: 'You crossed a double solid yellow line into the oncoming lane. It forbids overtaking entirely.',
    },
  }),
  marking({
    id: 'level4.longitudinal.single-solid-yellow',
    name: 'Single Solid Yellow Line',
    image: IMG + 'single-solid-yellow-line.jpg',
    category: 'A. Longitudinal Line — Barrier Line',
    meaning: 'Crossing is allowed, but overtaking is not.',
    art: 'single_solid_yellow',
    scene: 'two_way',
    type: 'overtaking_zone',
    correctAction: 'accelerate',
    description: 'Single solid yellow line: a slow vehicle is ahead and traffic is coming the other way.',
    law: 'A Single Solid Yellow Line allows crossing but prohibits overtaking.',
    penalty: 'You overtook on a single solid yellow line. Crossing to reach a driveway is allowed; passing another vehicle on it is not.',
    reward: 'Correct. Crossing is allowed on this line, overtaking is not, and you stayed put.',
    requiredLane: {
      lane: 'inner',
      strict: true,
      hint: 'Single solid yellow: crossing is allowed, overtaking is not. Stay in your lane.',
      wrongLaneMessage: 'You overtook on a single solid yellow line, which this line does not permit.',
    },
  }),
  // "Barrier Line" is deliberately absent as a marking of its own. The level
  // module now uses it as the heading for the four yellow-line types above and
  // below this point, and gives it no image, so drawing it as a separate
  // marking would be asking the driver to tell a family apart from its members.
  marking({
    id: 'level4.longitudinal.centre-line',
    name: 'Center Or Separation Line',
    image: IMG + 'center-or-separation-line.jpg',
    category: 'A. Longitudinal Line',
    meaning: 'Crossing a solid white center line requires special care and is discouraged.',
    art: 'centre_line',
    scene: 'two_way',
    type: 'overtaking_zone',
    correctAction: 'accelerate',
    description: 'Solid white center line: a slow vehicle is ahead and traffic is coming the other way.',
    law: 'Crossing a solid white Center Or Separation Line requires special care and is discouraged.',
    penalty: 'You crossed the center line with oncoming traffic present. It separates opposing traffic for exactly that reason.',
    reward: 'Correct. You treated the center line as the separation it is.',
    requiredLane: {
      lane: 'inner',
      strict: true,
      hint: 'Solid center line: crossing is discouraged. Stay on your side.',
      wrongLaneMessage: 'You crossed the solid center line with traffic coming the other way.',
    },
  }),
  marking({
    id: 'level4.longitudinal.broken-and-solid-yellow',
    name: 'Broken And Solid Yellow Line',
    image: IMG + 'broken-and-solid-yellow-line.jpg',
    category: 'A. Longitudinal Line — Barrier Line',
    meaning: 'Crossing and overtaking allowed on the broken-line side with caution; not allowed on the solid-line side.',
    art: 'broken_and_solid_yellow',
    scene: 'two_way',
    type: 'overtaking_zone',
    correctAction: 'accelerate',
    description: 'Broken and solid yellow line, solid on your side: a slow vehicle is ahead.',
    law: 'On a Broken And Solid Yellow Line, crossing and overtaking are allowed from the broken-line side with caution and prohibited from the solid-line side.',
    penalty: 'You overtook from the solid-line side. The broken side belongs to oncoming traffic; yours was the one that forbids it.',
    reward: 'Correct. You read which of the two lines was yours and stayed on your side of it.',
    requiredLane: {
      lane: 'inner',
      strict: true,
      hint: 'The solid line is on your side: no overtaking from here.',
      wrongLaneMessage: 'You overtook from the solid-line side of a broken-and-solid yellow line, which forbids it.',
    },
  }),
  marking({
    id: 'level4.longitudinal.broken-yellow',
    name: 'Broken Yellow Line',
    image: IMG + 'broken-yellow-line.jpg',
    category: 'A. Longitudinal Line — Barrier Line',
    meaning: 'Crossing and overtaking allowed, with necessary precaution.',
    art: 'broken_yellow',
    scene: 'two_way',
    type: 'overtaking_zone',
    correctAction: 'accelerate',
    neutral: true,
    description: 'Broken yellow line: a slow vehicle is ahead and the road beyond it is clear.',
    law: 'A Broken Yellow Line allows crossing and overtaking, with necessary precaution.',
    penalty: 'This marking has no wrong choice — recognizing that a broken line permits the pass is the whole test.',
    reward: 'Correct. A broken yellow line permits overtaking; whether you took it was yours to decide.',
  }),
  marking({
    id: 'level4.longitudinal.broken-white-side',
    name: 'Single Yellow Line With Broken White Line',
    image: IMG + 'single-yellow-line-with-broken-white-line.jpg',
    category: 'A. Longitudinal Line — Barrier Line',
    meaning: 'No overtaking or crossing on the solid-yellow side; overtaking and crossing allowed on the broken-white side.',
    art: 'solid_yellow_broken_white',
    scene: 'two_way',
    type: 'overtaking_zone',
    correctAction: 'accelerate',
    neutral: true,
    description: 'Single yellow line with a broken white line, broken side yours: a slow vehicle is ahead.',
    law: 'A Single Yellow Line With Broken White Line prohibits overtaking and crossing from the solid-yellow side and allows both from the broken-white side.',
    penalty: 'This marking has no wrong choice — knowing which of the two lines is yours is the whole test.',
    reward: 'Correct. The broken white line was on your side, so the pass was yours to take or leave.',
  }),
  marking({
    id: 'level4.longitudinal.solid-yellow-side',
    name: 'Single Yellow Line With Broken White Line',
    image: IMG + 'single-yellow-line-with-broken-white-line.jpg',
    category: 'A. Longitudinal Line — Barrier Line',
    meaning: 'No overtaking or crossing on the solid-yellow side; overtaking and crossing allowed on the broken-white side.',
    art: 'broken_white_solid_yellow',
    scene: 'two_way',
    type: 'overtaking_zone',
    correctAction: 'accelerate',
    description: 'Single yellow line with a broken white line, solid side yours: a slow vehicle is ahead.',
    law: 'A Single Yellow Line With Broken White Line prohibits overtaking and crossing from the solid-yellow side and allows both from the broken-white side.',
    penalty: 'You overtook from the solid-yellow side. The broken white line belongs to the oncoming approach, not yours.',
    reward: 'Correct. The solid yellow line was on your side, and you stayed behind it.',
    requiredLane: {
      lane: 'inner',
      strict: true,
      hint: 'The solid yellow line is on your side: no overtaking from here.',
      wrongLaneMessage: 'You overtook from the solid-yellow side of this marking, which forbids it.',
    },
  }),
  marking({
    id: 'level4.longitudinal.lane-line',
    name: 'Lane Line',
    image: IMG + 'lane-line.jpg',
    category: 'A. Longitudinal Line',
    meaning: 'Changing lanes is allowed provided it is safe and will not obstruct other traffic.',
    art: 'lane_line',
    scene: 'two_way',
    type: 'overtaking_zone',
    correctAction: 'accelerate',
    neutral: true,
    description: 'Broken white lane lines: a slow vehicle is ahead in your lane and the next lane is clear.',
    law: 'A Lane Line allows changing lanes provided it is safe and will not obstruct other traffic.',
    penalty: 'This marking has no wrong choice — a lane line only ever permits a change, it never requires one.',
    reward: 'Correct. A lane line permits changing lanes; taking the gap or not was your call to make.',
  }),
];

/**
 * Slot 2 — the lane you are in is about to stop being a lane.
 *
 * These are the markings that are answered with the steering rather than the
 * brake: the paint tells you the road ahead is not laid out the way it is under
 * you now, and being in the right lane by the time you get there is the whole
 * response. `requiredLane` is what makes that real — the correct key pressed
 * from the wrong lane still fails.
 */
const laneChangeSlot: SlotVariant[] = [
  // Continuity Line, Transition Line and Approach Markings To Islands And
  // Obstructions are all deliberately absent from the drive.
  //
  // Continuity Line's whole premise is that the lane you are in stops
  // existing — but this corridor is permanently four lanes wide with nothing
  // that ever narrows it for real, so drawing the hatching over a lane that
  // carries on regardless would have depicted a closure the road never
  // enforces.
  //
  // Transition Line and Approach Markings both describe guiding traffic
  // around a raised island, and both would have to be drawn as the same
  // scene — but this corridor only ever scrolls straight ahead, with no
  // geometry for an island to actually split.
  //
  // All three stay in the module's reference table, where their full
  // meaning — including the median and lane-count readings Transition Line
  // also carries — is still taught.
  marking({
    id: 'level4.lane-change.chevron',
    name: 'Chevron',
    image: IMG + 'chevron-marking.png',
    category: 'H. Other Marking',
    meaning: 'Often used to guide traffic into the correct turning lane at a signalized intersection where an island separates movements, or to mark a change in horizontal alignment.',
    art: 'chevron_marking',
    correctAction: 'brake',
    description: 'Chevrons: a hatched wedge is painted over the lane nearest the center line ahead, ending at a raised island.',
    law: 'A Chevron guides traffic into the correct turning lane at a signalized intersection where an island separates movements, or marks a change in horizontal alignment.',
    penalty: 'You drove into the hatched wedge. The chevrons fold traffic out of that lane because there is a raised island at the end of it.',
    reward: 'Correct. You moved right of the wedge, clear of the island.',
    effect: { narrowsTo: 0.67, openSide: 'right', span: 90 },
    // Right of the wedge, into the curb-side lane the chevrons actually fold
    // traffic into. The lane to its left is oncoming, so there is only ever
    // one way around it.
    requiredLane: {
      lane: 'curb',
      hint: 'The wedge closes the lane beside the center line. Move right of it, into the curb-side lane.',
      wrongLaneMessage: 'You passed the chevrons inside the hatched wedge. It is closed off, and there is an island at the end of it.',
    },
  }),
  marking({
    id: 'level4.lane-change.edge-line',
    name: 'Edge Line',
    image: IMG + 'edge-line.jpg',
    category: 'A. Longitudinal Line',
    meaning: 'Separates the outside edge of the road from the shoulder.',
    art: 'edge_line',
    correctAction: 'accelerate',
    description: 'Edge lines: solid white lines mark where the carriageway ends and the shoulder begins.',
    law: 'An Edge Line separates the outside edge of the road from the shoulder.',
    penalty: 'The shoulder is not a lane. It is unmade surface, and the edge line is where the road actually stops.',
    reward: 'Correct. You held the carriageway and stayed off the shoulder.',
    requiredLane: {
      lane: 'inner',
      hint: 'Keep the car between the edge lines, off the shoulder.',
      wrongLaneMessage: 'You were riding the edge of the road. The edge line marks where the carriageway ends.',
    },
  }),
  marking({
    id: 'level4.lane-change.pavement-arrows',
    name: 'Pavement Arrows',
    image: IMG + 'pavement-arrows.jpg',
    category: 'H. Other Marking',
    meaning: 'White arrows painted on the road surface used for lane control, showing which direction(s) a lane permits.',
    art: 'pavement_arrow',
    correctAction: 'accelerate',
    description: 'Pavement arrows: an arrow is painted in each lane ahead, and your route turns right beyond them.',
    law: 'Pavement Arrows are white arrows painted on the road surface for lane control, showing which direction a lane permits.',
    penalty: 'A painted arrow assigns the lane as firmly as an overhead sign does.',
    reward: 'Correct. You took the lane the arrow assigned.',
    requiredLane: {
      lane: 'curb',
      hint: 'The arrow for your route is in the right lane. Move across.',
      wrongLaneMessage: 'You passed the arrows in a lane that does not serve your route.',
    },
  }),
];

/**
 * Slot 3 — the line that says exactly where to stop.
 *
 * Worth more than the other slots because these are the markings a driver
 * physically cannot recover from getting wrong: a vehicle stopped on a crossing
 * is already in the wrong place by the time anyone tells them.
 *
 * The Roundabout Holding Line is taught in the module and deliberately absent
 * here: this view scrolls straight up a corridor with no real branching, so a
 * rotunda is only ever drawn as a fixed circulation illusion at one point on
 * the corridor (see Level 5's `roundabout` scene), never as a junction you
 * actually enter and hold before. A line for that has nothing to hold you back
 * from in a marking slot that never plants one.
 */
const traverseSlot: SlotVariant[] = [
  marking({
    id: 'level4.traverse.stop-line',
    name: 'Stop Line',
    image: IMG + 'stop-line.jpg',
    category: 'B. Traverse Line',
    meaning: 'Vehicles are required to stop before the white line, at a designated point tied to a Stop sign or signal.',
    art: 'stop_line',
    type: 'stop_sign',
    correctAction: 'stop',
    points: 25,
    description: 'Stop line: a broad white bar is painted across your lane at the junction ahead.',
    law: 'Vehicles are required to stop before the white stop line, at the designated point tied to a Stop sign or signal.',
    penalty: 'Creeping past the stop line to see around traffic puts your bonnet in the junction before you have stopped.',
    reward: 'Correct. You stopped fully behind the line.',
  }),
  marking({
    id: 'level4.traverse.give-way-line',
    name: 'Give-Way Or Holding Line',
    image: IMG + 'give-way-or-holding-line.jpg',
    category: 'B. Traverse Line',
    meaning: 'Two adjacent broken white lines across the carriageway where the driver must give way to all traffic.',
    art: 'give_way_line',
    type: 'scenario_trigger',
    correctAction: 'brake',
    points: 25,
    description: 'Give-way line: two adjacent broken white lines cross your lane at the junction ahead.',
    law: 'A Give-Way Or Holding Line consists of two adjacent broken white lines across the carriageway, where the driver must give way to all traffic in accordance with the standard Give Way sign.',
    penalty: 'A give-way line carries the same duty as a Give Way sign, whether or not the sign is there.',
    reward: 'Correct. You slowed at the holding line and gave way.',
  }),
  marking({
    id: 'level4.traverse.pedestrian-signalized',
    name: 'Pedestrian Intersection (Signalized)',
    image: IMG + 'signalized-pedestrian-crossing-marking.jpg',
    category: 'B. Traverse Line',
    meaning: 'Marks the pedestrian crossing zone at a light-controlled intersection; the vehicle must stop clear of it, not on top of it.',
    art: 'pedestrian_crossing_signalized',
    type: 'pedestrian_crossing',
    correctAction: 'stop',
    points: 25,
    // A pedestrian who can actually be struck needs enough runway to stop
    // for, not just enough to read a marking and decide — the standard
    // warning distance was tuned for the latter and left too little room for
    // the former, so a driver who reacted the instant it appeared could still
    // reach the crossing before losing enough speed.
    warningDistance: 600,
    description: 'Pedestrian lane at a signalized junction: the signal is red, the stop line sits behind the stripes, and someone is out on the crossing.',
    law: 'A signalized Pedestrian Intersection marking marks the pedestrian crossing zone; the vehicle must stop clear of it, not on top of it.',
    penalty: 'You stopped on the crossing. That forces pedestrians, including PWDs and children, into moving traffic to get around you.',
    reward: 'Correct. You held behind the line until the signal released you.',
  }),
  marking({
    id: 'level4.traverse.pedestrian-non-signalized',
    name: 'Pedestrian Intersection (Non-Signalized)',
    image: IMG + 'non-signalized-pedestrian-crossing-marking.jpg',
    category: 'B. Traverse Line',
    meaning: 'Marks a pedestrian crossing without a traffic light; the vehicle must still stop clear of it and yield to pedestrians.',
    art: 'pedestrian_crossing',
    type: 'pedestrian_crossing',
    correctAction: 'stop',
    points: 25,
    description: 'Pedestrian lane with no signal: painted stripes cross the road and someone is stepping onto them.',
    law: 'A non-signalized Pedestrian Intersection marking marks a crossing without a traffic light; the vehicle must still stop clear of it and yield to pedestrians.',
    penalty: 'No signal does not mean no crossing. The marking alone obliges you to stop clear of it and yield.',
    reward: 'Correct. You stopped clear of the crossing and yielded.',
  }),
];

/**
 * Slot 4 — road space at the junction itself, protected by paint.
 *
 * This is the beat the module's own scenario is built around: the light being
 * green is not permission to enter a box you cannot clear.
 *
 * Turn Line is deliberately absent. It used to share this slot with Yellow
 * Box, and each of the two draws its own full 4-way crossroads — which meant a
 * single drive could show two complete intersections 800 units apart for no
 * reason connected to either marking, one right after the other. The junction
 * scene in this level is the yellow box specifically: the point being taught
 * is what not to do inside it, and that only needs one intersection, not two.
 * Turn Line stays in the module's reference table, where recognising it is
 * still the point.
 */
const junctionSpaceSlot: SlotVariant[] = [
  marking({
    id: 'level4.junction-space.yellow-box',
    name: 'Yellow Box',
    image: IMG + 'yellow-box-do-not-block-intersection.jpg',
    category: 'C. Other Line',
    meaning: 'Yellow lines forming a box across the intersection with diagonal lines inside it; no vehicle should stay inside the box, even while waiting in traffic.',
    art: 'yellow_box',
    correctAction: 'stop',
    points: 25,
    description: 'Yellow box: a hatched yellow box covers the junction and the traffic beyond it is not moving.',
    law: 'Never enter a yellow box unless there is enough space on the far side to clear it completely, even on a green light.',
    penalty: 'You stopped inside the yellow box. It blocks cross-traffic, which is the entire reason the box is painted.',
    reward: 'Correct. You held behind the box until the far side was clear.',
  }),
];

/**
 * Slot 5 — lanes that belong to someone else.
 *
 * `requiredLane` is doing the real work in every one of these. A reserved lane
 * you answer a question about but then drive down anyway has not been respected,
 * and the module's rule is about where the vehicle is, not what the driver
 * knows. The reserved lane is drawn as a tinted strip so the lane the grader is
 * measuring is the lane the player can see.
 */
const reservedLaneSlot: SlotVariant[] = [
  marking({
    id: 'level4.reserved-lane.bus-puj-lane',
    name: 'Bus And PUJ Lane Line',
    image: IMG + 'bus-and-puj-lane-line.jpg',
    category: 'C. Other Line',
    meaning: 'A solid yellow line separating other vehicles from buses and PUJs, often supplemented by raised pavement markers.',
    art: 'bus_puj_lane_line',
    side: 'right',
    correctAction: 'accelerate',
    description: 'Bus and PUJ lane line: a solid yellow line reserves the curb-side lane for buses and public utility jeepneys.',
    law: 'A Bus And PUJ Lane Line is a solid yellow line separating other vehicles from buses and PUJs.',
    penalty: 'An empty reserved lane is still reserved. Using it is a lane violation whether or not a bus is in it.',
    reward: 'Correct. You left the bus and PUJ lane to the vehicles it is for.',
    requiredLane: {
      lane: 'inner',
      hint: 'The curb-side lane is reserved for buses and PUJs. Keep out of it.',
      wrongLaneMessage: 'You drove in the bus and PUJ lane. The solid yellow line reserves it for them.',
    },
  }),
  marking({
    id: 'level4.reserved-lane.bus-lane',
    name: 'Bus Lane',
    image: IMG + 'bus-lane.jpg',
    category: 'D. Shared Lane',
    meaning: 'A designated lane for buses; bus drivers may not use other lanes except when instructed by enforcers or turning at an intersection.',
    art: 'bus_lane',
    side: 'right',
    correctAction: 'accelerate',
    description: 'Bus lane: the curb-side lane is painted and lettered as a designated bus lane.',
    law: 'A Bus Lane is a designated lane for buses; other vehicles must stay out of it.',
    penalty: 'Slow traffic is not an exemption. The bus lane keeps moving precisely because other vehicles stay out of it.',
    reward: 'Correct. You stayed out of the bus lane even though it was moving better.',
    requiredLane: {
      lane: 'inner',
      hint: 'The curb-side lane is a bus lane. Stay in your own.',
      wrongLaneMessage: 'You drove in the bus lane. It is designated for buses only.',
    },
  }),
  marking({
    id: 'level4.reserved-lane.bicycle-lane',
    name: 'Bicycle Lane',
    image: IMG + 'bicycle-lane.jpg',
    category: 'D. Shared Lane',
    meaning: 'Painted on the pavement with a solid line along the side of the road, for bicycle use.',
    art: 'bicycle_lane',
    side: 'right',
    correctAction: 'brake',
    description: 'Bicycle lane: a solid line marks the curb-side lane for bicycles, and cyclists are riding in it.',
    law: 'Do not travel or park in a bicycle lane; give cyclists sufficient clearance and watch your speed when passing.',
    penalty: 'Passing a cyclist fast and close is dangerous even from your own lane. The rule is clearance and speed, not just staying out of the paint.',
    reward: 'Correct. You kept out of the bike lane and eased off to pass with room.',
    requiredLane: {
      lane: 'inner',
      hint: 'Keep out of the bike lane and leave the cyclists room.',
      wrongLaneMessage: 'You drove in the bicycle lane. Cyclists have nowhere to go when you take their lane.',
    },
  }),
  marking({
    id: 'level4.reserved-lane.motorcycle-lane',
    name: 'Motorcycle Lane',
    image: IMG + 'motorcycle-lane.jpg',
    category: 'D. Shared Lane',
    meaning: 'Allotted for motorcycle riders and may be shared with other vehicles, but riders may not leave it except when instructed by enforcers or turning at an intersection.',
    art: 'motorcycle_lane',
    side: 'right',
    correctAction: 'brake',
    description: 'Motorcycle lane: the curb-side lane is marked for riders, and it crosses your path at the junction ahead.',
    law: 'Be extra careful when turning at intersections where a bike or motorcycle lane crosses your path.',
    penalty: 'A motorcycle lane crossing your path at a junction is where riders and turning cars actually collide.',
    reward: 'Correct. You slowed for the point where the motorcycle lane crosses.',
    requiredLane: {
      lane: 'inner',
      hint: 'Leave the motorcycle lane to the riders and watch where it crosses.',
      wrongLaneMessage: 'You drove in the motorcycle lane. It is allotted to riders.',
    },
  }),
];

/**
 * Object markings and raised markers, which share the lane-position beat above.
 *
 * Cones and barriers are solid: they carry hitboxes and take real width out of
 * the carriageway, so "treat the coned-off space as closed" is enforced by the
 * space actually being closed rather than by a message. That makes them the
 * same question as a continuity line — the road ahead is not the road you are
 * on, and the answer is which lane you are in when you get there. The cat's eye
 * belongs here for the same reason: a stud is a lane line you feel.
 */
const laneObstructionSlot: SlotVariant[] = [
  marking({
    id: 'level4.lane-change.traffic-cones',
    name: 'Traffic Cones On The Road',
    image: IMG + 'traffic-cones-on-the-road.jpg',
    category: 'F. Object Marking',
    meaning: 'Temporarily mark a hazard, lane closure, or work area; treat the coned-off space as closed to traffic.',
    art: 'traffic_cones',
    side: 'right',
    type: 'obstacle_ahead',
    correctAction: 'brake',
    description: 'Traffic cones: a line of cones tapers in from the right, closing that side of the carriageway.',
    law: 'Traffic cones temporarily mark a hazard, lane closure or work area; the coned-off space is closed to traffic.',
    penalty: 'You drove into the coned-off space. Cones mark road that is closed, not road that is merely discouraged.',
    reward: 'Correct. You slowed and took the lane that was still open.',
    // Closes the curb-side lane only, which is exactly what 0.75 of a
    // four-lane road leaves shut. The left half is oncoming, so the lane
    // beside the centre line is the one lane left — squeezing any harder
    // would funnel the car into opposing traffic to avoid a cone, which is
    // worse than the cone.
    effect: { narrowsTo: 0.75, openSide: 'left', span: 90 },
    requiredLane: {
      lane: 'inner',
      hint: 'Your curb lane is coned off and the left half is oncoming. Take the lane beside the center line.',
      wrongLaneMessage: 'You drove at the closed side of the road. The cones mark where it is shut.',
    },
  }),
  marking({
    id: 'level4.lane-change.concrete-barriers',
    name: 'Concrete Barriers',
    image: IMG + 'concrete-barriers.jpg',
    category: 'F. Object Marking',
    meaning: 'Physically separate traffic or protect a work zone or drop-off; give them clearance rather than hugging the edge.',
    art: 'concrete_barriers',
    side: 'right',
    type: 'obstacle_ahead',
    correctAction: 'brake',
    description: 'Concrete barriers: a run of barriers walls off the right of the carriageway.',
    law: 'Concrete barriers physically separate traffic or protect a work zone or drop-off; give them clearance rather than hugging the edge.',
    penalty: 'A concrete barrier does not give. Hugging it leaves no margin for the smallest steering error.',
    reward: 'Correct. You slowed and gave the barriers room.',
    effect: { narrowsTo: 0.75, openSide: 'left', span: 90 },
    requiredLane: {
      lane: 'inner',
      hint: 'Barriers close your curb lane and the left half is oncoming. Take the lane beside the center line.',
      wrongLaneMessage: 'You drove at the barriers. They are solid, and the lane beside the center line is the way past.',
    },
  }),
  marking({
    id: 'level4.lane-change.cats-eye',
    name: "Cat's Eye",
    image: IMG + 'cats-eye-road-stud.jpg',
    category: 'G. Raised Pavement Marker',
    meaning: 'A retroreflective road stud used to separate traffic; raised markers can substitute for painted lane lines and give a tactile and audible bump when a vehicle drifts across them.',
    art: 'cats_eye',
    correctAction: 'accelerate',
    description: "Cat's eyes: reflective studs stand in for the painted lane lines along this stretch.",
    law: "A Cat's Eye is a retroreflective road stud used to separate traffic; raised pavement markers can substitute for painted lane lines and give a tactile and audible bump when a vehicle drifts across them.",
    penalty: 'Studs are lane lines. Drifting across them is drifting out of your lane, and the bump is the marker telling you so.',
    reward: "Correct. You held your lane between the cat's eyes.",
    requiredLane: {
      lane: 'inner',
      hint: "The studs are your lane lines. Hold the lane between them.",
      wrongLaneMessage: "You drifted across the cat's eyes. They divide the lanes exactly as painted lines do.",
    },
  }),
];

/**
 * Markings that require speed to come off before a specific point, which share
 * the traverse-line beat above.
 *
 * A stop line, a rumble strip, a painted limit and a railway warning are the
 * same demand made four ways: shed speed, and do it before you arrive rather
 * than once you are there. They carry the traverse slot's 25 points for the
 * same reason it does — these are the markings where being late is not a
 * mistake you get to correct afterwards.
 */
const speedMarkingSlot: SlotVariant[] = [
  marking({
    id: 'level4.traverse.rumble-strips',
    name: 'Rumble Strips',
    image: IMG + 'rumble-strips.png',
    category: 'H. Other Marking',
    meaning: 'Thermoplastic lane markings that give a visual, audio and motion warning through a humming sound and bumpy ride when driven over.',
    art: 'rumble_strips',
    type: 'obstacle_ahead',
    correctAction: 'brake',
    points: 25,
    description: 'Rumble strips: raised transverse bars run across the carriageway ahead.',
    law: 'Rumble Strips are thermoplastic markings giving a visual, audio and motion warning through a humming sound and bumpy ride when driven over, to alert drivers and prompt a speed check.',
    penalty: 'You took the rumble strips at speed and they threw the car off line. That jolt is the warning working.',
    reward: 'Correct. You slowed for the strips instead of being shaken by them.',
    effect: { jarringAbove: 40, span: 80 },
  }),
  marking({
    id: 'level4.traverse.painted-speed-limit',
    name: 'Speed Limit On Pavement',
    image: IMG + 'speed-limit-painted-on-pavement.jpg',
    points: 25,
    category: 'H. Other Marking',
    meaning: 'A numeral painted directly on the road surface reinforcing a posted or applicable speed limit; it must be followed the same as a speed-limit sign.',
    art: 'pavement_speed_limit',
    glyph: '40',
    type: 'speed_limit',
    speedRule: 'maximum',
    postedSpeed: 40,
    correctAction: 'brake',
    description: 'Painted speed limit: a large 40 is painted across the carriageway ahead.',
    law: 'A speed limit painted on the pavement reinforces a posted or applicable speed limit and must be followed the same as a speed-limit sign.',
    penalty: 'You held your speed over a painted limit. Paint on the road carries the same force as the sign it reinforces.',
    reward: 'Correct. You came down to the painted limit.',
  }),
  marking({
    id: 'level4.traverse.railroad-crossing',
    name: 'Railroad Crossing Ahead',
    image: IMG + 'railroad-crossing-ahead-marking.jpg',
    category: 'H. Other Marking',
    meaning: 'Painted on the pavement in advance of a railroad crossing to warn the driver before reaching the tracks.',
    art: 'railway_pavement',
    type: 'obstacle_ahead',
    correctAction: 'brake',
    points: 25,
    description: 'Railroad crossing marking: a large R and crossing bars are painted on the road before the tracks.',
    law: 'A Railroad Crossing Ahead marking is painted on the pavement in advance of a railroad crossing to warn the driver before reaching the tracks.',
    penalty: 'The marking is painted in advance so the slowing happens before the tracks, not on them.',
    reward: 'Correct. You slowed as soon as the advance marking appeared.',
  }),
];

// Red-Painted Curb, Yellow-Painted Curb, Loading And Unloading Bay Lane Line
// and Parking Bay are deliberately absent from the drive, for the reason
// Level 3 gives for the six- and four-metre no-parking distances: this is a
// road you are continuously moving along, not a trip with a destination, so
// "may I leave the vehicle here?" is a question the drive has nowhere to ask.
// An earlier version of this level put them at the very end and ended the
// route on whichever bay the driver stopped in — but the road already runs
// on afterwards for the driver who correctly keeps going, which quietly
// brings the destination back the moment the "right" answer is refusal. The
// four curb and bay markings stay in the module's reference table, where
// recognising them is still the point.

/**
 * Five beats, not one per category.
 *
 * Most of what the level teaches is reachable through pools merged rather than
 * trimmed, the way Level 3 folds its junction warnings in with the give-way
 * signs — the markings that were their own beat share one with the beat that
 * asks the same question of the driver. Turn Line, Continuity Line, Transition
 * Line, Approach Markings and the four curb/bay markings are the exceptions,
 * held back for the reasons given where each is defined: a second full
 * intersection with nothing to distinguish it from the first, a lane closure
 * and an island scene this corridor has no geometry to draw, and a "may I
 * park here?" that a continuous drive has nowhere to ask.
 */
export const SLOTS: SlotVariant[][] = [
  longitudinalSlot,
  // Everything answered by which lane you are in when you arrive: a lane that
  // is ending, an island, painted arrows, studs, and the cones and barriers
  // that physically take the width away.
  [...laneChangeSlot, ...laneObstructionSlot],
  // Everything answered by having shed speed before a specific point.
  [...traverseSlot, ...speedMarkingSlot],
  junctionSpaceSlot,
  reservedLaneSlot,
];
