// Finite State Machine for Arangkada Driving Simulator
import type { DrivingCompetency } from '@/domain/learner/competency';

export type FSMState = 
  | 'IDLE' 
  | 'DRIVING' 
  | 'INTERSECTION' 
  | 'HAZARD' 
  | 'DECISION'
  | 'VIOLATION'
  | 'COMPLETED'
  | 'GAME_OVER'
  | "APPROACHING_EVENT"
  | "REACTION_WINDOW"
  | "FEEDBACK_DISPLAYED"
  | "RECOVERY";

/**
 * The machine's control state plus the one piece of context worth carrying
 * alongside it.
 *
 * Deliberately only these two. A `LearningPhase` alongside them would carry no
 * information the transition log does not already hold, because its value at
 * any moment is a function of the trigger that has just fired.
 *
 * `competency` stays because it is genuinely independent: it comes from the
 * scenario content being exercised, not from the trigger, so it cannot be
 * recovered from the log alone.
 */
export interface FSMSnapshot {
  competency: DrivingCompetency | 'unassigned';
  gameplay: FSMState;
}

/**
 * The user-input half of the FSM's alphabet: player actions that can drive a
 * state change.
 *
 * Deliberately NOT the same set as the actions gameplay grades. Sounding the
 * horn is a real player action - `getPlayerAction` returns it, checkpoint
 * choices offer it, and `eventTelemetry.ts` grades it against
 * `ScenarioEvent.correctAction` - but it never changes the driving state, so
 * it is not a symbol of this alphabet. It was carried here with no transition
 * anywhere in the table, which made `transition('honk')` a silent no-op;
 * leaving the alphabet means that call is now a compile error instead.
 * The grading vocabulary lives independently on `ScenarioEvent.correctAction`
 * in `domain/scenario/scenarioDefinition` and still includes 'honk'.
 */
export type UserAction =
  | 'accelerate' | 'brake' | 'turn_left'
  | 'turn_right' | 'stop' | 'start';

export type EnvironmentTrigger =
  | 'red_light' | 'green_light' | 'yellow_light'
  | 'pedestrian_crossing' | 'obstacle_ahead'
  | 'stop_sign' | 'speed_limit' | 'road_clear'
  | 'road_marking' | 'overtaking_zone' | 'emergency_vehicle'
  | 'level_end' | 'scenario_trigger'  | "feedback_displayed"
  /**
   * The player has finished reading a scenario and released the drive.
   *
   * An unguarded self-transition on APPROACHING_EVENT whose only effect is the
   * entry it writes — and that entry is the whole point. The reaction clock
   * starts at the most recent one (`reactionClockMs`), so without it the time
   * spent reading sits inside the number the practice policy conditions on, and
   * a careful reader is recorded as a slow responder.
   */
  | 'briefing_dismissed'
  | "recovery_complete" | 'crash'
  /**
   * The vehicle came to rest. Distinct from the `stop` user action on purpose:
   * `stop` self-loops at INTERSECTION/HAZARD (holding position inside an event
   * is the graded correct response there), whereas coming to rest ends the run
   * and returns to IDLE from anywhere. Reusing `stop` for both would silently
   * change behaviour at exactly those two states.
   */
  | 'vehicle_stopped';

/**
 * The FSM's own verdict on a graded decision (a road prompt, a checkpoint
 * Go/No-Go, a right-of-way/parking/emergency cutscene) - distinct from
 * `UserAction`, which is what key was pressed, and from `EnvironmentTrigger`,
 * which is what the world presented. Firing the real verdict here (rather
 * than reusing an unrelated `UserAction` like `accelerate` as a stand-in for
 * "this was wrong") is what lets `transitionLog` actually show which
 * decisions were right or wrong, and is the prerequisite for a policy that
 * chooses among real FSM triggers rather than among scenarios.
 */
export type EvaluationOutcome = 'answer_correct' | 'answer_incorrect';

/**
 * The learned parameters of the transition relation - the vector this machine
 * is optimized over.
 *
 * The FSM is a family of machines M(theta), not a single fixed one: each field
 * scales how early a guarded transition is allowed to fire, relative to the
 * distance the scenario content itself declares. At the default of 1 the guards
 * reproduce the hand-tuned thresholds exactly, so M(DEFAULT_TRANSITION_PARAMS)
 * is the baseline machine.
 *
 * Bounded and monotonic by construction (see `clampTransitionParams`): theta can
 * only move *when* an existing edge fires. It can never add, remove, or redirect
 * an edge, so the reachability graph of M(theta) is invariant under theta - which
 * is what makes optimizing it safe to do with a learned policy.
 */
export interface TransitionParams {
  /** Scales the approach window: DRIVING -> APPROACHING_EVENT. */
  approachScale: number;
  /** Scales the reaction window: APPROACHING_EVENT -> REACTION_WINDOW. */
  reactionScale: number;
}

