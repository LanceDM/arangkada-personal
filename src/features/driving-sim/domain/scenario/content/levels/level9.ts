import { getLevelModule } from '@/features/driving-sim/domain/scenario/content/lessons/lessonCatalog';
import { buildEvents, type SlotVariant } from '@/features/driving-sim/domain/scenario/pooling';
import type { GarageHotspot, GarageStage, LevelConfig } from '@/features/driving-sim/domain/scenario/scenarioDefinition';

const levelModule = getLevelModule(9);

/**
 * One drive: home over the ridge, in the tail of a storm, on a provincial
 * national road.
 *
 * Every level before this asks the driver to obey something — a sign, a
 * marking, a priority rule, a speed. This one takes away the two things they
 * were relying on to do it: the road surface, and then the vehicle. Nothing
 * here is a rule to remember; all of it is a sequence to already have.
 *
 * ## The route is a journey, not a checklist
 *
 * The version this replaces ran eight events at a uniform spacing, one per
 * section of the module: blowout, rain, flood, skid, jammed pedal, brake fade,
 * overheating, crash. Five separate failures of one vehicle on one trip, in an
 * order nothing caused, wrapped in a four-point garage stage and a four-point
 * crash stage — sixteen graded decisions, eleven of them multiple choice.
 *
 * This route has one spine. The weather closes in, the dip at the bottom is
 * flooded, and the brakes that went through that water are the brakes asked to
 * hold a two-kilometer descent an hour later. The crash at the bottom of that
 * descent is another driver who came down the same grade. Each event is caused
 * by the road the driver is on rather than by the section of the syllabus it
 * covers.
 *
 * ## Six answers, six measurements
 *
 * A level whose every correct answer is "slow down" is a level a crawl can
 * pass, so no two of these are graded the same way:
 *
 * | # | Scenario | What is measured |
 * |---|---|---|
 * | 1 | Rain closes in      | speed where the road runs out of visibility |
 * | 2 | Water across the dip| speed at the edge, on a surface with no grip |
 * | 3 | Throttle stuck open | the brake, held against a throttle that will not close |
 * | 4 | Tire blowout        | the brake stayed off until slow, then the bay |
 * | 5 | Brakes gone         | the answer, frozen — see below |
 * | 6 | The crash           | a full stop, short of the wreck |
 *
 * ## Why exactly one event freezes the simulation
 *
 * `eventTelemetry` grades the car, and it can read more of one than it used to:
 * `braked` separates a real brake application from a coast, and
 * `maxSpeedBraking` says how fast the car was when it happened. That is enough
 * to grade a tire blowout honestly — "do not slam on the brakes… apply the
 * brake softly once the vehicle is under control" is a `CoastRequirement`, not
 * a paragraph — so the blowout is driven, and so is everything else here.
 *
 * Except the brake failure. Its correct sequence is pump the pedal, shift down,
 * sound the horn, use the parking brake in bursts, and there is no key on this
 * keyboard for any of them but the horn. Grading it on the horn alone would
 * teach "honk when your brakes fail". Grading it on the brake would ask the
 * driver to use the pedal that just failed. So it is asked, once, in a prompt
 * that draws the descent — and it is the only place in the level a question is
 * asked instead of driven.
 *
 * On a frozen prompt the `action` on a choice is an answer identifier rather
 * than a control input, since nothing is pressed. The three below are still
 * assigned so that no label contradicts the act it names: the correct answer is
 * `brake` because every part of it is braking by other means, and steering for
 * the guardrail is `turn_right` because it is a steer.
 *
 * ## Where the non-driving half of the module went
 *
 * An engine fire, a vehicle in water, the limits of first aid and the paperwork
 * duty after a crash all describe a driver who is out of the car. They are four
 * decisions at the scene the last event required the driver to stop at — one
 * crash with three vehicles in it, not four unrelated emergencies. See
 * `aftermath` below.
 *
 * The pre-drive stage is gone. It scored eighty of three hundred and fifty
 * points before the wheels turned, and it condemned a bulging tire in the bay
 * on a route that then blew a different tire on the road — which teaches that
 * the inspection is decorative. What it used to carry (the emergency kit, the
 * Early Warning Device, the Class ABC extinguisher) is preparedness rather than
 * driving, and it now sits in the briefing and in the citations of the two
 * events it actually bears on.
 */

