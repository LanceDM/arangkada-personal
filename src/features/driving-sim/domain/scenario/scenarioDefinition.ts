import type { EnvironmentTrigger } from '@/features/driving-sim/domain/fsm/fsmTypes';
import type { DrivingPace } from '@/features/driving-sim/domain/world/DrivingPace';
import type { DrivingCompetency, ViolationSeverity } from '@/domain/learner/competency';

import type {
  CrossingPedestrian,
  LaneSlot,
  LongitudinalArt,
  MarkingPlate,
  NpcVehicleSpec,
  PullOverBay,
  RoadActorSpec,
  RoadEffect,
  RoadPaint,
  RoadScene,
  RouteLayout,
  ScenePrefab,
  SignPlate,
} from './scenarioScene';

export interface QuestionChoice {
  label: string;
  action: 'brake' | 'stop' | 'accelerate' | 'turn_left' | 'turn_right' | 'honk';
}

/** One printed row on the document handed over at a checkpoint. */
export interface InspectionField {
  label: string;
  value: string;
}

/**
 * Turns an event into a checkpoint stop: the player must brake to a full stop,
 * the simulation pauses, and the document below is inspected before deciding
 * whether the driver may legally proceed.
 */
export interface CheckpointInspection {
  /** Officer's opening line when the driver is flagged down. */
  officerLine: string;
  /** Document presented, e.g. "Non-Professional Driver's License". */
  documentType: string;
  holder: string;
  /** Rows printed on the document card. */
  fields: InspectionField[];
  /** Vehicle actually presented at the checkpoint. */
  vehicle: string;
  /** Why the trip is being made — private, or paid/professional work. */
  tripPurpose: string;
  /**
   * An enforcer flags the car down from the curb, rather than a checkpoint
   * stopping it at a barrier across the road.
   *
   * Declared, because the two are different moves. At a checkpoint the driver
   * stops at the line in whatever lane they are in. Stopped by an enforcer,
   * they "safely pull over to the extreme right" (FDM Vol. 1, law enforcement
   * officer), so the inspection opens only on a full stop in
   * the curb lane, the scene draws the enforcer at the curb and no barrier, and
   * the panel is a traffic stop. `missedMessage` is the verdict for a driver
   * who drove through without doing it, which the question's own penalty
   * cannot describe.
   */
  pullOver?: { missedMessage: string };
}

/**
 * A sudden failure of the driver's own vehicle, frozen and asked rather than
 * driven.
 *
 * Every other event in the game is answered with the car: a speed, a lane, a
 * stop. These three cannot be. A blowout is answered by *not* slamming the
 * brake, a brake failure by a sequence of four things none of which is a key on
 * this keyboard, and a skid by looking where you want to go. The simulation can
 * read a speed and a lane; it cannot read the difference between easing off and
 * standing on the pedal, and grading a blowout as "did you brake" would score
 * the exact reflex the module spends a page telling drivers not to have.
 *
 * So the sim freezes the moment the failure happens and the decision is taken
 * in a prompt — the same call Level 5 makes for priority judgments and Level 8
 * for the road-rage confrontation. The value picks which failure is drawn.
 */
export type EmergencyKind = 'blowout' | 'brake_loss' | 'skid' | 'jammed_pedal';

/**
 * Lane a sign applies to, named by its role on your own side of the road:
 * `inner` is the lane nearest the centre line, `curb` the one nearest the curb.
 *
 * Deliberately not named from the left edge of the paint. See `LaneRole` in
 * vehiclePhysics — the index a role resolves to depends on how many lanes of
 * opposing traffic the level declared, so absolute names would make every rule
 * here true only for one road layout.
 */
export type LaneName = LaneSlot;

/**
 * A lane the player has to be in for this sign, so lane position is part of
 * the answer rather than decoration. Used on its own for signs that direct
 * traffic into a lane, and as the basis of a turn below.
 */
export interface LaneRequirement {
  lane: LaneName;
  /** Shown while the player still has room to change lanes. */
  hint: string;
  /** Scored instead of the reward when the sign is met from the wrong lane. */
  wrongLaneMessage: string;
  /**
   * The requirement holds for the whole approach, not just the marking's own
   * point: leaving the required lane at any time before the marking fails it,
   * even if the car has returned by the time it arrives.
   *
   * Most lane requirements are about arriving correctly positioned — being in
   * the right lane by the time you reach the point that needs it, which is
   * what an unset `strict` still means. A no-overtake line is a different
   * kind of requirement: the violation is the act of crossing it, so briefly
   * crossing and drifting back before the exact marking point has still done
   * the thing the line forbids.
   */
  strict?: boolean;
}

