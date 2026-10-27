import type { SlotVariant } from '@/features/driving-sim/domain/scenario/pooling';
import type { ScenarioEvent } from '@/features/driving-sim/domain/scenario/scenarioDefinition';

/** Folder the level module already publishes its sign images from. */
const IMG = 'arangkada_extracted_images/level3/';

interface HazardSpec {
  id: string;
  image: string;
  name: string;
  category: string;
  meaning: string;
  scene: NonNullable<ScenarioEvent['scene']>;
  description: string;
  law: string;
  /** Sentence explaining the failure; the points figure is appended for you. */
  penalty: string;
  reward: string;
  art?: NonNullable<ScenarioEvent['sign']>['art'];
  glyph?: string;
  effect?: ScenarioEvent['effect'];
  requiredLane?: ScenarioEvent['requiredLane'];
  correctAction?: 'brake' | 'accelerate';
  type?: ScenarioEvent['type'];
  severity?: 'minor' | 'major';
  points?: number;
}

/**
 * Most warning signs share one shape: something is coming, and the driver has
 * to respond before reaching it. This collapses that shape down to the parts
 * that actually differ between signs, so a large catalogue stays readable.
 *
 * It also derives the points figure quoted in the penalty text from the same
 * weighting the rule engine uses, which is how the earlier entries came to
 * claim deductions that did not match what was actually taken.
 */
const hazardSign = (spec: HazardSpec): SlotVariant => {
  const points = spec.points ?? 20;
  const severity = spec.severity ?? 'minor';
  const correctAction = spec.correctAction ?? 'brake';

  return {
    id: spec.id,
    type: spec.type ?? 'obstacle_ahead',
    scene: spec.scene,
    description: spec.description,
    correctAction,
    points,
    duration: 200,
    penaltyMessage: `${spec.penalty}`,
    rewardMessage: `${spec.reward}`,
    lawCitation: spec.law,
    competency: 'road_signs',
    severity,
    ...(spec.effect ? { effect: spec.effect } : {}),
    ...(spec.requiredLane ? { requiredLane: spec.requiredLane } : {}),
    sign: {
      image: IMG + spec.image,
      name: spec.name,
      category: spec.category,
      meaning: spec.meaning,
      art: spec.art ?? 'diamond',
      ...(spec.glyph ? { glyph: spec.glyph } : {}),
    },
  };
};

/**
 * A sign-reading drive, rebuilt on every attempt.
 *
 * The route keeps the seven beats the module's own "Scenario" section
 * describes -- stop, give way, a blocked route, a posted speed, a bend warning,
 * a pedestrian crossing, then a signalised junction -- with a lane-guidance
 * beat added after the speed sign. Each beat draws a different sign from its
 * pool every run, so replaying the level is a fresh recognition test rather
 * than a memorised sequence of key presses.
 *
 * Every variant inside a slot carries the same points and severity, so the pass
 * mark and star thresholds below hold whatever is rolled. What a slot does not
 * hold constant is the action: braking is the answer to some of these signs and
 * the violation at others, and two slots are settled by which lane you are in
 * rather than which key you press.
 *
 * Each variant also declares the `scene` it stands in, so the sign always
 * matches the road: a junction sign gets a junction, a crossing sign gets a
 * crossing, a roadwork sign gets a coned-off work zone.
 */

/** Slot 1 — a sign that demands a complete stop. */
const priorityStopSlot: SlotVariant[] = [
  {
    id: 'level3.priority-stop.stop-sign',
    type: 'stop_sign',
    scene: 'intersection',
    description: 'Stop-sign intersection: an octagonal STOP sign and stop line control the cross street ahead.',
    correctAction: 'stop',
    points: 20,
    penaltyMessage: 'A STOP sign requires a complete stop at the line, even when the cross street looks clear.',
    rewardMessage: 'Correct. You stopped fully behind the line before entering the intersection.',
    duration: 200,
    lawCitation: 'A STOP sign requires a full stop at the marked stop line before proceeding when safe.',
    competency: 'road_signs',
    severity: 'major',
    sign: {
      image: IMG + 'stop-sign-octagon.png',
      name: 'Stop Sign (Octagon)',
      category: 'A. Regulatory Sign — Priority',
      meaning: 'Requires a full stop at the marked stop line.',
      art: 'octagon',
      glyph: 'STOP',
    },
  },
  {
    id: 'level3.priority-stop.designated-stop-line',
    type: 'stop_sign',
    scene: 'intersection',
    description: 'Controlled intersection: a STOP ON DESIGNATED STOP LINE instruction sign stands over the painted line.',
    correctAction: 'stop',
    points: 20,
    penaltyMessage: 'The instruction sign names the exact place to stop. Creeping past the line is still a failure to stop.',
    rewardMessage: 'Correct. You stopped exactly at the designated line.',
    duration: 200,
    lawCitation: 'A Stop On Designated Stop Line sign instructs the driver to come to a full stop exactly at the marked line.',
    competency: 'road_signs',
    severity: 'major',
    sign: {
      image: IMG + 'stop-on-designated-stop-line.png',
      name: 'Stop On Designated Stop Line',
      category: 'E. Traffic Instruction Sign',
      meaning: 'Come to a full stop exactly at the marked line.',
      art: 'rect_instruction',
      glyph: 'STOP LINE',
    },
  },
  {
    id: 'level3.priority-stop.railway-crossing',
    type: 'stop_sign',
    scene: 'railway',
    description: 'Railway level crossing: a crossbuck marks the tracks cutting across the road, with no barrier or warning light.',
    correctAction: 'stop',
    points: 20,
    penaltyMessage: 'A crossing with no barrier or light is not a clear crossing. Stop and check the track both ways first.',
    rewardMessage: 'Correct. You stopped and checked both directions before crossing the tracks.',
    duration: 200,
    lawCitation: 'Where a railway crossing has no barrier or warning light, slow down, check both directions, then proceed only if it is clearly safe.',
    competency: 'road_signs',
    severity: 'major',
    sign: {
      image: IMG + 'railroad-crossing.png',
      name: 'Railroad Crossing',
      category: 'B. Warning Sign — Railway Level Crossing',
      meaning: 'The road crosses railway tracks at this point; stop at the designated line or drive with caution.',
      art: 'crossbuck',
    },
  },
];

/** Slot 2 — a sign that hands priority to someone else. */
const priorityYieldSlot: SlotVariant[] = [
  {
    id: 'level3.priority-yield.give-way-sign',
    type: 'scenario_trigger',
    scene: 'intersection',
    description: 'Give-way intersection: an inverted-triangle GIVE WAY sign controls your approach to the cross street.',
    correctAction: 'brake',
    points: 20,
    penaltyMessage: 'At a Give Way sign, you must slow down and yield before entering the intersection.',
    rewardMessage: 'Correct. You slowed, checked cross traffic, and yielded before proceeding.',
    duration: 200,
    lawCitation: 'A Give Way sign requires the driver to slow down and yield to traffic that has priority at the intersection.',
    competency: 'road_signs',
    severity: 'major',
    sign: {
      image: IMG + 'give-way-yield-sign-inverted-triangle.png',
      name: 'Give Way / Yield Sign (Inverted Triangle)',
      category: 'A. Regulatory Sign — Priority',
      meaning: 'Yield to vehicles on the right side of the intersection.',
      art: 'triangle_down',
      glyph: 'YIELD',
    },
  },
  {
    id: 'level3.priority-yield.give-way-ahead',
    type: 'scenario_trigger',
    scene: 'intersection',
    description: 'Advance warning: a GIVE WAY SIGN AHEAD warning marks the give-way intersection you are approaching.',
    correctAction: 'brake',
    points: 20,
    penaltyMessage: 'An advance warning is your cue to start slowing now, not at the line itself.',
    rewardMessage: 'Correct. You began slowing as soon as the advance warning appeared.',
    duration: 200,
    lawCitation: 'A Give Way Sign Ahead warning tells the driver a Give Way sign is coming up and to begin slowing now.',
    competency: 'road_signs',
    severity: 'major',
    sign: {
      image: IMG + 'give-way-sign-ahead.png',
      name: 'Give Way Sign Ahead',
      category: 'B. Warning Sign — Advance Warning',
      meaning: 'A Give Way sign is coming up; begin slowing now.',
      art: 'diamond',
      glyph: 'YIELD_AHEAD',
    },
  },
  {
    id: 'level3.priority-yield.left-turner-give-way',
    type: 'scenario_trigger',
    scene: 'intersection',
    description: 'Your route turns left at the junction ahead, where a LEFT TURNER MUST GIVE WAY sign stands.',
    correctAction: 'turn_left',
    points: 20,
    penaltyMessage: 'You drove straight past the turn. Move into the lane nearest the center line on the approach, then turn once the way is clear.',
    rewardMessage: 'Correct. You took the lane nearest the center line and turned only once the oncoming stream was clear.',
    duration: 200,
    lawCitation: 'A Left Turner Must Give Way sign requires a left-turning vehicle to yield to opposing traffic, and a turn must be made from the lane marked for it.',
    competency: 'lane_discipline',
    severity: 'major',
    maneuver: {
      direction: 'left',
      lane: 'inner',
      hint: 'Take the lane nearest the center line to turn left here.',
      wrongLaneMessage: 'You cannot turn left from that lane. The turn was refused and you carried straight on through the junction.',
    },
    sign: {
      image: IMG + 'left-turner-must-give-way.png',
      name: 'Left Turner Must Give Way',
      category: 'A. Regulatory Sign — Priority',
      meaning: 'A left-turning vehicle must yield to opposing traffic.',
      art: 'rect_instruction',
      glyph: 'GIVE WAY',
    },
  },
  {
    id: 'level3.priority-yield.merging-traffic',
    type: 'scenario_trigger',
    scene: 'merge',
    description: 'Merging traffic: an APPROACH TO INTERSECTION, MERGING TRAFFIC warning marks a road joining yours ahead.',
    correctAction: 'brake',
    points: 20,
    penaltyMessage: 'Merging traffic joins your lane. Holding your speed leaves no room for it.',
    rewardMessage: 'Correct. You eased off and left a gap for the merging traffic.',
    duration: 200,
    lawCitation: 'An Approach To Intersection, Merging Traffic sign warns that traffic from another road merges into your lane ahead.',
    competency: 'road_signs',
    severity: 'major',
    sign: {
      image: IMG + 'approach-to-intersection-merging-traffic.png',
      name: 'Approach To Intersection, Merging Traffic',
      category: 'B. Warning Sign — Intersection',
      meaning: 'Traffic from another road merges into your lane ahead.',
      art: 'diamond',
      glyph: 'MERGE',
    },
  },
];

