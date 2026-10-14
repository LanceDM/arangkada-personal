import { getLevelModule } from '@/features/driving-sim/domain/scenario/content/lessons/lessonCatalog';
import { buildEvents, type SlotVariant } from '@/features/driving-sim/domain/scenario/pooling';
import type { GarageHotspot, LevelConfig } from '@/features/driving-sim/domain/scenario/scenarioDefinition';

const levelModule = getLevelModule(10);

/**
 * One trip: the family home from a christening in the next town, out along the
 * national road and into your own barangay by dusk.
 *
 * Seven laws, and not one of them announces itself. A sign tells you it is
 * there; an unbuckled five-year-old does not, and the phone in the cradle looks
 * identical whether you pick it up or not. So the module is taught the only way
 * it can be — as the ordinary decisions of one journey, with the same people in
 * the car from the driveway to the last bend.
 *
 * ## What is driven, and what is asked
 *
 * The version this replaces had five driveway questions and eight road events,
 * three of them frozen prompts and two of them a checkpoint split in half.
 * Thirteen graded decisions, eight of them multiple choice, and two of the
 * "driven" ones described a jeepney and a truck that nothing put on the road.
 *
 * This route has four driveway points and seven road events, and six of the
 * seven road events are answered with the car:
 *
 * | # | Scenario | What is measured |
 * |---|---|---|
 * | 1 | The phone rings     | the answer, frozen — see below |
 * | 2 | Out of her seat     | the car came to rest off the travel lane |
 * | 3 | Smoke in your lane  | the closest gap held to the jeepney ahead |
 * | 4 | LTO checkpoint      | a full stop, then the call made at the window |
 * | 5 | Losing its load     | the center line was never crossed |
 * | 6 | Bus on the grade    | the speed carried past the posted forty |
 * | 7 | Rider down          | a full stop, short of the bike |
 *
 * Seven different answers. A level whose every correct answer is "slow down"
 * is a level a crawl can pass, and three of these fail a crawler outright: the
 * turnout is a lane change, the checkpoint is a call, and the phone is a
 * refusal to act.
 *
 * ## Why exactly one event freezes the drive
 *
 * A ringing phone is answered correctly by doing nothing. A driver who leaves
 * it alone and a driver who never registered that it rang produce identical
 * speed, identical lane and identical everything else the grader can see, so a
 * reaction window there would score attention it cannot measure. Every other
 * point on this route ends in something the telemetry watches happen.
 *
 * The checkpoint is the one hybrid, and deliberately: being flagged down is a
 * full stop, which the car does, and what you say at the window is a judgment,
 * which it cannot. `inspection` is exactly that pairing, and it is one event
 * here rather than the two the old route used.
 *
 * ## The phone appears twice, and the second time the answer is yes
 *
 * Event 1 is the Act. Event 7 is its exemption: a rider down with nobody else
 * on the road is the emergency call RA 10913 leaves room for. A level built
 * only from event 1 teaches "the phone is always illegal", which is both wrong
 * and the belief that gets somebody driven past. What event 7 *grades* is the
 * stop, because the stop is what the simulation can watch; the exemption is
 * carried by the read panel, the verdict and the citation.
 *
 * ## What is taught but not graded, and why
 *
 * Fines and thresholds. No question on this route turns on a peso amount, a
 * tolerance percentage or a gross vehicle weight: they are in the citations,
 * where somebody who wants them can open them, and nowhere a player can lose
 * points to a number they had no way to look up. Several would not survive
 * being graded anyway — RA 8749's fines are ceilings and RA 10586's are ranges,
 * and the two LTO decks disagree about RA 10916's second offense, so its
 * citation stops at the first.
 *
 * ## Where every claim comes from
 *
 * Each scenario rests on quoted LTO material, by file and heading, and what
 * the sources do not settle is left ungraded. A verdict or a correct answer
 * says nothing the sources do not.
 */

/* -------------------------------------------------------------------------
 * The driveway — who is in the car, what it is carrying, who is driving it
 *
 * Level 2's stage asks whether the machine is legal, Level 8's asked whether
 * the driver was fit, Level 9's crash scene asks what to do once it has all
 * gone wrong. This one asks the question the whole module turns on, and it asks
 * it where it is actually settled in life: in a driveway, with the engine off
 * and everybody already aboard.
 *
 * Every correct answer here is an action rather than a refusal. A stage whose
 * every right answer is "no" teaches refusal instead of judgment, so three of
 * these are something to go and fix and the first is a point where the honest
 * answer is that nothing needs fixing.
 *
 * The four points walk the car: driver's seat, front passenger, back seat,
 * trunk. On the diagram the car stands nose-up, so the driver's door is on the
 * left — which is where `the-keys` sits.
 * ---------------------------------------------------------------------- */