/**
 * A turn the player must actually execute at a junction, rather than answer
 * about. The turn is refused from any lane other than `lane`, so getting into
 * position beforehand is the real decision and the keypress only commits it —
 * you cannot turn left from the right lane, exactly as on the road.
 */
/**
 * How the vehicle leaves the road it is on.
 *
 * `junction` is a street corner: the road stops, the car swings through ninety
 * degrees off the side of the frame, and the street being turned into becomes
 * the road being driven. `ramp` is an expressway exit: nothing stops, the car
 * crosses onto the ramp's own line over a second or so, and the route's own
 * segments carry it on from there.
 *
 * The two are not interchangeable. Reusing the first for the second put the car
 * off the canvas for five frames, jumped the route seven hundred units, and set
 * it down at a lane centre it had never driven to.
 */
export type ManeuverStyle = 'junction' | 'ramp';

export interface TurnManeuver extends LaneRequirement {
  /** Which shape the manoeuvre takes. Defaults to `junction`. */
  style?: ManeuverStyle;
  /**
   * `'either'` is a road that simply ends, such as a T-junction: both turns are
   * correct, but each still has to be made from its own lane — left from the
   * lane nearest the centre line, right from the curb lane — so `lane` is
   * ignored in that case.
   */
  direction: 'left' | 'right' | 'either';
  /**
   * How far before the point itself the turn may be committed, in road units.
   *
   * A junction is committed from the reaction band, because a junction is a
   * point on the road. Junctions only: an expressway exit declares `commitAt`
   * instead, because a ramp is a place and not a band.
   */
  commitFrom?: number;
  /**
   * The exact point of the route the manoeuvre is taken at.
   *
   * One number, shared by the gore that draws the opening, the fixture that
   * anchors it, the scenario that grades it and the frame the animation starts
   * on — so none of them can drift from the others. A ramp declares it; a
   * junction does not.
   *
   * Measured against the car's *front bumper* rather than its centre, because
   * the exit is where the nose of the car reaches the marker. Half a car length
   * is most of a second at ramp speed, and it was the difference between
   * turning at the marker and turning after it.
   *
   * The band either side of it is `RAMP_COMMIT_TOLERANCE`, and the input has to
   * be a fresh press inside it: a driver holding right to reach the
   * deceleration lane is steering, not committing, and a held key would have
   * taken the ramp at whichever frame the speed gate happened to clear.
   */
  commitAt?: number;
  /**
   * Speed the turn may be taken at. Above it the wheel does nothing here,
   * exactly as it does nothing from the wrong lane — and the event is graded on
   * having arrived carrying too much speed to take the turn at all.
   */
  maxSpeed?: number;
  /** Scored when the turn was refused because the car was carrying too much speed. */
  tooFastMessage?: string;
  /**
   * The lane the road hands over into once the turn is complete. Without it a
   * turn lands in the lane the junction hand-off has always used.
   */
  exitLane?: LaneName;
  /**
   * How far along the new road the car is set down. Without it, just past the
   * junction — which is right for a crossroads and far too short for a ramp,
   * where the road the turn leads to begins some way along.
   */
  handOffAfter?: number;
  /**
   * The road goes this way whether or not the driver committed to it.
   *
   * True for a terminal exit: the carriageway leaves the expressway here, so a
   * driver who never set up for it is carried off anyway, graded on not having
   * set up for it. Without this they would drive on down a road that does not
   * exist — or be stranded short of everything after it.
   */
  mandatory?: boolean;
}

/**
 * A minimum time gap to the vehicle in front, held for the whole approach.
 *
 * Measured in seconds rather than metres because that is the rule the module
 * teaches and the only form of it that survives a change of speed: two seconds
 * is two seconds at 40 and at 100, while "keep 50 metres" is generous at one and
 * a third of a stopping distance at the other.
 *
 * Only means anything alongside a vehicle the driver can actually fall in
 * behind, so it is declared on events that carry a `travelling_ahead` `npc`.
 * With nothing ahead there is no headway to measure and the requirement is
 * simply never violated.
 */
export interface FollowingRequirement {
  /** Seconds of headway that must be kept to the vehicle ahead. */
  seconds: number;
  /** Scored instead of the reward when the gap was not held. */
  tooCloseMessage: string;
}

