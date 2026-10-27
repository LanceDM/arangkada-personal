// Characterization of the routing FSM as data, for its golden
// (`routingCharacterization.golden.json`) and `npm run routing:check`.
//
// The same idea as the driving FSM's `characterize.ts`: the machine is probed
// exhaustively, the result is committed, and any later change to the machine
// shows up as a diff to review rather than as a claim to trust. Sections:
//
//   `course`     - the states, the alphabet and the course they are built on.
//   `table`      - the declarative rows, with their guards in words.
//   `probes`     - four synthetic content contexts, chosen so that together
//                  they exercise every guard and make every label legal
//                  somewhere. They describe no real level: what today's
//                  content makes legal is for the binding to report.
//   `core`       - for every state x verdict x probe, the legal moves and
//                  where each leads.
//   `scenarios`  - scripted courses through the class, with their logs.
//   `structure`  - the machine's definition of done: every state reachable,
//                  no dead state, no trap, one target per (state, label), and
//                  `step` accepting exactly what `legalTransitions` lists.
//
// Pure and deterministic: no clock, no randomness, and every collection in a
// fixed order.
import type { DrivingCompetency } from '@/domain/learner/competency';
import { COMPETENCIES } from '@/domain/learner/profile';
import type {
  ContentAvailability,
  FrontierState,
  Outcome,
  PracticeAvailability,
  ReviewLevel,
  RoutingContext,
  RoutingMove,
  RoutingState,
  RoutingTransition,
} from './routingTypes';
import {
  CERTIFIED_STATE,
  COURSE_LEVELS,
  FINAL_EXAM_LEVEL,
  FINAL_STATE,
  INITIAL_ROUTING_STATE,
  LAST_COURSE_LEVEL,
  REVIEW_LEVELS,
  ROUTING_ALPHABET,
  ROUTING_STATES,
  TERMINAL_STATES,
  TUTORIAL_LEVEL,
  controlStateId,
  driveState,
  stateId,
  transitionId,
} from './routingTypes';
import { ROUTING_TABLE, step } from './routingTable';
import { RoutingFSM } from './RoutingFSM';

// --- probes --------------------------------------------------------------------

export type ProbeName = 'none' | 'open' | 'gap' | 'mixed';

export const PROBE_NAMES: readonly ProbeName[] = ['none', 'open', 'gap', 'mixed'];
export const OUTCOMES: readonly Outcome[] = ['passed', 'failed'];

const perCompetency = (pick: (index: number) => PracticeAvailability): Record<DrivingCompetency, PracticeAvailability> =>
  Object.fromEntries(COMPETENCIES.map((competency, index) => [competency, pick(index)])) as Record<
    DrivingCompetency,
    PracticeAvailability
  >;

const perReviewLevel = (pick: (level: ReviewLevel) => DrivingCompetency[]): Record<ReviewLevel, DrivingCompetency[]> =>
  Object.fromEntries(REVIEW_LEVELS.map(level => [level, pick(level)])) as Record<ReviewLevel, DrivingCompetency[]>;

const MIXED_PRACTICE: readonly PracticeAvailability[] = ['placeable', 'on-route', 'none'];

/** Synthetic content, each shaped to exercise one side of the guards. */
export const ROUTING_PROBES: Record<ProbeName, ContentAvailability> = {
  none: {
    practice: perCompetency(() => 'none'),
    teaches: perReviewLevel(() => []),
  },
  open: {
    practice: perCompetency(() => 'placeable'),
    teaches: perReviewLevel(() => [...COMPETENCIES]),
  },
  gap: {
    practice: perCompetency(() => 'none'),
    teaches: perReviewLevel(() => [...COMPETENCIES]),
  },
  mixed: {
    practice: perCompetency(index => MIXED_PRACTICE[index % MIXED_PRACTICE.length]),
    teaches: perReviewLevel(level => [COMPETENCIES[(level - 1) % COMPETENCIES.length]]),
  },
};