const hotspots: GarageHotspot[] = [
  // Module section 4, decided where it is decided: with the keys still on
  // somebody's palm. The player is never assigned a blood alcohol level of
  // their own anywhere in this level — that would grade a state rather than a
  // decision, and this is the decision.
  //
  // The second wrong answer is the one people genuinely believe: that 0.05% is
  // a permission slip. It is the level at which blood alcohol alone is
  // conclusive proof, and nobody can read it off themselves; the rule the LTO
  // teaches for this moment is RO101's, don't drink and drive.
  {
    id: 'the-keys',
    label: 'Who drives',
    area: 'Drunk Driving — RA 10586',
    x: 0.34,
    y: 0.46,
    detail: 'cockpit',
    observation:
      'Ronnie is holding his hand out for the keys. He is steady on his feet and knows this road, and he has had three beers since lunch.',
    question: 'Ronnie wants to drive. What do you say?',
    choices: [
      { label: 'You drive. The keys stay with whoever has not been drinking.', action: 'stop' },
      { label: 'Let him — he knows every bend of this road.', action: 'accelerate' },
      { label: 'Let him — three beers is still under the 0.05% limit.', action: 'brake' },
    ],
    correctAction: 'stop',
    points: 15,
    penaltyMessage:
      'Alcohol has already slowed his reactions, whatever he can feel. And 0.05% is the level at which blood alcohol alone convicts, not a line you are safe below.',
    rewardMessage:
      'Right — the keys stay with the sober driver. Knowing the road does nothing for a reaction time that is already gone.',
    lawCitation:
      "RA 10586, the Anti-Drunk and Drugged Driving Act, makes it unlawful to drive a motor vehicle while under the influence of alcohol, dangerous drugs or similar substances. For a private vehicle of up to 4,500 kg gross vehicle weight, a blood alcohol concentration of 0.05% or higher is conclusive proof; for drivers of trucks, buses, motorcycles and public utility vehicles, anything above 0.00% is. Nobody reads their own number: alcohol slows the brain, reduces the ability to decide and makes a driver sleepy, whatever they feel. The LTO's own checklist asks before every drive whether you have been drinking in the last twenty-four hours, and its rule is plain: don't drink and drive. Where nobody is hurt the penalty is three months' imprisonment and a fine of Php 20,000 to Php 80,000, and a non-professional license is confiscated and suspended for twelve months on a first conviction.",
    competency: 'general_rules',
    severity: 'critical',
  },

  // Module section 1, and the one point in the stage where nothing needs
  // fixing. Both wrong answers are over-caution rather than carelessness: one
  // moves a belted adult out of a seat she is entitled to sit in, the other
  // imports a public-utility duty into a private car. That confusion is real —
  // the signage rule and the wearing rule sit in the same law.
  {
    id: 'the-front-row',
    label: 'Up front',
    area: 'Seat Belts — RA 8750',
    x: 0.62,
    y: 0.46,
    detail: 'belt',
    observation:
      'Your belt is latched and lying flat across your chest, and Nanay is beside you with hers on the same way. One belt each, both buckles seated.',
    question: 'Is the front row ready to go?',
    choices: [
      { label: 'Yes — one belt each, both across the torso.', action: 'accelerate' },
      { label: 'No — move her to the back, the front seat is the dangerous one.', action: 'brake' },
      { label: 'No — the cabin needs seat belt signage posted first.', action: 'stop' },
    ],
    correctAction: 'accelerate',
    points: 15,
    penaltyMessage:
      'Both belts are on the way the law describes, which is all a private car is asked for. Posted signage is a public-utility duty, not yours.',
    rewardMessage:
      'Right — one belt per person, strap across the torso, latched before the engine turns. Nothing here is holding the trip up.',
    lawCitation:
      'RA 8750, the Seat Belt Use Act, requires the driver and front-seat passengers of any public or private motor vehicle to wear seat belts while the engine is running. Passengers in the row immediately behind the driver of a private car, an SUV or a for-hire vehicle must wear them too; that row is exempt in jeeps, passenger vans and wagons, AUVs, buses, trucks, vintage cars and special purpose vehicles. The belt should rest comfortably across the torso, and one belt must never restrain two people at the same time. Public utility vehicles must post signage instructing front-seat passengers to buckle up, and the driver must require them to; that duty and its Php 3,000 penalty fall on the operator and driver of a for-hire vehicle, not on a family car. Fines for failing to wear one run to Php 1,000 for a first offense, Php 2,000 for a second, and Php 5,000 plus a one-week license suspension for the third and after.',
    competency: 'general_rules',
    severity: 'major',
  },

  // Module section 2, and the densest fact in the level: the child restraint
  // requirement and the 150 cm exemption are one rule, not two. A driver who
  // knows only the first half straps a tall eleven-year-old into a booster he
  // has outgrown while the five-year-old rides on an adult belt.
  //
  // Both children are in one point for exactly that reason. Split apart, each
  // becomes a single-fact recall question; together they are the judgment the
  // law actually asks for.
  {
    id: 'the-back-seat',
    label: 'The back seat',
    area: 'Child Restraints — RA 11229',
    x: 0.5,
    y: 0.66,
    detail: 'child_seat',
    observation:
      'Lena is five and about seventeen kilos, sitting on the bench with the adult strap across her throat. Migs is eleven and has just cleared 150 cm.',
    question: 'What do you fix before starting?',
    choices: [
      { label: 'Lena goes in a child seat. Migs stays on the adult belt.', action: 'stop' },
      { label: 'Nothing — they are in the back and both are belted.', action: 'accelerate' },
      { label: 'Both go in child seats. Both are under twelve.', action: 'brake' },
    ],
    correctAction: 'stop',
    points: 15,
    penaltyMessage:
      'A child twelve or under needs a restraint system unless they are at least 150 cm. Lena is not; Migs is, and a booster he has outgrown is no safer.',
    rewardMessage:
      'Right. Lena goes into a Group I/II seat with the strap across her chest, and Migs clears 150 cm, so the adult belt is the correct restraint for him.',
    lawCitation:
      'RA 11229, the Child Safety in Motor Vehicles Act, makes it unlawful for the driver of a covered vehicle not to secure a child properly in a child restraint system at all times while the engine is running or the child is being transported. A child is anyone twelve years old and below. The exemption is height, not age: a child at least 150 centimeters (59 inches) tall may use the regular seat belt instead, and may then sit in front. The restraint must be correctly anchored and right for the age, height and weight, with harness straps firmly buckled and untwisted, the shoulder strap crossing the chest rather than the neck, and the lap belt across the thighs and hips rather than the abdomen. Groups: Group 0, an infant carrier to 13 kg; Groups I and II, a child or convertible seat from 9 to 25 kg; Group III, a booster from 22 to 36 kg. A child in a restraint must never be left in the vehicle unaccompanied by an adult. Fines are Php 1,000, Php 2,000, then Php 5,000 with a one-year license suspension.',
    competency: 'general_rules',
    severity: 'critical',
  },

  // Module section 6, cut down to the half that applies to a family car. The
  // 25% of the MVUC, the 13,500 kg axle bar and the 150% gross-weight bar are
  // written for trucks and trailers and are taught on the road at event 5,
  // against the class of vehicle they were written for. What the sources ask of
  // a car's load is two rules: one belt restrains one person, and nothing rides
  // loose behind the back seat. Nothing in them makes a roof rack unlawful on a
  // private car, and RA 8750 exempts folding and sideward-facing seats, so
  // neither is asked about here.
  {
    id: 'the-load',
    label: 'The load',
    area: 'Loading — RA 8750',
    x: 0.5,
    y: 0.86,
    detail: 'trunk',
    observation:
      'A cousin wants to squeeze in beside Migs and share his belt, and a crate of soft drinks sits loose on the rear window deck.',
    question: 'The car is loaded. What now?',
    choices: [
      { label: 'The crate goes in the trunk, and the cousin rides in another car.', action: 'stop' },
      { label: 'Leave it — the tailgate is shut and it is a short trip.', action: 'accelerate' },
      { label: 'Leave it — two can share a belt on a short trip.', action: 'brake' },
    ],
    correctAction: 'stop',
    points: 15,
    penaltyMessage:
      'A seat belt restrains one person, never two. And a loose crate on the rear deck hits whoever is in front of it on a sudden stop.',
    rewardMessage:
      "Right. One belt per person, and nothing loose behind the children's heads when you brake.",
    lawCitation:
      "RA 8750 is explicit that one seat belt must never be used for two or more people at the same time, and every passenger in the front row and in the row behind the driver of a private car wears one while the engine runs. Loose cargo has its own rule: never load unsecured items on the back seat or the rear window deck, because a sudden stop throws them into the passengers or the driver. RA 8794, the Motor Vehicle User's Charge Law, funds road maintenance through a charge paid at every registration and restricts overloading for road safety, for the road itself and against the smoke-belching an over-tasked engine produces; its penalty of 25% of the charge is written for the owners of trucks and trailers loaded past their maximum allowable gross vehicle weight.",
    competency: 'general_rules',
    severity: 'major',
  },
];