/**
 * How steady the car has to be held across the road while a scenario runs.
 *
 * Every other lane rule in the game asks which lane the car is in. This one
 * asks whether it *moved*, which is a different question and the only one worth
 * asking when somebody is alongside: a rider filtering up the line between two
 * lanes is not in a lane you can be graded against, and the thing that hurts
 * them is a driver wandering a few feet sideways, not a driver in the wrong
 * lane. Measured from where the car was when the window opened, so it is the
 * wander that is graded and not the line the driver had chosen.
 *
 * Speed is deliberately not part of it. Easing off while somebody comes past is
 * a perfectly good response, and grading it would turn "hold your line" into
 * "hold your speed".
 */
export interface LineHoldRequirement {
  /** How far the car may move sideways, in canvas pixels. */
  maxDrift: number;
  /**
   * The side the line is held against, where the scenario has one: only a move
   * that way counts toward `maxDrift`. Level 11's riders are in their lane at
   * the curb, so moving away from them, out of their lane included, gives them
   * room rather than taking it. Undeclared, a wander either way counts, as it
   * must for a rider who may be on either side.
   */
  toward?: 'left' | 'right';
  /** Scored instead of the reward when it wandered further than that. */
  driftedMessage: string;
}

/**
 * Speed that has to come off gradually rather than by standing on the brake.
 *
 * The only requirement in the game graded on *how* a control was used rather
 * than on what the car ended up doing, and it exists because one emergency's
 * whole answer is restraint. After a tire blowout the module's first three
 * instructions are "take your foot off the accelerator", "do not slam on the
 * brakes" and "slow down gradually": one corner has already lost its grip, and
 * hard braking on top of that is what turns a flat into a spin. Only once the
 * vehicle is back under control does the pedal become the right answer —
 * "apply the brake softly", then pull over.
 *
 * ## Why it is a duration and not simply "no brake"
 *
 * Because this car has one deceleration control. `driveVehicle` reads ↓/S both
 * as the brake *and* as the tap that steps the speed setting down, so "ease off
 * the accelerator without braking" is not a thing the controls can express, and
 * a requirement written that way would be ungradeable no matter how it was
 * measured. What the controls *do* separate, cleanly, is a tap from a hold: one
 * tap drops the setting a full step and costs a single frame of brake, while a
 * held pedal takes `BRAKE_FORCE` off every frame until it is released. Easing
 * off and standing on it are those two inputs, and that is the distinction the
 * module is actually drawing.
 *
 * Every other way of asking fails outright. Grading the speed at a point passes
 * the driver who slammed it, because both arrive as a lower number.
 * `avoid: ['brake']` contradicts itself in a scenario that also wants the car
 * stopped, since the derived action for a car that braked *is* `brake`.
 */
export interface CoastRequirement {
  /**
   * At or below this speed the brake may be held for as long as the driver
   * likes: the vehicle is back under control and braking softly to a stop is
   * the next instruction rather than a mistake.
   *
   * Set it at the speed the rest of the game already calls "slowed for this".
   */
  brakeBelow: number;
  /**
   * The longest unbroken brake application allowed while still above that
   * speed, in frames at 60fps.
   *
   * A tap is a few frames; shedding real speed by holding the pedal takes
   * dozens. Pitch it well clear of a firm tap so the requirement never fails
   * somebody for the length of their keypress.
   */
  maxHeldFrames: number;
  /** Shown live while the requirement is running, in a few words. */
  hint: string;
  /** Scored instead of the reward when the brake was stood on. */
  brakedMessage: string;
}

/**
 * Joining a carriageway from an auxiliary lane.
 *
 * Three things have to be true, and a merge that measures only one of them is
 * the merge this replaced: it graded the speed at a point and then told the
 * driver they had merged. Speed alone is not a merge, a lane change alone is
 * not a safe one, and neither is worth anything if the auxiliary lane ran out
 * with the car still on it.
 */
export interface MergeRequirement {
  /** The lane that must have been joined by the time the auxiliary lane ends. */
  intoLane: LaneName;
  /** Speed that must be carried into the carriageway. */
  minSpeed: number;
  /** Headway that must be left to the traffic already on it, in seconds. */
  safeGapSeconds: number;
  /**
   * How much of the auxiliary lane must still be there when the merge is
   * finished, as a share of a full lane.
   *
   * "Before the lane ends" is not the same as "before the lane has ended". The
   * road narrows a driver out of a lane they never left, so a merge measured
   * only at the moment the tarmac runs out would pass a driver who was squeezed
   * across rather than one who moved across. Half a lane is the difference
   * between the two.
   */
  completeBy: number;
  /** The merge was left to the taper rather than made. */
  neverMergedMessage: string;
  /** The car joined, but below the speed the carriageway runs at. */
  tooSlowMessage: string;
  /** The car joined into a gap that was not there. */
  unsafeGapMessage: string;
}