const PROBE_DESCRIPTIONS: Record<ProbeName, string> = {
  none: 'No competency has a portable item and no level teaches anything: only the plain moves are legal.',
  open: 'Every competency is placeable and every level teaches everything: every practice add-on is legal, and no review, because everything is portable.',
  gap: 'No competency has a portable item and every level teaches everything: every review of a passed level is legal.',
  mixed: "Competencies cycle placeable / on-route / none in COMPETENCIES order; review level L' teaches COMPETENCIES[(L' - 1) mod 11] alone.",
};

export const probeContext = (probe: ProbeName, outcome: Outcome): RoutingContext => ({
  ...ROUTING_PROBES[probe],
  outcome,
});

// --- records -------------------------------------------------------------------

export interface RoutingScenarioRun {
  name: string;
  start: string;
  steps: Array<{ outcome: Outcome; probe: ProbeName; request: string; accepted: boolean; state: string }>;
  log: Array<{ seq: number; from: string; to: string; transition: string; outcome: Outcome; legal: string[] }>;
}

export interface RoutingStructure {
  stateCount: number;
  controlStateCount: number;
  alphabetSize: number;
  tableRows: number;
  cellsProbed: number;
  initial: string;
  reachableStates: string[];
  /** Declared, and not reachable from the initial state by any verdicts and any probe. */
  unreachableStates: string[];
  unreachableControlStates: string[];
  /** The first path found to each state, breadth-first: `verdict | probe | transition`. */
  shortestPaths: Record<string, string[]>;
  /** States with no legal move in any cell. Must be exactly the declared terminal states. */
  terminalStates: string[];
  /** A cell of a non-terminal state with no legal move: the machine would block there. */
  deadCells: string[];
  /** Legal moves out of a declared terminal state. */
  exitsFromTerminal: string[];
  /** Reachable states from which CERTIFIED cannot be reached. */
  trapStates: string[];
  /** A (state, transition) pair with two different targets, within a cell or across cells. */
  nondeterministic: string[];
  /** A label `step` accepts that `legalTransitions` did not list, or refuses that it did, or sends elsewhere. */
  stepDisagreements: string[];
  /** Table rows that offer no move in any cell. */
  rowsNeverOffered: string[];
  /** Labels of the alphabet legal in no cell. */
  labelsNeverLegal: string[];
  /** How many legal moves each row offers across all cells. */
  legalMovesPerRow: Record<string, number>;
}

export interface RoutingCharacterization {
  course: {
    courseLevels: number[];
    tutorial: number;
    lastCourseLevel: number;
    finalExam: number;
    reviewLevels: number[];
    competencies: string[];
    terminalStates: string[];
    controlStates: string[];
    states: string[];
    alphabet: string[];
  };
  table: Array<{ row: string; from: string; on: string; move: string; where: string; guard: string }>;
  probes: Record<ProbeName, { description: string } & ContentAvailability>;
  core: Record<string, string[]>;
  scenarios: RoutingScenarioRun[];
  structure: RoutingStructure;
}

// --- cells ---------------------------------------------------------------------

interface Cell {
  key: string;
  state: RoutingState;
  outcome: Outcome;
  probe: ProbeName;
  context: RoutingContext;
  /** Per table row, in table order. */
  byRow: RoutingMove[][];
  moves: RoutingMove[];
}

const cellKey = (state: RoutingState, outcome: Outcome, probe: ProbeName) =>
  `${stateId(state)} | ${outcome} | ${probe}`;

const moveLabel = (move: RoutingMove) => `${transitionId(move.transition)} -> ${stateId(move.to)}`;

/** Every state x verdict x probe, in that order. */
const buildCells = (): Cell[] =>
  ROUTING_STATES.flatMap(state =>
    OUTCOMES.flatMap(outcome =>
      PROBE_NAMES.map(probe => {
        const context = probeContext(probe, outcome);
        const byRow = ROUTING_TABLE.map(row => row.offers(state, context));
        return { key: cellKey(state, outcome, probe), state, outcome, probe, context, byRow, moves: byRow.flat() };
      })
    )
  );

// --- structure -----------------------------------------------------------------