export const DEFAULT_TRANSITION_PARAMS: TransitionParams = {
  approachScale: 1,
  reactionScale: 1,
};

/**
 * Bounds theta itself. This is a bound on the parameter, not on the road: what
 * a given theta may actually do to an event's approach is limited again, per
 * event, by the room back to the previous event and the floor the world reports
 * (`approachLead`), which is what keeps a wide setting from overlapping the
 * event before and a narrow one from leaving no road to stop in.
 */
export const TRANSITION_PARAM_BOUNDS = { min: 0.5, max: 2 } as const;

const clampScale = (value: number): number =>
  Number.isFinite(value)
    ? Math.min(TRANSITION_PARAM_BOUNDS.max, Math.max(TRANSITION_PARAM_BOUNDS.min, value))
    : 1;

export const clampTransitionParams = (params: TransitionParams): TransitionParams => ({
  approachScale: clampScale(params.approachScale),
  reactionScale: clampScale(params.reactionScale),
});

/**
 * The context variables the guards read - the runtime facts the simulation
 * reports in, kept separate from theta (which is learned) and from `FSMSnapshot`
 * (which is what gets logged and displayed).
 *
 * The FSM owns the decision; the simulation only supplies the measurements.
 * Together with `TransitionParams` this makes the machine an extended finite
 * state machine: control state plus a context valuation, with guards over both.
 */
export interface TransitionContext {
  /** Signed road distance to the active event: negative while it is still ahead. */
  distanceToEvent: number;
  /**
   * The event's baseline lead: how far ahead it announces itself at theta 1,
   * as authored and clamped by the caller - and where its graded zone starts,
   * whatever theta does. Supplied rather than derived so per-event and
   * per-level content (checkpoints, the tutorial, spacing limits) keeps its
   * own say.
   */
  warningDistance: number;
  /**
   * The most road the approach may claim: back to where the previous event's
   * zone closes, plus the margin kept between events, or to the start runway
   * for the first. The ceiling theta widens the approach up to - see
   * `approachLead`. `Infinity` where nothing limits it.
   */
  approachRoom: number;
  /**
   * The least road the approach may leave - the floor theta narrows the
   * approach down to, see `approachLead`. The world decides what it is: a
   * stop's worth from the level's limit for a road event, or `Infinity` for a
   * zone that cannot be narrowed at all. Zero where nothing limits it.
   */
  approachFloor: number;
  /** How close the event must be before the reaction window may open. */
  reactionDistance: number;
  /**
   * The world has committed this event to a decision: the driver has answered
   * it, or the drive has frozen to ask them.
   *
   * A measurement like the other two, not a second theta. The reaction window
   * exists to say "the answer may be given from here", and the distance test
   * is only the world's estimate of where that is - an answer that has already
   * been given is the commit itself, wherever on the approach it happened. The
   * drive settles a requirement the moment the vehicle meets it (see
   * `isSatisfiedEarly`), which is as early as the UI's 120-unit react band,
   * while the commit lead is 10; without this the verdict edges - which exist
   * only from REACTION_WINDOW/INTERSECTION/HAZARD/DECISION - were unreachable
   * for every early answer, so the machine was stranded in APPROACHING_EVENT
   * with no event trigger out of it and every later event's approach refused.
   */
  decisionCommitted: boolean;
}

/**
 * No active event. Guards are written so this satisfies them, which keeps every
 * unguarded call site (and the characterization harness) behaving exactly as it
 * did before guards existed.
 */
export const DEFAULT_TRANSITION_CONTEXT: TransitionContext = {
  distanceToEvent: 0,
  warningDistance: 0,
  approachRoom: Number.POSITIVE_INFINITY,
  approachFloor: 0,
  reactionDistance: 0,
  decisionCommitted: false,
};

export interface FSMTransition {
  from: FSMState;
  trigger: UserAction | EnvironmentTrigger | EvaluationOutcome;
  to: FSMState;
  condition?: () => boolean;
  action?: () => void;
}

/** One recorded entry in `DrivingFSM.getTransitionLog()` - the thesis analytics record. */
export interface TransitionLogEntry {
  from: FSMState;
  to: FSMState;
  trigger: string;
  timestamp: number;
  snapshot: FSMSnapshot;
  /**
   * The theta in force when this transition fired. Recorded per entry because
   * evaluating whether a learned theta beat the baseline means attributing each
   * transition - and its reaction latency - to the parameters that produced it.
   */
  params: TransitionParams;
}

export interface FSMEvent {
  type: 'state_change' | 'violation' | 'reward' | 'feedback';
  data: {
    from?: FSMState;
    to?: FSMState;
    message?: string;
    points?: number;
    snapshot?: FSMSnapshot;
  };
}

export type FSMEventListener = (event: FSMEvent) => void;