/* -------------------------------------------------------------------------
 * The road out of town — module sections 3, 2, 5, 4, 6 and 7, in the order the
 * trip runs into them rather than the order the syllabus lists them.
 * ---------------------------------------------------------------------- */

// 1. The phone rings — module section 3. Frozen, and for the plainest reason in
// the level: the correct answer is that nothing happens, and no speedometer
// can tell a driver who left it alone from one who never noticed.
//
// The third choice is the one that catches most people. The Act names a vehicle
// "temporarily stopped at a red light or intersection" in the same breath as
// one in motion, so waiting for the lights is not a workaround — it is the
// same offense. What is outside it is a car parked off the road, which is
// where the LTO's own review answer sends a driver who needs the phone.
//
// Hands-free is not the answer here: the three Level 10 decks never state it,
// and the one list of prohibited acts they carry is an image. The lesson
// mentions it, from FDM Vol. 1.
const phoneRingsSlot: SlotVariant[] = [
  {
    id: 'level10.the-phone-rings',
    label: 'The phone rings',
    type: 'scenario_trigger',
    cutscene: true,
    npc: {
      path: 'travelling_ahead',
      vehicleKind: 'jeepney',
      label: 'a jeepney in the lane ahead',
      lane: 'inner',
      // Close enough to be on the board behind the panel. The description says
      // the driver is behind a jeepney, so a jeepney four seconds up the road —
      // a speck near the horizon — would make that a sentence rather than a
      // description of what is on the screen.
      entryHeadway: 2.4,
      approachSpan: 760,
      speed: { cruise: 0.8 },
    },
    description:
      'You are behind a jeepney on the way out of town when the phone lights up in its cradle. Your sister is calling.',
    question: 'What does the law let you do?',
    choices: [
      { label: 'Leave it. Call back once you have stopped off the road.', action: 'accelerate' },
      { label: 'Answer it quickly — two seconds is not distracted driving.', action: 'brake' },
      { label: 'Wait for the red light ahead and answer while stopped there.', action: 'stop' },
    ],
    correctAction: 'accelerate',
    points: 20,
    // Shorter than the driven scenarios on purpose: this one freezes the drive
    // to be read, so its approach is a run-in rather than a reaction window.
    warningDistance: 440,
    penaltyMessage:
      'The Act covers a vehicle in motion and one stopped at a red light in the same sentence. The call waits until you are parked.',
    rewardMessage:
      'Right. The call waits until you are parked off the road, and your eyes stay on the jeepney.',
    duration: 200,
    lawCitation:
      'RA 10913, the Anti-Distracted Driving Act, prohibits all motorists from using any communications device while the motor vehicle is in motion or temporarily stopped at a traffic light or intersection, whether the vehicle is diplomatic, public or private. A red light is not a pause in the rule; it is named in it. A driver who needs the phone stops at a safe place off the road first. Fines run Php 5,000, Php 10,000, then Php 15,000 with a three-month license suspension, and Php 20,000 with revocation for a fourth offense. A driver of a public utility vehicle, a school service, or a common carrier of volatile, flammable or toxic material who does it within fifty meters of a school pays Php 30,000 and loses their license for three months.',
    competency: 'general_rules',
    severity: 'major',
  },
];