/**
 * The one vehicle-specific prohibition that governs the car being driven.
 *
 * The rest of that family — jeepneys, buses, trucks, bicycles, tricycles,
 * pushcarts, trailers, and the axle, weight, length, width and clearance
 * limits — is deliberately absent. An examinee in a private car passes every
 * one of them by doing nothing, so as driving events they were nineteen ways
 * of being told to carry on against one of being told to stop: a slot that
 * rewarded not reading the sign at all. They stay in the level module's
 * reference tables, where recognising them is the whole point, and out of a
 * drive that can ask nothing of the driver about them.
 */
const VEHICLE_RESTRICTIONS: SlotVariant[] = [
  {
    id: 'level3.route-restriction.no-entry-cars',
    type: 'scenario_trigger',
    // On the side street it closes, not on the road you are already driving.
    // Standing it on the open road meant there was nothing visibly shut, and
    // stopping dead in the carriageway counted as obeying it.
    scene: 'side_road',
    description: 'Closed side street: a NO ENTRY (CARS) sign covers the street branching from the intersection ahead.',
    correctAction: 'accelerate',
    avoid: ['turn_left'],
    points: 20,
    duration: 200,
    penaltyMessage: 'You turned into a street closed to cars. The restriction covers the vehicle you are driving.',
    rewardMessage: 'Correct. The sign covers cars, so you left that street alone and carried on.',
    lawCitation: 'Cars may not enter this road or lane.',
    competency: 'road_signs',
    severity: 'major',
    sign: {
      image: IMG + 'no-entry-cars.png',
      name: 'No Entry (Cars)',
      category: 'A. Regulatory Sign — Prohibitive',
      meaning: 'Cars may not enter this road or lane.',
      art: 'circle_prohibit',
      glyph: 'CAR',
    },
  },
];

/** Warning signs that a junction is coming: category B, section 2. */
const JUNCTION_WARNINGS: SlotVariant[] = [
  hazardSign({
    id: 'level3.priority-yield.intersection-ahead',
    image: 'intersection-ahead.png', name: 'Intersection Ahead',
    category: 'B. Warning Sign — Intersection',
    meaning: 'A junction is coming up; be ready to yield or stop.',
    scene: 'intersection', type: 'scenario_trigger', severity: 'major', glyph: 'CROSSROADS',
    description: 'Junction ahead: an INTERSECTION AHEAD warning marks the crossroads you are approaching.',
    law: 'An Intersection Ahead sign warns that a junction is coming up and the driver should be ready to yield or stop.',
    penalty: 'A junction warning is there so you arrive at it already slowing.',
    reward: 'Correct. You slowed on the approach and arrived ready to yield.',
  }),
  hazardSign({
    id: 'level3.priority-yield.approach-intersection',
    image: 'approach-to-intersection.png', name: 'Approach To Intersection',
    category: 'B. Warning Sign — Intersection',
    meaning: 'An intersection is being approached; begin observing cross traffic.',
    scene: 'intersection', type: 'scenario_trigger', severity: 'major', glyph: 'CROSSROADS',
    description: 'Crossroads ahead: an APPROACH TO INTERSECTION warning stands before it.',
    law: 'An Approach To Intersection sign tells the driver an intersection is being approached and to begin observing cross traffic.',
    penalty: 'Reading the cross street starts on the approach, not at the line.',
    reward: 'Correct. You slowed early and read the cross street before arriving.',
  }),
  // The one junction the engine can genuinely enforce: the road ends, so the
  // turn is not a question about the sign but the only way through. Either
  // direction is right, and each is taken from its own lane.
  {
    id: 'level3.priority-yield.t-junction',
    type: 'scenario_trigger',
    scene: 'junction_t',
    description: 'Dead ahead: a T-JUNCTION AHEAD warning marks where the road you are on ends.',
    correctAction: 'turn_left',
    points: 20,
    duration: 200,
    penaltyMessage: 'The road ends here. You drove at the end of it instead of turning out of it.',
    rewardMessage: 'Correct. You took the turning lane and turned out of the road that ended.',
    lawCitation: 'A T-Junction Ahead sign warns that the road ends ahead in a T-shaped junction, where the driver must turn.',
    competency: 'lane_discipline',
    severity: 'major',
    maneuver: {
      direction: 'either',
      // Ignored for an either-way junction: each turn is taken from its own
      // lane, left from the left and right from the right.
      lane: 'inner',
      hint: 'The road ends. Take the lane nearest the center line to turn left, or the curb lane to turn right.',
      wrongLaneMessage: 'You cannot turn from the wrong lane. Pick a turning lane on the approach: nearest the center line for left, the curb lane for right.',
    },
    sign: {
      image: IMG + 't-junction-ahead.png',
      name: 'T-Junction Ahead',
      category: 'B. Warning Sign — Intersection',
      meaning: 'The road ends ahead in a T-shaped junction.',
      art: 'diamond',
      glyph: 'T',
    },
  },
  // Roundabout Ahead and Y-Junction Ahead are taught in the level module but
  // deliberately absent from the drive. Circulating an island cannot be done in
  // a corridor that only scrolls forward, and a fork is the same decision as
  // the T-junction below at a shallower angle. Drawing either would show the
  // driver a choice the simulation could never actually put to them.
  hazardSign({
    id: 'level3.priority-yield.side-road-junction',
    image: 'side-road-junction-ahead.png', name: 'Side Road Junction Ahead',
    category: 'B. Warning Sign — Intersection',
    meaning: 'A minor road joins from the side.',
    scene: 'side_road', type: 'scenario_trigger', severity: 'major', glyph: 'SIDE_ROAD',
    description: 'Side road: a SIDE ROAD JUNCTION AHEAD warning marks a minor road joining yours.',
    law: 'A Side Road Junction Ahead sign warns that a minor road joins from the side.',
    penalty: 'Having priority is not the same as being safe. Vehicles do pull out of side roads.',
    reward: 'Correct. You eased off and watched the side road as you passed it.',
  }),
  hazardSign({
    id: 'level3.priority-yield.side-road-approach',
    image: 'approach-to-intersection-side-road.png', name: 'Approach To Intersection, Side Road',
    category: 'B. Warning Sign — Intersection',
    meaning: 'An intersection with a side road is approaching.',
    scene: 'side_road', type: 'scenario_trigger', severity: 'major', glyph: 'SIDE_ROAD',
    description: 'Approaching a side-road intersection: the sign marks the junction just ahead.',
    law: 'An Approach To Intersection, Side Road sign warns that an intersection with a side road is being approached.',
    penalty: 'A minor road still produces traffic. Pass it ready to stop.',
    reward: 'Correct. You slowed and covered the brake past the side road.',
  }),
];