/* -------------------------------------------------------------------------
 * Act one — the road turns against you
 * ---------------------------------------------------------------------- */

// 1. Poor visibility — module section 4. Driven, and graded on arrival speed:
// the correct behavior in rain this heavy is a genuine reduction, and the only
// proof of it the road can offer is how fast the car was going when it got
// there.
//
// `visibility` is what makes this an event rather than a sentence. The far end
// of the corridor is washed out for the whole stretch, so the driver is slowing
// for a road they genuinely cannot see the end of.
//
// Nothing else is declared here, and nothing may be. A visibility event
// composes an empty scene on purpose (`SceneBuilder`): the veil is painted over
// the finished frame, and a prop standing in it would put a known obstacle
// where the whole lesson is that you cannot tell whether there is one. So the
// description promises nothing the road does not show — it says what arriving
// traffic *would* do, not that any is visible.
const rainClosesInSlot: SlotVariant[] = [
  {
    id: 'level9.rain-closes-in',
    label: 'Rain closes in',
    type: 'obstacle_ahead',
    description:
      'The rain thickens until the road grays out a few car lengths ahead. Anything coming the other way will arrive with no warning.',
    recommendedMove: 'Low beams on. Slow to what you can see.',
    correctAction: 'brake',
    points: 25,
    warningDistance: 440,
    penaltyMessage:
      'You reached the worst of it at speed. You cannot stop inside a gap you cannot see.',
    rewardMessage: 'Correct. Your speed matched what the road was actually showing you.',
    duration: 200,
    lawCitation:
      'Poor visibility: drive with lights on low beam, slow down, and do not switch on hazard lights while still moving. Keep your eyes on the road, use clean wipers or cloths if the windshield fogs up, and if visibility becomes too poor to continue, stop at a safe place and turn on hazard lights there. Avoid the high or "white" beam in fog; it reflects back and makes your own view of the road worse.',
    competency: 'hazard_awareness',
    severity: 'major',
    effect: { visibility: 0.32, span: 280 },
  },
];

// 2. The flooded dip — module section 3, its flooded-road and hydroplaning
// lists together. Driven, and graded on the speed carried to the edge of the
// water, which is the one thing both of those lists actually ask for: "reduce
// speed by releasing the accelerator pedal", not by braking in it.
//
// The surface does the rest of the arguing. Grip is well under half through the
// water, so "drive through fast to push it aside" is answered by the road
// rather than by the scoring — and `jarringAbove` sits *above* the speed the
// level already calls slowed, so every driver the road throws off line is a
// driver the grading was going to fail anyway. The jolt must never be the
// reason a correct driver is marked down.
//
// A signed scene owns its whole composition: the water and the board are what
// stand here, and an `actor` declared alongside them would be neither drawn nor
// solid (see `eventSceneNodes`). So nothing else is claimed to be in the water.
const floodedDipSlot: SlotVariant[] = [
  {
    id: 'level9.flooded-dip',
    label: 'Flooded dip',
    type: 'obstacle_ahead',
    scene: 'flood',
    description:
      'Brown floodwater lies right across the dip, deep enough to hide where the road goes. A flood-prone area board stands at the near edge.',
    recommendedMove: 'Ease off before the water, not in it.',
    correctAction: 'brake',
    points: 30,
    warningDistance: 520,
    penaltyMessage:
      'You carried speed into standing water. Grip goes first, and the brakes you still have barely work in it.',
    rewardMessage: 'Correct. The speed was off before the edge, so the water never had anything to take.',
    duration: 200,
    lawCitation:
      'Flooded road: be aware, calm and ready; avoid stepping on the brake as much as possible while in the water; reduce speed by releasing the accelerator pedal; and gently step on the brake pedal after passing the flooded stretch, to dry the brake pads, rotors, linings and drums. Hydroplaning: slow down and drive in a lower gear, stay away from mud or stagnant water, do not jam the brake pedal, and do not make a sharp or quick turn.',
    competency: 'hazard_awareness',
    severity: 'critical',
    effect: { grip: 0.42, jarringAbove: 38, span: 150 },
    sign: {
      name: 'Flood-Prone Area',
      category: 'B. Warning Sign — Road Obstacle',
      meaning: 'The area is known to flood in certain conditions.',
      art: 'diamond',
      glyph: 'FLOOD',
    },
  },
];

