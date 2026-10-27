// Behavioural characterization of DrivingFSM, for proving that a structural
// change to the machine preserved its semantics.
//
// Why this exists: the FSM cleanup (removing the unreachable PAUSE state,
// `honk` from the alphabet, the shadowed `stop` transitions, the
// `markVehicleStopped` back door that mutated state without consulting the
// transition table, and the redundant LearningPhase annotation) had to be shown
// to be behaviour-preserving rather than asserted to be. Keeping a copy of the old class around to diff against
// doesn't work - the old class is what's being deleted. So instead the machine
// is exhaustively characterized as *data*, that data is committed as a golden
// file, and the cleanup is verified by re-deriving it and diffing.
//
// The characterization is deliberately split into three sections, because not
// all of it is meant to survive the cleanup:
//
//   `core`        - the transition function itself: for every reachable state
//                   and every trigger in the alphabet, was the trigger
//                   accepted and where did it land. This MUST stay byte-identical
//                   through the cleanup. A diff here is a regression.
//   `annotations` - the snapshot carried on log entries and emitted events.
//                   Changes when a field is added to or removed from that
//                   snapshot - the LearningPhase removal is recorded here as a
//                   key disappearing. The diff is the evidence of what went.
//   `structure`   - reachability, dead/shadowed transitions, unused triggers.
//                   This is EXPECTED to change, and the diff is the
//                   minimization result itself (states removed, edges pruned).
//
// Everything here is pure and deterministic: timestamps are stripped, and all
// collections are sorted, so the golden file diffs cleanly.
import { DrivingFSM } from './DrivingFSM';
import type { TransitionParams, TransitionContext, FSMState, UserAction, EnvironmentTrigger, EvaluationOutcome, FSMEvent, FSMSnapshot, } from './fsmTypes';

export type AnyTrigger = UserAction | EnvironmentTrigger | EvaluationOutcome;

/**
 * The alphabet and state set, as runtime values. The unions in `types.ts` are
 * type-only, so these lists are hand-maintained - and the exhaustiveness
 * assertions below make `tsc -b` fail if a union member is ever added without
 * being added here too. Without that guard a new state or trigger would
 * silently drop out of the characterization and the golden file would keep
 * passing while covering less than it claims.
 */
export const ALL_STATES = [
  'IDLE',
  'DRIVING',
  'INTERSECTION',
  'HAZARD',
  'DECISION',
  'VIOLATION',
  'COMPLETED',
  'GAME_OVER',
  'APPROACHING_EVENT',
  'REACTION_WINDOW',
  'FEEDBACK_DISPLAYED',
  'RECOVERY',
] as const satisfies readonly FSMState[];

export const ALL_USER_ACTIONS = [
  'accelerate', 'brake', 'turn_left', 'turn_right', 'stop', 'start',
] as const satisfies readonly UserAction[];

export const ALL_ENVIRONMENT_TRIGGERS = [
  'red_light', 'green_light', 'yellow_light',
  'pedestrian_crossing', 'obstacle_ahead',
  'stop_sign', 'speed_limit', 'road_clear',
  'road_marking', 'overtaking_zone', 'emergency_vehicle',
  'level_end', 'scenario_trigger', 'feedback_displayed',
  'recovery_complete', 'crash', 'vehicle_stopped', 'briefing_dismissed',
] as const satisfies readonly EnvironmentTrigger[];

export const ALL_EVALUATION_OUTCOMES = [
  'answer_correct', 'answer_incorrect',
] as const satisfies readonly EvaluationOutcome[];

/**
 * Fails compilation with a readable type error if a union member exists that
 * the arrays above are missing. `satisfies` above proves every listed member is
 * valid; this proves every valid member is listed.
 */