/**
 * Slot 3 — a sign that takes a route away from you, or hands you one.
 *
 * The prohibition signs here are scored on what you refrain from doing: you
 * pass them by driving through without making the forbidden movement. Braking
 * is not the answer, because braking is not what a No Entry sign asks of you.
 */
const routeRestrictionSlot: SlotVariant[] = [
  {
    id: 'level3.route-restriction.no-entry-all-vehicles',
    type: 'scenario_trigger',
    scene: 'side_road',
    description: 'No-entry side street: a red-and-white NO ENTRY sign blocks the street branching from the intersection.',
    correctAction: 'accelerate',
    avoid: ['turn_left'],
    points: 20,
    penaltyMessage: 'You turned into a street marked No Entry. The sign removes that route completely.',
    rewardMessage: 'Correct. You stayed on the open through road and left the closed street alone.',
    duration: 200,
    lawCitation: 'A No Entry sign prohibits a vehicle from entering the marked road or lane.',
    competency: 'road_signs',
    severity: 'major',
    sign: {
      image: IMG + 'no-entry-all-vehicles.png',
      name: 'No Entry (All Vehicles)',
      category: 'A. Regulatory Sign — Prohibitive',
      meaning: 'A plain red circle with a white bar; no vehicle of any kind may enter.',
      art: 'circle_bar',
    },
  },
  {
    id: 'level3.route-restriction.no-left-turn',
    type: 'scenario_trigger',
    scene: 'side_road',
    description: 'Turn prohibition: a NO LEFT TURN sign covers the side street branching from the intersection ahead.',
    correctAction: 'accelerate',
    avoid: ['turn_left'],
    points: 20,
    penaltyMessage: 'You made a left turn where it is prohibited. The sign forbids the movement outright, however clear the road looks.',
    rewardMessage: 'Correct. You gave up the turn and stayed on the through road.',
    duration: 200,
    lawCitation: 'A No Left Turn sign means a left turn is not allowed at that point.',
    competency: 'road_signs',
    severity: 'major',
    sign: {
      image: IMG + 'no-left-turn.png',
      name: 'No Left Turn',
      category: 'A. Regulatory Sign — Prohibitive',
      meaning: 'A left turn is not allowed at this point.',
      art: 'circle_prohibit',
      glyph: 'LEFT',
    },
  },
  {
    id: 'level3.route-restriction.no-right-turn',
    type: 'scenario_trigger',
    scene: 'side_road',
    description: 'Turn prohibition: a NO RIGHT TURN sign covers the side street branching from the intersection ahead.',
    correctAction: 'accelerate',
    avoid: ['turn_right'],
    points: 20,
    penaltyMessage: 'You made a right turn where it is prohibited. The sign forbids the movement outright.',
    rewardMessage: 'Correct. You gave up the turn and stayed on the through road.',
    duration: 200,
    lawCitation: 'A No Right Turn sign means a right turn is not allowed at that point.',
    competency: 'road_signs',
    severity: 'major',
    sign: {
      image: IMG + 'no-right-turn.png',
      name: 'No Right Turn',
      category: 'A. Regulatory Sign — Prohibitive',
      meaning: 'A right turn is not allowed at this point.',
      art: 'circle_prohibit',
      glyph: 'RIGHT',
    },
  },
  // No Overtaking Zone belongs to level 4, Markings And Road Space: it is a
  // rule about the solid centre line, and it needs a vehicle worth passing
  // before refusing to pass one means anything. Here it scored a lane change
  // against traffic that was never there to overtake.
  {
    id: 'level3.route-restriction.no-u-turn',
    type: 'scenario_trigger',
    scene: 'side_road',
    description: 'U-turn prohibition: a NO U-TURN sign governs the opening in the median ahead.',
    correctAction: 'accelerate',
    avoid: ['turn_left'],
    points: 20,
    penaltyMessage: 'You swung across where a U-turn is prohibited. A No U-Turn sign is a separate restriction from a no-left-turn.',
    rewardMessage: 'Correct. You passed the median opening without attempting the U-turn.',
    duration: 200,
    lawCitation: 'A No U-Turn sign means a U-turn is not allowed at that point.',
    competency: 'road_signs',
    severity: 'major',
    sign: {
      image: IMG + 'no-u-turn.png',
      name: 'No U-Turn',
      category: 'A. Regulatory Sign — Prohibitive',
      meaning: 'A U-turn is not allowed at this point.',
      art: 'circle_prohibit',
      glyph: 'U',
    },
  },
  {
    id: 'level3.route-restriction.turn-if-clear',
    type: 'scenario_trigger',
    scene: 'side_road',
    description: 'Your route turns right at the junction ahead, where a VEHICLE MAY TURN LEFT OR RIGHT IF INTERSECTION IS CLEAR sign stands.',
    correctAction: 'turn_right',
    points: 20,
    penaltyMessage: 'You drove straight past the turn. Move into the right lane on the approach, then turn once the intersection is clear.',
    rewardMessage: 'Correct. You took the right lane and turned once the intersection was clear.',
    duration: 200,
    lawCitation: 'A Vehicle May Turn Left Or Right If Intersection Is Clear sign allows the turn only once the intersection is clear of conflicting traffic.',
    competency: 'lane_discipline',
    severity: 'major',
    maneuver: {
      direction: 'right',
      lane: 'curb',
      hint: 'Take the right lane to turn right here.',
      wrongLaneMessage: 'You cannot turn right from that lane. The turn was refused and you carried straight on through the junction.',
    },
    sign: {
      image: IMG + 'vehicle-may-turn-left-or-right-if-intersection-is-clear.png',
      name: 'Vehicle May Turn Left Or Right If Intersection Is Clear',
      category: 'E. Traffic Instruction Sign',
      meaning: 'The turn is allowed only once the intersection is clear of conflicting traffic.',
      art: 'rect_instruction',
      glyph: 'TURN IF CLEAR',
    },
  },
  // Road Closed To All Vehicles is taught in the module's sign table and not
  // driven. The sign means the road ahead is closed to all vehicle traffic
  // (FDM Vol. 1), and a corridor with no detour can stage that only as a
  // closed lane the car drives past, which grades the opposite of the sign.
  // The work-zone variants below stage that closed
  // lane under signs that warn of it.
  {
    id: 'level3.route-restriction.roadwork-ahead',
    type: 'scenario_trigger',
    scene: 'roadwork',
    description: 'Work zone: a ROADWORK AHEAD warning triangle and cones mark construction activity on the road.',
    correctAction: 'brake',
    points: 20,
    penaltyMessage: 'A work zone has people and equipment in it. Speed through it and you endanger both.',
    rewardMessage: 'Correct. You slowed for the work zone and watched for workers.',
    duration: 200,
    lawCitation: 'A Roadwork sign warns of construction or maintenance activity ahead; slow down and follow any temporary detour.',
    competency: 'road_signs',
    severity: 'major',
    // Closes exactly the curb lane, which is what a quarter of a four-lane
    // road comes to. The width that remains reaches the lane beside the centre
    // line — the same lane the sign sends you to — and stops there, so getting
    // past never means crossing onto the oncoming half.
    //
    // 0.62 before, which on the widened road left the required lane's centre
    // beyond the curb the narrowing had closed in: the sign asked for a lane
    // the car could no longer reach, and the event failed whatever the driver
    // did.
    // Wide enough that the barrier can still be driven into if the driver
    // insists. Squeezing harder funnelled them past it automatically, which
    // made the closure unhittable and put us right back to a work zone with no
    // consequences — the very thing making it solid was meant to fix.
    // No jarring here. The work zone's hazards are the barrier, the cones and
    // the lost width, all of which are on screen; shaking the car for rough
    // ground that is never drawn just read as hitting something invisible.
    effect: { narrowsTo: 0.75, openSide: 'left', grip: 0.85, span: 80 },
    requiredLane: {
      lane: 'inner',
      hint: 'The curb lane is closed off. Move to the lane nearest the center line to get past.',
      wrongLaneMessage: 'You drove at the closed side of the road. The work zone blocks the curb lane; the lane nearest the center line is the way past, and the oncoming side is not.',
    },    sign: {
      image: IMG + 'roadwork-road-construction-ahead.png',
      name: 'Roadwork / Road Construction Ahead',
      category: 'G. Roadwork Sign',
      meaning: 'Official warning triangle; construction or maintenance activity is ahead.',
      art: 'triangle_up',
      glyph: '!',
    },
  },
  {
    id: 'level3.route-restriction.obstruction-marker',
    type: 'scenario_trigger',
    scene: 'roadwork',
    description: 'Blocked lane: a striped OBSTRUCTION MARKER stands across the closed part of the carriageway ahead.',
    correctAction: 'brake',
    points: 20,
    penaltyMessage: 'A hazard marker is placed exactly where the road is closed off. Driving at it is driving at the obstruction.',
    rewardMessage: 'Correct. You read the marker, slowed, and kept to the open part of the road.',
    duration: 200,
    lawCitation: 'An Obstruction Marker marks a road closure or obstruction ahead.',
    competency: 'road_signs',
    severity: 'major',
    // Closes exactly the curb lane, which is what a quarter of a four-lane
    // road comes to. The width that remains reaches the lane beside the centre
    // line — the same lane the sign sends you to — and stops there, so getting
    // past never means crossing onto the oncoming half.
    //
    // 0.62 before, which on the widened road left the required lane's centre
    // beyond the curb the narrowing had closed in: the sign asked for a lane
    // the car could no longer reach, and the event failed whatever the driver
    // did.
    // Wide enough that the barrier can still be driven into if the driver
    // insists. Squeezing harder funnelled them past it automatically, which
    // made the closure unhittable and put us right back to a work zone with no
    // consequences — the very thing making it solid was meant to fix.
    // No jarring here. The work zone's hazards are the barrier, the cones and
    // the lost width, all of which are on screen; shaking the car for rough
    // ground that is never drawn just read as hitting something invisible.
    effect: { narrowsTo: 0.75, openSide: 'left', grip: 0.85, span: 80 },
    requiredLane: {
      lane: 'inner',
      hint: 'The curb lane is closed off. Move to the lane nearest the center line to get past.',
      wrongLaneMessage: 'You drove at the closed side of the road. The work zone blocks the curb lane; the lane nearest the center line is the way past, and the oncoming side is not.',
    },    sign: {
      image: IMG + 'obstruction-marker.png',
      name: 'Obstruction Marker',
      category: 'F. Hazard Marker',
      meaning: 'Marks a road closure or obstruction ahead.',
      art: 'obstruction',
    },
  },
];