/* -------------------------------------------------------------------------
 * Act two — the vehicle turns against you
 * ---------------------------------------------------------------------- */

// 3. Jammed accelerator — module section 1's second half. Driven, because its
// correct sequence is the one in this module that ends at a pedal this keyboard
// has: the throttle pins across the stretch, tapping the speed setting down
// does nothing, and the only thing that brings the car back is holding ↓ or S.
//
// ## What a playtest found, and what each fix answers
//
// The first version of this was reported as "the car suddenly accelerates and I
// cannot tell whether that is a bug". Driving it through the real session
// confirmed every part of that:
//
// - **The failure arrived 320 units after the explanation.** The read panel
//   opens where the event becomes active — a whole `warningDistance` out — but
//   the effect only reached this far back as its `span`. The driver read "the
//   engine keeps pulling", drove a third of a kilometre with nothing wrong, and
//   met the failure with the words long gone. The span now covers the whole
//   window, so the engine is already pulling when the panel closes.
// - **The reaction window was under a second.** Pinned at `maxSpeed` — 1.6x the
//   limit — against traffic doing a quarter of it, a driver reacting at a normal
//   human 1.0s hit the jeepney at 76 km/h; 1.5s and 2.0s did the same. It pins
//   at the posted limit now (see `driveVehicle`) and the jeepney sits further
//   up the road, which buys the seconds a person actually needs.
// - **The instruction named a control that does not exist.** "Shift to neutral"
//   is the module's first step and there is no neutral in this car. The
//   recommended move is now the pedal that works, in the keys that work it; the
//   neutral step is in the reward and the citation, where a real-vehicle note
//   belongs.
// - **Nothing said it was a failure.** `stuckThrottle` is the only thing that
//   can go wrong in this game with no sprite and no sound. It now drives a live
//   readout — Throttle stuck / Brake held / Speed dropping / Under control —
//   through the same cue channel the gap and the wander already use.
//
// The jeepney is solid, which is what gives a pinned throttle somewhere to end
// up, and it is the reason the driver lifted off in the first place — so the
// thing they braked for and the thing they hit are the same vehicle. It travels
// rather than stands: a stationary obstacle in the driver's own lane is a thing
// to steer around or stop dead behind, and neither is what this is about.
const throttleSticksOpenSlot: SlotVariant[] = [
  {
    id: 'level9.throttle-sticks-open',
    label: 'Throttle stuck open',
    type: 'obstacle_ahead',
    npc: {
      path: 'travelling_ahead',
      vehicleKind: 'jeepney',
      label: 'a jeepney grinding up the grade',
      lane: 'inner',
      approachSpan: 760,
      // Far enough up the road that a driver who takes a second to understand
      // what has happened still has room to stop. At 3.2 seconds they did not.
      entryHeadway: 6.5,
      speed: { cruise: 0.25 },
    },
    description:
      'You lift off behind a jeepney grinding up the grade and nothing happens. The accelerator has jammed and the car keeps pulling.',
    recommendedMove: 'Hold the brake down until it slows.',
    realWorldNote: 'Shift to neutral first, so the engine stops driving the wheels. Never switch it off — the steering goes with it.',
    correctAction: 'brake',
    points: 30,
    warningDistance: 520,
    penaltyMessage:
      'The engine is still driving the wheels and the jeepney is barely moving. Hold the brake down rather than tapping at it.',
    rewardMessage:
      'Correct. You held the brake down until the car was back under control.',
    duration: 200,
    lawCitation:
      'Jammed gas pedal: release the accelerator pedal, shift to neutral, firmly press the brake pedal to slow the vehicle, do not shut off the engine as you may lose the ability to steer, and maneuver the vehicle to a safe area before stopping and shutting the engine off.',
    competency: 'hazard_awareness',
    severity: 'critical',
    // Deliberately narrow. `stuckThrottle` is read off the *active event* rather
    // than off the surface under the car (see `driveVehicle`), so the jam is
    // live for exactly the scenario that explains it and this span no longer
    // reaches it at all. What the span still does is claim the road for this
    // event in `surfaceUnder`, and a wide one here reached into the blowout's
    // stretch and replaced its reduced grip with ordinary tarmac — which let a
    // driver slam the brakes on a blown tire and pass.
    effect: { stuckThrottle: true, span: 200 },
  },
];