const buildStructure = (cells: Cell[]): RoutingStructure => {
  const ids = ROUTING_STATES.map(stateId);
  const cellsOf = new Map<string, Cell[]>(ids.map(id => [id, []]));
  for (const cell of cells) cellsOf.get(stateId(cell.state))!.push(cell);

  // Reachability, breadth-first from the initial state over every cell's moves.
  const initial = stateId(INITIAL_ROUTING_STATE);
  const shortestPaths = new Map<string, string[]>([[initial, []]]);
  const queue = [initial];
  while (queue.length > 0) {
    const from = queue.shift()!;
    for (const cell of cellsOf.get(from) ?? []) {
      for (const move of cell.moves) {
        const to = stateId(move.to);
        if (shortestPaths.has(to)) continue;
        shortestPaths.set(to, [...shortestPaths.get(from)!, `${cell.outcome} | ${cell.probe} | ${transitionId(move.transition)}`]);
        queue.push(to);
      }
    }
  }
  const reachable = ids.filter(id => shortestPaths.has(id));

  // Traps: walk the edges backwards from CERTIFIED.
  const predecessors = new Map<string, Set<string>>(ids.map(id => [id, new Set()]));
  for (const cell of cells) {
    for (const move of cell.moves) predecessors.get(stateId(move.to))?.add(stateId(cell.state));
  }
  const certified = stateId(CERTIFIED_STATE);
  const reachesCertified = new Set([certified]);
  const back = [certified];
  while (back.length > 0) {
    for (const predecessor of predecessors.get(back.shift()!) ?? []) {
      if (reachesCertified.has(predecessor)) continue;
      reachesCertified.add(predecessor);
      back.push(predecessor);
    }
  }

  const declaredTerminal = new Set<string>(TERMINAL_STATES);
  const isTerminal = (state: RoutingState) => declaredTerminal.has(state.kind);

  // One target per (state, label): within a cell (two rows offering one label)
  // and across cells (a context moving where a label leads).
  const targets = new Map<string, Set<string>>();
  const nondeterministic: string[] = [];
  for (const cell of cells) {
    const seen = new Set<string>();
    for (const move of cell.moves) {
      const label = transitionId(move.transition);
      if (seen.has(label)) nondeterministic.push(`${cell.key}: ${label} is listed twice`);
      seen.add(label);
      const key = `${stateId(cell.state)} --${label}-->`;
      targets.set(key, (targets.get(key) ?? new Set()).add(stateId(move.to)));
    }
  }
  for (const [key, to] of targets) {
    if (to.size > 1) nondeterministic.push(`${key} ${[...to].join(' / ')}`);
  }

  // `step` against the list, over the whole alphabet.
  const stepDisagreements: string[] = [];
  for (const cell of cells) {
    const listed = new Map(cell.moves.map(move => [transitionId(move.transition), stateId(move.to)]));
    for (const transition of ROUTING_ALPHABET) {
      const label = transitionId(transition);
      const taken = step(cell.state, cell.context, transition);
      const expected = listed.get(label);
      const got = taken === null ? undefined : stateId(taken);
      if (got !== expected) stepDisagreements.push(`${cell.key}: ${label} listed ${expected ?? 'illegal'}, step ${got ?? 'refused'}`);
    }
  }

  const legalLabels = new Set(cells.flatMap(cell => cell.moves.map(move => transitionId(move.transition))));
  const legalMovesPerRow = Object.fromEntries(
    ROUTING_TABLE.map((row, index) => [row.row, cells.reduce((sum, cell) => sum + cell.byRow[index].length, 0)])
  );

  return {
    stateCount: ROUTING_STATES.length,
    controlStateCount: new Set(ROUTING_STATES.map(controlStateId)).size,
    alphabetSize: ROUTING_ALPHABET.length,
    tableRows: ROUTING_TABLE.length,
    cellsProbed: cells.length,
    initial,
    reachableStates: reachable,
    unreachableStates: ids.filter(id => !shortestPaths.has(id)),
    unreachableControlStates: [...new Set(ROUTING_STATES.map(controlStateId))].filter(
      control => !ROUTING_STATES.some(state => controlStateId(state) === control && shortestPaths.has(stateId(state)))
    ),
    shortestPaths: Object.fromEntries(reachable.map(id => [id, shortestPaths.get(id)!])),
    terminalStates: ROUTING_STATES.filter(state => cellsOf.get(stateId(state))!.every(cell => cell.moves.length === 0)).map(
      stateId
    ),
    deadCells: cells.filter(cell => !isTerminal(cell.state) && cell.moves.length === 0).map(cell => cell.key),
    exitsFromTerminal: cells
      .filter(cell => isTerminal(cell.state))
      .flatMap(cell => cell.moves.map(move => `${cell.key}: ${moveLabel(move)}`)),
    trapStates: reachable.filter(id => !reachesCertified.has(id)),
    nondeterministic,
    stepDisagreements,
    rowsNeverOffered: ROUTING_TABLE.filter((_, index) => cells.every(cell => cell.byRow[index].length === 0)).map(
      row => row.row
    ),
    labelsNeverLegal: ROUTING_ALPHABET.map(transitionId).filter(label => !legalLabels.has(label)),
    legalMovesPerRow,
  };
};