// The type parameter IS the assertion: constraining it to `never` is what makes
// an uncovered union member a compile error. It has no value-level use by design.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const assertExhaustive = <_T extends never>(): void => {};
assertExhaustive<Exclude<FSMState, (typeof ALL_STATES)[number]>>();
assertExhaustive<Exclude<UserAction, (typeof ALL_USER_ACTIONS)[number]>>();
assertExhaustive<Exclude<EnvironmentTrigger, (typeof ALL_ENVIRONMENT_TRIGGERS)[number]>>();
assertExhaustive<Exclude<EvaluationOutcome, (typeof ALL_EVALUATION_OUTCOMES)[number]>>();

export const ALL_TRIGGERS: readonly AnyTrigger[] = [
  ...ALL_USER_ACTIONS,
  ...ALL_ENVIRONMENT_TRIGGERS,
  ...ALL_EVALUATION_OUTCOMES,
];

// --- observation records -------------------------------------------------

/** One cell of the transition function: what `trigger` does in `from`. */
export interface CoreRow {
  from: FSMState;
  trigger: string;
  /** What `transition()` returned - false means no matching transition. */
  accepted: boolean;
  /** State after the call; equals `from` when rejected. */
  to: FSMState;
}

/** A non-`transition()` operation that can still change state. */
export interface OperationRow {
  from: FSMState;
  operation: string;
  stateAfter: FSMState;
  /** Log entries appended by this call, timestamps stripped. */
  logAppended: Array<{ from: FSMState; to: FSMState; trigger: string }>;
  emitted: Array<{ type: string; from?: FSMState; to?: FSMState; message?: string }>;
}

export interface StructureReport {
  reachableStates: FSMState[];
  /** Declared in `FSMState` but not reachable from IDLE by any trigger sequence. */
  unreachableStates: FSMState[];
  /** Shortest trigger sequence from IDLE to each reachable state. */
  shortestPaths: Record<string, string[]>;
  transitionCount: number;
  /**
   * Transitions that can never fire because an earlier entry in the table
   * already matches the same `(from, trigger)` pair. `transition()` uses
   * `.find()`, so the first match always wins.
   */
  shadowedTransitions: Array<{ from: FSMState; trigger: string; to: FSMState; shadowedBy: FSMState }>;
  /** Transitions whose `from` state is unreachable, so they can never be taken. */
  unreachableTransitions: Array<{ from: FSMState; trigger: string; to: FSMState }>;
  /** Triggers in the alphabet with no transition anywhere in the table. */
  triggersWithNoTransitions: string[];
  /** Triggers with transitions, but none from any reachable state. */
  triggersNeverFireable: string[];
}

export interface AnnotationReport {
  /** Keys present on the snapshot carried by log entries and events. */
  snapshotKeys: string[];
  /** A scripted run exercising phase/competency changes and their observable effect. */
  script: Array<{
    step: string;
    stateAfter: FSMState;
    snapshot: FSMSnapshot;
    emitted: Array<{ type: string; message?: string }>;
    logAppendedCount: number;
  }>;
}

export interface ScenarioRun {
  name: string;
  steps: string[];
  states: FSMState[];
  log: Array<{ from: FSMState; to: FSMState; trigger: string }>;
}

/**
 * How the theta-parameterized guards behave: at which distance each guarded
 * transition first fires, under each theta setting.
 *
 * This is the section that carries the S1 claim. Everything else in this file
 * characterizes a fixed machine; this one characterizes the *family* M(theta),
 * and shows that theta moves the firing point of real transitions.
 */