// 4. Tire blowout, and the breakdown procedure it ends in — module sections 1
// and 6, which are one sequence rather than two. The module's blowout list runs
// "slow down gradually, brake softly once under control, pull to the safe side
// of the road, hazards on, place your Early Warning Device", and that is the
// breakdown procedure word for word. Two events that were each half of this
// have become the whole of it.
//
// Driven, and graded on both halves. `coast` reads the one thing the telemetry
// can now separate — a real brake application, and how fast the car was when it
// happened — so "do not slam on the brakes" is measured rather than described;
// `bay` reads whether the car came to rest off the carriageway. The EWD is the
// step after the wheels stop and has no key, so it stays in the citation.
//
// The failure itself has no sprite: a `vehicle-failure` node may only be
// declared by a frozen `emergency`, and this one is driven. So the blowout is
// carried by the four things that can carry it — the briefing that holds the
// drive to say it, the prompt's label, the live brake readout, and a corner
// that genuinely has less grip than the others — and the description claims
// nothing standing on the road, because nothing is.
const tireBlowoutSlot: SlotVariant[] = [
  {
    id: 'level9.tire-blowout',
    label: 'Tire blowout',
    type: 'scenario_trigger',
    scene: 'lay_by',
    description:
      'A bang from the left rear, and the wheel drags hard toward the shoulder. The tire has gone.',
    recommendedMove: 'Ease off, hold it straight, stop in the bay.',
    correctAction: 'stop',
    points: 35,
    // A blowout, a deliberate slowdown with no brake, and a bay to be aimed at.
    // Coasting from the limit down to the speed the brake becomes safe at is
    // around four hundred units on its own; this is that plus room to steer in.
    warningDistance: 560,
    penaltyMessage:
      'You never got it off the carriageway. A stopped car in a live lane is still in the lane.',
    rewardMessage:
      'Correct. Straight and gradual, then a soft brake and off the road into the bay.',
    duration: 200,
    lawCitation:
      'Tire blowout: take your foot off the accelerator pedal, do not slam on the brakes, hold on to your steering wheel firmly, slow down gradually, apply the brake softly once the vehicle is under control, and pull the vehicle to the safe side of the road. Then switch on hazard lights and place your Early Warning Device about four meters behind the vehicle on a one-way road, or on both sides on a two-way road. Always carry an emergency kit: a first aid kit, a flashlight and an Early Warning Device.',
    competency: 'hazard_awareness',
    severity: 'critical',
    // 36 is 60% of this level's limit, the share the rest of the game already
    // treats as "slowed for this". Above it the car is still unstable and a
    // held pedal is the mistake the module puts in bold; at or below it,
    // braking softly to a stop is what the module asks for next.
    //
    // 15 frames is a quarter of a second, and it is really a speed allowance
    // wearing a clock: at the grip below, a quarter-second of held brake is
    // about six km/h. Shedding that much in one application is a soft brake;
    // dragging the car down from the limit in one is the slam the module puts
    // in bold, and takes nearer forty frames. A firm tap of ↓ is well inside
    // it. See `CoastRequirement` on why this is a duration at all: ↓ is the
    // brake *and* the only way to lower the setting, so "no brake" is not
    // something these controls can express.
    coast: {
      brakeBelow: 36,
      maxHeldFrames: 15,
      hint: 'Tap it down, hands firm',
      brakedMessage:
        'You stood on the brake while the car was still unstable. With one corner gone, that is how a flat turns into a spin.',
    },
    // A third of the usual grip, and for the whole window rather than for a
    // stretch around the sign. The tire let go where the scenario opened, so
    // the corner is running destroyed from that point on — and a span that
    // stopped short of the approach would have the driver doing their braking
    // on a road that still gripped, which is the opposite of the lesson.
    effect: { grip: 0.35, span: 560 },
    sign: {
      name: 'Emergency Parking Area',
      category: 'D. Guide Sign',
      meaning: 'A marked area off the carriageway where a disabled vehicle may be stopped.',
      art: 'rect_instruction',
      glyph: 'EMERGENCY PARKING',
    },
    bay: {
      side: 'right',
      mayStop: true,
      hint: 'Emergency parking area ahead — pull off the lane and stop',
    },
  },
];