/**
 * A complete overtake: out, past, and back again.
 *
 * A lane requirement asks where the car is at one point. Overtaking is not one
 * point — it is four things in order, and a driver who does the first and not
 * the last has not overtaken, they have moved into the passing lane and stayed
 * there. Each phase below is read off the car's own lane and its distance
 * relative to the vehicle being passed, so the feedback can name the phase that
 * was actually reached rather than claiming a manoeuvre nobody measured.
 */
export interface OvertakeManeuver {
  /** The lane the pass must be made in. */
  passingLane: LaneName;
  /** Road distance that must be opened past the vehicle before returning is safe. */
  clearBy: number;
  /** The passing lane was never entered: no pass was attempted. */
  neverPassedMessage: string;
  /** The vehicle was drawn level with from a lane that is not the passing lane. */
  wrongLaneMessage: string;
  /** The pass was made but the passing lane was never given back. */
  neverReturnedMessage: string;
  /** Returned to a travelling lane before there was room to. */
  cutInMessage: string;
}

export interface ScenarioEvent {
  /**
   * Stable, human-readable, globally-unique identifier: a dot-separated,
   * kebab-case path from the source location straight back to this object.
   * Fixed events use `level{N}.<slug>` (e.g. `level0.slow-zone`); pooled
   * events (levels 1-4) use `level{N}.<slot-slug>.<variant-slug>` (e.g.
   * `level2.drive-out.neighbour`), where `slot-slug` names the pool array
   * this variant lives in and `variant-slug` is what actually distinguishes
   * it from its siblings. Lets a developer go from what's on screen (or a
   * dev-tool dropdown) straight to this exact object via one Grep.
   */
  id: string;
  triggerAtDistance: number;
  type: EnvironmentTrigger;
  description: string;
  correctAction: 'brake' | 'stop' | 'accelerate' | 'turn_left' | 'turn_right' | 'honk';
  points: number;
  penaltyMessage: string;
  rewardMessage: string;
  duration: number;
  /**
   * How far ahead this event announces itself, overriding the level's usual
   * cap. Still limited by however much clear road actually separates it from
   * the previous event.
   *
   * The standard warning gives a driver enough runway to notice a marking and
   * decide what to do about it — but a real physical hazard, like a
   * pedestrian who can be walked into, needs enough runway to actually stop
   * for, which is a longer distance than a lane-position check needs to be
   * read and understood.
   */
  warningDistance?: number;
  question?: string;
  choices?: QuestionChoice[];
  /**
   * The scenario's own name, in two to five words.
   *
   * What the screen calls this event while it is being driven. Authored rather
   * than derived for the same reason `recommendedMove` is: `description` is a
   * sentence about what is happening, and rendering a sentence where a name
   * belongs is what produced a paragraph of bold capitals over the road.
   *
   * Optional, and falls back to the plate's name or the event's own id slug
   * (see `presentation/ui/scenarioCopy`), so a level that has not been given
   * one still gets a short label rather than a paragraph.
   */
  label?: string;
  lawCitation?: string;
  /**
   * The safe move, in one line, shown while there is still road left to make
   * it.
   *
   * Authored, never derived from `description`, for the same reason the scene
   * is: the description says what is happening, and what to *do* about it is a
   * separate claim that has to be written down rather than read out of prose a
   * translator could reword. The screen keeps the two apart — situation,
   * recommended move, then the result that was actually measured — so a learner
   * is never left to infer the answer from the setup.
   */
  recommendedMove?: string;
  /**
   * What a real vehicle would also need here, which this one cannot ask for.
   *
   * The simulator has a throttle, a brake, a wheel and a horn. A curriculum
   * step outside that set — "shift to neutral", "flash your lights", "select a
   * lower gear" — is still part of the answer a learner is examined on, and
   * still must never be written into `recommendedMove`: an instruction naming a
   * control the player cannot find reads as a broken game, and it buries the
   * one that works. The jammed accelerator is where this was found. Its move
   * used to read "Shift to neutral, then hold the brake down", and neutral does
   * not exist.
   *
   * So the two are separated. `recommendedMove` is the thing to do *now*, in
   * the controls this car has; this is the sentence beside it, shown in the
   * read panel as clearly secondary and never as an instruction.
   */
  realWorldNote?: string;
  competency?: DrivingCompetency;
  severity?: ViolationSeverity;
  inspection?: CheckpointInspection;
  /** Enlarged sign card shown beside the road while the event is live. */
  sign?: SignPlate;
  /**
   * Pavement marking this event is about, drawn on the road and shown enlarged
   * in the prompt panel. Mutually exclusive with `sign` in practice: an event
   * asks the driver to read either the roadside or the road surface, and
   * showing two plates at once only splits their attention.
   */
  marking?: MarkingPlate;
  /**
   * The longitudinal line the carriageway carries through this event, for a
   * scenario about that line that is not itself a marking event. A `marking`
   * whose art is a longitudinal line declares its own; this is the same
   * declaration for the rest, such as an overtake refused over a double yellow.
   *
   * Presentation only: no grader reads it. Its own level paints the line in
   * its `paint`; Level 12, which borrows such scenarios, paints it from here
   * over every frame the scenario is graded (`declaredLineSpans`).
   */
  roadLine?: LongitudinalArt;
  /** Road geometry drawn for this event, instead of the renderer guessing. */
  scene?: RoadScene;
  /** Turn to execute here. Judged on lane position, not on the keypress. */
  maneuver?: TurnManeuver;
  /**
   * Lane the sign requires without any turn: taking the correct action from
   * the wrong lane still fails. Ignored when `maneuver` is set, which carries
   * its own lane.
   */
  requiredLane?: LaneRequirement;
  /**
   * Actions that fail this event if performed while passing it. Prohibition
   * signs are tested by what you refrain from doing, so "No Left Turn" is
   * passed by driving through without turning left rather than by braking.
   */
  avoid?: Array<ScenarioEvent['correctAction']>;
  /**
   * Where `avoid` names the stop, how close to the place, in meters, the car
   * may not come to rest: measured from its body to the event's point, either
   * side, on the scale the car is drawn at (`UNITS_PER_METER`). Omitted, only a
   * stop with the car alongside the place fails.
   *
   * The place is the rule, and the rule says how far it reaches: within four
   * meters of a fire hydrant. A posted sign says no distance in the sources'
   * text, so a tow-away zone declares none and is graded alongside the sign.
   * Coming to rest anywhere else on the approach is a stop the rule does not
   * forbid, and passes.
   */
  noStandingWithin?: number;
  /**
   * Time gap that must be kept to the vehicle ahead across this event's whole
   * window. Graded from the headway measured each frame, not from the speed at
   * one point.
   */
  following?: FollowingRequirement;
  /**
   * A pass that has to be completed rather than begun. Judged on the phases the
   * car actually reached relative to the vehicle it was passing.
   */
  overtake?: OvertakeManeuver;
  /**
   * How steady the car has to be held across the road here. The whole test
   * where it is declared: lane and speed have nothing to say about a driver who
   * held their line.
   */
  lineHold?: LineHoldRequirement;
  /**
   * Speed that has to come off this event without the brake, until the car is
   * slow enough for the brake to be safe. Settled before anything else the
   * window measures: a driver who stood on the pedal has failed it whatever
   * lane, speed or bay the rest of the window went on to see.
   */
  coast?: CoastRequirement;
  /**
   * Joining the carriageway from an auxiliary lane: the speed carried in, the
   * lane actually joined, and the gap it was joined into.
   */
  merge?: MergeRequirement;
  /**
   * Which way a posted speed is judged. A minimum restriction inverts the test,
   * so slowing down becomes the violation.
   */
  speedRule?: 'maximum' | 'minimum';
  /**
   * Speed this sign posts, where it differs from the road's own limit. A
   * maximum restriction has to post below the speed the vehicle cruises at,
   * otherwise obeying it would need no action at all.
   */
  postedSpeed?: number;
  /** How the road itself behaves here, so the warning warns of something real. */
  effect?: RoadEffect;
  /** A roadside bay this sign governs, which the car can pull into and stop in. */
  bay?: PullOverBay;
  /**
   * A scripted vehicle this event is about — the car with priority at an
   * uncontrolled junction, the one already circulating a roundabout, the
   * ambulance closing from behind. Declared here for the same reason
   * `sign`/`marking` are: so the renderer draws the actual situation instead
   * of guessing it from `description`. It moves along one fixed path with no
   * physics and makes no decisions of its own — grading still runs entirely
   * on the driver's own speed/lane/stop, exactly as every other event is judged.
   */
  npc?: NpcVehicleSpec;
  /**
   * A second scripted vehicle, riding behind the driver.
   *
   * Separate from `npc` because "what is in front of you" and "what is behind
   * you" are two facts about the same moment, and a scenario whose whole
   * subject is being pressed from behind while something happens ahead cannot
   * declare both through one slot. It is posed and drawn exactly like `npc`
   * and owns no grading of its own: pressure is a thing the driver has to
   * resist, so it must be visible, and it must never be what decides the
   * verdict.
   */
  rear?: NpcVehicleSpec;
  /**
   * Who is on foot here, for the crossing scenes. Composed by the scene rather
   * than bundled into it: the crossing draws the road furniture, this draws
   * the people on it, and neither knows about the other. That is what lets
   * Level 5 put a parent and a child on the same crossing element Level 3
   * stands a lone pedestrian beside, without either level owning a crossing of
   * its own.
   *
   * Left unset, the crossing draws one adult.
   */
  pedestrians?: CrossingPedestrian[];
  /**
   * What is standing in the carriageway here — the jeepney, the overloaded
   * truck, the cyclist.
   */
  actor?: RoadActorSpec;

