import type { FSMState, UserAction, EnvironmentTrigger, EvaluationOutcome, FSMTransition, FSMEvent, FSMEventListener, FSMSnapshot, TransitionLogEntry, TransitionParams, TransitionContext, } from './fsmTypes';
import { DEFAULT_TRANSITION_PARAMS, DEFAULT_TRANSITION_CONTEXT, clampTransitionParams, } from './fsmTypes';
import { approachLead } from './approachLead';
import type { DrivingCompetency } from '@/domain/learner/competency';

const isFsmState = (state: FSMState, states: readonly FSMState[]) =>
  states.includes(state);

export class DrivingFSM {
  private currentState: FSMState = 'IDLE';
  private snapshot: FSMSnapshot = {
    competency: 'unassigned',
    gameplay: 'IDLE',
  };
  private transitions: FSMTransition[] = [];
  private listeners: FSMEventListener[] = [];

  /** The learned half of the transition relation. See TransitionParams. */
  private params: TransitionParams = DEFAULT_TRANSITION_PARAMS;
  /** The measured half: facts the simulation reports in for guards to read. */
  private context: TransitionContext = DEFAULT_TRANSITION_CONTEXT;

  private transitionLog: TransitionLogEntry[] = [];

  constructor() { this.setupTransitions(); }