// 2. Lena gets out of the harness — modules 1 and 2 together, and the one place
// in the level where a restraint law is a driving task rather than a question.
// "At all times" is not satisfied by having buckled her once in the driveway,
// and the only lawful way to fix it is stopped, off the travel lane.
//
// Graded entirely on `stoppedInBay`, which is the whole of the correct
// response: a driver who stops in the lane has left a car standing in live
// traffic, and one who reaches into the back seat at speed has committed the
// offense event 1 is about without restraining anybody.
//
// The description does not mention the turnout. It is drawn on the road and
// the cue points at the lay-by; saying where to go would state the move to a
// driver shown the situation alone.
const outOfHerSeatSlot: SlotVariant[] = [
  {
    id: 'level10.out-of-her-seat',
    label: 'Out of her seat',
    type: 'scenario_trigger',
    scene: 'lay_by',
    description:
      'Lena has worked her arms out of the harness and is standing up against the back of your seat.',
    recommendedMove: 'Pull into the turnout on the right and stop.',
    realWorldNote:
      'Hazards on while you are stopped, and check the harness is flat and untwisted before you set off again.',
    correctAction: 'stop',
    points: 25,
    // A lane change across the carriageway and then a stop, on a road where the
    // bay only opens for its own short span. Level 9's blowout needs the same
    // room for the same reason.
    warningDistance: 560,
    penaltyMessage:
      'A child has to be secured at all times, not just at the start of the trip. Reaching back at speed restrains nobody and takes your eyes off the road.',
    rewardMessage:
      'Right. Off the travel lane, stopped, the harness buckled flat with the strap across her chest, and only then back onto the road.',
    duration: 200,
    lawCitation:
      'RA 11229 makes it unlawful for the driver of a covered vehicle not to secure a child properly in a child restraint system at all times while the engine is running or the child is being transported. The restraint must be correctly anchored and suited to the child\'s age, height and weight, with the harness firmly buckled and untwisted, the shoulder strap across the chest rather than the neck, and the lap belt across the thighs and hips rather than the abdomen. A child restraint system diminishes the risk of injury in a collision or an abrupt deceleration by limiting the mobility of the child\'s body; a child out of the harness has none of that.',
    competency: 'general_rules',
    severity: 'critical',
    bay: {
      side: 'right',
      mayStop: true,
      hint: 'Turnout ahead on the right — pull off the lane and stop',
    },
  },
];