/**
 * Slot 4 — a sign that puts a number on your speed.
 *
 * Two of these punish braking rather than reward it. A posted minimum is as
 * binding as a posted maximum, and it is the clearest answer in the whole level
 * to a player who has learned that holding the brake is always safe.
 */
const speedSlot: SlotVariant[] = [
  {
    id: 'level3.speed.max-60',
    type: 'speed_limit',
    scene: 'open_road',
    speedRule: 'maximum',
    // Posted below the speed the vehicle cruises at, so obeying it takes a
    // deliberate act rather than simply carrying on.
    postedSpeed: 60,
    description: '60 km/h speed zone: a MAXIMUM SPEED RESTRICTION sign marks the crowded street ahead.',
    correctAction: 'brake',
    points: 20,
    penaltyMessage: 'A posted maximum speed is a limit, not a suggestion. Reduce speed before the crowded area.',
    rewardMessage: 'Correct. You kept within the posted 60 km/h limit.',
    duration: 200,
    lawCitation: 'Vehicles must not exceed the speed posted by a Maximum Speed Restriction sign.',
    competency: 'road_signs',
    severity: 'major',
    sign: {
      image: IMG + 'maximum-speed-restriction.png',
      name: 'Maximum Speed Restriction',
      category: 'A. Regulatory Sign — Speed',
      meaning: 'Vehicles must not exceed the posted speed.',
      art: 'circle_limit',
      glyph: '60',
    },
  },
  {
    id: 'level3.speed.min-40',
    type: 'speed_limit',
    scene: 'open_road',
    speedRule: 'minimum',
    // The sign's own artwork reads "40 min.", so that is what it posts.
    postedSpeed: 40,
    description: 'Minimum speed zone: a 40 km/h MINIMUM SPEED RESTRICTION sign marks the open road ahead.',
    correctAction: 'accelerate',
    points: 20,
    penaltyMessage: 'You were below the posted minimum. A minimum speed is as binding as a maximum, and dawdling here obstructs the traffic behind you.',
    rewardMessage: 'Correct. You kept up to the posted minimum speed.',
    duration: 200,
    lawCitation: 'Vehicles must not travel slower than the speed posted by a Minimum Speed Restriction sign.',
    competency: 'speed_control',
    severity: 'major',
    sign: {
      image: IMG + 'minimum-speed-restriction.png',
      name: 'Minimum Speed Restriction',
      category: 'A. Regulatory Sign — Speed',
      meaning: 'Vehicles must not travel slower than the posted speed.',
      art: 'circle_limit',
      glyph: '40',
    },
  },
  {
    id: 'level3.speed.end-of-restriction',
    type: 'speed_limit',
    scene: 'open_road',
    speedRule: 'minimum',
    description: 'Restriction lifted: an END OF SPEED RESTRICTION sign marks the point where the posted limit stops applying.',
    correctAction: 'accelerate',
    points: 20,
    penaltyMessage: 'The restriction has ended, so there is no reason to keep crawling. Resume normal speed for the road.',
    rewardMessage: 'Correct. You resumed normal speed once the restriction ended.',
    duration: 200,
    lawCitation: 'An End Of Speed Restriction sign means the posted speed limit no longer applies past that point.',
    competency: 'speed_control',
    severity: 'major',
    sign: {
      image: IMG + 'end-of-speed-restriction.png',
      name: 'End Of Speed Restriction',
      category: 'A. Regulatory Sign — Speed',
      meaning: 'The posted speed limit no longer applies past this point.',
      art: 'rect_instruction',
      glyph: 'END 60',
    },
  },
  {
    id: 'level3.speed.preferred-max-55',
    type: 'speed_limit',
    scene: 'open_road',
    speedRule: 'maximum',
    postedSpeed: 55,
    description: 'Advisory speed: a PREFERRED MAXIMUM SPEED sign suggests 55 km/h for the conditions ahead.',
    correctAction: 'brake',
    points: 20,
    penaltyMessage: 'The advisory speed is what the road can safely take. Ignoring it leaves you with no margin.',
    rewardMessage: 'Correct. You settled to the advised speed for the conditions.',
    duration: 200,
    lawCitation: 'A Preferred Maximum Speed sign suggests a safe speed for normal weather and traffic conditions.',
    competency: 'road_signs',
    severity: 'major',
    sign: {
      image: IMG + 'preferred-maximum-speed-normal-weather.png',
      name: 'Preferred Maximum Speed (Normal Weather)',
      category: 'B. Warning Sign — Supplementary',
      meaning: 'Suggests a safe speed for normal weather and traffic conditions.',
      art: 'diamond',
      glyph: '55',
    },
  },
  {
    id: 'level3.speed.driver-must-slow-down',
    type: 'speed_limit',
    scene: 'open_road',
    speedRule: 'maximum',
    postedSpeed: 40,
    description: 'Speed instruction: a DRIVER MUST SLOW DOWN sign stands before the crowded street ahead.',
    correctAction: 'brake',
    points: 20,
    penaltyMessage: 'The sign names the action directly: reduce speed immediately.',
    rewardMessage: 'Correct. You reduced speed as soon as the instruction appeared.',
    duration: 200,
    lawCitation: 'A Driver Must Slow Down sign instructs the driver to reduce speed immediately.',
    competency: 'road_signs',
    severity: 'major',
    sign: {
      image: IMG + 'driver-must-slow-down.png',
      name: 'Driver Must Slow Down',
      category: 'E. Traffic Instruction Sign',
      meaning: 'Reduce speed immediately.',
      art: 'rect_instruction',
      glyph: 'SLOW DOWN',
    },
  },
];

/**
 * Slot 4b — a sign that tells you which lane to be in.
 *
 * Guide and expressway signs give direction rather than commanding an action,
 * which is why they had no place in a level scored purely on brake-or-go. With
 * lane position scored they become a real decision: read the sign, work out
 * which lane serves your route, and be in it by the time you reach it.
 */