  private setupTransitions() {
    const eventTriggers: EnvironmentTrigger[] = [
      'red_light',
      'yellow_light',
      'stop_sign',
      'pedestrian_crossing',
      'obstacle_ahead',
      'speed_limit',
      'road_marking',
      'overtaking_zone',
      'emergency_vehicle',
      'scenario_trigger',
    ];
    /**
     * The approach guard: an event may take the machine out of DRIVING only
     * once the car is inside the announcement window that event declares,
     * scaled by the learned `approachScale` and held between the floor and
     * the room back to the previous event the world reports (`approachLead`).
     *
     * The threshold is a guard on the edge itself, never a distance test in
     * the caller: the FSM owns when the machine advances, and the simulation
     * only reports the measurements it advances against. That is what makes
     * theta a parameter of the transition relation rather than of the loop.
     */
    const withinApproachWindow = (): boolean =>
      this.context.distanceToEvent >= -approachLead(this.context, this.params);

    /**
     * The reaction guard: how close the event must be before the window opens -
     * or, if the world has already committed this event to a decision, the
     * commit itself. An answer that has been given is a commit wherever on the
     * approach it happened, and the verdict edges live on the far side of this
     * one. See `decisionCommitted` in fsmTypes.ts.
     */
    const withinReactionWindow = (): boolean =>
      this.context.decisionCommitted ||
      this.context.distanceToEvent >= -(this.context.reactionDistance * this.params.reactionScale);

    const eventTransitionsFrom = (from: FSMState): FSMTransition[] =>
      eventTriggers.map((trigger): FSMTransition => ({
        from,
        trigger,
        to: 'APPROACHING_EVENT',
        condition: withinApproachWindow,
      }));

    /**
     * States where coming to a stop ends the run and returns the machine to
     * IDLE.
     *
     * INTERSECTION and HAZARD are deliberately absent: they are the only two
     * states that define their own `stop` self-loop (beside their `brake`
     * self-loop, just below), because stopping at an intersection or a hazard
     * is the graded correct response - the driver holds position inside the
     * event rather than abandoning it. Listing them here as well would add a
     * second `(from, 'stop')` entry for each, and `transition()` resolves with
     * `.find()` - so the earlier self-loop would win and the `-> IDLE` edge
     * could never fire. Their absence is the intent, not an oversight.
     */
    const stopToIdleStates: FSMState[] = [
      'DRIVING',
      'APPROACHING_EVENT',
      'REACTION_WINDOW',
      'DECISION',
      'FEEDBACK_DISPLAYED',
      'RECOVERY',
      'VIOLATION',
    ];

    this.transitions = [
      // IDLE
      { from: 'IDLE', trigger: 'start', to: 'DRIVING' },
      { from: 'IDLE', trigger: 'accelerate', to: 'DRIVING' },
      ...eventTransitionsFrom('IDLE'),
      // DRIVING
      ...eventTransitionsFrom('DRIVING'),
      { from: 'DRIVING', trigger: 'level_end', to: 'COMPLETED' },
      { from: 'DRIVING', trigger: 'brake', to: 'DRIVING' },
      { from: 'DRIVING', trigger: 'accelerate', to: 'DRIVING' },
      { from: 'DRIVING', trigger: 'turn_left', to: 'DRIVING' },
      { from: 'DRIVING', trigger: 'turn_right', to: 'DRIVING' },
      // APPROACHING_EVENT
      { from: 'APPROACHING_EVENT', trigger: 'scenario_trigger', to: 'REACTION_WINDOW', condition: withinReactionWindow },
      { from: 'APPROACHING_EVENT', trigger: 'brake', to: 'APPROACHING_EVENT' },
      { from: 'APPROACHING_EVENT', trigger: 'accelerate', to: 'APPROACHING_EVENT' },
      { from: 'APPROACHING_EVENT', trigger: 'turn_left', to: 'APPROACHING_EVENT' },
      { from: 'APPROACHING_EVENT', trigger: 'turn_right', to: 'APPROACHING_EVENT' },
      { from: 'APPROACHING_EVENT', trigger: 'road_clear', to: 'DRIVING' },
      // Unguarded and state-preserving: the player closing the read phase must
      // always be recordable, whatever theta is in force. Its whole effect is
      // the log entry it writes, which re-anchors the reaction clock to the
      // moment the reading stopped and the driving began.
      { from: 'APPROACHING_EVENT', trigger: 'briefing_dismissed', to: 'APPROACHING_EVENT' },
      // REACTION_WINDOW
      { from: 'REACTION_WINDOW', trigger: 'red_light', to: 'INTERSECTION' },
      { from: 'REACTION_WINDOW', trigger: 'yellow_light', to: 'INTERSECTION' },
      { from: 'REACTION_WINDOW', trigger: 'stop_sign', to: 'INTERSECTION' },
      { from: 'REACTION_WINDOW', trigger: 'pedestrian_crossing', to: 'HAZARD' },
      { from: 'REACTION_WINDOW', trigger: 'obstacle_ahead', to: 'HAZARD' },
      { from: 'REACTION_WINDOW', trigger: 'speed_limit', to: 'HAZARD' },
      { from: 'REACTION_WINDOW', trigger: 'road_marking', to: 'HAZARD' },
      { from: 'REACTION_WINDOW', trigger: 'overtaking_zone', to: 'HAZARD' },
      { from: 'REACTION_WINDOW', trigger: 'emergency_vehicle', to: 'HAZARD' },
      { from: 'REACTION_WINDOW', trigger: 'scenario_trigger', to: 'DECISION' },
      { from: 'REACTION_WINDOW', trigger: 'brake', to: 'REACTION_WINDOW' },
      { from: 'REACTION_WINDOW', trigger: 'road_clear', to: 'DRIVING' },
      // INTERSECTION
      { from: 'INTERSECTION', trigger: 'scenario_trigger', to: 'DECISION' },
      { from: 'INTERSECTION', trigger: 'stop', to: 'INTERSECTION' },
      { from: 'INTERSECTION', trigger: 'brake', to: 'INTERSECTION' },
      { from: 'INTERSECTION', trigger: 'green_light', to: 'DRIVING' },
      { from: 'INTERSECTION', trigger: 'road_clear', to: 'DRIVING' },
      { from: 'INTERSECTION', trigger: 'feedback_displayed', to: 'FEEDBACK_DISPLAYED' },
      // HAZARD
      { from: 'HAZARD', trigger: 'scenario_trigger', to: 'DECISION' },
      { from: 'HAZARD', trigger: 'brake', to: 'HAZARD' },
      { from: 'HAZARD', trigger: 'stop', to: 'HAZARD' },
      { from: 'HAZARD', trigger: 'road_clear', to: 'DRIVING' },
      { from: 'HAZARD', trigger: 'feedback_displayed', to: 'FEEDBACK_DISPLAYED' },
      // DECISION (Q&A overlay)
      { from: 'DECISION', trigger: 'road_clear', to: 'DRIVING' },
      // A graded decision's actual verdict, fired from whichever of the four
      // states above a decision is graded in. `answer_correct` is a
      // self-transition purely so the correct/incorrect split shows up in
      // `transitionLog` symmetrically - it never changes gameplay state.
      // The trigger is the verdict, not a proxy for whichever key was pressed:
      // a wrong answer is `answer_incorrect` whatever the driver did.
      ...(['REACTION_WINDOW', 'INTERSECTION', 'HAZARD', 'DECISION'] as const satisfies readonly FSMState[])
        .flatMap((from): FSMTransition[] => [
          { from, trigger: 'answer_correct', to: from },
          { from, trigger: 'answer_incorrect', to: 'VIOLATION' },
        ]),
      // VIOLATION
      { from: 'VIOLATION', trigger: 'feedback_displayed', to: 'FEEDBACK_DISPLAYED' },
      { from: 'VIOLATION', trigger: 'brake', to: 'FEEDBACK_DISPLAYED' },
      { from: 'VIOLATION', trigger: 'road_clear', to: 'FEEDBACK_DISPLAYED' },
      // FEEDBACK_DISPLAYED
      { from: 'FEEDBACK_DISPLAYED', trigger: 'recovery_complete', to: 'RECOVERY' },
      { from: 'FEEDBACK_DISPLAYED', trigger: 'road_clear', to: 'DRIVING' },
      // RECOVERY
      { from: 'RECOVERY', trigger: 'road_clear', to: 'DRIVING' },
      { from: 'RECOVERY', trigger: 'accelerate', to: 'DRIVING' },
      ...stopToIdleStates.map((from): FSMTransition => ({ from, trigger: 'stop', to: 'IDLE' })),
      // Coming to rest returns to IDLE from anywhere the run is still live.
      // An ordinary transition, deliberately: every state change goes through
      // `transition()`, so this table is the single definition of the machine
      // and nothing can move it without appearing in the log.
      ...([
        'DRIVING',
        'APPROACHING_EVENT',
        'REACTION_WINDOW',
        'INTERSECTION',
        'HAZARD',
        'DECISION',
        'VIOLATION',
        'FEEDBACK_DISPLAYED',
        'RECOVERY',
      ] as const satisfies readonly FSMState[]).map(
        (from): FSMTransition => ({ from, trigger: 'vehicle_stopped', to: 'IDLE' })
      ),
      // A collision ends the run from wherever it happens, and is logged like
      // any other transition so the crash shows up in the run data.
      ...([
        'IDLE',
        'DRIVING',
        'APPROACHING_EVENT',
        'REACTION_WINDOW',
        'INTERSECTION',
        'HAZARD',
        'DECISION',
        'VIOLATION',
        'FEEDBACK_DISPLAYED',
        'RECOVERY',
      ] as const satisfies readonly FSMState[]).map(
        (from): FSMTransition => ({ from, trigger: 'crash', to: 'GAME_OVER' })
      ),
    ];
  }