// 3. The smoking jeepney — module section 5, met from the only side of it a
// private driver ever sees. Driven, and graded on the gap actually held.
//
// The jeepney is real: it travels under its own power, slows on the run-in, and
// is drawn belching, so the plume is something on the screen rather than a
// sentence about one. Grading it on arrival speed would pass a driver who sat
// on its tailgate the whole way and then lifted off at the end, which is the
// exact behavior the scenario is about.
//
// The Clean Air Act says what happens to the jeepney, not what the driver
// behind it does. The move is RO101's for poor visibility and tailgating, and
// the three seconds are FDM Vol. 1's two-or-three-second rule; the citation
// carries both beside the Act.
const smokeInTheLaneSlot: SlotVariant[] = [
  {
    id: 'level10.smoke-in-the-lane',
    label: 'Smoke in your lane',
    type: 'obstacle_ahead',
    npc: {
      path: 'travelling_ahead',
      vehicleKind: 'jeepney',
      label: 'a jeepney belching black smoke',
      // No lane: it joins in the one the car is in, which is the lane the smoke
      // hangs in wherever it is played.
      // Clear of the three seconds the scenario asks for, with room to spare
      // for a driver who eases off and none at all for one who does not. A lead
      // vehicle that joined *inside* the requirement would fail it on the frame
      // it arrived, whatever the driver then did about it.
      entryHeadway: 3.4,
      approachSpan: 780,
      smoking: true,
      // It brakes hard on the run-in, which is what a jeepney does when
      // somebody shouts para. The gap is tested by the vehicle ahead closing
      // it rather than by the driver choosing to.
      speed: { cruise: 0.7, slowsTo: 0.3, slowsFrom: 420 },
    },
    description:
      'The jeepney ahead lays down black smoke every time it pulls away, and the exhaust hangs in the lane thick enough to hide the road past it.',
    recommendedMove: 'Ease off and keep three seconds to the jeepney.',
    correctAction: 'brake',
    points: 20,
    warningDistance: 560,
    penaltyMessage:
      'Closing up does not shorten your time in the smoke. It only means spending it unable to see through it and too close to stop.',
    rewardMessage:
      'Right. Well back in clear air, with room to stop, and the violation left to the people who can actually test for it.',
    duration: 200,
    lawCitation:
      "RA 8749, the Clean Air Act, ties a vehicle's registration to its emissions: a new vehicle needs a Certificate of Conformity and a used one a Certificate of Compliance to Emission Standard, from a test taken within sixty days before registration. A vehicle found emitting excessive smoke while operating on a public highway is subject to an emission test by the DOTr, through the LTO, its designated enforcement units or its deputized agents. Fines run to not more than Php 2,000 for a first offense, Php 4,000 for a second, and Php 6,000 with a one-year suspension of the registration for a third, and the driver and operator attend a DOTr seminar on pollution control. Enforcement is theirs, not yours, and it is not done from a bumper. Yours is the smoke itself: it hides the road, so slow down, keep your eyes on the road, and keep a suitable braking distance — two or three seconds — behind the vehicle ahead.",
    competency: 'hazard_awareness',
    severity: 'major',
    following: {
      seconds: 3,
      tooCloseMessage:
        'You closed up inside the plume, where you can neither see through it nor stop if the jeepney does.',
    },
  },
];