// 5. Brake failure on the long descent — module section 2, both halves of it:
// the loss-of-brake sequence and the emergency braking technique. The one
// frozen prompt in the level, for the reason the file header gives.
//
// The gradient is live on the approach, so the car is already running away from
// its own setting by the time the pedal goes soft. The descent is what caused
// this, and it is under the wheels while the question is asked — and the water
// the brakes went through an hour ago is why it is this vehicle and not another.
const brakesGoneSlot: SlotVariant[] = [
  {
    id: 'level9.brakes-gone',
    label: 'Brakes gone',
    type: 'scenario_trigger',
    cutscene: true,
    emergency: 'brake_loss',
    scene: 'gradient_down',
    description:
      'Two kilometers of downgrade and a smell of hot metal. The pedal goes soft, then to the floor, and the car keeps gaining.',
    question: 'The brakes have failed on the descent. What do you do?',
    // Answered as `stop`, and the two wrong answers as the acts they name: a
    // steer is `turn_right`, and riding it out is `accelerate`. Not `brake`
    // with a `stop` distractor, which is how this first read — the rule engine
    // treats a full stop as satisfying a request to slow down, so the answer
    // that switches the engine off was scored correct.
    choices: [
      { label: 'Pump the pedal, shift down, sound the horn, parking brake in bursts.', action: 'stop' },
      { label: 'Steer into the guardrail now and scrape the speed off on it.', action: 'turn_right' },
      { label: 'Hold your line and ride it out to the bottom.', action: 'accelerate' },
    ],
    correctAction: 'stop',
    points: 35,
    penaltyMessage:
      'The guardrail is a last resort, not a first move, and riding it out is not a plan. Never switch the engine off either: the steering goes with it.',
    rewardMessage:
      'Correct. Pressure pumped back, a lower gear holding it, the horn clearing the road ahead.',
    duration: 220,
    lawCitation:
      'Loss of brake: aim toward your target or escape area, release the accelerator, control the steering, downshift and do not switch off the engine, use the parking brake with the release lever held open as a brake if possible, and use a soft crash area as a last resort. Emergency braking: rapidly pump the brake pedal several times to build brake fluid pressure — on a vehicle with anti-lock brakes (ABS), do not pump — shift to a lower gear, sound the horn and flash the lights if you cannot slow down, and use the parking brake sporadically.',
    competency: 'hazard_awareness',
    severity: 'critical',
    effect: { gradient: 0.1, span: 220 },
    sign: {
      name: 'Steep Descent',
      category: 'B. Warning Sign — Road Alignment',
      meaning: 'A steep downgrade is ahead; select a lower gear before the descent.',
      art: 'diamond',
      glyph: 'DOWN',
    },
  },
];

/* -------------------------------------------------------------------------
 * Act three — somebody else's
 * ---------------------------------------------------------------------- */