const laneGuidanceSlot: SlotVariant[] = [
  {
    id: 'level3.lane-guidance.advance-direction',
    type: 'road_marking',
    scene: 'open_road',
    description: 'Advance direction sign: it previews the routes at the junction further on, and yours turns left there.',
    correctAction: 'accelerate',
    points: 20,
    penaltyMessage: 'You passed the sign in the wrong lane. An advance direction sign is placed early precisely so there is room to move across.',
    rewardMessage: 'Correct. You read the sign early and were in the lane for your route.',
    duration: 200,
    lawCitation: 'An Advance Direction Sign is placed well before an intersection, previewing the routes and directions available further ahead.',
    competency: 'lane_discipline',
    severity: 'major',
    requiredLane: {
      lane: 'inner',
      hint: 'Your route is the lane nearest the center line. Move across while there is still room.',
      wrongLaneMessage: 'You passed the sign in the wrong lane for your route. Advance direction signs come early so you can move across in good time.',
    },
    sign: {
      image: IMG + 'representative-example-of-a-green-rectangular-direction-sign-showing-the-general-visual-style-shared-by-this-family-of-signs.png',
      name: 'Advance Direction Sign',
      category: 'C. Guide / Informative Sign',
      meaning: 'Placed well before an intersection, previewing the routes and directions available further ahead.',
      art: 'rect_instruction',
      glyph: 'ROUTES AHEAD',
    },
  },
  {
    id: 'level3.lane-guidance.interchange-lane',
    type: 'road_marking',
    scene: 'open_road',
    description: 'Lane direction sign: the interchange ahead leaves the expressway on the right, and your route takes it.',
    correctAction: 'accelerate',
    points: 20,
    penaltyMessage: 'You were not in the lane the interchange is served by. A lane direction sign exists to position you before the ramp.',
    rewardMessage: 'Correct. You moved into the lane that leads to the interchange.',
    duration: 200,
    lawCitation: 'A Lane Direction sign guides motorists into the correct lane leading to an interchange.',
    competency: 'lane_discipline',
    severity: 'major',
    requiredLane: {
      lane: 'curb',
      hint: 'The interchange is served by the right lane. Move across now.',
      wrongLaneMessage: 'You were not in the lane leading to the interchange. Lane direction signs are posted early so you are in position before the ramp.',
    },
    sign: {
      image: IMG + 'lane-direction.png',
      name: 'Lane Direction',
      category: 'D. Sign On Expressway',
      meaning: 'Guides motorists into the correct lane leading to an interchange.',
      art: 'rect_instruction',
      glyph: 'LANE AHEAD',
    },
  },
  {
    id: 'level3.lane-guidance.stay-right-unless-passing',
    type: 'road_marking',
    scene: 'open_road',
    description: 'Lane discipline: a STAY ON RIGHT LANE UNLESS PASSING sign governs the road ahead.',
    correctAction: 'accelerate',
    points: 20,
    penaltyMessage: 'You were not keeping to the right lane, and you were not overtaking. Cruising in the other lanes obstructs faster traffic.',
    rewardMessage: 'Correct. You kept to the right lane, as the sign requires when not overtaking.',
    duration: 200,
    lawCitation: 'A Stay On Right Lane Unless Passing sign requires the driver to keep to the right lane except when overtaking another vehicle.',
    competency: 'lane_discipline',
    severity: 'major',
    requiredLane: {
      lane: 'curb',
      hint: 'Keep right unless you are overtaking.',
      wrongLaneMessage: 'You were out of the right lane without overtaking. Keeping right leaves the other lanes free for traffic that is actually passing.',
    },
    sign: {
      image: IMG + 'stay-on-right-lane-unless-passing.png',
      name: 'Stay On Right Lane Unless Passing',
      category: 'E. Traffic Instruction Sign',
      meaning: 'Keep to the right lane except when overtaking another vehicle.',
      art: 'rect_instruction',
      glyph: 'KEEP RIGHT',
    },
  },
  {
    id: 'level3.lane-guidance.hospital-service',
    type: 'road_marking',
    scene: 'open_road',
    description: 'Service sign: the hospital is down a turn-off on the right just ahead, and it is where you are going.',
    correctAction: 'accelerate',
    points: 20,
    penaltyMessage: 'You passed the turn-off in the wrong lane. A service sign is only useful if you act on it before the exit.',
    rewardMessage: 'Correct. You moved into the lane for the hospital turn-off.',
    duration: 200,
    lawCitation: 'A Hospital service sign indicates that medical help is available in the direction shown.',
    competency: 'lane_discipline',
    severity: 'major',
    requiredLane: {
      lane: 'curb',
      hint: 'The hospital turn-off is served by the right lane.',
      wrongLaneMessage: 'You reached the turn-off from the wrong lane. Service signs are posted in advance so you can position the vehicle in time.',
    },
    sign: {
      image: IMG + 'hospital.png',
      name: 'Hospital',
      category: 'C. Guide / Informative Sign — Service',
      meaning: 'Medical help is available in the indicated direction.',
      art: 'rect_instruction',
      glyph: 'HOSPITAL',
    },
  },
];

/** Slot 5 — a sign warning that the road is about to change direction. */
const bendWarningSlot: SlotVariant[] = [
  {
    id: 'level3.bend-warning.sharp-turn',
    type: 'obstacle_ahead',
    scene: 'bend',
    description: 'Sharp-turn warning: a yellow diamond SHARP TURN sign and chevrons warn that the road bends sharply ahead.',
    correctAction: 'brake',
    points: 20,
    penaltyMessage: 'A sharp-turn warning means reduce speed before the bend, not while already committed to it.',
    rewardMessage: 'Correct. You reduced speed early for the sharp bend.',
    duration: 200,
    lawCitation: 'A warning sign gives the driver time to reduce speed and prepare for the hazard ahead.',
    competency: 'road_signs',
    severity: 'minor',
    // The road genuinely bends here, and the outside of a bend grips less,
    // so arriving too fast is punished by the road and not only by the score.
    effect: { grip: 0.75, curve: 'left', curveStrength: 1, span: 80 },
    requiredLane: {
      lane: 'inner',
      hint: 'The road bends left. Hold the inside of the bend, nearest the center line.',
      wrongLaneMessage: 'You took the bend on the outside, where a vehicle runs wide. Slowing down is only half the answer: move to the inside lane before the bend.',
    },
    sign: {
      image: IMG + 'sharp-turn.png',
      name: 'Sharp Turn',
      category: 'B. Warning Sign — Horizontal',
      meaning: 'A single sharp bend is ahead in the indicated direction.',
      art: 'diamond',
      glyph: 'BEND',
    },
  },
  {
    id: 'level3.bend-warning.hairpin-bend',
    type: 'obstacle_ahead',
    scene: 'bend',
    description: 'Hairpin-bend warning: a yellow diamond HAIRPIN BEND sign warns of a near-reversal turn ahead.',
    correctAction: 'brake',
    points: 20,
    penaltyMessage: 'A hairpin almost doubles back on itself. Arriving at speed leaves nowhere to go.',
    rewardMessage: 'Correct. You slowed well before the hairpin.',
    duration: 200,
    lawCitation: 'A Hairpin Bend sign warns of a very sharp, near-reversal turn ahead; slow down significantly.',
    competency: 'road_signs',
    severity: 'minor',
    // The road genuinely bends here, and the outside of a bend grips less,
    // so arriving too fast is punished by the road and not only by the score.
    effect: { grip: 0.75, curve: 'left', curveStrength: 1, span: 80 },
    requiredLane: {
      lane: 'inner',
      hint: 'The road bends left. Hold the inside of the bend, nearest the center line.',
      wrongLaneMessage: 'You took the bend on the outside, where a vehicle runs wide. Slowing down is only half the answer: move to the inside lane before the bend.',
    },
    sign: {
      image: IMG + 'hairpin-bend.png',
      name: 'Hairpin Bend',
      category: 'B. Warning Sign — Horizontal',
      meaning: 'A very sharp, near-reversal turn is ahead; slow down significantly.',
      art: 'diamond',
      glyph: 'BEND',
    },
  },
  {
    id: 'level3.bend-warning.winding-road',
    type: 'obstacle_ahead',
    scene: 'bend',
    description: 'Winding-road warning: a yellow diamond WINDING ROAD sign warns of a series of curves ahead.',
    correctAction: 'brake',
    points: 20,
    penaltyMessage: 'A winding road keeps turning. One straight glance is not enough to judge it.',
    rewardMessage: 'Correct. You settled to a speed you can hold through the whole series of curves.',
    duration: 200,
    lawCitation: 'A Winding Road sign warns that a series of curves continues for some distance.',
    competency: 'road_signs',
    severity: 'minor',
    // The road genuinely bends here, and the outside of a bend grips less,
    // so arriving too fast is punished by the road and not only by the score.
    effect: { grip: 0.75, curve: 'left', curveStrength: 1, span: 80 },
    requiredLane: {
      lane: 'inner',
      hint: 'The road bends left. Hold the inside of the bend, nearest the center line.',
      wrongLaneMessage: 'You took the bend on the outside, where a vehicle runs wide. Slowing down is only half the answer: move to the inside lane before the bend.',
    },
    sign: {
      image: IMG + 'winding-road.png',
      name: 'Winding Road',
      category: 'B. Warning Sign — Horizontal',
      meaning: 'A series of curves continues for some distance.',
      art: 'diamond',
      glyph: 'BEND',
    },
  },
  {
    id: 'level3.bend-warning.double-curve',
    type: 'obstacle_ahead',
    scene: 'bend',
    description: 'Double-curve warning: a yellow diamond DOUBLE CURVE sign warns of an S-curve ahead.',
    correctAction: 'brake',
    points: 20,
    penaltyMessage: 'An S-curve turns twice, in opposite directions. Carrying speed into the first ruins the second.',
    rewardMessage: 'Correct. You slowed before the first curve so the second was under control.',
    duration: 200,
    lawCitation: 'A Double Curve sign warns that two curves in opposite directions follow one another, forming an S-curve.',
    competency: 'road_signs',
    severity: 'minor',
    // The road genuinely bends here, and the outside of a bend grips less,
    // so arriving too fast is punished by the road and not only by the score.
    effect: { grip: 0.75, curve: 'left', curveStrength: 1, span: 80 },
    requiredLane: {
      lane: 'inner',
      hint: 'The road bends left. Hold the inside of the bend, nearest the center line.',
      wrongLaneMessage: 'You took the bend on the outside, where a vehicle runs wide. Slowing down is only half the answer: move to the inside lane before the bend.',
    },
    sign: {
      image: IMG + 'double-curve.png',
      name: 'Double Curve',
      category: 'B. Warning Sign — Horizontal',
      meaning: 'Two curves in opposite directions follow one another, forming an S-curve.',
      art: 'diamond',
      glyph: 'BEND',
    },
  },
  {
    id: 'level3.bend-warning.chevron-markers',
    type: 'obstacle_ahead',
    scene: 'bend',
    description: 'Chevron markers: a line of CHEVRON SIGNS marks the way through the change of direction ahead.',
    correctAction: 'brake',
    points: 20,
    penaltyMessage: 'Chevrons are placed on the outside of a bend precisely because vehicles run wide there.',
    rewardMessage: 'Correct. You slowed and followed the line the chevrons mark out.',
    duration: 200,
    lawCitation: 'A Chevron Sign guides drivers through a change in the horizontal alignment of the road.',
    competency: 'road_signs',
    severity: 'minor',
    // The road genuinely bends here, and the outside of a bend grips less,
    // so arriving too fast is punished by the road and not only by the score.
    effect: { grip: 0.75, curve: 'left', curveStrength: 1, span: 80 },
    requiredLane: {
      lane: 'inner',
      hint: 'The road bends left. Hold the inside of the bend, nearest the center line.',
      wrongLaneMessage: 'You took the bend on the outside, where a vehicle runs wide. Slowing down is only half the answer: move to the inside lane before the bend.',
    },
    sign: {
      image: IMG + 'chevron-sign.jpg',
      name: 'Chevron Sign',
      category: 'F. Hazard Marker',
      meaning: 'Guides drivers through a change in the horizontal alignment of the road.',
      art: 'chevron',
    },
  },
];