/**
 * Every way the machine falls short of its definition of done, in
 * words; empty when it meets it. `npm run routing:check` fails on any, and
 * refuses to write a golden that has one.
 */
export const structuralDefects = (structure: RoutingStructure): string[] => {
  const defects: string[] = [];
  const report = (what: string, found: readonly string[]) => {
    if (found.length > 0) defects.push(`${what}: ${found.join('; ')}`);
  };
  report('unreachable states', structure.unreachableStates);
  report('dead cells', structure.deadCells);
  report('exits from a terminal state', structure.exitsFromTerminal);
  report('trap states', structure.trapStates);
  report('nondeterministic transitions', structure.nondeterministic);
  report('step disagrees with legalTransitions', structure.stepDisagreements);
  report('table rows never offered', structure.rowsNeverOffered);
  report('labels never legal', structure.labelsNeverLegal);
  const declared = ROUTING_STATES.filter(state => TERMINAL_STATES.includes(state.kind)).map(stateId);
  if (structure.terminalStates.join() !== declared.join()) {
    defects.push(`terminal states are ${structure.terminalStates.join(', ') || 'none'}, declared ${declared.join(', ')}`);
  }
  return defects;
};

// --- scenarios -----------------------------------------------------------------

const retry = (practice: DrivingCompetency | null = null): RoutingTransition => ({ kind: 'retry', practice });
const advance = (practice: DrivingCompetency | null = null): RoutingTransition => ({ kind: 'advance', practice });
const review = (level: ReviewLevel, competency: DrivingCompetency): RoutingTransition => ({ kind: 'review', level, competency });
const TO_FINAL: RoutingTransition = { kind: 'to_final' };
const RETURN: RoutingTransition = { kind: 'return' };
const CERTIFY: RoutingTransition = { kind: 'certify' };

type Step = [Outcome, ProbeName, RoutingTransition];

/**
 * Courses the machine is walked through, including refusals. Every probe
 * named here is synthetic; the competencies were picked from `mixed` so each
 * request is legal or illegal for a reason the scenario's name gives.
 */