// 6. Arriving at a road crash — module section 7. Driven, and it has to be: the
// duty the law describes begins with the word "stop", and a prompt asking
// whether the driver *would* have stopped is not the same test as a driver who
// did. The wreck is solid, so the run also ends here for anyone who chose to
// drive past it and misjudged the gap.
//
// It is at the bottom of the same descent the driver has just come down, and
// what went into the creek is a vehicle that did not make it. Everything the
// duty asks for after the wheels stop is the `aftermath` stage.
const crashAtTheBottomSlot: SlotVariant[] = [
  {
    id: 'level9.crash-at-the-bottom',
    label: 'Crash ahead',
    type: 'scenario_trigger',
    // One declaration for the whole tableau — the wreck across the lane, the
    // van that left the road, the debris between them — and only the wreck is
    // solid. It was a single `broken_down` actor before this, which drew a
    // rounded rectangle while the description promised a crash scene.
    scenePrefab: { kind: 'road_crash' },
    // Clear of both running lanes: people on their feet at the roadside, which
    // is what the scene is, rather than casualties lying in the carriageway the
    // driver would then be graded on missing.
    pedestrians: [
      { kind: 'adult', position: 1.08 },
      { kind: 'adult', position: 1.22 },
    ],
    description:
      'Around the last bend a van is in the creek and a car is slewed across the lane, smoking. People are moving between them.',
    recommendedMove: 'Come to a full stop short of it.',
    correctAction: 'stop',
    points: 35,
    // A wreck across the lane with people walking between the vehicles. The
    // runway has to be a stopping distance, not a reading distance.
    warningDistance: 560,
    penaltyMessage:
      'No driver may leave a crash without aiding the victims. "I was not the one who crashed" is not one of the three exceptions.',
    rewardMessage:
      'Correct. Stopped clear of the wreck, hazards on, and out to see who needs what.',
    duration: 220,
    lawCitation:
      "Duty of the driver in case of a crash: the driver present must show their driver's license and give their true name and address, along with the true name and address of the vehicle's owner. No driver involved in a road crash may leave the scene without aiding the victim, except if the driver is in imminent danger of serious harm because of the crash, if the driver reports the crash to the nearest law officer, or if the driver has to summon a physician or nurse to aid the victim.",
    competency: 'general_rules',
    severity: 'critical',
  },
];

export const SLOT_DISTANCES = [900, 1750, 2600, 3500, 4400, 5350];
export const SLOTS: SlotVariant[][] = [
  rainClosesInSlot,
  floodedDipSlot,
  throttleSticksOpenSlot,
  tireBlowoutSlot,
  brakesGoneSlot,
  crashAtTheBottomSlot,
];

/**
 * The crash scene, played on foot once the drive is over.
 *
 * The event above is answered by stopping, and stopping is where the law's duty
 * gets to its second line. What follows is four decisions with the engine off,
 * at one crash rather than four: the van that left the road is in the creek,
 * the car that met it is across the lane and smoking, and a third is upright
 * with somebody unresponsive in it. Each point is one of the four things the
 * module is most emphatic about, in the order they outrank each other — fire
 * first, then the water, then who you attend to, then what you owe before you
 * may leave.
 *
 * Two of them exist here because there is no road version of them. A vehicle in
 * water and a driver's paperwork duty are not speeds or lanes, and content with
 * no maneuver attached should not be forced into an event that would then grade
 * something other than the lesson. The difference from a garage stage is that
 * this content has a place to live: the scene the driver was just required to
 * stop at, which `drawCrashScene` already draws vehicle for vehicle.
 *
 * On a stage there is no control input — a hotspot is clicked — so a choice's
 * `action` is an answer identifier rather than something the car did. The
 * correct answer is `stop` at every point here, which is also the honest label:
 * at a crash scene every right answer is a refusal to move on.
 */