  /**
   * Sets the learned transition-guard parameters. Called once per level entry
   * from the adaptive layer; clamped here rather than at the call site so the
   * bound is a property of the machine, not of whoever happens to be driving it.
   */
  setTransitionParams(params: TransitionParams) {
    this.params = clampTransitionParams(params);
  }

  getTransitionParams(): TransitionParams { return { ...this.params }; }

  /**
   * Reports the current measurements for the guards to read. Pure data in: this
   * never changes state on its own, it only changes what the next `transition()`
   * call is allowed to do.
   */
  updateContext(context: Partial<TransitionContext>) {
    this.context = { ...this.context, ...context };
  }

  getContext(): TransitionContext { return { ...this.context }; }

  getState(): FSMState { return this.currentState; }
  getSnapshot(): FSMSnapshot { return { ...this.snapshot }; }
  getTransitionLog() { return [...this.transitionLog]; }

  /**
   * Read-only view of the declarative transition table built in
   * `setupTransitions()`. Exists for structural analysis, not for gameplay:
   * `characterize.ts` needs it to find transitions that can never fire
   * (a duplicate `(from, trigger)` pair shadowed by an earlier entry, or one
   * whose `from` state is unreachable). Those are invisible to behavioural
   * probing precisely because they never fire, so the table has to be read
   * directly. Nothing may mutate the result - it is the machine's definition.
   */
  getTransitionTable(): readonly FSMTransition[] { return this.transitions; }
  reset() {
    this.currentState = 'IDLE';
    this.snapshot = {
      competency: 'unassigned',
      gameplay: 'IDLE',
    };
    this.transitionLog = [];
    this.emitSnapshotUpdate('FSM reset');
  }

  setCompetency(competency: DrivingCompetency) {
    if (this.snapshot.competency === competency) return;
    this.snapshot = { ...this.snapshot, competency };
    this.emitSnapshotUpdate(`Competency: ${competency}`);
  }

  /**
   * The vehicle came to rest. A thin delegate over the transition table: from
   * IDLE/COMPLETED/GAME_OVER there is no `vehicle_stopped` transition, so this
   * is a no-op exactly as the old guard clause made it.
   */
  markVehicleStopped() {
    this.transition('vehicle_stopped');
  }

  markVehicleMoving() {
    if (!isFsmState(this.currentState, ['IDLE'])) return;
    this.transition('accelerate');
  }

  transition(trigger: UserAction | EnvironmentTrigger | EvaluationOutcome): boolean {
    const validTransition = this.transitions.find(
      t => t.from === this.currentState && t.trigger === trigger && (!t.condition || t.condition())
    );

    if (validTransition) {
      const prevState = this.currentState;
      this.currentState = validTransition.to;
      this.snapshot = { ...this.snapshot, gameplay: this.currentState };
      validTransition.action?.();
      // ← log every transition for thesis data
      this.transitionLog.push({
        from: prevState,
        to: this.currentState,
        trigger,
        timestamp: Date.now(),
        snapshot: this.getSnapshot(),
        params: this.getTransitionParams(),
      });
      this.emit({
        type: 'state_change',
        data: {
          from: prevState,
          to: this.currentState,
          message: `${prevState} -> ${this.currentState}`,
          snapshot: this.getSnapshot(),
        }
      });
      return true;
    }
    return false;
  }

  on(listener: FSMEventListener) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  private emit(event: FSMEvent) {
    this.listeners.forEach(l => l(event));
  }

  private emitSnapshotUpdate(message: string) {
    this.emit({
      type: 'state_change',
      data: {
        from: this.currentState,
        to: this.currentState,
        message,
        snapshot: this.getSnapshot(),
      },
    });
  }
}