  /**
   * The scene prefab this event places, for the older event types whose other
   * fields do not say what stands on the road.
   *
   * Names a reusable composition rather than describing one: two levels asking
   * different questions about the same crossroads place the same prefab and
   * keep their own prompt and grading. Nothing is inferred from `description`
   * or from an asset filename, so if an event needs a particular thing on the
   * road and no other field expresses it, it says so here.
   */
  scenePrefab?: ScenePrefab;
  /**
   * The instant this event reaches its trigger point, the sim freezes —
   * whatever the player's speed — and a full-screen prompt takes the
   * decision, instead of opening a real-time reaction window.
   *
   * For judgment calls where "who goes first" cannot be fairly expressed
   * through accelerate/brake/lane-nudge alone (an uncontrolled junction's
   * right-hand rule, a roundabout's circulating traffic), asking the driver
   * to also time a keypress correctly would be testing reflexes instead of
   * the rule. Reserved for those cases; most events are better taught by a
   * real driving reaction and should leave this unset.
   */
  cutscene?: boolean;
  /**
   * Pairs with `bay`: a parking-technique decision, answered and then *driven*.
   *
   * Unlike plain `cutscene`, which freezes the instant the trigger point is
   * reached, this waits for the driver to bring the car to rest on the
   * carriageway alongside the space — which is itself the first step of the
   * manoeuvre the module teaches ("drive slightly past the space, parallel to
   * the vehicle in front of it"). Only then does the sim freeze and ask which
   * technique gets the car into the bay from there.
   *
   * The answer is not merely scored. The car performs it on the main canvas:
   * reversing in on an arc and straightening up, or cutting in nose-first and
   * ending crooked across the bay. Parking is the one competency this corridor
   * cannot ask the player to drive — there is no reverse gear and no
   * steering-angle state — so the decision is asked, and the *consequence* is
   * still shown where every other consequence in this game is shown: on the
   * road, not in a diagram beside it.
   */
  parkingCutscene?: boolean;
  /**
   * Pairs with `cutscene`: which of the driver's own mechanical failures this
   * is, so the frozen prompt shows the failure instead of the crossroads
   * diagram the right-of-way prompt draws. See `EmergencyKind`.
   */
  emergency?: EmergencyKind;
  /**
   * This event is never graded wrong. It always scores as `correctAction`,
   * whatever the vehicle actually did.
   *
   * For a marking that permits a movement without requiring it — crossing is
   * allowed here, but nothing obliges the driver to take it — there is no
   * wrong choice to fail on. Testing it anyway would either force an unneeded
   * manoeuvre or penalise the sensible driver who saw no reason to make one.
   */
  neutral?: boolean;
  /**
   * Set only on an event the adaptive remediation selector injected into a
   * level, rather than one the level authored as its own curriculum.
   *
   * Never counted toward the pass mark in the game (`scoreDecision`'s
   * `neutral` rule): no points either way and the streak untouched, so a
   * level's `requiredScore`/`stars2`/`stars3` mean exactly what they were
   * calibrated to whether or not remediation fired on this run. The game-level
   * simulation scored it upside-only, which let the learners who got one pass on fewer
   * authored points. It is still graded and still logged, because
   * the entire point of injecting it is to get fresh evidence back into the
   * learner model.
   */
  remediation?: true;
  /**
   * Which level this event was originally written for, stamped by the
   * remediation selector at the moment it borrows the variant.
   *
   * Set only alongside `remediation`. It is the one piece of the selector's
   * `PracticeChoice` that cannot be recovered from the event itself later:
   * `competency` is already a field here, but the source
   * level lives in `remediationPool.ts`'s index, and the grading path is
   * handed the `ScenarioEvent` alone. Carrying it here rather than threading
   * the whole choice down through the drive loop keeps the provenance with
   * the thing it describes, so `ActionLog` can record "this was Level 3
   * content, practised during Level 8" after the fact.
   *
   * Not to be confused with the level *id prefix* on `id`: that names where
   * the content came from too, but as a string convention rather than data,
   * and Level 12 borrows content without being remediation at all.
   */
  remediationSourceLevelId?: number;
}