/** Slot 6 — a sign about people on foot. */
const pedestrianSlot: SlotVariant[] = [
  {
    id: 'level3.pedestrian.crossing-ahead',
    type: 'pedestrian_crossing',
    scene: 'crosswalk',
    description: 'Pedestrian-crossing warning: a yellow diamond sign precedes a zebra crossing with a pedestrian waiting to cross.',
    correctAction: 'brake',
    points: 20,
    penaltyMessage: 'The warning sign is your cue to slow down before the zebra crossing and be ready to yield.',
    rewardMessage: 'Correct. You slowed early and prepared to yield at the crossing.',
    duration: 200,
    lawCitation: 'A pedestrian-crossing warning sign tells drivers to reduce speed and prepare to yield before the crossing.',
    competency: 'pedestrians',
    severity: 'major',
    sign: {
      image: IMG + 'pedestrian-crossing-ahead.png',
      name: 'Pedestrian Crossing Ahead',
      category: 'B. Warning Sign — Pedestrian',
      meaning: 'A marked pedestrian crossing is ahead.',
      art: 'diamond',
      glyph: 'PED',
    },
  },
  {
    id: 'level3.pedestrian.school-crossing',
    pedestrians: [{ kind: 'child' }],
    type: 'pedestrian_crossing',
    scene: 'crosswalk',
    description: 'School crossing: a CHILDREN CROSSING AHEAD sign precedes a crossing with schoolchildren waiting.',
    correctAction: 'brake',
    points: 20,
    penaltyMessage: 'Children step off a curb without checking. This sign exists because that is predictable.',
    rewardMessage: 'Correct. You slowed right down and were ready to stop for the children.',
    duration: 200,
    lawCitation: 'A children-crossing sign warns of a school or area with frequent child pedestrians ahead.',
    competency: 'pedestrians',
    severity: 'major',
    sign: {
      image: IMG + 'be-aware-and-stop-for-children-crossing-ahead.png',
      name: 'Be Aware And Stop For Children Crossing Ahead',
      category: 'B. Warning Sign — Pedestrian',
      meaning: 'A school or area with frequent child pedestrians is ahead.',
      art: 'diamond',
      glyph: 'PED',
    },
  },
  {
    id: 'level3.pedestrian.pwd-crossing',
    pedestrians: [{ kind: 'pwd' }],
    type: 'pedestrian_crossing',
    scene: 'crosswalk',
    description: 'PWD crossing: a PWD CROSSING AHEAD sign precedes a crossing with a wheelchair user waiting.',
    correctAction: 'brake',
    points: 20,
    penaltyMessage: 'A person with a disability may need far longer to clear the crossing than you allowed.',
    rewardMessage: 'Correct. You slowed and gave the crossing all the time it needed.',
    duration: 200,
    lawCitation: 'A PWD Crossing Ahead sign warns that persons with disabilities may be crossing ahead.',
    competency: 'pedestrians',
    severity: 'major',
    sign: {
      image: IMG + 'pwd-crossing-ahead.png',
      name: 'PWD Crossing Ahead',
      category: 'B. Warning Sign — Pedestrian',
      meaning: 'Persons with disabilities may be crossing ahead.',
      art: 'diamond',
      glyph: 'PED',
    },
  },
  {
    id: 'level3.pedestrian.must-give-way',
    type: 'pedestrian_crossing',
    scene: 'crosswalk',
    description: 'Priority to pedestrians: a DRIVER MUST GIVE WAY TO PEDESTRIANS sign stands at the crossing ahead.',
    correctAction: 'brake',
    points: 20,
    penaltyMessage: 'This sign gives pedestrians priority outright. There is nothing to weigh up.',
    rewardMessage: 'Correct. You slowed and gave the crossing to the pedestrians.',
    duration: 200,
    lawCitation: 'A Driver Must Give Way To Pedestrians sign means pedestrians have priority at that point.',
    competency: 'pedestrians',
    severity: 'major',
    sign: {
      image: IMG + 'driver-must-give-way-to-pedestrians.png',
      name: 'Driver Must Give Way To Pedestrians',
      category: 'E. Traffic Instruction Sign',
      meaning: 'Pedestrians have priority at this point.',
      art: 'rect_instruction',
      glyph: 'GIVE WAY',
    },
  },
];