export interface GuardReport {
  /** Which edges carry a guard at all, straight off the transition table. */
  guardedEdges: Array<{ from: FSMState; trigger: string; to: FSMState }>;
  /** Edges that must never be gated, checked against the table. */
  unguardedSafetyCriticalEdges: Array<{ from: FSMState; trigger: string; to: FSMState }>;
  /**
   * For each theta, the first distance (approaching from far away) at which the
   * guarded transition is accepted. Distances are negative while the event is
   * still ahead, so a more negative value means the machine advances earlier.
   */
  firingDistances: Array<{
    edge: string;
    approachScale: number;
    reactionScale: number;
    /** null when the transition never fired anywhere in the probed range. */
    firstAcceptedAt: number | null;
  }>;
  /** theta values that were requested vs. what the machine clamped them to. */
  clamping: Array<{ requested: TransitionParams; applied: TransitionParams }>;
  /**
   * The approach edge again, with the two limits the world reports in force:
   * first a floor of 80 and 150 units of room, then a road whose baseline
   * already sits outside both. theta moves the firing point only
   * between the limits, and at 1 it lands on the baseline whatever they are -
   * the bound belongs to the machine, not to the loop that reports the numbers.
   */
  boundedFiringDistances: Array<{
    approachScale: number;
    approachFloor: number;
    approachRoom: number;
    firstAcceptedAt: number | null;
  }>;
}

export interface Characterization {
  core: CoreRow[];
  operations: OperationRow[];
  scenarios: ScenarioRun[];
  annotations: AnnotationReport;
  structure: StructureReport;
  guards: GuardReport;
}

// --- probing helpers -----------------------------------------------------

/** A fresh FSM driven to the end of `path`. Paths are pure trigger sequences. */
const probe = (path: readonly string[]): DrivingFSM => {
  const fsm = new DrivingFSM();
  for (const trigger of path) fsm.transition(trigger as AnyTrigger);
  return fsm;
};

/** Runs `fn`, returning the log entries it appended and the events it emitted. */
const observe = (fsm: DrivingFSM, fn: () => void) => {
  const before = fsm.getTransitionLog().length;
  const emitted: FSMEvent[] = [];
  const off = fsm.on(event => emitted.push(event));
  fn();
  off();
  const logAppended = fsm.getTransitionLog().slice(before).map(entry => ({
    from: entry.from,
    to: entry.to,
    trigger: entry.trigger,
  }));
  return { logAppended, emitted };
};

/**
 * Breadth-first search over the transition relation from the initial state,
 * yielding the reachable state set and a shortest trigger path to each. This is
 * the reachability half of the minimization evidence: a state with no path here
 * is provably unreachable through `transition()`.
 */
const explore = () => {
  const start = new DrivingFSM().getState();
  const shortestPaths = new Map<FSMState, string[]>([[start, []]]);
  const queue: FSMState[] = [start];

  while (queue.length > 0) {
    const state = queue.shift()!;
    const path = shortestPaths.get(state)!;
    for (const trigger of ALL_TRIGGERS) {
      const fsm = probe(path);
      if (!fsm.transition(trigger)) continue;
      const next = fsm.getState();
      if (shortestPaths.has(next)) continue;
      shortestPaths.set(next, [...path, trigger]);
      queue.push(next);
    }
  }

  return shortestPaths;
};

// --- section builders ----------------------------------------------------

const buildCore = (shortestPaths: Map<FSMState, string[]>): CoreRow[] => {
  const rows: CoreRow[] = [];
  for (const state of ALL_STATES) {
    const path = shortestPaths.get(state);
    if (!path) continue; // unreachable: reported under `structure`, not here
    for (const trigger of ALL_TRIGGERS) {
      const fsm = probe(path);
      const accepted = fsm.transition(trigger);
      rows.push({ from: state, trigger, accepted, to: fsm.getState() });
    }
  }
  return rows.sort((a, b) => a.from.localeCompare(b.from) || a.trigger.localeCompare(b.trigger));
};

/**
 * The methods that change state by name rather than by trigger.
 *
 * All of them delegate to `transition()`, so the table stays the single
 * definition of the machine. Probed from all 12 states here, which is what
 * would catch a back door assigning `currentState` directly — a state change
 * that never consulted the table and never appeared in the log.
 */