/**
 * How a scenario asks its question. A scenario is exactly one of these four,
 * so the combinations that have no meaning cannot be written down:
 *
 *   - an inspection that is also a parking cutscene;
 *   - an `emergency` with no `cutscene` to freeze the road and ask;
 *   - a `parkingCutscene` with no bay to park into.
 *
 * Each of those would fail quietly rather than loudly - the emergency prompt
 * never opens, the parking manoeuvre has nowhere to go - which is why they are
 * refused by the type rather than by a runtime check.
 *
 * Constrained at the point of authoring rather than everywhere an event is
 * passed. `ScenarioEvent` stays a plain interface because TypeScript collapses
 * a union when it is spread, and the drive spreads events constantly - putting
 * the constraint downstream would buy a compile-time check at the cost of a
 * cast at every `{ ...event }`, which is the hole the check exists to close.
 */
export type InteractionMode =
  /**
   * Answered with the car, in real time: a speed, a lane, a stop. What most of
   * the game is, and what a scenario gets by declaring none of the rest.
   */
  | {
      inspection?: never;
      cutscene?: never;
      parkingCutscene?: never;
      emergency?: never;
    }
  /** A checkpoint stop, answered by inspecting the document presented. */
  | {
      inspection: CheckpointInspection;
      cutscene?: never;
      parkingCutscene?: never;
      emergency?: never;
      bay?: never;
    }
  /** A frozen prompt: a right-of-way judgment, or one of the driver's own failures. */
  | {
      cutscene: true;
      emergency?: EmergencyKind;
      inspection?: never;
      parkingCutscene?: never;
    }
  /** A parking technique, answered and then driven into the bay it names. */
  | {
      parkingCutscene: true;
      bay: PullOverBay;
      inspection?: never;
      cutscene?: never;
      emergency?: never;
    };