// 4. The checkpoint — module section 4's escalation ladder, at the rung the
// driver personally stands on. One event rather than the two the old route
// used, because being waved in and deciding what to say at the window is one
// stop, not two.
//
// The probable cause is the officer's, and it is one the Act names: bloodshot
// or reddish eyes, which a sober driver can have. It has to be the driver's
// own sign — the smell the Act counts is the smell of alcohol on
// the *driver's* breath, not a passenger's beer. The player is sober throughout
// and is cleared by taking the tests. What is graded is the response to a
// lawful direction, because the penalty for getting it wrong is the harshest
// single consequence in the module — refusal is not a fine, it is the license.
//
// Nothing here says "step out". RO101 lists a right not to step down from the
// vehicle beside RA 10586's tests "on site", and the sources never reconcile
// the two, so the scenario asks only whether to take the tests.
//
// The document carries no line about the breath analyzer: the third answer is
// asking for it instead of the tests, and the panel is shown at every support
// level.
//
// The stop itself is driven. `inspection` holds the world only once the car is
// actually at rest, so a driver who rolls through the checkpoint is graded on
// having rolled through it and never sees the document.
const theCheckpointSlot: SlotVariant[] = [
  {
    id: 'level10.the-checkpoint',
    label: 'LTO checkpoint',
    type: 'stop_sign',
    description:
      'An enforcer waves you into a checkpoint, tells you your eyes look bloodshot, and directs you to take the three field sobriety tests.',
    correctAction: 'stop',
    points: 25,
    warningDistance: 560,
    question: 'You have not been drinking. What do you do?',
    choices: [
      { label: 'Take all three tests.', action: 'stop' },
      { label: 'Refuse — you are sober, so there is nothing to test.', action: 'accelerate' },
      { label: 'Ask to skip the tests and use the breath analyzer.', action: 'brake' },
    ],
    penaltyMessage:
      'Refusing the tests costs the license: confiscated, then automatically revoked. The breath analyzer comes only after a failed field test.',
    rewardMessage:
      'Right. A driver who passes all three is not charged under the drunk-driving law, and keeps their license.',
    duration: 220,
    lawCitation:
      "RA 10586 sets out how a stop escalates. Probable cause is a traffic offense the officer personally witnesses — lane straddling, sudden stops, speeding, swerving or weaving — or the evident smell of alcohol on the driver's breath, slurred speech, bloodshot or reddish eyes, a flushed face, poor coordination, or difficulty understanding and answering questions. The officer then informs the driver of the assessment and directs all three field sobriety tests on site: the eye test for horizontal gaze nystagmus, the walk-and-turn of nine heel-to-toe steps, a turn and back, and the one-leg stand, six inches off the ground for thirty seconds. A driver who passes all three is apprehended for the traffic offense only, if there was one, and not under RA 10586. Only a driver who fails any of them goes on to the alcohol breath analyzer on site, and a reading over the limit means arrest and the vehicle impounded. Refusing the mandatory testing is penalized by confiscation and automatic revocation of the driver's license, after due process.",
    competency: 'general_rules',
    severity: 'critical',
    inspection: {
      officerLine:
        'Magandang hapon po. Namumula po ang mga mata ninyo, kaya kailangan po nating gawin ang tatlong field sobriety test.',
      documentType: 'Checkpoint Record — Anti-Drunk and Drugged Driving Act',
      holder: 'DELA CRUZ, JUAN M.',
      fields: [
        { label: 'Probable cause', value: 'Bloodshot eyes (driver)' },
        { label: 'Driver', value: 'States no alcohol taken' },
        { label: 'Tests directed', value: 'Eye test, walk-and-turn, one-leg stand' },
        { label: 'Assessment', value: 'Explained to the driver' },
      ],
      vehicle: 'Private passenger car — 1,890 kg gross vehicle weight',
      tripPurpose: 'Private family trip, own vehicle',
    },
  },
];

// 5. The overloaded truck — module section 6, on the class of vehicle the
// charge law's overloading rules were actually written for. Driven, and graded
// on the center line: everything about this truck says do not pass it, and the
// line here says so as well.
//
// The gravel does the rest of the arguing. The surface it sheds genuinely takes
// grip away, so a driver who pulls out to overtake finds out why the line was
// solid — and `requiredLane.strict` means a driver who crosses and drifts back
// before the truck has still done the thing the marking forbids.
//
// The gravel is also the truck's own violation: a load of gravel and sand
// travels under a canvas cover. The citation carries that, and the overtaking
// rule the driver is actually graded on.
const losingItsLoadSlot: SlotVariant[] = [
  {
    id: 'level10.losing-its-load',
    label: 'Losing its load',
    type: 'obstacle_ahead',
    npc: {
      path: 'travelling_ahead',
      vehicleKind: 'truck',
      label: 'an overloaded truck',
      lane: 'inner',
      entryHeadway: 2.6,
      approachSpan: 780,
      speed: { cruise: 0.55 },
    },
    description:
      'A truck ahead is stacked well above its side rails with one frayed rope over the lot, and gravel is coming off the tailgate onto the road.',
    recommendedMove: 'Stay on your side and hold well back.',
    correctAction: 'brake',
    points: 20,
    warningDistance: 560,
    penaltyMessage:
      'You came up on a load one rope is holding, over a surface it is covering in gravel. Fall back and let it have the road.',
    rewardMessage:
      'Right. You stayed on your own side of the line, behind a load that was shedding gravel.',
    duration: 200,
    lawCitation:
      "RA 8794 restricts overloading for road safety, to prevent the premature deterioration of the road, and to prevent the smoke-belching an over-tasked engine causes. The owner of a truck or trailer loaded beyond its maximum allowable gross vehicle weight pays a penalty of 25% of the motor vehicle user's charge, waived under a 5% tolerance, and no vehicle may proceed with a dual-wheel axle load over 13,500 kilograms or a load over 150% of its maximum allowable gross vehicle weight. Gravel and sand travel under a canvas cover, and failing to cover a cargo that requires one is a violation of its own. None of that is yours to enforce. What is yours is the line: overtaking in a no-overtaking zone is a violation, and the gravel this truck sheds is on the road you would pass it on.",
    competency: 'hazard_awareness',
    severity: 'major',
    requiredLane: {
      lane: 'inner',
      strict: true,
      hint: 'Solid line — stay on your side',
      wrongLaneMessage:
        'You crossed the center line to pass a load one rope is holding, onto the gravel it is shedding. That is the worst place on this road to do it.',
    },
    effect: { grip: 0.7, span: 180 },
    // The no-overtaking line its citation turns on, declared with it. Here the
    // level's own span paints it; Level 12, which borrows the truck into its
    // hazard slot, paints it from this.
    roadLine: 'double_solid_yellow',
  },
];