const aftermathHotspots: GarageHotspot[] = [
  // Module section 5's engine fire, and section 8's first line about it: if any
  // part of the vehicle is on fire, everyone comes out before anything else is
  // considered. Placed first because it outranks every other decision here.
  {
    id: 'burning-vehicle',
    label: 'The smoking car',
    marker: 'fire',
    objective: 'Get both occupants clear of the smoking car.',
    area: 'Vehicle Fire — Evacuation',
    x: 0.36,
    y: 0.3,
    observation:
      "Gray smoke is rising from the seams of the wrecked car's hood. Two people are still belted in, awake, and both doors open.",
    question: 'What do you do about this car?',
    choices: [
      { label: 'Get both of them out and well clear. Leave the hood shut.', action: 'stop' },
      { label: 'Lift the hood to see how bad the fire is.', action: 'accelerate' },
      { label: 'Leave them seated and wait for the fire service.', action: 'brake' },
    ],
    correctAction: 'stop',
    points: 20,
    penaltyMessage:
      'Never open the hood; it feeds the fire air and puts your face where the flame goes. If any part of a vehicle is burning, everyone comes out first.',
    rewardMessage:
      'Correct. Both out and well away, hood left shut, fire left to people with the equipment for it.',
    lawCitation:
      'Engine fire: steer out of traffic away from buildings, people and other vehicles; have all occupants leave the car immediately and move away; do not open the hood; turn off the ignition, then get out quickly. Any vehicle fire: call for assistance, do not put water on a diesel or gasoline fire, use an appropriate fire extinguisher (Class ABC), and if you cannot stop the fire, leave the vehicle.',
    competency: 'hazard_awareness',
    severity: 'critical',
  },

  // Module section 5's submerged vehicle. The van that left the road at the
  // bend is the reason there is a crash here at all, so the one instruction in
  // the module with a thirty-second clock on it belongs to the vehicle that
  // started this rather than to a river invented for it.
  {
    id: 'vehicle-in-water',
    label: 'The van in the creek',
    marker: 'water',
    objective: 'Call the people in the van out of it, now.',
    area: 'Submerged Vehicle — Escape',
    x: 0.78,
    y: 0.62,
    observation:
      'The van is floating level in the creek with water partway up the doors. At least two people are moving around inside it.',
    question: 'What do you call out to the people inside?',
    choices: [
      { label: 'Get out now — it floats for half a minute at most.', action: 'stop' },
      { label: 'Stay inside and wait for a rescue team to reach you.', action: 'brake' },
      { label: 'Wait until the cabin fills so the doors open easier.', action: 'accelerate' },
    ],
    correctAction: 'stop',
    points: 20,
    penaltyMessage:
      'A vehicle floats 30 to 60 seconds before it sinks, and that window is the whole rescue. Waiting spends it.',
    rewardMessage:
      'Correct. Everyone out through the doors while it was still floating.',
    lawCitation:
      'Submerged vehicle: get out of the vehicle immediately. If you crash into a river or other body of water, the vehicle will typically only float on the surface for about 30 to 60 seconds before sinking.',
    competency: 'hazard_awareness',
    severity: 'critical',
  },

  // Module section 8, the whole of it in one decision: who gets attention
  // first, and what an untrained driver must not do to the person who needs it
  // most. Both halves are needed together — the sorting rule is useless if the
  // driver then drags the unconscious casualty out of a stable vehicle.
  //
  // The number is 911, which Executive Order No. 56, s. 2018 made the national
  // emergency hotline in place of the PNP 117 RO101 prints. The Red Cross stays
  // on 143.
  {
    id: 'casualties',
    label: 'Who you attend to',
    marker: 'casualty',
    objective: 'Reach the one who is not walking and talking.',
    area: 'First Aid — Limits',
    x: 0.5,
    y: 0.52,
    observation:
      'A man is walking between the cars holding a bleeding arm. A woman is slumped and unresponsive in the second car, which is upright and not burning.',
    question: 'Who do you go to, and what do you do?',
    choices: [
      { label: 'The woman. Leave her where she is and call 911 now.', action: 'stop' },
      { label: 'The woman. Lift her out onto flat ground first.', action: 'accelerate' },
      { label: 'The walking man, since his arm is what you can treat.', action: 'brake' },
    ],
    correctAction: 'stop',
    points: 20,
    penaltyMessage:
      'Go first to whoever is not walking and talking. Do not move them unless the vehicle is burning; unnecessary movement makes injuries worse.',
    rewardMessage:
      'Correct. Straight to the one who is not walking and talking, left where she was, and trained help called.',
    lawCitation:
      'First aid limits: attend first to anyone who is not yet walking and talking. If any part of the vehicle is on fire, remove all occupants and make sure everyone is safe first. Do not remove an injured person unless they are in a burning vehicle or facing other immediate danger, as unnecessary movement often makes injuries worse. Note your location and call Emergency 911, the national emergency hotline, or the Red Cross hotline (143). Do not attempt to give first aid beyond this unless you have been trained in it.',
    competency: 'general_rules',
    severity: 'critical',
  },

  // Module section 7's duty clause, which is the part drivers most often
  // believe does not apply to them because they were not the ones who crashed.
  {
    id: 'report-and-document',
    label: 'Before you leave',
    marker: 'report',
    objective: 'Settle what the law asks before you may leave.',
    area: 'Crash Duty — Reporting',
    x: 0.2,
    y: 0.74,
    observation:
      'Your car is stopped clear with its hazards on. An officer has arrived, and another driver is telling you to move along since nobody hit you.',
    question: 'What do you do before leaving the scene?',
    choices: [
      { label: 'Show your license, give your details, photograph it, report it.', action: 'stop' },
      { label: 'Leave now an officer is here; reporting is their job.', action: 'accelerate' },
      { label: 'Give a name and drive on to clear the lane.', action: 'brake' },
    ],
    correctAction: 'stop',
    points: 20,
    penaltyMessage:
      "The driver at a crash shows their license and gives their true name and address, and the owner's. An officer arriving is when you hand that over, not a reason to go.",
    rewardMessage:
      'Correct. License shown, names and addresses given, the scene photographed, the crash reported.',
    lawCitation:
      "In the event a road crash occurs, the driver present must show their driver's license and give their true name and address, along with the true name and address of the vehicle's owner. Photograph and document the scene: the vehicles, involved parties, witnesses, and any responding police officers. Call local law enforcement to report the crash.",
    competency: 'general_rules',
    severity: 'major',
  },
];