/**
 * What an event puts on the road. A sign and a marking are alternatives, not a
 * pair - an event asks the driver to read either the roadside or the road
 * surface, and showing two plates at once only splits their attention - and a
 * sign without a `scene` is drawn nowhere at all, because the scene is what it
 * stands beside.
 */
export type SceneSource =
  | { sign: SignPlate; scene: RoadScene; marking?: never }
  | { marking: MarkingPlate; sign?: never }
  | { sign?: never; marking?: never };

/**
 * One authored scenario, as content declares it: every field of a
 * `ScenarioEvent`, narrowed to the combinations that mean something.
 */
export type AuthoredEvent = ScenarioEvent & InteractionMode & SceneSource;

/** Close-up drawing shown while a hotspot is being inspected. */
export type GarageDetailArt =
  | 'tire'
  | 'brakes'
  | 'lights'
  | 'engine'
  | 'trunk'
  | 'cockpit'
  /** The front row, seen from behind: two adults, one belt each. */
  | 'belt'
  /** The back seat: a small child on the bare bench beside one on the belt. */
  | 'child_seat'
  | 'plate';

/**
 * One inspectable point on the garage car diagram. Coordinates are 0..1
 * relative to the diagram so the renderer owns the pixel layout.
 */
export interface GarageHotspot {
  id: string;
  label: string;
  /**
   * What this point is about, for the marker that stands on it.
   *
   * Optional: a pre-drive inspection is happy with numbers, and every level
   * before 9 authored one. A crash scene declares it, because "the second dot"
   * is not a thing a person standing at a crash can act on.
   */
  marker?: StageMarkerKind;
  /**
   * The one thing to do here, in a short imperative line.
   *
   * Shown as the scene's immediate objective while this point is the next
   * unresolved one — the single primary instruction the screen carries. The
   * `question` is what is asked once the point is opened; this is what is
   * asked of the player before they open anything.
   */
  objective?: string;
  /** Which BLOWBAGETS letter / readiness area this covers, shown as a tag. */
  area: string;
  x: number;
  y: number;
  /** What the driver sees when this point is inspected. */
  observation: string;
  question: string;
  choices: QuestionChoice[];
  correctAction: ScenarioEvent['correctAction'];
  points: number;
  penaltyMessage: string;
  rewardMessage: string;
  lawCitation?: string;
  competency?: DrivingCompetency;
  severity?: ViolationSeverity;
  /** Optional paperwork shown alongside the observation (OR/CR checks). */
  document?: CheckpointInspection;
  /** Close-up art shown when there is no document to display. */
  detail?: GarageDetailArt;
}