// 6. The bus on the descent — module section 7. Driven, and graded against the
// forty posted at the top of the grade, which is the one thing on this road a
// driver's own discipline is being measured by.
//
// That pairing is the lesson. A speed limiter exists because discipline alone
// was judged not to be enough for the vehicles that carry other people, and the
// bus running away down the grade is what a missing one looks like: nothing in
// the vehicle is configured to take the speed away, and gravity is supplying
// it. The player has the same gradient under them and no limiter either — only
// the sign, and whether they obey it.
//
// The Act binds covered vehicles, not the player's car, so what the driver is
// graded on comes from RO101 — a suitable speed downhill, rather than braking
// all the way — and the posted sign. The citation stops at the first offense:
// the two LTO decks disagree about the second.
const busOnTheGradeSlot: SlotVariant[] = [
  {
    id: 'level10.bus-on-the-grade',
    label: 'Bus on the grade',
    type: 'speed_limit',
    postedSpeed: 40,
    scene: 'gradient_down',
    sign: {
      name: 'Speed Limit',
      category: 'C. Regulatory Sign — Speed',
      meaning: 'The maximum speed allowed on this stretch of road.',
      art: 'circle_limit',
      glyph: '40',
    },
    npc: {
      path: 'travelling_ahead',
      vehicleKind: 'bus',
      label: 'a bus running away down the grade',
      lane: 'inner',
      entryHeadway: 2.2,
      approachSpan: 720,
      speed: { cruise: 1.5 },
    },
    description:
      'A provincial bus is pulling away from you down the grade, brakes smoking, well past the forty posted at the top. The road is pulling you along with it.',
    recommendedMove: 'Hold your speed down to the posted forty.',
    correctAction: 'brake',
    points: 20,
    warningDistance: 560,
    penaltyMessage:
      'You came down the grade over the posted forty. A bus with no working limiter has no ceiling of its own, and you are not obliged to match it.',
    rewardMessage:
      'Right — forty held all the way down, while the bus ran away from you. Its speed is not a limit you have to match.',
    duration: 200,
    lawCitation:
      "RA 10916, the Road Speed Limiter Act, requires covered vehicles — closed vans, haulers and cargo trucks or trailers, public utility vehicles, shuttle services and tanker trucks, but not taxicabs or public utility jeepneys — to run with a standard speed limiter, set under LTO or LTFRB supervision to the maximum allowed on the route they ply, and a covered vehicle without one is not registered. Operating without one, or with one that does not work or has been tampered with, carries a Php 50,000 fine with the driver's license suspended for one month or the franchise for three months on a first offense, and the vehicle is impounded until the fine is paid. Tampering with a limiter carries six months to three years' imprisonment and a Php 30,000 fine. None of it applies to your car: yours is the posted limit, and on a descent a suitable speed, so that the brakes are not worked all the way down.",
    competency: 'speed_control',
    severity: 'major',
    effect: { gradient: 0.08, span: 220 },
  },
];