/** Slot 7 — the signalised junction that closes the drive. */
const signalSlot: SlotVariant[] = [
  {
    id: 'level3.signal.red',
    type: 'red_light',
    scene: 'signal',
    description: 'Signalized intersection: a solid red signal, stop line, crosswalk, and cross street control the approach.',
    correctAction: 'brake',
    points: 25,
    penaltyMessage: 'A solid red signal requires a full stop before the stop line and crosswalk.',
    rewardMessage: 'Correct. You stopped before the line at the red signal.',
    duration: 220,
    lawCitation: 'A solid red traffic signal means stop before the marked stop line or crosswalk.',
    competency: 'traffic_signals',
    severity: 'critical',
    sign: {
      name: 'Red (Solid)',
      category: 'Traffic Lights And Signals',
      meaning: 'Bring the vehicle to a full stop at the marked stop line.',
      art: 'signal_head',
      aspect: 'red',
    },
  },
  {
    id: 'level3.signal.flashing-red',
    type: 'red_light',
    scene: 'signal',
    description: 'Signalized intersection: the signal is flashing red over the stop line and crosswalk ahead.',
    correctAction: 'stop',
    points: 25,
    penaltyMessage: 'A flashing red is a stop sign in light form. Rolling through it is not a stop.',
    rewardMessage: 'Correct. You came to a full stop, then judged the junction before moving.',
    duration: 220,
    lawCitation: 'A flashing red signal means stop completely, then proceed only when it is safe, similar to a stop sign.',
    competency: 'traffic_signals',
    severity: 'critical',
    sign: {
      name: 'Flashing Red',
      category: 'Traffic Lights And Signals',
      meaning: 'Bring the vehicle to a full stop, then proceed only when it is safe, similar to a stop sign.',
      art: 'signal_head',
      aspect: 'flashing_red',
    },
  },
  {
    id: 'level3.signal.yellow',
    type: 'yellow_light',
    scene: 'signal',
    description: 'Signalized intersection: the signal has turned solid yellow over the stop line ahead.',
    correctAction: 'brake',
    points: 25,
    penaltyMessage: 'Yellow means the red is about to appear, not that there is time left to beat it.',
    rewardMessage: 'Correct. You prepared to stop instead of racing the signal.',
    duration: 220,
    lawCitation: 'A solid yellow signal means the red signal is about to appear; prepare to stop if it is safe to do so.',
    competency: 'traffic_signals',
    severity: 'critical',
    sign: {
      name: 'Yellow / Amber (Solid)',
      category: 'Traffic Lights And Signals',
      meaning: 'The red signal is about to appear; prepare to stop if it is safe to do so.',
      art: 'signal_head',
      aspect: 'yellow',
    },
  },
  {
    id: 'level3.signal.flashing-yellow',
    type: 'yellow_light',
    scene: 'signal',
    description: 'Signalized intersection: the signal is flashing yellow over the crosswalk and cross street ahead.',
    correctAction: 'brake',
    points: 25,
    penaltyMessage: 'A flashing yellow hands the judgment back to you, and that judgment starts with slowing down.',
    rewardMessage: 'Correct. You slowed and read the junction before crossing it.',
    duration: 220,
    lawCitation: 'A flashing yellow signal means slow down and proceed with caution.',
    competency: 'traffic_signals',
    severity: 'critical',
    sign: {
      name: 'Flashing Yellow',
      category: 'Traffic Lights And Signals',
      meaning: 'Slow down and proceed with caution.',
      art: 'signal_head',
      aspect: 'flashing_yellow',
    },
  },
];

/**
 * Warnings about the surface, the terrain and the width of the road: category
 * B sections 4 and 5. Each one stands on a road that actually behaves the way
 * it warns about — the water is slippery, the hump throws you, the climb drags
 * at your speed — so the sign and the road say the same thing.
 */