const buildOperations = (shortestPaths: Map<FSMState, string[]>): OperationRow[] => {
  const operations: Array<{ name: string; run: (fsm: DrivingFSM) => void }> = [
    { name: 'markVehicleStopped', run: fsm => fsm.markVehicleStopped() },
    { name: 'markVehicleMoving', run: fsm => fsm.markVehicleMoving() },
    { name: 'reset', run: fsm => fsm.reset() },
  ];

  const rows: OperationRow[] = [];
  for (const state of ALL_STATES) {
    const path = shortestPaths.get(state);
    if (!path) continue;
    for (const operation of operations) {
      const fsm = probe(path);
      const { logAppended, emitted } = observe(fsm, () => operation.run(fsm));
      rows.push({
        from: state,
        operation: operation.name,
        stateAfter: fsm.getState(),
        logAppended,
        emitted: emitted.map(event => ({
          type: event.type,
          from: event.data.from,
          to: event.data.to,
          message: event.data.message,
        })),
      });
    }
  }
  return rows.sort((a, b) => a.from.localeCompare(b.from) || a.operation.localeCompare(b.operation));
};

/**
 * End-to-end drives. Per-cell characterization can't catch ordering or
 * emission bugs across a sequence, and these are the sequences the real game
 * actually produces - see useScenarioEvaluation.ts's correct/incorrect paths.
 */
const SCENARIOS: Array<{ name: string; steps: AnyTrigger[] }> = [
  {
    name: 'clean run: approach, react, correct answer, drive on',
    steps: ['start', 'red_light', 'scenario_trigger', 'red_light', 'answer_correct', 'feedback_displayed', 'road_clear'],
  },
  {
    name: 'violation and recovery after an incorrect answer',
    steps: ['start', 'pedestrian_crossing', 'scenario_trigger', 'pedestrian_crossing', 'answer_incorrect', 'feedback_displayed', 'recovery_complete', 'road_clear'],
  },
  {
    name: 'DECISION-state cutscene graded incorrectly',
    steps: ['start', 'speed_limit', 'scenario_trigger', 'scenario_trigger', 'answer_incorrect', 'feedback_displayed', 'recovery_complete', 'road_clear'],
  },
  {
    name: 'crash ends the run from DRIVING',
    steps: ['start', 'crash'],
  },
  {
    name: 'level completed',
    steps: ['start', 'level_end'],
  },
  {
    name: 'rejected triggers leave the machine untouched',
    steps: ['green_light', 'answer_correct', 'feedback_displayed', 'start', 'recovery_complete', 'brake'],
  },
];

const buildScenarios = (): ScenarioRun[] =>
  SCENARIOS.map(scenario => {
    const fsm = new DrivingFSM();
    const states: FSMState[] = [fsm.getState()];
    for (const trigger of scenario.steps) {
      fsm.transition(trigger);
      states.push(fsm.getState());
    }
    return {
      name: scenario.name,
      steps: scenario.steps,
      states,
      log: fsm.getTransitionLog().map(entry => ({ from: entry.from, to: entry.to, trigger: entry.trigger })),
    };
  });

/**
 * The observable surface of the competency annotation carried alongside the
 * into its own section because this is the part the cleanup intends to remove:
 * the diff here is meant to be non-empty, and reviewing it is how the removal
 * gets signed off.
 */
const buildAnnotations = (): AnnotationReport => {
  const fsm = new DrivingFSM();
  const script: AnnotationReport['script'] = [];

  const step = (label: string, run: () => void) => {
    const { logAppended, emitted } = observe(fsm, run);
    script.push({
      step: label,
      stateAfter: fsm.getState(),
      snapshot: fsm.getSnapshot(),
      emitted: emitted.map(event => ({ type: event.type, message: event.data.message })),
      logAppendedCount: logAppended.length,
    });
  };

  step('initial', () => {});
  step("setCompetency('hazard_awareness')", () => fsm.setCompetency('hazard_awareness'));
  step("setCompetency('hazard_awareness') again (no-op)", () => fsm.setCompetency('hazard_awareness'));
  step("setCompetency('right_of_way')", () => fsm.setCompetency('right_of_way'));
  step("transition('start')", () => fsm.transition('start'));
  step("transition('crash')", () => fsm.transition('crash'));
  step('reset()', () => fsm.reset());

  return {
    snapshotKeys: Object.keys(new DrivingFSM().getSnapshot()).sort(),
    script,
  };
};