// 7. The rider down — module section 3's exemptions, and the duty that makes
// them matter. Driven, because the duty the law describes begins with the word
// stop, and a prompt asking whether the driver *would* have stopped is not the
// same test as a driver who did.
//
// See the file header. This is the reason event 1 can be taught honestly: a
// level that only ever punishes the phone produces a driver who believes the
// Act has no exceptions, and this is the exact situation where that belief
// costs somebody their life. The call itself has no key, so it is carried by
// the read panel's real-world note, the verdict and the citation, and what is
// graded is the stop.
//
// The duty RA 4136 puts on a driver binds one "concerned in" the crash, which
// this driver is not, so the stop is RO101's first aid rather than a legal duty
// and none is claimed. The numbers are RO101's with one correction from a later
// law: RO101 prints PNP 117, which Executive Order No. 56, s. 2018
// replaced with Emergency 911. The Red Cross stays on 143.
const riderDownSlot: SlotVariant[] = [
  {
    id: 'level10.rider-down',
    label: 'Rider down',
    type: 'obstacle_ahead',
    actor: { kind: 'motorcycle', hazards: true, side: 'curb' },
    // On the verge rather than in the carriageway, and not solid: the rider is
    // the reason to stop, not a second thing to miss. `position` is a share of
    // the road's width from its left edge, so anything past 1 is off it.
    pedestrians: [{ kind: 'adult', position: 1.12 }],
    description:
      'A motorcycle is stopped dead in the lane ahead with its hazards going. Its rider is on the shoulder beside it, not moving, and nobody else is here.',
    recommendedMove: 'Come to a full stop short of the bike.',
    realWorldNote:
      'Hazards on, then call 911 or the Red Cross on 143. An emergency call is exempt from the distracted-driving ban.',
    correctAction: 'stop',
    points: 25,
    // A bike across the lane and a person beside it. The runway has to be a
    // stopping distance, not a reading distance.
    warningDistance: 560,
    penaltyMessage:
      'You drove past a rider who is not moving, on a road with nobody else on it. Stop, then call 911: the phone ban exempts that call.',
    rewardMessage:
      'Right — stopped short of the bike. From here, the call to 911 is one the phone ban exempts.',
    duration: 220,
    lawCitation:
      'RA 10913 does not apply to a motorist using a mobile phone for an emergency call: to a law enforcement agency to report an accident, to a health care provider or emergency rescue unit where immediate medical attention is needed, to the fire department, or to other emergency services. The call is made from where you have stopped. Attend first to anyone who is not walking and talking; do not move an injured person unless they are in a burning vehicle or other immediate danger, because unnecessary movement often makes injuries worse; and do not attempt first aid you have not been trained in. Note where you are, and call Emergency 911, the national emergency hotline, or the Red Cross on 143.',
    competency: 'general_rules',
    severity: 'critical',
  },
];

export const SLOT_DISTANCES = [900, 1800, 2700, 3500, 4420, 5320, 6220];
export const SLOTS: SlotVariant[][] = [
  phoneRingsSlot,
  outOfHerSeatSlot,
  smokeInTheLaneSlot,
  theCheckpointSlot,
  losingItsLoadSlot,
  busOnTheGradeSlot,
  riderDownSlot,
];

/**
 * The mission is worth 215 points: 60 in the driveway and 155 on the road.
 *
 * The road's 155 splits as 25 for each of the three points whose cost is
 * measured in a person — an unrestrained child, a revoked license, a rider left
 * in the road — and 20 each for the four where it is measured in risk. The
 * driveway is a flat 15 a point, which keeps it under thirty percent of the
 * total: the stage is where the trip is set up, not where it is won.
 *
 * The pass mark is 69% of the total, the share every level from 4 onwards uses.
 *
 * No single habit comes near it, and `level10Drive.test.ts` drives each one
 * rather than reasoning about it:
 *
 * - **Brake at everything** takes the smoke, the truck and the grade honestly,
 *   never leaves the lane it started in, and so loses the turnout — and it
 *   answers "leave the phone alone" with a brake, which is the wrong answer.
 * - **Accelerate at everything** ends in the truck or the bike.
 * - **Stop at everything** is charged for crawling on top of losing the phone.
 * - **Press 1 at every question** is answered by the shuffle: nothing in the
 *   app renders `choices` in the order they are written here.
 */
export const level10: LevelConfig = {
  id: 10,
  name: levelModule.title,
  moduleId: levelModule.id,
  description: levelModule.desc,
  // Seven events 800 to 920 apart, plus a runway past the last one long enough
  // for its measurement window to close before the road ends.
  roadLength: 6920,
  // A provincial national road, the same class Level 9 uses and for a related
  // reason: this is a family trip out of the city, which is where checkpoints
  // are set up, where a jeepney is followed for kilometers, and where a bus on
  // a descent has enough grade to outrun its own brakes. A town speed would
  // make the following gap unmeasurable; an expressway speed would leave no
  // time to read any of it.
  speedLimit: 60,
  requiredScore: 148,
  stars2: 178,
  stars3: 204,
  events: buildEvents(SLOTS, SLOT_DISTANCES, pool => pool[0]),
  /**
   * The driveway, before the engine starts. See `hotspots` above for what the
   * four points are and why the first of them is a point where nothing needs
   * fixing.
   */
  garage: {
    plate: 'NCP 3719',
    intro:
      'Everyone is aboard and the car is loaded. Work round it one point at a time: every law on this trip is broken in a driveway before it is broken on a road.',
    hotspots,
  },
  /**
   * An ordinary two-way national road: four lanes, the left two carrying
   * opposing traffic.
   *
   * The oncoming side is not decoration. The overtake the truck at event 5
   * tempts you into has to have somewhere to go for refusing it to mean
   * anything, and the solid line over that stretch is what makes the refusal a
   * rule rather than advice. It covers the whole window the crossing is graded
   * over — 3,860 to 4,440 — rather than the marking's own point, because
   * `requiredLane.strict` fails a driver who crossed anywhere in it.
   */
  paint: {
    oncomingLanes: 2,
    base: 'broken_yellow',
    spans: [{ from: 3820, to: 4480, art: 'double_solid_yellow' }],
  },
};