const SCENARIOS: Array<{ name: string; start: FrontierState; steps: Step[] }> = [
  {
    name: 'the conventional route: every level passed first time, nothing added',
    start: INITIAL_ROUTING_STATE,
    steps: [
      ...COURSE_LEVELS.filter(level => level < LAST_COURSE_LEVEL).map((): Step => ['passed', 'none', advance()]),
      ['passed', 'none', TO_FINAL],
      ['passed', 'none', CERTIFY],
    ],
  },
  {
    name: 'a failed level retried with practice, then passed and advanced with practice',
    start: driveState(4),
    steps: [
      ['failed', 'mixed', retry('road_signs')],
      ['passed', 'mixed', advance('driver_legality')],
    ],
  },
  {
    name: 'a review after a pass, and the return to the frontier whatever the review scored',
    start: driveState(6),
    steps: [
      ['passed', 'mixed', review(3, 'traffic_signals')],
      ['failed', 'mixed', RETURN],
    ],
  },
  {
    name: 'a review before the final exam',
    start: driveState(LAST_COURSE_LEVEL),
    steps: [
      ['passed', 'mixed', review(9, 'hazard_awareness')],
      ['passed', 'mixed', RETURN],
    ],
  },
  {
    name: 'the final exam failed, retried, then passed',
    start: FINAL_STATE,
    steps: [
      ['failed', 'mixed', retry()],
      ['passed', 'mixed', CERTIFY],
    ],
  },
  {
    name: 'illegal requests are refused and leave the state and the log untouched',
    start: INITIAL_ROUTING_STATE,
    steps: [
      ['failed', 'open', retry('pedestrians')], // practice on the tutorial
      ['passed', 'gap', review(1, 'parking')], // nothing passed to review yet
      ['passed', 'open', advance()],
      ['failed', 'mixed', advance()], // advance on a fail
      ['failed', 'gap', review(1, 'parking')], // review after a fail
      ['passed', 'mixed', advance('document_awareness')], // on the route already
      ['passed', 'mixed', review(1, 'driver_legality')], // portable, so practise it instead
      ['passed', 'mixed', review(2, 'traffic_signals')], // Level 2 was not passed
      ['passed', 'mixed', advance('driver_legality')],
    ],
  },
  {
    name: 'nothing is added to the final exam, and nothing leaves CERTIFIED',
    start: driveState(LAST_COURSE_LEVEL),
    steps: [
      ['passed', 'open', advance()], // no Level 12 to advance to
      ['passed', 'open', advance('pedestrians')],
      ['passed', 'open', TO_FINAL],
      ['failed', 'open', retry('pedestrians')], // practice on the final exam
      ['failed', 'open', retry()],
      ['passed', 'open', CERTIFY],
      ['failed', 'open', retry()],
      ['passed', 'open', CERTIFY],
    ],
  },
];

const buildScenarios = (): RoutingScenarioRun[] =>
  SCENARIOS.map(scenario => {
    const machine = new RoutingFSM(scenario.start);
    const steps = scenario.steps.map(([outcome, probe, transition]) => {
      const accepted = machine.take(transition, probeContext(probe, outcome));
      return { outcome, probe, request: transitionId(transition), accepted, state: stateId(machine.getState()) };
    });
    return {
      name: scenario.name,
      start: stateId(scenario.start),
      steps,
      log: machine.getTransitionLog().map(entry => ({
        seq: entry.seq,
        from: stateId(entry.from),
        to: stateId(entry.to),
        transition: transitionId(entry.transition),
        outcome: entry.outcome,
        legal: [...entry.legal],
      })),
    };
  });

// --- the whole -----------------------------------------------------------------

/** The complete characterization. Pure and deterministic. */
export const characterizeRouting = (): RoutingCharacterization => {
  const cells = buildCells();
  return {
    course: {
      courseLevels: [...COURSE_LEVELS],
      tutorial: TUTORIAL_LEVEL,
      lastCourseLevel: LAST_COURSE_LEVEL,
      finalExam: FINAL_EXAM_LEVEL,
      reviewLevels: [...REVIEW_LEVELS],
      competencies: [...COMPETENCIES],
      terminalStates: [...TERMINAL_STATES],
      controlStates: [...new Set(ROUTING_STATES.map(controlStateId))],
      states: ROUTING_STATES.map(stateId),
      alphabet: ROUTING_ALPHABET.map(transitionId),
    },
    table: ROUTING_TABLE.map(({ row, from, on, move, where, guard }) => ({ row, from, on, move, where, guard })),
    probes: Object.fromEntries(
      PROBE_NAMES.map(probe => [probe, { description: PROBE_DESCRIPTIONS[probe], ...ROUTING_PROBES[probe] }])
    ) as RoutingCharacterization['probes'],
    core: Object.fromEntries(cells.map(cell => [cell.key, cell.moves.map(moveLabel)])),
    scenarios: buildScenarios(),
    structure: buildStructure(cells),
  };
};