const buildStructure = (shortestPaths: Map<FSMState, string[]>): StructureReport => {
  const table = new DrivingFSM().getTransitionTable();
  const reachableStates = ALL_STATES.filter(state => shortestPaths.has(state));
  const reachable = new Set<FSMState>(reachableStates);

  const seen = new Map<string, FSMState>();
  const shadowedTransitions: StructureReport['shadowedTransitions'] = [];
  for (const transition of table) {
    const key = `${transition.from}|${transition.trigger}`;
    const firstTo = seen.get(key);
    // `transition()` resolves with `.find()`, so only the first entry for a
    // `(from, trigger)` pair is ever selectable. Guarded entries are exempt:
    // a condition can make an earlier entry decline, letting a later one win.
    if (firstTo !== undefined && !transition.condition) {
      shadowedTransitions.push({
        from: transition.from,
        trigger: String(transition.trigger),
        to: transition.to,
        shadowedBy: firstTo,
      });
    } else if (firstTo === undefined) {
      seen.set(key, transition.to);
    }
  }

  const triggersWithTransitions = new Set(table.map(t => String(t.trigger)));
  const triggersFromReachable = new Set(
    table.filter(t => reachable.has(t.from)).map(t => String(t.trigger))
  );

  return {
    reachableStates: [...reachableStates].sort(),
    unreachableStates: ALL_STATES.filter(state => !reachable.has(state)).sort(),
    shortestPaths: Object.fromEntries(
      [...shortestPaths.entries()].sort(([a], [b]) => a.localeCompare(b))
    ),
    transitionCount: table.length,
    shadowedTransitions: shadowedTransitions.sort(
      (a, b) => a.from.localeCompare(b.from) || a.trigger.localeCompare(b.trigger)
    ),
    unreachableTransitions: table
      .filter(t => !reachable.has(t.from))
      .map(t => ({ from: t.from, trigger: String(t.trigger), to: t.to }))
      .sort((a, b) => a.from.localeCompare(b.from) || a.trigger.localeCompare(b.trigger)),
    triggersWithNoTransitions: ALL_TRIGGERS
      .filter(trigger => !triggersWithTransitions.has(trigger))
      .map(String)
      .sort(),
    triggersNeverFireable: ALL_TRIGGERS
      .filter(trigger => triggersWithTransitions.has(trigger) && !triggersFromReachable.has(trigger))
      .map(String)
      .sort(),
  };
};

/** Transitions that must stay ungated whatever theta says: ending a run. */
const SAFETY_CRITICAL: Array<{ from: FSMState; trigger: string }> = [
  { from: 'DRIVING', trigger: 'crash' },
  { from: 'DRIVING', trigger: 'level_end' },
  { from: 'DRIVING', trigger: 'vehicle_stopped' },
  { from: 'REACTION_WINDOW', trigger: 'answer_incorrect' },
  { from: 'INTERSECTION', trigger: 'answer_incorrect' },
  { from: 'HAZARD', trigger: 'answer_incorrect' },
  { from: 'DECISION', trigger: 'answer_incorrect' },
];

/** The window sizes probed against; arbitrary but fixed, so results compare. */
const PROBE_WARNING_DISTANCE = 100;
const PROBE_REACTION_DISTANCE = 10;