/**
 * Which scene the stage's diagram draws behind its hotspots.
 *
 * The stage machinery — a diagram, points on it, a modal per point, a
 * checklist that must be emptied before you may move on — turned out to have
 * nothing to do with garages. It is the shape of any inspection where the
 * driver walks around a scene deciding one thing at a time, and a crash scene
 * is exactly that. Only the picture underneath changes.
 */
export type StageScene = 'garage' | 'crash_scene';

/**
 * What one point on a stage is *about*, so the screen can mark it with
 * something other than a number.
 *
 * A pre-drive inspection can number its points, because working round a
 * stationary car in order is what an inspection is. A crash scene cannot: the
 * driver is looking at a fire, a vehicle in water and an injured person, and a
 * row of identical dots tells them nothing about which is which or which comes
 * first. Declared rather than read off the label, for the reason every scene in
 * this game is declared: prose is translated and reworded, and the marker must
 * not move when it is.
 */
export type StageMarkerKind =
  /** Something is burning, or about to. */
  | 'fire'
  /** A vehicle or a person is in water. */
  | 'water'
  /** An injured person. */
  | 'casualty'
  /** Paperwork, reporting, the duty owed before leaving. */
  | 'report'
  /** A vehicle, as an object to be examined rather than an emergency. */
  | 'vehicle'
  /** A part of your own car being checked before a trip. */
  | 'inspect';

/**
 * A walk-around inspection stage: a diagram with points on it, each one a
 * decision, none of which may be left unresolved.
 *
 * Used before the drive as a pre-drive readiness check, and — on Level 9 —
 * after it, as the crash scene the driver has just stopped at.
 */
export interface GarageStage {
  plate: string;
  intro: string;
  hotspots: GarageHotspot[];
  /** Defaults to the garage bay, which is what every level before 9 wanted. */
  scene?: StageScene;
}

export interface LevelConfig {
  id: number;
  name: string;
  description: string;
  roadLength: number;
  speedLimit: number;
  events: ScenarioEvent[];
  requiredScore: number;
  stars3: number;
  stars2: number;
  moduleId: string;
  /** Present on levels that begin with a pre-drive readiness stage. */
  garage?: GarageStage;
  /**
   * A stage played once the route has been driven, before the results.
   *
   * Level 9's last event is arriving at a road crash, and stopping for it is
   * only the first line of the duty the law describes. Everything after that
   * line — who you attend to first, who you must not move, what you are
   * required to hand over and report — happens with the vehicle stationary and
   * the driver out of it, which is no longer a driving task at all. It is
   * still the lesson, so it is played where it actually happens: at the end of
   * the drive, on the scene, rather than folded into a multiple-choice
   * question asked through a windscreen.
   */
  aftermath?: GarageStage;
  /**
   * What the carriageway is painted with along the route. Absent on every level
   * that does not need the road to change, which keeps them drawn exactly as
   * they were.
   */
  paint?: RoadPaint;
  /**
   * The road itself, stretch by stretch: its auxiliary lanes, its verge, what
   * its lanes are for, and the signage it carries.
   *
   * Absent on every level whose road never changes, which keeps those levels
   * driving on the constant four-lane carriageway they always had. A level that
   * declares one has its paint, its drivable bounds, its scenery, its traffic
   * and its grading all read from this one description, rather than from
   * per-event overlays dropped beside a road that never knew about them.
   */
  /**
   * How fast this level's world moves under the speed on its dial, where the
   * shared arithmetic does not suit it. See `DrivingPace`.
   */
  pace?: Partial<DrivingPace>;
  route?: RouteLayout;
}