const SURFACE_AND_WIDTH_WARNINGS: SlotVariant[] = [
  hazardSign({
    id: 'level3.bend-warning.hump',
    image: 'hump-ahead.png', name: 'Hump Ahead',
    category: 'B. Warning Sign — Road Obstacle',
    meaning: 'A speed hump is ahead; slow down.',
    scene: 'hump', glyph: 'HUMP',
    effect: { jarringAbove: 16, span: 46 },
    description: 'Speed hump: a HUMP AHEAD warning marks the raised band across the carriageway.',
    law: 'A Hump Ahead sign warns that a speed hump is ahead and the driver should slow down.',
    penalty: 'You took the hump too fast and it threw the car off line.',
    reward: 'Correct. You slowed for the hump and crossed it under control.',
  }),
  hazardSign({
    id: 'level3.bend-warning.uneven-road',
    image: 'uneven-road-ahead.png', name: 'Uneven Road Ahead',
    category: 'B. Warning Sign — Road Obstacle',
    meaning: 'The road surface ahead is rough or damaged.',
    scene: 'uneven', glyph: 'ROUGH',
    effect: { jarringAbove: 20, grip: 0.85, span: 70 },
    description: 'Broken surface: an UNEVEN ROAD AHEAD warning marks the damaged carriageway.',
    law: 'An Uneven Road Ahead sign warns that the road surface ahead is rough or damaged.',
    penalty: 'Broken surface taken at speed throws the car about and costs you control.',
    reward: 'Correct. You slowed for the broken surface.',
  }),
  hazardSign({
    id: 'level3.bend-warning.slippery-road',
    image: 'slippery-road.png', name: 'Slippery Road',
    category: 'B. Warning Sign — Road Obstacle',
    meaning: 'The road surface may be slippery, especially when wet.',
    scene: 'wet', glyph: 'SKID',
    effect: { grip: 0.55, span: 110 },
    description: 'Slippery surface: a SLIPPERY ROAD warning marks the wet stretch ahead.',
    law: 'A Slippery Road sign warns that the road surface may be slippery, especially when wet.',
    penalty: 'On a slippery surface the brakes need far longer, so the speed has to come off first.',
    reward: 'Correct. You shed speed before the slippery stretch rather than on it.',
  }),
  hazardSign({
    id: 'level3.bend-warning.when-wet',
    image: 'when-wet-supplementary-sign.png', name: 'When Wet (Supplementary Sign)',
    category: 'B. Warning Sign — Supplementary',
    meaning: 'Combined with the Slippery Road sign; the hazard applies specifically when the road is wet.',
    scene: 'wet', art: 'rect_instruction', glyph: 'WHEN WET',
    effect: { grip: 0.6, span: 100 },
    description: 'Conditional hazard: a WHEN WET plate under the slippery-road warning, and the road is wet.',
    law: 'A When Wet supplementary sign narrows the Slippery Road warning to apply specifically when the road is wet.',
    penalty: 'The condition the plate names is present, so the warning is live.',
    reward: 'Correct. The condition applied, so you treated the warning as live.',
  }),
  hazardSign({
    id: 'level3.bend-warning.flood-prone',
    image: 'flood-prone-area.png', name: 'Flood-Prone Area',
    category: 'B. Warning Sign — Road Obstacle',
    meaning: 'The area is known to flood in certain conditions.',
    scene: 'flood', glyph: 'FLOOD',
    effect: { grip: 0.45, span: 90 },
    description: 'Standing water: a FLOOD-PRONE AREA warning marks the flooded stretch across the road.',
    law: 'A Flood-Prone Area sign warns that the area is known to flood in certain conditions.',
    penalty: 'Entering standing water at speed costs you both grip and steering.',
    reward: 'Correct. You slowed right down before entering the water.',
  }),
  hazardSign({
    id: 'level3.bend-warning.spillway',
    image: 'spillway-sign.png', name: 'Spillway Sign',
    category: 'B. Warning Sign — Road Obstacle',
    meaning: 'A low-lying spillway crossing is ahead, which may be underwater during heavy rain.',
    scene: 'flood', glyph: 'WATER',
    effect: { grip: 0.45, span: 90 },
    description: 'Spillway: a SPILLWAY warning marks the low crossing where water runs over the road.',
    law: 'A Spillway sign warns of a low-lying crossing that may be underwater during heavy rain.',
    penalty: 'A spillway carries running water over the road. It has to be taken slowly.',
    reward: 'Correct. You crossed the spillway slowly and under control.',
  }),
  hazardSign({
    id: 'level3.bend-warning.uphill',
    image: 'uphill-sign.png', name: 'Uphill Sign',
    category: 'B. Warning Sign — Road Obstacle',
    meaning: 'A steep uphill grade is ahead.',
    scene: 'gradient_up', glyph: 'UP',
    correctAction: 'accelerate',
    effect: { gradient: -0.09, span: 110 },
    description: 'Steep climb: an UPHILL warning marks the grade rising ahead of you.',
    law: 'An Uphill sign warns of a steep uphill grade ahead, where losing momentum makes the climb harder.',
    penalty: 'You shed speed at the bottom of a climb, and the grade took the rest.',
    reward: 'Correct. You carried enough momentum into the climb.',
  }),
  hazardSign({
    id: 'level3.bend-warning.downhill',
    image: 'downhill-sign.png', name: 'Downhill Sign',
    category: 'B. Warning Sign — Road Obstacle',
    meaning: 'A steep downhill grade is ahead.',
    scene: 'gradient_down', glyph: 'DOWN',
    effect: { gradient: 0.1, grip: 0.9, span: 110 },
    description: 'Steep descent: a DOWNHILL warning marks the grade falling away ahead of you.',
    law: 'A Downhill sign warns of a steep downhill grade, where speed builds and braking is less effective.',
    penalty: 'Speed builds on a descent. It has to come off before the grade, not on it.',
    reward: 'Correct. You lost speed before the descent instead of chasing it down.',
  }),
  hazardSign({
    id: 'level3.bend-warning.animal-crossing',
    image: 'animal-crossing-ahead.png', name: 'Animal Crossing Ahead',
    category: 'B. Warning Sign — Road Obstacle',
    meaning: 'Animals may cross the road in this area.',
    scene: 'animal', glyph: 'ANIMAL',
    description: 'Livestock: an ANIMAL CROSSING AHEAD warning, and there is an animal standing in the road.',
    law: 'An Animal Crossing Ahead sign warns that animals may cross the road in that area.',
    penalty: 'An animal in the road will not reliably move for you.',
    reward: 'Correct. You slowed and gave the animal room.',
  }),
  hazardSign({
    id: 'level3.bend-warning.falling-rocks',
    image: 'danger-from-falling-rocks.png', name: 'Danger From Falling Rocks',
    category: 'B. Warning Sign — Road Obstacle',
    meaning: 'Loose rocks or debris may fall onto the road, typically along a mountain or cliffside route.',
    scene: 'rockfall', glyph: 'ROCKS',
    description: 'Cliffside: a DANGER FROM FALLING ROCKS warning, with loose rock already down on the carriageway.',
    law: 'A Danger From Falling Rocks sign warns that loose rocks or debris may fall onto the road.',
    penalty: 'Rock already down on the carriageway has to be driven around, not through.',
    reward: 'Correct. You slowed and steered clear of the fallen rock.',
  }),
  hazardSign({
    id: 'level3.bend-warning.landslide-prone',
    image: 'landslide-prone-area.png', name: 'Landslide-Prone Area',
    category: 'B. Warning Sign — Road Obstacle',
    meaning: 'The area is known to experience landslides in certain conditions.',
    scene: 'rockfall', glyph: 'SLIDE',
    description: 'Unstable slope: a LANDSLIDE-PRONE AREA warning marks the cutting alongside the road.',
    law: 'A Landslide-Prone Area sign warns that the area is known to experience landslides in certain conditions.',
    penalty: 'The foot of an unstable slope is not a place to be traveling fast or sitting still.',
    reward: 'Correct. You slowed and kept clear of the unstable slope.',
  }),
  hazardSign({
    id: 'level3.bend-warning.low-flying-airplane',
    image: 'low-flying-airplane-zone.png', name: 'Low-Flying Airplane Zone',
    category: 'B. Warning Sign — Road Obstacle',
    meaning: 'Aircraft may fly at low altitude near this area, typically close to an airport.',
    scene: 'open_road', glyph: 'PLANE',
    description: 'Airport approach: a LOW-FLYING AIRPLANE ZONE warning marks the road under the flight path.',
    law: 'A Low-Flying Airplane Zone sign warns that aircraft may fly at low altitude near the area.',
    penalty: 'The hazard here is the startle: sudden noise overhead at speed is how drivers swerve.',
    reward: 'Correct. You eased off and were not caught out by the noise overhead.',
  }),
  hazardSign({
    id: 'level3.bend-warning.opening-bridge',
    image: 'opening-bridge-ahead.png', name: 'Opening Bridge Ahead',
    category: 'B. Warning Sign — Road Obstacle',
    meaning: 'A bridge that can open for water traffic is ahead.',
    scene: 'bridge', glyph: 'BRIDGE',
    description: 'Opening bridge: the warning marks a span that lifts for water traffic.',
    law: 'An Opening Bridge Ahead sign warns of a bridge that can open for water traffic.',
    penalty: 'A bridge that lifts can be closed to you at any moment. Approach ready to stop.',
    reward: 'Correct. You approached the opening bridge ready to stop.',
  }),
  hazardSign({
    id: 'level3.bend-warning.narrow-bridge',
    image: 'narrow-bridge-ahead.png', name: 'Narrow Bridge Ahead',
    category: 'B. Warning Sign — Road Width',
    meaning: 'A bridge ahead is narrower than the current road.',
    scene: 'bridge', glyph: 'NARROW',
    effect: { narrowsTo: 0.6, span: 110 },
    description: 'Narrow bridge: the deck ahead is tighter than the road you are on.',
    law: 'A Narrow Bridge Ahead sign warns that a bridge ahead is narrower than the current road.',
    penalty: 'The deck is tighter than the road. That has to be set up for before you are on it.',
    reward: 'Correct. You slowed and lined up for the narrow deck.',
  }),
  hazardSign({
    id: 'level3.bend-warning.road-narrows',
    image: 'road-narrows-ahead.png', name: 'Road Narrows Ahead',
    category: 'B. Warning Sign — Road Width',
    meaning: 'The road width is about to decrease.',
    scene: 'narrows', glyph: 'NARROW',
    effect: { narrowsTo: 0.5, span: 100 },
    description: 'Bottleneck: a ROAD NARROWS AHEAD warning marks where the road pinches in.',
    law: 'A Road Narrows Ahead sign warns that the road width is about to decrease.',
    penalty: 'There is less road ahead than behind, and that is worth arriving slowly for.',
    reward: 'Correct. You slowed and took the middle of what road was left.',
  }),
  hazardSign({
    id: 'level3.bend-warning.divided-road-begins',
    image: 'divided-road-ahead.png', name: 'Divided Road Ahead',
    category: 'B. Warning Sign — Road Width',
    meaning: 'A median divider begins ahead.',
    scene: 'divided_start', glyph: 'DIVIDE',
    effect: { narrowsTo: 0.42, openSide: 'right', span: 110 },
    description: 'Median begins: a DIVIDED ROAD AHEAD warning marks the island splitting the carriageway.',
    law: 'A Divided Road Ahead sign warns that a median divider begins ahead.',
    penalty: 'A median splits the carriageway. Driving at the nose of it is driving into a concrete island.',
    reward: 'Correct. You slowed and took the correct side of the median.',
  }),
  hazardSign({
    id: 'level3.bend-warning.divided-road-ends',
    image: 'end-of-divided-road-ahead.png', name: 'End Of Divided Road Ahead',
    category: 'B. Warning Sign — Road Width',
    meaning: 'The median divider ends ahead.',
    scene: 'divided_end', glyph: 'MERGE',
    effect: { narrowsTo: 0.42, openSide: 'right', span: 110 },
    description: 'Median ends: an END OF DIVIDED ROAD AHEAD warning marks where the two sides meet again.',
    law: 'An End Of Divided Road Ahead sign warns that the median divider ends ahead.',
    penalty: 'Past the median you are sharing the road with oncoming traffic again.',
    reward: 'Correct. You slowed for the point where the road becomes shared again.',
  }),
  hazardSign({
    id: 'level3.bend-warning.two-way-traffic',
    image: 'two-way-traffic.png', name: 'Two-Way Traffic',
    category: 'B. Warning Sign — Road Width',
    meaning: 'Warns that opposing traffic should now be expected, typically where a divided or one-way section of road ends.',
    scene: 'two_way', glyph: 'TWO WAY',
    description: 'Opposing traffic: a TWO-WAY TRAFFIC warning, and there is a vehicle coming the other way.',
    law: 'A Two-Way Traffic sign warns that opposing traffic should now be expected.',
    penalty: 'Opposing traffic means half the road is not yours any more.',
    reward: 'Correct. You slowed and kept to your own side.',
  }),
];

export const SLOTS: SlotVariant[][] = [
  priorityStopSlot,
  // The junction-warning family shares this beat: both are "a junction is
  // coming, arrive ready to give way".
  [...priorityYieldSlot, ...JUNCTION_WARNINGS],
  // Restrictions of every kind share this beat: something ahead is closed to
  // somebody, and the question is always whether that somebody is you.
  [...routeRestrictionSlot, ...VEHICLE_RESTRICTIONS],
  speedSlot,
  laneGuidanceSlot,
  // Bends widen out into the whole "the road ahead is not as you found it"
  // family: alignment, surface, terrain and width.
  [...bendWarningSlot, ...SURFACE_AND_WIDTH_WARNINGS],
  pedestrianSlot,
  signalSlot,
];