const buildGuards = (): GuardReport => {
  const table = new DrivingFSM().getTransitionTable();

  const guardedEdges = table
    .filter(t => t.condition)
    .map(t => ({ from: t.from, trigger: String(t.trigger), to: t.to }))
    .sort((a, b) => a.from.localeCompare(b.from) || a.trigger.localeCompare(b.trigger));

  const unguardedSafetyCriticalEdges = SAFETY_CRITICAL
    .map(({ from, trigger }) => table.find(t => t.from === from && String(t.trigger) === trigger))
    .filter((t): t is NonNullable<typeof t> => Boolean(t) && !t!.condition)
    .map(t => ({ from: t.from, trigger: String(t.trigger), to: t.to }));

  /**
   * Walks the car in from far away one unit at a time and reports where the
   * guard first lets the transition through - the observable that theta moves.
   */
  const firstAcceptedAt = (
    edge: 'approach' | 'reaction',
    params: TransitionParams,
    limits: Partial<Pick<TransitionContext, 'approachFloor' | 'approachRoom'>> = {}
  ): number | null => {
    for (let distance = -300; distance <= 0; distance += 1) {
      const fsm = new DrivingFSM();
      fsm.setTransitionParams(params);
      fsm.transition('start'); // -> DRIVING
      fsm.updateContext({
        distanceToEvent: distance,
        warningDistance: PROBE_WARNING_DISTANCE,
        reactionDistance: PROBE_REACTION_DISTANCE,
        ...limits,
      });
      if (edge === 'approach') {
        if (fsm.transition('red_light')) return distance;
      } else {
        // Open the approach with a permissive context, then probe the reaction
        // guard at the distance under test.
        fsm.updateContext({ distanceToEvent: 0 });
        fsm.transition('red_light');
        fsm.updateContext({ distanceToEvent: distance });
        if (fsm.transition('scenario_trigger')) return distance;
      }
    }
    return null;
  };

  const scales = [0.5, 1, 2];
  const firingDistances: GuardReport['firingDistances'] = [];
  for (const scale of scales) {
    firingDistances.push({
      edge: 'DRIVING --red_light--> APPROACHING_EVENT',
      approachScale: scale,
      reactionScale: 1,
      firstAcceptedAt: firstAcceptedAt('approach', { approachScale: scale, reactionScale: 1 }),
    });
    firingDistances.push({
      edge: 'APPROACHING_EVENT --scenario_trigger--> REACTION_WINDOW',
      approachScale: 1,
      reactionScale: scale,
      firstAcceptedAt: firstAcceptedAt('reaction', { approachScale: 1, reactionScale: scale }),
    });
  }

  const clamping = [
    { approachScale: 1, reactionScale: 1 },
    { approachScale: 0, reactionScale: 0 },
    { approachScale: 99, reactionScale: 99 },
    { approachScale: -5, reactionScale: Number.NaN },
  ].map(requested => {
    const fsm = new DrivingFSM();
    fsm.setTransitionParams(requested);
    return { requested, applied: fsm.getTransitionParams() };
  });

  const boundedFiringDistances: GuardReport['boundedFiringDistances'] = [];
  for (const limits of [
    { approachFloor: 80, approachRoom: 150 },
    { approachFloor: 120, approachRoom: 60 },
  ]) {
    for (const scale of scales) {
      boundedFiringDistances.push({
        approachScale: scale,
        ...limits,
        firstAcceptedAt: firstAcceptedAt('approach', { approachScale: scale, reactionScale: 1 }, limits),
      });
    }
  }

  return { guardedEdges, unguardedSafetyCriticalEdges, firingDistances, clamping, boundedFiringDistances };
};

/** The complete characterization. Pure and deterministic. */
export const characterizeFsm = (): Characterization => {
  const shortestPaths = explore();
  return {
    core: buildCore(shortestPaths),
    operations: buildOperations(shortestPaths),
    scenarios: buildScenarios(),
    annotations: buildAnnotations(),
    structure: buildStructure(shortestPaths),
    guards: buildGuards(),
  };
};