const aftermath: GarageStage = {
  scene: 'crash_scene',
  // Your own car, stopped at the scene with its hazards on. The plate is how
  // the player knows the blue car in the diagram is theirs.
  plate: 'PGA 8241',
  intro:
    'You stopped. The engine is off and your hazards are on. Work through the scene one point at a time.',
  hotspots: aftermathHotspots,
};

/**
 * The mission is worth 270 points: 190 on the road and 80 at the crash scene.
 *
 * The road's 190 splits as 35 for each of the three events where getting it
 * wrong means a wreck, a spin or a casualty left behind, 30 for the two the
 * vehicle's own failures cause, and 25 for the rain, where the cost is measured
 * in risk rather than in impact. The pass mark is 69% of the total, the share
 * every level from 4 onwards uses.
 *
 * No single-key strategy comes near it, and `level9Drive.test.ts` drives each
 * one rather than reasoning about it:
 *
 * - **Accelerate at everything** ends in the tricycle, the jeepney or the wreck.
 * - **Brake at everything** takes the rain and the flood honestly, never leaves
 *   the lane it started in, and so fails the flood's line and the bay.
 * - **Stop at everything** is the same, and is charged for crawling besides.
 * - **Never touch the brake** loses the throttle and the crash.
 * - **Brake the moment the blowout opens** loses the blowout outright, which is
 *   the one place in the game the correct answer is a pedal left alone.
 */
export const level9: LevelConfig = {
  id: 9,
  name: levelModule.title,
  moduleId: levelModule.id,
  description: levelModule.desc,
  // Six events, plus a runway past the crash long enough for its measurement
  // window to close before the road ends.
  roadLength: 6000,
  // A provincial national road rather than a city street or an expressway.
  // Every emergency in this module is one that a town speed would make
  // survivable and an expressway speed would make unanswerable: a blowout has
  // to be fast enough to pull the wheel, a descent long enough to cook the
  // brakes, and standing water deep enough to matter. Sixty is where those are
  // all true and the driver still has room to be taught something.
  speedLimit: 60,
  requiredScore: 186,
  stars2: 224,
  stars3: 257,
  events: buildEvents(SLOTS, SLOT_DISTANCES, pool => pool[0]),
  aftermath,
  /**
   * An ordinary two-way national road: four lanes, the left two carrying
   * opposing traffic.
   *
   * The oncoming side is not decoration here. The rain is about traffic
   * arriving out of the murk toward you, the blowout drags the car toward the
   * shoulder and away from it, and the crash at the end blocks a carriageway
   * that has to have two directions for that to mean anything.
   *
   * The descent carries a double solid yellow line, which is what a Philippine
   * downgrade into a blind bend is actually painted with — and it means the
   * driver whose brakes have just gone has no legal escape across the center
   * line either.
   */
  paint: {
    oncomingLanes: 2,
    base: 'broken_yellow',
    spans: [{ from: 4180, to: 4800, art: 'double_solid_yellow' }],
  },
};
